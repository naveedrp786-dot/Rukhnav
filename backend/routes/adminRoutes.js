const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");

// Public Routes
router.post("/register", adminController.register);
router.post("/login", adminController.login);

// Protected Routes
router.get("/dashboard", adminAuth, (req, res) => {

    res.json({
        success: true,
        message: "Welcome to RUKHNAV Admin Dashboard",
        admin: req.admin
    });

});

// 👇 ADD THE NEW ROUTE HERE
router.get("/dashboard/stats", adminAuth, adminController.dashboardStats);

router.get("/dashboard/stats", adminAuth, adminController.dashboardStats);

router.get(
    "/reports/monthly-sales",
    adminAuth,
    adminController.monthlySales
);

router.get("/orders", adminAuth, adminController.getAllOrders);

router.put("/orders/:id/status", adminAuth, adminController.updateOrderStatus);

router.get("/all", adminAuth, adminController.getAllAdmins);

router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Admin route is working"
    });
});

module.exports = router;