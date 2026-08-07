const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const dashboardController = require("../controllers/dashboardController");
const adminAuth = require("../middleware/adminAuth");

router.get(
    "/",
    auth,
    dashboardController.getDashboard
);

router.get(
    "/sales",
    adminAuth,
    dashboardController.salesAnalytics
);

router.get(
    "/best-products",
    adminAuth,
    dashboardController.bestSellingProducts
);

router.get(
    "/top-customers",
    adminAuth,
    dashboardController.topCustomers
);

router.get(
    "/sales-by-category",
    adminAuth,
    dashboardController.salesByCategory
);

router.get(
    "/monthly-sales",
    adminAuth,
    dashboardController.monthlySalesTrend
);

router.get(
    "/customer-growth",
    adminAuth,
    dashboardController.customerGrowth
);

router.get(
    "/admin",
    adminAuth,
    dashboardController.getAdminDashboard
);

module.exports = router;