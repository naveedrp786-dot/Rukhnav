const express = require("express");
const router = express.Router();

const couponController = require("../controllers/couponController");
const adminAuth = require("../middleware/adminAuth");

// Public Route
router.post(
    "/apply",
    couponController.applyCoupon
);

// Admin Routes
router.post(
    "/",
    adminAuth,
    couponController.createCoupon
);

router.get(
    "/",
    adminAuth,
    couponController.getCoupons
);

router.put(
    "/:id",
    adminAuth,
    couponController.updateCoupon
);

router.delete(
    "/:id",
    adminAuth,
    couponController.deleteCoupon
);

module.exports = router;