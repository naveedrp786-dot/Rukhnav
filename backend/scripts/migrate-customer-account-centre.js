"use strict";

require("dotenv").config();
const db = require("../config/db");

async function columnExists(
    connection,
    table,
    column
) {
    const [rows] =
        await connection.query(
            `
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
            `,
            [table, column]
        );

    return rows.length > 0;
}

async function addColumn(
    connection,
    table,
    column,
    definition
) {
    if (
        await columnExists(
            connection,
            table,
            column
        )
    ) {
        return;
    }

    await connection.query(
        `
        ALTER TABLE ${table}
        ADD COLUMN ${column} ${definition}
        `
    );

    console.log(
        `Added ${table}.${column}`
    );
}

async function run() {
    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_addresses (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                customer_id BIGINT NOT NULL,
                address_type VARCHAR(30) NOT NULL DEFAULT 'Home',
                full_name VARCHAR(150) NOT NULL,
                phone VARCHAR(40) NOT NULL,
                address_line1 VARCHAR(255) NOT NULL,
                address_line2 VARCHAR(255) NULL,
                city VARCHAR(120) NOT NULL,
                province VARCHAR(120) NULL,
                postal_code VARCHAR(30) NULL,
                country VARCHAR(120) NOT NULL DEFAULT 'Pakistan',
                delivery_instructions VARCHAR(500) NULL,
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer_addresses_customer (
                    customer_id,
                    is_default
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await addColumn(
            connection,
            "customer_addresses",
            "delivery_instructions",
            "VARCHAR(500) NULL"
        );

        await addColumn(
            connection,
            "customer_addresses",
            "is_default",
            "TINYINT(1) NOT NULL DEFAULT 0"
        );

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_coupon_redemptions (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                customer_id BIGINT NOT NULL,
                coupon_id BIGINT NOT NULL,
                order_id BIGINT NULL,
                discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                status VARCHAR(30) NOT NULL DEFAULT 'Used',
                redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_coupon_redemption_customer (
                    customer_id,
                    redeemed_at
                ),
                INDEX idx_coupon_redemption_coupon (
                    coupon_id
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS customer_security_activity (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                customer_id BIGINT NOT NULL,
                activity_type VARCHAR(60) NOT NULL,
                ip_address VARCHAR(100) NULL,
                user_agent VARCHAR(500) NULL,
                details VARCHAR(500) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_customer_security_activity (
                    customer_id,
                    created_at
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        const [sessionTables] =
            await connection.query(
                `
                SELECT 1
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'customer_sessions'
                LIMIT 1
                `
            );

        if (sessionTables.length) {
            await addColumn(
                connection,
                "customer_sessions",
                "ip_address",
                "VARCHAR(100) NULL"
            );

            await addColumn(
                connection,
                "customer_sessions",
                "user_agent",
                "VARCHAR(500) NULL"
            );

            await addColumn(
                connection,
                "customer_sessions",
                "last_used_at",
                "DATETIME NULL"
            );

            await addColumn(
                connection,
                "customer_sessions",
                "revoked_at",
                "DATETIME NULL"
            );
        }

        await connection.commit();

        console.log(
            "Customer Account Centre module tables are ready."
        );

        process.exit(0);
    } catch (error) {
        await connection.rollback();

        console.error(
            "Customer Account Centre migration failed:",
            error
        );

        process.exit(1);
    } finally {
        connection.release();
    }
}

run();
