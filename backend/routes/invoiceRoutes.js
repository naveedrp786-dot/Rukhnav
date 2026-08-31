"use strict";

const express = require("express");
const router = express.Router();

const invoiceController =
    require(
        "../controllers/invoiceController"
    );

const adminAuth =
    require("../middleware/adminAuth");

/*
 * All invoice routes require
 * administrator authentication.
 */
router.use(adminAuth);

// =========================================
// Get All Invoices
// =========================================

router.get(
    "/",
    invoiceController.getInvoices
);

// =========================================
// Generate Invoice PDF
// =========================================

router.get(
    "/:id/pdf",
    invoiceController.generateInvoice
);

// =========================================
// Get One Invoice
// =========================================

router.get(
    "/:id",
    invoiceController.getInvoiceById
);

module.exports = router;