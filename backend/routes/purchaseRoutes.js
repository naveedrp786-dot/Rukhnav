"use strict";

const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const purchaseController =
    require("../controllers/purchaseController");

router.post(
    "/",
    adminAuth,
    purchaseController.createPurchaseOrder
);

router.get(
    "/",
    adminAuth,
    purchaseController.getPurchaseOrders
);

router.get(
    "/:id",
    adminAuth,
    purchaseController.getPurchaseOrderById
);

router.put(
    "/:id",
    adminAuth,
    purchaseController.updatePurchase
);

router.post(
    "/:id/approve",
    adminAuth,
    purchaseController.approvePurchaseOrder
);

router.post(
    "/:id/order",
    adminAuth,
    purchaseController.markPurchaseOrderOrdered
);

router.post(
    "/:id/close",
    adminAuth,
    purchaseController.closePurchaseOrder
);

router.post(
    "/:id/cancel",
    adminAuth,
    purchaseController.cancelPurchaseOrder
);

router.post(
    "/:id/receive",
    adminAuth,
    purchaseController.receivePurchaseOrder
);

router.delete(
    "/:id",
    adminAuth,
    purchaseController.deletePurchase
);

module.exports = router;
