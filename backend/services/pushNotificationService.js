"use strict";

const db = require("../config/db");

const EXPO_PUSH_URL =
    "https://exp.host/--/api/v2/push/send";

function cleanText(value, maxLength = 500) {
    return String(value || "")
        .trim()
        .slice(0, maxLength);
}

function isExpoPushToken(value) {
    const token = String(value || "").trim();

    return (
        token.startsWith("ExponentPushToken[") ||
        token.startsWith("ExpoPushToken[")
    );
}

async function deactivateToken(token) {
    if (!token) {
        return;
    }

    await db.query(
        `
        UPDATE customer_push_devices
        SET
            is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE expo_push_token = ?
        `,
        [token]
    );
}

async function sendPush({
    to,
    title,
    message,
    data = {},
    sound = "default",
    priority = "default"
}) {
    const token = cleanText(to, 255);

    if (!isExpoPushToken(token)) {
        await deactivateToken(token);

        throw new Error(
            "Invalid Expo push token."
        );
    }

    const payload = {
        to: token,
        title:
            cleanText(
                title || "RUKHNAV",
                180
            ) || "RUKHNAV",
        body:
            cleanText(
                message,
                3000
            ),
        data:
            data &&
            typeof data === "object"
                ? data
                : {},
        sound,
        priority:
            priority === "high"
                ? "high"
                : "default"
    };

    const response = await fetch(
        EXPO_PUSH_URL,
        {
            method: "POST",
            headers: {
                "Accept":
                    "application/json",
                "Accept-Encoding":
                    "gzip, deflate",
                "Content-Type":
                    "application/json"
            },
            body:
                JSON.stringify(payload)
        }
    );

    let responseData = null;

    try {
        responseData =
            await response.json();
    } catch {
        responseData = null;
    }

    if (!response.ok) {
        const detail =
            responseData?.errors?.[0]?.message ||
            responseData?.message ||
            `HTTP ${response.status}`;

        throw new Error(
            `Expo push delivery failed: ${detail}`
        );
    }

    const ticket =
        Array.isArray(responseData?.data)
            ? responseData.data[0]
            : responseData?.data;

    if (!ticket) {
        throw new Error(
            "Expo push service returned no delivery ticket."
        );
    }

    if (ticket.status === "error") {
        const expoError =
            ticket.details?.error ||
            "ExpoPushError";

        if (
            expoError ===
            "DeviceNotRegistered"
        ) {
            await deactivateToken(
                token
            );
        }

        const messageText =
            ticket.message ||
            expoError;

        /*
         * DeviceNotRegistered is permanent.
         * Prefix it so the queue worker can later
         * distinguish it from transient failures.
         */
        if (
            expoError ===
            "DeviceNotRegistered"
        ) {
            throw new Error(
                `PUSH_PERMANENT: ${messageText}`
            );
        }

        throw new Error(
            `Expo push delivery failed: ${messageText}`
        );
    }

    return {
        success: true,
        simulated: false,
        providerMessageId:
            ticket.id || null
    };
}

module.exports = {
    sendPush,
    deactivateToken,
    isExpoPushToken
};
