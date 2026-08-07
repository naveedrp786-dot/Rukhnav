"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const environment =
    String(process.argv[2] || "")
        .trim()
        .toLowerCase();

const sqlArgument =
    process.argv[3];

if (!["staging", "production"].includes(environment)) {
    console.error(
        "Import is allowed only for staging or production."
    );
    console.error(
        "Usage: node scripts/import-database.js production /path/to/backup.sql"
    );
    process.exit(1);
}

if (!sqlArgument) {
    console.error(
        "SQL backup path is required."
    );
    process.exit(1);
}

const sqlPath =
    path.resolve(
        process.cwd(),
        sqlArgument
    );

if (
    !fs.existsSync(sqlPath) ||
    !fs.statSync(sqlPath).isFile()
) {
    console.error(
        `SQL file not found: ${sqlPath}`
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

if (environment === "production") {
    const confirmation =
        String(
            process.env.RUKHNAV_ALLOW_PRODUCTION_IMPORT ||
            ""
        ).toLowerCase();

    if (confirmation !== "yes") {
        console.error(
            "Production import is locked."
        );
        console.error(
            "Set RUKHNAV_ALLOW_PRODUCTION_IMPORT=yes for this one controlled import."
        );
        process.exit(1);
    }
}

console.log("========================================");
console.log("RUKHNAV DATABASE IMPORT");
console.log(`Environment: ${environment}`);
console.log(`Database: ${process.env.DB_NAME}`);
console.log(`Source: ${sqlPath}`);
console.log("========================================");

const args = [
    "-h",
    process.env.DB_HOST,
    "-P",
    String(process.env.DB_PORT || 3306),
    "-u",
    process.env.DB_USER,
    "--default-character-set=utf8mb4",
    process.env.DB_NAME
];

const child =
    spawn(
        "mysql",
        args,
        {
            env: {
                ...process.env,
                MYSQL_PWD:
                    process.env.DB_PASSWORD || ""
            },
            stdio: [
                fs.openSync(sqlPath, "r"),
                "inherit",
                "inherit"
            ]
        }
    );

child.on("error", error => {
    console.error(
        "Unable to run mysql client:",
        error.message
    );
    process.exit(1);
});

child.on("exit", code => {
    if (code !== 0) {
        console.error(
            `Database import failed with code ${code}.`
        );
        process.exit(code || 1);
    }

    console.log(
        "RUKHNAV database import completed successfully."
    );
});
