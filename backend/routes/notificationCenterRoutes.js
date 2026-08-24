"use strict";

const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const controller = require("../controllers/notificationCenterController");
const automation = require("../controllers/notificationAutomationController");

const campaigns =
    require(
        "../controllers/notificationCampaignController"
    );

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


// =====================================================
// Communication Campaigns
// =====================================================

router.get(
    "/campaigns",
    campaigns.listCampaigns
);

router.post(
    "/campaigns",
    campaigns.createCampaign
);

router.post(
    "/campaigns/preview-audience",
    campaigns.previewAudience
);

router.get(
    "/campaigns/:id",
    campaigns.getCampaign
);

router.put(
    "/campaigns/:id/recipients",
    campaigns.saveRecipients
);

router.post(
    "/campaigns/:id/queue",
    campaigns.queueCampaign
);

module.exports = router;
