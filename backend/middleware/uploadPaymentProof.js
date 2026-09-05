"use strict";

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const {
    getPrivateDirectory
} = require(
    "../config/privateStorage"
);

const proofDirectory =
    getPrivateDirectory(
        "payment-proofs"
    );

const allowed =
    new Map([
        ["image/jpeg", ".jpg"],
        ["image/png", ".png"],
        ["image/webp", ".webp"]
    ]);

const storage =
    multer.diskStorage({
        destination(
            req,
            file,
            callback
        ) {
            callback(
                null,
                proofDirectory
            );
        },

        filename(
            req,
            file,
            callback
        ) {
            const extension =
                allowed.get(
                    file.mimetype
                );

            const random =
                crypto
                    .randomBytes(8)
                    .toString("hex");

            callback(
                null,
                `payment-proof-${Date.now()}-${random}${extension}`
            );
        }
    });

module.exports =
    multer({
        storage,

        limits: {
            fileSize:
                5 * 1024 * 1024,

            files: 1
        },

        fileFilter(
            req,
            file,
            callback
        ) {
            const extension =
                path
                    .extname(
                        file.originalname
                    )
                    .toLowerCase();

            const validExtension =
                [
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".webp"
                ]
                    .includes(
                        extension
                    );

            if (
                !allowed.has(
                    file.mimetype
                ) ||
                !validExtension
            ) {
                return callback(
                    new Error(
                        "Payment receipt must be a JPG, JPEG, PNG or WEBP image."
                    )
                );
            }

            callback(
                null,
                true
            );
        }
    });
