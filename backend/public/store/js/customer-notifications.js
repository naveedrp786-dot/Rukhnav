"use strict";

(() => {
    const state = {
        loaded: false,
        loading: false,
        notifications: [],
        unreadCount: 0
    };

    function escapeHtml(value = "") {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function elements() {
        return {
            bell:
                document.getElementById(
                    "customerNotificationBell"
                ),
            badge:
                document.getElementById(
                    "customerNotificationCount"
                ),
            layer:
                document.getElementById(
                    "customerNotificationLayer"
                ),
            drawer:
                document.getElementById(
                    "customerNotificationDrawer"
                ),
            backdrop:
                document.getElementById(
                    "customerNotificationBackdrop"
                ),
            close:
                document.getElementById(
                    "customerNotificationClose"
                ),
            list:
                document.getElementById(
                    "customerNotificationList"
                ),
            summary:
                document.getElementById(
                    "customerNotificationSummary"
                ),
            unreadLabel:
                document.getElementById(
                    "customerNotificationUnreadLabel"
                ),
            readAll:
                document.getElementById(
                    "customerNotificationReadAll"
                )
        };
    }

    function authenticated() {
        return Boolean(
            window.API &&
            typeof API.isAuthenticated === "function" &&
            API.isAuthenticated()
        );
    }

    function iconClass(notification) {
        const type =
            String(
                notification.notification_type ||
                ""
            ).toLowerCase();

        if (type === "order") {
            return "fa-solid fa-box";
        }

        if (type === "sale" ||
            type === "promotion") {
            return "fa-solid fa-tags";
        }

        if (type === "new product") {
            return "fa-solid fa-sparkles";
        }

        if (type === "reward" ||
            type === "loyalty") {
            return "fa-solid fa-gift";
        }

        if (type === "review") {
            return "fa-solid fa-star";
        }

        if (type === "refund" ||
            type === "return") {
            return "fa-solid fa-rotate-left";
        }

        if (type === "event") {
            return "fa-solid fa-calendar-days";
        }

        return "fa-regular fa-bell";
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        const now = new Date();
        const diff =
            Math.max(
                0,
                now.getTime() - date.getTime()
            );

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diff < minute) {
            return "Just now";
        }

        if (diff < hour) {
            return `${Math.floor(diff / minute)}m ago`;
        }

        if (diff < day) {
            return `${Math.floor(diff / hour)}h ago`;
        }

        if (diff < 7 * day) {
            return `${Math.floor(diff / day)}d ago`;
        }

        return date.toLocaleDateString(
            undefined,
            {
                day: "numeric",
                month: "short"
            }
        );
    }

    function updateBadge() {
        const {
            badge,
            unreadLabel,
            readAll
        } = elements();

        if (badge) {
            if (state.unreadCount > 0) {
                badge.textContent =
                    state.unreadCount > 99
                        ? "99+"
                        : String(state.unreadCount);

                badge.hidden = false;
            } else {
                badge.textContent = "0";
                badge.hidden = true;
            }
        }

        if (unreadLabel) {
            unreadLabel.textContent =
                state.unreadCount > 0
                    ? `${state.unreadCount} unread`
                    : "All caught up";
        }

        if (readAll) {
            readAll.disabled =
                state.unreadCount === 0;
        }
    }

    function render() {
        const {
            list,
            summary
        } = elements();

        if (!list) {
            return;
        }

        updateBadge();

        if (summary) {
            summary.textContent =
                state.notifications.length
                    ? "Orders, rewards and store news."
                    : "Your latest updates in one place.";
        }

        if (!state.notifications.length) {
            list.innerHTML = `
                <div class="customer-notification-empty">
                    <span class="customer-notification-empty-icon">
                        <i class="fa-regular fa-bell"></i>
                    </span>
                    <strong>You're all caught up</strong>
                    <p>
                        Order updates, rewards and RUKHNAV
                        announcements will appear here.
                    </p>
                </div>
            `;
            return;
        }

        list.innerHTML =
            state.notifications.map(notification => {
                const unread =
                    !Number(notification.is_read);

                const action =
                    notification.action_url
                        ? `
                            <a
                                class="customer-notification-link"
                                href="${escapeHtml(
                                    notification.action_url
                                )}"
                                data-notification-id="${Number(
                                    notification.id
                                )}"
                            >
                                ${escapeHtml(
                                    notification.action_label ||
                                    "View details"
                                )}
                                <i class="fa-solid fa-arrow-right"></i>
                            </a>
                        `
                        : "";

                return `
                    <article
                        class="customer-notification-item ${
                            unread ? "is-unread" : ""
                        }"
                        data-notification-id="${Number(
                            notification.id
                        )}"
                    >
                        <button
                            class="customer-notification-item-main"
                            type="button"
                            data-notification-read="${Number(
                                notification.id
                            )}"
                        >
                            <span class="customer-notification-icon">
                                <i class="${
                                    iconClass(notification)
                                }"></i>
                            </span>

                            <span class="customer-notification-copy">
                                <span class="customer-notification-meta">
                                    <span>
                                        ${escapeHtml(
                                            notification.notification_type ||
                                            "Update"
                                        )}
                                    </span>
                                    <time>
                                        ${escapeHtml(
                                            formatDate(
                                                notification.created_at
                                            )
                                        )}
                                    </time>
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        notification.title
                                    )}
                                </strong>

                                <span class="customer-notification-message">
                                    ${escapeHtml(
                                        notification.message
                                    )}
                                </span>
                            </span>

                            ${
                                unread
                                    ? '<span class="customer-notification-dot" aria-label="Unread"></span>'
                                    : ""
                            }
                        </button>

                        ${action}
                    </article>
                `;
            }).join("");
    }

    async function loadNotifications({
        silent = false
    } = {}) {
        if (!authenticated() ||
            state.loading) {
            return;
        }

        state.loading = true;

        const { list } = elements();

        if (!silent &&
            list &&
            !state.loaded) {
            list.innerHTML = `
                <div class="customer-notification-loading">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Loading updates...</span>
                </div>
            `;
        }

        try {
            const data =
                await API.get(
                    API.customer(
                        "/notifications?limit=40"
                    )
                );

            state.notifications =
                Array.isArray(data.notifications)
                    ? data.notifications
                    : [];

            state.unreadCount =
                Number(data.unreadCount || 0);

            state.loaded = true;

            render();

        } catch (error) {
            console.error(
                "Customer notifications:",
                error
            );

            if (list) {
                list.innerHTML = `
                    <div class="customer-notification-empty">
                        <span class="customer-notification-empty-icon">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </span>
                        <strong>Updates unavailable</strong>
                        <p>
                            We couldn't load your notifications.
                            Please try again.
                        </p>
                        <button
                            id="customerNotificationRetry"
                            type="button"
                        >
                            Try again
                        </button>
                    </div>
                `;

                document
                    .getElementById(
                        "customerNotificationRetry"
                    )
                    ?.addEventListener(
                        "click",
                        () => loadNotifications()
                    );
            }
        } finally {
            state.loading = false;
        }
    }

    async function loadUnreadCount() {
        if (!authenticated()) {
            return;
        }

        try {
            const data =
                await API.get(
                    API.customer(
                        "/notifications/unread-count"
                    )
                );

            state.unreadCount =
                Number(data.unreadCount || 0);

            updateBadge();

        } catch (error) {
            console.error(
                "Customer notification count:",
                error
            );
        }
    }

    function openDrawer() {
        const {
            bell,
            layer
        } = elements();

        if (!layer) {
            return;
        }

        layer.hidden = false;

        requestAnimationFrame(() => {
            layer.classList.add("is-open");
        });

        bell?.setAttribute(
            "aria-expanded",
            "true"
        );

        document.documentElement
            .classList.add(
                "customer-notifications-open"
            );

        loadNotifications();
    }

    function closeDrawer() {
        const {
            bell,
            layer
        } = elements();

        if (!layer) {
            return;
        }

        layer.classList.remove("is-open");

        bell?.setAttribute(
            "aria-expanded",
            "false"
        );

        document.documentElement
            .classList.remove(
                "customer-notifications-open"
            );

        window.setTimeout(() => {
            if (!layer.classList.contains("is-open")) {
                layer.hidden = true;
            }
        }, 240);
    }

    async function markRead(id) {
        const numericId = Number(id);

        if (!numericId) {
            return;
        }

        const current =
            state.notifications.find(
                item =>
                    Number(item.id) === numericId
            );

        if (!current ||
            Number(current.is_read)) {
            return;
        }

        try {
            const data =
                await API.patch(
                    API.customer(
                        `/notifications/${numericId}/read`
                    )
                );

            current.is_read = 1;
            current.read_at =
                new Date().toISOString();

            state.unreadCount =
                Number(data.unreadCount || 0);

            render();

        } catch (error) {
            console.error(
                "Mark notification read:",
                error
            );
        }
    }

    async function markAllRead() {
        if (!state.unreadCount) {
            return;
        }

        try {
            const data =
                await API.patch(
                    API.customer(
                        "/notifications/read-all"
                    )
                );

            state.notifications =
                state.notifications.map(
                    item => ({
                        ...item,
                        is_read: 1,
                        read_at:
                            item.read_at ||
                            new Date().toISOString()
                    })
                );

            state.unreadCount =
                Number(data.unreadCount || 0);

            render();

        } catch (error) {
            console.error(
                "Mark all notifications read:",
                error
            );
        }
    }

    function bind() {
        const {
            bell,
            backdrop,
            close,
            list,
            readAll
        } = elements();

        if (!bell) {
            return false;
        }

        if (!authenticated()) {
            bell.hidden = true;
            return true;
        }

        bell.hidden = false;

        bell.addEventListener(
            "click",
            openDrawer
        );

        backdrop?.addEventListener(
            "click",
            closeDrawer
        );

        close?.addEventListener(
            "click",
            closeDrawer
        );

        readAll?.addEventListener(
            "click",
            markAllRead
        );

        list?.addEventListener(
            "click",
            event => {
                const readButton =
                    event.target.closest(
                        "[data-notification-read]"
                    );

                if (readButton) {
                    markRead(
                        readButton.dataset
                            .notificationRead
                    );
                    return;
                }

                const link =
                    event.target.closest(
                        "[data-notification-id]"
                    );

                if (link) {
                    markRead(
                        link.dataset
                            .notificationId
                    );
                }
            }
        );

        document.addEventListener(
            "keydown",
            event => {
                if (event.key === "Escape") {
                    closeDrawer();
                }
            }
        );

        loadUnreadCount();

        return true;
    }

    function start() {
        let attempts = 0;

        const tryBind = () => {
            attempts += 1;

            if (bind()) {
                return;
            }

            if (attempts < 40) {
                window.setTimeout(
                    tryBind,
                    100
                );
            }
        };

        tryBind();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            start
        );
    } else {
        start();
    }

    window.CustomerNotifications = {
        refresh: loadNotifications,
        refreshCount: loadUnreadCount,
        open: openDrawer,
        close: closeDrawer
    };
})();
