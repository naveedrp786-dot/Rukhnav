"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const backendRoot =
    path.resolve(__dirname, "..");

const environment =
    String(process.argv[2] || "production")
        .trim()
        .toLowerCase();

const envPath =
    path.join(
        backendRoot,
        `.env.${environment}`
    );

if (fs.existsSync(envPath)) {
    dotenv.config({
        path: envPath,
        override: false
    });
}

const required = [
    "DB_HOST",
    "DB_USER",
    "DB_NAME",
    "JWT_SECRET"
];

const missing = required.filter(
    key =>
        !String(process.env[key] || "").trim()
);

if (missing.length) {
    console.error("Production readiness: FAILED");
    missing.forEach(
        key => console.error(`Missing ${key}`)
    );
    process.exit(1);
}

if (
    environment === "production" &&
    String(process.env.JWT_SECRET).length < 32
) {
    console.error(
        "Production readiness: JWT_SECRET must be at least 32 characters."
    );
    process.exit(1);
}

if (
    environment === "production" &&
    !String(process.env.CORS_ORIGINS || "").trim()
) {
    console.error(
        "Production readiness: CORS_ORIGINS is required."
    );
    process.exit(1);
}

const db = require("../config/db");
const {
    verifyUploadStorage,
    uploadRoot
} = require("../config/storage");

(async () => {
    try {
        await db.query("SELECT 1 AS ok");
        verifyUploadStorage();

        console.log("========================================");
        console.log("RUKHNAV PRODUCTION READINESS: PASSED");
        console.log(`Environment: ${environment}`);
        console.log(`Database: ${process.env.DB_NAME}`);
        console.log(`Upload storage: ${uploadRoot}`);
        console.log("Database connectivity: OK");
        console.log("Upload storage writable: OK");
        console.log("Required secrets present: OK");
        console.log("========================================");

        process.exit(0);
    } catch (error) {
        console.error("Production readiness: FAILED");
        console.error(error.message);
        process.exit(1);
    }
})();
