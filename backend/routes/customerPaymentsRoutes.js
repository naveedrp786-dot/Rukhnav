"use strict";

const express = require("express");
const router = express.Router();

const customerPaymentsController =
    require(
        "../controllers/customerPaymentsController"
    );

const adminAuth =
    require("../middleware/adminAuth");

/*
 * Every customer-payment route
 * requires administrator login.
 */
router.use(adminAuth);

// =========================================
// Get All Customer Payments
// =========================================

router.get(
    "/",
    customerPaymentsController
        .getCustomerPayments
);

// =========================================
// Get Payments for One Sale
// =========================================

router.get(
    "/sales/:saleId",
    customerPaymentsController
        .getSalePayments
);

// =========================================
// Add Payment to Existing Sale
// =========================================

router.post(
    "/sales/:saleId",
    customerPaymentsController
        .addSalePayment
);

module.exports = router;