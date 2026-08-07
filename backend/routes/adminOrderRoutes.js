"use strict";

const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const adminOrderController = require("../controllers/adminOrderController");
const shipmentController = require("../controllers/shipmentController");
const paymentController = require("../controllers/paymentController");

router.use(adminAuth);

router.get(
    "/summary",
    adminOrderController.getOrderSummary
);

router.get("/", adminOrderController.getAllOrders);
router.get("/:id/history", adminOrderController.getOrderHistory);
router.get("/:id/shipment", shipmentController.getByOrder);
router.post("/:id/shipment", shipmentController.createForOrder);
router.get("/:id/payments", paymentController.getForOrder);
router.post("/:id/payments", paymentController.recordForOrder);
router.get("/:id", adminOrderController.getOrderById);
router.put("/:id/status", adminOrderController.updateOrderStatus);

module.exports = router;
