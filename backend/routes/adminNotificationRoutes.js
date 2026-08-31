"use strict";

const express =
    require("express");

const router =
    express.Router();

const adminAuth =
    require(
        "../middleware/adminAuth"
    );

const controller =
    require(
        "../controllers/adminNotificationController"
    );

router.use(adminAuth);

router.get(
    "/",
    controller.getLatest
);

router.get(
    "/unread-count",
    controller.getUnreadCount
);

router.patch(
    "/read-all",
    controller.markAllRead
);

router.patch(
    "/:id/read",
    controller.markRead
);

router.post(
    "/sync",
    controller.forceSync
);

module.exports = router;
