"use strict";

const express = require("express");

const router = express.Router();

const adminAuth =
    require("../middleware/adminAuth");

const paymentController =
    require("../controllers/paymentController");

router.use(adminAuth);

/* Payment dashboard */
router.get(
    "/dashboard",
    paymentController.getDashboard
);

/* All payments */
router.get(
    "/",
    paymentController.getAll
);

/* Refund payment */
router.post(
    "/:paymentId/refund",
    paymentController.refund
);

/* Single payment */
router.get(
    "/:id",
    paymentController.getById
);

module.exports = router;