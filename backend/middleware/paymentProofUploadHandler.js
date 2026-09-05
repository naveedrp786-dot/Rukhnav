"use strict";

const multer =
    require("multer");

const uploadPaymentProof =
    require(
        "./uploadPaymentProof"
    );

exports.single =
    (
        req,
        res,
        next
    ) => {
        uploadPaymentProof.single(
            "payment_receipt"
        )(
            req,
            res,
            error => {
                if (!error) {
                    return next();
                }

                if (
                    error instanceof
                    multer.MulterError
                ) {
                    if (
                        error.code ===
                        "LIMIT_FILE_SIZE"
                    ) {
                        return res
                            .status(413)
                            .json({
                                success:
                                    false,

                                message:
                                    "Payment receipt must be 5 MB or smaller."
                            });
                    }

                    return res
                        .status(400)
                        .json({
                            success:
                                false,

                            message:
                                "Unable to process the payment receipt image."
                        });
                }

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            error.message ||
                            "Invalid payment receipt image."
                    });
            }
        );
    };
