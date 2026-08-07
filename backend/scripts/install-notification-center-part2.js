"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot =
    path.resolve(
        __dirname,
        ".."
    );

const projectRoot =
    path.resolve(
        backendRoot,
        ".."
    );

function backup(
    filePath
) {
    const backupPath =
        `${filePath}.before-notification-part2`;

    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(
            filePath,
            backupPath
        );
    }
}

function patchServer() {
    const filePath =
        path.join(
            backendRoot,
            "server.js"
        );

    backup(filePath);

    let text =
        fs.readFileSync(
            filePath,
            "utf8"
        );

    if (
        !text.includes(
            'require("./jobs/notificationQueueWorker")'
        )
    ) {
        const marker =
            'const notificationCenterRoutes =\n    require("./routes/notificationCenterRoutes");';

        if (!text.includes(marker)) {
            throw new Error(
                "Install Notification Center Part 1 before Part 2."
            );
        }

        text =
            text.replace(
                marker,
                `${marker}\n\nconst notificationQueueWorker =\n    require("./jobs/notificationQueueWorker");`
            );
    }

    if (
        !text.includes(
            "notificationQueueWorker.start()"
        )
    ) {
        const marker =
            "Event reminder job scheduled for 9:00 AM Asia/Karachi.";

        const index =
            text.indexOf(marker);

        if (index >= 0) {
            const lineEnd =
                text.indexOf(
                    "\n",
                    index
                );

            text =
                text.slice(
                    0,
                    lineEnd + 1
                ) +
                "\nnotificationQueueWorker.start();\n" +
                text.slice(
                    lineEnd + 1
                );
        } else {
            const listenMarker =
                "app.listen(";

            const listenIndex =
                text.indexOf(
                    listenMarker
                );

            if (listenIndex < 0) {
                throw new Error(
                    "Could not find server startup marker."
                );
            }

            text =
                text.slice(
                    0,
                    listenIndex
                ) +
                "notificationQueueWorker.start();\n\n" +
                text.slice(
                    listenIndex
                );
        }
    }

    fs.writeFileSync(
        filePath,
        text
    );
}

function patchCustomerRegistration() {
    const filePath =
        path.join(
            backendRoot,
            "controllers",
            "customerController.js"
        );

    backup(filePath);

    let text =
        fs.readFileSync(
            filePath,
            "utf8"
        );

    if (
        !text.includes(
            'require("../services/notificationHooks")'
        )
    ) {
        const marker =
            'const jwt = require("jsonwebtoken");';

        text =
            text.replace(
                marker,
                `${marker}\nconst notificationHooks =\n    require("../services/notificationHooks");`
            );
    }

    if (
        !text.includes(
            "notificationHooks.customerRegistered"
        )
    ) {
        const marker =
            "        return res.status(201).json({";

        const insertion = `
        notificationHooks
            .customerRegistered({
                customerId,
                fullName:
                    cleanFullName,
                email:
                    cleanEmail || null,
                phone:
                    cleanPhone || null
            });

`;

        const registrationStart =
            text.indexOf(
                "exports.register"
            );

        const markerIndex =
            text.indexOf(
                marker,
                registrationStart
            );

        if (markerIndex < 0) {
            throw new Error(
                "Could not find customer registration response marker."
            );
        }

        text =
            text.slice(
                0,
                markerIndex
            ) +
            insertion +
            text.slice(
                markerIndex
            );
    }

    fs.writeFileSync(
        filePath,
        text
    );
}

function patchOrderPlacement() {
    const filePath =
        path.join(
            backendRoot,
            "controllers",
            "orderController.js"
        );

    backup(filePath);

    let text =
        fs.readFileSync(
            filePath,
            "utf8"
        );

    if (
        !text.includes(
            'require("../services/notificationHooks")'
        )
    ) {
        const marker =
            'const db = require("../config/db");';

        text =
            text.replace(
                marker,
                `${marker}\nconst notificationHooks =\n    require("../services/notificationHooks");`
            );
    }

    if (
        !text.includes(
            "notificationHooks.orderPlaced"
        )
    ) {
        const marker =
            "        return res.status(201).json({";

        const placeOrderStart =
            text.indexOf(
                "exports.placeOrder"
            );

        const markerIndex =
            text.indexOf(
                marker,
                placeOrderStart
            );

        if (markerIndex < 0) {
            throw new Error(
                "Could not find order placement response marker."
            );
        }

        const insertion = `
        notificationHooks
            .orderPlaced({
                customerId,
                orderId,
                orderNumber,
                grandTotal,
                orderStatus:
                    "Pending"
            });

`;

        text =
            text.slice(
                0,
                markerIndex
            ) +
            insertion +
            text.slice(
                markerIndex
            );
    }

    fs.writeFileSync(
        filePath,
        text
    );
}

patchServer();
patchCustomerRegistration();
patchOrderPlacement();

console.log(
    "Notification Center Part 2 installed successfully."
);
