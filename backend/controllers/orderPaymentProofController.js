"use strict";

const paymentService =
    require("../services/paymentService");

const fs = require("fs");
const crypto = require("crypto");

const db =
    require("../config/db");

const paymentProofService =
    require("../services/orderPaymentProofService");

const sha256 = value =>
    crypto
        .createHash("sha256")
        .update(String(value || ""))
        .digest("hex");

const positiveId = value => {
    const id =
        Number.parseInt(
            value,
            10
        );

    return (
        Number.isInteger(id) &&
        id > 0
    )
        ? id
        : null;
};

const cleanText = (
    value,
    max = 255
) => {
    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, max);
};

function removeUploadedFile(
    file
) {
    if (!file?.filename) {
        return;
    }

    paymentProofService
        .safeUnlink(
            file.filename
        );
}

function proofResponse(
    proof
) {
    if (!proof) {
        return null;
    }

    return {
        id:
            proof.id,

        order_id:
            proof.order_id,

        receipt_original_name:
            proof.receipt_original_name ||
            null,

        receipt_mime_type:
            proof.receipt_mime_type ||
            null,

        receipt_size:
            Number(
                proof.receipt_size ||
                0
            ),

        verification_status:
            proof.verification_status ||
            "Pending",

        verified_by:
            proof.verified_by ||
            null,

        verified_at:
            proof.verified_at ||
            null,

        rejection_reason:
            proof.rejection_reason ||
            null,

        created_at:
            proof.created_at,

        updated_at:
            proof.updated_at,

        has_receipt:
            Boolean(
                proof.receipt_filename
            )
    };
}

/* =====================================================
   Registered Customer - Upload Payment Proof
===================================================== */

exports.uploadCustomerProof =
    async (
        req,
        res
    ) => {
        try {
            const orderId =
                positiveId(
                    req.params.id
                );

            const customerId =
                positiveId(
                    req.user?.id
                );

            if (
                !orderId ||
                !customerId
            ) {
                removeUploadedFile(
                    req.file
                );

                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "A valid order is required."
                    });
            }

            const result =
                await paymentProofService
                    .saveProof({
                        orderId,
                        customerId,
                        file:
                            req.file
                    });

            return res.json({
                success: true,

                message:
                    "Payment receipt uploaded successfully. Your payment is awaiting verification.",

                proof:
                    proofResponse(
                        result.proof
                    )
            });
        } catch (error) {
            removeUploadedFile(
                req.file
            );

            console.error(
                "Customer payment proof upload error:",
                error
            );

            return res
                .status(
                    error.statusCode ||
                    500
                )
                .json({
                    success: false,
                    message:
                        error.message ||
                        "Unable to upload payment receipt."
                });
        }
    };

/* =====================================================
   Guest Customer - Upload Payment Proof

   Reuses the SAME guestAccessToken created during
   guest checkout. No second guest credential system.
===================================================== */

exports.uploadGuestProof =
    async (
        req,
        res
    ) => {
        try {
            const orderNumber =
                cleanText(
                    req.params.orderNumber,
                    50
                )
                    .toUpperCase();

            const guestToken =
                cleanText(
                    req.query?.token ||
                    req.body?.guest_token,
                    500
                );

            if (
                !orderNumber ||
                !guestToken
            ) {
                removeUploadedFile(
                    req.file
                );

                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Guest order authorization is required."
                    });
            }

            const tokenHash =
                sha256(
                    guestToken
                );

            const [rows] =
                await db.query(
                    `
                        SELECT
                            id,
                            order_number
                        FROM orders
                        WHERE order_number = ?
                          AND customer_id IS NULL
                          AND checkout_type = 'guest'
                          AND guest_access_token_hash = ?
                        LIMIT 1
                    `,
                    [
                        orderNumber,
                        tokenHash
                    ]
                );

            if (!rows.length) {
                removeUploadedFile(
                    req.file
                );

                /*
                 * Do not reveal whether the order number
                 * or token was the incorrect value.
                 */
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Guest order could not be verified."
                    });
            }

            const result =
                await paymentProofService
                    .saveProof({
                        orderId:
                            Number(
                                rows[0].id
                            ),

                        customerId:
                            null,

                        file:
                            req.file
                    });

            return res.json({
                success: true,

                message:
                    "Payment receipt uploaded successfully. Your payment is awaiting verification.",

                proof:
                    proofResponse(
                        result.proof
                    )
            });
        } catch (error) {
            removeUploadedFile(
                req.file
            );

            console.error(
                "Guest payment proof upload error:",
                error
            );

            return res
                .status(
                    error.statusCode ||
                    500
                )
                .json({
                    success: false,
                    message:
                        error.message ||
                        "Unable to upload payment receipt."
                });
        }
    };

/* =====================================================
   Admin - Payment Proof Metadata
===================================================== */

exports.getAdminProof =
    async (
        req,
        res
    ) => {
        try {
            const orderId =
                positiveId(
                    req.params.id
                );

            if (!orderId) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "A valid order ID is required."
                    });
            }

            const proof =
                await paymentProofService
                    .getProof(
                        orderId
                    );

            if (!proof) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "No payment receipt has been submitted for this order."
                    });
            }

            return res.json({
                success: true,

                proof:
                    proofResponse(
                        proof
                    ),

                payment: {
                    order_number:
                        proof.order_number,

                    payment_method:
                        proof.payment_method,

                    payment_status:
                        proof.payment_status,

                    transaction_id:
                        proof.transaction_id,

                    payment_phone:
                        proof.payment_phone,

                    grand_total:
                        Number(
                            proof.grand_total ||
                            0
                        ),

                    paid_amount:
                        Number(
                            proof.paid_amount ||
                            0
                        ),

                    balance_amount:
                        Number(
                            proof.balance_amount ||
                            0
                        )
                }
            });
        } catch (error) {
            console.error(
                "Admin payment proof lookup error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load payment receipt."
                });
        }
    };

/* =====================================================
   Admin - Secure Receipt Image

   This route is protected by adminAuth through the
   admin order router. Files are NOT exposed by
   Express static hosting.
===================================================== */

exports.getAdminProofFile =
    async (
        req,
        res
    ) => {
        try {
            const orderId =
                positiveId(
                    req.params.id
                );

            if (!orderId) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "A valid order ID is required."
                    });
            }

            const proof =
                await paymentProofService
                    .getProof(
                        orderId
                    );

            if (
                !proof ||
                !proof.receipt_filename
            ) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Payment receipt was not found."
                    });
            }

            const filePath =
                paymentProofService
                    .getProofFilePath(
                        proof.receipt_filename
                    );

            if (
                !filePath ||
                !fs.existsSync(
                    filePath
                )
            ) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Payment receipt file is unavailable."
                    });
            }

            res.setHeader(
                "Cache-Control",
                "private, no-store, max-age=0"
            );

            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );

            res.type(
                proof.receipt_mime_type ||
                "application/octet-stream"
            );

            return res.sendFile(
                filePath
            );
        } catch (error) {
            console.error(
                "Admin payment proof file error:",
                error
            );

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        "Unable to load payment receipt file."
                });
        }
    };


/* =========================================================
   Verify Manual Payment Proof
   ========================================================= */

exports.verifyAdminProof = async (
    req,
    res
) => {
    try {
        const orderId =
            Number(req.params.id);

        if (
            !Number.isInteger(orderId) ||
            orderId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid order ID is required."
            });
        }

        const proof =
            await paymentProofService
                .getProof(orderId);

        if (!proof) {
            return res.status(404).json({
                success: false,
                message:
                    "Payment proof not found."
            });
        }

        if (
            proof.verification_status !==
            "Pending"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    `Payment proof is already ${proof.verification_status}.`
            });
        }

        const rawMethod =
            String(
                proof.payment_method || ""
            )
                .trim()
                .toLowerCase();

        const methodMap = {
            jazzcash: "JazzCash",
            easypaisa: "EasyPaisa",
            bank_transfer: "Bank Transfer"
        };

        const paymentMethod =
            methodMap[rawMethod];

        if (!paymentMethod) {
            return res.status(409).json({
                success: false,
                message:
                    "This payment method cannot be verified from a manual payment proof."
            });
        }

        const reference =
            String(
                proof.transaction_id || ""
            ).trim();

        if (!reference) {
            return res.status(409).json({
                success: false,
                message:
                    "The order does not contain a payment transaction reference."
            });
        }

        const grandTotal =
            Number(
                proof.grand_total || 0
            );

        const paidAmount =
            Number(
                proof.paid_amount || 0
            );

        const balanceAmount =
            Number(
                proof.balance_amount
            );

        const calculatedOutstanding =
            Math.max(
                0,
                grandTotal - paidAmount
            );

        const outstanding =
            Number.isFinite(balanceAmount) &&
            balanceAmount > 0
                ? balanceAmount
                : calculatedOutstanding;

        if (
            !Number.isFinite(outstanding) ||
            outstanding <= 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "This order has no outstanding balance to verify."
            });
        }

        const adminId =
            Number(
                req.admin?.id ||
                0
            );

        if (
            !Number.isInteger(adminId) ||
            adminId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Authenticated administrator identity is required."
            });
        }

        const result =
            await paymentService
                .recordPayment({
                    orderId,
                    adminId,
                    paymentProofId:
                        proof.id,

                    payload: {
                        payment_method:
                            paymentMethod,

                        status:
                            "Paid",

                        amount:
                            outstanding,

                        currency:
                            "PKR",

                        transaction_reference:
                            reference,

                        notes:
                            [
                                `Manual ${paymentMethod} payment verified from uploaded receipt.`,
                                proof.payment_phone
                                    ? `Payment from: ${proof.payment_phone}`
                                    : ""
                            ]
                                .filter(Boolean)
                                .join(" | ")
                    }
                });

        return res.json({
            success: true,
            message:
                "Payment verified and financial records updated successfully.",
            payment:
                result.payment,
            orderPaymentSummary:
                result.orderPaymentSummary,
            salesSync:
                result.salesSync
        });
    } catch (error) {
        console.error(
            "Verify payment proof error:",
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
                    "Unable to verify payment proof."
            });
    }
};


/* =========================================================
   Reject Manual Payment Proof
   ========================================================= */

exports.rejectAdminProof = async (
    req,
    res
) => {
    let connection;

    try {
        const orderId =
            Number(req.params.id);

        const reason =
            String(
                req.body?.reason || ""
            ).trim();

        if (
            !Number.isInteger(orderId) ||
            orderId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid order ID is required."
            });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                message:
                    "A rejection reason is required."
            });
        }

        if (reason.length > 1000) {
            return res.status(400).json({
                success: false,
                message:
                    "Rejection reason must be 1000 characters or fewer."
            });
        }

        const adminId =
            Number(
                req.admin?.id ||
                0
            );

        if (
            !Number.isInteger(adminId) ||
            adminId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Authenticated administrator identity is required."
            });
        }

        connection =
            await db.getConnection();

        await connection.beginTransaction();

        const [[proof]] =
            await connection.query(
                `
                    SELECT
                        id,
                        verification_status
                    FROM order_payment_proofs
                    WHERE order_id = ?
                    LIMIT 1
                    FOR UPDATE
                `,
                [orderId]
            );

        if (!proof) {
            const error =
                new Error(
                    "Payment proof not found."
                );

            error.statusCode = 404;
            throw error;
        }

        if (
            proof.verification_status !==
            "Pending"
        ) {
            const error =
                new Error(
                    `Payment proof is already ${proof.verification_status}.`
                );

            error.statusCode = 409;
            throw error;
        }

        await connection.query(
            `
                UPDATE order_payment_proofs
                SET
                    verification_status = 'Rejected',
                    verified_by = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    rejection_reason = ?
                WHERE id = ?
            `,
            [
                adminId,
                reason,
                proof.id
            ]
        );

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Payment proof rejected successfully."
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_) {}
        }

        console.error(
            "Reject payment proof error:",
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
                    "Unable to reject payment proof."
            });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};
