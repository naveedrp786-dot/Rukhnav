"use strict";

const fs = require("fs");
const path = require("path");

/*
 * Public uploads currently live at:
 *
 *   production:
 *     /data/rukhnav/uploads
 *
 * Payment receipts must NOT be placed there because
 * /uploads is exposed by Express as public static media.
 *
 * Private storage therefore defaults to:
 *
 *   production:
 *     /data/rukhnav/private
 *
 *   local:
 *     backend/private
 */

const privateRoot = path.resolve(
    process.env.PRIVATE_STORAGE_ROOT ||
    (
        process.env.UPLOAD_ROOT
            ? path.join(
                  path.dirname(
                      path.resolve(
                          process.env.UPLOAD_ROOT
                      )
                  ),
                  "private"
              )
            : path.join(
                  __dirname,
                  "..",
                  "private"
              )
    )
);

function ensureDirectory(directory) {
    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );

    return directory;
}

function getPrivateDirectory(folderName) {
    const safeFolder =
        String(folderName || "")
            .trim()
            .replace(
                /[^a-zA-Z0-9_-]/g,
                ""
            );

    if (!safeFolder) {
        return ensureDirectory(
            privateRoot
        );
    }

    return ensureDirectory(
        path.join(
            privateRoot,
            safeFolder
        )
    );
}

function verifyPrivateStorage() {
    ensureDirectory(
        privateRoot
    );

    fs.accessSync(
        privateRoot,
        fs.constants.R_OK |
        fs.constants.W_OK
    );

    return {
        privateRoot,
        writable: true
    };
}

module.exports = {
    privateRoot,
    getPrivateDirectory,
    verifyPrivateStorage
};
