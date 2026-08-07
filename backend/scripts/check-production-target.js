"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const environment =
    String(process.argv[2] || "production")
        .trim()
        .toLowerCase();

if (!["staging", "production"].includes(environment)) {
    console.error(
        "Use staging or production."
    );
    process.exit(1);
}

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

const required = [
    "DB_HOST",
    "DB_USER",
    "DB_NAME"
];

const missing =
    required.filter(
        key =>
            !String(
                process.env[key] || ""
            ).trim()
    );

if (missing.length) {
    console.error(
        `Missing database settings: ${missing.join(", ")}`
    );
    process.exit(1);
}

const db =
    require(
        path.join(
            backendRoot,
            "config",
            "db"
        )
    );

async function main() {
    console.log("========================================");
    console.log("RUKHNAV PRODUCTION TARGET CHECK");
    console.log(`Environment: ${environment}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log("========================================");

    await db.query("SELECT 1");

    const [tables] =
        await db.query(
            `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
            ORDER BY table_name
            `,
            [process.env.DB_NAME]
        );

    const tableNames =
        tables.map(
            row =>
                row.TABLE_NAME ||
                row.table_name
        );

    if (tableNames.length === 0) {
        console.log(
            "PASS  Target database is reachable and currently empty."
        );
        console.log(
            "It is ready for the controlled first RUKHNAV import."
        );
        await db.end();
        return;
    }

    console.log(
        `INFO  Target database already contains ${tableNames.length} table(s).`
    );

    const critical =
        new Set([
            "admins",
            "customers",
            "products",
            "orders",
            "sales",
            "invoices"
        ]);

    const rukhnavTables =
        tableNames.filter(
            name =>
                critical.has(name)
        );

    if (rukhnavTables.length) {
        console.error(
            "STOP  Existing RUKHNAV business tables were detected:"
        );

        rukhnavTables.forEach(
            name =>
                console.error(
                    `- ${name}`
                )
        );

        console.error(
            "Do not run the first-import command until you intentionally decide how to handle the existing production data."
        );

        await db.end();
        process.exit(2);
    }

    console.warn(
        "WARN  The database is not empty, but no core RUKHNAV tables were detected."
    );
    console.warn(
        "Review the existing tables before importing."
    );

    tableNames
        .slice(0, 50)
        .forEach(
            name =>
                console.warn(
                    `- ${name}`
                )
        );

    await db.end();
    process.exit(3);
}

main().catch(async error => {
    console.error(
        "Production target check failed:",
        error.message
    );

    try {
        await db.end();
    } catch {}

    process.exit(1);
});
