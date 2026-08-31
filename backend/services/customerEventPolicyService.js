"use strict";

const {
    isDevelopmentMode,
    getCustomerVerificationMode
} = require(
    "../utils/customerVerificationMode"
);

function truthy(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    );
}

/**
 * Development policy:
 * - contact must exist
 * - verification is bypassed
 * - customer preference is bypassed
 * - loyalty-category channel restriction is bypassed
 *
 * Production policy:
 * - contact must exist
 * - contact must be verified
 * - customer preference must be enabled
 * - loyalty category must allow the channel
 */
function validateChannel({
    channel,
    selected,
    contact,
    verified,
    customerEnabled,
    categoryEnabled,
    membershipLevel
}) {
    if (!truthy(selected)) {
        return {
            valid: true,
            selected: false
        };
    }

    if (!contact) {
        return {
            valid: false,
            selected: true,
            code:
                channel === "Email"
                    ? "EMAIL_REQUIRED"
                    : "PHONE_REQUIRED",
            message:
                channel === "Email"
                    ? "Add an email address before selecting email reminders."
                    : `Add a mobile number before selecting ${channel} reminders.`
        };
    }

    if (isDevelopmentMode()) {
        return {
            valid: true,
            selected: true,
            mode:
                getCustomerVerificationMode()
        };
    }

    if (!truthy(categoryEnabled)) {
        return {
            valid: false,
            selected: true,
            code:
                "CHANNEL_NOT_INCLUDED",
            message:
                `${channel} reminders are not included in the ${membershipLevel || "current"} membership category.`
        };
    }

    if (!truthy(verified)) {
        return {
            valid: false,
            selected: true,
            code:
                channel === "Email"
                    ? "EMAIL_NOT_VERIFIED"
                    : "PHONE_NOT_VERIFIED",
            message:
                channel === "Email"
                    ? "Verify your email before selecting email reminders."
                    : `Verify your mobile number before selecting ${channel} reminders.`
        };
    }

    if (!truthy(customerEnabled)) {
        return {
            valid: false,
            selected: true,
            code:
                "CHANNEL_PREFERENCE_DISABLED",
            message:
                `Enable ${channel} reminders in your account preferences.`
        };
    }

    return {
        valid: true,
        selected: true,
        mode:
            getCustomerVerificationMode()
    };
}

function canUseEventMenu({
    eventMenuEnabled
}) {
    if (isDevelopmentMode()) {
        return {
            valid: true
        };
    }

    if (!truthy(eventMenuEnabled)) {
        return {
            valid: false,
            code:
                "EVENT_MENU_LOCKED",
            message:
                "Special Events are not included in your current membership category."
        };
    }

    return {
        valid: true
    };
}

module.exports = {
    truthy,
    validateChannel,
    canUseEventMenu
};
