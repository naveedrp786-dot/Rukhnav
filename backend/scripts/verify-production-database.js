"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const environment =
    String(process.argv[2] || "production")
        .trim()
        .toLowerCase();

const backendRoot =
    path.resolve(__dirname, "..");

const envFile =
    path.join(
        backendRoot,
        `.env.${environment}`
    );

if (fs.existsSync(envFile)) {
    dotenv.config({
        path: envFile,
        override: true
    });
}

const db =
    require(
        path.join(
            backendRoot,
            "config",
            "db"
        )
    );

const criticalTables = [
    "admins",
    "customers",
    "products",
    "categories",
    "orders",
    "sales",
    "invoices",
    "company_settings"
];

const optionalBusinessTables = [
    "customer_referrals",
    "customer_rewards",
    "customer_events",
    "reviews",
    "coupons",
    "wishlist",
    "cart"
];

async function tableExists(name) {
    const [rows] =
        await db.query(
            `
            SELECT COUNT(*) AS total
            FROM information_schema.tables
            WHERE table_schema = ?
              AND table_name = ?
            `,
            [
                process.env.DB_NAME,
                name
            ]
        );

    return Number(rows[0]?.total || 0) > 0;
}

async function countRows(name) {
    const safe =
        String(name)
            .replace(/[^a-zA-Z0-9_]/g, "");

    const [rows] =
        await db.query(
            `SELECT COUNT(*) AS total FROM \`${safe}\``
        );

    return Number(rows[0]?.total || 0);
}

async function main() {
    console.log("========================================");
    console.log("RUKHNAV PRODUCTION DATABASE VERIFY");
    console.log(`Environment: ${environment}`);
    console.log(`Database: ${process.env.DB_NAME || "(missing)"}`);
    console.log("========================================");

    await db.query("SELECT 1");

    let failures = 0;

    for (const table of criticalTables) {
        const exists =
            await tableExists(table);

        if (!exists) {
            failures++;
            console.error(
                `FAIL  critical table missing: ${table}`
            );
            continue;
        }

        const count =
            await countRows(table);

        console.log(
            `PASS  ${table}: ${count} row(s)`
        );
    }

    for (const table of optionalBusinessTables) {
        const exists =
            await tableExists(table);

        if (!exists) {
            console.warn(
                `WARN  optional table missing: ${table}`
            );
            continue;
        }

        const count =
            await countRows(table);

        console.log(
            `PASS  ${table}: ${count} row(s)`
        );
    }

    const [[charset]] =
        await db.query(
            `
            SELECT
                @@character_set_database AS character_set,
                @@collation_database AS collation_name,
                VERSION() AS mysql_version
            `
        );

    console.log("----------------------------------------");
    console.log(
        `MySQL: ${charset.mysql_version}`
    );
    console.log(
        `Character set: ${charset.character_set}`
    );
    console.log(
        `Collation: ${charset.collation_name}`
    );
    console.log("========================================");

    if (failures) {
        console.error(
            `Database verification failed: ${failures} critical problem(s).`
        );
        process.exitCode = 1;
    } else {
        console.log(
            "Production database verification passed."
        );
    }

    await db.end();
}

main().catch(async error => {
    console.error(
        "Database verification failed:",
        error.message
    );

    try {
        await db.end();
    } catch {}

    process.exit(1);
});
