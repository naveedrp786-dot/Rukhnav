"use strict";

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

const environment = String(process.argv[2] || "production").trim();
const envPath = path.resolve(__dirname, `../.env.${environment}`);

if (!fs.existsSync(envPath)) {
    console.error(`Environment file not found: ${envPath}`);
    process.exit(1);
}

dotenv.config({ path: envPath, override: true });

const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
for (const key of required) {
    if (!process.env[key]) {
        console.error(`Missing ${key} in .env.${environment}`);
        process.exit(1);
    }
}

const dbConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
};

if (String(process.env.DB_SSL || "").toLowerCase() === "true") {
    dbConfig.ssl = {
        rejectUnauthorized:
            String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
    };
}

async function columnExists(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [process.env.DB_NAME, table, column]
    );
    return rows.length > 0;
}

async function addColumnIfMissing(conn, table, column, definition) {
    if (await columnExists(conn, table, column)) {
        console.log(`✓ ${table}.${column} already exists`);
        return;
    }
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`+ Added ${table}.${column}`);
}

(async () => {
    let conn;
    try {
        console.log(`Connecting to ${process.env.DB_NAME} at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}...`);
        conn = await mysql.createConnection(dbConfig);
        console.log("✓ Database connected");

        await addColumnIfMissing(
            conn,
            "invoices",
            "loyalty_discount",
            "DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `coupon_discount`"
        );
        await addColumnIfMissing(
            conn,
            "invoices",
            "refunded_amount",
            "DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `paid_amount`"
        );
        await addColumnIfMissing(
            conn,
            "invoices",
            "net_paid_amount",
            "DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `refunded_amount`"
        );
        await addColumnIfMissing(
            conn,
            "invoices",
            "refund_status",
            "ENUM('None','Partially Refunded','Refunded') NOT NULL DEFAULT 'None' AFTER `payment_status`"
        );

        await conn.query(`
            ALTER TABLE invoices
            MODIFY COLUMN payment_status
            ENUM('Pending','Partial','Paid','Partially Refunded','Refunded')
            NOT NULL DEFAULT 'Pending'
        `);
        console.log("✓ invoices.payment_status supports refund states");

        await conn.query(`
            ALTER TABLE sales
            MODIFY COLUMN payment_status
            ENUM('Pending','Partial','Paid','Partially Refunded','Refunded')
            NOT NULL DEFAULT 'Pending'
        `);
        console.log("✓ sales.payment_status supports refund states");

        await conn.query(`
            UPDATE invoices
            SET
                paid_amount = GREATEST(COALESCE(paid_amount,0), 0),
                refunded_amount = GREATEST(COALESCE(refunded_amount,0), 0),
                net_paid_amount = GREATEST(
                    COALESCE(paid_amount,0) - GREATEST(COALESCE(refunded_amount,0),0),
                    0
                ),
                balance_amount = GREATEST(
                    COALESCE(grand_total,0) - GREATEST(COALESCE(paid_amount,0),0),
                    0
                ),
                refund_status = CASE
                    WHEN GREATEST(COALESCE(refunded_amount,0),0) <= 0 THEN 'None'
                    WHEN GREATEST(COALESCE(refunded_amount,0),0) >= GREATEST(COALESCE(paid_amount,0),0)
                         AND GREATEST(COALESCE(paid_amount,0),0) > 0 THEN 'Refunded'
                    ELSE 'Partially Refunded'
                END
        `);
        console.log("✓ Existing invoice financial values normalized");

        const [rows] = await conn.query(`
            SELECT
                id,
                invoice_number,
                grand_total,
                paid_amount,
                refunded_amount,
                net_paid_amount,
                balance_amount,
                payment_status,
                refund_status
            FROM invoices
            ORDER BY id DESC
            LIMIT 10
        `);

        console.table(rows);
        console.log("\nPART 1 DATABASE MIGRATION COMPLETE");
    } catch (error) {
        console.error("\nMigration failed:", error.message);
        process.exitCode = 1;
    } finally {
        if (conn) await conn.end();
    }
})();
