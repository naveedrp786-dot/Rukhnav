"use strict";

const db =
    require("../config/db");

const bcrypt =
    require("bcrypt");

const customerId = req =>
    Number(
        req.user?.id ||
        req.user?.customerId
    );

async function tableExists(name) {
    const [rows] =
        await db.query(
            `
            SELECT 1
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            LIMIT 1
            `,
            [name]
        );

    return rows.length > 0;
}

async function activity(
    req,
    type,
    details = null
) {
    try {
        await db.query(
            `
            INSERT INTO customer_security_activity
            (
                customer_id,
                activity_type,
                ip_address,
                user_agent,
                details
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                customerId(req),
                type,
                String(
                    req.ip || ""
                ).slice(0, 100) ||
                null,
                String(
                    req.headers[
                        "user-agent"
                    ] || ""
                ).slice(0, 500) ||
                null,
                details
            ]
        );
    } catch {
        // Security logging must not block the requested action.
    }
}

exports.changePassword = async (
    req,
    res
) => {
    try {
        const customer =
            customerId(req);

        const currentPassword =
            String(
                req.body.current_password ||
                ""
            );

        const newPassword =
            String(
                req.body.new_password ||
                ""
            );

        const confirmPassword =
            String(
                req.body.confirm_password ||
                ""
            );

        if (
            !currentPassword ||
            newPassword.length < 8
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Current password and a new password of at least 8 characters are required."
            });
        }

        if (
            newPassword !==
            confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "New passwords do not match."
            });
        }

        const [[record]] =
            await db.query(
                `
                SELECT id, password
                FROM customers
                WHERE id = ?
                  AND deleted_at IS NULL
                LIMIT 1
                `,
                [customer]
            );

        if (!record) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });
        }

        const matches =
            await bcrypt.compare(
                currentPassword,
                record.password
            );

        if (!matches) {
            return res.status(401).json({
                success: false,
                message:
                    "Current password is incorrect."
            });
        }

        const same =
            await bcrypt.compare(
                newPassword,
                record.password
            );

        if (same) {
            return res.status(400).json({
                success: false,
                message:
                    "New password must be different from the current password."
            });
        }

        const hash =
            await bcrypt.hash(
                newPassword,
                12
            );

        await db.query(
            `
            UPDATE customers
            SET
                password = ?,
                password_changed_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [hash, customer]
        );

        if (
            await tableExists(
                "customer_sessions"
            )
        ) {
            await db.query(
                `
                UPDATE customer_sessions
                SET revoked_at =
                    CURRENT_TIMESTAMP
                WHERE customer_id = ?
                  AND revoked_at IS NULL
                  AND refresh_token_hash <> ?
                `,
                [
                    customer,
                    req.customerSessionHash
                ]
            ).catch(() => {});
        }

        await activity(
            req,
            "Password Changed"
        );

        return res.json({
            success: true,
            message:
                "Password updated successfully. Other stored sessions were revoked."
        });
    } catch (error) {
        console.error(
            "Change customer password error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update password."
        });
    }
};

exports.getSessions = async (
    req,
    res
) => {
    try {
        if (
            !await tableExists(
                "customer_sessions"
            )
        ) {
            return res.json({
                success: true,
                sessions: []
            });
        }

        const currentSessionHash =
            req.customerSessionHash ||
            null;

        const [rows] =
            await db.query(
                `
                SELECT
                    id,
                    refresh_token_hash,
                    ip_address,
                    user_agent,
                    created_at,
                    last_used_at,
                    revoked_at
                FROM customer_sessions
                WHERE customer_id = ?
                  AND revoked_at IS NULL
                  AND expires_at >
                      CURRENT_TIMESTAMP
                ORDER BY
                    COALESCE(
                        last_used_at,
                        created_at
                    ) DESC
                LIMIT 20
                `,
                [customerId(req)]
            );

        return res.json({
            success: true,
            sessions:
                rows.map(row => ({
                    id:
                        row.id,

                    ip_address:
                        row.ip_address,

                    user_agent:
                        row.user_agent,

                    created_at:
                        row.created_at,

                    last_used_at:
                        row.last_used_at,

                    revoked_at:
                        row.revoked_at,

                    device_name:
                        /mobile|android|iphone|ipad/i
                            .test(
                                row.user_agent ||
                                ""
                            )
                                ? "Mobile Device"
                                : "Desktop Browser",

                    is_current:
                        Boolean(
                            currentSessionHash &&
                            row.refresh_token_hash ===
                                currentSessionHash
                        )
                }))
        });
    } catch (error) {
        console.error(
            "Load customer sessions error:",
            error
        );

        return res.json({
            success: true,
            sessions: []
        });
    }
};

exports.revokeOtherSessions = async (
    req,
    res
) => {
    try {
        const currentSessionHash =
            req.customerSessionHash ||
            null;

        if (!currentSessionHash) {
            return res.status(401).json({
                success: false,
                message:
                    "Current session could not be identified."
            });
        }

        if (
            await tableExists(
                "customer_sessions"
            )
        ) {
            await db.query(
                `
                UPDATE customer_sessions
                SET revoked_at =
                    CURRENT_TIMESTAMP
                WHERE customer_id = ?
                  AND revoked_at IS NULL
                  AND refresh_token_hash <> ?
                `,
                [
                    customerId(req),
                    currentSessionHash
                ]
            );
        }

        await activity(
            req,
            "Other Sessions Revoked"
        );

        return res.json({
            success: true,
            message:
                "Other stored sessions were signed out."
        });
    } catch (error) {
        console.error(
            "Revoke customer sessions error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to revoke other sessions."
        });
    }
};
