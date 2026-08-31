const supplierDebitNoteService = require(
    "../services/supplierDebitNoteService"
);

function statusCode(error) {
    return error.statusCode || 500;
}

exports.createDebitNote = async (req, res) => {
    try {
        const debitNote =
            await supplierDebitNoteService.createDebitNote({
                purchaseReturnId:
                    req.body.purchase_return_id,
                debitNoteDate:
                    req.body.debit_note_date,
                reason:
                    req.body.reason,
                remarks:
                    req.body.remarks,
                createdBy:
                    req.admin?.id ||
                    req.user?.id ||
                    req.body.created_by
            });

        return res.status(201).json({
            success: true,
            message:
                "Supplier debit note created successfully.",
            supplier_debit_note: debitNote
        });
    } catch (error) {
        console.error("Create debit note error:", error);

        return res.status(statusCode(error)).json({
            success: false,
            message: error.message
        });
    }
};

exports.postDebitNote = async (req, res) => {
    try {
        const debitNote =
            await supplierDebitNoteService.postDebitNote({
                debitNoteId: req.params.id,
                postedBy:
                    req.admin?.id ||
                    req.user?.id ||
                    req.body.posted_by
            });

        return res.json({
            success: true,
            message:
                "Supplier debit note posted successfully.",
            supplier_debit_note: debitNote
        });
    } catch (error) {
        console.error("Post debit note error:", error);

        return res.status(statusCode(error)).json({
            success: false,
            message: error.message
        });
    }
};

exports.cancelDebitNote = async (req, res) => {
    try {
        const debitNote =
            await supplierDebitNoteService.cancelDebitNote({
                debitNoteId: req.params.id,
                cancellationReason:
                    req.body.cancellation_reason ||
                    req.body.reason,
                cancelledBy:
                    req.admin?.id ||
                    req.user?.id ||
                    req.body.cancelled_by
            });

        return res.json({
            success: true,
            message:
                "Supplier debit note cancelled successfully.",
            supplier_debit_note: debitNote
        });
    } catch (error) {
        console.error("Cancel debit note error:", error);

        return res.status(statusCode(error)).json({
            success: false,
            message: error.message
        });
    }
};

exports.getDebitNotes = async (req, res) => {
    try {
        const debitNotes =
            await supplierDebitNoteService.getDebitNotes({
                status: req.query.status,
                supplierId: req.query.supplier_id,
                purchaseOrderId:
                    req.query.purchase_order_id
            });

        return res.json({
            success: true,
            count: debitNotes.length,
            supplier_debit_notes: debitNotes
        });
    } catch (error) {
        console.error("List debit notes error:", error);

        return res.status(statusCode(error)).json({
            success: false,
            message: error.message
        });
    }
};

exports.getDebitNoteById = async (req, res) => {
    try {
        const result =
            await supplierDebitNoteService.getDebitNoteById(
                req.params.id
            );

        if (!result) {
            return res.status(404).json({
                success: false,
                message:
                    "Supplier debit note not found."
            });
        }

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error("Get debit note error:", error);

        return res.status(statusCode(error)).json({
            success: false,
            message: error.message
        });
    }
};
