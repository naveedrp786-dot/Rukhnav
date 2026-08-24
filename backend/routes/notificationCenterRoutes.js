"use strict";

const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const controller = require("../controllers/notificationCenterController");
const automation = require("../controllers/notificationAutomationController");

router.use(adminAuth);

router.get("/dashboard", controller.getDashboard);
router.patch("/channels/:channel", controller.updateChannel);
router.post("/channels/:channel/test", controller.testChannel);
router.post(
    "/whatsapp/send",
    controller.sendManualWhatsApp
);
router.get("/templates", controller.getTemplates);
router.put("/templates/:id", controller.saveTemplate);
router.get("/logs", controller.getLogs);
router.get("/customer-preferences", controller.getCustomerPreferences);
router.patch("/customer-preferences/:customerId", controller.updateCustomerPreferences);

router.get("/queue", automation.getQueue);
router.post("/queue/process", automation.processQueue);
router.patch("/queue/:id/retry", automation.retryItem);
router.post("/queue/manual-event", automation.queueManualEvent);

module.exports = router;
