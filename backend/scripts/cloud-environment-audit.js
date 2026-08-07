"use strict";

const required = [
    "NODE_ENV",
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET",
    "CORS_ORIGINS",
    "UPLOAD_ROOT"
];

const recommended = [
    "APP_ENV",
    "DB_PORT",
    "DB_SSL",
    "CUSTOMER_VERIFICATION_MODE",
    "APP_TIMEZONE",
    "EVENT_REMINDER_TIMEZONE"
];

function present(key) {
    return Boolean(
        String(process.env[key] || "").trim()
    );
}

let failures = 0;

console.log("========================================");
console.log("RUKHNAV CLOUD ENVIRONMENT AUDIT");
console.log("========================================");

for (const key of required) {
    const ok = present(key);

    console.log(
        `${ok ? "PASS" : "FAIL"}  ${key}`
    );

    if (!ok) failures++;
}

for (const key of recommended) {
    console.log(
        `${present(key) ? "PASS" : "WARN"}  ${key}`
    );
}

if (
    present("NODE_ENV") &&
    process.env.NODE_ENV !== "production"
) {
    console.error(
        "FAIL  NODE_ENV must equal production."
    );
    failures++;
}

if (
    present("JWT_SECRET") &&
    String(process.env.JWT_SECRET).length < 32
) {
    console.error(
        "FAIL  JWT_SECRET must be at least 32 characters."
    );
    failures++;
}

if (
    present("UPLOAD_ROOT") &&
    !String(process.env.UPLOAD_ROOT)
        .startsWith("/")
) {
    console.warn(
        "WARN  UPLOAD_ROOT should normally be an absolute path on Linux."
    );
}

console.log("========================================");

if (failures) {
    console.error(
        `Environment audit failed: ${failures} problem(s).`
    );
    process.exit(1);
}

console.log("Cloud environment audit passed.");
