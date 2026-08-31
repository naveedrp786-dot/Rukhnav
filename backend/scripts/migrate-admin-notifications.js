"use strict";

require("dotenv").config();

const db = require("../config/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_notifications (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                notification_type VARCHAR(80) NOT NULL,
                severity ENUM(
                    'info',
                    'success',
                    'warning',
                    'danger'
                ) NOT NULL DEFAULT 'info',
                title VARCHAR(180) NOT NULL,
                message VARCHAR(700) NULL,
                source_type VARCHAR(80) NULL,
                source_id BIGINT NULL,
                link_url VARCHAR(500) NULL,
                icon VARCHAR(80) NULL,
                dedupe_key VARCHAR(190) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uq_admin_notifications_dedupe (
                    dedupe_key
                ),

                INDEX idx_admin_notifications_created (
                    created_at
                ),

                INDEX idx_admin_notifications_type (
                    notification_type,
                    created_at
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_notification_reads (
                notification_id BIGINT NOT NULL,
                admin_id BIGINT NOT NULL,
                read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                PRIMARY KEY (
                    notification_id,
                    admin_id
                ),

                INDEX idx_admin_notification_reads_admin (
                    admin_id,
                    read_at
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        console.log(
            "Admin live-notification tables are ready."
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Admin notification migration failed:",
            error
        );

        process.exit(1);
    }
}

run();
