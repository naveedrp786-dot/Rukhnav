const express = require("express");

const router = express.Router();

const auth = require("../middleware/adminAuth");

const settingsController = require("../controllers/settingsController");

// Company
router.get(
    "/company",
    auth,
    settingsController.getCompanySettings
);

router.put(
    "/company",
    auth,
    settingsController.updateCompanySettings
);

// Profile
router.get(
    "/profile",
    auth,
    settingsController.getProfile
);

router.put(
    "/profile",
    auth,
    settingsController.updateProfile
);

// Password
router.put(
    "/change-password",
    auth,
    settingsController.changePassword
);

module.exports = router;