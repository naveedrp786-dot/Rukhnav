"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    family: 4,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
});

async function sendEmail(
    to,
    subject,
    html
) {

    try {

        const info =
            await transporter.sendMail({
                from:
                    `"RUKHNAV Cosmetics" <${process.env.EMAIL_USER}>`,

                to,
                subject,
                html
            });

        console.log(
            "✅ Email Sent:",
            info.messageId
        );

        return true;

    } catch (error) {

        console.error(
            "❌ Email Error:",
            error.message
        );

        console.error(
            "❌ Email Code:",
            error.code || "UNKNOWN"
        );

        return false;

    }

}

module.exports = {
    sendEmail
};
