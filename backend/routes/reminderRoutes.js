const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const reminderController = require("../controllers/reminderController");

router.post(
    "/",
    auth,
    reminderController.createReminder
);

module.exports = router;