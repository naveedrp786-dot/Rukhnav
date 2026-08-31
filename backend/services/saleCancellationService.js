"use strict";

const db = require("../config/db");

const customerLoyaltyService =
    require(
        "./customerLoyaltyService"
    );

const inventoryService =
    require(
        "./inventoryService"
    );

const VALID_REFUND_METHODS = [
    "Cash",
    "Card",
    "Bank Transfer",
    "Online"
];

const VALID_REFUND_STATUSES = [
    "Pending",
    "Completed",
    "Failed"
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

// =========================================
// Cancel Sale
// =========================================

async function cancelSale({
    saleId,
    reason,
    refundMethod,
    refundStatus = "Pending",
    refundReference = null,
    refundNotes = null,
    adminId = null
}) {
    const connection =
        await db.getConnection();

    let transactionCommitted = false;

    try {
        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            throw createError(
                "A valid sale ID is required."
            );
        }

        const cleanReason =
            String(reason || "").trim();

        if (!cleanReason) {
            throw createError(
                "A cancellation reason is required."
            );
        }

        if (cleanReason.length > 255) {
            throw createError(
                "Cancellation reason cannot exceed 255 characters."
            );
        }

        await connection.beginTransaction();

        // =====================================
        // Lock Sale
        // =====================================

        const [saleRows] =
            await connection.query(
                `
                SELECT
                    s.id,
                    s.sale_number,
                    s.customer_id,
                    s.grand_total,
                    s.payment_status,
                    s.payment_method,
                    s.sale_status,

                    i.id AS invoice_id,
                    i.invoice_number,
                    i.paid_amount,
                    i.balance_amount,
                    i.status AS invoice_status

                FROM sales s

                LEFT JOIN invoices i
                    ON i.sale_id = s.id

                WHERE s.id = ?

                LIMIT 1
                FOR UPDATE
                `,
                [saleId]
            );

        if (saleRows.length === 0) {
            throw createError(
                "Sale was not found.",
                404
            );
        }

        const sale =
            saleRows[0];

        if (
            sale.sale_status ===
            "Cancelled"
        ) {
            throw createError(
                "This sale has already been cancelled."
            );
        }

        // =====================================
        // Check Existing Cancellation
        // =====================================

        const [existingRows] =
            await connection.query(
                `
                SELECT id
                FROM sale_cancellations
                WHERE sale_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [saleId]
            );

        if (existingRows.length > 0) {
            throw createError(
                "A cancellation record already exists for this sale."
            );
        }

        // =====================================
        // Validate Refund
        // =====================================

        const amountPaid =
            toMoney(
                sale.paid_amount
            );

        const refundRequired =
            amountPaid > 0;

        let finalRefundMethod =
            refundMethod ||
            sale.payment_method;

        let finalRefundStatus =
            refundStatus || "Pending";

        if (refundRequired) {
            if (
                !VALID_REFUND_METHODS.includes(
                    finalRefundMethod
                )
            ) {
                throw createError(
                    "A valid refund method is required for a paid or partially paid sale."
                );
            }

            if (
                !VALID_REFUND_STATUSES.includes(
                    finalRefundStatus
                )
            ) {
                throw createError(
                    "Please select a valid refund status."
                );
            }
        }

        const cleanReference =
            String(
                refundReference || ""
            ).trim() || null;

        const cleanRefundNotes =
            String(
                refundNotes || ""
            ).trim() || null;

        if (
            cleanReference &&
            cleanReference.length > 100
        ) {
            throw createError(
                "Refund reference cannot exceed 100 characters."
            );
        }

        if (
            cleanRefundNotes &&
            cleanRefundNotes.length > 255
        ) {
            throw createError(
                "Refund notes cannot exceed 255 characters."
            );
        }

        // =====================================
        // Get and Lock Sale Items
        // =====================================

        const [items] =
            await connection.query(
                `
                SELECT
                    si.product_id,
                    si.quantity,

                    p.product_name,
                    p.cost_price,
                    p.stock_quantity,
                    p.low_stock_level

                FROM sale_items si

                JOIN products p
                    ON p.id = si.product_id

                WHERE si.sale_id = ?

                ORDER BY si.id ASC

                FOR UPDATE
                `,
                [saleId]
            );

        if (items.length === 0) {
            throw createError(
                "Sale items were not found. Cancellation cannot restore stock safely.",
                409
            );
        }

        // =====================================
        // Restore Product Stock
        // =====================================

        for (const item of items) {
            const previousStock =
                Number(
                    item.stock_quantity
                );

            const restoredQuantity =
                Number(item.quantity);

            const newStock =
                previousStock +
                restoredQuantity;

            const stockStatus =
                inventoryService.getStockStatus(
                    newStock,
                    item.low_stock_level
                );

            await connection.query(
                `
                UPDATE products
                SET
                    stock_quantity = ?,
                    stock_status = ?
                WHERE id = ?
                `,
                [
                    newStock,
                    stockStatus,
                    item.product_id
                ]
            );

            await inventoryService.recordMovement(
                connection,
                {
                    productId:
                        item.product_id,
                    transactionType:
                        "Stock In",
                    quantity:
                        restoredQuantity,
                    previousStock,
                    newStock,
                    costPrice:
                        Number(
                            item.cost_price || 0
                        ),
                    supplierId:
                        null,
                    reference:
                        sale.sale_number,
                    remarks:
                        `Stock restored after cancellation of sale ${sale.sale_number}`,
                    createdBy:
                        adminId
                }
            );
        }

        // =====================================
        // Mark Sale as Cancelled
        // =====================================

        await connection.query(
            `
            UPDATE sales
            SET
                sale_status = 'Cancelled',
                cancelled_at = NOW(),
                cancellation_reason = ?,
                cancelled_by = ?
            WHERE id = ?
            `,
            [
                cleanReason,
                adminId,
                saleId
            ]
        );

        // =====================================
        // Cancel Connected Invoice
        // =====================================

        if (sale.invoice_id) {
            await connection.query(
                `
                UPDATE invoices
                SET
                    status = 'Cancelled',
                    remarks = CONCAT(
                        COALESCE(remarks, ''),
                        CASE
                            WHEN remarks IS NULL
                                OR remarks = ''
                            THEN ''
                            ELSE '\\n'
                        END,
                        'Cancelled: ',
                        ?
                    )
                WHERE id = ?
                `,
                [
                    cleanReason,
                    sale.invoice_id
                ]
            );
        }

        // =====================================
        // Create Cancellation Audit
        // =====================================

        const [cancellationResult] =
            await connection.query(
                `
                INSERT INTO sale_cancellations (
                    sale_id,
                    invoice_id,
                    customer_id,
                    cancellation_reason,
                    original_payment_status,
                    amount_paid,
                    refund_required,
                    cancelled_by,
                    cancelled_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    NOW()
                )
                `,
                [
                    saleId,
                    sale.invoice_id || null,
                    sale.customer_id,
                    cleanReason,
                    sale.payment_status,
                    amountPaid,
                    refundRequired ? 1 : 0,
                    adminId
                ]
            );

        const cancellationId =
            cancellationResult.insertId;

        // =====================================
        // Create Refund Record
        // =====================================

        let refundId = null;

        if (refundRequired) {
            const processedAt =
                finalRefundStatus ===
                "Completed"
                    ? new Date()
                    : null;

            const [refundResult] =
                await connection.query(
                    `
                    INSERT INTO customer_refunds (
                        sale_cancellation_id,
                        sale_id,
                        customer_id,
                        refund_amount,
                        refund_method,
                        refund_status,
                        reference_no,
                        notes,
                        processed_by,
                        processed_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    `,
                    [
                        cancellationId,
                        saleId,
                        sale.customer_id,
                        amountPaid,
                        finalRefundMethod,
                        finalRefundStatus,
                        cleanReference,
                        cleanRefundNotes,
                        finalRefundStatus ===
                            "Completed"
                            ? adminId
                            : null,
                        processedAt
                    ]
                );

            refundId =
                refundResult.insertId;
        }

        await connection.commit();

        transactionCommitted = true;

        // =====================================
        // Reverse Loyalty Points
        // =====================================

        let loyaltyResult = null;
        let loyaltyWarning = null;

        if (
            sale.payment_status ===
            "Paid"
        ) {
            try {
                loyaltyResult =
                    await customerLoyaltyService
                        .reverseSalePoints(
                            saleId,
                            `Sale cancelled: ${cleanReason}`
                        );
            } catch (loyaltyError) {
                /*
                 * Older sales may not have received
                 * loyalty points.
                 */
                if (
                    loyaltyError.statusCode ===
                    404
                ) {
                    loyaltyResult = {
                        success: true,
                        pointsReversed: 0,
                        message:
                            "No loyalty points had been awarded for this sale."
                    };
                } else {
                    console.error(
                        "Cancellation loyalty reversal failed:",
                        loyaltyError
                    );

                    loyaltyWarning =
                        "Sale was cancelled, but loyalty points require manual review.";
                }
            }
        }

        return {
            success: true,

            message:
                refundRequired
                    ? "Sale cancelled, stock restored and refund recorded."
                    : "Sale cancelled and stock restored successfully.",

            cancellation: {
                id:
                    cancellationId,

                saleId,

                saleNumber:
                    sale.sale_number,

                invoiceId:
                    sale.invoice_id ||
                    null,

                invoiceNumber:
                    sale.invoice_number ||
                    null,

                customerId:
                    sale.customer_id,

                reason:
                    cleanReason,

                originalPaymentStatus:
                    sale.payment_status,

                amountPaid,

                stockLinesRestored:
                    items.length
            },

            refund:
                refundRequired
                    ? {
                        id:
                            refundId,

                        amount:
                            amountPaid,

                        method:
                            finalRefundMethod,

                        status:
                            finalRefundStatus,

                        referenceNumber:
                            cleanReference
                    }
                    : null,

            loyalty:
                loyaltyResult,

            loyaltyWarning
        };
    } catch (error) {
        if (!transactionCommitted) {
            await connection.rollback();
        }

        throw error;
    } finally {
        connection.release();
    }
}

// =========================================
// Get Cancellation Details
// =========================================

async function getCancellationBySaleId(
    saleId
) {
    const [rows] =
        await db.query(
            `
            SELECT
                sc.id,
                sc.sale_id,
                s.sale_number,
                sc.invoice_id,
                i.invoice_number,
                sc.customer_id,
                c.full_name
                    AS customer_name,
                sc.cancellation_reason,
                sc.original_payment_status,
                sc.amount_paid,
                sc.refund_required,
                sc.cancelled_by,
                sc.cancelled_at,

                cr.id AS refund_id,
                cr.refund_amount,
                cr.refund_method,
                cr.refund_status,
                cr.reference_no,
                cr.notes,
                cr.processed_at

            FROM sale_cancellations sc

            JOIN sales s
                ON s.id = sc.sale_id

            JOIN customers c
                ON c.id = sc.customer_id

            LEFT JOIN invoices i
                ON i.id = sc.invoice_id

            LEFT JOIN customer_refunds cr
                ON cr.sale_cancellation_id =
                    sc.id

            WHERE sc.sale_id = ?

            LIMIT 1
            `,
            [saleId]
        );

    if (rows.length === 0) {
        throw createError(
            "Sale cancellation record was not found.",
            404
        );
    }

    return rows[0];
}

module.exports = {
    cancelSale,
    getCancellationBySaleId
};