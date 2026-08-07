"use strict";

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const allowedEnvironments =
    new Set([
        "development",
        "staging",
        "production"
    ]);

const requestedEnvironment =
    String(
        process.argv[2] ||
        process.env.APP_ENV ||
        "development"
    )
        .trim()
        .toLowerCase();

if (
    !allowedEnvironments.has(
        requestedEnvironment
    )
) {
    console.error(
        `Invalid environment "${requestedEnvironment}".`
    );

    console.error(
        "Use development, staging, or production."
    );

    process.exit(1);
}

const backendRoot =
    path.resolve(
        __dirname,
        ".."
    );

const environmentFile =
    path.join(
        backendRoot,
        `.env.${requestedEnvironment}`
    );

if (
    !fs.existsSync(
        environmentFile
    )
) {
    console.error(
        `Environment file was not found: ${environmentFile}`
    );

    console.error(
        `Create .env.${requestedEnvironment} before starting the application.`
    );

    process.exit(1);
}

const result =
    dotenv.config({
        path:
            environmentFile,

        override:
            true
    });

if (result.error) {
    console.error(
        "Unable to load environment file:",
        result.error.message
    );

    process.exit(1);
}

process.env.APP_ENV =
    requestedEnvironment;

if (
    !process.env.NODE_ENV
) {
    process.env.NODE_ENV =
        requestedEnvironment ===
        "production"
            ? "production"
            : "development";
}

if (
    !process.env.CUSTOMER_VERIFICATION_MODE
) {
    process.env.CUSTOMER_VERIFICATION_MODE =
        requestedEnvironment ===
        "production"
            ? "production"
            : "development";
}

const requiredVariables = [
    "DB_HOST",
    "DB_USER",
    "DB_NAME",
    "JWT_SECRET"
];

const missingVariables =
    requiredVariables.filter(
        variable =>
            !String(
                process.env[variable] ||
                ""
            ).trim()
    );

if (missingVariables.length) {
    console.error(
        `Missing required environment variables in .env.${requestedEnvironment}:`
    );

    missingVariables.forEach(
        variable =>
            console.error(
                `- ${variable}`
            )
    );

    process.exit(1);
}

if (
    requestedEnvironment ===
        "production" &&
    process.env.CUSTOMER_VERIFICATION_MODE !==
        "production"
) {
    console.error(
        "Production must use CUSTOMER_VERIFICATION_MODE=production."
    );

    process.exit(1);
}

if (
    requestedEnvironment ===
        "production" &&
    String(
        process.env.JWT_SECRET
    ).length < 32
) {
    console.error(
        "Production JWT_SECRET must contain at least 32 characters."
    );

    process.exit(1);
}

console.log(
    "========================================"
);

console.log(
    `RUKHNAV environment: ${requestedEnvironment}`
);

console.log(
    `NODE_ENV: ${process.env.NODE_ENV}`
);

console.log(
    `Verification mode: ${process.env.CUSTOMER_VERIFICATION_MODE}`
);

console.log(
    `Database: ${process.env.DB_NAME}`
);

console.log(
    "========================================"
);

require(
    path.join(
        backendRoot,
        "server.js"
    )
);
