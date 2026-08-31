"use strict";

const fs =
    require("fs");

const path =
    require("path");

function backup(file) {
    const copy =
        `${file}.before-live-notifications`;

    if (
        fs.existsSync(file) &&
        !fs.existsSync(copy)
    ) {
        fs.copyFileSync(
            file,
            copy
        );
    }
}

function patchServer() {
    const file =
        path.join(
            __dirname,
            "..",
            "server.js"
        );

    if (!fs.existsSync(file)) {
        throw new Error(
            "backend/server.js was not found."
        );
    }

    backup(file);

    let source =
        fs.readFileSync(
            file,
            "utf8"
        );

    const requireLine =
        `const adminNotificationRoutes = require("./routes/adminNotificationRoutes");`;

    if (
        !source.includes(
            requireLine
        )
    ) {
        const expressLine =
            `const express = require("express");`;

        if (
            source.includes(
                expressLine
            )
        ) {
            source =
                source.replace(
                    expressLine,
                    `${expressLine}\n${requireLine}`
                );
        } else {
            source =
                `${requireLine}\n${source}`;
        }
    }

    const mount =
        `app.use("/api/admin/notifications", adminNotificationRoutes);`;

    if (
        !source.includes(
            mount
        )
    ) {
        const markers = [
            `app.use("/api/admin/dashboard"`,
            `app.use("/api/admin/website"`,
            `app.use((req, res) =>`
        ];

        let index = -1;

        for (
            const marker
            of markers
        ) {
            index =
                source.indexOf(marker);

            if (index >= 0) {
                break;
            }
        }

        if (index >= 0) {
            source =
                source.slice(
                    0,
                    index
                ) +
                `${mount}\n` +
                source.slice(
                    index
                );
        } else {
            source +=
                `\n${mount}\n`;
        }
    }

    fs.writeFileSync(
        file,
        source
    );
}

function patchLoader(
    relativePath
) {
    const file =
        path.join(
            __dirname,
            "..",
            "..",
            relativePath
        );

    if (!fs.existsSync(file)) {
        return false;
    }

    backup(file);

    let source =
        fs.readFileSync(
            file,
            "utf8"
        );

    const marker =
        "RUKHNAV_ADMIN_LIVE_NOTIFICATION_BELL";

    if (
        source.includes(marker)
    ) {
        return true;
    }

    source += `

/* ${marker} */
(() => {
    const script =
        document.createElement("script");

    script.src =
        "/admin/js/admin-notification-bell.js";

    script.async =
        true;

    document.head
        .appendChild(script);
})();
`;

    fs.writeFileSync(
        file,
        source
    );

    return true;
}

function run() {
    patchServer();

    const patched = [
        "public/admin/js/componentLoader.js",
        "public/admin/purchasing/js/purchasing-layout-loader.js"
    ].map(
        patchLoader
    );

    console.log(
        "Admin live notification routes installed."
    );

    console.log(
        "Shared layout loaders patched:",
        patched
    );

    console.log(
        "NO /public/store files were changed."
    );
}

run();
