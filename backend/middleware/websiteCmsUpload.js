"use strict";

const multer = require("multer");
const path = require("path");
const {
    getUploadDirectory
} = require("../config/storage");

const uploadDirectory =
    getUploadDirectory("website");

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDirectory);
    },

    filename(req, file, cb) {
        const extension =
            path.extname(file.originalname)
                .toLowerCase();

        const originalName =
            path.basename(
                file.originalname,
                extension
            )
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .replace(/-+/g, "-")
            .toLowerCase();

        cb(
            null,
            `${Date.now()}-${originalName}${extension}`
        );
    }
});

const fileFilter = (req, file, cb) => {
    const extension =
        path.extname(file.originalname)
            .toLowerCase()
            .replace(".", "");

    const mimeAllowed = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ].includes(file.mimetype);

    const extensionAllowed =
        /^(jpg|jpeg|png|webp)$/.test(extension);

    if (mimeAllowed && extensionAllowed) {
        return cb(null, true);
    }

    cb(
        new Error(
            "Only JPG, JPEG, PNG and WEBP images are allowed."
        )
    );
};

module.exports = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});
