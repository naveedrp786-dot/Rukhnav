"use strict";

const express = require("express");
const router = express.Router();

const customerLoyaltyController =
    require("../controllers/customerLoyaltyController");

const auth = require("../middleware/auth");

/**
 * Customer must be logged in.
 */
router.use(auth);

/**
 * GET /api/customer-loyalty/me
 *
 * Returns points, membership category,
 * benefits and next-category progress.
 */
router.get(
    "/me",
    customerLoyaltyController.getMyLoyaltySummary
);

module.exports = router;