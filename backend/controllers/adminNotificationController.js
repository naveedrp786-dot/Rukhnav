"use strict";

const db =
    require("../config/db");

const syncService =
    require(
        "../services/adminNotificationSyncService"
    );

function adminId(req) {
    return Number(
        req.admin?.id ||
        req.user?.id ||
        req.adminId ||
        0
    );
}

function clampLimit(value) {
    const parsed =
        Number(value);

    if (
        !Number.isInteger(parsed) ||
        parsed < 1
    ) {
        return 10;
    }

    return Math.min(
        parsed,
        50
    );
}

exports.getLatest = async (
    req,
    res
) => {
    try {
        const id =
            adminId(req);

        if (!id) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Administrator authentication is required."
                });
        }

        await syncService.sync();

        const limit =
            clampLimit(
                req.query.limit
            );

        const unreadOnly =
            String(
                req.query.unread ||
                ""
            ) === "1";

        const [notifications] =
            await db.query(
                `
                SELECT
                    n.id,
                    n.notification_type,
                    n.severity,
                    n.title,
                    n.message,
                    n.source_type,
                    n.source_id,
                    n.link_url,
                    n.icon,
                    n.created_at,
                    CASE
                        WHEN r.notification_id
                            IS NULL
                        THEN 0
                        ELSE 1
                    END AS is_read
                FROM admin_notifications n
                LEFT JOIN admin_notification_reads r
                    ON r.notification_id =
                        n.id
                   AND r.admin_id = ?
                ${
                    unreadOnly
                        ? "WHERE r.notification_id IS NULL"
                        : ""
                }
                ORDER BY n.id DESC
                LIMIT ?
                `,
                [
                    id,
                    limit
                ]
            );

        const [[count]] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS unread_count
                FROM admin_notifications n
                LEFT JOIN admin_notification_reads r
                    ON r.notification_id =
                        n.id
                   AND r.admin_id = ?
                WHERE
                    r.notification_id IS NULL
                `,
                [id]
            );

        return res.json({
            success: true,
            unreadCount:
                Number(
                    count.unread_count ||
                    0
                ),
            notifications:
                notifications.map(
                    item => ({
                        ...item,
                        is_read:
                            Boolean(
                                item.is_read
                            )
                    })
                )
        });
    } catch (error) {
        console.error(
            "Admin notifications error:",
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                message:
                    error.message
            });
    }
};

exports.getUnreadCount = async (
    req,
    res
) => {
    try {
        const id =
            adminId(req);

        if (!id) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Administrator authentication is required."
                });
        }

        await syncService.sync();

        const [[row]] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS unread_count
                FROM admin_notifications n
                LEFT JOIN admin_notification_reads r
                    ON r.notification_id =
                        n.id
                   AND r.admin_id = ?
                WHERE
                    r.notification_id IS NULL
                `,
                [id]
            );

        return res.json({
            success: true,
            unreadCount:
                Number(
                    row.unread_count ||
                    0
                )
        });
    } catch (error) {
        return res
            .status(500)
            .json({
                success: false,
                message:
                    error.message
            });
    }
};

exports.markRead = async (
    req,
    res
) => {
    try {
        const id =
            adminId(req);

        const notificationId =
            Number(
                req.params.id
            );

        if (
            !id ||
            !notificationId
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "A valid notification is required."
                });
        }

        const [[exists]] =
            await db.query(
                `
                SELECT id
                FROM admin_notifications
                WHERE id = ?
                LIMIT 1
                `,
                [notificationId]
            );

        if (!exists) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Notification was not found."
                });
        }

        await db.query(
            `
            INSERT INTO admin_notification_reads
            (
                notification_id,
                admin_id
            )
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                read_at =
                    CURRENT_TIMESTAMP
            `,
            [
                notificationId,
                id
            ]
        );

        return res.json({
            success: true,
            message:
                "Notification marked as read."
        });
    } catch (error) {
        return res
            .status(500)
            .json({
                success: false,
                message:
                    error.message
            });
    }
};

exports.markAllRead = async (
    req,
    res
) => {
    try {
        const id =
            adminId(req);

        if (!id) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Administrator authentication is required."
                });
        }

        await db.query(
            `
            INSERT IGNORE INTO admin_notification_reads
            (
                notification_id,
                admin_id
            )
            SELECT
                n.id,
                ?
            FROM admin_notifications n
            LEFT JOIN admin_notification_reads r
                ON r.notification_id =
                    n.id
               AND r.admin_id = ?
            WHERE
                r.notification_id IS NULL
            `,
            [
                id,
                id
            ]
        );

        return res.json({
            success: true,
            message:
                "All notifications marked as read.",
            unreadCount:
                0
        });
    } catch (error) {
        return res
            .status(500)
            .json({
                success: false,
                message:
                    error.message
            });
    }
};

exports.forceSync = async (
    req,
    res
) => {
    try {
        const result =
            await syncService.sync({
                force: true
            });

        return res.json({
            success: true,
            message:
                "ERP notifications synchronized.",
            result
        });
    } catch (error) {
        return res
            .status(500)
            .json({
                success: false,
                message:
                    error.message
            });
    }
};
