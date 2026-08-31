const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");

const purchasingDashboardController = require(
    "../controllers/purchasingDashboardController"
);

router.get(
    "/",
    adminAuth,
    purchasingDashboardController.getDashboard
);

module.exports = router;
