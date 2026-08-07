"use strict";

const express = require("express");
const router = express.Router();

const adminAuth =
    require("../middleware/adminAuth");

const paymentController =
    require("../controllers/paymentController");

router.use(adminAuth);

router.get(
    "/dashboard",
    paymentController.getDashboard
);

router.get(
    "/",
    paymentController.getAll
);

router.get(
    "/outstanding",
    paymentController.getOutstanding
);

router.post(
    "/:paymentId/refund",
    paymentController.refund
);

router.get(
    "/:id",
    paymentController.getById
);

module.exports = router;
