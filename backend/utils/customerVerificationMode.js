"use strict";

function getCustomerVerificationMode() {
    const value =
        String(
            process.env.CUSTOMER_VERIFICATION_MODE ||
            "production"
        )
            .trim()
            .toLowerCase();

    return value === "development"
        ? "development"
        : "production";
}

function isDevelopmentMode() {
    return (
        getCustomerVerificationMode() ===
        "development"
    );
}

function shouldEnforceCustomerVerification() {
    return !isDevelopmentMode();
}

module.exports = {
    getCustomerVerificationMode,
    isDevelopmentMode,
    shouldEnforceCustomerVerification
};
