"use strict";

const db =
    require("../config/db");

const {
    getCustomerVerificationMode,
    isDevelopmentMode
} = require(
    "../utils/customerVerificationMode"
);

const {
    validateChannel,
    canUseEventMenu
} = require(
    "../services/customerEventPolicyService"
);

const ALLOWED_EVENT_TYPES =
    new Set([
        "Birthday",
        "Anniversary",
        "Engagement",
        "Family Birthday",
        "Other"
    ]);

const ALLOWED_RECURRENCES =
    new Set([
        "Yearly",
        "One Time"
    ]);

function customerIdFromRequest(req) {
    return Number(
        req.user?.id ||
        req.customer?.id ||
        req.customerId
    );
}

function cleanText(
    value,
    maximum = 2000
) {
    return String(value || "")
        .trim()
        .slice(0, maximum);
}

function toBooleanNumber(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    )
        ? 1
        : 0;
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

function startOfToday() {
    const now =
        new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}

function isValidDate(value) {
    const date =
        parseDate(value);

    return (
        !Number.isNaN(
            date.getTime()
        ) &&
        formatDate(date) ===
            String(value)
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

function getNextEventDate(
    eventDate,
    recurrence
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

    const today =
        startOfToday();

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

function daysBetween(
    first,
    second
) {
    return Math.round(
        (
            second.getTime() -
            first.getTime()
        ) /
        86400000
    );
}

function enrichEvent(event) {
    if (!event) {
        return null;
    }

    const eventDateText =
        formatDate(
            parseDate(
                event.event_date
            )
        );

    const nextDate =
        getNextEventDate(
            eventDateText,
            event.recurrence
        );

    const reminderDate =
        nextDate
            ? addDays(
                nextDate,
                -Number(
                    event.reminder_days ||
                    5
                )
            )
            : null;

    return {
        ...event,

        event_date:
            eventDateText,

        remind_by_email:
            Boolean(
                event.remind_by_email
            ),

        remind_by_whatsapp:
            Boolean(
                event.remind_by_whatsapp
            ),

        remind_by_sms:
            Boolean(
                event.remind_by_sms
            ),

        nextEventDate:
            nextDate
                ? formatDate(nextDate)
                : null,

        nextReminderDate:
            reminderDate
                ? formatDate(
                    reminderDate
                )
                : null,

        daysUntil:
            nextDate
                ? daysBetween(
                    startOfToday(),
                    nextDate
                )
                : null
    };
}

function validatePayload(body) {
    const eventType =
        cleanText(
            body.event_type,
            50
        );

    const eventName =
        cleanText(
            body.event_name,
            150
        );

    const eventDate =
        cleanText(
            body.event_date,
            10
        );

    const recurrence =
        cleanText(
            body.recurrence ||
            "Yearly",
            30
        );

    const reminderDays =
        body.reminder_days ===
        undefined
            ? 5
            : Number(
                body.reminder_days
            );

    const channels = {
        remind_by_email:
            toBooleanNumber(
                body.remind_by_email
            ),

        remind_by_whatsapp:
            toBooleanNumber(
                body.remind_by_whatsapp
            ),

        remind_by_sms:
            toBooleanNumber(
                body.remind_by_sms
            )
    };

    if (
        !ALLOWED_EVENT_TYPES
            .has(eventType)
    ) {
        return {
            valid: false,
            message:
                "Please select a valid event type."
        };
    }

    if (!eventName) {
        return {
            valid: false,
            message:
                "Event name is required."
        };
    }

    if (!isValidDate(eventDate)) {
        return {
            valid: false,
            message:
                "A valid event date is required."
        };
    }

    if (
        !ALLOWED_RECURRENCES
            .has(recurrence)
    ) {
        return {
            valid: false,
            message:
                "Please select a valid recurrence."
        };
    }

    if (
        recurrence ===
            "One Time" &&
        parseDate(eventDate) <
            startOfToday()
    ) {
        return {
            valid: false,
            message:
                "A one-time event cannot use a past date."
        };
    }

    if (
        !Number.isInteger(
            reminderDays
        ) ||
        reminderDays < 1 ||
        reminderDays > 30
    ) {
        return {
            valid: false,
            message:
                "Reminder days must be between 1 and 30."
        };
    }

    if (
        !channels.remind_by_email &&
        !channels.remind_by_whatsapp &&
        !channels.remind_by_sms
    ) {
        return {
            valid: false,
            message:
                "Please select at least one reminder channel."
        };
    }

    return {
        valid: true,
        data: {
            event_type:
                eventType,

            event_name:
                eventName,

            event_date:
                eventDate,

            recurrence,

            reminder_days:
                reminderDays,

            ...channels,

            notes:
                cleanText(
                    body.notes,
                    2000
                ) ||
                null
        }
    };
}

async function getCustomerPolicy(
    customerId
) {
    const [rows] =
        await db.query(
            `
            SELECT
                c.id,
                c.full_name,
                c.email,
                c.phone,
                c.status,
                c.deleted_at,
                c.email_verified_at,
                c.phone_verified_at,
                c.email_reminders_enabled
                    AS customer_email_enabled,
                c.whatsapp_reminders_enabled
                    AS customer_whatsapp_enabled,
                c.sms_reminders_enabled
                    AS customer_sms_enabled,

                COALESCE(
                    cr.membership_level,
                    'Bronze'
                ) AS membership_level,

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

            FROM customers c

            LEFT JOIN customer_rewards cr
                ON cr.customer_id =
                    c.id

            LEFT JOIN customer_loyalty_categories lc
                ON lc.category_name =
                    cr.membership_level
                AND lc.status =
                    'Active'

            WHERE c.id = ?
              AND c.status IN (
                    'Active',
                    'Pending Verification'
              )
              AND c.deleted_at IS NULL

            LIMIT 1
            `,
            [customerId]
        );

    return rows[0] || null;
}

async function validateChannels(
    customerId,
    eventData
) {
    const customer =
        await getCustomerPolicy(
            customerId
        );

    if (!customer) {
        return {
            valid: false,
            message:
                "Customer account was not found."
        };
    }

    const menuCheck =
        canUseEventMenu({
            eventMenuEnabled:
                customer.event_menu_enabled
        });

    if (!menuCheck.valid) {
        return menuCheck;
    }

    const checks = [
        validateChannel({
            channel:
                "Email",

            selected:
                eventData.remind_by_email,

            contact:
                customer.email,

            verified:
                customer.email_verified_at,

            customerEnabled:
                customer.customer_email_enabled,

            categoryEnabled:
                customer.category_email_enabled,

            membershipLevel:
                customer.membership_level
        }),

        validateChannel({
            channel:
                "WhatsApp",

            selected:
                eventData.remind_by_whatsapp,

            contact:
                customer.phone,

            verified:
                customer.phone_verified_at,

            customerEnabled:
                customer.customer_whatsapp_enabled,

            categoryEnabled:
                customer.category_whatsapp_enabled,

            membershipLevel:
                customer.membership_level
        }),

        validateChannel({
            channel:
                "SMS",

            selected:
                eventData.remind_by_sms,

            contact:
                customer.phone,

            verified:
                customer.phone_verified_at,

            customerEnabled:
                customer.customer_sms_enabled,

            categoryEnabled:
                customer.category_sms_enabled,

            membershipLevel:
                customer.membership_level
        })
    ];

    const failed =
        checks.find(
            check =>
                !check.valid
        );

    if (failed) {
        return failed;
    }

    return {
        valid: true,
        mode:
            getCustomerVerificationMode(),
        developmentBypass:
            isDevelopmentMode()
    };
}

async function getOwnedEvent(
    eventId,
    customerId
) {
    const [rows] =
        await db.query(
            `
            SELECT
                id,
                customer_id,
                event_type,
                event_name,
                DATE_FORMAT(
                    event_date,
                    '%Y-%m-%d'
                ) AS event_date,
                recurrence,
                reminder_days,
                remind_by_email,
                remind_by_whatsapp,
                remind_by_sms,
                notes,
                status,
                created_at,
                updated_at

            FROM customer_events

            WHERE id = ?
              AND customer_id = ?

            LIMIT 1
            `,
            [
                eventId,
                customerId
            ]
        );

    return rows[0] || null;
}

function sendError(
    res,
    error,
    fallback
) {
    console.error(
        fallback,
        error
    );

    return res.status(500).json({
        success: false,
        message:
            fallback,
        error:
            process.env.NODE_ENV ===
            "production"
                ? undefined
                : error.message
    });
}

exports.getPolicyStatus = async (
    req,
    res
) => {
    try {
        const customerId =
            customerIdFromRequest(req);

        const customer =
            await getCustomerPolicy(
                customerId
            );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });
        }

        return res.json({
            success: true,
            mode:
                getCustomerVerificationMode(),
            developmentBypass:
                isDevelopmentMode(),
            policy: {
                membershipLevel:
                    customer.membership_level,

                eventMenuEnabled:
                    Boolean(
                        customer.event_menu_enabled
                    ),

                email: {
                    available:
                        Boolean(
                            customer.email
                        ),
                    verified:
                        Boolean(
                            customer.email_verified_at
                        ),
                    preferenceEnabled:
                        Boolean(
                            customer.customer_email_enabled
                        ),
                    categoryEnabled:
                        Boolean(
                            customer.category_email_enabled
                        )
                },

                whatsapp: {
                    available:
                        Boolean(
                            customer.phone
                        ),
                    verified:
                        Boolean(
                            customer.phone_verified_at
                        ),
                    preferenceEnabled:
                        Boolean(
                            customer.customer_whatsapp_enabled
                        ),
                    categoryEnabled:
                        Boolean(
                            customer.category_whatsapp_enabled
                        )
                },

                sms: {
                    available:
                        Boolean(
                            customer.phone
                        ),
                    verified:
                        Boolean(
                            customer.phone_verified_at
                        ),
                    preferenceEnabled:
                        Boolean(
                            customer.customer_sms_enabled
                        ),
                    categoryEnabled:
                        Boolean(
                            customer.category_sms_enabled
                        )
                }
            }
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to load event policy status."
        );
    }
};

exports.createEvent = async (
    req,
    res
) => {
    try {
        const customerId =
            customerIdFromRequest(req);

        const validation =
            validatePayload(
                req.body || {}
            );

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message:
                    validation.message
            });
        }

        const channelCheck =
            await validateChannels(
                customerId,
                validation.data
            );

        if (!channelCheck.valid) {
            return res.status(400).json({
                success: false,
                code:
                    channelCheck.code,
                message:
                    channelCheck.message
            });
        }

        const data =
            validation.data;

        const [result] =
            await db.query(
                `
                INSERT INTO customer_events
                (
                    customer_id,
                    event_type,
                    event_name,
                    event_date,
                    recurrence,
                    reminder_days,
                    remind_by_email,
                    remind_by_whatsapp,
                    remind_by_sms,
                    notes,
                    status
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    'Active'
                )
                `,
                [
                    customerId,
                    data.event_type,
                    data.event_name,
                    data.event_date,
                    data.recurrence,
                    data.reminder_days,
                    data.remind_by_email,
                    data.remind_by_whatsapp,
                    data.remind_by_sms,
                    data.notes
                ]
            );

        const event =
            await getOwnedEvent(
                result.insertId,
                customerId
            );

        return res.status(201).json({
            success: true,
            message:
                "Special event created successfully.",
            mode:
                getCustomerVerificationMode(),
            developmentBypass:
                isDevelopmentMode(),
            event:
                enrichEvent(event)
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to create special event."
        );
    }
};

exports.getEvents = async (
    req,
    res
) => {
    try {
        const customerId =
            customerIdFromRequest(req);

        const includeInactive =
            String(
                req.query.includeInactive ||
                ""
            )
                .trim()
                .toLowerCase() ===
            "true";

        let sql = `
            SELECT
                id,
                customer_id,
                event_type,
                event_name,
                DATE_FORMAT(
                    event_date,
                    '%Y-%m-%d'
                ) AS event_date,
                recurrence,
                reminder_days,
                remind_by_email,
                remind_by_whatsapp,
                remind_by_sms,
                notes,
                status,
                created_at,
                updated_at
            FROM customer_events
            WHERE customer_id = ?
        `;

        if (!includeInactive) {
            sql += `
                AND status = 'Active'
            `;
        }

        sql += `
            ORDER BY
                event_date ASC,
                id DESC
        `;

        const [rows] =
            await db.query(
                sql,
                [customerId]
            );

        const events =
            rows
                .map(enrichEvent)
                .sort(
                    (
                        first,
                        second
                    ) =>
                        (
                            first.daysUntil ??
                            999999
                        ) -
                        (
                            second.daysUntil ??
                            999999
                        )
                );

        return res.json({
            success: true,
            count:
                events.length,
            events
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to load special events."
        );
    }
};

exports.getUpcomingEvents = async (
    req,
    res
) => {
    try {
        const customerId =
            customerIdFromRequest(req);

        const requestedDays =
            Number(
                req.query.days ||
                60
            );

        const days =
            Number.isInteger(
                requestedDays
            )
                ? Math.min(
                    Math.max(
                        requestedDays,
                        1
                    ),
                    365
                )
                : 60;

        const [rows] =
            await db.query(
                `
                SELECT
                    id,
                    customer_id,
                    event_type,
                    event_name,
                    DATE_FORMAT(
                        event_date,
                        '%Y-%m-%d'
                    ) AS event_date,
                    recurrence,
                    reminder_days,
                    remind_by_email,
                    remind_by_whatsapp,
                    remind_by_sms,
                    notes,
                    status,
                    created_at,
                    updated_at
                FROM customer_events
                WHERE customer_id = ?
                  AND status = 'Active'
                `,
                [customerId]
            );

        const events =
            rows
                .map(enrichEvent)
                .filter(
                    event =>
                        Number.isInteger(
                            event.daysUntil
                        ) &&
                        event.daysUntil >= 0 &&
                        event.daysUntil <=
                            days
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        first.daysUntil -
                        second.daysUntil
                );

        return res.json({
            success: true,
            periodDays:
                days,
            count:
                events.length,
            events
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to load upcoming events."
        );
    }
};

exports.getEventById = async (
    req,
    res
) => {
    try {
        const eventId =
            Number(
                req.params.id
            );

        const customerId =
            customerIdFromRequest(req);

        if (
            !Number.isInteger(eventId) ||
            eventId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid event ID is required."
            });
        }

        const event =
            await getOwnedEvent(
                eventId,
                customerId
            );

        if (!event) {
            return res.status(404).json({
                success: false,
                message:
                    "Special event was not found."
            });
        }

        return res.json({
            success: true,
            event:
                enrichEvent(event)
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to load special event."
        );
    }
};

exports.updateEvent = async (
    req,
    res
) => {
    try {
        const eventId =
            Number(
                req.params.id
            );

        const customerId =
            customerIdFromRequest(req);

        if (
            !Number.isInteger(eventId) ||
            eventId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid event ID is required."
            });
        }

        const existing =
            await getOwnedEvent(
                eventId,
                customerId
            );

        if (!existing) {
            return res.status(404).json({
                success: false,
                message:
                    "Special event was not found."
            });
        }

        const validation =
            validatePayload(
                req.body || {}
            );

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message:
                    validation.message
            });
        }

        const channelCheck =
            await validateChannels(
                customerId,
                validation.data
            );

        if (!channelCheck.valid) {
            return res.status(400).json({
                success: false,
                code:
                    channelCheck.code,
                message:
                    channelCheck.message
            });
        }

        const data =
            validation.data;

        await db.query(
            `
            UPDATE customer_events
            SET
                event_type = ?,
                event_name = ?,
                event_date = ?,
                recurrence = ?,
                reminder_days = ?,
                remind_by_email = ?,
                remind_by_whatsapp = ?,
                remind_by_sms = ?,
                notes = ?,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
              AND customer_id = ?
            `,
            [
                data.event_type,
                data.event_name,
                data.event_date,
                data.recurrence,
                data.reminder_days,
                data.remind_by_email,
                data.remind_by_whatsapp,
                data.remind_by_sms,
                data.notes,
                eventId,
                customerId
            ]
        );

        const updated =
            await getOwnedEvent(
                eventId,
                customerId
            );

        return res.json({
            success: true,
            message:
                "Special event updated successfully.",
            mode:
                getCustomerVerificationMode(),
            developmentBypass:
                isDevelopmentMode(),
            event:
                enrichEvent(updated)
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to update special event."
        );
    }
};

async function changeStatus(
    req,
    res,
    fromStatus,
    toStatus
) {
    try {
        const eventId =
            Number(
                req.params.id
            );

        const customerId =
            customerIdFromRequest(req);

        const [result] =
            await db.query(
                `
                UPDATE customer_events
                SET
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                  AND customer_id = ?
                  AND status = ?
                `,
                [
                    toStatus,
                    eventId,
                    customerId,
                    fromStatus
                ]
            );

        if (
            result.affectedRows ===
            0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Matching special event was not found."
            });
        }

        return res.json({
            success: true,
            message:
                `Special event ${toStatus.toLowerCase()} successfully.`
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to update event status."
        );
    }
}

exports.deactivateEvent = (
    req,
    res
) =>
    changeStatus(
        req,
        res,
        "Active",
        "Inactive"
    );

exports.restoreEvent = (
    req,
    res
) =>
    changeStatus(
        req,
        res,
        "Inactive",
        "Active"
    );

exports.deleteEvent = async (
    req,
    res
) => {
    try {
        const eventId =
            Number(
                req.params.id
            );

        const customerId =
            customerIdFromRequest(req);

        const [result] =
            await db.query(
                `
                DELETE FROM customer_events
                WHERE id = ?
                  AND customer_id = ?
                  AND status = 'Inactive'
                `,
                [
                    eventId,
                    customerId
                ]
            );

        if (
            result.affectedRows ===
            0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Deactivate the event before permanently deleting it."
            });
        }

        return res.json({
            success: true,
            message:
                "Special event permanently deleted."
        });
    } catch (error) {
        return sendError(
            res,
            error,
            "Unable to delete special event."
        );
    }
};
