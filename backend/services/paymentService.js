"use strict";

const customerLoyaltyService =
    require("./customerLoyaltyService");

const db = require("../config/db");
const accountingAutomation = require("./accountingAutomationService");
const orderSalesIntegrationService =
    require("./orderSalesIntegrationService");
const {
    PAYMENT_STATUS,
    ORDER_PAYMENT_STATUS,
    normaliseMethod,
    normaliseTransactionStatus,
    toMoney
} = require("../utils/paymentHelper");

const fail = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const cleanText = (value, max = 255) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, max) : null;
};

const rollbackQuietly = async connection => {
    try { await connection.rollback(); } catch (_) { /* no-op */ }
};

const makePaymentNumber = (id, now = new Date()) => {
    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("");
    return `PAY-${date}-${String(id).padStart(6, "0")}`;
};

const makeRefundNumber = (id, now = new Date()) => {
    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("");
    return `REF-${date}-${String(id).padStart(6, "0")}`;
};

const calculateAndUpdateOrderPayment = async (connection, orderId) => {
    const [[order]] = await connection.query(
        `SELECT id, grand_total FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`,
        [orderId]
    );
    if (!order) throw fail("Order not found.", 404);

    const [[totals]] = await connection.query(
        `
            SELECT
                COALESCE(SUM(CASE WHEN status IN ('Paid','Partially Refunded','Refunded') THEN amount ELSE 0 END), 0) AS gross_paid,
                COALESCE(SUM(refunded_amount), 0) AS refunded
            FROM payment_transactions
            WHERE order_id = ?
        `,
        [orderId]
    );

    const grandTotal = toMoney(order.grand_total) || 0;
    const grossPaid = toMoney(totals.gross_paid) || 0;
    const refunded = toMoney(totals.refunded) || 0;
    const netPaid = Math.max(0, toMoney(grossPaid - refunded));
    const balance = Math.max(0, toMoney(grandTotal - netPaid));

    let paymentStatus = ORDER_PAYMENT_STATUS.PENDING;
    if (refunded > 0 && netPaid <= 0) {
        paymentStatus = ORDER_PAYMENT_STATUS.REFUNDED;
    } else if (refunded > 0) {
        paymentStatus = ORDER_PAYMENT_STATUS.PARTIALLY_REFUNDED;
    } else if (netPaid >= grandTotal && grandTotal > 0) {
        paymentStatus = ORDER_PAYMENT_STATUS.PAID;
    } else if (netPaid > 0) {
        paymentStatus = ORDER_PAYMENT_STATUS.PARTIALLY_PAID;
    }

    await connection.query(
        `
            UPDATE orders
            SET paid_amount = ?, balance_amount = ?, payment_status = ?
            WHERE id = ?
        `,
        [netPaid, balance, paymentStatus, orderId]
    );

    return { grandTotal, grossPaid, refunded, paidAmount: netPaid, balanceAmount: balance, paymentStatus };
};

const recordPayment = async ({ orderId, adminId, payload }) => {
    const method = normaliseMethod(payload.payment_method);
    const status = normaliseTransactionStatus(payload.status);
    const amount = toMoney(payload.amount);
    const gateway = cleanText(payload.payment_gateway, 100);
    const reference = cleanText(payload.transaction_reference, 150);
    const gatewayTransactionId = cleanText(payload.gateway_transaction_id, 150);
    const notes = cleanText(payload.notes, 2000);
    const currency = cleanText(payload.currency || "PKR", 10).toUpperCase();

    if (!method) throw fail("A valid payment method is required.");
    if (!status || [PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED].includes(status)) {
        throw fail("A valid initial payment status is required.");
    }
    if (amount === null || amount <= 0) throw fail("Payment amount must be greater than zero.");

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[order]] = await connection.query(
            `
                SELECT id, order_number, customer_id, grand_total, paid_amount, balance_amount,
                       payment_status, order_status
                FROM orders
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
            `,
            [orderId]
        );
        if (!order) throw fail("Order not found.", 404);
        if (order.order_status === "Cancelled") throw fail("A payment cannot be recorded for a cancelled order.", 409);

        if (reference) {
            const [[duplicate]] = await connection.query(
                `SELECT id FROM payment_transactions WHERE transaction_reference = ? LIMIT 1`,
                [reference]
            );
            if (duplicate) throw fail("This transaction reference has already been used.", 409);
        }

        if (status === PAYMENT_STATUS.PAID) {
            const grandTotal = toMoney(order.grand_total) || 0;
            const paidAmount = toMoney(order.paid_amount) || 0;
            const calculatedOutstanding = Math.max(
                0,
                toMoney(grandTotal - paidAmount) || 0
            );
            const storedOutstanding = toMoney(order.balance_amount);
            const outstanding =
                order.payment_status !== ORDER_PAYMENT_STATUS.PAID &&
                calculatedOutstanding > 0 &&
                (storedOutstanding === null || storedOutstanding <= 0)
                    ? calculatedOutstanding
                    : Math.max(0, storedOutstanding ?? calculatedOutstanding);

            if (amount > outstanding) {
                throw fail(
                    `Payment amount exceeds the outstanding balance of PKR ${outstanding.toFixed(2)}.`,
                    409
                );
            }
        }

        const [result] = await connection.query(
            `
                INSERT INTO payment_transactions
                (
                    order_id, customer_id, payment_method, payment_gateway,
                    transaction_reference, gateway_transaction_id, amount,
                    currency, status, notes, paid_at, created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        CASE WHEN ? = 'Paid' THEN CURRENT_TIMESTAMP ELSE NULL END, ?)
            `,
            [
                orderId, order.customer_id, method, gateway, reference,
                gatewayTransactionId, amount, currency, status, notes,
                status, adminId || null
            ]
        );

        const paymentId = result.insertId;
        const paymentNumber = makePaymentNumber(paymentId);
        await connection.query(
            `UPDATE payment_transactions SET payment_number = ? WHERE id = ?`,
            [paymentNumber, paymentId]
        );

        const summary = await calculateAndUpdateOrderPayment(connection, orderId);
        const [[payment]] = await connection.query(
            `SELECT * FROM payment_transactions WHERE id = ? LIMIT 1`,
            [paymentId]
        );

        await accountingAutomation.postCustomerPayment(
            connection,
            payment,
            adminId || null
        );

        // =============================================
        // Order Payment -> ERP Sale -> Invoice
        // =============================================

        const salesSync =
            await orderSalesIntegrationService
                .syncOrderPaymentToSale(
                    connection,
                    orderId
                );

        await connection.commit();

        // =============================================
        // Paid Sale -> Loyalty -> Referral
        //
        // This must run AFTER the payment transaction
        // commits because the loyalty service uses its
        // own database connection.
        // =============================================

        let loyaltyProcessing = null;

        if (
            salesSync.linked &&
            salesSync.paymentStatus === "Paid"
        ) {
            loyaltyProcessing =
                await orderSalesIntegrationService
                    .processPaidOrderSale(
                        salesSync.saleId
                    );
        }

        return {
            payment,
            orderPaymentSummary: summary,
            salesSync,
            loyaltyProcessing
        };
    } catch (error) {
        if (connection) await rollbackQuietly(connection);
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

const getOrderPayments = async orderId => {
    const [[order]] = await db.query(
        `
            SELECT id, order_number, customer_id, grand_total, paid_amount,
                   balance_amount, payment_status
            FROM orders WHERE id = ? LIMIT 1
        `,
        [orderId]
    );
    if (!order) throw fail("Order not found.", 404);

    const [payments] = await db.query(
        `
            SELECT
                pt.*,
                COALESCE((SELECT SUM(pr.amount) FROM payment_refunds pr
                          WHERE pr.payment_transaction_id = pt.id
                            AND pr.status = 'Completed'), 0) AS completed_refunds
            FROM payment_transactions pt
            WHERE pt.order_id = ?
            ORDER BY pt.created_at DESC, pt.id DESC
        `,
        [orderId]
    );

    return { order, payments };
};

const refundPayment = async ({ paymentId, adminId, payload }) => {
    const amount = toMoney(payload.amount);
    const reason = cleanText(payload.reason, 1000);
    const reference = cleanText(payload.transaction_reference, 150);

    if (amount === null || amount <= 0) throw fail("Refund amount must be greater than zero.");
    if (!reason) throw fail("Refund reason is required.");

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [[payment]] = await connection.query(
            `
                SELECT * FROM payment_transactions
                WHERE id = ? LIMIT 1 FOR UPDATE
            `,
            [paymentId]
        );
        if (!payment) throw fail("Payment transaction not found.", 404);
        if (![PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(payment.status)) {
            throw fail("Only a paid or partially refunded payment can be refunded.", 409);
        }

        const paidAmount = toMoney(payment.amount) || 0;
        const alreadyRefunded = toMoney(payment.refunded_amount) || 0;
        const refundable = toMoney(paidAmount - alreadyRefunded);
        if (amount > refundable) {
            throw fail(`Refund amount exceeds the refundable balance of PKR ${refundable.toFixed(2)}.`, 409);
        }

        if (reference) {
            const [[duplicate]] = await connection.query(
                `SELECT id FROM payment_refunds WHERE transaction_reference = ? LIMIT 1`,
                [reference]
            );
            if (duplicate) throw fail("This refund transaction reference has already been used.", 409);
        }

        const [result] = await connection.query(
            `
                INSERT INTO payment_refunds
                (payment_transaction_id, order_id, amount, reason,
                 transaction_reference, status, refunded_by, completed_at)
                VALUES (?, ?, ?, ?, ?, 'Completed', ?, CURRENT_TIMESTAMP)
            `,
            [paymentId, payment.order_id, amount, reason, reference, adminId || null]
        );

        const refundId = result.insertId;
        const refundNumber = makeRefundNumber(refundId);
        await connection.query(
            `UPDATE payment_refunds SET refund_number = ? WHERE id = ?`,
            [refundNumber, refundId]
        );

        const newRefunded = toMoney(alreadyRefunded + amount);
        const newStatus = newRefunded >= paidAmount
            ? PAYMENT_STATUS.REFUNDED
            : PAYMENT_STATUS.PARTIALLY_REFUNDED;

        await connection.query(
            `
                UPDATE payment_transactions
                SET refunded_amount = ?, status = ?
                WHERE id = ?
            `,
            [newRefunded, newStatus, paymentId]
        );

        const summary = await calculateAndUpdateOrderPayment(connection, payment.order_id);

        const [[updatedOrder]] =
            await connection.query(
                `SELECT id, payment_status
                 FROM orders
                 WHERE id = ?
                 LIMIT 1`,
                [payment.order_id]
            );

        const orderFullyRefunded =
            String(
                updatedOrder?.payment_status ||
                ""
            ).toLowerCase() === "refunded";

        const [[refund]] = await connection.query(
            `SELECT * FROM payment_refunds WHERE id = ? LIMIT 1`,
            [refundId]
        );

        await accountingAutomation.postCustomerRefund(
            connection,
            refund,
            payment,
            adminId || null
        );

        // Keep the linked ERP Sale and Invoice
        // synchronized with the refunded order balance.
        const salesSync =
            await orderSalesIntegrationService
                .syncOrderPaymentToSale(
                    connection,
                    payment.order_id
                );

    /*
     * A true full refund becomes the final
     * customer-facing order state.
     *
     * Partial refunds deliberately preserve
     * the existing fulfilment status.
     */
    if (orderFullyRefunded) {
        await connection.query(
            `
                UPDATE orders
                SET
                    order_status = 'Refunded',
                    refunded_at = COALESCE(
                        refunded_at,
                        CURRENT_TIMESTAMP
                    )
                WHERE id = ?
            `,
            [payment.order_id]
        );
    }


        await connection.commit();

        // Full order refund -> reverse earned purchase loyalty.
        // Partial refunds deliberately do not reverse all sale points.
        let loyaltyReversal = null;
        let loyaltyWarning = null;

        if (
            orderFullyRefunded &&
            salesSync?.linked &&
            salesSync?.saleId
        ) {
            try {
                loyaltyReversal =
                    await customerLoyaltyService
                        .reverseSalePoints(
                            salesSync.saleId,
                            `Website order ${payment.order_id} fully refunded`
                        );
            } catch (error) {
                if (Number(error.statusCode) === 404) {
                    loyaltyReversal = {
                        success: true,
                        pointsReversed: 0,
                        message:
                            "No purchase loyalty points had been awarded for this sale."
                    };
                } else {
                    console.error(
                        "Refund loyalty reversal failed:",
                        error
                    );

                    loyaltyWarning =
                        error.message ||
                        "Refund completed, but loyalty reversal requires review.";
                }
            }
        }

        return {
            refund,
            paymentStatus: newStatus,
            orderFullyRefunded,
            orderPaymentSummary: summary,
            salesSync,
            loyaltyReversal,
            loyaltyWarning
        };
    } catch (error) {
        if (connection) await rollbackQuietly(connection);
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    recordPayment,
    getOrderPayments,
    refundPayment
};
