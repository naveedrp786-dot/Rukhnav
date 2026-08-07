"use strict";

const express = require("express");
const router = express.Router();

const adminAuth =
    require(
        "../middleware/adminAuth"
    );

const salesController =
    require(
        "../controllers/salesController"
    );

const saleCancellationController =
    require(
        "../controllers/saleCancellationController"
    );

/*
 * All sales routes require
 * administrator authentication.
 */
router.use(adminAuth);

// =========================================
// Create Sale
// =========================================

router.post(
    "/",
    salesController.createSale
);

// =========================================
// Get All Sales
// =========================================

router.get(
    "/",
    salesController.getSales
);

// =========================================
// Cancel Sale
// =========================================

router.post(
    "/:id/cancel",
    saleCancellationController
        .cancelSale
);

// =========================================
// Get Sale Cancellation Details
// =========================================

router.get(
    "/:id/cancellation",
    saleCancellationController
        .getCancellation
);

// =========================================
// Get One Sale
// =========================================

router.get(
    "/:id",
    salesController.getSaleById
);

module.exports = router;