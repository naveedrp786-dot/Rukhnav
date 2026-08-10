const uploadAdmin = require("../middleware/uploadAdmin");
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminAuth = require("../middleware/adminAuth");
const { sendEmail } = require("../services/emailService");
const { createCoupon } = require("../services/couponService");

// Your other admin routes...


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

router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Admin route is working"
    });
});

router.get("/test-email", async (req, res) => {

    const sent = await sendEmail(

        "inforukhnav@gmail.com", // Change if you want to send to another address

        "Welcome to RUKHNAV",

        `
        <h1>🌿 RUKHNAV Cosmetics</h1>

        <h2>Congratulations!</h2>

        <p>Your email service is working successfully.</p>

        <hr>

        <p>This email was sent from your Node.js backend.</p>
        `

    );

    res.json({
        success: sent
    });

});



router.get("/test-coupon", async (req, res) => {

    try {

        const coupon = await createCoupon(
            4,   // Customer ID
            20   // 20% discount
        );

        res.json({
            success: true,
            coupon
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

module.exports = router;