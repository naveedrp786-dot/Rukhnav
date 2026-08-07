"use strict";

const db = require("../config/db");

const notificationProviderService =
    require(
        "./notificationProviderService"
    );

/**
 * Send one reminder through its selected channel.
 */
async function deliverReminder(reminder) {
    const deliveryData = {
        to: reminder.recipient,
        message: reminder.message_text
    };

    if (
        reminder.reminder_channel ===
        "Email"
    ) {
        return notificationProviderService
            .sendEmail({
                ...deliveryData,
                subject:
                    "RUKHNAV Special Event Reminder"
            });
    }

    if (
        reminder.reminder_channel ===
        "WhatsApp"
    ) {
        return notificationProviderService
            .sendWhatsApp(deliveryData);
    }

    if (
        reminder.reminder_channel ===
        "SMS"
    ) {
        return notificationProviderService
            .sendSms(deliveryData);
    }

    throw new Error(
        `Unsupported reminder channel: ${reminder.reminder_channel}`
    );
}

/**
 * Process pending and retryable reminders.
 */
async function processPendingReminders(
    limit = 50
) {
    const safeLimit = Math.min(
        Math.max(
            Number(limit) || 50,
            1
        ),
        200
    );

    const [reminders] = await db.query(
        `
        SELECT
            id,
            customer_event_id,
            customer_id,
            reminder_channel,
            scheduled_for,
            recipient,
            status,
            attempts,
            message_text
        FROM event_reminder_logs
        WHERE
            status IN ('Pending', 'Failed')
            AND attempts < 3
            AND scheduled_for <= CURDATE()
        ORDER BY
            scheduled_for ASC,
            id ASC
        LIMIT ?
        `,
        [safeLimit]
    );

    const summary = {
        remindersFound:
            reminders.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        simulationMode:
            notificationProviderService
                .isSimulationMode(),
        results: []
    };

    for (const reminder of reminders) {
        try {
            /*
             * Claim this reminder and increase
             * its attempt count.
             */
            const [claimResult] =
                await db.query(
                    `
                    UPDATE event_reminder_logs
                    SET
                        attempts = attempts + 1,
                        error_message = NULL
                    WHERE
                        id = ?
                        AND status IN (
                            'Pending',
                            'Failed'
                        )
                        AND attempts < 3
                    `,
                    [reminder.id]
                );

            if (
                claimResult.affectedRows === 0
            ) {
                summary.skipped += 1;
                continue;
            }

            const deliveryResult =
                await deliverReminder(
                    reminder
                );

            await db.query(
                `
                UPDATE event_reminder_logs
                SET
                    status = 'Sent',
                    provider_message_id = ?,
                    error_message = NULL,
                    sent_at = NOW()
                WHERE id = ?
                `,
                [
                    deliveryResult
                        .providerMessageId ||
                        null,
                    reminder.id
                ]
            );

            summary.sent += 1;

            summary.results.push({
                reminderId:
                    reminder.id,
                channel:
                    reminder.reminder_channel,
                status: "Sent",
                simulated:
                    Boolean(
                        deliveryResult.simulated
                    )
            });
        } catch (error) {
            console.error(
                `Reminder ${reminder.id} failed:`,
                error
            );

            await db.query(
                `
                UPDATE event_reminder_logs
                SET
                    status = 'Failed',
                    error_message = ?
                WHERE id = ?
                `,
                [
                    String(
                        error.message ||
                        "Unknown delivery error"
                    ).slice(0, 2000),
                    reminder.id
                ]
            );

            summary.failed += 1;

            summary.results.push({
                reminderId:
                    reminder.id,
                channel:
                    reminder.reminder_channel,
                status: "Failed",
                error: error.message
            });
        }
    }

    return {
        success: true,
        message:
            "Pending event reminders processed.",
        summary
    };
}

module.exports = {
    processPendingReminders
};