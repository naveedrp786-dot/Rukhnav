"use strict";

const express =
    require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const controller =
    require(
        "../controllers/customerPortalController"
    );

router.use(auth);

router.get(
    "/summary",
    controller.getSummary
);

router.get(
    "/coupons",
    controller.getCoupons
);

module.exports = router;
