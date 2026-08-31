"use strict";

const express = require("express");

const router = express.Router();

const adminAuth =
    require("../middleware/adminAuth");

const inventoryController =
    require("../controllers/inventoryController");

// Inventory dashboard
router.get(
    "/dashboard",
    adminAuth,
    inventoryController.getInventoryDashboard
);

// Complete stock ledger
router.get(
    "/ledger",
    adminAuth,
    inventoryController.getInventoryLedger
);

// Combined stock alerts
router.get(
    "/alerts",
    adminAuth,
    inventoryController.getInventoryAlerts
);

// Low-stock products
router.get(
    "/low-stock",
    adminAuth,
    inventoryController.getLowStockProducts
);

// Out-of-stock products
router.get(
    "/out-of-stock",
    adminAuth,
    inventoryController.getOutOfStockProducts
);

// Recent transactions
router.get(
    "/recent",
    adminAuth,
    inventoryController.getRecentTransactions
);

// Product inventory history
router.get(
    "/product/:id",
    adminAuth,
    inventoryController.getProductInventoryHistory
);

// Audited stock adjustment
router.post(
    "/adjust/:id",
    adminAuth,
    inventoryController.adjustStock
);

// Existing absolute-stock route
router.put(
    "/stock/:id",
    adminAuth,
    inventoryController.updateStock
);

module.exports = router;