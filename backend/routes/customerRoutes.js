"use strict";

const express = require("express");

const router = express.Router();

const customerController =
    require("../controllers/customerController");

const customerAuthController =
    require("../controllers/customerAuthController");

const customerAccountController =
    require("../controllers/customerAccountController");

const customerSecurityController =
    require("../controllers/customerSecurityController");

const customerNotificationController =
    require("../controllers/customerNotificationController");

const customerPushDeviceController =
    require("../controllers/customerPushDeviceController");

const auth =
    require("../middleware/auth");

// =========================================
// Registration and Login
// =========================================

router.post(
    "/register",
    customerController.register
);

router.post(
    "/login",
    customerController.login
);

// =========================================
// Referrals
// =========================================

router.get(
    "/referral/check/:code",
    customerController.checkReferralCode
);

// =========================================
// Account Verification
// =========================================

router.post(
    "/verification/request",
    customerAuthController
        .requestVerificationCode
);

router.post(
    "/verification/confirm",
    customerAuthController
        .verifyAccount
);

// =========================================
// Password Recovery
// =========================================

router.post(
    "/password/forgot",
    customerAuthController
        .requestPasswordReset
);

router.post(
    "/password/reset",
    customerAuthController
        .resetPassword
);

// =========================================
// Account-Deletion Recovery
// Public because deletion blocks normal login
// =========================================

router.post(
    "/account/deletion/cancel",
    customerAccountController
        .cancelAccountDeletion
);

// =========================================
// Protected Customer Profile
// =========================================

router.get(
    "/profile",
    auth,
    customerController.profile
);

// =========================================
// Protected Referral History
// =========================================

router.get(
    "/referrals/me",
    auth,
    customerController.getMyReferrals
);

// =========================================
// Protected Account Management
// =========================================

// Get deletion-request status
router.get(
    "/account/deletion",
    auth,
    customerAccountController
        .getDeletionStatus
);

// Request account deletion
router.post(
    "/account/deletion",
    auth,
    customerAccountController
        .requestAccountDeletion
);

// Update email, WhatsApp and SMS preferences
router.put(
    "/account/reminder-preferences",
    auth,
    customerAccountController
        .updateReminderPreferences
);


// =========================================
// Protected Customer Notifications
// =========================================

router.get(
    "/notifications",
    auth,
    customerNotificationController.list
);

router.get(
    "/notifications/unread-count",
    auth,
    customerNotificationController.unreadCount
);

router.patch(
    "/notifications/read-all",
    auth,
    customerNotificationController.markAllRead
);

router.patch(
    "/notifications/:id/read",
    auth,
    customerNotificationController.markRead
);


// =========================================
// Protected Mobile Push Devices
// =========================================

router.post(
    "/push-devices/test",
    auth,
    customerPushDeviceController.testPush
);

router.get(
    "/push-devices",
    auth,
    customerPushDeviceController.listDevices
);

router.post(
    "/push-devices",
    auth,
    customerPushDeviceController.registerDevice
);

router.delete(
    "/push-devices",
    auth,
    customerPushDeviceController.unregisterDevice
);


// =========================================
// Protected Security Management
// =========================================

router.put(
    "/account/password",
    auth,
    customerSecurityController
        .changePassword
);

router.get(
    "/account/sessions",
    auth,
    customerSecurityController
        .getSessions
);

router.delete(
    "/account/sessions/others",
    auth,
    customerSecurityController
        .revokeOtherSessions
);

// Authenticated convenience route used by
// the Customer Centre security panel.
router.post(
    "/account/deletion/cancel-authenticated",
    auth,
    customerAccountController
        .cancelAccountDeletion
);

module.exports = router;