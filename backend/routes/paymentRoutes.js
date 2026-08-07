"use strict";

/*
 * Legacy compatibility file.
 * Phase 13.4 uses routes/adminPaymentRoutes.js.
 * This export prevents old imports from crashing while you finish cleanup.
 */
module.exports = require("./adminPaymentRoutes");
