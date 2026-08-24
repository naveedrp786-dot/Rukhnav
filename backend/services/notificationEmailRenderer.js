"use strict";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function messageToHtml(message) {

    const safe =
        escapeHtml(message);

    return safe
        .split(/\r?\n\r?\n/)
        .map(block => `
            <p style="
                margin:0 0 16px;
                font-size:15px;
                line-height:1.75;
                color:#4b4b43;
            ">
                ${block.replace(
                    /\r?\n/g,
                    "<br>"
                )}
            </p>
        `)
        .join("");
}


function absoluteStoreUrl(value) {

    const storeUrl =
        process.env.FRONTEND_URL ||
        process.env.APP_BASE_URL ||
        "https://www.rukhnav.store";

    if (!value) {
        return storeUrl;
    }

    if (
        /^https?:\/\//i.test(
            String(value)
        )
    ) {
        return String(value);
    }

    return (
        storeUrl.replace(/\/$/, "") +
        "/" +
        String(value).replace(/^\//, "")
    );
}


function renderEmail({
    subject = "",
    message = "",
    heading = "",
    preheader = "",
    buttonText = "",
    buttonUrl = "",
    bannerUrl = ""
} = {}) {

    const storeUrl =
        absoluteStoreUrl("");

    const safeSubject =
        escapeHtml(subject);

    const safeHeading =
        escapeHtml(
            heading ||
            subject ||
            "A message from RUKHNAV"
        );

    const safePreheader =
        escapeHtml(
            preheader ||
            subject ||
            "RUKHNAV notification"
        );

    const safeButtonText =
        escapeHtml(buttonText);

    const safeButtonUrl =
        escapeHtml(
            absoluteStoreUrl(
                buttonUrl
            )
        );

    const safeBannerUrl =
        bannerUrl
            ? escapeHtml(
                absoluteStoreUrl(
                    bannerUrl
                )
            )
            : "";

    const bodyHtml =
        messageToHtml(message);

    const bannerHtml =
        safeBannerUrl
            ? `
                <tr>
                    <td style="
                        padding:0;
                    ">
                        <img
                            src="${safeBannerUrl}"
                            alt="RUKHNAV"
                            width="600"
                            style="
                                display:block;
                                width:100%;
                                max-width:600px;
                                height:auto;
                                border:0;
                            "
                        >
                    </td>
                </tr>
            `
            : "";

    const buttonHtml =
        buttonText
            ? `
                <table
                    role="presentation"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                        margin:25px auto 8px;
                    "
                >
                    <tr>
                        <td
                            bgcolor="#1f5138"
                            style="
                                border-radius:8px;
                                text-align:center;
                            "
                        >
                            <a
                                href="${safeButtonUrl}"
                                style="
                                    display:inline-block;
                                    padding:13px 25px;
                                    font-family:Arial,sans-serif;
                                    font-size:14px;
                                    font-weight:700;
                                    color:#ffffff;
                                    text-decoration:none;
                                    letter-spacing:.3px;
                                "
                            >
                                ${safeButtonText}
                            </a>
                        </td>
                    </tr>
                </table>
            `
            : "";

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <title>${safeSubject}</title>
</head>

<body style="
    margin:0;
    padding:0;
    background:#f4f1e9;
    font-family:Arial,Helvetica,sans-serif;
">

<div style="
    display:none;
    max-height:0;
    overflow:hidden;
    opacity:0;
">
    ${safePreheader}
</div>

<table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
        width:100%;
        background:#f4f1e9;
    "
>
<tr>
<td
    align="center"
    style="padding:28px 12px;"
>

<table
    role="presentation"
    width="600"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="
        width:100%;
        max-width:600px;
        background:#ffffff;
        border-radius:16px;
        overflow:hidden;
        box-shadow:
            0 8px 30px
            rgba(32,52,39,.08);
    "
>

<tr>
<td
    align="center"
    style="
        padding:30px 25px 24px;
        background:#173f2c;
    "
>
    <div style="
        color:#d8b45b;
        font-family:Georgia,serif;
        font-size:30px;
        font-weight:700;
        letter-spacing:5px;
    ">
        RUKHNAV
    </div>

    <div style="
        margin-top:7px;
        color:#f3ead3;
        font-size:11px;
        letter-spacing:2px;
        text-transform:uppercase;
    ">
        Beauty Inspired by Nature
    </div>
</td>
</tr>

${bannerHtml}

<tr>
<td style="
    padding:36px 38px 24px;
">

    <div style="
        width:44px;
        height:3px;
        margin:0 auto 18px;
        background:#d8b45b;
        border-radius:3px;
    "></div>

    <h1 style="
        margin:0 0 24px;
        color:#173f2c;
        font-family:Georgia,serif;
        font-size:26px;
        line-height:1.3;
        text-align:center;
        font-weight:600;
    ">
        ${safeHeading}
    </h1>

    ${bodyHtml}

    ${buttonHtml}

</td>
</tr>

<tr>
<td
    align="center"
    style="
        padding:24px 30px;
        border-top:1px solid #eee7d8;
        background:#fbf9f4;
    "
>
    <p style="
        margin:0 0 8px;
        color:#173f2c;
        font-size:13px;
        font-weight:700;
    ">
        RUKHNAV
    </p>

    <p style="
        margin:0 0 10px;
        color:#81796d;
        font-size:11px;
        line-height:1.6;
    ">
        Herbal Beauty • Naturally Inspired • Made With Care
    </p>

    <a
        href="${escapeHtml(storeUrl)}"
        style="
            color:#9a7628;
            font-size:12px;
            font-weight:700;
            text-decoration:none;
        "
    >
        www.rukhnav.store
    </a>

    <p style="
        margin:14px 0 0;
        color:#aaa294;
        font-size:9px;
        line-height:1.5;
    ">
        This message was sent by RUKHNAV.
        Please do not share sensitive account
        information by email.
    </p>
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
}


module.exports = {
    renderEmail,
    escapeHtml,
    messageToHtml
};
