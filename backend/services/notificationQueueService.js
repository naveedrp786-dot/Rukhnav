"use strict";

const crypto = require("crypto");
const db = require("../config/db");
const providerService =
    require("./notificationProviderService");
const templateService =
    require("./notificationTemplateService");
const pushNotificationService =
    require("./pushNotificationService");

const CHANNELS = [
    "Email",
    "WhatsApp",
    "SMS",
    "Push"
];

function booleanValue(
    value
) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    );
}

function retryDelayMinutes(
    attempt
) {
    const delays = [
        1,
        5,
        15,
        60,
        180
    ];

    return delays[
        Math.min(
            Math.max(
                attempt - 1,
                0
            ),
            delays.length - 1
        )
    ];
}

function makeDedupeKey(
    value
) {
    if (!value) {
        return null;
    }

    return crypto
        .createHash("sha256")
        .update(
            String(value)
        )
        .digest("hex");
}

async function customerProfile(
    customerId
) {
    const [rows] =
        await db.query(
            `
            SELECT
                id,
                full_name,
                email,
                phone,
                status,
                email_verified_at,
                phone_verified_at,
                email_reminders_enabled,
                whatsapp_reminders_enabled,
                sms_reminders_enabled
            FROM customers
            WHERE id = ?
              AND deleted_at IS NULL
            LIMIT 1
            `,
            [
                customerId
            ]
        );

    return rows[0] || null;
}

async function channelSetting(
    channel
) {
    const [rows] =
        await db.query(
            `
            SELECT
                channel,
                enabled,
                provider,
                simulation_mode,
                from_name,
                from_address
            FROM notification_channel_settings
            WHERE channel = ?
            LIMIT 1
            `,
            [
                channel
            ]
        );

    return rows[0] || null;
}

function recipientFor(
    customer,
    channel
) {
    if (channel === "Email") {
        return customer.email || "";
    }

    return customer.phone || "";
}

function customerAllows(
    customer,
    channel
) {
    if (channel === "Push") {
        /*
         * Registering an active mobile push device
         * represents the customer's current push opt-in.
         */
        return true;
    }

    if (channel === "Email") {
        return booleanValue(
            customer
                .email_reminders_enabled
        );
    }

    if (channel === "WhatsApp") {
        return booleanValue(
            customer
                .whatsapp_reminders_enabled
        );
    }

    return booleanValue(
        customer
            .sms_reminders_enabled
    );
}

function verifiedFor(
    customer,
    channel
) {
    if (channel === "Push") {
        /*
         * Expo device registration is authenticated,
         * so Push does not depend on email/phone
         * verification.
         */
        return true;
    }

    if (channel === "Email") {
        return Boolean(
            customer.email_verified_at
        );
    }

    return Boolean(
        customer.phone_verified_at
    );
}


async function activePushDevices(
    customerId
) {
    const [rows] =
        await db.query(
            `
            SELECT
                id,
                expo_push_token,
                platform,
                device_name,
                device_id
            FROM customer_push_devices
            WHERE customer_id = ?
              AND is_active = 1
            ORDER BY id ASC
            `,
            [
                customerId
            ]
        );

    return rows;
}

async function queueNotification({
    eventKey,
    customerId = null,
    channel,
    templateKey = null,
    recipient,
    subject = "",
    message,
    payload = {},
    priority = 5,
    maxAttempts = 3,
    scheduledFor = null,
    dedupeKey = null
}) {
    if (
        !CHANNELS.includes(
            channel
        )
    ) {
        throw new Error(
            "Invalid notification channel."
        );
    }

    if (!recipient) {
        return {
            queued: false,
            skipped: true,
            reason:
                "Recipient is missing."
        };
    }

    let nextAttemptAt = null;

    if (scheduledFor) {
        const scheduledDate =
            scheduledFor instanceof Date
                ? scheduledFor
                : new Date(scheduledFor);

        if (
            Number.isNaN(
                scheduledDate.getTime()
            )
        ) {
            throw new Error(
                "Invalid notification scheduled time."
            );
        }

        nextAttemptAt =
            scheduledDate;
    }

    const [result] =
        await db.query(
            `
            INSERT INTO notification_queue
                (
                    event_key,
                    customer_id,
                    channel,
                    template_key,
                    recipient,
                    subject,
                    message,
                    payload_json,
                    priority,
                    max_attempts,
                    next_attempt_at,
                    dedupe_key
                )
            VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE(?, CURRENT_TIMESTAMP),
                    ?
                )

            ON DUPLICATE KEY UPDATE
                id = LAST_INSERT_ID(id)
            `,
            [
                eventKey,
                customerId,
                channel,
                templateKey,
                recipient,
                subject || null,
                message,
                JSON.stringify(
                    payload || {}
                ),
                Number(priority) || 5,
                Number(maxAttempts) || 3,
                nextAttemptAt,
                makeDedupeKey(
                    dedupeKey
                )
            ]
        );

    return {
        queued: true,
        queueId:
            Number(
                result.insertId
            )
    };
}

async function queueCustomerEvent({
    eventKey,
    customerId,
    variables = {},
    dedupeReference = "",
    forceChannels = null,
    scheduledFor = null
}) {
    const customer =
        await customerProfile(
            customerId
        );

    if (!customer) {
        return {
            queued: 0,
            skipped: [
                "Customer not found."
            ]
        };
    }

    const [rules] =
        await db.query(
            `
            SELECT
                event_key,
                channel,
                template_key,
                respect_customer_preference,
                priority,
                max_attempts
            FROM notification_event_rules
            WHERE event_key = ?
              AND enabled = 1
            ORDER BY priority ASC, id ASC
            `,
            [
                eventKey
            ]
        );

    const selectedRules =
        Array.isArray(forceChannels)
            ? rules.filter(
                rule =>
                    forceChannels.includes(
                        rule.channel
                    )
            )
            : rules;

    const results = [];
    const skipped = [];

    for (
        const rule of selectedRules
    ) {
        const setting =
            await channelSetting(
                rule.channel
            );

        if (
            !setting ||
            !booleanValue(
                setting.enabled
            )
        ) {
            skipped.push(
                `${rule.channel}: channel is disabled.`
            );

            continue;
        }

        if (
            booleanValue(
                rule
                    .respect_customer_preference
            ) &&
            !customerAllows(
                customer,
                rule.channel
            )
        ) {
            skipped.push(
                `${rule.channel}: customer preference is disabled.`
            );

            continue;
        }

        if (
            !verifiedFor(
                customer,
                rule.channel
            )
        ) {
            skipped.push(
                `${rule.channel}: recipient is not verified.`
            );

            continue;
        }

        const allVariables = {
            customer_id:
                customer.id,
            customer_name:
                customer.full_name ||
                "Customer",
            customer_email:
                customer.email || "",
            customer_phone:
                customer.phone || "",
            ...variables
        };

        const rendered =
            await templateService
                .renderTemplate({
                    templateKey:
                        rule.template_key,
                    channel:
                        rule.channel,
                    variables:
                        allVariables,
                    fallbackSubject:
                        rule.channel === "Push"
                            ? "RUKHNAV"
                            : "",
                    fallbackMessage:
                        `${eventKey} notification`
                });

        /*
         * Push is different from Email / WhatsApp / SMS:
         * one customer can own multiple active devices.
         * Each device therefore receives its own queue row.
         */
        if (rule.channel === "Push") {
            const devices =
                await activePushDevices(
                    customer.id
                );

            if (!devices.length) {
                skipped.push(
                    "Push: no active mobile device."
                );

                continue;
            }

            for (const device of devices) {
                const queued =
                    await queueNotification({
                        eventKey,
                        customerId:
                            customer.id,
                        channel:
                            "Push",
                        templateKey:
                            rule.template_key,
                        recipient:
                            device.expo_push_token,
                        subject:
                            rendered.subject ||
                            "RUKHNAV",
                        message:
                            rendered.message,
                        payload: {
                            ...allVariables,
                            push_device_id:
                                device.id,
                            push_platform:
                                device.platform
                        },
                        priority:
                            rule.priority,
                        maxAttempts:
                            rule.max_attempts,
                        scheduledFor,
                        dedupeKey:
                            dedupeReference
                                ? [
                                    eventKey,
                                    "Push",
                                    customer.id,
                                    device.id,
                                    dedupeReference
                                ].join(":")
                                : null
                    });

                results.push(
                    queued
                );
            }

            continue;
        }

        const recipient =
            recipientFor(
                customer,
                rule.channel
            );

        if (!recipient) {
            skipped.push(
                `${rule.channel}: recipient is missing.`
            );

            continue;
        }

        const queued =
            await queueNotification({
                eventKey,
                customerId:
                    customer.id,
                channel:
                    rule.channel,
                templateKey:
                    rule.template_key,
                recipient,
                subject:
                    rendered.subject,
                message:
                    rendered.message,
                payload: {
                    ...allVariables,

                    emailHeading:
                        rendered.emailHeading ||
                        "",

                    emailPreheader:
                        rendered.emailPreheader ||
                        "",

                    emailButtonText:
                        rendered.emailButtonText ||
                        "",

                    emailButtonUrl:
                        rendered.emailButtonUrl ||
                        "",

                    emailBannerUrl:
                        rendered.emailBannerUrl ||
                        ""
                },

                priority:
                    rule.priority,
                maxAttempts:
                    rule.max_attempts,
                scheduledFor,
                dedupeKey:
                    dedupeReference
                        ? [
                            eventKey,
                            rule.channel,
                            customer.id,
                            dedupeReference
                        ].join(":")
                        : null
            });

        results.push(queued);
    }

    return {
        queued:
            results.filter(
                item =>
                    item.queued
            ).length,
        results,
        skipped
    };
}

function queuePayload(item) {

    const raw =
        item?.payload_json;

    if (!raw) {
        return {};
    }

    if (
        typeof raw === "object" &&
        !Buffer.isBuffer(raw)
    ) {
        return raw;
    }

    try {
        return JSON.parse(
            Buffer.isBuffer(raw)
                ? raw.toString("utf8")
                : String(raw)
        );
    } catch (error) {
        console.error(
            `Unable to parse notification payload for queue ${item?.id || "unknown"}:`,
            error.message
        );

        return {};
    }
}


async function sendByChannel(
    item
) {
    if (item.channel === "Email") {

        const payload =
            queuePayload(item);

        return providerService
            .sendEmail({
                to:
                    item.recipient,

                subject:
                    item.subject ||
                    "RUKHNAV Notification",

                message:
                    item.message,

                heading:
                    payload.emailHeading ||
                    "",

                preheader:
                    payload.emailPreheader ||
                    "",

                buttonText:
                    payload.emailButtonText ||
                    "",

                buttonUrl:
                    payload.emailButtonUrl ||
                    "",

                bannerUrl:
                    payload.emailBannerUrl ||
                    ""
            });
    }

    if (
        item.channel ===
        "WhatsApp"
    ) {
        return providerService
            .sendWhatsApp({
                to:
                    item.recipient,
                message:
                    item.message
            });
    }

    if (
        item.channel ===
        "Push"
    ) {
        const payload =
            queuePayload(item);

        return pushNotificationService
            .sendPush({
                to:
                    item.recipient,
                title:
                    item.subject ||
                    "RUKHNAV",
                message:
                    item.message,
                data: {
                    eventKey:
                        item.event_key ||
                        "",
                    orderId:
                        payload.order_id ||
                        payload.orderId ||
                        null,
                    orderNumber:
                        payload.order_number ||
                        payload.orderNumber ||
                        null,
                    actionUrl:
                        payload.action_url ||
                        payload.actionUrl ||
                        ""
                },
                priority:
                    Number(item.priority) <= 2
                        ? "high"
                        : "default"
            });
    }

    return providerService
        .sendSms({
            to:
                item.recipient,
            message:
                item.message
        });
}

async function logDelivery({
    item,
    status,
    provider,
    providerMessageId = null,
    errorMessage = null
}) {
    await db.query(
        `
        INSERT INTO notification_delivery_logs
            (
                queue_id,
                customer_id,
                event_key,
                channel,
                template_key,
                recipient,
                subject,
                message,
                status,
                attempt_number,
                provider,
                provider_message_id,
                error_message,
                sent_at
            )
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            item.id,
            item.customer_id,
            item.event_key,
            item.channel,
            item.template_key,
            item.recipient,
            item.subject,
            item.message,
            status,
            Number(
                item.attempt_count
            ) + 1,
            provider,
            providerMessageId,
            errorMessage,
            [
                "Sent",
                "Simulated"
            ].includes(status)
                ? new Date()
                : null
        ]
    );
}

async function claimBatch({
    limit = 20,
    workerId
}) {
    const connection =
        await db.getConnection();

    try {
        await connection
            .beginTransaction();

        const [rows] =
            await connection.query(
                `
                SELECT *
                FROM notification_queue
                WHERE status IN (
                    'Queued',
                    'Retrying'
                )
                  AND next_attempt_at <=
                      CURRENT_TIMESTAMP
                  AND (
                        channel <> 'WhatsApp'
                        OR id = (
                            SELECT whatsapp_next.id
                            FROM (
                                SELECT id
                                FROM notification_queue
                                WHERE status IN (
                                    'Queued',
                                    'Retrying'
                                )
                                  AND next_attempt_at <=
                                      CURRENT_TIMESTAMP
                                  AND channel = 'WhatsApp'
                                ORDER BY
                                    priority ASC,
                                    id ASC
                                LIMIT 1
                            ) AS whatsapp_next
                        )
                  )
                ORDER BY
                    priority ASC,
                    id ASC
                LIMIT ?
                FOR UPDATE SKIP LOCKED
                `,
                [
                    Number(limit)
                ]
            );

        if (rows.length) {
            await connection.query(
                `
                UPDATE notification_queue
                SET
                    status = 'Processing',
                    locked_at =
                        CURRENT_TIMESTAMP,
                    locked_by = ?
                WHERE id IN (?)
                `,
                [
                    workerId,
                    rows.map(
                        row =>
                            row.id
                    )
                ]
            );
        }

        await connection.commit();

        return rows;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function processItem(
    item
) {
    const setting =
        await channelSetting(
            item.channel
        );

    if (
        !setting ||
        !booleanValue(
            setting.enabled
        )
    ) {
        await db.query(
            `
            UPDATE notification_queue
            SET
                status = 'Skipped',
                last_error =
                    'Channel disabled',
                processed_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                item.id
            ]
        );

        await logDelivery({
            item,
            status:
                "Failed",
            provider:
                setting?.provider ||
                null,
            errorMessage:
                "Channel disabled."
        });

        return {
            status:
                "Skipped"
        };
    }

    try {
        const result =
            await sendByChannel(
                item
            );

        const status =
            result.simulated
                ? "Simulated"
                : "Sent";

        await db.query(
            `
            UPDATE notification_queue
            SET
                status = ?,
                attempt_count =
                    attempt_count + 1,
                provider_message_id = ?,
                last_error = NULL,
                processed_at =
                    CURRENT_TIMESTAMP,
                locked_at = NULL,
                locked_by = NULL
            WHERE id = ?
            `,
            [
                status,
                result.providerMessageId ||
                null,
                item.id
            ]
        );

        await logDelivery({
            item,
            status,
            provider:
                setting.provider,
            providerMessageId:
                result.providerMessageId ||
                null
        });

        return {
            status
        };
    } catch (error) {
        const attempt =
            Number(
                item.attempt_count
            ) + 1;

        const permanentFailure =
            String(
                error?.message || ""
            ).startsWith(
                "PUSH_PERMANENT:"
            );

        const finalFailure =
            permanentFailure ||
            attempt >=
            Number(
                item.max_attempts
            );

        const nextStatus =
            finalFailure
                ? "Failed"
                : "Retrying";

        const delay =
            retryDelayMinutes(
                attempt
            );

        await db.query(
            `
            UPDATE notification_queue
            SET
                status = ?,
                attempt_count = ?,
                next_attempt_at =
                    DATE_ADD(
                        CURRENT_TIMESTAMP,
                        INTERVAL ? MINUTE
                    ),
                last_error = ?,
                locked_at = NULL,
                locked_by = NULL,
                processed_at =
                    CASE
                        WHEN ? = 'Failed'
                        THEN CURRENT_TIMESTAMP
                        ELSE processed_at
                    END
            WHERE id = ?
            `,
            [
                nextStatus,
                attempt,
                delay,
                String(
                    error.message ||
                    error
                ).slice(
                    0,
                    4000
                ),
                nextStatus,
                item.id
            ]
        );

        await logDelivery({
            item,
            status:
                "Failed",
            provider:
                setting.provider,
            errorMessage:
                error.message
        });

        return {
            status:
                nextStatus,
            error:
                error.message
        };
    }
}

async function processQueue({
    limit = 20,
    workerId =
        `worker-${process.pid}`
} = {}) {
    const items =
        await claimBatch({
            limit,
            workerId
        });

    const summary = {
        claimed:
            items.length,
        sent: 0,
        simulated: 0,
        retrying: 0,
        failed: 0,
        skipped: 0
    };

    for (const item of items) {
        const result =
            await processItem(
                item
            );

        const key =
            String(
                result.status || ""
            ).toLowerCase();

        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    summary,
                    key
                )
        ) {
            summary[key] += 1;
        }
    }

    return summary;
}

async function retryQueueItem(
    queueId
) {
    const [result] =
        await db.query(
            `
            UPDATE notification_queue
            SET
                status = 'Queued',
                next_attempt_at =
                    CURRENT_TIMESTAMP,
                locked_at = NULL,
                locked_by = NULL,
                last_error = NULL
            WHERE id = ?
              AND status IN (
                    'Failed',
                    'Retrying',
                    'Skipped'
              )
            `,
            [
                queueId
            ]
        );

    return (
        result.affectedRows > 0
    );
}

module.exports = {
    queueNotification,
    queueCustomerEvent,
    processQueue,
    retryQueueItem
};
