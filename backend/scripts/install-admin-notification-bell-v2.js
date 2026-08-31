"use strict";

const fs = require("fs");
const path = require("path");

const ROOT =
    path.resolve(
        __dirname,
        "..",
        ".."
    );

function backup(file) {
    if (!fs.existsSync(file)) {
        return;
    }

    const backupFile =
        `${file}.before-notification-bell-v2`;

    if (!fs.existsSync(backupFile)) {
        fs.copyFileSync(
            file,
            backupFile
        );
    }
}

function appendBellLoader(
    relativeFile
) {
    const file =
        path.join(
            ROOT,
            relativeFile
        );

    if (!fs.existsSync(file)) {
        console.log(
            `Skipped missing: ${relativeFile}`
        );

        return false;
    }

    backup(file);

    let source =
        fs.readFileSync(
            file,
            "utf8"
        );

    const marker =
        "RUKHNAV_NOTIFICATION_BELL_V2_LOADER";

    if (
        source.includes(marker)
    ) {
        console.log(
            `Already patched: ${relativeFile}`
        );

        return true;
    }

    source += `

/* ${marker} */
(() => {
    if (
        document.querySelector(
            'script[data-rukhnav-notification-v2]'
        )
    ) {
        return;
    }

    const script =
        document.createElement("script");

    script.src =
        "/admin/js/admin-notification-bell.js?v=2";

    script.async = true;

    script.dataset
        .rukhnavNotificationV2 =
        "true";

    document.head
        .appendChild(script);
})();
`;

    fs.writeFileSync(
        file,
        source
    );

    console.log(
        `Patched: ${relativeFile}`
    );

    return true;
}

function patchTopbarStaticThree() {
    const file =
        path.join(
            ROOT,
            "public/admin/components/topbar.html"
        );

    if (!fs.existsSync(file)) {
        console.log(
            "Skipped missing topbar component."
        );

        return;
    }

    backup(file);

    let source =
        fs.readFileSync(
            file,
            "utf8"
        );

    /*
     * Do not redesign topbar.
     * Only replace a simple hard-coded badge "3"
     * when it is inside a notification/bell button.
     *
     * The live JS will populate the real value.
     */

    source =
        source.replace(
            /(<button[^>]*(?:notification|bell)[^>]*>[\s\S]*?<span[^>]*(?:badge|notification)[^>]*>)\s*3\s*(<\/span>)/gi,
            "$1$2"
        );

    fs.writeFileSync(
        file,
        source
    );

    console.log(
        "Checked topbar for static notification count."
    );
}

function run() {
    const files = [
        "public/admin/js/componentLoader.js",
        "public/admin/js/adminLayout.js",
        "public/admin/purchasing/js/purchasing-layout-loader.js"
    ];

    files.forEach(
        appendBellLoader
    );

    patchTopbarStaticThree();

    console.log("");
    console.log(
        "RUKHNAV Notification Bell V2 installed."
    );
    console.log(
        "No public/store files were changed."
    );
}

run();
