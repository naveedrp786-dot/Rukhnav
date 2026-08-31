const db = require("../config/db");
const accountingAutomation = require("./accountingAutomationService");

// =====================================================
// Helpers
// =====================================================

function toAmount(value) {
    const amount = Number.parseFloat(value);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    return Number(amount.toFixed(2));
}

function createError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function positiveInteger(value, fieldName) {
    const number = Number.parseInt(value, 10);

    if (!Number.isInteger(number) || number <= 0) {
        throw createError(`${fieldName} must be a positive whole number.`);
    }

    return number;
}

async function generatePaymentNumber(connection, paymentDate) {
    const date = paymentDate
        ? new Date(`${paymentDate}T00:00:00`)
        : new Date();

    if (Number.isNaN(date.getTime())) {
        throw createError("Invalid payment date.");
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const prefix = `PAY-${year}${month}${day}-`;

    const [rows] = await connection.query(
        `
        SELECT payment_number
        FROM supplier_payments
        WHERE payment_number LIKE ?
        ORDER BY payment_number DESC
        LIMIT 1
        FOR UPDATE
        `,
        [`${prefix}%`]
    );

    let sequence = 1;

    if (rows.length > 0 && rows[0].payment_number) {
        const previousSequence = Number.parseInt(
            rows[0].payment_number.split("-").pop(),
            10
        );

        if (Number.isInteger(previousSequence)) {
            sequence = previousSequence + 1;
        }
    }

    return `${prefix}${String(sequence).padStart(6, "0")}`;
}

async function createActivityLog(
    connection,
    supplierPaymentId,
    activityType,
    description,
    performedBy
) {
    await connection.query(
        `
        INSERT INTO supplier_payment_activity_logs (
            supplier_payment_id,
            activity_type,
            description,
            performed_by
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            supplierPaymentId,
            activityType,
            description || null,
            performedBy || null
        ]
    );
}

async function getPurchaseOrderForPayment(
    connection,
    purchaseOrderId
) {
    const [rows] = await connection.query(
        `
        SELECT
            po.id,
            po.po_number,
            po.supplier_id,
            po.status,
            po.payment_status,
            po.grand_total AS total_amount,
            COALESCE(po.paid_amount, 0) AS paid_amount,
            COALESCE(
                po.balance_amount,
                po.grand_total - COALESCE(po.paid_amount, 0)
            ) AS balance_amount
        FROM purchase_orders po
        WHERE po.id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [purchaseOrderId]
    );

    return rows[0] || null;
}

function validatePaymentMethodFields(data) {
    const method = data.payment_method;

    if (method === "Bank Transfer" && !data.reference_no) {
        throw createError(
            "Reference number is required for a bank transfer."
        );
    }

    if (method === "Cheque") {
        if (!data.cheque_number) {
            throw createError(
                "Cheque number is required for cheque payments."
            );
        }

        if (!data.cheque_date) {
            throw createError(
                "Cheque date is required for cheque payments."
            );
        }
    }
}

// =====================================================
// Create Supplier Payment
// =====================================================

async function createPayment(data) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const purchaseOrderId = positiveInteger(
            data.purchase_order_id,
            "Purchase order ID"
        );

        const supplierId = positiveInteger(
            data.supplier_id,
            "Supplier ID"
        );

        const createdBy = data.created_by
            ? positiveInteger(data.created_by, "Created by")
            : null;

        const amount = toAmount(data.amount);

        if (!data.payment_date) {
            throw createError("Payment date is required.");
        }

        if (amount <= 0) {
            throw createError(
                "Payment amount must be greater than zero."
            );
        }

        const allowedMethods = [
            "Cash",
            "Bank Transfer",
            "Cheque",
            "Credit Card",
            "Online Payment",
            "Other"
        ];

        if (!allowedMethods.includes(data.payment_method)) {
            throw createError("Invalid payment method.");
        }

        validatePaymentMethodFields(data);

        const purchaseOrder = await getPurchaseOrderForPayment(
            connection,
            purchaseOrderId
        );

        if (!purchaseOrder) {
            throw createError("Purchase order not found.", 404);
        }

        if (Number(purchaseOrder.supplier_id) !== supplierId) {
            throw createError(
                "The selected purchase order does not belong to this supplier."
            );
        }

        if (
            ["Draft", "Cancelled"].includes(
                purchaseOrder.status
            )
        ) {
            throw createError(
                `Payments cannot be posted against a ${purchaseOrder.status} purchase order.`
            );
        }

        const purchaseOrderTotal = toAmount(
            purchaseOrder.total_amount
        );

        const previousPaidAmount = toAmount(
            purchaseOrder.paid_amount
        );

        const currentBalance = toAmount(
            purchaseOrder.balance_amount
        );

        if (currentBalance <= 0) {
            throw createError(
                "This purchase order has already been paid in full."
            );
        }

        if (amount > currentBalance) {
            throw createError(
                `Payment amount cannot exceed the outstanding balance of ${currentBalance.toFixed(
                    2
                )}.`
            );
        }

        const paymentNumber = await generatePaymentNumber(
            connection,
            data.payment_date
        );

        const [paymentResult] = await connection.query(
            `
            INSERT INTO supplier_payments (
                payment_number,
                purchase_order_id,
                supplier_id,
                payment_date,
                payment_method,
                amount,
                reference_no,
                bank_name,
                account_number,
                cheque_number,
                cheque_date,
                remarks,
                status,
                created_by
            )
            VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                'Posted', ?
            )
            `,
            [
                paymentNumber,
                purchaseOrderId,
                supplierId,
                data.payment_date,
                data.payment_method,
                amount,
                data.reference_no || null,
                data.bank_name || null,
                data.account_number || null,
                data.cheque_number || null,
                data.cheque_date || null,
                data.remarks || null,
                createdBy
            ]
        );

        const supplierPaymentId = paymentResult.insertId;

        const newPaidAmount = toAmount(
            previousPaidAmount + amount
        );

        const remainingBalance = toAmount(
            Math.max(
                purchaseOrderTotal - newPaidAmount,
                0
            )
        );

        let paymentStatus = "Partial";

        if (remainingBalance <= 0) {
            paymentStatus = "Paid";
        } else if (newPaidAmount <= 0) {
            paymentStatus = "Unpaid";
        }

        await connection.query(
            `
            INSERT INTO supplier_payment_allocations (
                supplier_payment_id,
                purchase_order_id,
                purchase_order_total,
                previous_paid_amount,
                allocated_amount,
                remaining_balance
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                supplierPaymentId,
                purchaseOrderId,
                purchaseOrderTotal,
                previousPaidAmount,
                amount,
                remainingBalance
            ]
        );

        await connection.query(
            `
            UPDATE purchase_orders
            SET
                paid_amount = ?,
                balance_amount = ?,
                payment_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                newPaidAmount,
                remainingBalance,
                paymentStatus,
                purchaseOrderId
            ]
        );

        await createActivityLog(
            connection,
            supplierPaymentId,
            "Payment Posted",
            `${paymentNumber} posted against purchase order ${purchaseOrder.po_number}. Amount: ${amount.toFixed(
                2
            )}. Remaining balance: ${remainingBalance.toFixed(
                2
            )}.`,
            createdBy
        );

        await accountingAutomation.postSupplierPayment(
            connection,
            {
                id: supplierPaymentId,
                payment_number: paymentNumber,
                purchase_order_id: purchaseOrderId,
                supplier_id: supplierId,
                payment_date: data.payment_date,
                payment_method: data.payment_method,
                amount,
                reference_no: data.reference_no || null
            },
            createdBy
        );

        await connection.commit();

        return {
            id: supplierPaymentId,
            payment_number: paymentNumber,
            purchase_order_id: purchaseOrderId,
            po_number: purchaseOrder.po_number,
            supplier_id: supplierId,
            payment_date: data.payment_date,
            payment_method: data.payment_method,
            amount,
            previous_paid_amount: previousPaidAmount,
            total_paid_amount: newPaidAmount,
            remaining_balance: remainingBalance,
            payment_status: paymentStatus,
            status: "Posted"
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// =====================================================
// Get All Supplier Payments
// =====================================================

async function getSupplierPayments() {
    const [rows] = await db.query(
        `
        SELECT
            sp.id,
            sp.payment_number,
            sp.purchase_order_id,
            sp.supplier_id,
            sp.payment_date,
            sp.payment_method,
            sp.amount,
            sp.reference_no,
            sp.remarks,
            sp.status,
            sp.created_at,
            po.po_number,
            s.supplier_name,
            CONCAT_WS(
                ' ',
                a.first_name,
                a.last_name
            ) AS created_by_name
        FROM supplier_payments sp
        INNER JOIN purchase_orders po
            ON po.id = sp.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = sp.supplier_id
        LEFT JOIN admins a
            ON a.id = sp.created_by
        ORDER BY sp.id DESC
        `
    );

    return rows;
}

// =====================================================
// Get Supplier Payment By ID
// =====================================================

async function getSupplierPaymentById(id) {
    const paymentId = positiveInteger(
        id,
        "Supplier payment ID"
    );

    const [rows] = await db.query(
        `
        SELECT
            sp.*,
            po.po_number,
            po.grand_total,
            po.paid_amount,
            po.balance_amount,
            po.payment_status,
            s.supplier_name,
            CONCAT_WS(
                ' ',
                a.first_name,
                a.last_name
            ) AS created_by_name,
            CONCAT_WS(
                ' ',
                ca.first_name,
                ca.last_name
            ) AS cancelled_by_name
        FROM supplier_payments sp
        INNER JOIN purchase_orders po
            ON po.id = sp.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = sp.supplier_id
        LEFT JOIN admins a
            ON a.id = sp.created_by
        LEFT JOIN admins ca
            ON ca.id = sp.cancelled_by
        WHERE sp.id = ?
        LIMIT 1
        `,
        [paymentId]
    );

    if (rows.length === 0) {
        return null;
    }

    const [allocations] = await db.query(
        `
        SELECT *
        FROM supplier_payment_allocations
        WHERE supplier_payment_id = ?
        ORDER BY id ASC
        `,
        [paymentId]
    );

    const [activity] = await db.query(
        `
        SELECT
            spal.*,
            CONCAT_WS(
                ' ',
                a.first_name,
                a.last_name
            ) AS performed_by_name
        FROM supplier_payment_activity_logs spal
        LEFT JOIN admins a
            ON a.id = spal.performed_by
        WHERE spal.supplier_payment_id = ?
        ORDER BY spal.id DESC
        `,
        [paymentId]
    );

    return {
        ...rows[0],
        allocations,
        activity
    };
}

// =====================================================
// Supplier Payment History
// =====================================================

async function getSupplierPaymentHistory(supplierId) {
    const id = positiveInteger(
        supplierId,
        "Supplier ID"
    );

    const [rows] = await db.query(
        `
        SELECT
            sp.id,
            sp.payment_number,
            sp.purchase_order_id,
            po.po_number,
            sp.payment_date,
            sp.payment_method,
            sp.amount,
            sp.reference_no,
            sp.remarks,
            sp.status,
            sp.created_at
        FROM supplier_payments sp
        INNER JOIN purchase_orders po
            ON po.id = sp.purchase_order_id
        WHERE sp.supplier_id = ?
        ORDER BY sp.payment_date DESC, sp.id DESC
        `,
        [id]
    );

    return rows;
}

// =====================================================
// Purchase Order Payment History
// =====================================================

async function getPurchaseOrderPayments(purchaseOrderId) {
    const id = positiveInteger(
        purchaseOrderId,
        "Purchase order ID"
    );

    const [rows] = await db.query(
        `
        SELECT
            sp.id,
            sp.payment_number,
            sp.payment_date,
            sp.payment_method,
            sp.amount,
            sp.reference_no,
            sp.remarks,
            sp.status,
            sp.created_at
        FROM supplier_payments sp
        WHERE sp.purchase_order_id = ?
        ORDER BY sp.id ASC
        `,
        [id]
    );

    return rows;
}

// =====================================================
// Cancel Supplier Payment
// =====================================================

async function cancelSupplierPayment({
    supplierPaymentId,
    cancellationReason,
    cancelledBy
}) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const paymentId = positiveInteger(
            supplierPaymentId,
            "Supplier payment ID"
        );

        const adminId = cancelledBy
            ? positiveInteger(cancelledBy, "Cancelled by")
            : null;

        if (
            !cancellationReason ||
            !String(cancellationReason).trim()
        ) {
            throw createError(
                "Cancellation reason is required."
            );
        }

        const [[payment]] = await connection.query(
            `
            SELECT
                sp.id,
                sp.payment_number,
                sp.purchase_order_id,
                sp.supplier_id,
                sp.amount,
                sp.status,
                po.po_number,
                po.grand_total AS purchase_order_total,
                COALESCE(po.paid_amount, 0)
                    AS current_paid_amount,
                COALESCE(
                    po.balance_amount,
                    po.grand_total -
                    COALESCE(po.paid_amount, 0)
                ) AS current_balance
            FROM supplier_payments sp
            INNER JOIN purchase_orders po
                ON po.id = sp.purchase_order_id
            WHERE sp.id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [paymentId]
        );

        if (!payment) {
            throw createError(
                "Supplier payment not found.",
                404
            );
        }

        if (payment.status === "Cancelled") {
            throw createError(
                "This supplier payment has already been cancelled."
            );
        }

        if (payment.status !== "Posted") {
            throw createError(
                "Only Posted supplier payments can be cancelled."
            );
        }

        const [[allocation]] = await connection.query(
            `
            SELECT
                id,
                allocated_amount
            FROM supplier_payment_allocations
            WHERE supplier_payment_id = ?
              AND purchase_order_id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [
                paymentId,
                payment.purchase_order_id
            ]
        );

        if (!allocation) {
            throw createError(
                "Payment allocation record was not found."
            );
        }

        const paymentAmount = toAmount(payment.amount);
        const allocatedAmount = toAmount(
            allocation.allocated_amount
        );

        if (allocatedAmount !== paymentAmount) {
            throw createError(
                "Payment allocation does not match the payment amount."
            );
        }

        const purchaseOrderTotal = toAmount(
            payment.purchase_order_total
        );
        const currentPaidAmount = toAmount(
            payment.current_paid_amount
        );

        const newPaidAmount = toAmount(
            Math.max(currentPaidAmount - paymentAmount, 0)
        );

        const newBalanceAmount = toAmount(
            Math.max(purchaseOrderTotal - newPaidAmount, 0)
        );

        let paymentStatus = "Unpaid";

        if (newPaidAmount >= purchaseOrderTotal) {
            paymentStatus = "Paid";
        } else if (newPaidAmount > 0) {
            paymentStatus = "Partial";
        }

        await connection.query(
            `
            UPDATE supplier_payments
            SET
                status = 'Cancelled',
                cancelled_by = ?,
                cancelled_at = CURRENT_TIMESTAMP,
                cancellation_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                adminId,
                String(cancellationReason).trim(),
                paymentId
            ]
        );

        await connection.query(
            `
            UPDATE purchase_orders
            SET
                paid_amount = ?,
                balance_amount = ?,
                payment_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                newPaidAmount,
                newBalanceAmount,
                paymentStatus,
                payment.purchase_order_id
            ]
        );

        await createActivityLog(
            connection,
            paymentId,
            "Payment Cancelled",
            `${payment.payment_number} cancelled. Reversed amount: ${paymentAmount.toFixed(
                2
            )}. Purchase order ${payment.po_number} balance restored to ${newBalanceAmount.toFixed(
                2
            )}. Reason: ${String(
                cancellationReason
            ).trim()}`,
            adminId
        );

        await connection.commit();

        return {
            id: paymentId,
            payment_number: payment.payment_number,
            purchase_order_id: payment.purchase_order_id,
            po_number: payment.po_number,
            reversed_amount: paymentAmount,
            total_paid_amount: newPaidAmount,
            remaining_balance: newBalanceAmount,
            payment_status: paymentStatus,
            status: "Cancelled"
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    createPayment,
    getSupplierPayments,
    getSupplierPaymentById,
    getSupplierPaymentHistory,
    getPurchaseOrderPayments,
    cancelSupplierPayment
};
