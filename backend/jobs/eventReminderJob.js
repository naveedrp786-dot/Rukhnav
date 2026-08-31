"use strict";

const cron = require("node-cron");

const eventReminderSchedulerService =
    require(
        "../services/eventReminderSchedulerService"
    );

const eventReminderDeliveryService =
    require(
        "../services/eventReminderDeliveryService"
    );

let jobStarted = false;
let jobRunning = false;

/**
 * Run one complete reminder cycle.
 */
async function runReminderCycle() {
    if (jobRunning) {
        console.log(
            "Event reminder cycle is already running."
        );

        return;
    }

    jobRunning = true;

    try {
        console.log(
            "Starting automatic event-reminder cycle..."
        );

        const generationResult =
            await eventReminderSchedulerService
                .generateDueEventReminders();

        const deliveryResult =
            await eventReminderDeliveryService
                .processPendingReminders(100);

        console.log(
            "Reminder generation summary:",
            generationResult.summary
        );

        console.log(
            "Reminder delivery summary:",
            deliveryResult.summary
        );
    } catch (error) {
        console.error(
            "Automatic event-reminder cycle failed:",
            error
        );
    } finally {
        jobRunning = false;
    }
}

/**
 * Start the automatic reminder schedule.
 */
function startEventReminderJob() {
    if (jobStarted) {
        console.log(
            "Event reminder job is already running."
        );

        return;
    }

    /*
     * Runs every day at 9:00 AM
     * Pakistan Standard Time.
     */
    cron.schedule(
        "0 9 * * *",
        runReminderCycle,
        {
            timezone: "Asia/Karachi"
        }
    );

    jobStarted = true;

    console.log(
        "Event reminder job scheduled for 9:00 AM Asia/Karachi."
    );
}

module.exports = {
    startEventReminderJob,
    runReminderCycle
};