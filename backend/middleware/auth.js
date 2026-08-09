"use strict";

const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");

const db =
    require("../config/db");

module.exports = async (
    req,
    res,
    next
) => {
    const authHeader =
        req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message:
                "Access denied. Token is required."
        });
    }

    const token =
        authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : authHeader.trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message:
                "Access denied. Token is required."
        });
    }

    try {
        const jwtSecret =
            process.env.JWT_SECRET;

        if (!jwtSecret) {
            throw new Error(
                "JWT_SECRET is not configured."
            );
        }

        const decoded =
            jwt.verify(
                token,
                jwtSecret
            );

        const sessionHash =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

        // Customer JWTs must correspond to an
        // active, non-revoked stored session.
        if (
            decoded.accountType === "customer"
        ) {
            const [sessions] =
                await db.query(
                    `
                    SELECT id
                    FROM customer_sessions
                    WHERE customer_id = ?
                      AND refresh_token_hash = ?
                      AND revoked_at IS NULL
                      AND expires_at >
                          CURRENT_TIMESTAMP
                    LIMIT 1
                    `,
                    [
                        Number(decoded.id),
                        sessionHash
                    ]
                );

            if (!sessions.length) {
                return res.status(401).json({
                    success: false,
                    sessionRevoked: true,
                    message:
                        "This session has expired or was signed out. Please log in again."
                });
            }

            // Keep session activity reasonably current.
            await db.query(
                `
                UPDATE customer_sessions
                SET last_used_at =
                    CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [sessions[0].id]
            ).catch(() => {});
        }

        req.user =
            decoded;

        req.customerSessionHash =
            sessionHash;

        next();
    } catch (error) {
        if (
            error?.name ===
                "JsonWebTokenError" ||
            error?.name ===
                "TokenExpiredError" ||
            error?.name ===
                "NotBeforeError"
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid or expired token."
            });
        }

        console.error(
            "Customer authentication error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to validate customer session."
        });
    }
};
