"use strict";

const db =
    require("../config/db");

const {
    isDevelopmentMode,
    getCustomerVerificationMode
} = require(
    "../utils/customerVerificationMode"
);

const {
    truthy
} = require(
    "./customerEventPolicyService"
);

function formatDate(date) {
    return [
        date.getFullYear(),
        String(
            date.getMonth() + 1
        ).padStart(2, "0"),
        String(
            date.getDate()
        ).padStart(2, "0")
    ].join("-");
}

function parseDate(value) {
    const match =
        String(value || "")
            .match(
                /^(\d{4})-(\d{2})-(\d{2})/
            );

    if (!match) {
        return new Date(NaN);
    }

    return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
    );
}

function addDays(
    date,
    amount
) {
    const result =
        new Date(date);

    result.setDate(
        result.getDate() +
        Number(amount)
    );

    return result;
}

function createAnnualDate(
    year,
    month,
    day
) {
    const finalDay =
        Math.min(
            day,
            new Date(
                year,
                month + 1,
                0
            ).getDate()
        );

    return new Date(
        year,
        month,
        finalDay
    );
}

function nextOccurrence(
    eventDate,
    recurrence,
    today
) {
    const original =
        parseDate(eventDate);

    if (
        Number.isNaN(
            original.getTime()
        )
    ) {
        return null;
    }

    if (
        recurrence ===
        "One Time"
    ) {
        return original;
    }

    let next =
        createAnnualDate(
            today.getFullYear(),
            original.getMonth(),
            original.getDate()
        );

    if (next < today) {
        next =
            createAnnualDate(
                today.getFullYear() + 1,
                original.getMonth(),
                original.getDate()
            );
    }

    return next;
}

function channelAllowed(
    event,
    channel
) {
    const development =
        isDevelopmentMode();

    if (channel === "Email") {
        return (
            truthy(
                event.remind_by_email
            ) &&
            Boolean(event.email) &&
            (
                development ||
                (
                    truthy(
                        event.customer_email_enabled
                    ) &&
                    truthy(
                        event.category_email_enabled
                    ) &&
                    Boolean(
                        event.email_verified_at
                    ) &&
                    truthy(
                        event.event_menu_enabled
                    )
                )
            )
        );
    }

    if (channel === "WhatsApp") {
        return (
            truthy(
                event.remind_by_whatsapp
            ) &&
            Boolean(event.phone) &&
            (
                development ||
                (
                    truthy(
                        event.customer_whatsapp_enabled
                    ) &&
                    truthy(
                        event.category_whatsapp_enabled
                    ) &&
                    Boolean(
                        event.phone_verified_at
                    ) &&
                    truthy(
                        event.event_menu_enabled
                    )
                )
            )
        );
    }

    return (
        truthy(
            event.remind_by_sms
        ) &&
        Boolean(event.phone) &&
        (
            development ||
            (
                truthy(
                    event.customer_sms_enabled
                ) &&
                truthy(
                    event.category_sms_enabled
                ) &&
                Boolean(
                    event.phone_verified_at
                ) &&
                truthy(
                    event.event_menu_enabled
                )
            )
        )
    );
}

function reminderMessage(
    event,
    eventDate
) {
    return (
        `Hello ${event.full_name || "Customer"}, ` +
        `this is your RUKHNAV reminder for ` +
        `"${event.event_name}" (${event.event_type}) ` +
        `on ${eventDate}.`
    );
}

async function insertLog(
    connection,
    event,
    channel,
    recipient,
    scheduledFor,
    message
) {
    const [result] =
        await connection.query(
            `
            INSERT IGNORE INTO event_reminder_logs
            (
                customer_event_id,
                customer_id,
                reminder_channel,
                scheduled_for,
                recipient,
                status,
                attempts,
                message_text
            )
            VALUES
            (
                ?, ?, ?, ?, ?,
                'Pending',
                0,
                ?
            )
            `,
            [
                event.id,
                event.customer_id,
                channel,
                scheduledFor,
                recipient,
                message
            ]
        );

    return (
        result.affectedRows >
        0
    );
}

async function generateDueEventReminders() {
    const connection =
        await db.getConnection();

    try {
        await connection
            .beginTransaction();

        const [events] =
            await connection.query(
                `
                SELECT
                    ce.id,
                    ce.customer_id,
                    ce.event_type,
                    ce.event_name,
                    DATE_FORMAT(
                        ce.event_date,
                        '%Y-%m-%d'
                    ) AS event_date,
                    ce.recurrence,
                    ce.reminder_days,
                    ce.remind_by_email,
                    ce.remind_by_whatsapp,
                    ce.remind_by_sms,

                    c.full_name,
                    c.email,
                    c.phone,
                    c.email_verified_at,
                    c.phone_verified_at,

                    c.email_reminders_enabled
                        AS customer_email_enabled,
                    c.whatsapp_reminders_enabled
                        AS customer_whatsapp_enabled,
                    c.sms_reminders_enabled
                        AS customer_sms_enabled,

                    COALESCE(
                        lc.event_menu_enabled,
                        0
                    ) AS event_menu_enabled,
                    COALESCE(
                        lc.email_reminders_enabled,
                        0
                    ) AS category_email_enabled,
                    COALESCE(
                        lc.whatsapp_reminders_enabled,
                        0
                    ) AS category_whatsapp_enabled,
                    COALESCE(
                        lc.sms_reminders_enabled,
                        0
                    ) AS category_sms_enabled

                FROM customer_events ce

                JOIN customers c
                    ON c.id =
                        ce.customer_id

                LEFT JOIN customer_rewards cr
                    ON cr.customer_id =
                        c.id

                LEFT JOIN customer_loyalty_categories lc
                    ON lc.category_name =
                        cr.membership_level
                    AND lc.status =
                        'Active'

                WHERE ce.status =
                        'Active'
                  AND c.status IN (
                        'Active',
                        'Pending Verification'
                  )
                  AND c.deleted_at IS NULL
                `
            );

        const today =
            new Date();

        today.setHours(
            0,
            0,
            0,
            0
        );

        const summary = {
            mode:
                getCustomerVerificationMode(),

            developmentBypass:
                isDevelopmentMode(),

            date:
                formatDate(today),

            eventsChecked:
                events.length,

            remindersCreated:
                0,

            duplicateReminders:
                0,

            skippedEvents:
                0,

            createdByChannel: {
                Email:
                    0,

                WhatsApp:
                    0,

                SMS:
                    0
            }
        };

        for (const event of events) {
            const eventDate =
                nextOccurrence(
                    event.event_date,
                    event.recurrence,
                    today
                );

            if (!eventDate) {
                summary.skippedEvents +=
                    1;
                continue;
            }

            eventDate.setHours(
                0,
                0,
                0,
                0
            );

            if (
                event.recurrence ===
                    "One Time" &&
                eventDate < today
            ) {
                summary.skippedEvents +=
                    1;
                continue;
            }

            const reminderDate =
                addDays(
                    eventDate,
                    -Number(
                        event.reminder_days ||
                        5
                    )
                );

            reminderDate.setHours(
                0,
                0,
                0,
                0
            );

            if (
                reminderDate > today ||
                eventDate < today
            ) {
                continue;
            }

            const eventDateText =
                formatDate(eventDate);

            const reminderDateText =
                formatDate(
                    reminderDate
                );

            const message =
                reminderMessage(
                    event,
                    eventDateText
                );

            const channels = [
                {
                    name:
                        "Email",
                    recipient:
                        event.email
                },
                {
                    name:
                        "WhatsApp",
                    recipient:
                        event.phone
                },
                {
                    name:
                        "SMS",
                    recipient:
                        event.phone
                }
            ].filter(
                item =>
                    channelAllowed(
                        event,
                        item.name
                    )
            );

            if (!channels.length) {
                summary.skippedEvents +=
                    1;
                continue;
            }

            for (
                const channel
                of channels
            ) {
                const created =
                    await insertLog(
                        connection,
                        event,
                        channel.name,
                        channel.recipient,
                        reminderDateText,
                        message
                    );

                if (created) {
                    summary.remindersCreated +=
                        1;

                    summary.createdByChannel[
                        channel.name
                    ] += 1;
                } else {
                    summary.duplicateReminders +=
                        1;
                }
            }
        }

        await connection.commit();

        return {
            success: true,
            message:
                "Due event reminders generated successfully.",
            summary
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    generateDueEventReminders
};
