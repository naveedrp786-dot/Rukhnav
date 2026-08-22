const express = require("express");
const router = express.Router();

const adminManagementController = require("../controllers/adminManagementController");
const adminAuth = require("../middleware/adminAuth");
const uploadAdmin = require("../middleware/uploadAdmin");

// ======================================================
// ADMIN CRUD ROUTES
// Base URL: /api/admins
// ======================================================

// Get All Administrators
router.get(
    "/",
    adminAuth,
    adminManagementController.getAdmins
);

// Get Single Administrator
router.get(
    "/:id",
    adminAuth,
    adminManagementController.getAdminById
);

// Create Administrator
router.post(
    "/",
    adminAuth,
    uploadAdmin.single("profile_image"),
    adminManagementController.createAdmin
);

// Update Administrator
router.put(
    "/:id",
    adminAuth,
    uploadAdmin.single("profile_image"),
    adminManagementController.updateAdmin
);

// Delete Administrator
router.delete(
    "/:id",
    adminAuth,
    adminManagementController.deleteAdmin
);

module.exports = router;