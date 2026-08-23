const db = require("../config/db");
const accountingAutomation = require("./accountingAutomationService");

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

function amount(value) {
    const number = Number.parseFloat(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Number(number.toFixed(2));
}

function adminId(value) {
    const number = Number.parseInt(value, 10);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function cleanText(value, maxLength = 2000) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, maxLength) : null;
}

function datePart(date = new Date()) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("");
}

async function generateDebitNoteNumber(connection) {
    const [result] = await connection.query(
        `
        INSERT INTO supplier_debit_note_sequences (created_at)
        VALUES (NOW())
        `
    );

    return `DN-${datePart()}-${String(result.insertId).padStart(6, "0")}`;
}

async function logActivity(
    connection,
    {
        debitNoteId,
        action,
        description,
        performedBy
    }
) {
    await connection.query(
        `
        INSERT INTO supplier_debit_note_activity_logs (
            supplier_debit_note_id,
            action,
            description,
            performed_by
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            debitNoteId,
            action,
            description || null,
            performedBy || null
        ]
    );
}

async function getDebitNoteForUpdate(connection, debitNoteId) {
    const [[debitNote]] = await connection.query(
        `
        SELECT
            sdn.*,
            pr.return_number,
            po.po_number,
            po.grand_total,
            COALESCE(po.paid_amount, 0) AS paid_amount,
            COALESCE(po.balance_amount, po.grand_total) AS balance_amount
        FROM supplier_debit_notes sdn
        INNER JOIN purchase_returns pr
            ON pr.id = sdn.purchase_return_id
        INNER JOIN purchase_orders po
            ON po.id = sdn.purchase_order_id
        WHERE sdn.id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [debitNoteId]
    );

    return debitNote || null;
}

// =====================================================
// Create Draft Debit Note
// =====================================================
async function createDebitNote({
    purchaseReturnId,
    debitNoteDate,
    reason,
    remarks,
    createdBy
}) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const returnId = positiveInteger(
            purchaseReturnId,
            "Purchase return ID"
        );

        const [[purchaseReturn]] = await connection.query(
            `
            SELECT
                pr.id,
                pr.return_number,
                pr.purchase_order_id,
                pr.supplier_id,
                pr.return_date,
                pr.total_amount,
                pr.reason,
                pr.status,
                po.po_number
            FROM purchase_returns pr
            INNER JOIN purchase_orders po
                ON po.id = pr.purchase_order_id
            WHERE pr.id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [returnId]
        );

        if (!purchaseReturn) {
            throw createError("Purchase return not found.", 404);
        }

        if (purchaseReturn.status !== "Completed") {
            throw createError(
                "A debit note can only be created for a Completed purchase return."
            );
        }

        const [[existing]] = await connection.query(
            `
            SELECT id, debit_note_number, status
            FROM supplier_debit_notes
            WHERE purchase_return_id = ?
            LIMIT 1
            `,
            [returnId]
        );

        if (existing) {
            throw createError(
                `Debit note ${existing.debit_note_number} already exists for this purchase return.`
            );
        }

        const totalAmount = amount(purchaseReturn.total_amount);

        if (totalAmount <= 0) {
            throw createError(
                "Purchase return amount must be greater than zero."
            );
        }

        const debitNoteNumber =
            await generateDebitNoteNumber(connection);

        const [result] = await connection.query(
            `
            INSERT INTO supplier_debit_notes (
                debit_note_number,
                purchase_return_id,
                purchase_order_id,
                supplier_id,
                debit_note_date,
                amount,
                applied_to_payable,
                supplier_credit_amount,
                reason,
                remarks,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 'Draft', ?)
            `,
            [
                debitNoteNumber,
                returnId,
                purchaseReturn.purchase_order_id,
                purchaseReturn.supplier_id,
                debitNoteDate || new Date(),
                totalAmount,
                cleanText(reason, 1000) ||
                    cleanText(purchaseReturn.reason, 1000) ||
                    "Purchase return",
                cleanText(remarks, 5000),
                adminId(createdBy)
            ]
        );

        await logActivity(connection, {
            debitNoteId: result.insertId,
            action: "CREATED",
            description:
                `${debitNoteNumber} created from purchase return ` +
                `${purchaseReturn.return_number}.`,
            performedBy: adminId(createdBy)
        });

        await connection.commit();

        return {
            id: result.insertId,
            debit_note_number: debitNoteNumber,
            purchase_return_id: returnId,
            return_number: purchaseReturn.return_number,
            purchase_order_id: purchaseReturn.purchase_order_id,
            po_number: purchaseReturn.po_number,
            supplier_id: purchaseReturn.supplier_id,
            amount: totalAmount,
            status: "Draft"
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// =====================================================
// Post Debit Note and Adjust Accounts Payable
// =====================================================
async function postDebitNote({
    debitNoteId,
    postedBy
}) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const id = positiveInteger(
            debitNoteId,
            "Debit note ID"
        );

        const debitNote =
            await getDebitNoteForUpdate(connection, id);

        if (!debitNote) {
            throw createError("Supplier debit note not found.", 404);
        }

        if (debitNote.status === "Posted") {
            throw createError("This debit note is already Posted.");
        }

        if (debitNote.status === "Cancelled") {
            throw createError(
                "A Cancelled debit note cannot be posted."
            );
        }

        const noteAmount = amount(debitNote.amount);
        const currentBalance = amount(debitNote.balance_amount);
        const currentPaid = amount(debitNote.paid_amount);

        const appliedToPayable = Math.min(
            noteAmount,
            currentBalance
        );

        const supplierCredit = amount(
            noteAmount - appliedToPayable
        );

        const newBalance = amount(
            Math.max(currentBalance - appliedToPayable, 0)
        );

        let paymentStatus = "Unpaid";

        if (newBalance <= 0) {
            paymentStatus = "Paid";
        } else if (currentPaid > 0) {
            paymentStatus = "Partial";
        }

        await connection.query(
            `
            UPDATE purchase_orders
            SET
                balance_amount = ?,
                payment_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                newBalance,
                paymentStatus,
                debitNote.purchase_order_id
            ]
        );

        await connection.query(
            `
            UPDATE supplier_debit_notes
            SET
                status = 'Posted',
                applied_to_payable = ?,
                supplier_credit_amount = ?,
                posted_by = ?,
                posted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                appliedToPayable,
                supplierCredit,
                adminId(postedBy),
                id
            ]
        );

        await accountingAutomation.postSupplierDebitNote(
            connection,
            {
                id,
                debit_note_number:
                    debitNote.debit_note_number,
                debit_note_date:
                    debitNote.debit_note_date,
                purchase_return_id:
                    debitNote.purchase_return_id,
                purchase_order_id:
                    debitNote.purchase_order_id,
                supplier_id:
                    debitNote.supplier_id,
                amount:
                    noteAmount,
                applied_to_payable:
                    appliedToPayable,
                supplier_credit_amount:
                    supplierCredit
            },
            adminId(postedBy)
        );

        await logActivity(connection, {
            debitNoteId: id,
            action: "POSTED",
            description:
                `${debitNote.debit_note_number} posted. ` +
                `PKR ${appliedToPayable.toFixed(2)} applied to PO ` +
                `${debitNote.po_number}; supplier credit ` +
                `PKR ${supplierCredit.toFixed(2)}.`,
            performedBy: adminId(postedBy)
        });

        await connection.commit();

        return {
            id,
            debit_note_number: debitNote.debit_note_number,
            status: "Posted",
            amount: noteAmount,
            applied_to_payable: appliedToPayable,
            supplier_credit_amount: supplierCredit,
            purchase_order_id: debitNote.purchase_order_id,
            po_number: debitNote.po_number,
            purchase_order_balance: newBalance,
            purchase_order_payment_status: paymentStatus
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// =====================================================
// Cancel Posted or Draft Debit Note
// =====================================================
async function cancelDebitNote({
    debitNoteId,
    cancellationReason,
    cancelledBy
}) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const id = positiveInteger(
            debitNoteId,
            "Debit note ID"
        );

        const reason = cleanText(cancellationReason, 1000);

        if (!reason) {
            throw createError("Cancellation reason is required.");
        }

        const debitNote =
            await getDebitNoteForUpdate(connection, id);

        if (!debitNote) {
            throw createError("Supplier debit note not found.", 404);
        }

        if (debitNote.status === "Cancelled") {
            throw createError(
                "This debit note has already been cancelled."
            );
        }

        let restoredBalance = amount(debitNote.balance_amount);
        let paymentStatus = debitNote.payment_status || "Unpaid";

        if (debitNote.status === "Posted") {
            restoredBalance = amount(
                restoredBalance +
                amount(debitNote.applied_to_payable)
            );

            const grandTotal = amount(debitNote.grand_total);
            const paidAmount = amount(debitNote.paid_amount);

            if (paidAmount >= grandTotal) {
                paymentStatus = "Paid";
            } else if (paidAmount > 0) {
                paymentStatus = "Partial";
            } else {
                paymentStatus = "Unpaid";
            }

            await connection.query(
                `
                UPDATE purchase_orders
                SET
                    balance_amount = ?,
                    payment_status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    restoredBalance,
                    paymentStatus,
                    debitNote.purchase_order_id
                ]
            );
        }

        if (
            debitNote.status ===
            "Posted"
        ) {
            await accountingAutomation.reverseAutomaticEvent(
                connection,
                {
                    sourceType:
                        "Supplier Debit Note",

                    sourceId:
                        id,

                    eventKey:
                        "SUPPLIER_DEBIT_NOTE_POSTED",

                    reason:
                        reason,

                    adminId:
                        adminId(
                            cancelledBy
                        )
                }
            );
        }

        await connection.query(
            `
            UPDATE supplier_debit_notes
            SET
                status = 'Cancelled',
                cancelled_by = ?,
                cancelled_at = CURRENT_TIMESTAMP,
                cancellation_reason = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                adminId(cancelledBy),
                reason,
                id
            ]
        );

        await logActivity(connection, {
            debitNoteId: id,
            action: "CANCELLED",
            description:
                `${debitNote.debit_note_number} cancelled. Reason: ${reason}`,
            performedBy: adminId(cancelledBy)
        });

        await connection.commit();

        return {
            id,
            debit_note_number: debitNote.debit_note_number,
            status: "Cancelled",
            restored_purchase_order_balance: restoredBalance,
            purchase_order_payment_status: paymentStatus
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// =====================================================
// List Debit Notes
// =====================================================
async function getDebitNotes({
    status = null,
    supplierId = null,
    purchaseOrderId = null
} = {}) {
    const conditions = [];
    const values = [];

    if (status) {
        conditions.push("sdn.status = ?");
        values.push(status);
    }

    if (supplierId) {
        conditions.push("sdn.supplier_id = ?");
        values.push(positiveInteger(supplierId, "Supplier ID"));
    }

    if (purchaseOrderId) {
        conditions.push("sdn.purchase_order_id = ?");
        values.push(
            positiveInteger(
                purchaseOrderId,
                "Purchase order ID"
            )
        );
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [rows] = await db.query(
        `
        SELECT
            sdn.*,
            pr.return_number,
            po.po_number,
            s.supplier_name,
            CONCAT_WS(' ', a.first_name, a.last_name)
                AS created_by_name
        FROM supplier_debit_notes sdn
        INNER JOIN purchase_returns pr
            ON pr.id = sdn.purchase_return_id
        INNER JOIN purchase_orders po
            ON po.id = sdn.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = sdn.supplier_id
        LEFT JOIN admins a
            ON a.id = sdn.created_by
        ${whereClause}
        ORDER BY sdn.id DESC
        `,
        values
    );

    return rows;
}

// =====================================================
// Get Debit Note Details
// =====================================================
async function getDebitNoteById(debitNoteId) {
    const id = positiveInteger(
        debitNoteId,
        "Debit note ID"
    );

    const [rows] = await db.query(
        `
        SELECT
            sdn.*,
            pr.return_number,
            pr.return_date,
            po.po_number,
            po.order_date,
            po.grand_total,
            po.paid_amount,
            po.balance_amount,
            po.payment_status,
            s.supplier_name,
            s.contact_person,
            s.phone,
            s.email,
            s.address,
            CONCAT_WS(' ', creator.first_name, creator.last_name)
                AS created_by_name,
            CONCAT_WS(' ', poster.first_name, poster.last_name)
                AS posted_by_name,
            CONCAT_WS(' ', canceller.first_name, canceller.last_name)
                AS cancelled_by_name
        FROM supplier_debit_notes sdn
        INNER JOIN purchase_returns pr
            ON pr.id = sdn.purchase_return_id
        INNER JOIN purchase_orders po
            ON po.id = sdn.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = sdn.supplier_id
        LEFT JOIN admins creator
            ON creator.id = sdn.created_by
        LEFT JOIN admins poster
            ON poster.id = sdn.posted_by
        LEFT JOIN admins canceller
            ON canceller.id = sdn.cancelled_by
        WHERE sdn.id = ?
        LIMIT 1
        `,
        [id]
    );

    if (rows.length === 0) {
        return null;
    }

    const [activity] = await db.query(
        `
        SELECT
            l.*,
            CONCAT_WS(' ', a.first_name, a.last_name)
                AS performed_by_name
        FROM supplier_debit_note_activity_logs l
        LEFT JOIN admins a
            ON a.id = l.performed_by
        WHERE l.supplier_debit_note_id = ?
        ORDER BY l.id DESC
        `,
        [id]
    );

    return {
        debit_note: rows[0],
        activity
    };
}

module.exports = {
    createDebitNote,
    postDebitNote,
    cancelDebitNote,
    getDebitNotes,
    getDebitNoteById
};
