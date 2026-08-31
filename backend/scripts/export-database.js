"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const environment =
    String(process.argv[2] || "development")
        .trim()
        .toLowerCase();

const allowed =
    new Set(["development", "staging", "production"]);

if (!allowed.has(environment)) {
    console.error(
        "Use development, staging, or production."
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

const backupDir =
    path.join(
        backendRoot,
        "backups"
    );

fs.mkdirSync(
    backupDir,
    { recursive: true }
);

const stamp =
    new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

const outputPath =
    path.join(
        backupDir,
        `${process.env.DB_NAME}-${environment}-${stamp}.sql`
    );

const args = [
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--set-gtid-purged=OFF",
    "-h",
    process.env.DB_HOST,
    "-P",
    String(process.env.DB_PORT || 3306),
    "-u",
    process.env.DB_USER,
    "--default-character-set=utf8mb4",
    process.env.DB_NAME
];

console.log(
    `Exporting ${environment} database "${process.env.DB_NAME}"...`
);

const child =
    spawn(
        "mysqldump",
        args,
        {
            env: {
                ...process.env,
                MYSQL_PWD:
                    process.env.DB_PASSWORD || ""
            },
            stdio: [
                "ignore",
                "pipe",
                "inherit"
            ]
        }
    );

const output =
    fs.createWriteStream(
        outputPath,
        {
            flags: "wx"
        }
    );

child.stdout.pipe(output);

child.on("error", error => {
    console.error(
        "Unable to run mysqldump:",
        error.message
    );
    process.exit(1);
});

child.on("exit", code => {
    output.end();

    if (code !== 0) {
        try {
            fs.unlinkSync(outputPath);
        } catch {}

        console.error(
            `Database export failed with code ${code}.`
        );
        process.exit(code || 1);
    }

    const size =
        fs.statSync(outputPath).size;

    if (size < 100) {
        console.error(
            "Database export looks unexpectedly small."
        );
        process.exit(1);
    }

    console.log("========================================");
    console.log("RUKHNAV DATABASE EXPORT COMPLETE");
    console.log(`Environment: ${environment}`);
    console.log(`File: ${outputPath}`);
    console.log(`Size: ${size} bytes`);
    console.log("========================================");
});
