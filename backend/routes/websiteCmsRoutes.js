"use strict";

const express = require("express");
const router = express.Router();

const adminAuth =
    require("../middleware/adminAuth");

const controller =
    require("../controllers/websiteManagementController");

const upload =
    require("../middleware/websiteMediaUpload");

router.use(adminAuth);

router.get("/settings", controller.getAdminSettings);
router.put("/settings", controller.saveDraft);
router.post("/publish", controller.publish);
router.post("/restore-published", controller.restorePublished);
router.post("/merge-defaults", controller.mergeMissingDefaults);
router.get("/history", controller.getHistory);
router.get("/media", controller.getMedia);
router.post("/media", upload.single("file"), controller.uploadMedia);

module.exports = router;
