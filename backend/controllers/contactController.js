"use strict";

const {
    sendEmail
} = require("../services/emailService");

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function clean(value = "") {
    return String(value || "").trim();
}

exports.sendContactMessage = async (
    req,
    res
) => {
    try {
        const name =
            clean(req.body?.name);

        const email =
            clean(req.body?.email)
                .toLowerCase();

        const subject =
            clean(req.body?.subject);

        const message =
            clean(req.body?.message);

        if (
            !name ||
            !email ||
            !subject ||
            !message
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Please complete all contact form fields."
            });
        }

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid email address."
            });
        }

        if (name.length > 120) {
            return res.status(400).json({
                success: false,
                message:
                    "Full name is too long."
            });
        }

        if (email.length > 190) {
            return res.status(400).json({
                success: false,
                message:
                    "Email address is too long."
            });
        }

        if (subject.length > 200) {
            return res.status(400).json({
                success: false,
                message:
                    "Subject is too long."
            });
        }

        if (message.length > 5000) {
            return res.status(400).json({
                success: false,
                message:
                    "Message must be 5,000 characters or fewer."
            });
        }

        const adminEmail =
            process.env.CONTACT_ADMIN_EMAIL ||
            "naveedrp786@gmail.com";

        const html = `
            <div style="
                max-width:680px;
                margin:auto;
                font-family:Arial,sans-serif;
                color:#222;
                line-height:1.6;
            ">
                <h2 style="color:#17452f;">
                    New RUKHNAV Customer Message
                </h2>

                <p>
                    A customer submitted a message
                    through the RUKHNAV website.
                </p>

                <table
                    cellpadding="8"
                    cellspacing="0"
                    style="
                        width:100%;
                        border-collapse:collapse;
                        margin:18px 0;
                    "
                >
                    <tr>
                        <td style="font-weight:bold;width:130px;">
                            Name
                        </td>
                        <td>
                            ${escapeHtml(name)}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-weight:bold;">
                            Email
                        </td>
                        <td>
                            <a href="mailto:${escapeHtml(email)}">
                                ${escapeHtml(email)}
                            </a>
                        </td>
                    </tr>

                    <tr>
                        <td style="font-weight:bold;">
                            Subject
                        </td>
                        <td>
                            ${escapeHtml(subject)}
                        </td>
                    </tr>
                </table>

                <div style="
                    padding:16px;
                    background:#f7f4ec;
                    border-radius:10px;
                    white-space:pre-wrap;
                ">${escapeHtml(message)}</div>

                <p style="
                    margin-top:20px;
                    font-size:12px;
                    color:#666;
                ">
                    Sent automatically from
                    the RUKHNAV website contact form.
                </p>
            </div>
        `;

        const sent =
            await sendEmail(
                adminEmail,
                `RUKHNAV Website Contact: ${subject}`,
                html
            );

        if (!sent) {
            return res.status(502).json({
                success: false,
                message:
                    "We could not send your message right now. Please try again shortly."
            });
        }

        return res.status(201).json({
            success: true,
            message:
                "Thank you. Your message has been sent successfully."
        });

    } catch (error) {
        console.error(
            "Contact form error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to send your message right now."
        });
    }
};
