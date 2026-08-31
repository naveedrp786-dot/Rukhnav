const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const reminderController = require("../controllers/reminderController");

router.post("/", auth, reminderController.createReminder);

router.get("/", auth, reminderController.getMyReminders);

router.get(
    "/upcoming",
    auth,
    reminderController.getUpcomingReminders
);

router.get("/:id", auth, reminderController.getReminder);

router.put("/:id", auth, reminderController.updateReminder);

router.delete("/:id", auth, reminderController.deleteReminder);

module.exports = router;