"use strict";

require("dotenv").config({
    path:
        process.env.NODE_ENV === "production"
            ? ".env.production"
            : ".env.development"
});

const db = require("../config/db");

async function columnExists(
    table,
    column
) {
    const [rows] =
        await db.query(
            `
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
            `,
            [
                table,
                column
            ]
        );

    return rows.length > 0;
}

async function addColumn(
    table,
    column,
    definition
) {
    if (
        await columnExists(
            table,
            column
        )
    ) {
        return;
    }

    await db.query(
        `ALTER TABLE ${table}
         ADD COLUMN ${column} ${definition}`
    );
}

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS notification_queue (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                event_key VARCHAR(100) NOT NULL,
                customer_id INT NULL,
                channel ENUM('Email','WhatsApp','SMS') NOT NULL,
                template_key VARCHAR(100) NULL,
                recipient VARCHAR(190) NOT NULL,
                subject VARCHAR(255) NULL,
                message TEXT NOT NULL,
                payload_json JSON NULL,
                priority TINYINT NOT NULL DEFAULT 5,
                status ENUM(
                    'Queued',
                    'Processing',
                    'Retrying',
                    'Sent',
                    'Failed',
                    'Simulated',
                    'Cancelled',
                    'Skipped'
                ) NOT NULL DEFAULT 'Queued',
                attempt_count INT NOT NULL DEFAULT 0,
                max_attempts INT NOT NULL DEFAULT 3,
                next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                locked_at DATETIME NULL,
                locked_by VARCHAR(120) NULL,
                last_error TEXT NULL,
                provider_message_id VARCHAR(190) NULL,
                processed_at DATETIME NULL,
                dedupe_key VARCHAR(190) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uq_notification_queue_dedupe (
                    dedupe_key
                ),

                INDEX idx_notification_queue_ready (
                    status,
                    next_attempt_at,
                    priority,
                    id
                ),

                INDEX idx_notification_queue_customer (
                    customer_id,
                    created_at
                ),

                INDEX idx_notification_queue_event (
                    event_key,
                    created_at
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS notification_event_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_key VARCHAR(100) NOT NULL,
                channel ENUM('Email','WhatsApp','SMS') NOT NULL,
                template_key VARCHAR(100) NOT NULL,
                enabled TINYINT(1) NOT NULL DEFAULT 1,
                respect_customer_preference TINYINT(1) NOT NULL DEFAULT 1,
                priority TINYINT NOT NULL DEFAULT 5,
                max_attempts INT NOT NULL DEFAULT 3,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uq_notification_event_channel (
                    event_key,
                    channel
                ),

                INDEX idx_notification_rule_enabled (
                    event_key,
                    enabled
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            INSERT INTO notification_event_rules
                (
                    event_key,
                    channel,
                    template_key,
                    enabled,
                    respect_customer_preference,
                    priority,
                    max_attempts
                )
            VALUES
                (
                    'CUSTOMER_REGISTERED',
                    'Email',
                    'welcome_email',
                    1,
                    0,
                    2,
                    3
                ),
                (
                    'ORDER_PLACED',
                    'Email',
                    'order_confirmed_email',
                    1,
                    1,
                    1,
                    3
                ),
                (
                    'ORDER_PLACED',
                    'WhatsApp',
                    'order_confirmed_whatsapp',
                    1,
                    1,
                    2,
                    3
                ),
                (
                    'ORDER_STATUS_CHANGED',
                    'Email',
                    'order_status_email',
                    1,
                    1,
                    2,
                    3
                ),
                (
                    'ORDER_STATUS_CHANGED',
                    'WhatsApp',
                    'order_status_whatsapp',
                    1,
                    1,
                    2,
                    3
                ),
                (
                    'LOYALTY_POINTS_EARNED',
                    'Email',
                    'loyalty_points_email',
                    1,
                    1,
                    4,
                    3
                ),
                (
                    'MEMBERSHIP_UPGRADED',
                    'Email',
                    'membership_upgrade_email',
                    1,
                    1,
                    3,
                    3
                ),
                (
                    'CUSTOMER_EVENT_REMINDER',
                    'Email',
                    'event_reminder_email',
                    1,
                    1,
                    2,
                    3
                ),
                (
                    'CUSTOMER_EVENT_REMINDER',
                    'WhatsApp',
                    'event_reminder_whatsapp',
                    1,
                    1,
                    2,
                    3
                ),
                (
                    'CUSTOMER_EVENT_REMINDER',
                    'SMS',
                    'event_reminder_sms',
                    1,
                    1,
                    3,
                    3
                )
            ON DUPLICATE KEY UPDATE
                template_key =
                    VALUES(template_key)
        `);

        await db.query(`
            INSERT INTO notification_templates
                (
                    template_key,
                    template_name,
                    channel,
                    subject,
                    body,
                    status
                )
            VALUES
                (
                    'order_confirmed_whatsapp',
                    'Order Confirmed WhatsApp',
                    'WhatsApp',
                    NULL,
                    'Hello {{customer_name}}, your RUKHNAV order {{order_number}} for Rs {{grand_total}} has been received.',
                    'Active'
                ),
                (
                    'order_status_email',
                    'Order Status Email',
                    'Email',
                    'Order {{order_number}} is now {{order_status}}',
                    'Hello {{customer_name}}, your order {{order_number}} is now {{order_status}}.',
                    'Active'
                ),
                (
                    'order_status_whatsapp',
                    'Order Status WhatsApp',
                    'WhatsApp',
                    NULL,
                    'RUKHNAV order {{order_number}} is now {{order_status}}.',
                    'Active'
                ),
                (
                    'loyalty_points_email',
                    'Loyalty Points Email',
                    'Email',
                    'You earned {{points}} RUKHNAV points',
                    'Hello {{customer_name}}, you earned {{points}} points. Your available balance is {{available_points}}.',
                    'Active'
                ),
                (
                    'membership_upgrade_email',
                    'Membership Upgrade Email',
                    'Email',
                    'Welcome to RUKHNAV {{membership_level}}',
                    'Congratulations {{customer_name}}. Your membership is now {{membership_level}}.',
                    'Active'
                ),
                (
                    'event_reminder_email',
                    'Event Reminder Email',
                    'Email',
                    'Reminder: {{event_name}}',
                    'Hello {{customer_name}}, {{event_name}} is on {{event_date}}.',
                    'Active'
                ),
                (
                    'event_reminder_sms',
                    'Event Reminder SMS',
                    'SMS',
                    NULL,
                    'RUKHNAV reminder: {{event_name}} is on {{event_date}}.',
                    'Active'
                )
            ON DUPLICATE KEY UPDATE
                template_name =
                    VALUES(template_name)
        `);

        await addColumn(
            "notification_delivery_logs",
            "queue_id",
            "BIGINT NULL AFTER id"
        );

        await addColumn(
            "notification_delivery_logs",
            "event_key",
            "VARCHAR(100) NULL AFTER customer_id"
        );

        await addColumn(
            "notification_delivery_logs",
            "attempt_number",
            "INT NOT NULL DEFAULT 1 AFTER status"
        );

        console.log(
            "Notification Center Part 2 migration completed successfully."
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Notification Center Part 2 migration failed:",
            error
        );

        process.exit(1);
    }
}

run();
