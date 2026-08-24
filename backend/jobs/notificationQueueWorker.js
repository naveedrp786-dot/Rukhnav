"use strict";

const cron = require("node-cron");
const queueService =
    require("../services/notificationQueueService");

const campaignStatusService =
    require(
        "../services/notificationCampaignStatusService"
    );

const campaignSchedulerService =
    require(
        "../services/notificationCampaignSchedulerService"
    );

let running = false;
let task = null;

async function runCycle() {
    if (running) {
        return {
            skipped:
                true,
            reason:
                "Previous notification cycle is still running."
        };
    }

    running = true;

    try {
        try {
            const campaignSummary =
                await campaignSchedulerService
                    .processDueCampaigns({
                        limit: 10
                    });

            if (
                campaignSummary.found > 0
            ) {
                console.log(
                    "Scheduled campaign cycle:",
                    campaignSummary
                );
            }

        } catch (campaignError) {
            console.error(
                "Scheduled campaign cycle failed:",
                campaignError
            );
        }

        const summary =
            await queueService
                .processQueue({
                    limit:
                        Number(
                            process.env
                                .NOTIFICATION_BATCH_SIZE ||
                            20
                        ),
                    workerId:
                        `rukhnav-${process.pid}`
                });

        if (summary.claimed > 0) {
            console.log(
                "Notification queue cycle:",
                summary
            );
        }

        try {
            await campaignStatusService
                .syncAllCampaignStatuses();
        } catch (syncError) {
            console.error(
                "Campaign status synchronization failed:",
                syncError
            );
        }

        return summary;
    } catch (error) {
        console.error(
            "Notification queue cycle failed:",
            error
        );

        return {
            error:
                error.message
        };
    } finally {
        running = false;
    }
}

function start() {
    if (task) {
        return task;
    }

    const schedule =
        process.env
            .NOTIFICATION_WORKER_CRON ||
        "* * * * *";

    task =
        cron.schedule(
            schedule,
            runCycle,
            {
                timezone:
                    process.env
                        .APP_TIMEZONE ||
                    "Asia/Karachi"
            }
        );

    console.log(
        `Notification worker scheduled: ${schedule}`
    );

    setTimeout(
        runCycle,
        3000
    );

    return task;
}

module.exports = {
    start,
    runCycle
};
