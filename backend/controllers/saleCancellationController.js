"use strict";

const saleCancellationService =
    require(
        "../services/saleCancellationService"
    );

// =========================================
// Helpers
// =========================================

function getAdminId(req) {
    return (
        req.admin?.id ||
        req.user?.id ||
        req.user?.adminId ||
        req.adminId ||
        null
    );
}

function sendError(
    res,
    error
) {
    console.error(
        "Sale cancellation error:",
        error
    );

    return res
        .status(
            error.statusCode || 500
        )
        .json({
            success: false,

            message:
                error.statusCode &&
                error.statusCode < 500
                    ? error.message
                    : "Unable to complete the sale cancellation.",

            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
}

// =========================================
// Cancel Sale
// =========================================

exports.cancelSale = async (
    req,
    res
) => {
    try {
        const saleId =
            Number(req.params.id);

        const reason =
            String(
                req.body.reason ||
                ""
            ).trim();

        const refundMethod =
            req.body.refund_method
                ? String(
                    req.body
                        .refund_method
                ).trim()
                : null;

        const refundStatus =
            req.body.refund_status
                ? String(
                    req.body
                        .refund_status
                ).trim()
                : "Pending";

        const refundReference =
            req.body.reference_no
                ? String(
                    req.body
                        .reference_no
                ).trim()
                : null;

        const refundNotes =
            req.body.refund_notes
                ? String(
                    req.body
                        .refund_notes
                ).trim()
                : null;

        const result =
            await saleCancellationService
                .cancelSale({
                    saleId,
                    reason,
                    refundMethod,
                    refundStatus,
                    refundReference,
                    refundNotes,
                    adminId:
                        getAdminId(req)
                });

        return res
            .status(200)
            .json(result);
    } catch (error) {
        return sendError(
            res,
            error
        );
    }
};

// =========================================
// Get Sale Cancellation
// =========================================

exports.getCancellation = async (
    req,
    res
) => {
    try {
        const saleId =
            Number(req.params.id);

        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "A valid sale ID is required."
                });
        }

        const cancellation =
            await saleCancellationService
                .getCancellationBySaleId(
                    saleId
                );

        return res.json({
            success: true,
            cancellation
        });
    } catch (error) {
        return sendError(
            res,
            error
        );
    }
};