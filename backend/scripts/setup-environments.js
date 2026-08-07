#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot =
    path.resolve(
        __dirname,
        ".."
    );

const legacyEnv =
    path.join(
        backendRoot,
        ".env"
    );

const developmentEnv =
    path.join(
        backendRoot,
        ".env.development"
    );

if (
    fs.existsSync(legacyEnv) &&
    !fs.existsSync(developmentEnv)
) {
    let content =
        fs.readFileSync(
            legacyEnv,
            "utf8"
        );

    const upsert = (
        source,
        key,
        value
    ) => {
        const expression =
            new RegExp(
                `^${key}=.*$`,
                "m"
            );

        if (
            expression.test(source)
        ) {
            return source.replace(
                expression,
                `${key}=${value}`
            );
        }

        return (
            source.trimEnd() +
            `\n${key}=${value}\n`
        );
    };

    content =
        upsert(
            content,
            "NODE_ENV",
            "development"
        );

    content =
        upsert(
            content,
            "CUSTOMER_VERIFICATION_MODE",
            "development"
        );

    fs.writeFileSync(
        developmentEnv,
        content,
        "utf8"
    );

    console.log(
        "Created .env.development from the existing .env file."
    );
} else if (
    fs.existsSync(developmentEnv)
) {
    console.log(
        ".env.development already exists; no changes made."
    );
} else {
    console.log(
        "No existing .env file was found."
    );

    console.log(
        "Copy .env.development.example to .env.development and add your credentials."
    );
}

console.log(
    "Never commit .env.development, .env.staging, or .env.production."
);
