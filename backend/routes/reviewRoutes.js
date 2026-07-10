const express = require("express");
const router = express.Router();

console.log("✅ reviewRoutes.js loaded");

const reviewController = require("../controllers/reviewController");
const auth = require("../middleware/auth");

// Debug middleware
router.use((req, res, next) => {
    console.log("Review route hit:", req.method, req.originalUrl);
    next();
});

// Test route
router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Review route is working"
    });
});

// Add Review
router.post("/", auth, reviewController.addReview);

// Get Product Reviews
router.get("/product/:id", reviewController.getProductReviews);

// Update Review
router.put("/:id", auth, reviewController.updateReview);

// Delete Review
router.delete("/:id", auth, reviewController.deleteReview);

module.exports = router;