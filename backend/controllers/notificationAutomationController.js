"use strict";

const db = require("../config/db");
const queueService =
    require("../services/notificationQueueService");
const worker =
    require("../jobs/notificationQueueWorker");

exports.getQueue = async (
    req,
    res
) => {
    try {
        const status =
            String(
                req.query.status || ""
            ).trim();

        const channel =
            String(
                req.query.channel || ""
            ).trim();

        const where = [
            "1 = 1"
        ];

        const params = [];

        if (status) {
            where.push(
                "q.status = ?"
            );

            params.push(
                status
            );
        }

        if (channel) {
            where.push(
                "q.channel = ?"
            );

            params.push(
                channel
            );
        }

        const [items] =
            await db.query(
                `
                SELECT
                    q.id,
                    q.event_key,
                    q.customer_id,
                    q.channel,
                    q.template_key,
                    q.recipient,
                    q.subject,
                    q.status,
                    q.priority,
                    q.attempt_count,
                    q.max_attempts,
                    q.next_attempt_at,
                    q.last_error,
                    q.provider_message_id,
                    q.processed_at,
                    q.created_at,
                    c.full_name
                        AS customer_name
                FROM notification_queue q
                LEFT JOIN customers c
                    ON c.id =
                        q.customer_id
                WHERE
                    ${where.join(" AND ")}
                ORDER BY q.id DESC
                LIMIT 500
                `,
                params
            );

        const [[summary]] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total,
                    SUM(status = 'Queued')
                        AS queued,
                    SUM(status = 'Processing')
                        AS processing,
                    SUM(status = 'Retrying')
                        AS retrying,
                    SUM(status = 'Sent')
                        AS sent,
                    SUM(status = 'Simulated')
                        AS simulated,
                    SUM(status = 'Failed')
                        AS failed,
                    SUM(status = 'Skipped')
                        AS skipped
                FROM notification_queue
                `
            );

        res.json({
            success:
                true,
            items,
            summary
        });
    } catch (error) {
        res.status(500).json({
            success:
                false,
            message:
                error.message
        });
    }
};

exports.processQueue = async (
    req,
    res
) => {
    try {
        const summary =
            await worker.runCycle();

        res.json({
            success:
                true,
            message:
                "Notification queue cycle completed.",
            summary
        });
    } catch (error) {
        res.status(500).json({
            success:
                false,
            message:
                error.message
        });
    }
};

exports.retryItem = async (
    req,
    res
) => {
    try {
        const queueId =
            Number(
                req.params.id
            );

        if (!queueId) {
            return res
                .status(400)
                .json({
                    success:
                        false,
                    message:
                        "A valid queue ID is required."
                });
        }

        const updated =
            await queueService
                .retryQueueItem(
                    queueId
                );

        if (!updated) {
            return res
                .status(409)
                .json({
                    success:
                        false,
                    message:
                        "Only failed, retrying or skipped items can be queued again."
                });
        }

        res.json({
            success:
                true,
            message:
                "Notification queued for retry."
        });
    } catch (error) {
        res.status(500).json({
            success:
                false,
            message:
                error.message
        });
    }
};

exports.queueManualEvent = async (
    req,
    res
) => {
    try {
        const customerId =
            Number(
                req.body.customer_id
            );

        const eventKey =
            String(
                req.body.event_key || ""
            ).trim();

        if (
            !customerId ||
            !eventKey
        ) {
            return res
                .status(400)
                .json({
                    success:
                        false,
                    message:
                        "Customer ID and event key are required."
                });
        }

        const result =
            await queueService
                .queueCustomerEvent({
                    eventKey,
                    customerId,
                    variables:
                        req.body.variables ||
                        {},
                    dedupeReference:
                        req.body
                            .dedupe_reference ||
                        `manual-${Date.now()}`,
                    forceChannels:
                        Array.isArray(
                            req.body.channels
                        )
                            ? req.body.channels
                            : null
                });

        res.json({
            success:
                true,
            message:
                `${result.queued} notification(s) queued.`,
            result
        });
    } catch (error) {
        res.status(500).json({
            success:
                false,
            message:
                error.message
        });
    }
};
