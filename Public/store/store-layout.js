"use strict";

/* ==========================================
   RUKHNAV Shared Store Layout
========================================== */

(function initializeStoreLayout() {
    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase() || "index.html";

    const headerTarget =
        document.getElementById(
            "shared-store-header"
        );

    const footerTarget =
        document.getElementById(
            "shared-store-footer"
        );

    if (headerTarget) {
        headerTarget.innerHTML =
            createStoreHeader(
                currentPage
            );
    }

    if (footerTarget) {
        footerTarget.innerHTML =
            createStoreFooter();
    }

    initializeStoreNavigation();
    initializeCurrentYear();
    initializeHeaderScrollEffect();
    loadSharedCartCount();
})();

/* ==========================================
   Header Template
========================================== */

function createStoreHeader(currentPage) {
    return `
        <div class="store-announcement-bar">
            <div class="container">
                <div class="announcement-content">
                    <p>
                        <i class="fa fa-leaf"></i>
                        Natural beauty and herbal care
                        by RUKHNAV
                    </p>

                    <div class="announcement-links">
                        <a href="contact.html">
                            <i class="fa fa-phone"></i>
                            Support
                        </a>

                        <span></span>

                        <a href="orders.html">
                            <i class="fa fa-truck"></i>
                            Track Order
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <header
            class="store-header"
            id="main-store-header"
        >
            <div class="container">
                <div class="navbar">

                    <a
                        href="index.html"
                        class="store-logo premium-store-logo"
                        aria-label="RUKHNAV home"
                    >
                        <img
                            src="logo.png"
                            alt="RUKHNAV"
                        >

                        <span class="store-logo-text">
                            <strong>RUKHNAV</strong>
                            <small>
                                Herbal Beauty & Care
                            </small>
                        </span>
                    </a>

                    <nav
                        class="nav"
                        id="store-navigation"
                        aria-label="Main navigation"
                    >
                        <ul>
                            ${createNavigationLink(
                                "index.html",
                                "Home",
                                currentPage
                            )}

                            ${createNavigationLink(
                                "products.html",
                                "Products",
                                currentPage
                            )}


                            ${createNavigationLink(
                                "about.html",
                                "Our Story",
                                currentPage
                            )}

                            ${createNavigationLink(
                                "contact.html",
                                "Contact",
                                currentPage
                            )}

                            ${createNavigationLink(
                                "account.html",
                                "My Account",
                                currentPage
                            )}
                        </ul>
                    </nav>

                    <div class="store-header-actions">

                        <a
                            href="products.html"
                            class="header-action"
                            aria-label="Search products"
                            title="Search products"
                        >
                            <i class="fa fa-search"></i>
                        </a>

                        <a
                            href="account.html"
                            class="header-action
                                ${isAccountPage(
                                    currentPage
                                )
                                    ? "active"
                                    : ""}"
                            aria-label="Customer account"
                            title="My account"
                        >
                            <i class="fa fa-user-o"></i>
                        </a>

                        <a
                            href="cart.html"
                            class="header-action
                                ${isCartPage(
                                    currentPage
                                )
                                    ? "active"
                                    : ""}"
                            aria-label="Shopping cart"
                            title="Shopping cart"
                        >
                            <i class="fa fa-shopping-bag"></i>

                            <span
                                class="cart-count"
                                id="header-cart-count"
                            >
                                0
                            </span>
                        </a>

                        <button
                            type="button"
                            class="store-menu-button"
                            id="store-menu-button"
                            aria-label="Open navigation"
                            aria-expanded="false"
                        >
                            <i class="fa fa-bars"></i>
                        </button>

                    </div>
                </div>
            </div>
        </header>
    `;
}

/* ==========================================
   Navigation Link
========================================== */

function createNavigationLink(
    href,
    label,
    currentPage
) {
    const isActive =
        currentPage === href;

    return `
        <li>
            <a
                href="${href}"
                class="${isActive ? "active" : ""}"
            >
                ${label}
            </a>
        </li>
    `;
}

function isCartPage(currentPage) {
    return [
        "cart.html",
        "checkout.html",
        "order-success.html"
    ].includes(currentPage);
}

function isAccountPage(currentPage) {
    return [
        "account.html",
        "orders.html",
        "loyalty.html",
        "events.html",
        "reviews.html"
    ].includes(currentPage);
}

/* ==========================================
   Footer Template
========================================== */

function createStoreFooter() {
    return `
        <footer class="store-footer rk-footer">
            <div class="container">
                <div class="rk-footer-main">
                    <section class="rk-footer-brand">
                        <a href="index.html" class="rk-footer-logo" aria-label="RUKHNAV home">
                            <img src="logo.png" alt="RUKHNAV">
                            <span>
                                <strong>RUKHNAV</strong>
                                <small>Herbal Beauty & Care</small>
                            </span>
                        </a>

                        <p>
                            Herbal-inspired hair care, skin care and beauty essentials
                            thoughtfully created for everyday confidence.
                        </p>

                        <div class="rk-footer-socials">
                            <a href="#" aria-label="Facebook"><i class="fa fa-facebook"></i></a>
                            <a href="#" aria-label="Instagram"><i class="fa fa-instagram"></i></a>
                            <a href="#" aria-label="WhatsApp"><i class="fa fa-whatsapp"></i></a>
                            <a href="#" aria-label="YouTube"><i class="fa fa-youtube-play"></i></a>
                        </div>
                    </section>

                    <section class="rk-footer-links">
                        <h3>Shop</h3>
                        <a href="products.html">All Products</a>
                        <a href="products.html">Hair Care</a>
                        <a href="products.html">Skin Care</a>
                        <a href="cart.html">Shopping Cart</a>
                    </section>

                    <section class="rk-footer-links">
                        <h3>Support</h3>
                        <a href="account.html">My Account</a>
                        <a href="orders.html">My Orders</a>
                        <a href="contact.html">Contact Us</a>
                        <a href="events.html">Special Events</a>
                        <a href="reviews.html">Customer Stories</a>
                        <a href="about.html">About RUKHNAV</a>
                    </section>

                    <section class="rk-footer-contact">
                        <h3>Shopping with RUKHNAV</h3>

                        <p>
                            <i class="fa fa-map-marker"></i>
                            <span>Delivery available across Pakistan</span>
                        </p>

                        <p>
                            <i class="fa fa-shield"></i>
                            <span>Secure account and protected checkout</span>
                        </p>

                        <div class="rk-footer-payments">
                            <span><i class="fa fa-money"></i> COD</span>
                            <span>Easypaisa</span>
                            <span>JazzCash</span>
                            <span><i class="fa fa-bank"></i></span>
                        </div>
                    </section>
                </div>

                <div class="rk-footer-bottom">
                    <p>
                        &copy; <span id="current-year"></span> RUKHNAV.
                        All rights reserved.
                    </p>

                    <div>
                        <span><i class="fa fa-lock"></i> Secure Shopping</span>
                        <span><i class="fa fa-database"></i> ERP Powered</span>
                    </div>
                </div>
            </div>
        </footer>
    `;
}

/* ==========================================
   Mobile Navigation
========================================== */

function initializeStoreNavigation() {
    const menuButton =
        document.getElementById(
            "store-menu-button"
        );

    const navigation =
        document.getElementById(
            "store-navigation"
        );

    if (!menuButton || !navigation) {
        return;
    }

    menuButton.addEventListener(
        "click",
        () => {
            const isOpen =
                navigation.classList.toggle(
                    "open"
                );

            menuButton.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            const icon =
                menuButton.querySelector("i");

            if (icon) {
                icon.className =
                    isOpen
                        ? "fa fa-times"
                        : "fa fa-bars";
            }
        }
    );

    navigation
        .querySelectorAll("a")
        .forEach(link => {
            link.addEventListener(
                "click",
                () => {
                    navigation.classList.remove(
                        "open"
                    );

                    menuButton.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                    const icon =
                        menuButton.querySelector(
                            "i"
                        );

                    if (icon) {
                        icon.className =
                            "fa fa-bars";
                    }
                }
            );
        });

    document.addEventListener(
        "click",
        event => {
            if (
                !navigation.contains(
                    event.target
                ) &&
                !menuButton.contains(
                    event.target
                )
            ) {
                navigation.classList.remove(
                    "open"
                );

                menuButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                const icon =
                    menuButton.querySelector(
                        "i"
                    );

                if (icon) {
                    icon.className =
                        "fa fa-bars";
                }
            }
        }
    );
}

/* ==========================================
   Header Scroll Effect
========================================== */

function initializeHeaderScrollEffect() {
    const header =
        document.getElementById(
            "main-store-header"
        );

    if (!header) {
        return;
    }

    const updateHeader = () => {
        header.classList.toggle(
            "scrolled",
            window.scrollY > 20
        );
    };

    updateHeader();

    window.addEventListener(
        "scroll",
        updateHeader,
        {
            passive: true
        }
    );
}

/* ==========================================
   Footer Year
========================================== */

function initializeCurrentYear() {
    const yearElement =
        document.getElementById(
            "current-year"
        );

    if (yearElement) {
        yearElement.textContent =
            new Date().getFullYear();
    }
}

/* ==========================================
   Shared Cart Count
========================================== */

async function loadSharedCartCount() {
    const countElements = document.querySelectorAll(
        "#header-cart-count, [data-cart-count]"
    );

    const updateCount = count => {
        countElements.forEach(element => {
            element.textContent = String(count);
            element.hidden = count <= 0;
        });
    };

    /*
     * Guests do not have access to the protected cart API.
     * Show an empty cart without making the request.
     */
    if (
        !window.RukhnavAPI ||
        typeof RukhnavAPI.isLoggedIn !== "function" ||
        !RukhnavAPI.isLoggedIn()
    ) {
        updateCount(0);
        return;
    }

    try {
        const result = await RukhnavAPI.getCart();

        const count = Number(
            result?.itemCount ??
            result?.item_count ??
            result?.cart?.reduce(
                (total, item) =>
                    total + Number(item.quantity || 0),
                0
            ) ??
            0
        );

        updateCount(count);

    } catch (error) {
        /*
         * An expired or invalid token should behave like
         * a guest cart instead of filling the console.
         */
        const message = String(error?.message || "").toLowerCase();

        if (
            message.includes("token") ||
            message.includes("access denied") ||
            message.includes("unauthorized")
        ) {
            updateCount(0);
            return;
        }

        console.error(
            "Unable to load shared cart count:",
            error
        );

        updateCount(0);
    }
}