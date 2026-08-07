"use strict";

const multer = require("multer");
const path = require("path");
const {
    getUploadDirectory
} = require("../config/storage");

const uploadDirectory =
    getUploadDirectory("admins");

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, uploadDirectory);
    },

    filename(req, file, cb) {
        const uniqueName =
            "admin-" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname)
                .toLowerCase();

        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const validExtension = allowed.test(
        path.extname(file.originalname)
            .toLowerCase()
    );
    const validMime = allowed.test(file.mimetype);

    if (validExtension && validMime) {
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
        fileSize: 2 * 1024 * 1024
    }
});
