"use strict";

const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const shipmentController = require("../controllers/shipmentController");

router.use(adminAuth);

router.get("/", shipmentController.getAll);
router.get("/:id", shipmentController.getById);
router.put("/:id/status", shipmentController.updateStatus);
router.put("/:id/dispatch", shipmentController.dispatch);
router.put("/:id/transit", shipmentController.markInTransit);
router.put("/:id/out-for-delivery", shipmentController.markOutForDelivery);
router.put("/:id/deliver", shipmentController.markDelivered);
router.put("/:id/return", shipmentController.markReturned);

module.exports = router;
