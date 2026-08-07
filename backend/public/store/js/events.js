"use strict";

const EventsPage = {
    events: [],
    upcoming: [],
    loyalty: null,
    view: "cards",
    deleteId: null,

    async init() {
        await this.waitForStore();
        this.bind();

        if (!API.isAuthenticated()) {
            this.showAuth();
            return;
        }

        await this.loadAccessAndEvents();
    },

    waitForStore() {
        return new Promise(resolve => {
            if (Store.settings && Object.keys(Store.settings).length) {
                resolve();
                return;
            }

            document.addEventListener(
                "rukhnav:store-ready",
                resolve,
                { once: true }
            );
        });
    },

    bind() {
        document.getElementById("addEventButton")
            .addEventListener("click", () => this.openEventModal());

        document.querySelectorAll("[data-open-event-modal]")
            .forEach(button => {
                button.addEventListener("click", () => this.openEventModal());
            });

        document.querySelectorAll("[data-close-event-modal]")
            .forEach(button => {
                button.addEventListener("click", () => this.closeEventModal());
            });

        document.querySelectorAll("[data-close-delete-modal]")
            .forEach(button => {
                button.addEventListener("click", () => this.closeDeleteModal());
            });

        document.getElementById("eventForm")
            .addEventListener("submit", event => this.saveEvent(event));

        document.getElementById("eventsSearch")
            .addEventListener("input", () => this.renderEvents());

        document.getElementById("eventStatusFilter")
            .addEventListener("change", () => this.renderEvents());

        document.getElementById("eventTypeFilter")
            .addEventListener("change", () => this.renderEvents());

        document.getElementById("refreshEventsButton")
            .addEventListener("click", event => this.refresh(event.currentTarget));

        document.querySelectorAll("[data-events-view]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    this.view = button.dataset.eventsView;

                    document.querySelectorAll("[data-events-view]")
                        .forEach(item => {
                            item.classList.toggle(
                                "active",
                                item === button
                            );
                        });

                    this.renderEvents();
                });
            });

        document.getElementById("eventsGrid")
            .addEventListener("click", event => this.handleEventAction(event));

        document.getElementById("confirmDeleteButton")
            .addEventListener("click", () => this.confirmDelete());

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                this.closeEventModal();
                this.closeDeleteModal();
            }
        });
    },

    hideStates() {
        ["eventsLoading","eventsAuthState","eventsLockedState","eventsContent"]
            .forEach(id => {
                document.getElementById(id)?.classList.add("hidden");
            });
    },

    showAuth() {
        this.hideStates();
        document.getElementById("eventsAuthState").classList.remove("hidden");
    },

    showLocked(message = "") {
        this.hideStates();

        if (message) {
            document.getElementById("eventsLockedMessage").textContent = message;
        }

        document.getElementById("eventsLockedState").classList.remove("hidden");
    },

    async loadAccessAndEvents() {
        try {
            const loyaltyResponse =
                await API.get("/api/customer-loyalty/me");

            this.loyalty =
                loyaltyResponse.loyalty || {};

            if (!this.loyalty.benefits?.eventMenuEnabled) {
                const current =
                    Number(this.loyalty.lifetimePoints || 0);

                const needed =
                    Math.max(0, 5000 - current);

                this.showLocked(
                    `Reach Gold membership to unlock this premium feature. You need ${new Intl.NumberFormat("en-PK").format(needed)} more lifetime points.`
                );

                return;
            }

            document.getElementById("eventsMembershipLabel").textContent =
                `${this.loyalty.membershipLevel || "Gold"} Member Access`;

            await this.loadEvents();
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                this.handleAccessError(error);
                return;
            }

            Store.toast(error.message, "error");
            this.showLocked();
        }
    },

    async loadEvents() {
        this.hideStates();
        document.getElementById("eventsLoading").classList.remove("hidden");

        try {
            const [allResponse, upcomingResponse] =
                await Promise.all([
                    API.get("/api/customer-events?includeInactive=true"),
                    API.get("/api/customer-events/upcoming?days=60")
                ]);

            this.events =
                Array.isArray(allResponse.events)
                    ? allResponse.events
                    : [];

            this.upcoming =
                Array.isArray(upcomingResponse.events)
                    ? upcomingResponse.events
                    : [];

            this.hideStates();
            document.getElementById("eventsContent").classList.remove("hidden");

            this.renderStatistics();
            this.renderNextEvent();
            this.renderEvents();
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                this.handleAccessError(error);
                return;
            }

            Store.toast(error.message, "error");
            this.hideStates();
            document.getElementById("eventsContent").classList.remove("hidden");
        }
    },

    handleAccessError(error) {
        if (error.status === 401) {
            this.showAuth();
            return;
        }

        const data = error.data || {};
        const pointsNeeded =
            data.pointsNeeded ??
            data.requiredLifetimePoints;

        const message =
            pointsNeeded
                ? `Reach ${data.requiredCategory || "Gold"} membership to unlock Events & Reminders. You need ${new Intl.NumberFormat("en-PK").format(pointsNeeded)} more lifetime points.`
                : error.message;

        this.showLocked(message);
    },

    async refresh(button) {
        const original = button.innerHTML;

        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing';

        try {
            await this.loadEvents();
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    renderStatistics() {
        const active =
            this.events.filter(event =>
                String(event.status || "").toLowerCase() === "active"
            ).length;

        document.getElementById("totalEventsCount").textContent =
            this.events.length;

        document.getElementById("upcomingEventsCount").textContent =
            this.upcoming.length;

        document.getElementById("activeEventsCount").textContent =
            active;

        document.getElementById("inactiveEventsCount").textContent =
            this.events.length - active;
    },

    renderNextEvent() {
        const card =
            document.getElementById("nextEventCard");

        const next =
            this.upcoming[0];

        if (!next) {
            card.classList.add("hidden");
            return;
        }

        const date =
            this.parseDate(
                next.nextEventDate ||
                next.event_date
            );

        if (!date) {
            card.classList.add("hidden");
            return;
        }

        document.getElementById("nextEventMonth").textContent =
            date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

        document.getElementById("nextEventDay").textContent =
            String(date.getDate()).padStart(2, "0");

        document.getElementById("nextEventName").textContent =
            next.event_name;

        document.getElementById("nextEventDescription").textContent =
            `${next.event_type} · ${next.recurrence} · Reminder ${next.reminder_days} day(s) before`;

        document.getElementById("nextEventDays").textContent =
            Number(next.daysUntil || 0);

        card.classList.remove("hidden");
    },

    filteredEvents() {
        const search =
            document.getElementById("eventsSearch").value.trim().toLowerCase();

        const status =
            document.getElementById("eventStatusFilter").value;

        const type =
            document.getElementById("eventTypeFilter").value;

        return this.events.filter(event => {
            const eventStatus =
                String(event.status || "").toLowerCase();

            const haystack =
                [
                    event.event_name,
                    event.event_type,
                    event.notes
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

            if (search && !haystack.includes(search)) return false;
            if (status && eventStatus !== status) return false;
            if (type && event.event_type !== type) return false;

            return true;
        });
    },

    renderEvents() {
        const rows =
            this.filteredEvents();

        const empty =
            document.getElementById("eventsEmptyState");

        const grid =
            document.getElementById("eventsGrid");

        const timeline =
            document.getElementById("eventsTimeline");

        if (!this.events.length) {
            empty.classList.remove("hidden");
            grid.classList.add("hidden");
            timeline.classList.add("hidden");
            return;
        }

        empty.classList.add("hidden");

        if (this.view === "cards") {
            grid.innerHTML =
                rows.length
                    ? rows.map(event => this.eventCard(event)).join("")
                    : this.noResultsMarkup();

            grid.classList.remove("hidden");
            timeline.classList.add("hidden");
        } else {
            timeline.innerHTML =
                rows.length
                    ? rows.map(event => this.timelineItem(event)).join("")
                    : this.noResultsMarkup();

            timeline.classList.remove("hidden");
            grid.classList.add("hidden");
        }
    },

    eventCard(event) {
        const active =
            String(event.status || "").toLowerCase() === "active";

        const typeClass =
            String(event.event_type || "other")
                .toLowerCase()
                .replace(/\s+/g, "-");

        const channels =
            this.channels(event);

        return `
            <article
                class="event-card ${typeClass} ${active ? "" : "inactive"}"
                data-event-id="${Components.e(event.id)}"
            >
                <div class="event-card-accent"></div>

                <div class="event-card-body">
                    <div class="event-card-top">
                        <div class="event-type-icon">
                            <i class="${this.eventIcon(event.event_type)}"></i>
                        </div>

                        <span class="event-status ${active ? "" : "inactive"}">
                            ${active ? "Active" : "Paused"}
                        </span>
                    </div>

                    <h3>${Components.e(event.event_name)}</h3>

                    <div class="event-card-date">
                        ${Components.e(event.event_type)} · ${this.displayDate(event.nextEventDate || event.event_date)}
                    </div>

                    <div class="event-countdown">
                        <span>Next occurrence</span>
                        <strong>${this.daysText(event.daysUntil)}</strong>
                    </div>

                    <div class="event-channels">
                        ${
                            channels.length
                                ? channels.map(channel => `
                                    <span class="event-channel">
                                        <i class="${channel.icon}"></i>
                                        ${channel.label}
                                    </span>
                                `).join("")
                                : `<span class="event-channel">No channel selected</span>`
                        }
                    </div>

                    <p class="event-notes">
                        ${Components.e(event.notes || "No notes added.")}
                    </p>

                    <div class="event-card-actions">
                        <button type="button" data-edit-event>
                            <i class="fa-solid fa-pen"></i>
                            Edit
                        </button>

                        <button type="button" data-toggle-event>
                            <i class="fa-solid ${active ? "fa-pause" : "fa-rotate-left"}"></i>
                            ${active ? "Pause" : "Restore"}
                        </button>

                        <button type="button" class="event-delete-button" data-delete-event aria-label="Delete event">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    timelineItem(event) {
        return `
            <article class="timeline-event">
                <div class="timeline-event-date">
                    <strong>${this.displayDate(event.nextEventDate || event.event_date)}</strong>
                    <span>${this.daysText(event.daysUntil)}</span>
                </div>

                <div>
                    <h3>${Components.e(event.event_name)}</h3>
                    <p>${Components.e(event.event_type)} · ${Components.e(event.recurrence)}</p>
                </div>

                <a href="#" data-timeline-edit="${Components.e(event.id)}">Edit event</a>
            </article>
        `;
    },

    noResultsMarkup() {
        return `
            <div class="events-empty" style="grid-column:1/-1">
                <div><i class="fa-solid fa-magnifying-glass"></i></div>
                <h2>No matching events</h2>
                <p>Try changing your search or filters.</p>
            </div>
        `;
    },

    handleEventAction(event) {
        const card =
            event.target.closest("[data-event-id]");

        if (!card) return;

        const item =
            this.events.find(row =>
                String(row.id) === String(card.dataset.eventId)
            );

        if (!item) return;

        if (event.target.closest("[data-edit-event]")) {
            this.openEventModal(item);
            return;
        }

        if (event.target.closest("[data-toggle-event]")) {
            this.toggleEvent(item, card);
            return;
        }

        if (event.target.closest("[data-delete-event]")) {
            this.openDeleteModal(item.id);
        }
    },

    openEventModal(event = null) {
        const form =
            document.getElementById("eventForm");

        form.reset();

        document.getElementById("eventId").value =
            event?.id || "";

        document.getElementById("eventModalTitle").textContent =
            event ? "Edit special event" : "Add special event";

        if (event) {
            document.getElementById("eventType").value =
                event.event_type || "";

            document.getElementById("eventName").value =
                event.event_name || "";

            document.getElementById("eventDate").value =
                this.inputDate(event.event_date);

            document.getElementById("eventRecurrence").value =
                event.recurrence || "Yearly";

            document.getElementById("eventReminderDays").value =
                String(event.reminder_days ?? 5);

            document.getElementById("remindByEmail").checked =
                Boolean(Number(event.remind_by_email));

            document.getElementById("remindByWhatsapp").checked =
                Boolean(Number(event.remind_by_whatsapp));

            document.getElementById("remindBySms").checked =
                Boolean(Number(event.remind_by_sms));

            document.getElementById("eventNotes").value =
                event.notes || "";
        } else {
            document.getElementById("eventRecurrence").value =
                "Yearly";

            document.getElementById("eventReminderDays").value =
                "5";
        }

        this.clearFormMessage();

        const modal =
            document.getElementById("eventModal");

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("body-modal-open");

        setTimeout(() => document.getElementById("eventType").focus(), 50);
    },

    closeEventModal() {
        const modal =
            document.getElementById("eventModal");

        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("body-modal-open");
    },

    async saveEvent(event) {
        event.preventDefault();

        const id =
            document.getElementById("eventId").value;

        const payload = {
            event_type:
                document.getElementById("eventType").value,
            event_name:
                document.getElementById("eventName").value.trim(),
            event_date:
                document.getElementById("eventDate").value,
            recurrence:
                document.getElementById("eventRecurrence").value,
            reminder_days:
                Number(document.getElementById("eventReminderDays").value),
            remind_by_email:
                document.getElementById("remindByEmail").checked,
            remind_by_whatsapp:
                document.getElementById("remindByWhatsapp").checked,
            remind_by_sms:
                document.getElementById("remindBySms").checked,
            notes:
                document.getElementById("eventNotes").value.trim() || null
        };

        if (
            !payload.remind_by_email &&
            !payload.remind_by_whatsapp &&
            !payload.remind_by_sms
        ) {
            this.showFormMessage(
                "Select at least one reminder channel.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById("saveEventButton");

        const original =
            button.innerHTML;

        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Saving';

        try {
            if (id) {
                await API.put(
                    `/api/customer-events/${encodeURIComponent(id)}`,
                    payload
                );
            } else {
                await API.post(
                    "/api/customer-events",
                    payload
                );
            }

            Store.toast(
                id
                    ? "Event updated successfully."
                    : "Event created successfully."
            );

            this.closeEventModal();
            await this.loadEvents();
        } catch (error) {
            this.showFormMessage(error.message, "error");
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    async toggleEvent(event, card) {
        const active =
            String(event.status || "").toLowerCase() === "active";

        card.classList.add("event-card-updating");

        try {
            await API.request(
                `/api/customer-events/${encodeURIComponent(event.id)}/${active ? "deactivate" : "restore"}`,
                {
                    method: "PATCH"
                }
            );

            Store.toast(
                active
                    ? "Event paused."
                    : "Event restored."
            );

            await this.loadEvents();
        } catch (error) {
            card.classList.remove("event-card-updating");
            Store.toast(error.message, "error");
        }
    },

    openDeleteModal(id) {
        this.deleteId = id;

        const modal =
            document.getElementById("deleteModal");

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("body-modal-open");
    },

    closeDeleteModal() {
        this.deleteId = null;

        const modal =
            document.getElementById("deleteModal");

        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("body-modal-open");
    },

    async confirmDelete() {
        if (!this.deleteId) return;

        const button =
            document.getElementById("confirmDeleteButton");

        const original =
            button.innerHTML;

        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Deleting';

        try {
            await API.delete(
                `/api/customer-events/${encodeURIComponent(this.deleteId)}/permanent`
            );

            Store.toast("Event deleted permanently.");
            this.closeDeleteModal();
            await this.loadEvents();
        } catch (error) {
            Store.toast(error.message, "error");
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    channels(event) {
        const channels = [];

        if (Number(event.remind_by_email)) {
            channels.push({
                icon: "fa-regular fa-envelope",
                label: "Email"
            });
        }

        if (Number(event.remind_by_whatsapp)) {
            channels.push({
                icon: "fa-brands fa-whatsapp",
                label: "WhatsApp"
            });
        }

        if (Number(event.remind_by_sms)) {
            channels.push({
                icon: "fa-solid fa-comment-sms",
                label: "SMS"
            });
        }

        return channels;
    },

    eventIcon(type) {
        const map = {
            Birthday: "fa-solid fa-cake-candles",
            "Family Birthday": "fa-solid fa-people-roof",
            Anniversary: "fa-solid fa-heart",
            Engagement: "fa-solid fa-ring",
            Other: "fa-solid fa-star"
        };

        return map[type] || map.Other;
    },

    daysText(days) {
        const value =
            Number(days);

        if (!Number.isFinite(value)) return "Date unavailable";
        if (value < 0) return "Past event";
        if (value === 0) return "Today";
        if (value === 1) return "Tomorrow";

        return `${value} days away`;
    },

    displayDate(value) {
        const date =
            this.parseDate(value);

        if (!date) return "Date unavailable";

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    },

    inputDate(value) {
        if (!value) return "";

        const text =
            String(value).slice(0, 10);

        return /^\d{4}-\d{2}-\d{2}$/.test(text)
            ? text
            : "";
    },

    parseDate(value) {
        if (!value) return null;

        const date =
            new Date(
                String(value).length === 10
                    ? `${value}T00:00:00`
                    : value
            );

        return Number.isNaN(date.getTime())
            ? null
            : date;
    },

    showFormMessage(message, type) {
        const element =
            document.getElementById("eventFormMessage");

        element.textContent = message;
        element.className =
            `event-form-message show ${type}`;
    },

    clearFormMessage() {
        const element =
            document.getElementById("eventFormMessage");

        element.textContent = "";
        element.className =
            "event-form-message";
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => EventsPage.init()
);
