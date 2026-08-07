"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =========================================
// RUKHNAV Customer Portal Layout
// =========================================

window.CustomerPortal = {
    apiBase:
        RUKHNAV_ORIGIN + "/api",

    token: "",

    loyalty: null,

    customer: null,

    async init() {
        this.token =
            this.getToken();

        if (!this.token) {
            this.redirectToLogin();
            return;
        }

        this.injectLayout();
        this.setActiveNavigation();
        this.bindLayoutEvents();

        try {
            await this.loadCustomerLoyalty();
            this.updateCustomerDetails();
            this.updateEventAccess();
        } catch (error) {
            this.toast(
                error.message,
                "error"
            );
        }

        document.dispatchEvent(
            new CustomEvent(
                "customerPortalReady",
                {
                    detail: {
                        customer:
                            this.customer,
                        loyalty:
                            this.loyalty
                    }
                }
            )
        );
    },

    // =====================================
    // Authentication
    // =====================================

    getToken() {
        return (
            localStorage.getItem(
                "customerToken"
            ) ||
            sessionStorage.getItem(
                "customerToken"
            ) ||
            ""
        );
    },

    clearSession() {
        localStorage.removeItem(
            "customerToken"
        );

        localStorage.removeItem(
            "customerAccount"
        );

        sessionStorage.removeItem(
            "customerToken"
        );

        sessionStorage.removeItem(
            "customerAccount"
        );
    },

    redirectToLogin() {
        const currentPage =
            window.location.pathname
                .split("/")
                .pop() ||
            "dashboard.html";

        window.location.replace(
            `login.html?redirect=${encodeURIComponent(
                currentPage
            )}`
        );
    },

    logout() {
        this.clearSession();

        window.location.replace(
            "login.html"
        );
    },

    // =====================================
    // API Helper
    // =====================================

    async request(
        path,
        options = {}
    ) {
        const headers = {
            Accept:
                "application/json",
            ...(options.headers || {})
        };

        if (options.body) {
            headers[
                "Content-Type"
            ] = "application/json";
        }

        headers.Authorization =
            this.token.startsWith(
                "Bearer "
            )
                ? this.token
                : `Bearer ${this.token}`;

        const url =
            path.startsWith("http")
                ? path
                : `${this.apiBase}${path}`;

        const response =
            await fetch(url, {
                ...options,
                headers
            });

        let data = {};

        try {
            data =
                await response.json();
        } catch (error) {
            data = {};
        }

        if (response.status === 401) {
            this.clearSession();
            this.redirectToLogin();

            throw new Error(
                "Your session has expired."
            );
        }

        if (!response.ok) {
            const error =
                new Error(
                    data.message ||
                    "Unable to complete the request."
                );

            error.status =
                response.status;

            error.code =
                data.code || null;

            error.data =
                data;

            throw error;
        }

        return data;
    },

    // =====================================
    // Loyalty Data
    // =====================================

    async loadCustomerLoyalty() {
        const data =
            await this.request(
                "/customer-loyalty/me"
            );

        this.loyalty =
            data.loyalty || null;

        this.customer =
            this.loyalty
                ? {
                    id:
                        this.loyalty
                            .customerId,

                    fullName:
                        this.loyalty
                            .fullName
                }
                : null;

        return this.loyalty;
    },

    // =====================================
    // Inject Sidebar and Topbar
    // =====================================

    injectLayout() {
        const sidebarHost =
            document.getElementById(
                "customerSidebarContainer"
            );

        if (sidebarHost) {
            sidebarHost.innerHTML = `
                <aside
                    class="customer-sidebar"
                    id="customerSidebar"
                >

                    <div class="customer-sidebar-brand">

                        <a
                            href="dashboard.html"
                            class="customer-brand"
                        >

                            <span class="customer-brand-mark">
                                R
                            </span>

                            <span class="customer-brand-name">

                                <strong>
                                    RUKHNAV
                                </strong>

                                <small>
                                    Customer Portal
                                </small>

                            </span>

                        </a>

                    </div>

                    <nav class="customer-sidebar-nav">

                        <div class="customer-nav-section">
                            My Account
                        </div>

                        <a
                            href="dashboard.html"
                            class="customer-nav-link"
                            data-customer-page="dashboard.html"
                        >
                            <i class="fa-solid fa-house"></i>
                            <span>Dashboard</span>
                        </a>

                        <a
                            href="loyalty.html"
                            class="customer-nav-link"
                            data-customer-page="loyalty.html"
                        >
                            <i class="fa-solid fa-medal"></i>
                            <span>Loyalty & Rewards</span>
                        </a>

                        <a
                            href="events.html"
                            class="customer-nav-link"
                            data-customer-page="events.html"
                            id="customerEventsLink"
                        >
                            <i class="fa-solid fa-calendar-star"></i>
                            <span>Special Events</span>

                            <small
                                class="customer-nav-badge"
                                id="eventAccessBadge"
                            >
                                Checking
                            </small>
                        </a>

                        <div class="customer-nav-section">
                            Personal Settings
                        </div>

                        <a
                            href="profile.html"
                            class="customer-nav-link"
                            data-customer-page="profile.html"
                        >
                            <i class="fa-solid fa-user"></i>
                            <span>My Profile</span>
                        </a>

                        <a
                            href="security.html"
                            class="customer-nav-link"
                            data-customer-page="security.html"
                        >
                            <i class="fa-solid fa-shield-halved"></i>
                            <span>Security</span>
                        </a>

                        <a
                            href="../index.html"
                            class="customer-nav-link"
                        >
                            <i class="fa-solid fa-store"></i>
                            <span>Return to Store</span>
                        </a>

                        <div class="customer-nav-section">
                            Session
                        </div>

                        <button
                            type="button"
                            id="customerLogoutButton"
                            class="customer-nav-link customer-logout-button"
                        >
                            <i class="fa-solid fa-right-from-bracket"></i>
                            <span>Sign Out</span>
                        </button>

                    </nav>

                </aside>

                <div
                    id="customerSidebarOverlay"
                    class="customer-sidebar-overlay"
                ></div>
            `;
        }

        const topbarHost =
            document.getElementById(
                "customerTopbarContainer"
            );

        if (topbarHost) {
            topbarHost.innerHTML = `
                <header class="customer-topbar">

                    <div class="customer-topbar-left">

                        <button
                            type="button"
                            id="customerMenuButton"
                            class="customer-menu-button"
                            aria-label="Open customer menu"
                        >
                            <i class="fa-solid fa-bars"></i>
                        </button>

                        <div>

                            <small>
                                RUKHNAV Customer Account
                            </small>

                            <strong id="customerGreeting">
                                Welcome
                            </strong>

                        </div>

                    </div>

                    <div class="customer-topbar-profile">

                        <div>

                            <strong id="customerTopbarName">
                                Customer
                            </strong>

                            <span id="customerTopbarCategory">
                                Bronze Member
                            </span>

                        </div>

                        <div
                            id="customerTopbarAvatar"
                            class="customer-topbar-avatar"
                        >
                            C
                        </div>

                    </div>

                </header>
            `;
        }
    },

    // =====================================
    // Active Navigation
    // =====================================

    setActiveNavigation() {
        const currentPage =
            window.location.pathname
                .split("/")
                .pop() ||
            "dashboard.html";

        document
            .querySelectorAll(
                "[data-customer-page]"
            )
            .forEach((link) => {
                link.classList.toggle(
                    "active",
                    link.dataset
                        .customerPage ===
                        currentPage
                );
            });
    },

    // =====================================
    // Update Customer Details
    // =====================================

    updateCustomerDetails() {
        const fullName =
            this.customer
                ?.fullName ||
            "Customer";

        const category =
            this.loyalty
                ?.membershipLevel ||
            "Bronze";

        const firstName =
            fullName
                .trim()
                .split(/\s+/)[0] ||
            "Customer";

        this.setText(
            "customerGreeting",
            `Welcome, ${firstName}`
        );

        this.setText(
            "customerTopbarName",
            fullName
        );

        this.setText(
            "customerTopbarCategory",
            `${category} Member`
        );

        this.setText(
            "customerTopbarAvatar",
            this.getInitials(
                fullName
            )
        );
    },

    updateEventAccess() {
        const eventLink =
            document.getElementById(
                "customerEventsLink"
            );

        const badge =
            document.getElementById(
                "eventAccessBadge"
            );

        const enabled =
            Boolean(
                this.loyalty
                    ?.benefits
                    ?.eventMenuEnabled
            );

        if (eventLink) {
            eventLink.classList.toggle(
                "locked",
                !enabled
            );

            eventLink.dataset.locked =
                enabled
                    ? "false"
                    : "true";
        }

        if (badge) {
            badge.textContent =
                enabled
                    ? "Unlocked"
                    : "Gold";
        }
    },

    // =====================================
    // Layout Events
    // =====================================

    bindLayoutEvents() {
        document.addEventListener(
            "click",
            (event) => {
                if (
                    event.target.closest(
                        "#customerLogoutButton"
                    )
                ) {
                    this.logout();
                    return;
                }

                if (
                    event.target.closest(
                        "#customerMenuButton"
                    )
                ) {
                    this.toggleSidebar(
                        true
                    );

                    return;
                }

                if (
                    event.target.closest(
                        "#customerSidebarOverlay"
                    )
                ) {
                    this.toggleSidebar(
                        false
                    );

                    return;
                }

                const eventLink =
                    event.target.closest(
                        "#customerEventsLink"
                    );

                if (
                    eventLink &&
                    eventLink.dataset
                        .locked ===
                        "true"
                ) {
                    event.preventDefault();

                    const pointsNeeded =
                        Number(
                            this.loyalty
                                ?.nextCategory
                                ?.pointsNeeded ||
                            0
                        );

                    this.toast(
                        pointsNeeded > 0
                            ? `Earn ${pointsNeeded.toLocaleString()} more lifetime points to unlock special events.`
                            : "Reach Gold membership to unlock special events.",
                        "info"
                    );
                }
            }
        );
    },

    toggleSidebar(open) {
        document
            .getElementById(
                "customerSidebar"
            )
            ?.classList.toggle(
                "open",
                open
            );

        document
            .getElementById(
                "customerSidebarOverlay"
            )
            ?.classList.toggle(
                "show",
                open
            );
    },

    // =====================================
    // Toast
    // =====================================

    toast(
        message,
        type = "success"
    ) {
        let container =
            document.getElementById(
                "customerToastContainer"
            );

        if (!container) {
            container =
                document.createElement(
                    "div"
                );

            container.id =
                "customerToastContainer";

            container.className =
                "customer-toast-container";

            document.body.appendChild(
                container
            );
        }

        const toast =
            document.createElement(
                "div"
            );

        toast.className =
            `customer-toast ${type}`;

        const icon =
            type === "success"
                ? "fa-circle-check"
                : type === "info"
                    ? "fa-circle-info"
                    : "fa-circle-exclamation";

        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <div>
                ${this.escapeHtml(
                    message
                )}
            </div>
        `;

        container.appendChild(
            toast
        );

        setTimeout(() => {
            toast.remove();
        }, 4500);
    },

    // =====================================
    // General Helpers
    // =====================================

    setText(id, value) {
        const element =
            document.getElementById(
                id
            );

        if (element) {
            element.textContent =
                String(value ?? "");
        }
    },

    getInitials(name) {
        return String(
            name || "C"
        )
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(
                (word) =>
                    word
                        .charAt(0)
                        .toUpperCase()
            )
            .join("") || "C";
    },

    escapeHtml(value) {
        const element =
            document.createElement(
                "div"
            );

        element.textContent =
            String(value ?? "");

        return element.innerHTML;
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => {
        window.CustomerPortal
            .init();
    }
);