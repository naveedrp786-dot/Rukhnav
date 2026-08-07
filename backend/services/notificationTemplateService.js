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
                channel,
                subject,
                body,
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
            )
    };
}

module.exports = {
    getTemplate,
    renderTemplate,
    renderString
};
