"use strict";

const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const adminReviewController = require("../controllers/adminReviewController");

router.use(adminAuth);
router.get("/summary", adminReviewController.getSummary);
router.get("/", adminReviewController.getReviews);
router.get("/:id", adminReviewController.getReviewById);
router.patch("/:id/status", adminReviewController.updateStatus);
router.put("/:id/reply", adminReviewController.saveReply);
router.delete("/:id/reply", adminReviewController.deleteReply);
router.patch("/:id/featured", adminReviewController.updateFeatured);

module.exports = router;
