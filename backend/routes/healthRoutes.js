"use strict";

const express = require("express");
const db = require("../config/db");
const {
    verifyUploadStorage
} = require("../config/storage");

const router = express.Router();

router.get("/", async (req, res) => {
    const startedAt = Date.now();

    try {
        await db.query("SELECT 1 AS ok");
        verifyUploadStorage();

        return res.status(200).json({
            success: true,
            status: "ok",
            service: "RUKHNAV API",
            environment:
                process.env.NODE_ENV ||
                "development",
            database: "connected",
            storage: "writable",
            uptimeSeconds:
                Math.floor(process.uptime()),
            responseTimeMs:
                Date.now() - startedAt,
            timestamp:
                new Date().toISOString()
        });
    } catch (error) {
        return res.status(503).json({
            success: false,
            status: "unhealthy",
            service: "RUKHNAV API",
            databaseOrStorage: "unavailable",
            timestamp:
                new Date().toISOString()
        });
    }
});

module.exports = router;
