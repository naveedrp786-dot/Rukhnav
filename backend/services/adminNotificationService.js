"use strict";

const db = require("../config/db");

function clean(value, maximum = 700) {
    const text =
        String(value ?? "").trim();

    return text
        ? text.slice(0, maximum)
        : null;
}

async function createNotification({
    notificationType,
    severity = "info",
    title,
    message = null,
    sourceType = null,
    sourceId = null,
    linkUrl = null,
    icon = null,
    dedupeKey
}) {
    const safeSeverity =
        [
            "info",
            "success",
            "warning",
            "danger"
        ].includes(severity)
            ? severity
            : "info";

    const key =
        clean(dedupeKey, 190);

    if (
        !key ||
        !clean(title, 180) ||
        !clean(notificationType, 80)
    ) {
        return {
            inserted: false
        };
    }

    const [result] =
        await db.query(
            `
            INSERT IGNORE INTO admin_notifications
            (
                notification_type,
                severity,
                title,
                message,
                source_type,
                source_id,
                link_url,
                icon,
                dedupe_key
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                clean(notificationType, 80),
                safeSeverity,
                clean(title, 180),
                clean(message, 700),
                clean(sourceType, 80),
                Number(sourceId) || null,
                clean(linkUrl, 500),
                clean(icon, 80),
                key
            ]
        );

    return {
        inserted:
            result.affectedRows > 0
    };
}

module.exports = {
    createNotification
};
