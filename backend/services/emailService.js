"use strict";

// =========================================
// RUKHNAV Transactional Email Service
// Resend HTTPS API
// =========================================

async function sendEmail(
    to,
    subject,
    html
) {

    try {

        const apiKey =
            process.env.RESEND_API_KEY;

        const from =
            process.env.EMAIL_FROM ||
            "RUKHNAV <onboarding@resend.dev>";

        if (!apiKey) {
            console.error(
                "❌ Email Error: RESEND_API_KEY is missing."
            );
            return false;
        }

        if (!to) {
            console.error(
                "❌ Email Error: Recipient is missing."
            );
            return false;
        }

        const response =
            await fetch(
                "https://api.resend.com/emails",
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${apiKey}`,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            from,
                            to: [to],
                            subject,
                            html
                        })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "❌ Resend Email Error:",
                response.status,
                data?.message ||
                data?.name ||
                "Unknown Resend error"
            );

            return false;
        }

        console.log(
            "✅ Email Sent:",
            data.id ||
            "Resend accepted message"
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Email Error:",
            error.message
        );

        console.error(
            "❌ Email Code:",
            error.code ||
            "UNKNOWN"
        );

        return false;
    }

}

module.exports = {
    sendEmail
};
