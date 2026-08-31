const uploadAdmin = require("../middleware/uploadAdmin");
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");
const { rateLimit } = require("express-rate-limit");

// Your other admin routes...


// Public Routes
// ============================================
// Admin Authentication Security
// ============================================

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
        success: false,
        message:
            "Too many administrator login attempts. Please try again later."
    }
});

// Public administrator registration must never
// be available in production. New administrators
// are created through authenticated ERP admin
// management routes instead.
router.post(
    "/register",
    (req, res, next) => {
        if (
            String(process.env.NODE_ENV || "")
                .toLowerCase() === "production"
        ) {
            return res.status(404).json({
                success: false,
                message: "Route not found."
            });
        }

        next();
    },
    adminController.register
);

router.post(
    "/login",
    adminLoginLimiter,
    adminController.login
);

// Protected Routes
router.get("/dashboard", adminAuth, (req, res) => {

    res.json({
        success: true,
        message: "Welcome to RUKHNAV Admin Dashboard",
        admin: req.admin
    });

});

// Logged-in Admin Profile
router.get(
    "/profile",
    adminAuth,
    adminController.getProfile
);

// 👇 ADD THE NEW ROUTE HERE
router.get("/dashboard/stats", adminAuth, adminController.dashboardStats);

router.get(
    "/reports/monthly-sales",
    adminAuth,
    adminController.monthlySales
);

// Admin CRUD Routes
router.get("/admins", adminAuth, adminController.getAdmins);
router.get("/admins/:id", adminAuth, adminController.getAdminById);
router.post(
    "/admins",
    adminAuth,
    uploadAdmin.single("profile_image"),
    adminController.createAdmin
);
router.put(
    "/admins/:id",
    adminAuth,
    uploadAdmin.single("profile_image"),
    adminController.updateAdmin
);
router.delete("/admins/:id", adminAuth, adminController.deleteAdmin);

module.exports = router;
