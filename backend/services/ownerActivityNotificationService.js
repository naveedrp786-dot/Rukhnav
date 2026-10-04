"use strict";

const {
    sendEmail
} = require("./emailService");

function clean(value, fallback = "") {
    const text =
        String(
            value === undefined ||
            value === null
                ? ""
                : value
        ).trim();

    return text || fallback;
}

function escapeHtml(value) {
    return clean(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cleanSubject(value) {
    return clean(value)
        .replace(/[\r\n]+/g, " ")
        .slice(0, 180);
}

function getOwnerEmail() {
    return clean(
        process.env.OWNER_NOTIFICATION_EMAIL ||
        process.env.ORDER_NOTIFICATION_EMAIL ||
        process.env.CONTACT_ADMIN_EMAIL ||
        process.env.EMAIL_USER
    );
}

async function notifyOwnerActivity({
    type = "CUSTOMER_ACTIVITY",
    title = "Customer Activity",
    customerName = "",
    customerEmail = "",
    customerPhone = "",
    reference = "",
    details = []
} = {}) {
    try {
        const recipient =
            getOwnerEmail();

        if (!recipient) {
            console.warn(
                "[Owner Activity Email] No owner email configured."
            );

            return false;
        }

        const safeTitle =
            cleanSubject(
                title,
                "Customer Activity"
            );

        const rows = [
            ["Activity", clean(type, "CUSTOMER_ACTIVITY")],
            ["Customer", clean(customerName, "-")],
            ["Email", clean(customerEmail, "-")],
            ["Phone", clean(customerPhone, "-")],
            ["Reference", clean(reference, "-")]
        ];

        if (Array.isArray(details)) {
            for (const item of details) {
                if (
                    !item ||
                    typeof item !== "object"
                ) {
                    continue;
                }

                const label =
                    clean(item.label);

                if (!label) {
                    continue;
                }

                rows.push([
                    label,
                    clean(item.value, "-")
                ]);
            }
        }

        const htmlRows =
            rows
                .map(
                    ([label, value]) => `
                        <tr>
                            <td style="padding:7px 12px 7px 0;vertical-align:top">
                                <strong>${escapeHtml(label)}</strong>
                            </td>
                            <td style="padding:7px 0;vertical-align:top">
                                ${escapeHtml(value)}
                            </td>
                        </tr>
                    `
                )
                .join("");

        const html = `
            <div style="
                font-family:Arial,sans-serif;
                line-height:1.6;
                color:#222;
            ">
                <h2 style="
                    margin:0 0 16px;
                    color:#17452f;
                ">
                    ${escapeHtml(safeTitle)}
                </h2>

                <p>
                    An important customer activity occurred
                    on the RUKHNAV website.
                </p>

                <table style="
                    border-collapse:collapse;
                    width:100%;
                    max-width:680px;
                ">
                    ${htmlRows}
                </table>

                <p style="
                    margin-top:20px;
                    font-size:12px;
                    color:#666;
                ">
                    Automated RUKHNAV owner notification.
                </p>
            </div>
        `;

        const sent =
            await sendEmail(
                recipient,
                `RUKHNAV — ${safeTitle}`,
                html
            );

        if (!sent) {
            console.error(
                `[Owner Activity Email: ${clean(type)}] Delivery was not accepted.`
            );
        }

        return Boolean(sent);

    } catch (error) {
        console.error(
            `[Owner Activity Email: ${clean(type)}]`,
            error.message
        );

        /*
         * Owner notifications are informational.
         * They must never fail the customer action.
         */
        return false;
    }
}

function queueOwnerActivity(payload) {
    Promise.resolve()
        .then(
            () =>
                notifyOwnerActivity(payload)
        )
        .catch(error => {
            console.error(
                "[Owner Activity Email]",
                error.message
            );
        });
}

module.exports = {
    notifyOwnerActivity,
    queueOwnerActivity,
    getOwnerEmail
};
