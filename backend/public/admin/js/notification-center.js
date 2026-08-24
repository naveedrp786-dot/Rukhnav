"use strict";

const API = "/api/admin/notification-center";
const token = localStorage.getItem("adminToken") || localStorage.getItem("token") || sessionStorage.getItem("adminToken") || sessionStorage.getItem("token");
if (!token) window.location.href = "/admin/login.html";

const state = {
    dashboard: null,
    templates: [],
    logs: [],
    customers: [],
    campaigns: []
};
const $ = id => document.getElementById(id);

async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        cache: "no-store",
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || "Request failed.");
    return data;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showMessage(message, type = "") {
    const element = $("message");
    element.textContent = message || "";
    element.className = `notification-message ${type}`.trim();
}

async function loadAll(options = {}) {
    const {
        preserveMessage = false,
        preserveRecipients = true
    } = options;

    // Save temporary test recipients before channel cards
    // are rebuilt by renderDashboard().
    const savedRecipients = {};

    if (preserveRecipients) {
        document
            .querySelectorAll("[data-channel]")
            .forEach(card => {
                const channel = card.dataset.channel;
                const input =
                    card.querySelector(".test-recipient");

                if (channel && input) {
                    savedRecipients[channel] =
                        input.value || "";
                }
            });
    }

    if (!preserveMessage) {
        showMessage("");
    }

    try {
        const [
            dashboard,
            templates,
            logs,
            customers,
            campaigns
        ] = await Promise.all([
            request("/dashboard"),
            request("/templates"),
            request("/logs"),
            request("/customer-preferences"),
            request("/campaigns")
        ]);

        state.dashboard = dashboard;
        state.templates =
            templates.templates || [];
        state.logs =
            logs.logs || [];
        state.customers =
            customers.customers || [];

        state.campaigns =
            campaigns.campaigns || [];

        renderDashboard();
        renderTemplates();
        renderLogs();
        renderPreferences();
        renderCampaigns();
        renderCampaignCustomerPicker();

        // Restore temporary recipient values after
        // renderDashboard() recreates the cards.
        if (preserveRecipients) {
            Object.entries(savedRecipients)
                .forEach(([channel, value]) => {
                    const card =
                        Array.from(
                            document.querySelectorAll(
                                "[data-channel]"
                            )
                        ).find(
                            item =>
                                item.dataset.channel ===
                                channel
                        );

                    const input =
                        card?.querySelector(
                            ".test-recipient"
                        );

                    if (input) {
                        input.value = value;
                    }
                });
        }

    } catch (error) {
        showMessage(
            error.message,
            "error"
        );
    }
}

function renderDashboard() {
    const data = state.dashboard;
    $("environmentBadge").textContent = `${data.environment} · ${data.globalSimulation ? "Simulation" : "Live"}`;
    $("totalDeliveries").textContent = data.counts.total;
    $("sentDeliveries").textContent = data.counts.sent;
    $("simulatedDeliveries").textContent = data.counts.simulated;
    $("failedDeliveries").textContent = data.counts.failed;

    $("channelCards").innerHTML = data.settings.map(channel => {
        const key = channel.channel.toLowerCase();
        const icon = channel.channel === "Email" ? "fa-envelope" : channel.channel === "WhatsApp" ? "fa-brands fa-whatsapp" : "fa-comment-sms";
        return `<article class="channel-card" data-channel="${escapeHtml(channel.channel)}">
            <header><div class="channel-icon"><i class="${icon.includes("fa-brands") ? icon : `fa-solid ${icon}`}"></i></div><div><span>${escapeHtml(channel.provider || "Provider")}</span><h2>${escapeHtml(channel.channel)}</h2></div><label class="switch"><input class="channel-enabled" type="checkbox" ${channel.enabled ? "checked" : ""}><i></i></label></header>
            <div class="readiness ${channel.environment.ready ? "ready" : "missing"}"><i class="fa-solid ${channel.environment.ready ? "fa-circle-check" : "fa-triangle-exclamation"}"></i><span>${channel.environment.ready ? "Production credentials ready" : "Production credentials incomplete"}</span></div>
            <div class="channel-fields"><label>Provider<input class="channel-provider" value="${escapeHtml(channel.provider || "")}"></label><label>From Name<input class="channel-from-name" value="${escapeHtml(channel.from_name || "RUKHNAV")}"></label><label>From Address<input class="channel-from-address" value="${escapeHtml(channel.from_address || "")}" placeholder="Optional display sender"></label><label class="simulation-row"><input class="channel-simulation" type="checkbox" ${channel.simulation_mode ? "checked" : ""}> Simulation mode</label></div>
            <div class="test-area"><input class="test-recipient" placeholder="${key === "email" ? "test@example.com" : "+923001234567"}"><button class="test-button" type="button"><i class="fa-solid fa-paper-plane"></i> Test</button></div>
            <footer><button class="save-channel erp-v5-btn erp-v5-btn--gold" type="button"><i class="fa-solid fa-floppy-disk"></i> Save ${escapeHtml(channel.channel)}</button></footer>
        </article>`;
    }).join("");

    document.querySelectorAll(".save-channel").forEach(button => button.addEventListener("click", saveChannel));
    document.querySelectorAll(".test-button").forEach(button => button.addEventListener("click", testChannel));
}

async function saveChannel(event) {
    const card = event.currentTarget.closest("[data-channel]");
    const channel = card.dataset.channel;

    const button = event.currentTarget;
    const originalHtml = button.innerHTML;

    try {
        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        const data = await request(
            `/channels/${encodeURIComponent(channel)}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    enabled:
                        card.querySelector(".channel-enabled").checked,

                    simulation_mode:
                        card.querySelector(".channel-simulation").checked,

                    provider:
                        card.querySelector(".channel-provider").value,

                    from_name:
                        card.querySelector(".channel-from-name").value,

                    from_address:
                        card.querySelector(".channel-from-address").value
                })
            }
        );

        await loadAll({
            preserveMessage: true,
            preserveRecipients: true
        });

        showMessage(
            data?.message ||
                `${channel} settings saved successfully.`,
            "success"
        );

    } catch (error) {
        showMessage(
            error.message || `Unable to save ${channel} settings.`,
            "error"
        );

        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

async function testChannel(event) {
    const card = event.currentTarget.closest("[data-channel]");
    const channel = card.dataset.channel;
    const recipient = card.querySelector(".test-recipient").value.trim();
    try {
        const data = await request(`/channels/${encodeURIComponent(channel)}/test`, {
            method: "POST",
            body: JSON.stringify({ recipient, subject: "RUKHNAV Notification Test", message: `This is a ${channel} test from RUKHNAV.` })
        });
        await loadAll({
            preserveMessage: true,
            preserveRecipients: true
        });

        showMessage(
            data.message ||
                `${channel} test completed successfully.`,
            "success"
        );

    } catch (error) {
        showMessage(
            error.message ||
                `Unable to test ${channel}.`,
            "error"
        );

        // Refresh counters/logs without destroying
        // the error message or entered recipient.
        await loadAll({
            preserveMessage: true,
            preserveRecipients: true
        });
    }
}

function renderPreferences() {
    const search = ($("preferenceSearch")?.value || "").toLowerCase();
    const rows = state.customers.filter(c => !search || [c.id, c.full_name, c.email, c.phone].join(" ").toLowerCase().includes(search));
    $("preferencesBody").innerHTML = rows.length ? rows.map(c => `<tr data-customer-id="${c.id}"><td><strong>${escapeHtml(c.full_name || "Customer")}</strong><small>${escapeHtml(c.email || c.phone || `#${c.id}`)}</small></td><td><input class="pref-email" type="checkbox" ${c.email_reminders_enabled ? "checked" : ""}></td><td><input class="pref-whatsapp" type="checkbox" ${c.whatsapp_reminders_enabled ? "checked" : ""}></td><td><input class="pref-sms" type="checkbox" ${c.sms_reminders_enabled ? "checked" : ""}></td><td><button class="save-preferences" type="button">Save</button></td></tr>`).join("") : `<tr><td colspan="5" class="empty">No customers found.</td></tr>`;
    document.querySelectorAll(".save-preferences").forEach(button => button.addEventListener("click", savePreferences));
}

async function savePreferences(event) {
    const row = event.currentTarget.closest("tr");
    try {
        await request(`/customer-preferences/${row.dataset.customerId}`, { method: "PATCH", body: JSON.stringify({ email_enabled: row.querySelector(".pref-email").checked, whatsapp_enabled: row.querySelector(".pref-whatsapp").checked, sms_enabled: row.querySelector(".pref-sms").checked }) });
        showMessage("Customer notification preferences saved.", "success");
    } catch (error) { showMessage(error.message, "error"); }
}

function renderTemplates() {
    $("templatesBody").innerHTML = state.templates.map(t => `<tr><td><strong>${escapeHtml(t.template_name)}</strong><small>${escapeHtml(t.template_key)}</small></td><td>${escapeHtml(t.channel)}</td><td>${escapeHtml(t.subject || "—")}</td><td><span class="status ${t.status.toLowerCase()}">${escapeHtml(t.status)}</span></td><td><button class="edit-template" data-template-id="${t.id}" type="button"><i class="fa-solid fa-pen"></i> Edit</button></td></tr>`).join("");
    document.querySelectorAll(".edit-template").forEach(button => button.addEventListener("click", () => openTemplate(button.dataset.templateId)));
}

function openTemplate(id) {
    const t = state.templates.find(item => String(item.id) === String(id));
    if (!t) return;
    $("templateId").value = t.id; $("templateName").value = t.template_name; $("templateChannel").value = t.channel; $("templateSubject").value = t.subject || ""; $("templateBody").value = t.body; $("templateStatus").value = t.status;
    $("templateModal").classList.remove("hidden");
}

async function saveTemplate(event) {
    event.preventDefault();
    try {
        await request(`/templates/${$("templateId").value}`, { method: "PUT", body: JSON.stringify({ template_name: $("templateName").value, channel: $("templateChannel").value, subject: $("templateSubject").value, body: $("templateBody").value, status: $("templateStatus").value }) });
        closeTemplate(); showMessage("Template saved.", "success"); await loadAll();
    } catch (error) { showMessage(error.message, "error"); }
}

function renderLogs() {
    $("logsBody").innerHTML = state.logs.length ? state.logs.map(log => `<tr><td>${new Date(log.created_at).toLocaleString()}</td><td>${escapeHtml(log.channel)}</td><td>${escapeHtml(log.recipient)}</td><td><span class="status ${String(log.status).toLowerCase()}">${escapeHtml(log.status)}</span></td><td>${escapeHtml(log.provider || "—")}</td><td>${escapeHtml(log.error_message || log.provider_message_id || "—")}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">No delivery logs yet.</td></tr>`;
}

function activateTab(tab) {
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    ["channels", "preferences", "templates", "logs", "whatsapp", "campaigns"].forEach(name => $(`${name}View`).classList.toggle("hidden", name !== tab));
}

let selectedWhatsappCustomerId = null;

function clearWhatsappCustomer() {
    selectedWhatsappCustomerId = null;

    $("whatsappCustomerId").value = "";
    $("whatsappCustomerSearch").value = "";

    $("selectedWhatsappCustomer")
        .classList.add("hidden");

    $("whatsappCustomerResults")
        .classList.add("hidden");

    $("whatsappCustomerResults")
        .innerHTML = "";
}

function selectWhatsappCustomer(customer) {
    selectedWhatsappCustomerId =
        Number(customer.id);

    $("whatsappCustomerId").value =
        customer.id;

    $("whatsappCustomerSearch").value = "";

    $("whatsappRecipient").value =
        customer.phone || "";

    $("selectedWhatsappCustomerName")
        .textContent =
        customer.full_name ||
        `Customer #${customer.id}`;

    $("selectedWhatsappCustomerDetails")
        .textContent =
        [
            customer.phone || "",
            customer.email || ""
        ]
            .filter(Boolean)
            .join(" · ");

    $("selectedWhatsappCustomer")
        .classList.remove("hidden");

    $("whatsappCustomerResults")
        .classList.add("hidden");

    $("whatsappCustomerResults")
        .innerHTML = "";
}

function renderWhatsappCustomerSearch() {
    const search =
        String(
            $("whatsappCustomerSearch")
                .value || ""
        )
            .trim()
            .toLowerCase();

    const results =
        $("whatsappCustomerResults");

    if (!search) {
        results.innerHTML = "";
        results.classList.add("hidden");
        return;
    }

    const customers =
        state.customers
            .filter(customer => {
                const haystack = [
                    customer.id,
                    customer.full_name,
                    customer.email,
                    customer.phone
                ]
                    .join(" ")
                    .toLowerCase();

                return haystack.includes(search);
            })
            .slice(0, 12);

    if (!customers.length) {
        results.innerHTML =
            `<div class="wa-no-customer">
                No registered customer found.
                You can still enter a WhatsApp
                number manually.
            </div>`;

        results.classList.remove("hidden");
        return;
    }

    results.innerHTML =
        customers
            .map(customer => `
                <button
                    type="button"
                    class="wa-customer-option"
                    data-wa-customer-id="${customer.id}"
                >
                    <span class="wa-customer-avatar">
                        <i class="fa-solid fa-user"></i>
                    </span>

                    <span>
                        <strong>
                            ${escapeHtml(
                                customer.full_name ||
                                `Customer #${customer.id}`
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                [
                                    customer.phone || "",
                                    customer.email || ""
                                ]
                                    .filter(Boolean)
                                    .join(" · ") ||
                                `Customer ID ${customer.id}`
                            )}
                        </small>
                    </span>
                </button>
            `)
            .join("");

    results
        .querySelectorAll(
            "[data-wa-customer-id]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const customer =
                        state.customers.find(
                            item =>
                                String(item.id) ===
                                String(
                                    button.dataset
                                        .waCustomerId
                                )
                        );

                    if (customer) {
                        selectWhatsappCustomer(
                            customer
                        );
                    }
                }
            );
        });

    results.classList.remove("hidden");
}

function updateWhatsappCharacterCount() {
    const length =
        $("whatsappMessage")
            .value.length;

    $("whatsappCharacterCount")
        .textContent =
        `${length} / 4000`;
}

async function sendManualWhatsapp(event) {
    event.preventDefault();

    const button =
        $("sendWhatsappButton");

    const recipient =
        $("whatsappRecipient")
            .value
            .trim();

    const message =
        $("whatsappMessage")
            .value
            .trim();

    if (!recipient) {
        showMessage(
            "Enter a WhatsApp number.",
            "error"
        );

        return;
    }

    if (!message) {
        showMessage(
            "Enter a WhatsApp message.",
            "error"
        );

        return;
    }

    const originalHtml =
        button.innerHTML;

    try {
        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

        const data =
            await request(
                "/whatsapp/send",
                {
                    method: "POST",
                    body: JSON.stringify({
                        customer_id:
                            selectedWhatsappCustomerId,
                        to:
                            recipient,
                        message
                    })
                }
            );

        $("whatsappMessage").value = "";
        updateWhatsappCharacterCount();

        /*
         * Refresh dashboard and delivery logs
         * while preserving the success message.
         */
        await loadAll({
            preserveMessage: true,
            preserveRecipients: true
        });

        showMessage(
            data.message ||
            "WhatsApp message sent successfully.",
            "success"
        );

    } catch (error) {
        showMessage(
            error.message ||
            "Unable to send WhatsApp message.",
            "error"
        );

    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}


const campaignPresets = {

    promotion: {
        subject:
            "A Special RUKHNAV Offer Just for You",

        whatsapp:
`🌿 *RUKHNAV*
_Beauty Inspired by Nature_

━━━━━━━━━━━━━━
🎁 *EXCLUSIVE OFFER*
━━━━━━━━━━━━━━

Assalam-o-Alaikum *{{customer_name}}* 👋

We have prepared a special RUKHNAV offer for you.

✨ Discover herbal beauty and hair-care products created with nature in mind.

🎟 *Offer:* [Add offer details]
📅 *Valid Until:* [Add expiry date]

🛍 Shop Now
{{shop_url}}

Thank you for being part of the RUKHNAV family. 💚

━━━━━━━━━━━━━━
🌿 *RUKHNAV*
_Herbal Beauty • Naturally Yours_`,

        email:
`Dear {{customer_name}},

We have prepared a special RUKHNAV offer for you.

Discover our herbal beauty and hair-care collection and enjoy this exclusive promotion.

Offer:
[Add offer details]

Valid Until:
[Add expiry date]

Shop online:
{{shop_url}}

Thank you for choosing RUKHNAV.

RUKHNAV
Beauty Inspired by Nature`
    },


    invitation: {
        subject:
            "You're Invited — A Special RUKHNAV Event",

        whatsapp:
`🌿 *RUKHNAV INVITATION*

Dear *{{customer_name}}*,

You are warmly invited to a special RUKHNAV event.

━━━━━━━━━━━━━━
✨ *EVENT DETAILS*
━━━━━━━━━━━━━━

📅 Date: [Add date]
🕒 Time: [Add time]
📍 Venue: [Add venue]

We would be delighted to have you with us.

Please reply to this message to confirm your attendance.

🌿 *RUKHNAV*
_Beauty Inspired by Nature_`,

        email:
`Dear {{customer_name}},

You are warmly invited to a special RUKHNAV event.

EVENT DETAILS

Date:
[Add date]

Time:
[Add time]

Venue:
[Add venue]

We would be delighted to have you with us.

Please contact RUKHNAV to confirm your attendance.

Warm regards,
RUKHNAV`
    },


    launch: {
        subject:
            "Introducing Something New from RUKHNAV",

        whatsapp:
`🌿 *RUKHNAV*
✨ *NEW PRODUCT LAUNCH*

Assalam-o-Alaikum *{{customer_name}}* 👋

Something new has arrived at RUKHNAV.

🌱 *[Product Name]*

[Add a short product introduction here.]

✨ Herbal inspired
✨ Quality focused
✨ Created with care

🛍 Discover it now:
{{shop_url}}

🌿 *RUKHNAV*
_Herbal Beauty • Naturally Yours_`,

        email:
`Dear {{customer_name}},

We are excited to introduce something new from RUKHNAV.

NEW PRODUCT:
[Product Name]

[Add product description]

Discover the new product:
{{shop_url}}

Thank you for choosing RUKHNAV.

RUKHNAV
Herbal Beauty • Naturally Yours`
    },


    sale: {
        subject:
            "RUKHNAV Sale — Limited Time Offer",

        whatsapp:
`🌿 *RUKHNAV SALE*

━━━━━━━━━━━━━━
🔥 *LIMITED TIME OFFER*
━━━━━━━━━━━━━━

Assalam-o-Alaikum *{{customer_name}}* 👋

Enjoy a special RUKHNAV sale for a limited time.

💚 Discount: [Add discount]
🎟 Code: [Add promo code]
📅 Ends: [Add expiry]

🛍 Shop:
{{shop_url}}

Don't miss out.

🌿 *RUKHNAV*
_Beauty Inspired by Nature_`,

        email:
`Dear {{customer_name}},

Our RUKHNAV sale is now live.

Discount:
[Add discount]

Promo Code:
[Add promo code]

Offer Ends:
[Add expiry]

Shop now:
{{shop_url}}

RUKHNAV
Beauty Inspired by Nature`
    }
};


function updateCampaignAudienceUI() {

    const audience =
        $("campaignAudience").value;

    $("campaignSelectedCustomers")
        .classList.toggle(
            "hidden",
            audience !==
                "Selected Customers"
        );

    $("campaignManualRecipients")
        .classList.toggle(
            "hidden",
            audience !==
                "Manual Recipients"
        );
}


function updateCampaignChannelUI() {

    $("campaignWhatsappComposer")
        .classList.toggle(
            "hidden",
            !$("campaignSendWhatsapp")
                .checked
        );

    $("campaignEmailComposer")
        .classList.toggle(
            "hidden",
            !$("campaignSendEmail")
                .checked
        );
}


function renderCampaignCustomerPicker() {

    const container =
        $("campaignCustomerPicker");

    if (!container) {
        return;
    }

    const search =
        String(
            $("campaignCustomerSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const customers =
        state.customers
            .filter(customer => {
                if (!search) {
                    return true;
                }

                return [
                    customer.id,
                    customer.full_name,
                    customer.email,
                    customer.phone
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(search);
            })
            .slice(0, 100);

    if (!customers.length) {
        container.innerHTML =
            `<div class="campaign-empty">
                No customers found.
            </div>`;

        updateSelectedCampaignCount();
        return;
    }

    const existingSelected =
        new Set(
            Array.from(
                document.querySelectorAll(
                    ".campaign-customer-check:checked"
                )
            ).map(
                input =>
                    String(input.value)
            )
        );

    container.innerHTML =
        customers
            .map(customer => `
                <label class="campaign-customer-row">
                    <input
                        type="checkbox"
                        class="campaign-customer-check"
                        value="${customer.id}"
                        ${
                            existingSelected.has(
                                String(customer.id)
                            )
                                ? "checked"
                                : ""
                        }
                    >

                    <span class="campaign-customer-avatar">
                        <i class="fa-solid fa-user"></i>
                    </span>

                    <span>
                        <strong>
                            ${escapeHtml(
                                customer.full_name ||
                                `Customer #${customer.id}`
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                [
                                    customer.phone || "",
                                    customer.email || ""
                                ]
                                    .filter(Boolean)
                                    .join(" · ")
                            )}
                        </small>
                    </span>
                </label>
            `)
            .join("");

    document
        .querySelectorAll(
            ".campaign-customer-check"
        )
        .forEach(input => {
            input.addEventListener(
                "change",
                updateSelectedCampaignCount
            );
        });

    updateSelectedCampaignCount();
}


function updateSelectedCampaignCount() {

    const count =
        document.querySelectorAll(
            ".campaign-customer-check:checked"
        ).length;

    if (
        $("selectedCampaignCustomerCount")
    ) {
        $("selectedCampaignCustomerCount")
            .textContent =
            `${count} selected`;
    }
}


function selectedCampaignCustomerIds() {

    return Array.from(
        document.querySelectorAll(
            ".campaign-customer-check:checked"
        )
    )
        .map(
            input =>
                Number(input.value)
        )
        .filter(Boolean);
}


function parseManualCampaignRecipients() {

    const consent =
        $("campaignManualConsent")
            .checked;

    const lines =
        String(
            $("campaignManualRecipientsText")
                .value || ""
        )
            .split(/\n+/)
            .map(line => line.trim())
            .filter(Boolean);

    return lines.map(line => {

        const parts =
            line.split("|")
                .map(value => value.trim());

        const name =
            parts[0] || "";

        const email =
            parts[1] || "";

        const phone =
            parts[2] || "";

        return {
            name,
            email,

            whatsapp_number:
                phone,

            email_marketing_consent:
                Boolean(
                    consent &&
                    email
                ),

            whatsapp_marketing_consent:
                Boolean(
                    consent &&
                    phone
                )
        };
    });
}


function campaignRecipientPayload() {

    return {
        audience_type:
            $("campaignAudience")
                .value,

        selected_customer_ids:
            selectedCampaignCustomerIds(),

        manual_recipients:
            parseManualCampaignRecipients()
    };
}


async function previewCampaignAudience() {

    try {
        const data =
            await request(
                "/campaigns/preview-audience",
                {
                    method: "POST",
                    body:
                        JSON.stringify(
                            campaignRecipientPayload()
                        )
                }
            );

        $("campaignPreviewTotal")
            .textContent =
            data.summary.total;

        $("campaignPreviewEmail")
            .textContent =
            data.summary.emailEligible;

        $("campaignPreviewWhatsapp")
            .textContent =
            data.summary
                .whatsappEligible;

        showMessage(
            "Campaign audience preview updated.",
            "success"
        );

    } catch (error) {
        showMessage(
            error.message,
            "error"
        );
    }
}


function applyCampaignPreset(
    presetKey
) {
    const preset =
        campaignPresets[presetKey];

    if (!preset) {
        return;
    }

    $("campaignEmailSubject")
        .value =
        preset.subject;

    $("campaignEmailBody")
        .value =
        preset.email;

    $("campaignWhatsappMessage")
        .value =
        preset.whatsapp;

    updateCampaignWhatsappCount();
}


function updateCampaignWhatsappCount() {

    const length =
        $("campaignWhatsappMessage")
            ?.value.length || 0;

    if (
        $("campaignWhatsappCount")
    ) {
        $("campaignWhatsappCount")
            .textContent =
            `${length} / 4000`;
    }
}


async function createCampaignFromComposer(
    action = "draft"
) {

    const sendEmail =
        $("campaignSendEmail")
            .checked;

    const sendWhatsapp =
        $("campaignSendWhatsapp")
            .checked;

    if (
        !sendEmail &&
        !sendWhatsapp
    ) {
        throw new Error(
            "Select Email, WhatsApp, or both."
        );
    }

    if (
        $("campaignAudience").value ===
            "Manual Recipients" &&
        !$("campaignManualConsent")
            .checked
    ) {
        throw new Error(
            "Confirm marketing consent for manual recipients before continuing."
        );
    }

    const scheduledValue =
        $("campaignScheduledAt")
            .value;

    if (
        action === "schedule" &&
        !scheduledValue
    ) {
        throw new Error(
            "Choose a schedule date and time."
        );
    }

    const created =
        await request(
            "/campaigns",
            {
                method:
                    "POST",

                body:
                    JSON.stringify({
                        campaign_name:
                            $("campaignName")
                                .value,

                        campaign_type:
                            $("campaignType")
                                .value,

                        audience_type:
                            $("campaignAudience")
                                .value,

                        send_email:
                            sendEmail,

                        send_whatsapp:
                            sendWhatsapp,

                        email_subject:
                            $("campaignEmailSubject")
                                .value,

                        email_body:
                            $("campaignEmailBody")
                                .value,

                        whatsapp_message:
                            $("campaignWhatsappMessage")
                                .value,

                        scheduled_at:
                            action === "schedule"
                                ? new Date(
                                    scheduledValue
                                  )
                                    .toISOString()
                                    .slice(0, 19)
                                    .replace(
                                        "T",
                                        " "
                                    )
                                : null
                    })
            }
        );

    const campaignId =
        created.campaign.id;

    const saved =
        await request(
            `/campaigns/${campaignId}/recipients`,
            {
                method:
                    "PUT",

                body:
                    JSON.stringify(
                        campaignRecipientPayload()
                    )
            }
        );

    const eligible =
        Number(
            saved.campaign
                .queued_count || 0
        );

    if (
        action !== "draft" &&
        eligible < 1
    ) {
        throw new Error(
            "Campaign has no eligible recipients. Review marketing consent and audience selection."
        );
    }

    if (
        action === "send"
    ) {
        const confirmed =
            window.confirm(
                `Send this campaign now?\n\nEligible recipient records: ${eligible}\n\nOnly recipients that passed server-side marketing consent checks will be queued.`
            );

        if (!confirmed) {
            return {
                cancelled:
                    true,
                campaign:
                    created.campaign
            };
        }

        await request(
            `/campaigns/${campaignId}/queue`,
            {
                method:
                    "POST"
            }
        );
    }

    return {
        cancelled:
            false,

        campaign:
            created.campaign,

        eligible
    };
}


async function runCampaignAction(
    action,
    button
) {

    const originalHtml =
        button.innerHTML;

    try {

        button.disabled = true;

        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Working...';

        const result =
            await createCampaignFromComposer(
                action
            );

        if (result.cancelled) {

            showMessage(
                "Campaign saved as Draft. Sending was cancelled.",
                "success"
            );

        } else if (
            action === "send"
        ) {

            showMessage(
                "Campaign queued for delivery. WhatsApp messages will be paced by the notification worker.",
                "success"
            );

        } else if (
            action === "schedule"
        ) {

            showMessage(
                "Campaign scheduled successfully.",
                "success"
            );

        } else {

            showMessage(
                "Campaign saved as Draft.",
                "success"
            );
        }

        await loadAll({
            preserveMessage:
                true,
            preserveRecipients:
                true
        });

    } catch (error) {

        showMessage(
            error.message,
            "error"
        );

    } finally {

        button.disabled = false;
        button.innerHTML =
            originalHtml;
    }
}


async function saveCampaignDraft(
    event
) {
    event.preventDefault();

    await runCampaignAction(
        "draft",
        $("saveCampaignButton")
    );
}


function renderCampaigns() {

    const container =
        $("campaignList");

    if (!container) {
        return;
    }

    if (!state.campaigns.length) {

        container.innerHTML =
            `<div class="campaign-empty">
                No campaigns created yet.
            </div>`;

        return;
    }

    container.innerHTML =
        state.campaigns
            .slice(0, 30)
            .map(campaign => {

                const channels = [
                    campaign.send_whatsapp
                        ? "WhatsApp"
                        : null,

                    campaign.send_email
                        ? "Email"
                        : null
                ]
                    .filter(Boolean)
                    .join(" + ");

                return `
                    <article class="campaign-history-card">

                        <div class="campaign-history-top">
                            <span>
                                ${escapeHtml(
                                    campaign.campaign_type
                                )}
                            </span>

                            <span class="campaign-status ${String(
                                campaign.status
                            ).toLowerCase()}">
                                ${escapeHtml(
                                    campaign.status
                                )}
                            </span>
                        </div>

                        <h4>
                            ${escapeHtml(
                                campaign.campaign_name
                            )}
                        </h4>

                        <p>
                            <i class="fa-solid fa-users"></i>
                            ${Number(
                                campaign.total_recipients ||
                                0
                            )} recipient(s)
                        </p>

                        <p>
                            <i class="fa-solid fa-paper-plane"></i>
                            ${escapeHtml(
                                channels || "No channel"
                            )}
                        </p>

                        <small>
                            ${new Date(
                                campaign.created_at
                            ).toLocaleString()}
                        </small>

                    </article>
                `;
            })
            .join("");
}


function closeTemplate() { $("templateModal").classList.add("hidden"); }

document.addEventListener("DOMContentLoaded", () => {
    $("refreshButton").addEventListener("click", loadAll);
    $("preferenceSearch").addEventListener("input", renderPreferences);
    $("templateForm").addEventListener("submit", saveTemplate);

    $("whatsappForm").addEventListener(
        "submit",
        sendManualWhatsapp
    );

    $("whatsappCustomerSearch").addEventListener(
        "input",
        renderWhatsappCustomerSearch
    );

    $("clearWhatsappCustomer").addEventListener(
        "click",
        clearWhatsappCustomer
    );

    $("whatsappMessage").addEventListener(
        "input",
        updateWhatsappCharacterCount
    );

    $("campaignAudience").addEventListener(
        "change",
        updateCampaignAudienceUI
    );

    $("campaignSendWhatsapp").addEventListener(
        "change",
        updateCampaignChannelUI
    );

    $("campaignSendEmail").addEventListener(
        "change",
        updateCampaignChannelUI
    );

    $("campaignCustomerSearch").addEventListener(
        "input",
        renderCampaignCustomerPicker
    );

    $("campaignWhatsappMessage").addEventListener(
        "input",
        updateCampaignWhatsappCount
    );

    $("previewCampaignAudience").addEventListener(
        "click",
        previewCampaignAudience
    );

    $("campaignForm").addEventListener(
        "submit",
        saveCampaignDraft
    );

    $("scheduleCampaignButton").addEventListener(
        "click",
        () => runCampaignAction(
            "schedule",
            $("scheduleCampaignButton")
        )
    );

    $("sendCampaignNowButton").addEventListener(
        "click",
        () => runCampaignAction(
            "send",
            $("sendCampaignNowButton")
        )
    );

    $("scheduleCampaignButton").addEventListener(
        "click",
        () => runCampaignAction(
            "schedule",
            $("scheduleCampaignButton")
        )
    );

    $("sendCampaignNowButton").addEventListener(
        "click",
        () => runCampaignAction(
            "send",
            $("sendCampaignNowButton")
        )
    );

    document
        .querySelectorAll(
            "[data-campaign-preset]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    applyCampaignPreset(
                        button.dataset
                            .campaignPreset
                    );
                }
            );
        });

    updateCampaignAudienceUI();
    updateCampaignChannelUI();
    applyCampaignPreset("promotion");

    document
        .querySelectorAll("[data-wa-message]")
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    $("whatsappMessage").value =
                        button.dataset.waMessage || "";

                    updateWhatsappCharacterCount();

                    $("whatsappMessage").focus();
                }
            );
        });
    document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => activateTab(b.dataset.tab)));
    document.querySelectorAll("[data-close-template]").forEach(b => b.addEventListener("click", closeTemplate));
    loadAll();
});
