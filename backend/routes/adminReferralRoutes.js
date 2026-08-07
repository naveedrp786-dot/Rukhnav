"use strict";

const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const adminReferralController = require("../controllers/adminReferralController");

router.use(adminAuth);

router.get("/summary", adminReferralController.getSummary);
router.get("/", adminReferralController.getReferrals);
router.get("/:id", adminReferralController.getReferralById);

module.exports = router;
