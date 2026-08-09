"use strict";

const jwt =
    require("jsonwebtoken");

const crypto =
    require("crypto");

module.exports = (
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
            ? authHeader.split(" ")[1]
            : authHeader;

    try {
        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET ||
                "rukhnav_secret_key"
            );

        req.user = decoded;

        // Hash the presented JWT using the same
        // method used when customer_sessions
        // records are created during login.
        req.customerSessionHash =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired token."
        });
    }
};
