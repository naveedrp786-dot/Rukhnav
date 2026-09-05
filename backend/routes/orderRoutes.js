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

const orderPaymentProofController =
    require(
        "../controllers/orderPaymentProofController"
    );

const paymentProofUploadHandler =
    require(
        "../middleware/paymentProofUploadHandler"
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


router.post(
    "/public-track",
    guestOrderController
        .trackPublicOrder
);

router.post(
    "/guest/:orderNumber/payment-proof",
    paymentProofUploadHandler.single,
    orderPaymentProofController
        .uploadGuestProof
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

router.post(
    "/:id/payment-proof",
    auth,
    paymentProofUploadHandler.single,
    orderPaymentProofController
        .uploadCustomerProof
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
