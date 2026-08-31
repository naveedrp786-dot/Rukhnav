"use strict";

const db = require("../config/db");


async function syncCampaignRecipientStatuses() {

    // =====================================================
    // Email status synchronization
    // =====================================================

    await db.query(`
        UPDATE notification_campaign_recipients r

        INNER JOIN notification_queue q
            ON q.id = r.email_queue_id

        SET
            r.email_status =
                CASE
                    WHEN q.status IN (
                        'Sent',
                        'Simulated'
                    )
                    THEN 'Sent'

                    WHEN q.status = 'Failed'
                    THEN 'Failed'

                    WHEN q.status = 'Skipped'
                    THEN 'Skipped'

                    ELSE r.email_status
                END,

            r.email_error =
                CASE
                    WHEN q.status IN (
                        'Failed',
                        'Skipped'
                    )
                    THEN q.last_error

                    WHEN q.status IN (
                        'Sent',
                        'Simulated'
                    )
                    THEN NULL

                    ELSE r.email_error
                END,

            r.email_sent_at =
                CASE
                    WHEN q.status IN (
                        'Sent',
                        'Simulated'
                    )
                    THEN COALESCE(
                        q.processed_at,
                        CURRENT_TIMESTAMP
                    )

                    ELSE r.email_sent_at
                END

        WHERE r.email_queue_id IS NOT NULL
          AND q.status IN (
                'Sent',
                'Simulated',
                'Failed',
                'Skipped'
          )
    `);


    // =====================================================
    // WhatsApp status synchronization
    // =====================================================

    await db.query(`
        UPDATE notification_campaign_recipients r

        INNER JOIN notification_queue q
            ON q.id = r.whatsapp_queue_id

        SET
            r.whatsapp_status =
                CASE
                    WHEN q.status IN (
                        'Sent',
                        'Simulated'
                    )
                    THEN 'Sent'

                    WHEN q.status = 'Failed'
                    THEN 'Failed'

                    WHEN q.status = 'Skipped'
                    THEN 'Skipped'

                    ELSE r.whatsapp_status
                END,

            r.whatsapp_error =
                CASE
                    WHEN q.status IN (
                        'Failed',
                        'Skipped'
                    )
                    THEN q.last_error

                    WHEN q.status IN (
                        'Sent',
                        'Simulated'
                    )
                    THEN NULL

                    ELSE r.whatsapp_error
                END,

            r.whatsapp_sent_at =
                CASE
                    WHEN q.status IN (
                        'Sent',
                        'Simulated'
                    )
                    THEN COALESCE(
                        q.processed_at,
                        CURRENT_TIMESTAMP
                    )

                    ELSE r.whatsapp_sent_at
                END

        WHERE r.whatsapp_queue_id IS NOT NULL
          AND q.status IN (
                'Sent',
                'Simulated',
                'Failed',
                'Skipped'
          )
    `);
}


async function syncCampaignSummaries() {

    const [campaigns] =
        await db.query(`
            SELECT id
            FROM notification_campaigns
            WHERE status = 'Processing'
            ORDER BY id
        `);

    for (const campaign of campaigns) {

        const [rows] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total_recipients,

                    SUM(
                        email_status = 'Sent'
                    ) AS email_sent,

                    SUM(
                        whatsapp_status = 'Sent'
                    ) AS whatsapp_sent,

                    SUM(
                        email_status = 'Failed'
                    ) AS email_failed,

                    SUM(
                        whatsapp_status = 'Failed'
                    ) AS whatsapp_failed,

                    SUM(
                        email_status IN (
                            'Skipped',
                            'Unsubscribed'
                        )
                    ) AS email_skipped,

                    SUM(
                        whatsapp_status IN (
                            'Skipped',
                            'Unsubscribed'
                        )
                    ) AS whatsapp_skipped,

                    SUM(
                        email_status = 'Queued'
                    ) AS email_pending,

                    SUM(
                        whatsapp_status = 'Queued'
                    ) AS whatsapp_pending

                FROM notification_campaign_recipients
                WHERE campaign_id = ?
                `,
                [campaign.id]
            );

        const summary =
            rows[0] || {};

        const totalRecipients =
            Number(
                summary.total_recipients || 0
            );

        const sent =
            Number(
                summary.email_sent || 0
            ) +
            Number(
                summary.whatsapp_sent || 0
            );

        const failed =
            Number(
                summary.email_failed || 0
            ) +
            Number(
                summary.whatsapp_failed || 0
            );

        const skipped =
            Number(
                summary.email_skipped || 0
            ) +
            Number(
                summary.whatsapp_skipped || 0
            );

        const pending =
            Number(
                summary.email_pending || 0
            ) +
            Number(
                summary.whatsapp_pending || 0
            );

        let status =
            "Processing";

        let completedAt =
            null;

        /*
         * Do not complete a campaign while any
         * delivery channel is still queued.
         */
        if (
            totalRecipients > 0 &&
            pending === 0
        ) {
            status =
                sent > 0
                    ? "Completed"
                    : "Failed";

            completedAt =
                new Date();
        }

        await db.query(
            `
            UPDATE notification_campaigns

            SET
                total_recipients = ?,
                sent_count = ?,
                failed_count = ?,
                skipped_count = ?,
                status = ?,

                completed_at =
                    CASE
                        WHEN ? IS NOT NULL
                        THEN ?
                        ELSE completed_at
                    END

            WHERE id = ?
            `,
            [
                totalRecipients,
                sent,
                failed,
                skipped,
                status,
                completedAt,
                completedAt,
                campaign.id
            ]
        );
    }
}


async function syncAllCampaignStatuses() {

    await syncCampaignRecipientStatuses();
    await syncCampaignSummaries();

    return {
        success: true
    };
}


module.exports = {
    syncCampaignRecipientStatuses,
    syncCampaignSummaries,
    syncAllCampaignStatuses
};
