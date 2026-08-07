"use strict";

const crypto = require("crypto");
const db = require("../config/db");
const providerService =
    require("./notificationProviderService");
const templateService =
    require("./notificationTemplateService");

const CHANNELS = [
    "Email",
    "WhatsApp",
    "SMS"
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
    if (channel === "Email") {
        return Boolean(
            customer.email_verified_at
        );
    }

    return Boolean(
        customer.phone_verified_at
    );
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
                    dedupe_key
                )
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

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
    forceChannels = null
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
                    fallbackMessage:
                        `${eventKey} notification`
                });

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
                payload:
                    allVariables,
                priority:
                    rule.priority,
                maxAttempts:
                    rule.max_attempts,
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

async function sendByChannel(
    item
) {
    if (item.channel === "Email") {
        return providerService
            .sendEmail({
                to:
                    item.recipient,
                subject:
                    item.subject ||
                    "RUKHNAV Notification",
                message:
                    item.message
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

        const finalFailure =
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
