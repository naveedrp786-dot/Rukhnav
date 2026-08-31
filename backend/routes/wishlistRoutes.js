const express = require("express");
const router = express.Router();

const wishlistController = require("../controllers/wishlistController");
const auth = require("../middleware/auth");

// Add to Wishlist
router.post(
    "/",
    auth,
    wishlistController.addToWishlist
);

// Get Wishlist
router.get(
    "/",
    auth,
    wishlistController.getWishlist
);

// Remove from Wishlist
router.delete(
    "/:id",
    auth,
    wishlistController.removeFromWishlist
);

module.exports = router;