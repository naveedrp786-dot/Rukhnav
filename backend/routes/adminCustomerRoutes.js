"use strict";

const express = require("express");
const router = express.Router();

const adminCustomerController =
    require(
        "../controllers/adminCustomerController"
    );

const adminAuth =
    require("../middleware/adminAuth");

// =====================================================
// Protect Every Route Below
// =====================================================

router.use(adminAuth);

// =====================================================
// Customer Dashboard
// GET /api/admin/customers/dashboard
// =====================================================

router.get(
    "/dashboard",
    adminCustomerController
        .getCustomerDashboard
);

// =====================================================
// Get All Customers
// GET /api/admin/customers
// =====================================================

router.get(
    "/",
    adminCustomerController
        .getCustomers
);

// =====================================================
// Get Deleted Customers
// GET /api/admin/customers/deleted
// =====================================================

router.get(
    "/deleted",
    adminCustomerController
        .getDeletedCustomers
);

// =====================================================
// Get Account Deletion Requests
// GET /api/admin/customers/deletion-requests
// =====================================================

router.get(
    "/deletion-requests",
    adminCustomerController
        .getAccountDeletionRequests
);

// =====================================================
// Update Account Deletion Request
// PATCH /api/admin/customers/deletion-requests/:requestId/status
// =====================================================

router.patch(
    "/deletion-requests/:requestId/status",
    adminCustomerController
        .updateAccountDeletionRequestStatus
);

// =====================================================
// Get Customer Analytics
// GET /api/admin/customers/:id/analytics
// =====================================================

router.get(
    "/:id/analytics",
    adminCustomerController
        .getCustomerAnalytics
);

// =====================================================
// Get Customer 360 Activity
// GET /api/admin/customers/:id/activity
// =====================================================

router.get(
    "/:id/activity",
    adminCustomerController
        .getCustomerActivity360
);

// =====================================================
// Admin Reset Customer Password
// PATCH /api/admin/customers/:id/reset-password
// =====================================================

router.patch(
    "/:id/reset-password",
    adminCustomerController
        .resetCustomerPassword
);

// =====================================================
// Update Customer Status
// PATCH /api/admin/customers/:id/status
// =====================================================

router.patch(
    "/:id/status",
    adminCustomerController
        .updateCustomerStatus
);

// =====================================================
// Update Customer Verification
// PATCH /api/admin/customers/:id/verification
// =====================================================

router.patch(
    "/:id/verification",
    adminCustomerController
        .updateCustomerVerification
);

// =====================================================
// Restore Deleted Customer
// PATCH /api/admin/customers/:id/restore
// =====================================================

router.patch(
    "/:id/restore",
    adminCustomerController
        .restoreDeletedCustomer
);

// =====================================================
// Permanently Delete Customer
// DELETE /api/admin/customers/:id/permanent
// =====================================================

router.delete(
    "/:id/permanent",
    adminCustomerController
        .permanentlyDeleteCustomer
);

// =====================================================
// Get Single Customer
// GET /api/admin/customers/:id
// =====================================================

router.get(
    "/:id",
    adminCustomerController
        .getCustomerById
);

// =====================================================
// Update Customer
// PUT /api/admin/customers/:id
// =====================================================

router.put(
    "/:id",
    adminCustomerController
        .updateCustomer
);

// =====================================================
// Soft Delete Customer
// DELETE /api/admin/customers/:id
// =====================================================

router.delete(
    "/:id",
    adminCustomerController
        .deleteCustomer
);

module.exports = router;
