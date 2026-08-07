"use strict";

const express = require("express");
const router = express.Router();

const adminAuth =
    require("../middleware/adminAuth");

const uploadCategory =
    require("../middleware/uploadCategory");

const categoryController =
    require("../controllers/categoryController");

// ==========================================
// Public Category Routes
// ==========================================

// Storefront can display active categories
router.get(
    "/",
    categoryController.getCategories
);

router.get(
    "/:id",
    categoryController.getCategory
);

// ==========================================
// Protected Admin Routes
// ==========================================

router.post(
    "/",
    adminAuth,
    uploadCategory.single("image"),
    categoryController.createCategory
);

router.put(
    "/:id",
    adminAuth,
    uploadCategory.single("image"),
    categoryController.updateCategory
);

router.delete(
    "/:id",
    adminAuth,
    categoryController.deleteCategory
);

module.exports = router;