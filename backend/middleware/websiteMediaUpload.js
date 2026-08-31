"use strict";

const multer = require("multer");
const path = require("path");

const {
    getUploadDirectory
} = require("../config/storage");

const destination =
    getUploadDirectory("website");

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, destination);
    },

    filename: (req, file, callback) => {
        const extension =
            path.extname(
                file.originalname
            ).toLowerCase();

        const base =
            path.basename(
                file.originalname,
                extension
            )
                .replace(
                    /[^a-z0-9_-]+/gi,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                )
                .slice(0, 70) ||
            "website-image";

        callback(
            null,
            `${Date.now()}-${base}${extension}`
        );
    }
});

const allowed =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        "image/x-icon",
        "image/vnd.microsoft.icon"
    ]);

module.exports =
    multer({
        storage,

        limits: {
            fileSize:
                8 *
                1024 *
                1024
        },

        fileFilter:
            (
                req,
                file,
                callback
            ) => {
                if (
                    !allowed.has(
                        file.mimetype
                    )
                ) {
                    return callback(
                        new Error(
                            "Only JPG, PNG, WEBP, GIF, SVG and ICO files are allowed."
                        )
                    );
                }

                callback(
                    null,
                    true
                );
            }
    });