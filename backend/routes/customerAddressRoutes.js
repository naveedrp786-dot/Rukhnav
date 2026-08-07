"use strict";

const express =
    require("express");

const router =
    express.Router();

const auth =
    require("../middleware/auth");

const controller =
    require(
        "../controllers/customerAddressController"
    );

router.use(auth);

router.get(
    "/",
    controller.getAll
);

router.post(
    "/",
    controller.create
);

router.put(
    "/:id",
    controller.update
);

router.patch(
    "/:id/default",
    controller.setDefault
);

router.delete(
    "/:id",
    controller.remove
);

module.exports = router;
