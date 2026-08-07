"use strict";

const eventReminderSchedulerService =
    require(
        "../services/eventReminderSchedulerService"
    );

const eventReminderDeliveryService =
    require(
        "../services/eventReminderDeliveryService"
    );

// =========================================
// Admin: Generate Due Reminders
// =========================================

exports.generateDueReminders = async (
    req,
    res
) => {
    try {
        const result =
            await eventReminderSchedulerService
                .generateDueEventReminders();

        return res.status(200).json(result);
    } catch (error) {
        console.error(
            "Generate event reminders error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to generate due event reminders.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// =========================================
// Admin: Process Pending Reminders
// =========================================

exports.processPendingReminders = async (
    req,
    res
) => {
    try {
        const requestedLimit =
            Number(req.body?.limit || 50);

        const limit =
            Number.isInteger(requestedLimit)
                ? Math.min(
                    Math.max(
                        requestedLimit,
                        1
                    ),
                    200
                )
                : 50;

        const result =
            await eventReminderDeliveryService
                .processPendingReminders(limit);

        return res.status(200).json(result);
    } catch (error) {
        console.error(
            "Process event reminders error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to process pending event reminders.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// =========================================
// Admin: Generate and Process Reminders
// =========================================

exports.runCompleteReminderCycle = async (
    req,
    res
) => {
    try {
        const requestedLimit =
            Number(req.body?.limit || 50);

        const limit =
            Number.isInteger(requestedLimit)
                ? Math.min(
                    Math.max(
                        requestedLimit,
                        1
                    ),
                    200
                )
                : 50;

        /*
         * First create reminder logs that
         * are due.
         */
        const generationResult =
            await eventReminderSchedulerService
                .generateDueEventReminders();

        /*
         * Then deliver pending reminders.
         */
        const deliveryResult =
            await eventReminderDeliveryService
                .processPendingReminders(limit);

        return res.status(200).json({
            success: true,
            message:
                "Complete event-reminder cycle finished.",
            generation:
                generationResult.summary,
            delivery:
                deliveryResult.summary
        });
    } catch (error) {
        console.error(
            "Complete reminder cycle error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to complete the event-reminder cycle.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};