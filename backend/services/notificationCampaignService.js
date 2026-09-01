"use strict";

const db = require("../config/db");
const queueService =
    require("./notificationQueueService");
const templateService =
    require("./notificationTemplateService");
const customerNotificationService =
    require("./customerNotificationService");

const VALID_CAMPAIGN_TYPES = new Set([
    "Promotion",
    "Invitation",
    "New Product",
    "Sale",
    "Birthday Offer",
    "Event",
    "Announcement",
    "Custom"
]);

const VALID_AUDIENCES = new Set([
    "All Marketing Customers",
    "Selected Customers",
    "Gold Members",
    "Platinum Members",
    "Gold & Platinum",
    "Manual Recipients"
]);

function bool(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    );
}

function clean(value) {
    return String(value || "").trim();
}

function normalizePhone(value) {
    let phone =
        clean(value).replace(/[^\d+]/g, "");

    if (phone.startsWith("00")) {
        phone = `+${phone.slice(2)}`;
    }

    if (
        phone.startsWith("03") &&
        phone.length === 11
    ) {
        phone = `+92${phone.slice(1)}`;
    }

    if (
        phone.startsWith("92") &&
        !phone.startsWith("+")
    ) {
        phone = `+${phone}`;
    }

    return phone;
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(clean(value));
}

function validPhone(value) {
    const digits =
        normalizePhone(value)
            .replace(/\D/g, "");

    return (
        digits.length >= 10 &&
        digits.length <= 15
    );
}

async function getCampaign(
    campaignId
) {
    const [rows] = await db.query(
        `
        SELECT *
        FROM notification_campaigns
        WHERE id = ?
        LIMIT 1
        `,
        [campaignId]
    );

    return rows[0] || null;
}

async function listCampaigns({
    limit = 100
} = {}) {
    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 100,
                1
            ),
            500
        );

    const [rows] = await db.query(
        `
        SELECT
            nc.*,

            (
                SELECT COUNT(*)
                FROM notification_campaign_recipients ncr
                WHERE ncr.campaign_id = nc.id
            ) AS recipient_rows

        FROM notification_campaigns nc

        ORDER BY nc.id DESC
        LIMIT ?
        `,
        [safeLimit]
    );

    return rows;
}

async function createCampaign({
    campaignName,
    campaignType = "Custom",
    audienceType = "Selected Customers",

    sendEmail = false,
    sendWhatsApp = false,

    emailTemplateId = null,
    whatsappTemplateId = null,

    emailSubject = "",
    emailBody = "",
    whatsappMessage = "",

    scheduledAt = null,
    adminId = null
}) {
    campaignName = clean(campaignName);

    if (!campaignName) {
        throw new Error(
            "Campaign name is required."
        );
    }

    if (
        !VALID_CAMPAIGN_TYPES.has(
            campaignType
        )
    ) {
        throw new Error(
            "Invalid campaign type."
        );
    }

    if (
        !VALID_AUDIENCES.has(
            audienceType
        )
    ) {
        throw new Error(
            "Invalid campaign audience."
        );
    }

    sendEmail = bool(sendEmail);
    sendWhatsApp = bool(sendWhatsApp);

    if (
        !sendEmail &&
        !sendWhatsApp
    ) {
        throw new Error(
            "Select Email, WhatsApp, or both."
        );
    }

    if (
        sendEmail &&
        !clean(emailBody)
    ) {
        throw new Error(
            "Email campaign content is required."
        );
    }

    if (
        sendWhatsApp &&
        !clean(whatsappMessage)
    ) {
        throw new Error(
            "WhatsApp campaign message is required."
        );
    }

    const status =
        scheduledAt
            ? "Scheduled"
            : "Draft";

    const [result] = await db.query(
        `
        INSERT INTO notification_campaigns
            (
                campaign_name,
                campaign_type,
                audience_type,

                send_email,
                send_whatsapp,

                email_template_id,
                whatsapp_template_id,

                email_subject,
                email_body,
                whatsapp_message,

                status,
                scheduled_at,

                created_by_admin_id,
                updated_by_admin_id
            )
        VALUES
            (
                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?
            )
        `,
        [
            campaignName,
            campaignType,
            audienceType,

            sendEmail ? 1 : 0,
            sendWhatsApp ? 1 : 0,

            emailTemplateId || null,
            whatsappTemplateId || null,

            clean(emailSubject) || null,
            clean(emailBody) || null,
            clean(whatsappMessage) || null,

            status,
            scheduledAt || null,

            adminId || null,
            adminId || null
        ]
    );

    return getCampaign(
        result.insertId
    );
}

async function resolveCustomerAudience({
    audienceType,
    selectedCustomerIds = []
}) {
    const params = [];

    let filter = `
        c.deleted_at IS NULL
        AND c.status = 'Active'
        AND c.accepted_marketing = 1
    `;

    if (
        audienceType ===
        "Selected Customers"
    ) {
        const ids =
            [...new Set(
                selectedCustomerIds
                    .map(Number)
                    .filter(
                        value =>
                            Number.isInteger(value) &&
                            value > 0
                    )
            )];

        if (!ids.length) {
            return [];
        }

        filter += `
            AND c.id IN (
                ${ids.map(() => "?").join(",")}
            )
        `;

        params.push(...ids);
    }

    if (
        audienceType ===
        "Gold Members"
    ) {
        filter += `
            AND COALESCE(
                cr.membership_level,
                'Bronze'
            ) = 'Gold'
        `;
    }

    if (
        audienceType ===
        "Platinum Members"
    ) {
        filter += `
            AND COALESCE(
                cr.membership_level,
                'Bronze'
            ) = 'Platinum'
        `;
    }

    if (
        audienceType ===
        "Gold & Platinum"
    ) {
        filter += `
            AND COALESCE(
                cr.membership_level,
                'Bronze'
            ) IN ('Gold', 'Platinum')
        `;
    }

    const [rows] = await db.query(
        `
        SELECT
            c.id AS customer_id,
            c.full_name,
            c.email,
            c.phone,

            COALESCE(
                cr.membership_level,
                'Bronze'
            ) AS membership_level,

            COALESCE(
                mcp.email_marketing_enabled,
                0
            ) AS email_marketing_enabled,

            COALESCE(
                mcp.whatsapp_marketing_enabled,
                0
            ) AS whatsapp_marketing_enabled,

            mcp.email_unsubscribed_at,
            mcp.whatsapp_unsubscribed_at

        FROM customers c

        LEFT JOIN customer_rewards cr
            ON cr.customer_id = c.id

        LEFT JOIN marketing_contact_preferences mcp
            ON mcp.customer_id = c.id

        WHERE ${filter}

        ORDER BY c.full_name, c.id
        `,
        params
    );

    return rows;
}

async function previewAudience({
    audienceType,
    selectedCustomerIds = [],
    manualRecipients = []
}) {
    if (
        audienceType ===
        "Manual Recipients"
    ) {
        return manualRecipients
            .map((item, index) => ({
                customer_id: null,

                full_name:
                    clean(item.name) ||
                    `Manual Recipient ${index + 1}`,

                email:
                    clean(item.email),

                phone:
                    normalizePhone(
                        item.whatsapp_number ||
                        item.phone
                    ),

                membership_level: null,

                /*
                 * Manual marketing recipients are
                 * NOT automatically opted in.
                 * Consent must be explicitly supplied.
                 */
                email_marketing_enabled:
                    bool(
                        item.email_marketing_consent
                    )
                        ? 1
                        : 0,

                whatsapp_marketing_enabled:
                    bool(
                        item.whatsapp_marketing_consent
                    )
                        ? 1
                        : 0,

                email_unsubscribed_at: null,
                whatsapp_unsubscribed_at: null,

                manual: true
            }));
    }

    return resolveCustomerAudience({
        audienceType,
        selectedCustomerIds
    });
}

async function replaceRecipients({
    campaignId,
    selectedCustomerIds = [],
    manualRecipients = []
}) {
    const campaign =
        await getCampaign(campaignId);

    if (!campaign) {
        throw new Error(
            "Campaign was not found."
        );
    }

    if (
        !["Draft", "Scheduled"]
            .includes(campaign.status)
    ) {
        throw new Error(
            "Recipients cannot be changed after campaign processing has started."
        );
    }

    const recipients =
        await previewAudience({
            audienceType:
                campaign.audience_type,
            selectedCustomerIds,
            manualRecipients
        });

    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(
            `
            DELETE FROM notification_campaign_recipients
            WHERE campaign_id = ?
            `,
            [campaignId]
        );

        let inserted = 0;

        for (const recipient of recipients) {
            const email =
                clean(recipient.email);

            const whatsapp =
                normalizePhone(
                    recipient.phone
                );

            let emailStatus =
                "Not Selected";

            let whatsappStatus =
                "Not Selected";

            if (campaign.send_email) {
                if (
                    !recipient
                        .email_marketing_enabled ||
                    recipient
                        .email_unsubscribed_at
                ) {
                    emailStatus =
                        "Unsubscribed";
                } else if (
                    !validEmail(email)
                ) {
                    emailStatus =
                        "Skipped";
                } else {
                    emailStatus =
                        "Queued";
                }
            }

            if (
                campaign.send_whatsapp
            ) {
                if (
                    !recipient
                        .whatsapp_marketing_enabled ||
                    recipient
                        .whatsapp_unsubscribed_at
                ) {
                    whatsappStatus =
                        "Unsubscribed";
                } else if (
                    !validPhone(whatsapp)
                ) {
                    whatsappStatus =
                        "Skipped";
                } else {
                    whatsappStatus =
                        "Queued";
                }
            }

            await connection.query(
                `
                INSERT INTO notification_campaign_recipients
                    (
                        campaign_id,
                        customer_id,
                        recipient_name,
                        email,
                        whatsapp_number,
                        email_status,
                        whatsapp_status
                    )
                VALUES
                    (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    campaignId,
                    recipient.customer_id ||
                        null,

                    clean(
                        recipient.full_name
                    ) || null,

                    email || null,
                    whatsapp || null,

                    emailStatus,
                    whatsappStatus
                ]
            );

            inserted += 1;
        }

        await connection.query(
            `
            UPDATE notification_campaigns
            SET
                total_recipients = ?,

                queued_count = (
                    SELECT COUNT(*)
                    FROM notification_campaign_recipients
                    WHERE campaign_id = ?
                      AND (
                          email_status = 'Queued'
                          OR
                          whatsapp_status = 'Queued'
                      )
                ),

                skipped_count = (
                    SELECT COUNT(*)
                    FROM notification_campaign_recipients
                    WHERE campaign_id = ?
                      AND (
                          email_status IN (
                              'Skipped',
                              'Unsubscribed'
                          )
                          OR
                          whatsapp_status IN (
                              'Skipped',
                              'Unsubscribed'
                          )
                      )
                )

            WHERE id = ?
            `,
            [
                inserted,
                campaignId,
                campaignId,
                campaignId
            ]
        );

        await connection.commit();

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }

    return getCampaign(campaignId);
}

function campaignVariables(
    campaign,
    recipient
) {
    return {
        customer_name:
            recipient.recipient_name ||
            "Customer",

        campaign_name:
            campaign.campaign_name,

        campaign_type:
            campaign.campaign_type,

        membership_level:
            recipient.membership_level ||
            "",

        shop_url:
            process.env.FRONTEND_URL ||
            process.env.APP_BASE_URL ||
            "https://www.rukhnav.store",

        brand_name:
            "RUKHNAV"
    };
}

function campaignInboxType(campaignType) {
    const supported = new Set([
        "Promotion",
        "Sale",
        "New Product",
        "Announcement",
        "Event"
    ]);

    return supported.has(campaignType)
        ? campaignType
        : "General";
}

function campaignInboxIcon(campaignType) {
    const icons = {
        Promotion: "tags",
        Sale: "tags",
        "New Product": "sparkles",
        Announcement: "bell",
        Event: "calendar-days"
    };

    return icons[campaignType] || "bell";
}

function campaignInboxAction(campaignType) {
    if (
        campaignType === "Promotion" ||
        campaignType === "Sale" ||
        campaignType === "New Product"
    ) {
        return {
            label: "Shop Now",
            url: "/store/products.html"
        };
    }

    if (campaignType === "Event") {
        return {
            label: "View Events",
            url: "/store/events.html"
        };
    }

    return {
        label: "Open RUKHNAV",
        url: "/store/index.html"
    };
}

function campaignInboxMessage(
    campaign,
    recipient
) {
    const variables =
        campaignVariables(
            campaign,
            recipient
        );

    let message =
        clean(campaign.email_body) ||
        clean(campaign.whatsapp_message) ||
        clean(campaign.campaign_name);

    for (const [key, value] of
        Object.entries(variables)) {
        message = message.replace(
            new RegExp(
                `{{\\s*${key}\\s*}}`,
                "gi"
            ),
            String(value || "")
        );
    }

    return message;
}

async function createCampaignInboxNotification(
    campaign,
    recipient
) {
    const customerId =
        Number(recipient.customer_id);

    /*
     * Manual recipients do not have a RUKHNAV
     * customer account, so they cannot receive
     * private website inbox notifications.
     */
    if (
        !Number.isInteger(customerId) ||
        customerId <= 0
    ) {
        return {
            created: false,
            skipped: true
        };
    }

    const action =
        campaignInboxAction(
            campaign.campaign_type
        );

    return customerNotificationService
        .createNotification({
            customerId,

            notificationType:
                campaignInboxType(
                    campaign.campaign_type
                ),

            title:
                clean(campaign.campaign_name) ||
                "RUKHNAV Update",

            message:
                campaignInboxMessage(
                    campaign,
                    recipient
                ),

            actionLabel:
                action.label,

            actionUrl:
                action.url,

            campaignId:
                campaign.id,

            referenceType:
                "marketing_campaign",

            referenceId:
                String(campaign.id),

            icon:
                campaignInboxIcon(
                    campaign.campaign_type
                ),

            priority:
                campaign.campaign_type ===
                "Sale"
                    ? "High"
                    : "Normal"
        });
}

async function queueCampaign(
    campaignId
) {
    const campaign =
        await getCampaign(campaignId);

    if (!campaign) {
        throw new Error(
            "Campaign was not found."
        );
    }

    if (
        !["Draft", "Scheduled"]
            .includes(campaign.status)
    ) {
        throw new Error(
            `Campaign cannot be queued from ${campaign.status} status.`
        );
    }

    const [recipients] =
        await db.query(
            `
            SELECT *
            FROM notification_campaign_recipients
            WHERE campaign_id = ?
            ORDER BY id
            `,
            [campaignId]
        );

    if (!recipients.length) {
        throw new Error(
            "Campaign has no recipients."
        );
    }

    const [claimResult] =
        await db.query(
            `
            UPDATE notification_campaigns
            SET
                status = 'Processing',
                started_at =
                    COALESCE(
                        started_at,
                        CURRENT_TIMESTAMP
                    )
            WHERE id = ?
              AND status IN (
                    'Draft',
                    'Scheduled'
              )
            `,
            [campaignId]
        );

    if (
        claimResult.affectedRows !== 1
    ) {
        throw new Error(
            "Campaign has already been started or is no longer available for sending."
        );
    }

    let queued = 0;
    let skipped = 0;
    let websiteCreated = 0;
    let websiteSkipped = 0;

    try {
        for (const recipient of recipients) {
            const variables =
                campaignVariables(
                    campaign,
                    recipient
                );

            // ==========================================
            // WEBSITE CUSTOMER INBOX
            // ==========================================

            if (recipient.customer_id) {
                try {
                    const inboxResult =
                        await createCampaignInboxNotification(
                            campaign,
                            recipient
                        );

                    if (inboxResult.created) {
                        websiteCreated += 1;
                    } else {
                        websiteSkipped += 1;
                    }

                } catch (error) {
                    /*
                     * Website inbox delivery must never
                     * prevent Email / WhatsApp campaign
                     * delivery.
                     */
                    websiteSkipped += 1;

                    console.error(
                        `[NotificationCampaign] Website inbox failed for campaign ${campaign.id}, customer ${recipient.customer_id}:`,
                        error.message
                    );
                }
            } else {
                websiteSkipped += 1;
            }

            // ==========================================
            // EMAIL
            // ==========================================

            if (
                campaign.send_email &&
                recipient.email_status ===
                    "Queued"
            ) {
                const rendered =
                    await templateService
                        .renderTemplate({
                            templateKey:
                                null,
                            channel:
                                "Email",
                            variables,
                            fallbackSubject:
                                campaign.email_subject ||
                                campaign.campaign_name,
                            fallbackMessage:
                                campaign.email_body ||
                                ""
                        });

                const result =
                    await queueService
                        .queueNotification({
                            eventKey:
                                "MARKETING_CAMPAIGN",

                            customerId:
                                recipient.customer_id,

                            channel:
                                "Email",

                            recipient:
                                recipient.email,

                            subject:
                                rendered.subject,

                            message:
                                rendered.message,

                            payload: {
                                campaign_id:
                                    campaign.id,
                                campaign_recipient_id:
                                    recipient.id,
                                campaign_type:
                                    campaign.campaign_type
                            },

                            priority: 5,
                            maxAttempts: 3,

                            dedupeKey:
                                `campaign-${campaign.id}-recipient-${recipient.id}-email`
                        });

                if (result.queued) {
                    await db.query(
                        `
                        UPDATE notification_campaign_recipients
                        SET email_queue_id = ?
                        WHERE id = ?
                        `,
                        [
                            result.queueId,
                            recipient.id
                        ]
                    );

                    queued += 1;
                }
            }

            // ==========================================
            // WHATSAPP
            // ==========================================

            if (
                campaign.send_whatsapp &&
                recipient.whatsapp_status ===
                    "Queued"
            ) {
                const rendered =
                    await templateService
                        .renderTemplate({
                            templateKey:
                                null,
                            channel:
                                "WhatsApp",
                            variables,
                            fallbackMessage:
                                campaign
                                    .whatsapp_message ||
                                ""
                        });

                const result =
                    await queueService
                        .queueNotification({
                            eventKey:
                                "MARKETING_CAMPAIGN",

                            customerId:
                                recipient.customer_id,

                            channel:
                                "WhatsApp",

                            recipient:
                                recipient
                                    .whatsapp_number,

                            message:
                                rendered.message,

                            payload: {
                                campaign_id:
                                    campaign.id,
                                campaign_recipient_id:
                                    recipient.id,
                                campaign_type:
                                    campaign.campaign_type
                            },

                            priority: 5,
                            maxAttempts: 3,

                            dedupeKey:
                                `campaign-${campaign.id}-recipient-${recipient.id}-whatsapp`
                        });

                if (result.queued) {
                    await db.query(
                        `
                        UPDATE notification_campaign_recipients
                        SET whatsapp_queue_id = ?
                        WHERE id = ?
                        `,
                        [
                            result.queueId,
                            recipient.id
                        ]
                    );

                    queued += 1;
                }
            }

            if (
                recipient.email_status ===
                    "Skipped" ||
                recipient.email_status ===
                    "Unsubscribed" ||
                recipient.whatsapp_status ===
                    "Skipped" ||
                recipient.whatsapp_status ===
                    "Unsubscribed"
            ) {
                skipped += 1;
            }
        }

        await db.query(
            `
            UPDATE notification_campaigns
            SET
                queued_count = ?,
                skipped_count = ?
            WHERE id = ?
            `,
            [
                queued,
                skipped,
                campaignId
            ]
        );

        return {
            campaignId:
                Number(campaignId),
            queued,
            skipped,
            websiteCreated,
            websiteSkipped
        };

    } catch (error) {
        await db.query(
            `
            UPDATE notification_campaigns
            SET status = 'Failed'
            WHERE id = ?
            `,
            [campaignId]
        );

        throw error;
    }
}

module.exports = {
    getCampaign,
    listCampaigns,
    createCampaign,
    previewAudience,
    replaceRecipients,
    queueCampaign,
    normalizePhone,
    validEmail,
    validPhone
};
