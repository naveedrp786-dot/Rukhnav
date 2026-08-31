"use strict";

const express = require("express");
const router = express.Router();

const auth =
    require("../middleware/auth");

const controller =
    require("../controllers/customerAddressController");

// =========================================
// Customer Saved Addresses
// =========================================

// Get all saved addresses
router.get(
    "/",
    auth,
    controller.getAll
);

// Add new address
router.post(
    "/",
    auth,
    controller.create
);

// Update existing address
router.put(
    "/:id",
    auth,
    controller.update
);

// Make address default
router.patch(
    "/:id/default",
    auth,
    controller.setDefault
);

// Delete address
router.delete(
    "/:id",
    auth,
    controller.remove
);

module.exports = router;
