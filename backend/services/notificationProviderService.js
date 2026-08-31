"use strict";

const twilio = require("twilio");

const emailRenderer =
    require("./notificationEmailRenderer");

/**
 * Development simulation is enabled by default
 * unless the application is running in production.
 */
function isSimulationMode() {
    if (
        process.env
            .NOTIFICATION_SIMULATION_MODE ===
        "true"
    ) {
        return true;
    }

    if (
        process.env
            .NOTIFICATION_SIMULATION_MODE ===
        "false"
    ) {
        return false;
    }

    return process.env.NODE_ENV !== "production";
}

/**
 * Ensure phone numbers use international format.
 */
function normalizePhone(phone) {
    let value =
        String(phone || "")
            .trim()
            .replace(/[^\d+]/g, "");

    if (value.startsWith("00")) {
        value = `+${value.slice(2)}`;
    }

    if (!value.startsWith("+")) {
        value = `+${value}`;
    }

    return value;
}

/**
 * Return a simulated provider response during
 * local development without sending a real message.
 */
function simulatedResult(channel, recipient) {
    const providerMessageId =
        `SIM-${channel.toUpperCase()}-${Date.now()}`;

    console.log(
        `[SIMULATED ${channel}] To: ${recipient}`
    );

    return {
        success: true,
        simulated: true,
        providerMessageId
    };
}

/**
 * Send an email through the Resend HTTPS API.
 */
async function sendEmail({
    to,
    subject,
    message,
    heading = "",
    preheader = "",
    buttonText = "",
    buttonUrl = "",
    bannerUrl = ""
}) {
    if (isSimulationMode()) {
        console.log(
            `[SIMULATED EMAIL MESSAGE] ${message}`
        );

        return simulatedResult(
            "email",
            to
        );
    }

    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
        throw new Error(
            "Resend email configuration is incomplete."
        );
    }

    const {
        sendEmail: sendTransactionalEmail
    } = require("./emailService");

    const html =
        emailRenderer.renderEmail({
            subject,
            message,
            heading,
            preheader,
            buttonText,
            buttonUrl,
            bannerUrl
        });

    const sent = await sendTransactionalEmail(
        to,
        subject,
        html
    );

    if (!sent) {
        throw new Error(
            "Resend did not accept the email."
        );
    }

    return {
        success: true,
        simulated: false,
        providerMessageId: null
    };
}

/**
 * Create a Twilio client only when required.
 */
function getTwilioClient() {
    const accountSid =
        process.env.TWILIO_ACCOUNT_SID;

    const authToken =
        process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new Error(
            "Twilio account configuration is incomplete."
        );
    }

    return twilio(
        accountSid,
        authToken
    );
}

/**
 * Send a WhatsApp reminder through WasenderAPI.
 */
async function sendWhatsApp({
    to,
    message
}) {
    const recipient =
        normalizePhone(to);

    if (isSimulationMode()) {
        console.log(
            `[SIMULATED WHATSAPP MESSAGE] ${message}`
        );

        return simulatedResult(
            "whatsapp",
            recipient
        );
    }

    const apiToken =
        process.env.WASENDER_API_TOKEN;

    if (!apiToken) {
        throw new Error(
            "WasenderAPI WhatsApp configuration is incomplete."
        );
    }

    /*
     * WasenderAPI accepts the recipient in
     * international E.164 format.
     */
    const response = await fetch(
        "https://www.wasenderapi.com/api/send-message",
        {
            method: "POST",
            headers: {
                "Authorization":
                    `Bearer ${apiToken}`,
                "Content-Type":
                    "application/json",
                "Accept":
                    "application/json"
            },
            body: JSON.stringify({
                to: recipient,
                text: String(message || "")
            })
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (
        !response.ok ||
        !data ||
        data.success !== true
    ) {
        const providerMessage =
            data?.message ||
            data?.error ||
            `HTTP ${response.status}`;

        throw new Error(
            `WasenderAPI WhatsApp delivery failed: ${providerMessage}`
        );
    }

    const providerMessageId =
        data?.data?.msgId ??
        data?.data?.messageId ??
        data?.data?.id ??
        data?.msgId ??
        null;

    return {
        success: true,
        simulated: false,
        providerMessageId
    };
}

/**
 * Send an SMS reminder through Twilio.
 */
async function sendSms({
    to,
    message
}) {
    const recipient =
        normalizePhone(to);

    if (isSimulationMode()) {
        console.log(
            `[SIMULATED SMS MESSAGE] ${message}`
        );

        return simulatedResult(
            "sms",
            recipient
        );
    }

    if (!process.env.TWILIO_SMS_FROM) {
        throw new Error(
            "Twilio SMS sender is not configured."
        );
    }

    const client =
        getTwilioClient();

    const result =
        await client.messages.create({
            body: message,
            from: normalizePhone(
                process.env.TWILIO_SMS_FROM
            ),
            to: recipient
        });

    return {
        success: true,
        simulated: false,
        providerMessageId:
            result.sid || null
    };
}

/**
 * Prevent message text from being interpreted
 * as unsafe HTML inside an email.
 */
function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
}

module.exports = {
    sendEmail,
    sendWhatsApp,
    sendSms,
    isSimulationMode
};