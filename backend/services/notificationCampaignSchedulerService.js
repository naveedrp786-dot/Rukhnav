"use strict";

const db = require("../config/db");

const campaignService =
    require("./notificationCampaignService");

let running = false;


async function processDueCampaigns({
    limit = 10
} = {}) {

    if (running) {
        return {
            skipped: true,
            reason:
                "Campaign scheduler is already running."
        };
    }

    running = true;

    try {

        const safeLimit =
            Math.min(
                Math.max(
                    Number(limit) || 10,
                    1
                ),
                50
            );

        const [campaigns] =
            await db.query(
                `
                SELECT
                    id,
                    campaign_name,
                    scheduled_at

                FROM notification_campaigns

                WHERE status = 'Scheduled'
                  AND scheduled_at IS NOT NULL
                  AND scheduled_at <=
                        CURRENT_TIMESTAMP

                ORDER BY
                    scheduled_at ASC,
                    id ASC

                LIMIT ?
                `,
                [safeLimit]
            );

        const summary = {
            found:
                campaigns.length,

            started:
                0,

            failed:
                0,

            errors:
                []
        };

        for (
            const campaign
            of campaigns
        ) {
            try {

                await campaignService
                    .queueCampaign(
                        campaign.id
                    );

                summary.started += 1;

            } catch (error) {

                summary.failed += 1;

                summary.errors.push({
                    campaignId:
                        campaign.id,

                    error:
                        error.message
                });
            }
        }

        return summary;

    } finally {
        running = false;
    }
}


module.exports = {
    processDueCampaigns
};
