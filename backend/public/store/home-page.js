"use strict";

document.addEventListener("DOMContentLoaded", () => {
    /*
     * Product loading and newsletter behaviour stay original.
     * Website text, images and visibility are applied by
     * website-cms-bridge.js from /api/website/settings.
     */
    loadHomeProducts();
    initializeNewsletter();
});

// ======================================
// Load Home CMS
// ======================================

async function loadHomeCms() {
    try {
        const response = await fetch(
            "/api/website/pages/home",
            {
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                "Unable to load homepage content."
            );
        }

        const sections = Array.isArray(data.sections)
            ? data.sections
            : [];

        const sectionsByKey = Object.fromEntries(
            sections.map(section => [
                section.section_key,
                section
            ])
        );

        if (sectionsByKey.hero) {
            renderHeroSection(
                sectionsByKey.hero
            );
        }

        if (sectionsByKey.care_categories) {
            renderCareCategories(
                sectionsByKey.care_categories
            );
        }

        if (sectionsByKey.benefits) {
            renderBenefitsSection(
                sectionsByKey.benefits
            );
        }

        if (sectionsByKey.featured_products) {
            renderFeaturedProductsSection(
                sectionsByKey.featured_products
            );
        }

        if (sectionsByKey.brand_story) {
            renderBrandStorySection(
                sectionsByKey.brand_story
            );
        }

        if (sectionsByKey.testimonials) {
            renderTestimonialsSection(
                sectionsByKey.testimonials
            );
        }

        if (sectionsByKey.community) {
            renderCommunitySection(
                sectionsByKey.community
            );
        }

        if (sectionsByKey.newsletter) {
            renderNewsletterSection(
                sectionsByKey.newsletter
            );
        }

    } catch (error) {
        console.error(
            "Homepage CMS loading error:",
            error
        );

        /*
         * Existing HTML stays visible when
         * the CMS API is unavailable.
         */
    }
}

// ======================================
// Hero
// ======================================

function renderHeroSection(section) {
    const container =
        document.querySelector(".rk-hero");

    if (!container) return;

    const kicker =
        container.querySelector(".rk-kicker");

    const title =
        container.querySelector(
            ".rk-hero-copy h1"
        );

    const description =
        container.querySelector(
            ".rk-hero-copy > p"
        );

    const primaryButton =
        container.querySelector(
            ".rk-actions .rk-btn-primary"
        );

    const image =
        container.querySelector(
            ".rk-hero-card img"
        );

    if (kicker && section.eyebrow) {
        kicker.innerHTML = `
            <i class="fa fa-leaf"></i>
            ${escapeHtml(section.eyebrow)}
        `;
    }

    setText(title, section.title);

    setText(
        description,
        section.content ||
        section.subtitle
    );

    updateButton(
        primaryButton,
        section,
        true
    );

    if (image && section.image) {
        image.src =
            getCmsImageUrl(section.image);

        image.alt =
            section.title ||
            "RUKHNAV herbal beauty collection";
    }

    if (
        image &&
        section.mobile_image &&
        window.innerWidth <= 768
    ) {
        image.src =
            getCmsImageUrl(
                section.mobile_image
            );
    }

    applySectionColours(
        container,
        section
    );
}

// ======================================
// Care Categories
// ======================================

function renderCareCategories(section) {
    const container =
        document.querySelector(
            ".rk-categories"
        );

    if (!container) return;

    updateSectionHeading(
        container,
        section
    );

    applySectionColours(
        container,
        section
    );

    const grid =
        container.querySelector(
            ".rk-category-grid"
        );

    const items =
        getActiveItems(section);

    if (!grid || !items.length) return;

    grid.innerHTML = items
        .map((item, index) => {
            const cardClass =
                index === 0
                    ? "rk-category-card rk-category-large"
                    : "rk-category-card";

            const url =
                normaliseLink(
                    item.button_url ||
                    "products.html"
                );

            const image =
                getCmsImageUrl(
                    item.image ||
                    "category-1.jpg"
                );

            const eyebrow =
                escapeHtml(
                    item.eyebrow || ""
                );

            const title =
                escapeHtml(
                    item.title ||
                    "RUKHNAV Collection"
                );

            const buttonText =
                escapeHtml(
                    item.button_text ||
                    "Explore collection"
                );

            return `
                <a
                    href="${escapeAttribute(url)}"
                    class="${cardClass}"
                >
                    <img
                        src="${escapeAttribute(image)}"
                        alt="${title}"
                    >

                    <span
                        class="rk-category-shade"
                    ></span>

                    <span
                        class="rk-category-copy"
                    >
                        ${
                            eyebrow
                                ? `<small>${eyebrow}</small>`
                                : ""
                        }

                        <strong>
                            ${title}
                        </strong>

                        <em>
                            ${buttonText}
                        </em>
                    </span>
                </a>
            `;
        })
        .join("");
}

// ======================================
// Benefits
// ======================================

function renderBenefitsSection(section) {
    const container =
        document.querySelector(
            ".rk-benefits"
        );

    if (!container) return;

    const grid =
        container.querySelector(
            ".rk-benefit-grid"
        );

    applySectionColours(
        container,
        section
    );

    const items =
        getActiveItems(section);

    if (!grid || !items.length) return;

    grid.innerHTML = items
        .map(item => {
            const icon =
                normaliseIconClass(
                    item.icon,
                    "fa-check-circle"
                );

            const title =
                escapeHtml(
                    item.title ||
                    "RUKHNAV Benefit"
                );

            const description =
                escapeHtml(
                    item.description ||
                    item.subtitle ||
                    item.content ||
                    ""
                );

            return `
                <article>
                    <i
                        class="fa ${escapeAttribute(icon)}"
                    ></i>

                    <div>
                        <strong>
                            ${title}
                        </strong>

                        ${
                            description
                                ? `<span>${description}</span>`
                                : ""
                        }
                    </div>
                </article>
            `;
        })
        .join("");
}

// ======================================
// Featured Products Heading
// ======================================

function renderFeaturedProductsSection(section) {
    const container =
        document.querySelector(
            ".rk-products"
        );

    if (!container) return;

    updateSectionHeading(
        container,
        section
    );

    const link =
        container.querySelector(
            ".rk-text-link"
        );

    updateButton(
        link,
        section,
        true
    );

    applySectionColours(
        container,
        section
    );
}

// ======================================
// Brand Story
// ======================================

function renderBrandStorySection(section) {
    const container =
        document.querySelector(
            ".rk-story"
        );

    if (!container) return;

    const kicker =
        container.querySelector(
            ".rk-story-copy .rk-kicker"
        );

    const title =
        container.querySelector(
            ".rk-story-copy h2"
        );

    const description =
        container.querySelector(
            ".rk-story-copy > p"
        );

    const image =
        container.querySelector(
            ".rk-story-art img"
        );

    const values =
        container.querySelector(
            ".rk-values"
        );

    const button =
        container.querySelector(
            ".rk-story-copy .rk-btn"
        );

    setText(
        kicker,
        section.eyebrow
    );

    setText(
        title,
        section.title
    );

    setText(
        description,
        section.content ||
        section.subtitle
    );

    if (image && section.image) {
        image.src =
            getCmsImageUrl(section.image);

        image.alt =
            section.title ||
            "RUKHNAV brand story";
    }

    const items =
        getActiveItems(section);

    if (values && items.length) {
        values.innerHTML = items
            .map((item, index) => `
                <div>
                    <strong>
                        ${String(index + 1).padStart(2, "0")}
                    </strong>

                    <span>
                        ${escapeHtml(item.title || "")}
                    </span>
                </div>
            `)
            .join("");
    }

    updateButton(
        button,
        section
    );

    applySectionColours(
        container,
        section
    );
}

// ======================================
// Testimonials
// ======================================

function renderTestimonialsSection(section) {
    const container =
        document.querySelector(
            ".rk-testimonials"
        );

    if (!container) return;

    updateSectionHeading(
        container,
        section
    );

    applySectionColours(
        container,
        section
    );

    const grid =
        container.querySelector(
            ".rk-testimonial-grid"
        );

    const items =
        getActiveItems(section);

    if (!grid || !items.length) return;

    grid.innerHTML = items
        .map(item => {
            const rating =
                Math.max(
                    1,
                    Math.min(
                        5,
                        Number(
                            item.rating ||
                            item.value ||
                            5
                        )
                    )
                );

            const stars =
                "★".repeat(rating) +
                "☆".repeat(5 - rating);

            const quote =
                escapeHtml(
                    item.description ||
                    item.content ||
                    item.subtitle ||
                    ""
                );

            const customer =
                escapeHtml(
                    item.title ||
                    "Verified Customer"
                );

            return `
                <article>
                    <div
                        class="rk-stars"
                        aria-label="${rating} out of 5 stars"
                    >
                        ${stars}
                    </div>

                    ${
                        quote
                            ? `<p>“${quote}”</p>`
                            : ""
                    }

                    <strong>
                        ${customer}
                    </strong>
                </article>
            `;
        })
        .join("");
}

// ======================================
// Community
// ======================================

function renderCommunitySection(section) {
    const container =
        document.querySelector(
            ".rk-community-preview"
        );

    if (!container) return;

    updateSectionHeading(
        container,
        section
    );

    applySectionColours(
        container,
        section
    );

    const grid =
        container.querySelector(
            ".rk-event-grid"
        );

    const existingImages =
        Array.from(
            grid?.querySelectorAll("img") ||
            []
        ).map(image =>
            image.getAttribute("src")
        );

    const items =
        getActiveItems(section);

    if (!grid || !items.length) return;

    grid.innerHTML = items
        .map((item, index) => {
            const image =
                getCmsImageUrl(
                    item.image ||
                    existingImages[index] ||
                    (
                        index === 0
                            ? "gallery-1.jpg"
                            : "gallery-3.jpg"
                    )
                );

            const url =
                normaliseLink(
                    item.button_url ||
                    (
                        index === 0
                            ? "events.html"
                            : "reviews.html"
                    )
                );

            const eyebrow =
                escapeHtml(
                    item.eyebrow || ""
                );

            const title =
                escapeHtml(
                    item.title ||
                    "RUKHNAV Community"
                );

            const description =
                escapeHtml(
                    item.description ||
                    item.content ||
                    ""
                );

            const buttonText =
                escapeHtml(
                    item.button_text || ""
                );

            return `
                <a
                    class="rk-event-card"
                    href="${escapeAttribute(url)}"
                >
                    <div class="rk-event-image">
                        <img
                            src="${escapeAttribute(image)}"
                            alt="${title}"
                        >

                        ${
                            eyebrow
                                ? `<span>${eyebrow}</span>`
                                : ""
                        }
                    </div>

                    <div class="rk-event-body">
                        <h3>
                            ${title}
                        </h3>

                        ${
                            description
                                ? `<p>${description}</p>`
                                : ""
                        }

                        ${
                            buttonText
                                ? `<em>${buttonText}</em>`
                                : ""
                        }
                    </div>
                </a>
            `;
        })
        .join("");
}

// ======================================
// Newsletter CMS
// ======================================

function renderNewsletterSection(section) {
    const container =
        document.querySelector(
            ".rk-newsletter"
        );

    if (!container) return;

    const kicker =
        container.querySelector(
            ".rk-kicker"
        );

    const title =
        container.querySelector("h2");

    const description =
        container.querySelector(
            ".rk-newsletter-card > div > p"
        );

    const button =
        container.querySelector(
            "#newsletter-form button[type='submit']"
        );

    setText(
        kicker,
        section.eyebrow
    );

    setText(
        title,
        section.title
    );

    setText(
        description,
        section.content ||
        section.subtitle
    );

    if (button && section.button_text) {
        button.textContent =
            section.button_text;
    }

    applySectionColours(
        container,
        section
    );
}

// ======================================
// Shared CMS Helpers
// ======================================

function updateSectionHeading(
    container,
    section
) {
    const kicker =
        container.querySelector(
            ".rk-section-head .rk-kicker"
        );

    const title =
        container.querySelector(
            ".rk-section-head h2"
        );

    const description =
        container.querySelector(
            ".rk-section-head p"
        );

    setText(
        kicker,
        section.eyebrow
    );

    setText(
        title,
        section.title
    );

    setText(
        description,
        section.subtitle ||
        section.content
    );
}

function getActiveItems(section) {
    if (!Array.isArray(section?.items)) {
        return [];
    }

    return section.items.filter(item => {
        const status =
            String(
                item.status ?? "Active"
            ).toLowerCase();

        return status !== "inactive";
    });
}

function setText(element, value) {
    if (
        element &&
        value !== undefined &&
        value !== null &&
        value !== ""
    ) {
        element.textContent = value;
    }
}

function updateButton(
    button,
    section,
    useArrow = false
) {
    if (!button) return;

    if (section.button_text) {
        if (useArrow) {
            button.innerHTML = `
                ${escapeHtml(section.button_text)}
                <i class="fa fa-long-arrow-right"></i>
            `;
        } else {
            button.textContent =
                section.button_text;
        }
    }

    if (section.button_url) {
        button.href =
            normaliseLink(
                section.button_url
            );
    }

    if (
        !section.button_text &&
        !section.button_url
    ) {
        button.style.display = "none";
    } else {
        button.style.display = "";
    }
}

function normaliseIconClass(
    icon,
    fallback
) {
    const value =
        String(
            icon ||
            fallback ||
            "fa-check-circle"
        )
            .trim()
            .replace(/^fa\s+/, "");

    return value.startsWith("fa-")
        ? value
        : `fa-${value}`;
}

function applySectionColours(
    container,
    section
) {
    if (!container || !section) return;

    if (section.background_color) {
        container.style.backgroundColor =
            section.background_color;
    }

    if (section.text_color) {
        container.style.color =
            section.text_color;

        container
            .querySelectorAll(
                "h1, h2, h3, p, strong, span, small, em"
            )
            .forEach(element => {
                element.style.color =
                    section.text_color;
            });
    }
}

// ======================================
// Featured Products
// ======================================

async function loadHomeProducts() {
    const target =
        document.getElementById(
            "home-product-list"
        );

    if (!target) return;

    try {
        let result;

        try {
            result =
                await RukhnavAPI
                    .getFeaturedProducts();

        } catch (featuredError) {
            console.warn(
                "Featured products route failed. Loading normal products.",
                featuredError
            );

            result =
                await RukhnavAPI
                    .getProducts({
                        limit: 4
                    });
        }

        const products =
            Array.isArray(result?.products)
                ? result.products.slice(0, 4)
                : [];

        if (!products.length) {
            target.innerHTML = `
                <div class="rk-product-state">
                    No featured products are
                    available yet.
                </div>
            `;

            return;
        }

        target.innerHTML =
            products
                .map(renderProductCard)
                .join("");

        bindAddToCartButtons();

    } catch (error) {
        console.error(
            "Homepage product loading failed:",
            error
        );

        target.innerHTML = `
            <div class="rk-product-state">
                Products could not be loaded.
                Please make sure the Node.js
                server is running.
            </div>
        `;
    }
}

function renderProductCard(product) {
    const id =
        Number(product.id);

    const name =
        RukhnavAPI.escapeHTML(
            product.name ||
            product.product_name ||
            "RUKHNAV Product"
        );

    const price =
        RukhnavAPI.formatMoney(
            product.price ||
            product.selling_price ||
            0
        );

    const image =
        RukhnavAPI.getImageUrl(
            product.image ||
            product.imageUrl ||
            ""
        );

    const fallback =
        RukhnavAPI.getFallbackImageUrl(
            product.image || ""
        );

    return `
        <article class="rk-product-card">
            <a
                class="rk-product-image"
                href="product-details.html?id=${id}"
            >
                <img
                    src="${escapeAttribute(image)}"
                    alt="${name}"
                    onerror="
                        this.onerror=null;
                        this.src='${escapeAttribute(fallback)}';
                    "
                >
            </a>

            <h3>
                ${name}
            </h3>

            <div class="rk-price">
                ${price}
            </div>

            <div class="rk-card-actions">
                <a
                    href="product-details.html?id=${id}"
                >
                    Details
                </a>

                <button
                    type="button"
                    data-add-product="${id}"
                >
                    Add to cart
                </button>
            </div>
        </article>
    `;
}

// ======================================
// Add to Cart
// ======================================

function bindAddToCartButtons() {
    document
        .querySelectorAll(
            "[data-add-product]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                async () => {
                    const productId =
                        Number(
                            button.dataset
                                .addProduct
                        );

                    const originalText =
                        button.textContent;

                    if (
                        !RukhnavAPI.isLoggedIn()
                    ) {
                        window.location.href =
                            "account.html";

                        return;
                    }

                    try {
                        button.disabled = true;
                        button.textContent =
                            "Adding...";

                        await RukhnavAPI
                            .addToCart(
                                productId,
                                1
                            );

                        button.textContent =
                            "Added";

                        await refreshHeaderCartCount();

                    } catch (error) {
                        console.error(
                            "Add to cart failed:",
                            error
                        );

                        button.textContent =
                            "Try again";

                    } finally {
                        window.setTimeout(() => {
                            button.disabled =
                                false;

                            button.textContent =
                                originalText;
                        }, 1200);
                    }
                }
            );
        });
}

async function refreshHeaderCartCount() {
    const countElement =
        document.getElementById(
            "header-cart-count"
        );

    if (!countElement) return;

    try {
        const result =
            await RukhnavAPI.getCart();

        const count =
            Number(
                result?.itemCount ??
                result?.item_count ??
                result?.cart?.reduce(
                    (total, item) =>
                        total +
                        Number(
                            item.quantity || 0
                        ),
                    0
                ) ??
                0
            );

        countElement.textContent =
            String(count);

        countElement.hidden =
            count <= 0;

    } catch (error) {
        console.warn(
            "Cart count refresh failed:",
            error
        );
    }
}

// ======================================
// Newsletter Form
// ======================================

function initializeNewsletter() {
    const form =
        document.getElementById(
            "newsletter-form"
        );

    const message =
        document.getElementById(
            "newsletter-message"
        );

    if (!form || !message) return;

    form.addEventListener(
        "submit",
        event => {
            event.preventDefault();

            const emailInput =
                form.querySelector(
                    "input[type='email']"
                );

            const email =
                String(
                    emailInput?.value || ""
                ).trim();

            if (!email) {
                message.textContent =
                    "Please enter your email address.";

                return;
            }

            message.textContent =
                "Thank you. You are now on the RUKHNAV list.";

            form.reset();
        }
    );
}

// ======================================
// Image and Link Helpers
// ======================================

function getCmsImageUrl(imagePath) {
    if (!imagePath) {
        return "";
    }

    const value =
        String(imagePath).trim();

    if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("data:") ||
        value.startsWith("blob:")
    ) {
        return value;
    }

    if (value.startsWith("/uploads/")) {
        return value;
    }

    if (value.startsWith("uploads/")) {
        return `/${value}`;
    }

    /*
     * CMS-uploaded files begin with
     * a 13-digit timestamp.
     */
    if (/^\d{13}-/.test(value)) {
        return `/uploads/website/${value}`;
    }

    /*
     * Local storefront files such as
     * category-1.jpg remain relative.
     */
    if (!value.includes("/")) {
        return value;
    }

    return `/${value.replace(/^\/+/, "")}`;
}

function normaliseLink(url) {
    if (!url) {
        return "#";
    }

    const value =
        String(url).trim();

    if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("/") ||
        value.startsWith("#") ||
        value.startsWith("mailto:") ||
        value.startsWith("tel:")
    ) {
        return value;
    }

    return value;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}