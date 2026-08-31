"use strict";

const express =
    require("express");

const router =
    express.Router();

const auth =
    require(
        "../middleware/auth"
    );

const controller =
    require(
        "../controllers/customerEventController"
    );

router.use(auth);

/**
 * GET /api/customer-events/policy
 */
router.get(
    "/policy",
    controller.getPolicyStatus
);

/**
 * GET /api/customer-events/upcoming
 */
router.get(
    "/upcoming",
    controller.getUpcomingEvents
);

/**
 * GET /api/customer-events
 */
router.get(
    "/",
    controller.getEvents
);

/**
 * POST /api/customer-events
 */
router.post(
    "/",
    controller.createEvent
);

/**
 * GET /api/customer-events/:id
 */
router.get(
    "/:id",
    controller.getEventById
);

/**
 * PUT /api/customer-events/:id
 */
router.put(
    "/:id",
    controller.updateEvent
);

/**
 * PATCH /api/customer-events/:id/deactivate
 */
router.patch(
    "/:id/deactivate",
    controller.deactivateEvent
);

/**
 * PUT compatibility route used by storefront.
 */
router.put(
    "/:id/deactivate",
    controller.deactivateEvent
);

/**
 * PATCH /api/customer-events/:id/restore
 */
router.patch(
    "/:id/restore",
    controller.restoreEvent
);

/**
 * PUT compatibility route used by storefront.
 */
router.put(
    "/:id/restore",
    controller.restoreEvent
);

/**
 * DELETE /api/customer-events/:id/permanent
 */
router.delete(
    "/:id/permanent",
    controller.deleteEvent
);

module.exports =
    router;
