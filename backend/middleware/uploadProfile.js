"use strict";

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const {
    getUploadDirectory
} = require("../config/storage");

const uploadDir =
    getUploadDirectory("profiles");

const allowed = new Map([
    ["image/jpeg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"]
]);

const storage = multer.diskStorage({
    destination(req, file, callback) {
        callback(null, uploadDir);
    },

    filename(req, file, callback) {
        const extension =
            allowed.get(file.mimetype) ||
            path.extname(file.originalname)
                .toLowerCase();

        callback(
            null,
            `customer-${req.user?.id || "unknown"}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`
        );
    }
});

module.exports = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },
    fileFilter(req, file, callback) {
        const extension =
            path.extname(file.originalname)
                .toLowerCase();

        const validExtension =
            [".jpg", ".jpeg", ".png", ".webp"]
                .includes(extension);

        if (
            !allowed.has(file.mimetype) ||
            !validExtension
        ) {
            return callback(
                new Error(
                    "Only JPG, JPEG, PNG and WEBP images are allowed."
                )
            );
        }

        callback(null, true);
    }
});
