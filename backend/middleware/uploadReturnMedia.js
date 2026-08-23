"use strict";

const path = require("path");
const multer = require("multer");
const {
    getUploadDirectory
} = require("../config/storage");

const uploadDirectory =
    getUploadDirectory("returns");

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm"
]);

const allowedExtensions = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".mp4",
    ".mov",
    ".webm"
]);

const storage = multer.diskStorage({
    destination(req, file, callback) {
        callback(
            null,
            uploadDirectory
        );
    },

    filename(req, file, callback) {
        const extension =
            path
                .extname(
                    file.originalname || ""
                )
                .toLowerCase();

        const safeExtension =
            allowedExtensions.has(
                extension
            )
                ? extension
                : (
                    file.mimetype
                        ?.startsWith(
                            "video/"
                        )
                        ? ".mp4"
                        : ".jpg"
                );

        const prefix =
            file.mimetype
                ?.startsWith(
                    "video/"
                )
                ? "return-video"
                : "return-image";

        callback(
            null,
            `${prefix}-${Date.now()}-${Math.round(
                Math.random() * 1e9
            )}${safeExtension}`
        );
    }
});

const uploadReturnMedia =
    multer({
        storage,

        limits: {
            files: 6,
            fileSize:
                25 * 1024 * 1024
        },

        fileFilter(
            req,
            file,
            callback
        ) {
            if (
                !allowedMimeTypes.has(
                    file.mimetype
                )
            ) {
                const error =
                    new Error(
                        "Return evidence must be JPG, PNG, WEBP, MP4, MOV, or WEBM."
                    );

                error.code =
                    "INVALID_RETURN_MEDIA";

                return callback(
                    error
                );
            }

            callback(
                null,
                true
            );
        }
    })
    .array(
        "return_media",
        6
    );

module.exports = {
    uploadReturnMedia,
    uploadDirectory
};
