"use strict";

const fs = require("fs");
const path = require("path");

const controllerPath =
    path.resolve(
        __dirname,
        "../controllers/customerController.js"
    );

if (!fs.existsSync(controllerPath)) {
    throw new Error(
        `customerController.js was not found at ${controllerPath}`
    );
}

let source =
    fs.readFileSync(
        controllerPath,
        "utf8"
    );

const backupPath =
    `${controllerPath}.before-verification-mode`;

if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(
        controllerPath,
        backupPath
    );
}

const importLine = `
const {
    shouldEnforceCustomerVerification,
    getCustomerVerificationMode
} = require("../utils/customerVerificationMode");
`;

if (
    !source.includes(
        'require("../utils/customerVerificationMode")'
    )
) {
    const useStrictMatch =
        source.match(
            /^["']use strict["'];?\s*/m
        );

    if (useStrictMatch) {
        const index =
            useStrictMatch.index +
            useStrictMatch[0].length;

        source =
            source.slice(0, index) +
            importLine +
            source.slice(index);
    } else {
        source =
            importLine +
            source;
    }
}

const verificationBlockPattern =
    /(\s*\/\/ =================================\s*\n\s*\/\/ Check Login-Identifier Verification\s*\n\s*\/\/ =================================\s*\n\s*const identifierVerified =[\s\S]*?\n\s*if\s*\(!identifierVerified\)\s*\{[\s\S]*?\n\s*\}\s*)/m;

const verificationReplacement = `
        // =================================
        // Check Login-Identifier Verification
        // =================================

        const identifierVerified =
            isEmailLogin
                ? Boolean(
                    customer.email_verified_at
                )
                : Boolean(
                    customer.phone_verified_at
                );

        if (
            shouldEnforceCustomerVerification() &&
            !identifierVerified
        ) {
            return res.status(403).json({
                success: false,
                verificationRequired: true,

                identifierType:
                    isEmailLogin
                        ? "Email"
                        : "Phone",

                verificationMethod:
                    isEmailLogin
                        ? "email"
                        : "phone",

                identifier:
                    isEmailLogin
                        ? customer.email
                        : customer.phone,

                message:
                    isEmailLogin
                        ? "Please verify your email address before logging in."
                        : "Please verify your phone number before logging in."
            });
        }
`;

if (
    !source.includes(
        "shouldEnforceCustomerVerification() &&"
    )
) {
    if (
        !verificationBlockPattern.test(source)
    ) {
        throw new Error(
            "The login identifier verification block was not found. No changes were written."
        );
    }

    source =
        source.replace(
            verificationBlockPattern,
            verificationReplacement
        );
}

const pendingStatusPattern =
    /if\s*\(\s*customer\.status\s*===\s*["']Pending Verification["']\s*\)\s*\{[\s\S]*?verificationRequired:\s*true,[\s\S]*?["']Please verify your account before logging in\.["'][\s\S]*?\n\s*\}/m;

const pendingStatusReplacement = `
        if (
            shouldEnforceCustomerVerification() &&
            customer.status ===
            "Pending Verification"
        ) {
            return res.status(403).json({
                success: false,
                verificationRequired: true,
                message:
                    "Please verify your account before logging in."
            });
        }
`;

if (
    !source.includes(
        'shouldEnforceCustomerVerification() &&\n            customer.status ==='
    )
) {
    if (
        !pendingStatusPattern.test(source)
    ) {
        throw new Error(
            "The Pending Verification status block was not found. No changes were written."
        );
    }

    source =
        source.replace(
            pendingStatusPattern,
            pendingStatusReplacement
        );
}

const successMarker =
    "Customer logged in successfully.";

if (
    source.includes(successMarker) &&
    !source.includes(
        "verificationMode:"
    )
) {
    const successResponsePattern =
        /(return\s+res\.status\(200\)\.json\(\{\s*[\s\S]*?success:\s*true,\s*[\s\S]*?message:\s*["']Customer logged in successfully\.["'],)/m;

    if (
        successResponsePattern.test(source)
    ) {
        source =
            source.replace(
                successResponsePattern,
                `$1

            verificationMode:
                getCustomerVerificationMode(),

            verification: {
                emailVerified:
                    Boolean(
                        customer.email_verified_at
                    ),

                phoneVerified:
                    Boolean(
                        customer.phone_verified_at
                    ),

                enforcementEnabled:
                    shouldEnforceCustomerVerification()
            },`
            );
    }
}

fs.writeFileSync(
    controllerPath,
    source,
    "utf8"
);

console.log(
    "Customer verification mode patch applied successfully."
);

console.log(
    `Backup created at: ${backupPath}`
);
