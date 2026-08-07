const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const controller = require("../controllers/executiveDashboardController");

router.get("/", adminAuth, controller.getExecutiveDashboard);

module.exports = router;
