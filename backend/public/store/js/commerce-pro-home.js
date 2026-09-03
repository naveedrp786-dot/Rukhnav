"use strict";

(() => {
    let homeSearchProducts =
        Array.isArray(
            window.RukhnavHomeProducts
        )
            ? window.RukhnavHomeProducts
            : [];

    let homeSearchCardsBound =
        false;

    function renderLiveHomeSearch() {
        const input =
            document.getElementById(
                "searchInput"
            );

        const category =
            document.getElementById(
                "searchCategory"
            );

        const panel =
            document.getElementById(
                "homeLiveSearch"
            );

        const results =
            document.getElementById(
                "homeLiveSearchResults"
            );

        const empty =
            document.getElementById(
                "homeLiveSearchEmpty"
            );

        const count =
            document.getElementById(
                "homeLiveSearchCount"
            );

        const title =
            document.getElementById(
                "homeLiveSearchTitle"
            );

        if (
            !input ||
            !panel ||
            !results ||
            !empty
        ) {
            return;
        }

        const query =
            input.value
                .trim()
                .toLowerCase();

        const selectedCategory =
            String(
                category?.value || ""
            )
                .trim()
                .toLowerCase();

        /*
         * Live results only appear after the customer starts
         * typing. Normal homepage remains unchanged otherwise.
         */
        if (!query) {
            panel.classList.add(
                "hidden"
            );

            results.innerHTML = "";

            empty.classList.add(
                "hidden"
            );

            if (count) {
                count.textContent = "";
            }

            return;
        }

        const matched =
            homeSearchProducts.filter(
                product => {
                    const productCategory =
                        String(
                            product.category ||
                            product.category_name ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    const categoryMatches =
                        !selectedCategory ||
                        productCategory ===
                            selectedCategory;

                    if (!categoryMatches) {
                        return false;
                    }

                    const haystack = [
                        product.product_name,
                        product.name,
                        product.category,
                        product.category_name,
                        product.brand,
                        product.description,
                        product.short_description,
                        product.sku
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return haystack.includes(
                        query
                    );
                }
            );

        panel.classList.remove(
            "hidden"
        );

        if (title) {
            title.textContent =
                `Results for “${input.value.trim()}”`;
        }

        if (count) {
            count.textContent =
                `${matched.length} ${
                    matched.length === 1
                        ? "product"
                        : "products"
                }`;
        }

        if (!matched.length) {
            results.innerHTML = "";

            empty.classList.remove(
                "hidden"
            );

            return;
        }

        empty.classList.add(
            "hidden"
        );

        /*
         * Keep the live area compact while typing.
         * Full search via Enter/magnifier still opens products.html.
         */
        results.innerHTML =
            matched
                .slice(0, 8)
                .map(
                    product =>
                        Store.card(
                            product
                        )
                )
                .join("");

        if (!homeSearchCardsBound) {
            Store.bindCards(
                results
            );

            homeSearchCardsBound =
                true;
        }
    }


    function bindLiveHomeSearch() {
        const input =
            document.getElementById(
                "searchInput"
            );

        const category =
            document.getElementById(
                "searchCategory"
            );

        if (
            !input ||
            input.dataset.liveSearchBound ===
                "1"
        ) {
            return;
        }

        input.dataset.liveSearchBound =
            "1";

        input.addEventListener(
            "input",
            renderLiveHomeSearch
        );

        category?.addEventListener(
            "change",
            renderLiveHomeSearch
        );

        renderLiveHomeSearch();
    }


    function moveHomepageSearch(
        attempt = 0
    ) {
        const search =
            document.getElementById(
                "globalSearch"
            );

        const mount =
            document.getElementById(
                "homeSearchMount"
            );

        /*
         * The shared header is rendered dynamically.
         * Commerce Pro can initialise before Components.header()
         * has created #globalSearch, so wait briefly for it.
         */
        if (!search || !mount) {
            if (attempt < 40) {
                window.setTimeout(
                    () =>
                        moveHomepageSearch(
                            attempt + 1
                        ),
                    50
                );
            }

            return;
        }

        /*
         * Moving the original form preserves its IDs and any
         * submit/input listeners already attached by store.js.
         */
        if (
            search.parentElement !==
            mount
        ) {
            mount.appendChild(search);
        }

        search.classList.add(
            "rk-home-search-form"
        );

        bindLiveHomeSearch();
    }


    function createUtilityStrip() {
        if (
            document.querySelector(
                ".rk-commerce-utility"
            )
        ) {
            return;
        }

        const showcase =
            document.getElementById(
                "productShowcase"
            );

        if (!showcase) {
            return;
        }

        const section =
            document.createElement(
                "section"
            );

        section.className =
            "rk-commerce-utility";

        section.setAttribute(
            "aria-label",
            "Shopping benefits"
        );

        section.innerHTML = `
            <div class="rk-commerce-utility-inner">

                <div class="rk-commerce-utility-item">
                    <span class="rk-commerce-utility-icon">
                        <i class="fa-solid fa-truck-fast"></i>
                    </span>

                    <span class="rk-commerce-utility-copy">
                        <strong>Free Delivery</strong>
                        <span>Qualifying orders</span>
                    </span>
                </div>

                <a
                    class="rk-commerce-utility-item"
                    href="returns.html"
                >
                    <span class="rk-commerce-utility-icon">
                        <i class="fa-solid fa-arrow-rotate-left"></i>
                    </span>

                    <span class="rk-commerce-utility-copy">
                        <strong>Easy Returns</strong>
                        <span>Customer support</span>
                    </span>
                </a>

                <div class="rk-commerce-utility-item">
                    <span class="rk-commerce-utility-icon">
                        <i class="fa-solid fa-shield-halved"></i>
                    </span>

                    <span class="rk-commerce-utility-copy">
                        <strong>Secure Pay</strong>
                        <span>Protected checkout</span>
                    </span>
                </div>

                <a
                    class="rk-commerce-utility-item"
                    href="rewards.html"
                >
                    <span class="rk-commerce-utility-icon">
                        <i class="fa-solid fa-star"></i>
                    </span>

                    <span class="rk-commerce-utility-copy">
                        <strong>Rewards</strong>
                        <span>Earn points</span>
                    </span>
                </a>

            </div>
        `;

        showcase.insertAdjacentElement(
            "afterend",
            section
        );
    }


    function createPromoCards() {
        if (
            document.querySelector(
                ".rk-commerce-promos"
            )
        ) {
            return;
        }

        const productSection =
            document.querySelector(
                ".home-products-section"
            );

        if (!productSection) {
            return;
        }

        const section =
            document.createElement(
                "section"
            );

        section.className =
            "rk-commerce-promos";

        section.setAttribute(
            "aria-label",
            "RUKHNAV shopping highlights"
        );

        section.innerHTML = `
            <a
                class="rk-commerce-promo"
                href="products.html"
            >
                <span class="rk-commerce-promo-icon">
                    <i class="fa-solid fa-percent"></i>
                </span>

                <span class="rk-commerce-promo-copy">
                    <span class="rk-commerce-promo-kicker">
                        SHOP & SAVE
                    </span>

                    <h3>RUKHNAV Offers</h3>

                    <p>
                        Discover selected products,
                        active savings and customer offers.
                    </p>
                </span>

                <i
                    class="fa-solid fa-chevron-right
                           rk-commerce-promo-arrow"
                ></i>
            </a>

            <a
                class="rk-commerce-promo"
                href="products.html?sort=newest"
            >
                <span class="rk-commerce-promo-icon">
                    <i class="fa-solid fa-plus"></i>
                </span>

                <span class="rk-commerce-promo-copy">
                    <span class="rk-commerce-promo-kicker">
                        JUST ADDED
                    </span>

                    <h3>New Arrivals</h3>

                    <p>
                        Explore the latest additions
                        to the RUKHNAV collection.
                    </p>
                </span>

                <i
                    class="fa-solid fa-chevron-right
                           rk-commerce-promo-arrow"
                ></i>
            </a>
        `;

        productSection.insertAdjacentElement(
            "beforebegin",
            section
        );
    }


    function markCommerceHome() {
        document.body.classList.add(
            "marketplace-home",
            "rk-home"
        );
    }


    window.addEventListener(
        "rukhnav:home-products-ready",
        event => {
            homeSearchProducts =
                Array.isArray(
                    event.detail?.products
                )
                    ? event.detail.products
                    : [];

            renderLiveHomeSearch();
        }
    );


    function init() {
        markCommerceHome();
        /*
         * Global commerce shell owns #globalSearch.
         * Keep it in the shared header on every page.
         */
        bindLiveHomeSearch();
        createUtilityStrip();
        createPromoCards();
    }


    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true,
            }
        );
    } else {
        init();
    }
})();
