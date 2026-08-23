"use strict";

const express = require("express");
const router = express.Router();

const orderController =
    require(
        "../controllers/orderController"
    );

const guestOrderController =
    require(
        "../controllers/guestOrderController"
    );

const auth =
    require(
        "../middleware/auth"
    );

// =====================================================
// Public Guest Checkout
// =====================================================

router.post(
    "/guest",
    guestOrderController
        .placeGuestOrder
);

router.post(
    "/guest/return-lookup",
    guestOrderController
        .lookupGuestOrderForReturn
);

router.get(
    "/guest/:orderNumber",
    guestOrderController
        .getGuestOrder
);

// =====================================================
// Authenticated Customer Orders
// =====================================================

router.post(
    "/",
    auth,
    orderController
        .placeOrder
);

router.get(
    "/",
    auth,
    orderController
        .getMyOrders
);

router.get(
    "/:id",
    auth,
    orderController
        .getOrderDetails
);

router.put(
    "/:id/cancel",
    auth,
    orderController
        .cancelOrder
);

module.exports = router;
