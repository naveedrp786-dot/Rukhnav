"use strict";

const db = require("../config/db");

const ALLOWED_TYPES = new Set([
    "Order",
    "Promotion",
    "Sale",
    "New Product",
    "Announcement",
    "Reward",
    "Review",
    "Loyalty",
    "Return",
    "Refund",
    "Account",
    "Event",
    "General"
]);

const ALLOWED_PRIORITIES = new Set([
    "Low",
    "Normal",
    "High",
    "Urgent"
]);

function cleanText(value, maxLength = 500) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    if (!text) {
        return null;
    }

    return text.slice(0, maxLength);
}

function normalizeType(value) {
    const type = cleanText(value, 50) || "General";
    return ALLOWED_TYPES.has(type) ? type : "General";
}

function normalizePriority(value) {
    const priority =
        cleanText(value, 20) || "Normal";

    return ALLOWED_PRIORITIES.has(priority)
        ? priority
        : "Normal";
}

async function createNotification({
    customerId,
    notificationType = "General",
    title,
    message,
    actionLabel = null,
    actionUrl = null,
    orderId = null,
    campaignId = null,
    referenceType = null,
    referenceId = null,
    icon = null,
    priority = "Normal",
    expiresAt = null
}) {
    const numericCustomerId = Number(customerId);

    if (!Number.isInteger(numericCustomerId) ||
        numericCustomerId <= 0) {
        throw new Error(
            "A valid customer ID is required."
        );
    }

    const safeTitle = cleanText(title, 180);
    const safeMessage = cleanText(message, 10000);

    if (!safeTitle || !safeMessage) {
        throw new Error(
            "Notification title and message are required."
        );
    }

    const safeReferenceType =
        cleanText(referenceType, 60);

    const safeReferenceId =
        cleanText(referenceId, 100);

    /*
     * Application-level deduplication.
     *
     * If referenceType + referenceId are supplied,
     * the same logical notification is returned
     * instead of creating another unread copy.
     */
    if (safeReferenceType && safeReferenceId) {
        const [existingRows] = await db.query(
            `
            SELECT *
            FROM customer_notifications
            WHERE customer_id = ?
              AND reference_type = ?
              AND reference_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                numericCustomerId,
                safeReferenceType,
                safeReferenceId
            ]
        );

        if (existingRows.length) {
            return {
                created: false,
                notification:
                    existingRows[0]
            };
        }
    }

    const [result] = await db.query(
        `
        INSERT INTO customer_notifications
        (
            customer_id,
            notification_type,
            title,
            message,
            action_label,
            action_url,
            order_id,
            campaign_id,
            reference_type,
            reference_id,
            icon,
            priority,
            expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            numericCustomerId,
            normalizeType(notificationType),
            safeTitle,
            safeMessage,
            cleanText(actionLabel, 80),
            cleanText(actionUrl, 500),
            orderId ? Number(orderId) : null,
            campaignId ? Number(campaignId) : null,
            safeReferenceType,
            safeReferenceId,
            cleanText(icon, 80),
            normalizePriority(priority),
            expiresAt || null
        ]
    );

    const [rows] = await db.query(
        `
        SELECT *
        FROM customer_notifications
        WHERE id = ?
        LIMIT 1
        `,
        [result.insertId]
    );

    return {
        created: true,
        notification: rows[0]
    };
}

async function listForCustomer(
    customerId,
    {
        limit = 30,
        offset = 0,
        unreadOnly = false
    } = {}
) {
    const safeLimit =
        Math.min(
            Math.max(Number(limit) || 30, 1),
            100
        );

    const safeOffset =
        Math.max(Number(offset) || 0, 0);

    const conditions = [
        "customer_id = ?",
        "(expires_at IS NULL OR expires_at > NOW())"
    ];

    const params = [Number(customerId)];

    if (unreadOnly) {
        conditions.push("is_read = 0");
    }

    const [rows] = await db.query(
        `
        SELECT
            id,
            notification_type,
            title,
            message,
            action_label,
            action_url,
            order_id,
            campaign_id,
            reference_type,
            reference_id,
            icon,
            priority,
            is_read,
            read_at,
            expires_at,
            created_at
        FROM customer_notifications
        WHERE ${conditions.join(" AND ")}
        ORDER BY
            is_read ASC,
            created_at DESC,
            id DESC
        LIMIT ?
        OFFSET ?
        `,
        [
            ...params,
            safeLimit,
            safeOffset
        ]
    );

    return rows;
}

async function getUnreadCount(customerId) {
    const [rows] = await db.query(
        `
        SELECT COUNT(*) AS unread_count
        FROM customer_notifications
        WHERE customer_id = ?
          AND is_read = 0
          AND (
              expires_at IS NULL
              OR expires_at > NOW()
          )
        `,
        [Number(customerId)]
    );

    return Number(
        rows[0]?.unread_count || 0
    );
}

async function markRead(
    customerId,
    notificationId
) {
    const [result] = await db.query(
        `
        UPDATE customer_notifications
        SET
            is_read = 1,
            read_at = COALESCE(
                read_at,
                CURRENT_TIMESTAMP
            )
        WHERE id = ?
          AND customer_id = ?
        `,
        [
            Number(notificationId),
            Number(customerId)
        ]
    );

    return result.affectedRows > 0;
}

async function markAllRead(customerId) {
    const [result] = await db.query(
        `
        UPDATE customer_notifications
        SET
            is_read = 1,
            read_at = COALESCE(
                read_at,
                CURRENT_TIMESTAMP
            )
        WHERE customer_id = ?
          AND is_read = 0
        `,
        [Number(customerId)]
    );

    return result.affectedRows;
}

module.exports = {
    createNotification,
    listForCustomer,
    getUnreadCount,
    markRead,
    markAllRead
};
