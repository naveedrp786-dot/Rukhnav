"use strict";

const path = require("path");
const multer = require("multer");
const {
    getUploadDirectory
} = require("../config/storage");

const uploadDirectory =
    getUploadDirectory("reviews");

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const storage = multer.diskStorage({
    destination(req, file, callback) {
        callback(null, uploadDirectory);
    },

    filename(req, file, callback) {
        const extension =
            path.extname(file.originalname || "")
                .toLowerCase();

        const safeExtension =
            [".jpg", ".jpeg", ".png", ".webp"]
                .includes(extension)
                ? extension
                : ".jpg";

        callback(
            null,
            `review-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`
        );
    }
});

const uploadReviewImages = multer({
    storage,
    limits: {
        files: 5,
        fileSize: 5 * 1024 * 1024
    },
    fileFilter(req, file, callback) {
        if (!allowedMimeTypes.has(file.mimetype)) {
            const error = new Error(
                "Review pictures must be JPG, PNG, or WEBP."
            );
            error.code = "INVALID_REVIEW_IMAGE";
            return callback(error);
        }

        callback(null, true);
    }
}).array("review_images", 5);

module.exports = {
    uploadReviewImages,
    uploadDirectory
};
