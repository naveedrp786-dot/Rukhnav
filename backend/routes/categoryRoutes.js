const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");
const adminAuth = require("../middleware/adminAuth");

// Public
router.get("/", categoryController.getCategories);

// Admin
router.post("/", adminAuth, categoryController.addCategory);
router.put("/:id", adminAuth, categoryController.updateCategory);
router.delete("/:id", adminAuth, categoryController.deleteCategory);

module.exports = router;