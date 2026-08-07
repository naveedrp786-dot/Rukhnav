"use strict";

(() => {
    if (window.RUKHNAV_ADMIN_NOTIFICATION_BELL_V2) {
        return;
    }

    window.RUKHNAV_ADMIN_NOTIFICATION_BELL_V2 = true;

    const API =
        "/api/admin/notifications";

    const state = {
        button: null,
        badge: null,
        panel: null,
        notifications: [],
        unreadCount: 0,
        open: false,
        refreshTimer: null
    };

    function getToken() {
        return (
            localStorage.getItem("adminToken") ||
            localStorage.getItem("token") ||
            localStorage.getItem("admin_token") ||
            sessionStorage.getItem("adminToken") ||
            sessionStorage.getItem("token") ||
            sessionStorage.getItem("admin_token") ||
            ""
        );
    }

    async function api(
        path = "",
        options = {}
    ) {
        const token =
            getToken();

        if (!token) {
            throw new Error(
                "Administrator session token is missing."
            );
        }

        const response =
            await fetch(
                `${API}${path}`,
                {
                    ...options,
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        Authorization:
                            token.startsWith("Bearer ")
                                ? token
                                : `Bearer ${token}`,
                        ...(options.body
                            ? {
                                "Content-Type":
                                    "application/json"
                            }
                            : {}),
                        ...(options.headers || {})
                    }
                }
            );

        const data =
            await response
                .json()
                .catch(() => ({}));

        if (
            !response.ok ||
            data.success === false
        ) {
            throw new Error(
                data.message ||
                `Notification request failed (${response.status}).`
            );
        }

        return data;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(
                /[&<>"']/g,
                character =>
                    ({
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#039;"
                    })[character]
            );
    }

    function findBellButton() {
        const explicit =
            document.querySelector(
                [
                    "#notificationButton",
                    "#notificationBtn",
                    "#notificationBell",
                    ".notification-btn",
                    ".notification-button",
                    ".notification-bell",
                    ".topbar-notification",
                    ".topbar-notifications",
                    "[data-notification-button]",
                    "[data-notification-bell]"
                ].join(",")
            );

        if (explicit) {
            return explicit;
        }

        /*
         * Robust fallback:
         * Find any clickable element in the admin topbar whose
         * descendant icon contains "bell" in its class name.
         * Supports:
         * fa-bell
         * fa-solid fa-bell
         * bi-bell
         * bi-bell-fill
         * other bell icon libraries
         */
        const topbar =
            document.querySelector(
                "#topbar-container, .topbar, header.topbar"
            );

        if (!topbar) {
            return null;
        }

        const clickables =
            topbar.querySelectorAll(
                "button, a, [role='button']"
            );

        for (const element of clickables) {
            const icon =
                element.querySelector(
                    "i, svg, span"
                );

            const classText =
                [
                    element.className,
                    icon?.className?.baseVal,
                    icon?.className
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

            const aria =
                String(
                    element.getAttribute(
                        "aria-label"
                    ) || ""
                ).toLowerCase();

            const title =
                String(
                    element.getAttribute(
                        "title"
                    ) || ""
                ).toLowerCase();

            if (
                classText.includes("bell") ||
                aria.includes("notification") ||
                aria.includes("bell") ||
                title.includes("notification") ||
                title.includes("bell")
            ) {
                return element;
            }
        }

        /*
         * Final fallback:
         * Locate an icon itself and climb to its clickable parent.
         */
        const icons =
            topbar.querySelectorAll(
                "i, svg, span"
            );

        for (const icon of icons) {
            const classText =
                String(
                    icon.className?.baseVal ||
                    icon.className ||
                    ""
                ).toLowerCase();

            if (
                classText.includes("bell")
            ) {
                return (
                    icon.closest(
                        "button,a,[role='button']"
                    ) ||
                    icon.parentElement
                );
            }
        }

        return null;
    }

    function ensureCss() {
        if (
            document.querySelector(
                'link[data-rukhnav-notification-v2]'
            )
        ) {
            return;
        }

        const link =
            document.createElement(
                "link"
            );

        link.rel =
            "stylesheet";

        link.href =
            "/admin/css/admin-notification-bell.css";

        link.dataset
            .rukhnavNotificationV2 =
            "true";

        document.head
            .appendChild(link);
    }

    function ensureBadge() {
        if (!state.button) {
            return;
        }

        state.badge =
            state.button.querySelector(
                [
                    ".notification-badge",
                    ".badge",
                    "[data-notification-count]"
                ].join(",")
            );

        if (!state.badge) {
            state.badge =
                document.createElement(
                    "span"
                );

            state.badge.className =
                "notification-badge";

            state.button
                .appendChild(
                    state.badge
                );
        }

        state.badge.classList
            .add(
                "admin-live-notification-badge"
            );

        /*
         * Remove any old hard-coded value immediately.
         */
        state.badge.textContent = "";
        state.badge.style.display = "none";
    }

    function ensurePanel() {
        const existing =
            document.getElementById(
                "adminNotificationPopover"
            );

        if (existing) {
            state.panel =
                existing;

            return;
        }

        const panel =
            document.createElement(
                "section"
            );

        panel.id =
            "adminNotificationPopover";

        panel.className =
            "admin-notification-popover";

        panel.innerHTML = `
            <header class="admin-notification-popover__header">
                <div>
                    <span>ERP ALERTS</span>
                    <h3>Notifications</h3>
                </div>

                <button
                    type="button"
                    class="admin-notification-mark-all"
                    data-notification-mark-all
                >
                    Mark all read
                </button>
            </header>

            <div
                class="admin-notification-list"
                data-notification-list
            >
                <div class="admin-notification-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <strong>Loading alerts...</strong>
                </div>
            </div>

            <footer class="admin-notification-popover__footer">
                <a href="/admin/notification-center.html">
                    <i class="fa-solid fa-bell"></i>
                    Open Notification Center
                </a>
            </footer>
        `;

        document.body
            .appendChild(panel);

        panel
            .querySelector(
                "[data-notification-mark-all]"
            )
            .addEventListener(
                "click",
                markAllRead
            );

        state.panel =
            panel;
    }

    function setBadge(count) {
        state.unreadCount =
            Number(count || 0);

        if (!state.badge) {
            return;
        }

        if (
            state.unreadCount < 1
        ) {
            state.badge.textContent = "";
            state.badge.style.display =
                "none";

            return;
        }

        state.badge.textContent =
            state.unreadCount > 99
                ? "99+"
                : String(
                    state.unreadCount
                );

        state.badge.style.display =
            "grid";
    }

    function formatTime(value) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        const diff =
            Math.max(
                1,
                Math.floor(
                    (
                        Date.now() -
                        date.getTime()
                    ) / 1000
                )
            );

        if (diff < 60) {
            return "Just now";
        }

        if (diff < 3600) {
            return `${
                Math.floor(diff / 60)
            }m ago`;
        }

        if (diff < 86400) {
            return `${
                Math.floor(diff / 3600)
            }h ago`;
        }

        return date
            .toLocaleDateString(
                "en-PK",
                {
                    day:
                        "2-digit",
                    month:
                        "short"
                }
            );
    }

    function renderNotifications() {
        const list =
            state.panel?.querySelector(
                "[data-notification-list]"
            );

        if (!list) {
            return;
        }

        if (
            !state.notifications.length
        ) {
            list.innerHTML = `
                <div class="admin-notification-empty">
                    <i class="fa-regular fa-circle-check"></i>
                    <strong>No notifications</strong>
                    <span>You're all caught up.</span>
                </div>
            `;

            return;
        }

        list.innerHTML =
            state.notifications
                .map(
                    item => `
                        <button
                            type="button"
                            class="
                                admin-notification-item
                                admin-notification-item--${escapeHtml(item.severity || "info")}
                                ${item.is_read ? "is-read" : "is-unread"}
                            "
                            data-id="${Number(item.id)}"
                            data-link="${escapeHtml(item.link_url || "")}"
                        >
                            <span class="admin-notification-item__icon">
                                <i class="fa-solid ${escapeHtml(item.icon || "fa-bell")}"></i>
                            </span>

                            <span class="admin-notification-item__content">
                                <strong>
                                    ${escapeHtml(item.title || "Notification")}
                                </strong>

                                <small>
                                    ${escapeHtml(item.message || "")}
                                </small>

                                <em>
                                    ${escapeHtml(formatTime(item.created_at))}
                                </em>
                            </span>

                            ${
                                item.is_read
                                    ? ""
                                    : '<span class="admin-notification-item__dot"></span>'
                            }
                        </button>
                    `
                )
                .join("");

        list
            .querySelectorAll(
                "[data-id]"
            )
            .forEach(
                item =>
                    item.addEventListener(
                        "click",
                        () =>
                            openNotification(
                                item
                            )
                    )
            );
    }

    async function loadNotifications(
        silent = false
    ) {
        try {
            const data =
                await api(
                    "/?limit=10"
                );

            state.notifications =
                Array.isArray(
                    data.notifications
                )
                    ? data.notifications
                    : [];

            setBadge(
                data.unreadCount
            );

            renderNotifications();
        } catch (error) {
            console.error(
                "Notification Bell V2:",
                error
            );

            /*
             * If the live API cannot be loaded, never leave the
             * old fake "3" visible.
             */
            setBadge(0);

            if (!silent) {
                const list =
                    state.panel?.querySelector(
                        "[data-notification-list]"
                    );

                if (list) {
                    list.innerHTML = `
                        <div class="admin-notification-error">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <strong>Unable to load notifications</strong>
                            <span>
                                ${escapeHtml(error.message)}
                            </span>
                        </div>
                    `;
                }
            }
        }
    }

    function positionPanel() {
        if (
            !state.button ||
            !state.panel
        ) {
            return;
        }

        const rect =
            state.button
                .getBoundingClientRect();

        const width =
            Math.min(
                410,
                window.innerWidth - 24
            );

        const left =
            Math.max(
                12,
                Math.min(
                    rect.right - width,
                    window.innerWidth -
                        width -
                        12
                )
            );

        state.panel.style.width =
            `${width}px`;

        state.panel.style.left =
            `${left}px`;

        state.panel.style.top =
            `${rect.bottom + 10}px`;
    }

    async function togglePanel(
        event
    ) {
        event.preventDefault();
        event.stopPropagation();

        state.open =
            !state.open;

        state.panel.classList
            .toggle(
                "is-open",
                state.open
            );

        if (state.open) {
            positionPanel();

            await loadNotifications(
                false
            );
        }
    }

    function closePanel() {
        state.open = false;

        state.panel?.classList
            .remove(
                "is-open"
            );
    }

    async function openNotification(
        element
    ) {
        const id =
            Number(
                element.dataset.id
            );

        const link =
            element.dataset.link;

        if (id) {
            try {
                await api(
                    `/${id}/read`,
                    {
                        method:
                            "PATCH"
                    }
                );
            } catch (error) {
                console.error(
                    error
                );
            }
        }

        if (link) {
            window.location.href =
                link;

            return;
        }

        await loadNotifications(
            true
        );
    }

    async function markAllRead(
        event
    ) {
        const button =
            event.currentTarget;

        button.disabled =
            true;

        try {
            await api(
                "/read-all",
                {
                    method:
                        "PATCH"
                }
            );

            state.notifications =
                state.notifications.map(
                    item => ({
                        ...item,
                        is_read:
                            true
                    })
                );

            setBadge(0);
            renderNotifications();
        } catch (error) {
            console.error(
                error
            );
        } finally {
            button.disabled =
                false;
        }
    }

    function bind() {
        const button =
            findBellButton();

        if (!button) {
            return false;
        }

        if (
            button.dataset
                .rukhnavNotificationBound ===
            "true"
        ) {
            state.button =
                button;

            return true;
        }

        state.button =
            button;

        ensureCss();
        ensureBadge();
        ensurePanel();

        state.button.dataset
            .rukhnavNotificationBound =
            "true";

        state.button.style.cursor =
            "pointer";

        state.button
            .addEventListener(
                "click",
                togglePanel
            );

        document
            .addEventListener(
                "click",
                event => {
                    if (
                        !state.open
                    ) {
                        return;
                    }

                    if (
                        state.panel?.contains(
                            event.target
                        ) ||
                        state.button?.contains(
                            event.target
                        )
                    ) {
                        return;
                    }

                    closePanel();
                }
            );

        window
            .addEventListener(
                "resize",
                () => {
                    if (
                        state.open
                    ) {
                        positionPanel();
                    }
                }
            );

        loadNotifications(true);

        clearInterval(
            state.refreshTimer
        );

        state.refreshTimer =
            setInterval(
                () =>
                    loadNotifications(
                        true
                    ),
                60000
            );

        console.info(
            "RUKHNAV live notification bell connected."
        );

        return true;
    }

    function start() {
        if (bind()) {
            return;
        }

        /*
         * Shared topbar is injected asynchronously.
         * Observe DOM until it exists.
         */
        const observer =
            new MutationObserver(
                () => {
                    if (bind()) {
                        observer.disconnect();
                    }
                }
            );

        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );

        /*
         * Retry too, because some admin pages replace topbar
         * after initial load.
         */
        let attempts = 0;

        const retry =
            setInterval(
                () => {
                    attempts += 1;

                    if (
                        bind() ||
                        attempts >= 40
                    ) {
                        clearInterval(
                            retry
                        );

                        if (
                            attempts >= 40 &&
                            !state.button
                        ) {
                            console.warn(
                                "RUKHNAV notification bell element was not found."
                            );
                        }
                    }
                },
                250
            );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            start
        );
    } else {
        start();
    }
})();
