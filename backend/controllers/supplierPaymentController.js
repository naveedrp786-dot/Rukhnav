const supplierPaymentService = require(
    "../services/supplierPaymentService"
);

function errorStatus(error) {
    if (error.statusCode) {
        return error.statusCode;
    }

    const clientMessages = [
        "required",
        "must be",
        "Invalid",
        "invalid",
        "cannot",
        "does not belong",
        "already been paid",
        "not found",
        "exceed",
        "Payments cannot",
        "already been cancelled",
        "Only Posted",
        "allocation",
        "does not match"
    ];

    return clientMessages.some((text) =>
        String(error.message).includes(text)
    )
        ? 400
        : 500;
}

// =====================================================
// POST /api/supplier-payments
// =====================================================

exports.createSupplierPayment = async (req, res) => {
    try {
        const {
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
            remarks
        } = req.body;

        const createdBy =
            req.admin?.id ||
            req.user?.id ||
            req.body.created_by ||
            null;

        const payment =
            await supplierPaymentService.createPayment({
                purchase_order_id,
                supplier_id,
                payment_date,
                payment_method,
                amount,
                reference_no:
                    reference_no?.trim() || null,
                bank_name:
                    bank_name?.trim() || null,
                account_number:
                    account_number?.trim() || null,
                cheque_number:
                    cheque_number?.trim() || null,
                cheque_date:
                    cheque_date || null,
                remarks:
                    remarks?.trim() || null,
                created_by: createdBy
            });

        return res.status(201).json({
            success: true,
            message:
                "Supplier payment posted successfully.",
            supplier_payment: payment
        });
    } catch (error) {
        console.error(
            "Create supplier payment error:",
            error
        );

        return res
            .status(errorStatus(error))
            .json({
                success: false,
                message:
                    error.message ||
                    "Unable to post supplier payment."
            });
    }
};

// =====================================================
// GET /api/supplier-payments
// =====================================================

exports.getSupplierPayments = async (req, res) => {
    try {
        const payments =
            await supplierPaymentService
                .getSupplierPayments();

        return res.json({
            success: true,
            count: payments.length,
            supplier_payments: payments
        });
    } catch (error) {
        console.error(
            "Get supplier payments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to load supplier payments."
        });
    }
};

// =====================================================
// GET /api/supplier-payments/:id
// =====================================================

exports.getSupplierPaymentById = async (
    req,
    res
) => {
    try {
        const payment =
            await supplierPaymentService
                .getSupplierPaymentById(
                    req.params.id
                );

        if (!payment) {
            return res.status(404).json({
                success: false,
                message:
                    "Supplier payment not found."
            });
        }

        return res.json({
            success: true,
            supplier_payment: payment
        });
    } catch (error) {
        console.error(
            "Get supplier payment error:",
            error
        );

        return res
            .status(errorStatus(error))
            .json({
                success: false,
                message: error.message
            });
    }
};

// =====================================================
// GET /api/supplier-payments/supplier/:supplierId
// =====================================================

exports.getSupplierPaymentHistory = async (
    req,
    res
) => {
    try {
        const payments =
            await supplierPaymentService
                .getSupplierPaymentHistory(
                    req.params.supplierId
                );

        return res.json({
            success: true,
            count: payments.length,
            supplier_payments: payments
        });
    } catch (error) {
        console.error(
            "Supplier payment history error:",
            error
        );

        return res
            .status(errorStatus(error))
            .json({
                success: false,
                message: error.message
            });
    }
};

// =====================================================
// GET /api/supplier-payments/purchase-order/:purchaseOrderId
// =====================================================

exports.getPurchaseOrderPayments = async (
    req,
    res
) => {
    try {
        const payments =
            await supplierPaymentService
                .getPurchaseOrderPayments(
                    req.params.purchaseOrderId
                );

        return res.json({
            success: true,
            count: payments.length,
            supplier_payments: payments
        });
    } catch (error) {
        console.error(
            "Purchase-order payment history error:",
            error
        );

        return res
            .status(errorStatus(error))
            .json({
                success: false,
                message: error.message
            });
    }
};

// =====================================================
// PUT /api/supplier-payments/:id/cancel
// =====================================================

exports.cancelSupplierPayment = async (
    req,
    res
) => {
    try {
        const cancellationReason =
            req.body.cancellation_reason ||
            req.body.reason;

        const cancelledBy =
            req.admin?.id ||
            req.user?.id ||
            req.body.cancelled_by ||
            null;

        const result =
            await supplierPaymentService
                .cancelSupplierPayment({
                    supplierPaymentId:
                        req.params.id,
                    cancellationReason,
                    cancelledBy
                });

        return res.json({
            success: true,
            message:
                "Supplier payment cancelled successfully.",
            supplier_payment: result
        });
    } catch (error) {
        console.error(
            "Cancel supplier payment error:",
            error
        );

        return res
            .status(errorStatus(error))
            .json({
                success: false,
                message:
                    error.message ||
                    "Unable to cancel supplier payment."
            });
    }
};
