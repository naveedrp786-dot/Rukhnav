const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({

    service: "gmail",

    auth: {

        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD

    }

});

async function sendEmail(to, subject, html) {

    try {

        const info = await transporter.sendMail({

            from: `"RUKHNAV Cosmetics" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html

        });

        console.log("✅ Email Sent:", info.messageId);

        return true;

    } catch (error) {

        console.error("❌ Email Error:", error.message);

        return false;

    }

}

module.exports = {
    sendEmail
};