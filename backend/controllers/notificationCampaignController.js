"use strict";

const db = require("../config/db");

const campaignService =
    require(
        "../services/notificationCampaignService"
    );

function adminId(req) {
    return (
        req.admin?.id ||
        req.user?.id ||
        null
    );
}

function arrayValue(value) {
    return Array.isArray(value)
        ? value
        : [];
}

/**
 * List campaigns.
 */
exports.listCampaigns = async (
    req,
    res
) => {
    try {
        const campaigns =
            await campaignService
                .listCampaigns({
                    limit:
                        req.query.limit
                });

        res.json({
            success: true,
            campaigns
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                error.message
        });
    }
};


/**
 * Get one campaign and its recipients.
 */
exports.getCampaign = async (
    req,
    res
) => {
    try {
        const campaignId =
            Number(req.params.id);

        if (!campaignId) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "A valid campaign ID is required."
                });
        }

        const campaign =
            await campaignService
                .getCampaign(
                    campaignId
                );

        if (!campaign) {
            return res
                .status(404)
                .json({
                    success: false,
                    message:
                        "Campaign was not found."
                });
        }

        const [recipients] =
            await db.query(
                `
                SELECT
                    id,
                    campaign_id,
                    customer_id,
                    recipient_name,
                    email,
                    whatsapp_number,
                    email_status,
                    whatsapp_status,
                    email_queue_id,
                    whatsapp_queue_id,
                    email_error,
                    whatsapp_error,
                    email_sent_at,
                    whatsapp_sent_at,
                    created_at,
                    updated_at

                FROM notification_campaign_recipients

                WHERE campaign_id = ?

                ORDER BY id
                `,
                [campaignId]
            );

        res.json({
            success: true,
            campaign,
            recipients
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message:
                error.message
        });
    }
};


/**
 * Create a draft/scheduled campaign.
 */
exports.createCampaign = async (
    req,
    res
) => {
    try {
        const campaign =
            await campaignService
                .createCampaign({
                    campaignName:
                        req.body
                            .campaign_name,

                    campaignType:
                        req.body
                            .campaign_type,

                    audienceType:
                        req.body
                            .audience_type,

                    sendEmail:
                        req.body
                            .send_email,

                    sendWhatsApp:
                        req.body
                            .send_whatsapp,

                    emailTemplateId:
                        req.body
                            .email_template_id,

                    whatsappTemplateId:
                        req.body
                            .whatsapp_template_id,

                    emailSubject:
                        req.body
                            .email_subject,

                    emailBody:
                        req.body
                            .email_body,

                    whatsappMessage:
                        req.body
                            .whatsapp_message,

                    scheduledAt:
                        req.body
                            .scheduled_at ||
                        null,

                    adminId:
                        adminId(req)
                });

        res.status(201).json({
            success: true,
            message:
                "Campaign created successfully.",
            campaign
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message:
                error.message
        });
    }
};


/**
 * Preview audience before storing recipients.
 */
exports.previewAudience = async (
    req,
    res
) => {
    try {
        const audienceType =
            String(
                req.body
                    .audience_type ||
                ""
            ).trim();

        const recipients =
            await campaignService
                .previewAudience({
                    audienceType,

                    selectedCustomerIds:
                        arrayValue(
                            req.body
                                .selected_customer_ids
                        ),

                    manualRecipients:
                        arrayValue(
                            req.body
                                .manual_recipients
                        )
                });

        const summary = {
            total:
                recipients.length,

            emailEligible:
                recipients.filter(
                    item =>
                        Boolean(
                            item
                                .email_marketing_enabled
                        ) &&
                        Boolean(
                            item.email
                        ) &&
                        !item
                            .email_unsubscribed_at
                ).length,

            whatsappEligible:
                recipients.filter(
                    item =>
                        Boolean(
                            item
                                .whatsapp_marketing_enabled
                        ) &&
                        Boolean(
                            item.phone
                        ) &&
                        !item
                            .whatsapp_unsubscribed_at
                ).length
        };

        res.json({
            success: true,
            summary,
            recipients
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message:
                error.message
        });
    }
};


/**
 * Replace campaign recipient selection.
 */
exports.saveRecipients = async (
    req,
    res
) => {
    try {
        const campaignId =
            Number(req.params.id);

        if (!campaignId) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "A valid campaign ID is required."
                });
        }

        const campaign =
            await campaignService
                .replaceRecipients({
                    campaignId,

                    selectedCustomerIds:
                        arrayValue(
                            req.body
                                .selected_customer_ids
                        ),

                    manualRecipients:
                        arrayValue(
                            req.body
                                .manual_recipients
                        )
                });

        const [recipients] =
            await db.query(
                `
                SELECT
                    id,
                    customer_id,
                    recipient_name,
                    email,
                    whatsapp_number,
                    email_status,
                    whatsapp_status

                FROM notification_campaign_recipients

                WHERE campaign_id = ?

                ORDER BY id
                `,
                [campaignId]
            );

        res.json({
            success: true,
            message:
                "Campaign recipients saved.",
            campaign,
            recipients
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message:
                error.message
        });
    }
};


/**
 * Queue campaign messages.
 *
 * IMPORTANT:
 * This queues messages only. Delivery processing
 * remains controlled by the notification worker.
 */
exports.queueCampaign = async (
    req,
    res
) => {
    try {
        const campaignId =
            Number(req.params.id);

        if (!campaignId) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "A valid campaign ID is required."
                });
        }

        const result =
            await campaignService
                .queueCampaign(
                    campaignId
                );

        res.json({
            success: true,
            message:
                `${result.queued} campaign delivery item(s) queued.`,
            result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message:
                error.message
        });
    }
};
