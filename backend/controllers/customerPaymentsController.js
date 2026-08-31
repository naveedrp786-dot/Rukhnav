"use strict";

const db = require("../config/db");

const customerLoyaltyService =
    require(
        "../services/customerLoyaltyService"
    );

const VALID_PAYMENT_METHODS = [
    "Cash",
    "Card",
    "Bank Transfer",
    "Online"
];

// =========================================
// Helpers
// =========================================

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

function getAdminId(req) {
    return (
        req.admin?.id ||
        req.user?.id ||
        req.user?.adminId ||
        req.adminId ||
        null
    );
}

function generateReference() {
    return (
        "PAY-" +
        new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "") +
        "-" +
        Math.floor(
            Math.random() * 900000 +
            100000
        )
    );
}

// =========================================
// Add Payment to Existing Sale
// =========================================

exports.addSalePayment = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    let transactionCommitted = false;

    try {
        const saleId =
            Number(req.params.saleId);

        const amount =
            toMoney(req.body.amount);

        const paymentMethod =
            String(
                req.body.payment_method ||
                ""
            ).trim();

        const referenceNumber =
            String(
                req.body.reference_no ||
                ""
            ).trim() ||
            generateReference();

        const remarks =
            String(
                req.body.remarks ||
                ""
            ).trim();

        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            throw createError(
                "A valid sale ID is required."
            );
        }

        if (amount <= 0) {
            throw createError(
                "Payment amount must be greater than zero."
            );
        }

        if (
            !VALID_PAYMENT_METHODS.includes(
                paymentMethod
            )
        ) {
            throw createError(
                "Please select a valid payment method."
            );
        }

        if (
            referenceNumber.length > 100
        ) {
            throw createError(
                "Reference number cannot exceed 100 characters."
            );
        }

        await connection.beginTransaction();

        /*
         * Lock the sale and invoice so two
         * payments cannot update them together.
         */
        const [rows] =
            await connection.query(
                `
                SELECT
                    s.id AS sale_id,
                    s.sale_number,
                    s.customer_id,
                    s.grand_total
                        AS sale_grand_total,
                    s.payment_status
                        AS sale_payment_status,

                    i.id AS invoice_id,
                    i.invoice_number,
                    i.grand_total
                        AS invoice_grand_total,
                    i.paid_amount,
                    i.balance_amount,
                    i.payment_status
                        AS invoice_payment_status,
                    i.status
                        AS invoice_status,

                    c.full_name
                        AS customer_name

                FROM sales s

                JOIN invoices i
                    ON i.sale_id = s.id

                JOIN customers c
                    ON c.id = s.customer_id

                WHERE s.id = ?

                LIMIT 1
                FOR UPDATE
                `,
                [saleId]
            );

        if (rows.length === 0) {
            throw createError(
                "Sale or connected invoice was not found.",
                404
            );
        }

        const record =
            rows[0];

        if (
            record.invoice_status ===
            "Cancelled"
        ) {
            throw createError(
                "Payment cannot be added to a cancelled invoice."
            );
        }

        const previousPaidAmount =
            toMoney(record.paid_amount);

        const previousBalance =
            toMoney(
                record.balance_amount
            );

        if (
            record.invoice_payment_status ===
                "Paid" ||
            previousBalance <= 0
        ) {
            throw createError(
                "This sale is already fully paid."
            );
        }

        if (amount > previousBalance) {
            throw createError(
                `Payment cannot exceed the outstanding balance of PKR ${previousBalance.toFixed(2)}.`
            );
        }

        const newPaidAmount =
            toMoney(
                previousPaidAmount +
                amount
            );

        const newBalance =
            toMoney(
                previousBalance -
                amount
            );

        const newPaymentStatus =
            newBalance <= 0
                ? "Paid"
                : "Partial";

        // =====================================
        // Record Customer Payment
        // =====================================

        const [paymentResult] =
            await connection.query(
                `
                INSERT INTO customer_payments (
                    sale_id,
                    customer_id,
                    payment_date,
                    payment_method,
                    amount,
                    reference_no,
                    remarks,
                    created_by
                )
                VALUES (
                    ?,
                    ?,
                    CURDATE(),
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                `,
                [
                    record.sale_id,
                    record.customer_id,
                    paymentMethod,
                    amount,
                    referenceNumber,
                    remarks ||
                        "Additional customer payment",
                    getAdminId(req)
                ]
            );

        // =====================================
        // Update Invoice
        // =====================================

        await connection.query(
            `
            UPDATE invoices
            SET
                paid_amount = ?,
                balance_amount = ?,
                payment_status = ?,
                payment_method = ?,
                transaction_id = ?
            WHERE id = ?
            `,
            [
                newPaidAmount,
                newBalance,
                newPaymentStatus,
                paymentMethod,
                referenceNumber,
                record.invoice_id
            ]
        );

        // =====================================
        // Update Sale
        // =====================================

        await connection.query(
            `
            UPDATE sales
            SET
                payment_status = ?,
                payment_method = ?
            WHERE id = ?
            `,
            [
                newPaymentStatus,
                paymentMethod,
                record.sale_id
            ]
        );

        await connection.commit();

        transactionCommitted = true;

        // =====================================
        // Award Loyalty After Final Payment
        // =====================================

        let loyaltyResult = null;
        let loyaltyWarning = null;

        if (newPaymentStatus === "Paid") {
            try {
                loyaltyResult =
                    await customerLoyaltyService
                        .processPaidSale(
                            record.sale_id
                        );
            } catch (loyaltyError) {
                console.error(
                    "Final-payment loyalty processing failed:",
                    loyaltyError
                );

                loyaltyWarning =
                    "Payment was saved, but loyalty points require reprocessing.";
            }
        }

        return res.status(201).json({
            success: true,

            message:
                newPaymentStatus === "Paid"
                    ? "Final payment recorded and sale marked as paid."
                    : "Partial payment recorded successfully.",

            payment: {
                id:
                    paymentResult.insertId,
                referenceNumber,
                amount,
                paymentMethod
            },

            sale: {
                id: record.sale_id,
                saleNumber:
                    record.sale_number,
                customerId:
                    record.customer_id,
                customerName:
                    record.customer_name,
                paymentStatus:
                    newPaymentStatus
            },

            invoice: {
                id: record.invoice_id,
                invoiceNumber:
                    record.invoice_number,
                grandTotal:
                    toMoney(
                        record
                            .invoice_grand_total
                    ),
                previousPaidAmount,
                paidAmount:
                    newPaidAmount,
                balanceAmount:
                    newBalance,
                paymentStatus:
                    newPaymentStatus
            },

            loyalty:
                loyaltyResult,

            loyaltyWarning
        });
    } catch (error) {
        if (!transactionCommitted) {
            await connection.rollback();
        }

        console.error(
            "Add sale payment error:",
            error
        );

        return res
            .status(
                error.statusCode || 500
            )
            .json({
                success: false,
                message:
                    error.message ||
                    "Unable to record customer payment."
            });
    } finally {
        connection.release();
    }
};

// =========================================
// Get Payments for One Sale
// =========================================

exports.getSalePayments = async (
    req,
    res
) => {
    try {
        const saleId =
            Number(req.params.saleId);

        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid sale ID is required."
            });
        }

        const [saleRows] =
            await db.query(
                `
                SELECT
                    s.id,
                    s.sale_number,
                    s.customer_id,
                    c.full_name
                        AS customer_name,
                    s.grand_total,
                    s.payment_status,

                    i.id AS invoice_id,
                    i.invoice_number,
                    i.paid_amount,
                    i.balance_amount

                FROM sales s

                JOIN customers c
                    ON c.id = s.customer_id

                LEFT JOIN invoices i
                    ON i.sale_id = s.id

                WHERE s.id = ?

                LIMIT 1
                `,
                [saleId]
            );

        if (saleRows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Sale was not found."
            });
        }

        const [payments] =
            await db.query(
                `
                SELECT
                    id,
                    payment_date,
                    payment_method,
                    amount,
                    reference_no,
                    remarks,
                    created_by,
                    created_at
                FROM customer_payments
                WHERE sale_id = ?
                ORDER BY
                    payment_date DESC,
                    id DESC
                `,
                [saleId]
            );

        return res.json({
            success: true,
            sale: saleRows[0],
            paymentCount:
                payments.length,
            payments
        });
    } catch (error) {
        console.error(
            "Get sale payments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load sale payments.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// =========================================
// Get All Customer Payments
// =========================================

exports.getCustomerPayments = async (
    req,
    res
) => {
    try {
        const [payments] =
            await db.query(
                `
                SELECT
                    cp.id,
                    cp.sale_id,
                    s.sale_number,
                    cp.customer_id,
                    c.full_name
                        AS customer_name,
                    cp.payment_date,
                    cp.payment_method,
                    cp.amount,
                    cp.reference_no,
                    cp.remarks,
                    cp.created_by,
                    cp.created_at,

                    s.grand_total,
                    s.payment_status,

                    i.invoice_number,
                    i.paid_amount,
                    i.balance_amount

                FROM customer_payments cp

                JOIN sales s
                    ON s.id = cp.sale_id

                JOIN customers c
                    ON c.id = cp.customer_id

                LEFT JOIN invoices i
                    ON i.sale_id = s.id

                ORDER BY
                    cp.payment_date DESC,
                    cp.id DESC
                `
            );

        return res.json({
            success: true,
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error(
            "Get customer payments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load customer payments.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};