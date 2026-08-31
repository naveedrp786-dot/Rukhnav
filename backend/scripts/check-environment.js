"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const environment =
    String(
        process.argv[2] ||
        "development"
    )
        .trim()
        .toLowerCase();

const allowed =
    new Set([
        "development",
        "staging",
        "production"
    ]);

if (!allowed.has(environment)) {
    console.error(
        "Use development, staging, or production."
    );

    process.exit(1);
}

const filePath =
    path.resolve(
        __dirname,
        "..",
        `.env.${environment}`
    );

if (!fs.existsSync(filePath)) {
    console.error(
        `Missing ${filePath}`
    );

    process.exit(1);
}

const values =
    dotenv.parse(
        fs.readFileSync(filePath)
    );

const required = [
    "NODE_ENV",
    "CUSTOMER_VERIFICATION_MODE",
    "DB_HOST",
    "DB_USER",
    "DB_NAME",
    "JWT_SECRET",
    "PORT"
];

const missing =
    required.filter(
        key =>
            !String(
                values[key] ||
                ""
            ).trim()
    );

if (missing.length) {
    console.error(
        `Environment check failed for ${environment}.`
    );

    missing.forEach(
        key =>
            console.error(
                `Missing: ${key}`
            )
    );

    process.exit(1);
}

if (
    environment ===
        "production" &&
    values.NODE_ENV !==
        "production"
) {
    console.error(
        "Production NODE_ENV must equal production."
    );

    process.exit(1);
}

if (
    environment ===
        "production" &&
    values.CUSTOMER_VERIFICATION_MODE !==
        "production"
) {
    console.error(
        "Production verification mode must equal production."
    );

    process.exit(1);
}

if (
    environment !==
        "production" &&
    values.CUSTOMER_VERIFICATION_MODE !==
        "development"
) {
    console.warn(
        `${environment} is configured to enforce production verification.`
    );
}

if (
    environment ===
        "production" &&
    String(
        values.JWT_SECRET
    ).length < 32
) {
    console.error(
        "Production JWT_SECRET must contain at least 32 characters."
    );

    process.exit(1);
}

console.log(
    `Environment check passed: ${environment}`
);

console.log({
    NODE_ENV:
        values.NODE_ENV,

    CUSTOMER_VERIFICATION_MODE:
        values.CUSTOMER_VERIFICATION_MODE,

    DB_HOST:
        values.DB_HOST,

    DB_NAME:
        values.DB_NAME,

    PORT:
        values.PORT
});
