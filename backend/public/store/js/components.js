"use strict";

window.Components = {

    e(value = "") {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    },

    header(settings) {

        const branding =
            settings.branding || {};

        const header =
            settings.header || {};

        const store =
            settings.store || {};

        const name =
            branding.brand_name ||
            "RUKHNAV";

        const tagline =
            branding.tagline ||
            "";

        const logo =
            branding.logo_url
                ? Theme.asset(
                    branding.logo_url
                )
                : "";

        const announcement =
            document.getElementById(
                "announcement"
            );

        if (announcement) {
            announcement.innerHTML =
                header.announcement_enabled === false
                    ? ""
                    : this.e(
                        header.announcement_text ||
                        "Free delivery on qualifying orders"
                    );
        }

        const target =
            document.getElementById(
                "header"
            );

        if (!target) {
            return;
        }

        target.innerHTML = `
<header class="store-header rk-global-header">

    <div class="rk-header-main">

        <button
            id="menuBtn"
            class="rk-header-menu"
            type="button"
            aria-label="Open menu"
        >
            <i class="fa-solid fa-bars"></i>
            <span>All</span>
        </button>

        <a
            class="brand rk-header-brand"
            href="index.html"
            aria-label="${this.e(name)} home"
        >
            ${
                logo
                    ? `
                        <img
                            src="${this.e(logo)}"
                            alt="${this.e(name)}"
                        >
                    `
                    : ""
            }

            <span class="brand-copy">
                <strong>
                    ${this.e(name)}
                </strong>

                ${
                    tagline
                        ? `
                            <small>
                                ${this.e(tagline)}
                            </small>
                        `
                        : ""
                }
            </span>
        </a>


        <a
            class="rk-delivery-location"
            href="contact.html"
        >
            <i class="fa-solid fa-location-dot"></i>

            <span>
                <small>
                    Deliver to
                </small>

                <strong>
                    Pakistan
                </strong>
            </span>
        </a>


        <form
            id="globalSearch"
            class="search rk-global-search"
        >
            <select
                id="searchCategory"
                aria-label="Product category"
            >
                <option value="">
                    All
                </option>

                <option>
                    Hair Care
                </option>

                <option>
                    Skin Care
                </option>

                <option>
                    Herbal
                </option>
            </select>

            <input
                id="searchInput"
                type="search"
                placeholder="${this.e(
                    header.search_placeholder ||
                    "Search RUKHNAV"
                )}"
                autocomplete="off"
            >

            <button
                type="submit"
                aria-label="Search"
            >
                <i class="fa-solid fa-magnifying-glass"></i>
            </button>
        </form>


        <nav
            class="actions rk-header-actions"
            aria-label="Customer actions"
        >

            <a
                class="action account-action"
                href="account.html"
            >
                <span
                    class="header-account-avatar"
                    aria-hidden="true"
                >
                    <img
                        id="headerAccountImage"
                        class="hidden"
                        src=""
                        alt=""
                    >

                    <span
                        id="headerAccountInitials"
                        class="header-account-initials hidden"
                    ></span>

                    <i
                        id="headerAccountIcon"
                        class="fa-regular fa-user"
                    ></i>
                </span>

                <span class="rk-action-copy">
                    <small>
                        Hello, sign in
                    </small>

                    <strong>
                        Account
                    </strong>
                </span>
            </a>


            <a
                class="action rk-orders-action"
                href="orders.html"
            >
                <span class="rk-action-copy">
                    <small>
                        Returns
                    </small>

                    <strong>
                        & Orders
                    </strong>
                </span>
            </a>


            ${
                store.wishlist_enabled === false
                    ? ""
                    : `
                        <a
                            class="action rk-icon-action"
                            href="wishlist.html"
                            aria-label="Wishlist"
                        >
                            <i class="fa-regular fa-heart"></i>

                            <span class="label">
                                Wishlist
                            </span>

                            <span
                                id="wishCount"
                                class="count"
                            >
                                0
                            </span>
                        </a>
                    `
            }


            <button
                id="customerNotificationBell"
                class="action notification-bell-action rk-icon-action"
                type="button"
                aria-label="Notifications"
                aria-expanded="false"
                hidden
            >
                <i class="fa-regular fa-bell"></i>

                <span class="label">
                    Updates
                </span>

                <span
                    id="customerNotificationCount"
                    class="count notification-count"
                    hidden
                >
                    0
                </span>
            </button>


            <a
                class="action rk-cart-action"
                href="cart.html"
                aria-label="Shopping cart"
            >
                <span class="rk-cart-icon">
                    <i class="fa-solid fa-cart-shopping"></i>

                    <span
                        id="cartCount"
                        class="count"
                    >
                        0
                    </span>
                </span>

                <strong>
                    Cart
                </strong>
            </a>

        </nav>

    </div>


    <nav
        class="categories-nav rk-commerce-nav"
        aria-label="Store navigation"
    >
        <div>

            <button
                class="rk-nav-all"
                type="button"
                onclick="document.getElementById('menuBtn')?.click()"
            >
                <i class="fa-solid fa-bars"></i>
                All
            </button>

            <a href="products.html">
                Products
            </a>

            <a href="products.html?sort=newest">
                New Arrivals
            </a>

            <a href="products.html?category=Hair%20Care">
                Hair Care
            </a>

            <a href="products.html?category=Skin%20Care">
                Skin Care
            </a>

            <a href="products.html?category=Herbal">
                Herbal
            </a>

            <a href="account.html#rewards">
                Rewards
            </a>

            <a href="returns.html">
                Returns
            </a>

            <a href="track-order.html">
                Track Order
            </a>

            <a href="contact.html">
                Help
            </a>

        </div>
    </nav>

</header>


<div
    id="customerNotificationLayer"
    class="customer-notification-layer rk-notification-popover-layer"
    hidden
>

    <button
        id="customerNotificationBackdrop"
        class="customer-notification-backdrop"
        type="button"
        aria-label="Close notifications"
    ></button>

    <aside
        id="customerNotificationDrawer"
        class="customer-notification-drawer rk-notification-popover"
        aria-label="Customer notifications"
    >

        <div class="customer-notification-head">

            <div>
                <span class="customer-notification-kicker">
                    RUKHNAV UPDATES
                </span>

                <h2>
                    Notifications
                </h2>

                <p id="customerNotificationSummary">
                    Your latest updates in one place.
                </p>
            </div>

            <button
                id="customerNotificationClose"
                class="customer-notification-close"
                type="button"
                aria-label="Close notifications"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>


        <div class="customer-notification-toolbar">

            <span id="customerNotificationUnreadLabel">
                All caught up
            </span>

            <button
                id="customerNotificationReadAll"
                type="button"
            >
                Mark all as read
            </button>

        </div>


        <div
            id="customerNotificationList"
            class="customer-notification-list"
        >
            <div class="customer-notification-loading">

                <i class="fa-solid fa-circle-notch fa-spin"></i>

                <span>
                    Loading updates...
                </span>

            </div>
        </div>


        <div class="customer-notification-footer">

            <a href="account.html">
                Open Customer Centre

                <i class="fa-solid fa-arrow-right"></i>
            </a>

        </div>

    </aside>

</div>


<div
    id="customerNotificationDetailLayer"
    class="customer-notification-detail-layer"
    hidden
>

    <button
        id="customerNotificationDetailBackdrop"
        class="customer-notification-detail-backdrop"
        type="button"
        aria-label="Close notification"
    ></button>

    <section
        class="customer-notification-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Notification details"
    >

        <button
            id="customerNotificationDetailClose"
            class="customer-notification-detail-close"
            type="button"
            aria-label="Close notification"
        >
            <i class="fa-solid fa-xmark"></i>
        </button>

        <div
            id="customerNotificationDetailContent"
            class="customer-notification-detail-content"
        ></div>

    </section>

</div>


<aside
    id="mobileMenu"
    class="mobile-menu"
>

    <div class="top">

        <strong>
            ${this.e(name)}
        </strong>

        <button
            id="closeMenu"
            type="button"
            aria-label="Close menu"
        >
            <i class="fa-solid fa-xmark"></i>
        </button>

    </div>


    <nav>

        <a href="index.html">
            Home
        </a>

        <a href="products.html">
            Shop All
        </a>

        <a href="products.html?sort=newest">
            New Arrivals
        </a>

        <a href="wishlist.html">
            Wishlist
        </a>

        <a href="cart.html">
            Cart
        </a>

        <a href="orders.html">
            My Orders
        </a>

        <a href="track-order.html">
            Track Order
        </a>

        <a href="returns.html">
            Returns & Refunds
        </a>

        <a href="account.html">
            Account
        </a>

        <a href="about.html">
            About RUKHNAV
        </a>

        <a href="contact.html">
            Contact
        </a>

    </nav>

</aside>
        `;
    },


    footer(settings) {

        const branding =
            settings.branding || {};

        const footer =
            settings.footer || {};

        const contact =
            settings.contact || {};

        const payments =
            settings.payments || {};

        const target =
            document.getElementById(
                "footer"
            );

        if (!target) {
            return;
        }

        const name =
            branding.brand_name ||
            "RUKHNAV";

        target.innerHTML = `

<footer class="store-footer rk-global-footer">

    <a
        class="rk-back-to-top"
        href="#"
        onclick="window.scrollTo({top:0,behavior:'smooth'});return false;"
    >
        Back to top
    </a>


    <div class="rk-footer-main">

        <div class="rk-footer-grid">

            <div class="footer-col">

                <h3>
                    Get to Know Us
                </h3>

                <a href="about.html">
                    About RUKHNAV
                </a>

                <a href="about.html">
                    Our Story
                </a>

                <a href="contact.html">
                    Contact Us
                </a>

                <a href="faq.html">
                    Frequently Asked Questions
                </a>

            </div>


            <div class="footer-col">

                <h3>
                    Shop & Earn
                </h3>

                <a href="products.html">
                    All Products
                </a>

                <a href="products.html?sort=newest">
                    New Arrivals
                </a>

                <a href="products.html?category=Hair%20Care">
                    Hair Care
                </a>

                <a href="products.html?category=Skin%20Care">
                    Skin Care
                </a>

                <a href="account.html#rewards">
                    Rewards
                </a>

            </div>


            <div class="footer-col">

                <h3>
                    Customer Care
                </h3>

                <a href="track-order.html">
                    Track Your Order
                </a>

                <a href="returns.html">
                    Returns & Refunds
                </a>

                <a href="shipping-policy.html">
                    Shipping Policy
                </a>

                <a href="refund-policy.html">
                    Return & Refund Policy
                </a>

                <a href="contact.html">
                    Help & Support
                </a>

            </div>


            <div class="footer-col">

                <h3>
                    Your Account
                </h3>

                <a href="account.html">
                    Your Account
                </a>

                <a href="orders.html">
                    Your Orders
                </a>

                <a href="wishlist.html">
                    Wishlist
                </a>

                <a href="account.html#rewards">
                    Rewards
                </a>

                <a href="returns.html">
                    Your Returns
                </a>

            </div>

        </div>

    </div>


    <div class="rk-footer-brandbar">

        <a
            href="index.html"
            class="rk-footer-logo"
        >
            ${this.e(name)}
        </a>

        <div class="rk-footer-settings">

            <span>
                <i class="fa-solid fa-globe"></i>
                English
            </span>

            <span>
                PKR · Pakistani Rupee
            </span>

            <span>
                <i class="fa-solid fa-location-dot"></i>
                Pakistan
            </span>

        </div>

    </div>


    <div class="rk-footer-bottom">

        <div class="rk-footer-bottom-links">

            <a href="terms.html">
                Conditions of Use
            </a>

            <a href="privacy-policy.html">
                Privacy Notice
            </a>

            <a href="refund-policy.html">
                Returns Policy
            </a>

        </div>


        <div class="rk-footer-payment">

            ${
                payments.cash_on_delivery_enabled === false
                    ? ""
                    : "<span>Cash on Delivery</span>"
            }

            ${
                payments.easypaisa_enabled
                    ? "<span>EasyPaisa</span>"
                    : ""
            }

            ${
                payments.jazzcash_enabled
                    ? "<span>JazzCash</span>"
                    : ""
            }

        </div>


        <p>
            ${this.e(
                footer.copyright_text ||
                "© RUKHNAV. All rights reserved."
            )}
        </p>


        ${
            contact.support_email
                ? `
                    <a
                        class="rk-footer-support"
                        href="mailto:${this.e(
                            contact.support_email
                        )}"
                    >
                        ${this.e(
                            contact.support_email
                        )}
                    </a>
                `
                : ""
        }

    </div>

</footer>
        `;
    }
};
