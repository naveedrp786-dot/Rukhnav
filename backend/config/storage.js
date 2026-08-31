"use strict";

const fs = require("fs");
const path = require("path");

const uploadRoot = path.resolve(
    process.env.UPLOAD_ROOT ||
    path.join(__dirname, "..", "uploads")
);

function ensureDirectory(directory) {
    fs.mkdirSync(directory, {
        recursive: true
    });

    return directory;
}

function getUploadDirectory(folderName) {
    const safeFolder = String(folderName || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "");

    if (!safeFolder) {
        return ensureDirectory(uploadRoot);
    }

    return ensureDirectory(
        path.join(uploadRoot, safeFolder)
    );
}

function verifyUploadStorage() {
    ensureDirectory(uploadRoot);

    fs.accessSync(
        uploadRoot,
        fs.constants.R_OK | fs.constants.W_OK
    );

    return {
        uploadRoot,
        writable: true
    };
}

module.exports = {
    uploadRoot,
    getUploadDirectory,
    verifyUploadStorage
};
