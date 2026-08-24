"use strict";

const db = require("../config/db");
const providerService = require("../services/notificationProviderService");

const CHANNELS = ["Email", "WhatsApp", "SMS"];

function bool(value) {
    return value === true || value === 1 || value === "1" || value === "true";
}

function environmentReadiness(channel) {
    if (channel === "Email") {
        return {
            ready: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
            required: ["RESEND_API_KEY", "EMAIL_FROM"]
        };
    }

    if (channel === "WhatsApp") {
        return {
            ready: Boolean(
                process.env.WASENDER_API_TOKEN
            ),
            required: [
                "WASENDER_API_TOKEN"
            ]
        };
    }

    return {
        ready: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM),
        required: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"]
    };
}

exports.getDashboard = async (req, res) => {
    try {
        const [settings] = await db.query(`
            SELECT id, channel, enabled, provider, simulation_mode, from_name, from_address, updated_at
            FROM notification_channel_settings
            ORDER BY FIELD(channel, 'Email', 'WhatsApp', 'SMS')
        `);

        const [[counts]] = await db.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Sent') AS sent,
                SUM(status = 'Failed') AS failed,
                SUM(status = 'Simulated') AS simulated,
                SUM(created_at >= CURRENT_DATE) AS today
            FROM notification_delivery_logs
        `);

        const [[preferences]] = await db.query(`
            SELECT
                COUNT(*) AS customers,
                SUM(email_reminders_enabled = 1) AS email_enabled,
                SUM(whatsapp_reminders_enabled = 1) AS whatsapp_enabled,
                SUM(sms_reminders_enabled = 1) AS sms_enabled
            FROM customers
            WHERE deleted_at IS NULL
        `);

        const mapped = settings.map(row => ({
            ...row,
            enabled: Boolean(row.enabled),
            simulation_mode: Boolean(row.simulation_mode),
            environment: environmentReadiness(row.channel)
        }));

        res.json({
            success: true,
            environment: process.env.NODE_ENV || "development",
            globalSimulation: process.env.NOTIFICATION_SIMULATION_MODE !== "false" && process.env.NODE_ENV !== "production",
            settings: mapped,
            counts: {
                total: Number(counts.total || 0),
                sent: Number(counts.sent || 0),
                failed: Number(counts.failed || 0),
                simulated: Number(counts.simulated || 0),
                today: Number(counts.today || 0)
            },
            preferences: {
                customers: Number(preferences.customers || 0),
                emailEnabled: Number(preferences.email_enabled || 0),
                whatsappEnabled: Number(preferences.whatsapp_enabled || 0),
                smsEnabled: Number(preferences.sms_enabled || 0)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateChannel = async (req, res) => {
    try {
        const channel = String(req.params.channel || "");
        if (!CHANNELS.includes(channel)) {
            return res.status(400).json({ success: false, message: "Invalid notification channel." });
        }

        const enabled = bool(req.body.enabled);
        const simulationMode = bool(req.body.simulation_mode);
        const provider = String(
            req.body.provider ||
            (
                channel === "Email"
                    ? "Resend"
                    : channel === "WhatsApp"
                        ? "WasenderAPI"
                        : "Twilio"
            )
        ).trim();
        const fromName = String(req.body.from_name || "RUKHNAV").trim();
        const fromAddress = String(req.body.from_address || "").trim() || null;

        if (enabled && !simulationMode && !environmentReadiness(channel).ready) {
            return res.status(400).json({
                success: false,
                message: `${channel} production credentials are incomplete in the environment file.`
            });
        }

        await db.query(`
            UPDATE notification_channel_settings
            SET enabled = ?, provider = ?, simulation_mode = ?, from_name = ?, from_address = ?, updated_by_admin_id = ?
            WHERE channel = ?
        `, [enabled ? 1 : 0, provider, simulationMode ? 1 : 0, fromName, fromAddress, req.admin?.id || req.user?.id || null, channel]);

        res.json({ success: true, message: `${channel} settings updated successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.testChannel = async (req, res) => {
    const channel = String(req.params.channel || "");
    if (!CHANNELS.includes(channel)) {
        return res.status(400).json({ success: false, message: "Invalid notification channel." });
    }

    const recipient = String(req.body.recipient || "").trim();
    const subject = String(req.body.subject || "RUKHNAV Notification Test").trim();
    const message = String(req.body.message || `This is a ${channel} test from RUKHNAV.`).trim();

    if (!recipient) {
        return res.status(400).json({ success: false, message: "A test recipient is required." });
    }

    try {
        let result;
        if (channel === "Email") {
            result = await providerService.sendEmail({ to: recipient, subject, message });
        } else if (channel === "WhatsApp") {
            result = await providerService.sendWhatsApp({ to: recipient, message });
        } else {
            result = await providerService.sendSms({ to: recipient, message });
        }

        await db.query(`
            INSERT INTO notification_delivery_logs
                (channel, recipient, subject, message, status, provider, provider_message_id, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [channel, recipient, channel === "Email" ? subject : null, message, result.simulated ? "Simulated" : "Sent", channel === "Email"
            ? "Resend"
            : channel === "WhatsApp"
                ? "WasenderAPI"
                : "Twilio",
            result.providerMessageId || null]);

        res.json({ success: true, simulated: Boolean(result.simulated), message: result.simulated ? `${channel} test simulated successfully.` : `${channel} test sent successfully.` });
    } catch (error) {
        await db.query(`
            INSERT INTO notification_delivery_logs
                (channel, recipient, subject, message, status, provider, error_message)
            VALUES (?, ?, ?, ?, 'Failed', ?, ?)
        `, [channel, recipient, channel === "Email" ? subject : null, message, channel === "Email"
            ? "Resend"
            : channel === "WhatsApp"
                ? "WasenderAPI"
                : "Twilio",
            error.message]);

        res.status(500).json({ success: false, message: error.message });
    }
};


/**
 * Send a manual WhatsApp message from the
 * authenticated RUKHNAV admin Notification Center.
 *
 * A registered customer may be selected, or an
 * administrator may enter another WhatsApp number.
 */
exports.sendManualWhatsApp = async (req, res) => {
    let customerId =
        Number(req.body.customer_id) || null;

    let recipient =
        String(req.body.to || "")
            .trim();

    const message =
        String(req.body.message || "")
            .trim();

    if (!message) {
        return res.status(400).json({
            success: false,
            message:
                "WhatsApp message is required."
        });
    }

    if (message.length > 4000) {
        return res.status(400).json({
            success: false,
            message:
                "WhatsApp message is too long."
        });
    }

    try {
        let customer = null;

        if (customerId) {
            const [rows] =
                await db.query(
                    `
                    SELECT
                        id,
                        full_name,
                        phone,
                        status
                    FROM customers
                    WHERE id = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                    `,
                    [customerId]
                );

            customer = rows[0] || null;

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Customer was not found."
                });
            }

            /*
             * If the administrator did not manually
             * enter another recipient, use the
             * customer's saved phone number.
             */
            if (!recipient) {
                recipient =
                    String(
                        customer.phone || ""
                    ).trim();
            }
        }

        if (!recipient) {
            return res.status(400).json({
                success: false,
                message:
                    "A WhatsApp number is required."
            });
        }

        /*
         * Require a sensible international number.
         * The provider service performs final
         * normalization before sending.
         */
        const digits =
            recipient.replace(/\D/g, "");

        if (
            digits.length < 10 ||
            digits.length > 15
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Enter a valid WhatsApp number in international format, for example +923001234567."
            });
        }

        const result =
            await providerService
                .sendWhatsApp({
                    to: recipient,
                    message
                });

        await db.query(
            `
            INSERT INTO notification_delivery_logs
                (
                    customer_id,
                    channel,
                    recipient,
                    subject,
                    message,
                    status,
                    provider,
                    provider_message_id,
                    sent_at
                )
            VALUES
                (
                    ?,
                    'WhatsApp',
                    ?,
                    NULL,
                    ?,
                    ?,
                    'WasenderAPI',
                    ?,
                    CURRENT_TIMESTAMP
                )
            `,
            [
                customerId,
                recipient,
                message,
                result.simulated
                    ? "Simulated"
                    : "Sent",
                result.providerMessageId ||
                    null
            ]
        );

        return res.json({
            success: true,
            simulated:
                Boolean(result.simulated),
            provider:
                "WasenderAPI",
            providerMessageId:
                result.providerMessageId ||
                null,
            customer: customer
                ? {
                    id:
                        customer.id,
                    name:
                        customer.full_name
                }
                : null,
            recipient,
            message:
                result.simulated
                    ? "WhatsApp message simulated successfully."
                    : "WhatsApp message sent successfully."
        });

    } catch (error) {
        try {
            await db.query(
                `
                INSERT INTO notification_delivery_logs
                    (
                        customer_id,
                        channel,
                        recipient,
                        subject,
                        message,
                        status,
                        provider,
                        error_message
                    )
                VALUES
                    (
                        ?,
                        'WhatsApp',
                        ?,
                        NULL,
                        ?,
                        'Failed',
                        'WasenderAPI',
                        ?
                    )
                `,
                [
                    customerId,
                    recipient || null,
                    message,
                    error.message
                ]
            );
        } catch (logError) {
            console.error(
                "Unable to log manual WhatsApp failure:",
                logError.message
            );
        }

        return res.status(500).json({
            success: false,
            message:
                error.message
        });
    }
};


exports.getTemplates = async (req, res) => {
    try {
        const [templates] = await db.query(`
            SELECT
                id,
                template_key,
                template_name,
                template_category,
                channel,
                subject,
                body,
                email_heading,
                email_preheader,
                email_button_text,
                email_button_url,
                email_banner_url,
                is_system_template,
                status,
                updated_at
            FROM notification_templates
            ORDER BY
                template_category,
                channel,
                template_name
        `);

        res.json({
            success: true,
            templates
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.saveTemplate = async (req, res) => {
    try {
        const id =
            Number(req.params.id);

        const templateName =
            String(
                req.body.template_name || ""
            ).trim();

        const templateCategory =
            String(
                req.body.template_category ||
                "General"
            ).trim();

        const channel =
            String(
                req.body.channel || ""
            ).trim();

        const subject =
            String(
                req.body.subject || ""
            ).trim() || null;

        const body =
            String(
                req.body.body || ""
            ).trim();

        const emailHeading =
            String(
                req.body.email_heading || ""
            ).trim() || null;

        const emailPreheader =
            String(
                req.body.email_preheader || ""
            ).trim() || null;

        const emailButtonText =
            String(
                req.body.email_button_text || ""
            ).trim() || null;

        const emailButtonUrl =
            String(
                req.body.email_button_url || ""
            ).trim() || null;

        const emailBannerUrl =
            String(
                req.body.email_banner_url || ""
            ).trim() || null;

        const status =
            req.body.status === "Inactive"
                ? "Inactive"
                : "Active";

        if (
            !id ||
            !templateName ||
            !CHANNELS.includes(channel) ||
            !body
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Template name, valid channel and body are required."
            });
        }

        if (
            channel === "Email" &&
            !subject
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Email templates require a subject."
            });
        }

        const [existingRows] =
            await db.query(
                `
                SELECT
                    id,
                    template_key,
                    is_system_template
                FROM notification_templates
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );

        if (!existingRows.length) {
            return res.status(404).json({
                success: false,
                message:
                    "Notification template not found."
            });
        }

        await db.query(
            `
            UPDATE notification_templates
            SET
                template_name = ?,
                template_category = ?,
                channel = ?,
                subject = ?,
                body = ?,
                email_heading = ?,
                email_preheader = ?,
                email_button_text = ?,
                email_button_url = ?,
                email_banner_url = ?,
                status = ?,
                updated_by_admin_id = ?
            WHERE id = ?
            `,
            [
                templateName,
                templateCategory,
                channel,
                subject,
                body,
                emailHeading,
                emailPreheader,
                emailButtonText,
                emailButtonUrl,
                emailBannerUrl,
                status,
                req.admin?.id ||
                    req.user?.id ||
                    null,
                id
            ]
        );

        const [[template]] =
            await db.query(
                `
                SELECT
                    id,
                    template_key,
                    template_name,
                    template_category,
                    channel,
                    subject,
                    body,
                    email_heading,
                    email_preheader,
                    email_button_text,
                    email_button_url,
                    email_banner_url,
                    is_system_template,
                    status,
                    updated_at
                FROM notification_templates
                WHERE id = ?
                `,
                [id]
            );

        res.json({
            success: true,
            message:
                "Notification template updated successfully.",
            template
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.getLogs = async (req, res) => {
    try {
        const [logs] = await db.query(`
            SELECT id, customer_id, channel, template_key, recipient, subject, status, provider, provider_message_id, error_message, sent_at, created_at
            FROM notification_delivery_logs
            ORDER BY id DESC
            LIMIT 250
        `);
        res.json({ success: true, logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCustomerPreferences = async (req, res) => {
    try {
        const [customers] = await db.query(`
            SELECT id, full_name, email, phone, status,
                   email_reminders_enabled, whatsapp_reminders_enabled, sms_reminders_enabled
            FROM customers
            WHERE deleted_at IS NULL
            ORDER BY id DESC
            LIMIT 500
        `);
        res.json({ success: true, customers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCustomerPreferences = async (req, res) => {
    try {
        const customerId = Number(req.params.customerId);
        if (!customerId) {
            return res.status(400).json({ success: false, message: "A valid customer ID is required." });
        }

        await db.query(`
            UPDATE customers
            SET email_reminders_enabled = ?, whatsapp_reminders_enabled = ?, sms_reminders_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_at IS NULL
        `, [bool(req.body.email_enabled) ? 1 : 0, bool(req.body.whatsapp_enabled) ? 1 : 0, bool(req.body.sms_enabled) ? 1 : 0, customerId]);

        res.json({ success: true, message: "Customer notification preferences updated." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
