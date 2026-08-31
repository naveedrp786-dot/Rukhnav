"use strict";

const express = require("express");
const router = express.Router();

const websiteManagementController =
    require("../controllers/websiteManagementController");

const publicWebsiteController =
    require("../controllers/publicWebsiteController");

// Public website settings used by the storefront theme/CMS bridge.
router.get(
    "/settings",
    websiteManagementController.getPublicSettings
);

// Public CMS page content, e.g. /api/website/pages/home.
router.get(
    "/pages/:pageKey",
    publicWebsiteController.getPageByKey
);

// Public CMS section content for a page.
router.get(
    "/pages/:pageKey/sections/:sectionKey",
    publicWebsiteController.getSectionByKeys
);

module.exports = router;
