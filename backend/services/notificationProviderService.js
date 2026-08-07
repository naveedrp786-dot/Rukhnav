"use strict";

const nodemailer = require("nodemailer");
const twilio = require("twilio");

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
 * Send an email through SMTP.
 */
async function sendEmail({
    to,
    subject,
    message
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

    const requiredValues = [
        process.env.SMTP_HOST,
        process.env.SMTP_PORT,
        process.env.SMTP_USER,
        process.env.SMTP_PASS,
        process.env.EMAIL_FROM
    ];

    if (requiredValues.some((value) => !value)) {
        throw new Error(
            "Email SMTP configuration is incomplete."
        );
    }

    const transporter =
        nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(
                process.env.SMTP_PORT
            ),
            secure:
                String(
                    process.env.SMTP_SECURE
                ).toLowerCase() === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

    const result =
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            text: message,
            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #222222;
                ">
                    <h2 style="color: #b8860b;">
                        RUKHNAV Event Reminder
                    </h2>

                    <p>
                        ${escapeHtml(message)}
                    </p>

                    <p style="
                        color: #777777;
                        font-size: 12px;
                    ">
                        You are receiving this reminder
                        because it was enabled in your
                        RUKHNAV customer account.
                    </p>
                </div>
            `
        });

    return {
        success: true,
        simulated: false,
        providerMessageId:
            result.messageId || null
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
 * Send a WhatsApp reminder through Twilio.
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

    if (
        !process.env
            .TWILIO_WHATSAPP_FROM
    ) {
        throw new Error(
            "Twilio WhatsApp sender is not configured."
        );
    }

    const client =
        getTwilioClient();

    const fromValue =
        process.env
            .TWILIO_WHATSAPP_FROM
            .startsWith("whatsapp:")
            ? process.env
                .TWILIO_WHATSAPP_FROM
            : `whatsapp:${normalizePhone(
                process.env
                    .TWILIO_WHATSAPP_FROM
            )}`;

    const result =
        await client.messages.create({
            body: message,
            from: fromValue,
            to: `whatsapp:${recipient}`
        });

    return {
        success: true,
        simulated: false,
        providerMessageId:
            result.sid || null
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