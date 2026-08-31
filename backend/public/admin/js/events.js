"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const API =
    RUKHNAV_ORIGIN + "/api/admin/events";

const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token");

if (!token) {
    location.href =
        "login.html";
}

function h() {
    return {
        "Content-Type":
            "application/json",
        Authorization:
            `Bearer ${token}`
    };
}

async function api(
    path = "",
    options = {}
) {
    const response =
        await fetch(
            API + path,
            {
                ...options,
                headers: {
                    ...h(),
                    ...(options.headers || {})
                }
            }
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch {}

    if (
        !response.ok ||
        data.success === false
    ) {
        throw new Error(
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

function e(value) {
    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;
}

function showMessage(
    text,
    type = ""
) {
    const element =
        document.getElementById(
            "eventsMessage"
        );

    element.textContent =
        text;

    element.className =
        `events-message ${type}`
            .trim();
}

async function loadSummary() {
    const data =
        await api("/summary");

    const s =
        data.summary || {};

    document.getElementById("evTotal").textContent =
        Number(s.totalEvents || 0);

    document.getElementById("evActive").textContent =
        Number(s.activeEvents || 0);

    document.getElementById("evBirthdays").textContent =
        Number(s.birthdays || 0);

    document.getElementById("evAnniversaries").textContent =
        Number(s.anniversaries || 0);

    document.getElementById("evPending").textContent =
        Number(s.pendingReminders || 0);

    document.getElementById("evSent").textContent =
        Number(s.sentReminders || 0);

    const mode =
        document.getElementById(
            "eventMode"
        );

    mode.textContent =
        data.developmentBypass
            ? "Development mode: verification, customer preferences and membership restrictions are bypassed for testing."
            : "Production mode: verification, preferences and membership permissions are enforced.";

    mode.className =
        `mode-banner ${data.developmentBypass ? "development" : "production"}`;
}

async function loadEvents() {
    const params =
        new URLSearchParams();

    const search =
        document.getElementById(
            "eventSearch"
        ).value.trim();

    const status =
        document.getElementById(
            "eventStatus"
        ).value;

    const type =
        document.getElementById(
            "eventType"
        ).value;

    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (type) params.set("type", type);

    const data =
        await api(
            `/?${params.toString()}`
        );

    const body =
        document.getElementById(
            "eventsBody"
        );

    if (!data.events.length) {
        body.innerHTML =
            '<tr><td colspan="8" class="empty">No matching events.</td></tr>';
        return;
    }

    body.innerHTML =
        data.events.map(
            item => {
                const channels = [
                    item.remind_by_email ? "Email" : "",
                    item.remind_by_whatsapp ? "WhatsApp" : "",
                    item.remind_by_sms ? "SMS" : ""
                ].filter(Boolean).join(", ");

                return `
                    <tr>
                        <td><strong>${e(item.full_name)}</strong><span>${e(item.email || item.phone || "")}</span></td>
                        <td><strong>${e(item.event_name)}</strong><span>${e(item.event_type)}</span></td>
                        <td>${e(String(item.event_date || "").slice(0,10))}<span>${e(item.recurrence)}</span></td>
                        <td>${e(channels || "None")}</td>
                        <td>${e(item.membership_level)}</td>
                        <td>${e(String(item.reminder_date || "").slice(0,10) || "—")}<span>${e(item.latest_reminder_status || "Not generated")}</span></td>
                        <td><span class="pill ${String(item.status).toLowerCase()}">${e(item.status)}</span></td>
                        <td>
                            <div class="event-row-actions">
                                <button data-status="${item.id}" data-value="${item.status === "Active" ? "Inactive" : "Active"}">${item.status === "Active" ? "Pause" : "Restore"}</button>
                                <button data-delete="${item.id}" ${item.status === "Active" ? "disabled" : ""}>Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        ).join("");

    body.querySelectorAll("[data-status]").forEach(
        button =>
            button.addEventListener(
                "click",
                () =>
                    updateStatus(
                        button.dataset.status,
                        button.dataset.value
                    )
            )
    );

    body.querySelectorAll("[data-delete]").forEach(
        button =>
            button.addEventListener(
                "click",
                () =>
                    deleteEvent(
                        button.dataset.delete
                    )
            )
    );
}

async function loadLogs() {
    const status =
        document.getElementById(
            "logStatus"
        ).value;

    const params =
        new URLSearchParams();

    if (status) {
        params.set(
            "status",
            status
        );
    }

    const data =
        await api(
            `/logs?${params.toString()}`
        );

    const body =
        document.getElementById(
            "logsBody"
        );

    if (!data.logs.length) {
        body.innerHTML =
            '<tr><td colspan="7" class="empty">No reminder logs.</td></tr>';
        return;
    }

    body.innerHTML =
        data.logs.map(
            log => `
                <tr>
                    <td><strong>${e(log.full_name)}</strong></td>
                    <td>${e(log.event_name)}<span>${e(log.event_type)}</span></td>
                    <td>${e(log.reminder_channel)}</td>
                    <td>${e(log.recipient)}</td>
                    <td>${e(String(log.scheduled_for || "").slice(0,10))}</td>
                    <td><span class="pill ${String(log.status).toLowerCase()}">${e(log.status)}</span></td>
                    <td>${Number(log.attempts || 0)}</td>
                </tr>
            `
        ).join("");
}

async function updateStatus(
    id,
    status
) {
    await api(
        `/${encodeURIComponent(id)}/status`,
        {
            method:
                "PATCH",
            body:
                JSON.stringify({
                    status
                })
        }
    );

    showMessage(
        `Event marked ${status}.`,
        "success"
    );

    await Promise.all([
        loadSummary(),
        loadEvents()
    ]);
}

async function deleteEvent(id) {
    if (
        !confirm(
            "Permanently delete this inactive event?"
        )
    ) {
        return;
    }

    await api(
        `/${encodeURIComponent(id)}`,
        {
            method:
                "DELETE"
        }
    );

    showMessage(
        "Event deleted.",
        "success"
    );

    await Promise.all([
        loadSummary(),
        loadEvents()
    ]);
}

async function runAction(
    endpoint,
    label
) {
    showMessage(
        `${label}...`
    );

    const data =
        await api(
            endpoint,
            {
                method:
                    "POST",
                body:
                    "{}"
            }
        );

    showMessage(
        data.message ||
        `${label} completed.`,
        "success"
    );

    await Promise.all([
        loadSummary(),
        loadEvents(),
        loadLogs()
    ]);
}

document.querySelectorAll(
    "[data-view]"
).forEach(
    button =>
        button.addEventListener(
            "click",
            () => {
                document.querySelectorAll(
                    "[data-view]"
                ).forEach(
                    item =>
                        item.classList.toggle(
                            "active",
                            item === button
                        )
                );

                const logs =
                    button.dataset.view ===
                    "logs";

                document.getElementById(
                    "eventsView"
                ).classList.toggle(
                    "hidden",
                    logs
                );

                document.getElementById(
                    "logsView"
                ).classList.toggle(
                    "hidden",
                    !logs
                );

                if (logs) {
                    loadLogs();
                }
            }
        )
);

document.getElementById("refreshEvents").addEventListener("click", loadEvents);
document.getElementById("refreshLogs").addEventListener("click", loadLogs);
document.getElementById("eventStatus").addEventListener("change", loadEvents);
document.getElementById("eventType").addEventListener("change", loadEvents);
document.getElementById("logStatus").addEventListener("change", loadLogs);
document.getElementById("eventSearch").addEventListener("input", () => {
    clearTimeout(window.eventSearchTimer);
    window.eventSearchTimer = setTimeout(loadEvents, 300);
});
document.getElementById("generateReminders").addEventListener("click", () => runAction("/reminders/generate", "Generating reminders"));
document.getElementById("processReminders").addEventListener("click", () => runAction("/reminders/process", "Processing reminders"));
document.getElementById("runReminderCycle").addEventListener("click", () => runAction("/reminders/run", "Running reminder cycle"));

Promise.all([
    loadSummary(),
    loadEvents()
]).catch(
    error =>
        showMessage(
            error.message,
            "error"
        )
);
