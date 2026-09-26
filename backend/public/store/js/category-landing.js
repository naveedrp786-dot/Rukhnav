(() => {
    "use strict";

    const CATEGORY_CONFIG = Object.freeze({

        "hair-care": Object.freeze({
            apiCategory: "Hair Care",
            label: "Hair Care",
            title: "Herbal Hair Care Products | RUKHNAV",
            description:
                "Shop RUKHNAV hair care products including herbal shampoo and herbal hair oil for gentle cleansing, nourishment and everyday hair care.",
            intro:
                "Explore RUKHNAV hair care products, including herbal shampoos and herbal hair oil for everyday cleansing, nourishment and regular hair care."
        }),

        "face-care": Object.freeze({
            apiCategory: "Face Care",
            label: "Face Care",
            title: "Herbal Face Care Products | RUKHNAV",
            description:
                "Shop RUKHNAV face care products including herbal neem face wash, charcoal face wash and whitening cream for everyday skin care.",
            intro:
                "Explore RUKHNAV face care products, including herbal neem face wash, charcoal face wash and whitening cream for everyday skin care."
        }),

        "fashion": Object.freeze({
            apiCategory: "Fashion",
            label: "Fashion",
            title: "Handmade Fashion & Crochet Products | RUKHNAV",
            description:
                "Shop handmade fashion products from RUKHNAV including crochet clothing, earrings, sequin dupattas, borders and colourful tassel designs.",
            intro:
                "Discover handmade RUKHNAV fashion pieces including crochet clothing, earrings, sequin dupattas, decorative borders and colourful tassel designs."
        }),

        "decoration": Object.freeze({
            apiCategory: "DECORATION",
            label: "Decoration",
            title: "Customised Event Decoration Products | RUKHNAV",
            description:
                "Shop customised event decoration products from RUKHNAV including handmade event signage, grazing items and personalised sweet pickers.",
            intro:
                "Explore customised RUKHNAV decoration products for celebrations and special occasions, including event signage, grazing items and personalised sweet pickers."
        })

    });


    function getCategorySlug() {

        const match =
            window.location.pathname.match(
                /^\/store\/category\/([^/?#]+)\/?$/
            );

        return match
            ? decodeURIComponent(match[1]).toLowerCase()
            : "";
    }


    function escapeHtml(value) {

        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function imageUrl(image) {

        if (!image) {
            return "";
        }

        if (/^https?:\/\//i.test(image)) {
            return image;
        }

        if (image.startsWith("/")) {
            return image;
        }

        return `/uploads/products/${encodeURIComponent(image)}`;
    }


    function productUrl(product) {

        if (!product || !product.slug) {
            return "/store/products.html";
        }

        return `/store/product/${encodeURIComponent(product.slug)}`;
    }


    function money(value) {

        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "";
        }

        return `Rs ${number.toLocaleString(
            "en-PK",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        )}`;
    }


    function productCard(product) {

        const name =
            escapeHtml(
                product.product_name ||
                "RUKHNAV Product"
            );

        const href =
            productUrl(product);

        const image =
            imageUrl(product.image);

        const price =
            money(product.selling_price);

        return `
            <article class="product-card">

                <a
                    class="product-image"
                    href="${href}"
                    aria-label="${name}"
                >
                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHtml(image)}"
                                    alt="${name}"
                                    loading="lazy"
                                    decoding="async"
                                >
                              `
                            : ""
                    }
                </a>

                <div class="product-body">

                    <h3 class="product-card-title product-name">
                        <a href="${href}">
                            ${name}
                        </a>
                    </h3>

                    ${
                        price
                            ? `
                                <p class="price">
                                    ${escapeHtml(price)}
                                </p>
                              `
                            : ""
                    }

                    <a
                        class="btn btn-primary"
                        href="${href}"
                    >
                        View Product
                    </a>

                </div>

            </article>
        `;
    }


    function setMeta(config, slug) {

        const canonical =
            `https://www.rukhnav.store/store/category/${slug}`;

        document.title =
            config.title;

        const description =
            document.querySelector(
                'meta[name="description"]'
            );

        if (description) {
            description.setAttribute(
                "content",
                config.description
            );
        }

        const canonicalNode =
            document.getElementById(
                "categoryCanonical"
            );

        if (canonicalNode) {
            canonicalNode.setAttribute(
                "href",
                canonical
            );
        }

        const values = {
            categoryOgTitle:
                config.title,

            categoryOgDescription:
                config.description,

            categoryOgUrl:
                canonical,

            categoryTwitterTitle:
                config.title,

            categoryTwitterDescription:
                config.description
        };

        Object.entries(values).forEach(
            ([id, value]) => {

                const node =
                    document.getElementById(id);

                if (node) {
                    node.setAttribute(
                        "content",
                        value
                    );
                }
            }
        );
    }


    function setVisibleContent(config) {

        document.getElementById(
            "categoryTitle"
        ).textContent =
            config.label;

        document.getElementById(
            "categoryIntro"
        ).textContent =
            config.intro;

        document.getElementById(
            "categoryBreadcrumbCurrent"
        ).textContent =
            config.label;

        document.getElementById(
            "categoryProductsHeading"
        ).textContent =
            `Shop ${config.label}`;
    }


    async function loadProducts(config) {

        const endpoint =
            `/api/products?page=1&limit=100&category=${
                encodeURIComponent(
                    config.apiCategory
                )
            }`;

        const response =
            await fetch(
                endpoint,
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const payload =
            await response.json();

        let products = [];

        if (Array.isArray(payload)) {
            products = payload;
        } else if (
            Array.isArray(payload.products)
        ) {
            products = payload.products;
        } else if (
            Array.isArray(payload.data)
        ) {
            products = payload.data;
        } else if (
            Array.isArray(payload.items)
        ) {
            products = payload.items;
        }

        return products.filter(
            product =>
                String(
                    product.category || ""
                )
                    .trim()
                    .toLowerCase()
                ===
                config.apiCategory
                    .toLowerCase()
        );
    }


    async function render() {

        const slug =
            getCategorySlug();

        const config =
            CATEGORY_CONFIG[slug];

        const loading =
            document.getElementById(
                "categoryLoading"
            );

        const error =
            document.getElementById(
                "categoryError"
            );

        const grid =
            document.getElementById(
                "categoryProducts"
            );

        if (!config) {

            document.title =
                "Category Not Found | RUKHNAV";

            loading.hidden = true;

            error.hidden = false;

            error.textContent =
                "This product category is not available.";

            return;
        }

        setMeta(
            config,
            slug
        );

        setVisibleContent(
            config
        );

        try {

            const products =
                await loadProducts(config);

            loading.hidden = true;

            if (!products.length) {
                throw new Error(
                    "No active category products found"
                );
            }

            grid.innerHTML =
                products
                    .map(productCard)
                    .join("");

        } catch (err) {

            console.error(
                "Category landing error:",
                err
            );

            loading.hidden = true;

            error.hidden = false;

            error.textContent =
                "We could not load this collection right now. Please view all products.";
        }
    }


    document.addEventListener(
        "DOMContentLoaded",
        render
    );

})();
