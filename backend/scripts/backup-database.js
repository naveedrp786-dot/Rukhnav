"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const environment =
    String(process.argv[2] || "development")
        .trim()
        .toLowerCase();

const backendRoot =
    path.resolve(__dirname, "..");

const envPath =
    path.join(
        backendRoot,
        `.env.${environment}`
    );

if (fs.existsSync(envPath)) {
    dotenv.config({
        path: envPath,
        override: true
    });
} else {
    dotenv.config({
        path: path.join(backendRoot, ".env")
    });
}

const required = [
    "DB_HOST",
    "DB_USER",
    "DB_NAME"
];

const missing = required.filter(
    key =>
        !String(process.env[key] || "").trim()
);

if (missing.length) {
    console.error(
        `Cannot create backup. Missing: ${missing.join(", ")}`
    );
    process.exit(1);
}

const backupDirectory =
    path.resolve(
        process.env.BACKUP_ROOT ||
        path.join(backendRoot, "backups")
    );

fs.mkdirSync(backupDirectory, {
    recursive: true
});

const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const outputPath =
    path.join(
        backupDirectory,
        `${process.env.DB_NAME}-${environment}-${stamp}.sql`
    );

const args = [
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--host",
    process.env.DB_HOST,
    "--port",
    String(process.env.DB_PORT || 3306),
    "--user",
    process.env.DB_USER,
    process.env.DB_NAME
];

const output =
    fs.createWriteStream(outputPath);

const child = spawn(
    "mysqldump",
    args,
    {
        env: {
            ...process.env,
            MYSQL_PWD:
                process.env.DB_PASSWORD || ""
        },
        stdio: ["ignore", "pipe", "pipe"]
    }
);

child.stdout.pipe(output);

let errorOutput = "";
child.stderr.on("data", chunk => {
    errorOutput += chunk.toString();
});

child.on("error", error => {
    output.close();

    try {
        fs.unlinkSync(outputPath);
    } catch {}

    console.error(
        "Unable to run mysqldump:",
        error.message
    );
    process.exit(1);
});

child.on("close", code => {
    output.close();

    if (code !== 0) {
        try {
            fs.unlinkSync(outputPath);
        } catch {}

        console.error("Database backup failed.");
        if (errorOutput.trim()) {
            console.error(errorOutput.trim());
        }
        process.exit(code || 1);
    }

    console.log("Database backup created:");
    console.log(outputPath);
});
