"use strict";

const API = "/api/admin/notification-center";
const token = localStorage.getItem("adminToken") || localStorage.getItem("token") || sessionStorage.getItem("adminToken") || sessionStorage.getItem("token");
if (!token) window.location.href = "/admin/login.html";

const state = { dashboard: null, templates: [], logs: [], customers: [] };
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
            customers
        ] = await Promise.all([
            request("/dashboard"),
            request("/templates"),
            request("/logs"),
            request("/customer-preferences")
        ]);

        state.dashboard = dashboard;
        state.templates =
            templates.templates || [];
        state.logs =
            logs.logs || [];
        state.customers =
            customers.customers || [];

        renderDashboard();
        renderTemplates();
        renderLogs();
        renderPreferences();

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
    ["channels", "preferences", "templates", "logs"].forEach(name => $(`${name}View`).classList.toggle("hidden", name !== tab));
}
function closeTemplate() { $("templateModal").classList.add("hidden"); }

document.addEventListener("DOMContentLoaded", () => {
    $("refreshButton").addEventListener("click", loadAll);
    $("preferenceSearch").addEventListener("input", renderPreferences);
    $("templateForm").addEventListener("submit", saveTemplate);
    document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => activateTab(b.dataset.tab)));
    document.querySelectorAll("[data-close-template]").forEach(b => b.addEventListener("click", closeTemplate));
    loadAll();
});
