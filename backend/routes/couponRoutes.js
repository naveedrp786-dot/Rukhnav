"use strict";

const express = require("express");
const router = express.Router();

const couponController =
    require("../controllers/couponController");

const adminAuth =
    require("../middleware/adminAuth");

// Public validation preview.
router.post(
    "/apply",
    couponController.applyCoupon
);

// Protected administration routes.
router.get(
    "/dashboard",
    adminAuth,
    couponController.getDashboard
);

router.get(
    "/",
    adminAuth,
    couponController.getCoupons
);

router.post(
    "/",
    adminAuth,
    couponController.createCoupon
);

router.get(
    "/:id",
    adminAuth,
    couponController.getCouponById
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
