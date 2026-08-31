"use strict";

const express = require("express");
const router = express.Router();

const customerLoyaltyController =
    require(
        "../controllers/customerLoyaltyController"
    );

const adminLoyaltyManagementController =
    require(
        "../controllers/adminLoyaltyManagementController"
    );

const eventReminderController =
    require(
        "../controllers/eventReminderController"
    );

const loyaltyLedgerController =
    require(
        "../controllers/loyaltyLedgerController"
    );

const adminAuth =
    require("../middleware/adminAuth");

/*
 * All routes require administrator login.
 */
router.use(adminAuth);

/**
 * Get loyalty dashboard summary.
 *
 * GET /api/admin/loyalty/summary
 */
router.get(
    "/summary",
    adminLoyaltyManagementController
        .getDashboardSummary
);

// =========================================
// Loyalty Categories
// =========================================

/**
 * Get all loyalty categories.
 *
 * GET /api/admin/loyalty/categories
 */
router.get(
    "/categories",
    adminLoyaltyManagementController
        .getCategories
);

/**
 * Update a loyalty category.
 *
 * PUT /api/admin/loyalty/categories/:id
 */
router.put(
    "/categories/:id",
    adminLoyaltyManagementController
        .updateCategory
);

// =========================================
// Customer Loyalty Management
// =========================================

/**
 * Get customer loyalty list.
 *
 * GET /api/admin/loyalty/customers
 */
router.get(
    "/customers",
    adminLoyaltyManagementController
        .getCustomers
);

// =========================================
// Loyalty Transaction Ledger
// =========================================

/**
 * Get customer loyalty ledger history.
 *
 * GET
 * /api/admin/loyalty/customers/:customerId/transactions
 */
router.get(
    "/customers/:customerId/transactions",
    loyaltyLedgerController
        .getAdminCustomerTransactions
);

/**
 * Add or deduct points through
 * the new transaction ledger.
 *
 * POST
 * /api/admin/loyalty/customers/:customerId/ledger-adjustment
 */
router.post(
    "/customers/:customerId/ledger-adjustment",
    loyaltyLedgerController
        .adjustCustomerPoints
);

// =========================================
// Sale Loyalty Points
// =========================================

/**
 * Award points for a fully paid sale.
 *
 * POST
 * /api/admin/loyalty/sales/:saleId/process
 */
router.post(
    "/sales/:saleId/process",
    customerLoyaltyController
        .processPaidSale
);

/**
 * Reverse points for a cancelled
 * or fully returned sale.
 *
 * POST
 * /api/admin/loyalty/sales/:saleId/reverse
 */
router.post(
    "/sales/:saleId/reverse",
    customerLoyaltyController
        .reverseSalePoints
);

// =========================================
// Event Reminder Management
// =========================================

/**
 * Generate reminders that are due.
 *
 * POST
 * /api/admin/loyalty/event-reminders/generate
 */
router.post(
    "/event-reminders/generate",
    eventReminderController
        .generateDueReminders
);

/**
 * Deliver pending reminders.
 *
 * POST
 * /api/admin/loyalty/event-reminders/process
 */
router.post(
    "/event-reminders/process",
    eventReminderController
        .processPendingReminders
);

/**
 * Generate and deliver reminders.
 *
 * POST
 * /api/admin/loyalty/event-reminders/run
 */
router.post(
    "/event-reminders/run",
    eventReminderController
        .runCompleteReminderCycle
);

module.exports = router;