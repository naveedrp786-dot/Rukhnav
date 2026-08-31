const express = require("express");
const router = express.Router();

const stockAdjustmentController = require("../controllers/stockAdjustmentController");
const adminAuth = require("../middleware/adminAuth");

// ===============================
// Create Stock Adjustment
// ===============================
router.post(
    "/",
    adminAuth,
    stockAdjustmentController.createStockAdjustment
);

// ===============================
// Get All Stock Adjustments
// ===============================
router.get(
    "/",
    adminAuth,
    stockAdjustmentController.getStockAdjustments
);

// ===============================
// Get Single Stock Adjustment
// ===============================
router.get(
    "/:id",
    adminAuth,
    stockAdjustmentController.getStockAdjustmentById
);

module.exports = router;