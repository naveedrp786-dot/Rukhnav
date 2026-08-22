"use strict";

const customerLoyaltyService =
    require("./customerLoyaltyService");

// =====================================================
// Helpers
// =====================================================

function createError(
    message,
    statusCode = 400
) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function toMoney(value) {
    return Number(
        toNumber(value).toFixed(2)
    );
}

function generateNumber(prefix) {
    const date =
        new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

    const random =
        Math.floor(
            Math.random() * 900000 +
            100000
        );

    return `${prefix}-${date}-${random}`;
}

function mapOrderPaymentMethod(
    paymentMethod
) {
    const method =
        String(
            paymentMethod || ""
        )
            .trim()
            .toLowerCase();

    if (
        method ===
            "cash_on_delivery" ||
        method ===
            "cash on delivery" ||
        method ===
            "cod"
    ) {
        return "Cash";
    }

    if (
        method ===
            "bank_transfer" ||
        method ===
            "bank transfer"
    ) {
        return "Bank Transfer";
    }

    if (
        method === "jazzcash" ||
        method === "easypaisa"
    ) {
        return "Online";
    }

    return "Online";
}

function mapOrderPaymentStatus(
    order
) {
    const grandTotal =
        toMoney(
            order.grand_total
        );

    const paidAmount =
        Math.max(
            0,
            toMoney(
                order.paid_amount
            )
        );

    if (
        grandTotal > 0 &&
        paidAmount >= grandTotal
    ) {
        return "Paid";
    }

    if (paidAmount > 0) {
        return "Partial";
    }

    return "Pending";
}

// =====================================================
// Find Existing Sale
// =====================================================

async function getSaleByOrderId(
    connection,
    orderId
) {
    const [rows] =
        await connection.query(
            `
            SELECT
                s.id,
                s.sale_number,
                s.order_id,
                s.customer_id,
                s.grand_total,
                s.payment_status,
                i.id AS invoice_id,
                i.invoice_number
            FROM sales s

            LEFT JOIN invoices i
                ON i.sale_id = s.id

            WHERE s.order_id = ?

            LIMIT 1
            `,
            [orderId]
        );

    return rows[0] || null;
}

// =====================================================
// Create Sale + Invoice from Website Order
// =====================================================

async function ensureSaleForOrder(
    connection,
    {
        orderId,
        adminId = null
    }
) {
    const parsedOrderId =
        Number(orderId);

    if (
        !Number.isInteger(
            parsedOrderId
        ) ||
        parsedOrderId <= 0
    ) {
        throw createError(
            "A valid order ID is required."
        );
    }

    /*
     * Lock the website order.
     */
    const [orderRows] =
        await connection.query(
            `
            SELECT
                id,
                order_number,
                customer_id,
                full_name,
                payment_method,
                payment_status,
                paid_amount,
                balance_amount,
                grand_total,
                discount_amount,
                loyalty_discount_amount,
                reward_points_redeemed,
                reward_points_discount_amount,
                delivery_charges,
                coupon_code,
                transaction_id,
                shipping_address,
                order_status,
                created_at
            FROM orders

            WHERE id = ?

            LIMIT 1

            FOR UPDATE
            `,
            [parsedOrderId]
        );

    if (
        orderRows.length === 0
    ) {
        throw createError(
            "Order not found.",
            404
        );
    }

    const order =
        orderRows[0];

    if (
        !order.customer_id
    ) {
        throw createError(
            "This order does not have a customer account and cannot yet be converted into an ERP sale.",
            409
        );
    }

    /*
     * The UNIQUE sales.order_id index already
     * protects us against duplicate sales.
     */
    const existingSale =
        await getSaleByOrderId(
            connection,
            parsedOrderId
        );

    if (existingSale) {
        return {
            created: false,

            saleId:
                existingSale.id,

            saleNumber:
                existingSale.sale_number,

            invoiceId:
                existingSale.invoice_id,

            invoiceNumber:
                existingSale.invoice_number,

            paymentStatus:
                existingSale.payment_status
        };
    }

    // =================================================
    // Load Original Order Items
    // =================================================

    const [items] =
        await connection.query(
            `
            SELECT
                oi.id,
                oi.product_id,
                oi.price,
                oi.quantity,
                oi.subtotal,
                p.product_name
            FROM order_items oi

            INNER JOIN products p
                ON p.id = oi.product_id

            WHERE oi.order_id = ?

            ORDER BY oi.id ASC
            `,
            [parsedOrderId]
        );

    if (
        items.length === 0
    ) {
        throw createError(
            "The order does not contain any products.",
            409
        );
    }

    const subtotal =
        toMoney(
            items.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    toNumber(
                        item.subtotal
                    ),
                0
            )
        );

    const discountAmount =
        toMoney(
            order.discount_amount
        );

    const loyaltyDiscount =
        toMoney(
            order.loyalty_discount_amount
        );

    const rewardPointsUsed =
        Math.max(
            0,
            Number(
                order.reward_points_redeemed || 0
            )
        );

    const rewardDiscount =
        toMoney(
            order.reward_points_discount_amount
        );

    const totalMerchandiseDiscount =
        toMoney(
            discountAmount +
            loyaltyDiscount +
            rewardDiscount
        );

    const deliveryCharges =
        toMoney(
            order.delivery_charges
        );

    const grandTotal =
        toMoney(
            order.grand_total
        );

    const [[paymentTotals]] =
        await connection.query(
            `
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN status IN (
                                'Paid',
                                'Partially Refunded',
                                'Refunded'
                            )
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS gross_paid,
                COALESCE(
                    SUM(refunded_amount),
                    0
                ) AS refunded
            FROM payment_transactions
            WHERE order_id = ?
            `,
            [parsedOrderId]
        );

    const recordedGrossPaid =
        toMoney(
            paymentTotals.gross_paid
        );

    const grossPaidAmount =
        Math.max(
            0,
            recordedGrossPaid > 0
                ? recordedGrossPaid
                : toMoney(order.paid_amount)
        );

    const refundedAmount =
        Math.max(
            0,
            toMoney(
                paymentTotals.refunded
            )
        );

    const netPaidAmount =
        Math.max(
            0,
            toMoney(
                grossPaidAmount -
                refundedAmount
            )
        );

    const balanceAmount =
        Math.max(
            0,
            toMoney(
                grandTotal -
                grossPaidAmount
            )
        );

    const paymentStatus =
        grandTotal > 0 &&
        grossPaidAmount >= grandTotal
            ? "Paid"
            : grossPaidAmount > 0
                ? "Partial"
                : "Pending";

    const refundStatus =
        refundedAmount <= 0
            ? "None"
            : netPaidAmount <= 0
                ? "Refunded"
                : "Partially Refunded";

    const salePaymentMethod =
        mapOrderPaymentMethod(
            order.payment_method
        );

    const saleNumber =
        generateNumber("SAL");

    const invoiceNumber =
        generateNumber("INV");

    const integrationRemarks =
        `Website order ${order.order_number || order.id}`;

    // =================================================
    // Create ERP Sale
    // =================================================

    const [saleResult] =
        await connection.query(
            `
            INSERT INTO sales
            (
                sale_number,
                customer_id,
                order_id,
                sale_date,
                subtotal,
                discount,
                tax,
                grand_total,
                payment_status,
                sale_status,
                payment_method,
                remarks,
                created_by
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                0,
                ?,
                ?,
                'Completed',
                ?,
                ?,
                ?
            )
            `,
            [
                saleNumber,
                order.customer_id,
                parsedOrderId,
                order.created_at ||
                    new Date(),
                subtotal,
                totalMerchandiseDiscount,
                grandTotal,
                paymentStatus,
                salePaymentMethod,
                integrationRemarks,
                adminId || null
            ]
        );

    const saleId =
        saleResult.insertId;

    // =================================================
    // Copy Order Items into Sale Items
    //
    // IMPORTANT:
    // Stock is NOT changed here.
    // Website checkout already reserved/reduced stock.
    // =================================================

    for (
        const item of items
    ) {
        const unitPrice =
            toMoney(
                item.price
            );

        const quantity =
            Number(
                item.quantity
            );

        const lineTotal =
            toMoney(
                item.subtotal
            );

        await connection.query(
            `
            INSERT INTO sale_items
            (
                sale_id,
                product_id,
                quantity,
                unit_price,
                discount,
                total
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                0,
                ?
            )
            `,
            [
                saleId,
                item.product_id,
                quantity,
                unitPrice,
                lineTotal
            ]
        );
    }

    // =================================================
    // Create Invoice
    // =================================================

    const [invoiceResult] =
        await connection.query(
            `
            INSERT INTO invoices
            (
                invoice_number,
                sale_id,
                customer_id,
                invoice_date,
                subtotal,
                product_discount,
                coupon_code,
                coupon_discount,
                loyalty_discount,
                reward_points_used,
                reward_discount,
                shipping_charges,
                packaging_charges,
                tax_percentage,
                tax,
                grand_total,
                paid_amount,
                refunded_amount,
                net_paid_amount,
                balance_amount,
                payment_status,
                refund_status,
                payment_method,
                transaction_id,
                shipping_address,
                status,
                remarks
            )
            VALUES
            (
                ?,
                ?,
                ?,
                NOW(),
                ?,
                0,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                0,
                0,
                0,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                'Issued',
                ?
            )
            `,
            [
                invoiceNumber,
                saleId,
                order.customer_id,
                subtotal,
                order.coupon_code ||
                    null,
                discountAmount,
                loyaltyDiscount,
                rewardPointsUsed,
                rewardDiscount,
                deliveryCharges,
                grandTotal,
                grossPaidAmount,
                refundedAmount,
                netPaidAmount,
                balanceAmount,
                paymentStatus,
                refundStatus,
                salePaymentMethod,
                order.transaction_id ||
                    null,
                order.shipping_address ||
                    null,
                integrationRemarks
            ]
        );

    const invoiceId =
        invoiceResult.insertId;

    // =================================================
    // Copy Invoice Items
    // =================================================

    for (
        const item of items
    ) {
        await connection.query(
            `
            INSERT INTO invoice_items
            (
                invoice_id,
                product_id,
                product_name,
                quantity,
                unit_price,
                discount,
                total
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                0,
                ?
            )
            `,
            [
                invoiceId,
                item.product_id,
                item.product_name,
                Number(
                    item.quantity
                ),
                toMoney(
                    item.price
                ),
                toMoney(
                    item.subtotal
                )
            ]
        );
    }

    return {
        created: true,

        orderId:
            parsedOrderId,

        orderNumber:
            order.order_number,

        saleId,
        saleNumber,
        invoiceId,
        invoiceNumber,
        paymentStatus
    };
}

// =====================================================
// Synchronise Website Payment → Sale + Invoice
// =====================================================

async function syncOrderPaymentToSale(
    connection,
    orderId
) {
    const [rows] =
        await connection.query(
            `
            SELECT
                o.id,
                o.grand_total,
                o.payment_method,
                o.transaction_id,
                o.coupon_code,
                o.discount_amount,
                o.loyalty_discount_amount,
                o.reward_points_redeemed,
                o.reward_points_discount_amount,
                s.id AS sale_id
            FROM orders o

            LEFT JOIN sales s
                ON s.order_id = o.id

            WHERE o.id = ?

            LIMIT 1

            FOR UPDATE
            `,
            [orderId]
        );

    if (
        rows.length === 0
    ) {
        throw createError(
            "Order not found.",
            404
        );
    }

    const order =
        rows[0];

    /*
     * Pending orders may not have been
     * converted into Sales yet.
     */
    if (!order.sale_id) {
        return {
            linked: false,
            saleId: null
        };
    }

    const [[totals]] =
        await connection.query(
            `
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN status IN (
                                'Paid',
                                'Partially Refunded',
                                'Refunded'
                            )
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS gross_paid,
                COALESCE(
                    SUM(refunded_amount),
                    0
                ) AS refunded
            FROM payment_transactions
            WHERE order_id = ?
            `,
            [orderId]
        );

    const grandTotal =
        toMoney(
            order.grand_total
        );

    const grossPaidAmount =
        Math.max(
            0,
            toMoney(
                totals.gross_paid
            )
        );

    const refundedAmount =
        Math.max(
            0,
            toMoney(
                totals.refunded
            )
        );

    const netPaidAmount =
        Math.max(
            0,
            toMoney(
                grossPaidAmount -
                refundedAmount
            )
        );

    /*
     * A refund is not an unpaid balance.
     * Outstanding balance is based on gross
     * payments received before refunds.
     */
    const balanceAmount =
        Math.max(
            0,
            toMoney(
                grandTotal -
                grossPaidAmount
            )
        );

    const paymentStatus =
        grandTotal > 0 &&
        grossPaidAmount >= grandTotal
            ? "Paid"
            : grossPaidAmount > 0
                ? "Partial"
                : "Pending";

    const refundStatus =
        refundedAmount <= 0
            ? "None"
            : netPaidAmount <= 0
                ? "Refunded"
                : "Partially Refunded";

    const paymentMethod =
        mapOrderPaymentMethod(
            order.payment_method
        );

    const couponDiscount =
        toMoney(
            order.discount_amount
        );

    const loyaltyDiscount =
        toMoney(
            order.loyalty_discount_amount
        );

    const rewardPointsUsed =
        Math.max(
            0,
            Number(
                order.reward_points_redeemed || 0
            )
        );

    const rewardDiscount =
        toMoney(
            order.reward_points_discount_amount
        );

    await connection.query(
        `
        UPDATE sales

        SET
            payment_status = ?,
            payment_method = ?,
            discount = ?

        WHERE id = ?
        `,
        [
            paymentStatus,
            paymentMethod,
            toMoney(
                couponDiscount +
                loyaltyDiscount +
                rewardDiscount
            ),
            order.sale_id
        ]
    );

    await connection.query(
        `
        UPDATE invoices

        SET
            coupon_code = ?,
            coupon_discount = ?,
            loyalty_discount = ?,
            reward_points_used = ?,
            reward_discount = ?,
            paid_amount = ?,
            refunded_amount = ?,
            net_paid_amount = ?,
            balance_amount = ?,
            payment_status = ?,
            refund_status = ?,
            payment_method = ?,
            transaction_id =
                COALESCE(
                    ?,
                    transaction_id
                )

        WHERE sale_id = ?
        `,
        [
            order.coupon_code || null,
            couponDiscount,
            loyaltyDiscount,
            rewardPointsUsed,
            rewardDiscount,
            grossPaidAmount,
            refundedAmount,
            netPaidAmount,
            balanceAmount,
            paymentStatus,
            refundStatus,
            paymentMethod,
            order.transaction_id ||
                null,
            order.sale_id
        ]
    );

    return {
        linked: true,

        saleId:
            order.sale_id,

        grossPaidAmount,
        refundedAmount,
        netPaidAmount,
        balanceAmount,
        paymentStatus,
        refundStatus
    };
}

// =====================================================
// Loyalty / Referral After Paid Sale
// =====================================================

async function processPaidOrderSale(
    saleId
) {
    if (!saleId) {
        return null;
    }

    try {
        return await customerLoyaltyService
            .processPaidSale(
                saleId
            );
    } catch (error) {
        console.error(
            "Order sale loyalty/referral processing failed:",
            error
        );

        return {
            success: false,

            warning:
                "Sale and invoice were saved, but loyalty/referral processing requires reprocessing.",

            error:
                error.message
        };
    }
}

module.exports = {
    ensureSaleForOrder,
    syncOrderPaymentToSale,
    processPaidOrderSale
};