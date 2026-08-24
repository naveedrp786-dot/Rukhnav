const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

    let token = null;

    // ============================
    // 1. Check Authorization Header
    // ============================

    const authHeader = req.headers.authorization;

    if (authHeader) {

        token = authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : authHeader;

    }

    // ============================
    // 2. No Token
    // ============================

    if (!token) {

        return res.status(401).json({
            success: false,
            message: "Access denied. Token is required."
        });

    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.admin = decoded;

        next();

    } catch (error) {

        console.error("JWT Verify Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });

    }

};