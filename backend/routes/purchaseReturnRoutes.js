const express = require("express");

const router = express.Router();

const purchaseReturnController =
    require("../controllers/purchaseReturnController");

const adminAuth =
    require("../middleware/adminAuth");

// Summary
router.get(
    "/summary",
    adminAuth,
    purchaseReturnController.getPurchaseReturnSummary
);

// Form options
router.get(
    "/form-options",
    adminAuth,
    purchaseReturnController.getPurchaseReturnFormOptions
);

// Export CSV
router.get(
    "/export/csv",
    adminAuth,
    purchaseReturnController.exportPurchaseReturnsCsv
);

// Purchase-order items available for return
router.get(
    "/purchase/:purchaseId/items",
    adminAuth,
    purchaseReturnController.getPurchaseOrderItemsForReturn
);

// List
router.get(
    "/",
    adminAuth,
    purchaseReturnController.getAllPurchaseReturns
);

// Create
router.post(
    "/",
    adminAuth,
    purchaseReturnController.createPurchaseReturn
);

// Refund summary
router.get(
    "/:id/refund-summary",
    adminAuth,
    purchaseReturnController.getPurchaseReturnRefundSummary
);

// Record supplier refund
router.post(
    "/:id/refunds",
    adminAuth,
    purchaseReturnController.recordSupplierRefund
);

// Delete supplier refund
router.delete(
    "/:id/refunds/:refundId",
    adminAuth,
    purchaseReturnController.deleteSupplierRefund
);

// Complete return
router.put(
    "/:id/complete",
    adminAuth,
    purchaseReturnController.completePurchaseReturn
);

// Cancel return
router.put(
    "/:id/cancel",
    adminAuth,
    purchaseReturnController.cancelPurchaseReturn
);

// Update return
router.put(
    "/:id",
    adminAuth,
    purchaseReturnController.updatePurchaseReturn
);

// Delete draft return
router.delete(
    "/:id",
    adminAuth,
    purchaseReturnController.deletePurchaseReturn
);

// Single return
router.get(
    "/:id",
    adminAuth,
    purchaseReturnController.getPurchaseReturnById
);

module.exports = router;
