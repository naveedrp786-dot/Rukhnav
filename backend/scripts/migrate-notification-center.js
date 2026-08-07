"use strict";

require("dotenv").config({
    path: process.env.NODE_ENV === "production"
        ? ".env.production"
        : ".env.development"
});

const db = require("../config/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS notification_channel_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel ENUM('Email','WhatsApp','SMS') NOT NULL UNIQUE,
                enabled TINYINT(1) NOT NULL DEFAULT 0,
                provider VARCHAR(80) NULL,
                simulation_mode TINYINT(1) NOT NULL DEFAULT 1,
                from_name VARCHAR(150) NULL,
                from_address VARCHAR(190) NULL,
                updated_by_admin_id INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_notification_channel_enabled (channel, enabled)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            INSERT INTO notification_channel_settings
                (channel, enabled, provider, simulation_mode, from_name, from_address)
            VALUES
                ('Email', 0, 'SMTP', 1, 'RUKHNAV', NULL),
                ('WhatsApp', 0, 'Twilio', 1, 'RUKHNAV', NULL),
                ('SMS', 0, 'Twilio', 1, 'RUKHNAV', NULL)
            ON DUPLICATE KEY UPDATE channel = VALUES(channel)
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS notification_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_key VARCHAR(100) NOT NULL UNIQUE,
                template_name VARCHAR(150) NOT NULL,
                channel ENUM('Email','WhatsApp','SMS') NOT NULL,
                subject VARCHAR(255) NULL,
                body TEXT NOT NULL,
                status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                updated_by_admin_id INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_notification_template_channel_status (channel, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            INSERT INTO notification_templates
                (template_key, template_name, channel, subject, body, status)
            VALUES
                ('welcome_email', 'Welcome Email', 'Email', 'Welcome to RUKHNAV', 'Hello {{customer_name}}, welcome to RUKHNAV.', 'Active'),
                ('order_confirmed_email', 'Order Confirmed Email', 'Email', 'Order {{order_number}} confirmed', 'Hello {{customer_name}}, your order {{order_number}} has been confirmed.', 'Active'),
                ('event_reminder_whatsapp', 'Event Reminder WhatsApp', 'WhatsApp', NULL, 'Reminder: {{event_name}} is on {{event_date}}.', 'Active'),
                ('otp_sms', 'OTP SMS', 'SMS', NULL, 'Your RUKHNAV verification code is {{otp}}.', 'Active')
            ON DUPLICATE KEY UPDATE template_name = VALUES(template_name)
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS notification_delivery_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NULL,
                channel ENUM('Email','WhatsApp','SMS') NOT NULL,
                template_key VARCHAR(100) NULL,
                recipient VARCHAR(190) NOT NULL,
                subject VARCHAR(255) NULL,
                message TEXT NOT NULL,
                status ENUM('Queued','Sent','Failed','Simulated') NOT NULL DEFAULT 'Queued',
                provider VARCHAR(80) NULL,
                provider_message_id VARCHAR(190) NULL,
                error_message TEXT NULL,
                sent_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notification_log_channel_status (channel, status),
                INDEX idx_notification_log_customer (customer_id),
                INDEX idx_notification_log_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log("Notification Center migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Notification Center migration failed:", error);
        process.exit(1);
    }
}

run();
