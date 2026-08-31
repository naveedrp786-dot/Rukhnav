"use strict";

const crypto = require("crypto");

const bytes =
    Number(process.argv[2] || 48);

if (
    !Number.isInteger(bytes) ||
    bytes < 32 ||
    bytes > 256
) {
    console.error(
        "Usage: node scripts/generate-production-secret.js [bytes]"
    );
    console.error(
        "Bytes must be an integer between 32 and 256."
    );
    process.exit(1);
}

const jwtSecret =
    crypto
        .randomBytes(bytes)
        .toString("base64url");

console.log("========================================");
console.log("RUKHNAV PRODUCTION SECRET");
console.log("========================================");
console.log(jwtSecret);
console.log("========================================");
console.log(
    "Store this only in the hosting provider's secret/environment settings."
);
console.log(
    "Do not commit it to Git and do not put it in frontend JavaScript."
);
