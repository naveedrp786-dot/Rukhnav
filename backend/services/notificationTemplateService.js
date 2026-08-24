"use strict";

const db = require("../config/db");

function valueAtPath(
    source,
    path
) {
    return String(path || "")
        .split(".")
        .reduce(
            (
                value,
                key
            ) =>
                value !== undefined &&
                value !== null
                    ? value[key]
                    : undefined,
            source
        );
}

function renderString(
    text,
    variables
) {
    return String(text || "")
        .replace(
            /{{\s*([A-Za-z0-9_.-]+)\s*}}/g,
            (
                match,
                key
            ) => {
                const value =
                    valueAtPath(
                        variables,
                        key
                    );

                return value === undefined ||
                    value === null
                    ? ""
                    : String(value);
            }
        );
}

async function getTemplate(
    templateKey,
    channel
) {
    const [rows] =
        await db.query(
            `
            SELECT
                template_key,
                template_name,
                template_category,
                channel,
                subject,
                email_heading,
                email_preheader,
                body,
                email_button_text,
                email_button_url,
                email_banner_url,
                is_system_template,
                status
            FROM notification_templates
            WHERE template_key = ?
              AND channel = ?
              AND status = 'Active'
            LIMIT 1
            `,
            [
                templateKey,
                channel
            ]
        );

    return rows[0] || null;
}

async function renderTemplate({
    templateKey,
    channel,
    variables = {},
    fallbackSubject = "",
    fallbackMessage = ""
}) {
    const template =
        await getTemplate(
            templateKey,
            channel
        );

    return {
        template,

        subject:
            renderString(
                template?.subject ||
                fallbackSubject,
                variables
            ),

        message:
            renderString(
                template?.body ||
                fallbackMessage,
                variables
            ),

        emailHeading:
            renderString(
                template?.email_heading || "",
                variables
            ),

        emailPreheader:
            renderString(
                template?.email_preheader || "",
                variables
            ),

        emailButtonText:
            renderString(
                template?.email_button_text || "",
                variables
            ),

        emailButtonUrl:
            renderString(
                template?.email_button_url || "",
                variables
            ),

        emailBannerUrl:
            renderString(
                template?.email_banner_url || "",
                variables
            )
    };
}

module.exports = {
    getTemplate,
    renderTemplate,
    renderString
};
