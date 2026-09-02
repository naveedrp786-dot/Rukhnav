"use strict";

const db = require("../config/db");

function getCustomerId(req) {
    return Number(
        req.user?.id ||
        req.user?.customerId ||
        0
    );
}

function cleanText(value, maxLength = 255) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value).trim();

    if (!text) {
        return null;
    }

    return text.slice(0, maxLength);
}

function isExpoPushToken(value) {
    const token = String(value || "").trim();

    return (
        token.startsWith("ExponentPushToken[") ||
        token.startsWith("ExpoPushToken[")
    );
}

// =========================================
// Register / Refresh Push Device
// =========================================

exports.registerDevice = async (req, res) => {
    try {
        const customerId = getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        const expoPushToken =
            cleanText(req.body.expo_push_token, 255);

        const platform =
            cleanText(req.body.platform, 20)?.toLowerCase();

        const deviceName =
            cleanText(req.body.device_name, 190);

        const deviceId =
            cleanText(req.body.device_id, 190);

        if (!expoPushToken ||
            !isExpoPushToken(expoPushToken)) {
            return res.status(400).json({
                success: false,
                message: "A valid Expo push token is required."
            });
        }

        if (!["android", "ios"].includes(platform)) {
            return res.status(400).json({
                success: false,
                message: "Platform must be android or ios."
            });
        }

        /*
         * A token belongs to one active customer at a time.
         * If the same physical app installation signs into a
         * different account, ownership follows the new session.
         */
        await db.query(
            `
            INSERT INTO customer_push_devices
            (
                customer_id,
                expo_push_token,
                platform,
                device_name,
                device_id,
                is_active,
                last_seen_at
            )
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

            ON DUPLICATE KEY UPDATE
                customer_id = VALUES(customer_id),
                platform = VALUES(platform),
                device_name = VALUES(device_name),
                device_id = VALUES(device_id),
                is_active = 1,
                last_seen_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            `,
            [
                customerId,
                expoPushToken,
                platform,
                deviceName,
                deviceId
            ]
        );

        const [rows] = await db.query(
            `
            SELECT
                id,
                platform,
                device_name,
                device_id,
                is_active,
                last_seen_at,
                created_at,
                updated_at
            FROM customer_push_devices
            WHERE customer_id = ?
              AND expo_push_token = ?
            LIMIT 1
            `,
            [
                customerId,
                expoPushToken
            ]
        );

        return res.json({
            success: true,
            message: "Push notification device registered.",
            device: rows[0] || null
        });

    } catch (error) {
        console.error(
            "Register customer push device error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to register push notification device."
        });
    }
};


// =========================================
// Remove / Deactivate Push Device
// =========================================

exports.unregisterDevice = async (req, res) => {
    try {
        const customerId = getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        const expoPushToken =
            cleanText(req.body.expo_push_token, 255);

        if (!expoPushToken) {
            return res.status(400).json({
                success: false,
                message: "Expo push token is required."
            });
        }

        const [result] = await db.query(
            `
            UPDATE customer_push_devices
            SET
                is_active = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE customer_id = ?
              AND expo_push_token = ?
              AND is_active = 1
            `,
            [
                customerId,
                expoPushToken
            ]
        );

        return res.json({
            success: true,
            updated: result.affectedRows,
            message: "Push notification device removed."
        });

    } catch (error) {
        console.error(
            "Unregister customer push device error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to remove push notification device."
        });
    }
};


// =========================================
// List Customer Push Devices
// =========================================

exports.testPush = async (req, res) => {

    try {

        const customerId =
            getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message:
                    "Customer authentication required."
            });
        }

        const [devices] =
            await db.query(
                `
                SELECT
                    id,
                    expo_push_token,
                    platform
                FROM customer_push_devices
                WHERE customer_id = ?
                  AND is_active = 1
                ORDER BY id ASC
                `,
                [customerId]
            );

        if (!devices.length) {
            return res.status(404).json({
                success: false,
                message:
                    "No active push device is registered."
            });
        }

        const pushNotificationService =
            require(
                "../services/pushNotificationService"
            );

        const results = [];

        for (const device of devices) {

            try {

                await pushNotificationService.sendPush({
                    to:
                        device.expo_push_token,
                    title:
                        "RUKHNAV",
                    message:
                        "Push notifications are working on this device.",
                    data: {
                        type:
                            "push_test",
                        actionUrl:
                            "/"
                    },
                    priority:
                        "high"
                });

                results.push({
                    deviceId:
                        device.id,
                    platform:
                        device.platform,
                    success:
                        true
                });

            } catch (error) {

                results.push({
                    deviceId:
                        device.id,
                    platform:
                        device.platform,
                    success:
                        false,
                    message:
                        error instanceof Error
                            ? error.message
                            : String(error)
                });
            }
        }

        const sentCount =
            results.filter(
                item =>
                    item.success
            ).length;

        return res.json({
            success:
                sentCount > 0,
            message:
                sentCount > 0
                    ? "RUKHNAV test push submitted."
                    : "RUKHNAV test push failed.",
            totalDevices:
                results.length,
            sentCount,
            failedCount:
                results.length -
                sentCount,
            results
        });

    } catch (error) {

        console.error(
            "Test customer push error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to send test push."
        });
    }

};



exports.listDevices = async (req, res) => {
    try {
        const customerId = getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                platform,
                device_name,
                device_id,
                is_active,
                last_seen_at,
                created_at,
                updated_at
            FROM customer_push_devices
            WHERE customer_id = ?
            ORDER BY
                is_active DESC,
                last_seen_at DESC,
                id DESC
            `,
            [customerId]
        );

        return res.json({
            success: true,
            devices: rows
        });

    } catch (error) {
        console.error(
            "List customer push devices error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load push notification devices."
        });
    }
};
