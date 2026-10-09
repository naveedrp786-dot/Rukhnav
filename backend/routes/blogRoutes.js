"use strict";

const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const controller = require("../controllers/blogController");

const router = express.Router();

router.get("/articles", controller.listPublished);
router.get("/articles/:slug", controller.getPublished);

router.get("/admin/articles", adminAuth, controller.listAdmin);
router.get("/admin/articles/:id", adminAuth, controller.getAdminArticle);
router.post("/admin/articles", adminAuth, controller.createDraft);
router.put("/admin/articles/:id", adminAuth, controller.updateDraft);
router.post("/admin/articles/:id/publish", adminAuth, controller.publish);

module.exports = router;
