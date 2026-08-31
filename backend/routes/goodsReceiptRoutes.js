const express = require("express");
const router = express.Router();

const goodsReceiptController =
    require("../controllers/goodsReceiptController");
const adminAuth = require("../middleware/adminAuth");

// POST /api/grn/purchase-orders/:id
router.post(
    "/purchase-orders/:id",
    adminAuth,
    goodsReceiptController.createGoodsReceipt
);

// GET /api/grn/purchase-orders/:id
router.get(
    "/purchase-orders/:id",
    adminAuth,
    goodsReceiptController.getPurchaseOrderGoodsReceipts
);

// GET /api/grn
router.get(
    "/",
    adminAuth,
    goodsReceiptController.getGoodsReceipts
);

// GET /api/grn/:id
router.get(
    "/:id",
    adminAuth,
    goodsReceiptController.getGoodsReceiptById
);

module.exports = router;
