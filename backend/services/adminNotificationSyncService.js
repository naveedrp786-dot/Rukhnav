"use strict";

const db =
    require("../config/db");

const {
    createNotification
} =
    require(
        "./adminNotificationService"
    );

let lastSyncAt = 0;
let running = null;

async function tableExists(table) {
    const [rows] =
        await db.query(
            `
            SELECT 1
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            LIMIT 1
            `,
            [table]
        );

    return rows.length > 0;
}

async function columns(table) {
    const [rows] =
        await db.query(
            `
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            `,
            [table]
        );

    return new Set(
        rows.map(
            row =>
                String(
                    row.COLUMN_NAME
                )
        )
    );
}

function has(columnSet, column) {
    return columnSet.has(column);
}

function money(value) {
    return Number(value || 0)
        .toLocaleString(
            "en-PK",
            {
                maximumFractionDigits: 2
            }
        );
}

async function syncOrders() {
    if (
        !await tableExists("orders")
    ) {
        return 0;
    }

    const c =
        await columns("orders");

    if (
        !has(c, "id") ||
        !has(c, "created_at")
    ) {
        return 0;
    }

    const orderNumber =
        has(c, "order_number")
            ? "order_number"
            : "id";

    const customerName =
        has(c, "full_name")
            ? "full_name"
            : "NULL";

    const total =
        has(c, "grand_total")
            ? "grand_total"
            : "0";

    const status =
        has(c, "order_status")
            ? "order_status"
            : "NULL";

    const paymentMethod =
        has(c, "payment_method")
            ? "payment_method"
            : "NULL";

    const paymentStatus =
        has(c, "payment_status")
            ? "payment_status"
            : "NULL";

    const cancelledAt =
        has(c, "cancelled_at")
            ? "cancelled_at"
            : "NULL";

    const updatedAt =
        has(c, "updated_at")
            ? "updated_at"
            : "created_at";

    const [rows] =
        await db.query(
            `
            SELECT
                id,
                ${orderNumber}
                    AS order_number,
                ${customerName}
                    AS customer_name,
                ${total}
                    AS grand_total,
                ${status}
                    AS order_status,
                ${paymentMethod}
                    AS payment_method,
                ${paymentStatus}
                    AS payment_status,
                ${cancelledAt}
                    AS cancelled_at,
                created_at,
                ${updatedAt}
                    AS updated_at
            FROM orders
            WHERE created_at >=
                DATE_SUB(
                    NOW(),
                    INTERVAL 30 DAY
                )
            ORDER BY id DESC
            LIMIT 500
            `
        );

    let inserted = 0;

    for (const order of rows) {
        const number =
            order.order_number ||
            `#${order.id}`;

        const customer =
            order.customer_name ||
            "Customer";

        const created =
            await createNotification({
                notificationType:
                    "NEW_ORDER",
                severity:
                    "info",
                title:
                    "New customer order",
                message:
                    `${number} · ${customer} · Rs ${money(order.grand_total)}`,
                sourceType:
                    "order",
                sourceId:
                    order.id,
                linkUrl:
                    `/admin/orders.html?order=${order.id}`,
                icon:
                    "fa-bag-shopping",
                dedupeKey:
                    `NEW_ORDER:${order.id}`
            });

        if (created.inserted) {
            inserted += 1;
        }

        const statusText =
            String(
                order.order_status ||
                ""
            ).toLowerCase();

        if (
            order.cancelled_at ||
            statusText === "cancelled"
        ) {
            const cancelled =
                await createNotification({
                    notificationType:
                        "ORDER_CANCELLED",
                    severity:
                        "warning",
                    title:
                        "Order cancelled",
                    message:
                        `${number} · ${customer}`,
                    sourceType:
                        "order",
                    sourceId:
                        order.id,
                    linkUrl:
                        `/admin/orders.html?order=${order.id}`,
                    icon:
                        "fa-ban",
                    dedupeKey:
                        `ORDER_CANCELLED:${order.id}`
                });

            if (cancelled.inserted) {
                inserted += 1;
            }
        }

        const method =
            String(
                order.payment_method ||
                ""
            )
                .toLowerCase()
                .replace(/[_-]+/g, " ");

        const paid =
            String(
                order.payment_status ||
                ""
            ).toLowerCase() === "paid";

        const cod =
            method.includes("cash") ||
            method.includes("cod");

        if (cod && paid) {
            const received =
                await createNotification({
                    notificationType:
                        "COD_PAYMENT_RECEIVED",
                    severity:
                        "success",
                    title:
                        "COD payment received",
                    message:
                        `${number} · Rs ${money(order.grand_total)}`,
                    sourceType:
                        "order",
                    sourceId:
                        order.id,
                    linkUrl:
                        `/admin/orders.html?order=${order.id}`,
                    icon:
                        "fa-money-bill-wave",
                    dedupeKey:
                        `COD_PAYMENT_RECEIVED:${order.id}`
                });

            if (received.inserted) {
                inserted += 1;
            }
        }
    }

    return inserted;
}

async function syncProducts() {
    if (
        !await tableExists("products")
    ) {
        return 0;
    }

    const c =
        await columns("products");

    if (
        !has(c, "id") ||
        !has(c, "stock")
    ) {
        return 0;
    }

    const name =
        has(c, "product_name")
            ? "product_name"
            : has(c, "name")
                ? "name"
                : "CONCAT('Product #', id)";

    const statusClause =
        has(c, "status")
            ? `
                AND (
                    status IS NULL
                    OR LOWER(status)
                        IN (
                            'active',
                            'available'
                        )
                )
            `
            : "";

    const threshold =
        has(c, "reorder_level")
            ? "COALESCE(reorder_level, 10)"
            : has(c, "low_stock_threshold")
                ? "COALESCE(low_stock_threshold, 10)"
                : "10";

    const [rows] =
        await db.query(
            `
            SELECT
                id,
                ${name}
                    AS product_name,
                stock,
                ${threshold}
                    AS low_stock_threshold
            FROM products
            WHERE stock <= ${threshold}
            ${statusClause}
            ORDER BY stock ASC, id DESC
            LIMIT 250
            `
        );

    let inserted = 0;

    for (const product of rows) {
        const stock =
            Number(product.stock || 0);

        const out =
            stock <= 0;

        const result =
            await createNotification({
                notificationType:
                    out
                        ? "OUT_OF_STOCK"
                        : "LOW_STOCK",
                severity:
                    out
                        ? "danger"
                        : "warning",
                title:
                    out
                        ? "Product out of stock"
                        : "Low stock alert",
                message:
                    `${product.product_name || `Product #${product.id}`} · ${stock} unit(s) remaining`,
                sourceType:
                    "product",
                sourceId:
                    product.id,
                linkUrl:
                    `/admin/products.html?product=${product.id}`,
                icon:
                    out
                        ? "fa-circle-xmark"
                        : "fa-triangle-exclamation",
                dedupeKey:
                    `${
                        out
                            ? "OUT_OF_STOCK"
                            : "LOW_STOCK"
                    }:${product.id}:${stock}`
            });

        if (result.inserted) {
            inserted += 1;
        }
    }

    return inserted;
}

async function syncReviews() {
    if (
        !await tableExists("reviews")
    ) {
        return 0;
    }

    const c =
        await columns("reviews");

    if (
        !has(c, "id") ||
        !has(c, "created_at")
    ) {
        return 0;
    }

    const rating =
        has(c, "rating")
            ? "rating"
            : "NULL";

    const customerId =
        has(c, "customer_id")
            ? "customer_id"
            : "NULL";

    let pendingWhere = "";

    if (has(c, "status")) {
        pendingWhere = `
            AND LOWER(status)
                IN (
                    'pending',
                    'pending approval'
                )
        `;
    } else if (
        has(c, "approval_status")
    ) {
        pendingWhere = `
            AND LOWER(approval_status)
                IN (
                    'pending',
                    'pending approval'
                )
        `;
    } else {
        /*
         * Older review schema has no moderation state.
         * In that case we still alert once for new reviews.
         */
        pendingWhere = "";
    }

    const [rows] =
        await db.query(
            `
            SELECT
                id,
                ${rating} AS rating,
                ${customerId}
                    AS customer_id,
                created_at
            FROM reviews
            WHERE created_at >=
                DATE_SUB(
                    NOW(),
                    INTERVAL 30 DAY
                )
            ${pendingWhere}
            ORDER BY id DESC
            LIMIT 250
            `
        );

    let inserted = 0;

    for (const review of rows) {
        const result =
            await createNotification({
                notificationType:
                    "CUSTOMER_REVIEW",
                severity:
                    "info",
                title:
                    "Customer review received",
                message:
                    review.rating
                        ? `${review.rating}/5 star review awaiting attention`
                        : "New customer review awaiting attention",
                sourceType:
                    "review",
                sourceId:
                    review.id,
                linkUrl:
                    "/admin/reviews.html",
                icon:
                    "fa-star",
                dedupeKey:
                    `CUSTOMER_REVIEW:${review.id}`
            });

        if (result.inserted) {
            inserted += 1;
        }
    }

    return inserted;
}

async function syncAccountDeletionRequests() {
    const table =
        "customer_account_deletion_requests";

    if (
        !await tableExists(table)
    ) {
        return 0;
    }

    const c =
        await columns(table);

    if (
        !has(c, "id") ||
        !has(c, "customer_id")
    ) {
        return 0;
    }

    const status =
        has(c, "status")
            ? "status"
            : "'Pending'";

    const requestedAt =
        has(c, "requested_at")
            ? "requested_at"
            : has(c, "created_at")
                ? "created_at"
                : "CURRENT_TIMESTAMP";

    const [rows] =
        await db.query(
            `
            SELECT
                id,
                customer_id,
                ${status}
                    AS status,
                ${requestedAt}
                    AS requested_at
            FROM ${table}
            WHERE LOWER(${status}) = 'pending'
            ORDER BY id DESC
            LIMIT 250
            `
        );

    let inserted = 0;

    for (const request of rows) {
        const result =
            await createNotification({
                notificationType:
                    "ACCOUNT_DELETION_REQUEST",
                severity:
                    "warning",
                title:
                    "Account deletion request",
                message:
                    `Customer #${request.customer_id} requested account deletion.`,
                sourceType:
                    "customer_deletion",
                sourceId:
                    request.id,
                linkUrl:
                    `/admin/customers.html?customer=${request.customer_id}`,
                icon:
                    "fa-user-slash",
                dedupeKey:
                    `ACCOUNT_DELETION_REQUEST:${request.id}`
            });

        if (result.inserted) {
            inserted += 1;
        }
    }

    return inserted;
}

async function syncNotificationFailures() {
    if (
        !await tableExists(
            "notification_delivery_logs"
        )
    ) {
        return 0;
    }

    const c =
        await columns(
            "notification_delivery_logs"
        );

    if (
        !has(c, "id") ||
        !has(c, "status")
    ) {
        return 0;
    }

    const errorMessage =
        has(c, "error_message")
            ? "error_message"
            : "NULL";

    const channel =
        has(c, "channel")
            ? "channel"
            : "NULL";

    const createdAt =
        has(c, "created_at")
            ? "created_at"
            : "CURRENT_TIMESTAMP";

    const [rows] =
        await db.query(
            `
            SELECT
                id,
                ${channel}
                    AS channel,
                ${errorMessage}
                    AS error_message,
                ${createdAt}
                    AS created_at
            FROM notification_delivery_logs
            WHERE LOWER(status) = 'failed'
              AND ${createdAt} >=
                    DATE_SUB(
                        NOW(),
                        INTERVAL 14 DAY
                    )
            ORDER BY id DESC
            LIMIT 250
            `
        );

    let inserted = 0;

    for (const log of rows) {
        const result =
            await createNotification({
                notificationType:
                    "NOTIFICATION_FAILED",
                severity:
                    "danger",
                title:
                    "Customer notification failed",
                message:
                    `${log.channel || "Notification"} · ${
                        log.error_message ||
                        "Delivery provider returned an error."
                    }`,
                sourceType:
                    "notification_delivery",
                sourceId:
                    log.id,
                linkUrl:
                    "/admin/notification-center.html",
                icon:
                    "fa-envelope-circle-xmark",
                dedupeKey:
                    `NOTIFICATION_FAILED:${log.id}`
            });

        if (result.inserted) {
            inserted += 1;
        }
    }

    return inserted;
}

// =========================================
// Customer Event Notifications
// =========================================

async function syncCustomerEvents() {
    if (
        !await tableExists(
            "customer_events"
        )
    ) {
        return 0;
    }

    const [rows] =
        await db.query(`
            SELECT
                source.id,
                source.customer_id,
                source.event_type,
                source.event_name,
                source.recurrence,
                source.reminder_days,
                source.remind_by_email,
                source.remind_by_whatsapp,
                source.remind_by_sms,
                source.full_name,

                DATE_FORMAT(
                    source.next_event_date,
                    '%Y-%m-%d'
                ) AS next_event_date,

                DATE_FORMAT(
                    DATE_SUB(
                        source.next_event_date,
                        INTERVAL source.reminder_days DAY
                    ),
                    '%Y-%m-%d'
                ) AS reminder_date,

                DATEDIFF(
                    source.next_event_date,
                    CURDATE()
                ) AS days_until

            FROM (
                SELECT
                    ce.id,
                    ce.customer_id,
                    ce.event_type,
                    ce.event_name,
                    ce.event_date,
                    ce.recurrence,
                    ce.reminder_days,
                    ce.remind_by_email,
                    ce.remind_by_whatsapp,
                    ce.remind_by_sms,
                    c.full_name,

                    CASE
                        WHEN ce.recurrence = 'One Time'
                            THEN ce.event_date

                        WHEN DATE_FORMAT(
                                ce.event_date,
                                '%m-%d'
                             ) >= DATE_FORMAT(
                                CURDATE(),
                                '%m-%d'
                             )
                            THEN STR_TO_DATE(
                                CONCAT(
                                    YEAR(CURDATE()),
                                    '-',
                                    DATE_FORMAT(
                                        ce.event_date,
                                        '%m-%d'
                                    )
                                ),
                                '%Y-%m-%d'
                            )

                        ELSE STR_TO_DATE(
                            CONCAT(
                                YEAR(CURDATE()) + 1,
                                '-',
                                DATE_FORMAT(
                                    ce.event_date,
                                    '%m-%d'
                                )
                            ),
                            '%Y-%m-%d'
                        )
                    END AS next_event_date

                FROM customer_events ce

                INNER JOIN customers c
                    ON c.id =
                        ce.customer_id

                WHERE ce.status =
                    'Active'

                  AND c.deleted_at
                    IS NULL
            ) source

            WHERE source.next_event_date
                    IS NOT NULL

              AND DATE_SUB(
                    source.next_event_date,
                    INTERVAL source.reminder_days DAY
                  ) <= CURDATE()

              AND source.next_event_date
                    >= CURDATE()

            ORDER BY
                source.next_event_date ASC

            LIMIT 250
        `);

    let inserted = 0;

    for (const event of rows) {
        const channels = [];

        if (
            Number(
                event.remind_by_email
            ) === 1
        ) {
            channels.push("Email");
        }

        if (
            Number(
                event.remind_by_whatsapp
            ) === 1
        ) {
            channels.push("WhatsApp");
        }

        if (
            Number(
                event.remind_by_sms
            ) === 1
        ) {
            channels.push("SMS");
        }

        const daysUntil =
            Number(
                event.days_until
            );

        const timingText =
            daysUntil === 0
                ? "is today"
                : daysUntil === 1
                    ? "is tomorrow"
                    : `is in ${daysUntil} days`;

        const result =
            await createNotification({
                notificationType:
                    "CUSTOMER_EVENT_DUE",

                severity:
                    daysUntil <= 1
                        ? "warning"
                        : "info",

                title:
                    "Upcoming customer event",

                message:
                    `${event.event_name} for ${
                        event.full_name ||
                        `Customer #${event.customer_id}`
                    } ${timingText}. Reminder channels: ${
                        channels.length
                            ? channels.join(", ")
                            : "None"
                    }.`,

                sourceType:
                    "customer_event",

                sourceId:
                    event.id,

                linkUrl:
                    `/admin/events.html?event=${event.id}`,

                icon:
                    "fa-calendar-check",

                dedupeKey:
                    `CUSTOMER_EVENT_DUE:${event.id}:${event.next_event_date}`
            });

        if (result.inserted) {
            inserted += 1;
        }
    }

    return inserted;
}

async function performSync() {
    const results =
        await Promise.allSettled([
            syncOrders(),
            syncProducts(),
            syncReviews(),
            syncAccountDeletionRequests(),
            syncCustomerEvents(),
            syncNotificationFailures()
        ]);

    lastSyncAt =
        Date.now();

    return {
        inserted:
            results.reduce(
                (total, result) =>
                    total +
                    (
                        result.status ===
                        "fulfilled"
                            ? Number(
                                result.value ||
                                0
                            )
                            : 0
                    ),
                0
            ),

        failures:
            results
                .filter(
                    result =>
                        result.status ===
                        "rejected"
                )
                .map(
                    result =>
                        result.reason?.message ||
                        String(
                            result.reason
                        )
                )
    };
}

async function sync(options = {}) {
    const force =
        Boolean(options.force);

    const minimumIntervalMs =
        Number(
            options.minimumIntervalMs ||
            30000
        );

    if (
        !force &&
        Date.now() - lastSyncAt <
            minimumIntervalMs
    ) {
        return {
            inserted: 0,
            throttled: true
        };
    }

    if (running) {
        return running;
    }

    running =
        performSync()
            .finally(
                () => {
                    running = null;
                }
            );

    return running;
}

module.exports = {
    sync
};
