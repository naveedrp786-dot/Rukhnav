"use strict";

/*
 * RUKHNAV Website Management Pro
 * This bridge edits the original premium storefront without replacing
 * its markup, classes, spacing, animations or responsive design.
 */

window.RukhnavWebsiteCMS = {
    settings: {},

    escape(value = "") {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    },

    asset(value = "") {
        const path = String(value || "").trim();

        if (!path) {
            return "";
        }

        if (
            /^(https?:)?\/\//i.test(path) ||
            path.startsWith("data:")
        ) {
            return path;
        }

        return path.startsWith("/")
            ? path
            : path;
    },

    text(selector, value) {
        const element =
            document.querySelector(selector);

        if (
            element &&
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            element.textContent = value;
        }
    },

    html(selector, value) {
        const element =
            document.querySelector(selector);

        if (
            element &&
            value !== undefined &&
            value !== null
        ) {
            element.innerHTML = value;
        }
    },

    link(selector, label, url) {
        const element =
            document.querySelector(selector);

        if (!element) {
            return;
        }

        if (
            label !== undefined &&
            label !== null &&
            String(label).trim()
        ) {
            const icon =
                element.querySelector("i");

            element.textContent = label;

            if (icon) {
                element.append(" ");
                element.appendChild(icon);
            }
        }

        if (url) {
            element.href = url;
        }
    },

    visible(selector, enabled) {
        const element =
            document.querySelector(selector);

        if (element) {
            element.hidden =
                enabled === false;
        }
    },

    applyTheme(settings) {
        const theme =
            settings.theme || {};

        const root =
            document.documentElement;

        const values = {
            "--cms-primary":
                theme.primary_color,

            "--cms-secondary":
                theme.secondary_color,

            "--cms-accent":
                theme.accent_color,

            "--cms-background":
                theme.background_color,

            "--cms-surface":
                theme.surface_color,

            "--cms-text":
                theme.text_color,

            "--cms-muted":
                theme.muted_color,

            "--cms-radius":
                theme.border_radius !==
                    undefined
                    ? `${theme.border_radius}px`
                    : null,

            "--cms-button-radius":
                theme.button_radius !==
                    undefined
                    ? `${theme.button_radius}px`
                    : null
        };

        Object.entries(values)
            .forEach(
                ([key, value]) => {
                    if (value) {
                        root.style
                            .setProperty(
                                key,
                                value
                            );
                    }
                }
            );

        let style =
            document.getElementById(
                "websiteCmsTheme"
            );

        if (!style) {
            style =
                document.createElement(
                    "style"
                );

            style.id =
                "websiteCmsTheme";

            document.head
                .appendChild(style);
        }

        const headingFont =
            theme.heading_font ||
            "Cormorant Garamond";

        const bodyFont =
            theme.body_font ||
            "Poppins";

        style.textContent = `
            body.rk-home {
                background:
                    var(
                        --cms-background,
                        #f7f3e8
                    );
                color:
                    var(
                        --cms-text,
                        #183a2b
                    );
                font-family:
                    "${bodyFont}",
                    sans-serif;
            }

            body.rk-home h1,
            body.rk-home h2,
            body.rk-home h3,
            body.rk-home .rk-badge {
                font-family:
                    "${headingFont}",
                    serif;
            }

            body.rk-home .rk-btn,
            body.rk-home button {
                border-radius:
                    var(
                        --cms-button-radius,
                        999px
                    );
            }

            body.rk-home .rk-category-card,
            body.rk-home .rk-product-card,
            body.rk-home .rk-newsletter-card {
                border-radius:
                    var(
                        --cms-radius,
                        24px
                    );
            }

            body.rk-home .rk-btn-primary,
            body.rk-home .rk-card-actions button,
            body.rk-home .rk-newsletter-form button {
                background:
                    var(
                        --cms-primary,
                        #17452f
                    );
            }

            body.rk-home .rk-kicker,
            body.rk-home .rk-price,
            body.rk-home .rk-stars {
                color:
                    var(
                        --cms-secondary,
                        #c9961a
                    );
            }
        `;

        if (
            settings.advanced
                ?.custom_css
        ) {
            style.textContent +=
                "\n" +
                settings.advanced
                    .custom_css;
        }
    },

    applyBranding(settings) {
        const branding =
            settings.branding || {};

        document
            .querySelectorAll(
                ".store-logo img, .rk-footer-logo img"
            )
            .forEach(image => {
                if (
                    branding.logo_url
                ) {
                    image.src =
                        this.asset(
                            branding.logo_url
                        );
                }

                image.alt =
                    branding.brand_name ||
                    "RUKHNAV";
            });

        document
            .querySelectorAll(
                ".store-logo-text strong, .rk-footer-logo strong"
            )
            .forEach(element => {
                if (
                    branding.brand_name
                ) {
                    element.textContent =
                        branding.brand_name;
                }
            });

        document
            .querySelectorAll(
                ".store-logo-text small, .rk-footer-logo small"
            )
            .forEach(element => {
                if (
                    branding.tagline
                ) {
                    element.textContent =
                        branding.tagline;
                }
            });

        if (
            branding.favicon_url
        ) {
            let favicon =
                document.querySelector(
                    'link[rel="icon"]'
                );

            if (!favicon) {
                favicon =
                    document.createElement(
                        "link"
                    );

                favicon.rel =
                    "icon";

                document.head
                    .appendChild(
                        favicon
                    );
            }

            favicon.href =
                this.asset(
                    branding.favicon_url
                );
        }
    },

    applyHeader(settings) {
        const header =
            settings.header || {};

        this.visible(
            ".store-announcement-bar",
            header.announcement_enabled
        );

        const announcement =
            document.querySelector(
                ".announcement-content p"
            );

        if (
            announcement &&
            header.announcement_text
        ) {
            announcement.innerHTML = `
                <i class="fa fa-leaf"></i>
                ${this.escape(
                    header.announcement_text
                )}
            `;
        }

        const navigation =
            Array.isArray(
                settings.navigation
            )
                ? settings.navigation
                    .filter(
                        item =>
                            item.enabled !==
                            false
                    )
                    .sort(
                        (a, b) =>
                            Number(
                                a.sort_order ||
                                0
                            ) -
                            Number(
                                b.sort_order ||
                                0
                            )
                    )
                : [];

        const list =
            document.querySelector(
                "#store-navigation ul"
            );

        if (
            list &&
            navigation.length
        ) {
            const currentPage =
                window.location.pathname
                    .split("/")
                    .pop() ||
                "index.html";

            list.innerHTML =
                navigation
                    .map(item => {
                        const href =
                            item.url ||
                            "#";

                        const active =
                            href
                                .split("?")[0] ===
                            currentPage;

                        return `
                            <li>
                                <a
                                    href="${this.escape(href)}"
                                    class="${active ? "active" : ""}"
                                >
                                    ${this.escape(
                                        item.label ||
                                        "Link"
                                    )}
                                </a>
                            </li>
                        `;
                    })
                    .join("");
        }
    },

    applyHero(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-hero",
            home.hero_enabled
        );

        if (
            home.hero_eyebrow
        ) {
            this.html(
                ".rk-hero .rk-kicker",
                `
                    <i class="fa fa-leaf"></i>
                    ${this.escape(
                        home.hero_eyebrow
                    )}
                `
            );
        }

        this.text(
            ".rk-hero-copy h1",
            home.hero_title
        );

        this.text(
            ".rk-hero-copy > p",
            home.hero_text
        );

        this.link(
            ".rk-actions .rk-btn-primary",
            home.hero_primary_label,
            home.hero_primary_url
        );

        this.link(
            ".rk-actions .rk-btn-secondary",
            home.hero_secondary_label,
            home.hero_secondary_url
        );

        const image =
            document.querySelector(
                ".rk-hero-card img"
            );

        if (
            image &&
            home.hero_image_url
        ) {
            image.src =
                this.asset(
                    home.hero_image_url
                );

            image.alt =
                home.hero_image_alt ||
                home.hero_title ||
                "RUKHNAV collection";
        }

        const badge =
            document.querySelector(
                ".rk-badge"
            );

        if (badge) {
            const brand =
                settings.branding
                    ?.brand_name ||
                "RUKHNAV";

            badge.innerHTML = `
                ${this.escape(brand)}
                <br>
                <small>
                    ${this.escape(
                        home.hero_artwork_text ||
                        "Signature Care"
                    )}
                </small>
            `;
        }

        const trust =
            document.querySelector(
                ".rk-trust"
            );

        if (trust) {
            const points = [
                home.hero_trust_1,
                home.hero_trust_2,
                home.hero_trust_3
            ].filter(Boolean);

            if (points.length) {
                trust.innerHTML =
                    points
                        .map(
                            point => `
                                <span>
                                    <i class="fa fa-check-circle"></i>
                                    ${this.escape(point)}
                                </span>
                            `
                        )
                        .join("");
            }
        }
    },

    applyBenefits(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-benefits",
            home.benefits_enabled
        );

        const articles =
            document.querySelectorAll(
                ".rk-benefit-grid article"
            );

        articles.forEach(
            (article, index) => {
                const number =
                    index + 1;

                const title =
                    home[
                        `benefit_${number}_title`
                    ];

                const text =
                    home[
                        `benefit_${number}_text`
                    ];

                if (title) {
                    const target =
                        article.querySelector(
                            "strong"
                        );

                    if (target) {
                        target.textContent =
                            title;
                    }
                }

                if (text) {
                    const target =
                        article.querySelector(
                            "span"
                        );

                    if (target) {
                        target.textContent =
                            text;
                    }
                }
            }
        );
    },

    applyCategories(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-categories",
            home.categories_enabled
        );

        this.text(
            ".rk-categories .rk-kicker",
            home.categories_eyebrow
        );

        this.text(
            ".rk-categories h2",
            home.categories_title
        );

        this.text(
            ".rk-categories .rk-section-head p",
            home.categories_description
        );

        const cards =
            Array.isArray(
                home.category_cards
            )
                ? home.category_cards
                    .filter(
                        item =>
                            item.enabled !==
                            false
                    )
                : [];

        const grid =
            document.querySelector(
                ".rk-category-grid"
            );

        if (
            grid &&
            cards.length
        ) {
            grid.innerHTML =
                cards
                    .map(
                        (item, index) => `
                            <a
                                href="${this.escape(
                                    item.url ||
                                    "products.html"
                                )}"
                                class="
                                    rk-category-card
                                    ${
                                        index === 0
                                            ? "rk-category-large"
                                            : ""
                                    }
                                "
                            >
                                <img
                                    src="${this.escape(
                                        this.asset(
                                            item.image_url ||
                                            `category-${Math.min(
                                                index + 1,
                                                3
                                            )}.jpg`
                                        )
                                    )}"
                                    alt="${this.escape(
                                        item.title ||
                                        "RUKHNAV category"
                                    )}"
                                >

                                <span
                                    class="rk-category-shade"
                                ></span>

                                <span
                                    class="rk-category-copy"
                                >
                                    <small>
                                        ${this.escape(
                                            item.eyebrow ||
                                            item.text ||
                                            ""
                                        )}
                                    </small>

                                    <strong>
                                        ${this.escape(
                                            item.title ||
                                            "RUKHNAV Collection"
                                        )}
                                    </strong>

                                    <em>
                                        ${this.escape(
                                            item.button_label ||
                                            "Explore collection"
                                        )}
                                    </em>
                                </span>
                            </a>
                        `
                    )
                    .join("");
        }
    },

    applyFeatured(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-products",
            home.featured_enabled
        );

        this.text(
            ".rk-products .rk-kicker",
            home.featured_eyebrow
        );

        this.text(
            ".rk-products h2",
            home.featured_title
        );

        this.text(
            ".rk-products .rk-section-head p",
            home.featured_description
        );

        this.link(
            ".rk-products .rk-text-link",
            home.featured_button_label,
            home.featured_button_url
        );
    },

    applyStory(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-story",
            home.story_enabled
        );

        this.text(
            ".rk-story-copy .rk-kicker",
            home.story_eyebrow
        );

        this.text(
            ".rk-story-copy h2",
            home.story_title
        );

        this.text(
            ".rk-story-copy > p",
            home.story_text
        );

        this.link(
            ".rk-story-copy .rk-btn",
            home.story_button_label,
            home.story_button_url
        );

        const image =
            document.querySelector(
                ".rk-story-art img"
            );

        if (
            image &&
            home.story_image_url
        ) {
            image.src =
                this.asset(
                    home.story_image_url
                );
        }

        const values =
            document.querySelectorAll(
                ".rk-values div span"
            );

        [
            home.story_point_1,
            home.story_point_2,
            home.story_point_3
        ].forEach(
            (value, index) => {
                if (
                    value &&
                    values[index]
                ) {
                    values[index]
                        .textContent =
                        value;
                }
            }
        );
    },

    applyTestimonials(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-testimonials",
            home.testimonials_enabled
        );

        this.text(
            ".rk-testimonials .rk-kicker",
            home.testimonials_eyebrow
        );

        this.text(
            ".rk-testimonials h2",
            home.testimonials_title
        );

        const testimonials =
            Array.isArray(
                home.testimonials
            )
                ? home.testimonials
                    .filter(
                        item =>
                            item.enabled !==
                            false
                    )
                : [];

        const grid =
            document.querySelector(
                ".rk-testimonial-grid"
            );

        if (
            grid &&
            testimonials.length
        ) {
            grid.innerHTML =
                testimonials
                    .map(item => {
                        const rating =
                            Math.max(
                                1,
                                Math.min(
                                    5,
                                    Number(
                                        item.rating ||
                                        5
                                    )
                                )
                            );

                        return `
                            <article>
                                <div class="rk-stars">
                                    ${"★".repeat(rating)}
                                    ${"☆".repeat(5 - rating)}
                                </div>

                                <p>
                                    “${this.escape(
                                        item.quote ||
                                        item.text ||
                                        ""
                                    )}”
                                </p>

                                <strong>
                                    ${this.escape(
                                        item.customer ||
                                        item.title ||
                                        "Verified Customer"
                                    )}
                                </strong>
                            </article>
                        `;
                    })
                    .join("");
        }
    },

    applyCommunity(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-community-preview",
            home.community_enabled
        );

        this.text(
            ".rk-community-preview .rk-kicker",
            home.community_eyebrow
        );

        this.text(
            ".rk-community-preview h2",
            home.community_title
        );

        this.text(
            ".rk-community-preview .rk-section-head p",
            home.community_text
        );
    },

    applyNewsletter(settings) {
        const home =
            settings.home || {};

        this.visible(
            ".rk-newsletter",
            home.newsletter_enabled
        );

        this.text(
            ".rk-newsletter .rk-kicker",
            home.newsletter_eyebrow
        );

        this.text(
            ".rk-newsletter h2",
            home.newsletter_title
        );

        this.text(
            ".rk-newsletter-card > div > p",
            home.newsletter_text
        );

        const input =
            document.getElementById(
                "newsletter-email"
            );

        if (
            input &&
            home.newsletter_placeholder
        ) {
            input.placeholder =
                home.newsletter_placeholder;
        }

        this.text(
            ".rk-newsletter-form button",
            home.newsletter_button_label
        );

        this.text(
            "#newsletter-message",
            home.newsletter_helper_text
        );
    },

    applyFooter(settings) {
        const footer =
            settings.footer || {};

        const contact =
            settings.contact || {};

        const social =
            settings.social || {};

        this.text(
            ".rk-footer-brand > p",
            footer.short_description
        );

        this.text(
            ".rk-footer-bottom p",
            footer.copyright_text
        );

        const socialMap = [
            [
                "facebook",
                social.facebook_url
            ],
            [
                "instagram",
                social.instagram_url
            ],
            [
                "whatsapp",
                contact.whatsapp_number
                    ? `https://wa.me/${String(
                        contact.whatsapp_number
                    ).replace(/\D/g, "")}`
                    : ""
            ],
            [
                "youtube-play",
                social.youtube_url
            ]
        ];

        socialMap.forEach(
            ([icon, url]) => {
                const link =
                    document
                        .querySelector(
                            `.rk-footer a:has(.fa-${icon})`
                        );

                if (
                    link &&
                    url
                ) {
                    link.href =
                        url;
                }
            }
        );
    },

    applySEO(settings) {
        const seo =
            settings.seo || {};

        if (seo.site_title) {
            document.title =
                seo.site_title;
        }

        const description =
            document.querySelector(
                'meta[name="description"]'
            );

        if (
            description &&
            seo.site_description
        ) {
            description.content =
                seo.site_description;
        }
    },

    applyMaintenance(settings) {
        const advanced =
            settings.advanced || {};

        if (
            !advanced.maintenance_mode
        ) {
            return;
        }

        document.body.innerHTML = `
            <main
                style="
                    min-height:100vh;
                    display:grid;
                    place-items:center;
                    padding:40px;
                    text-align:center;
                    background:#f8f3e7;
                "
            >
                <section>
                    <h1
                        style="
                            color:#17452f;
                            font-family:'Cormorant Garamond',serif;
                            font-size:54px;
                        "
                    >
                        ${this.escape(
                            settings.branding
                                ?.brand_name ||
                            "RUKHNAV"
                        )}
                    </h1>

                    <p>
                        ${this.escape(
                            advanced
                                .maintenance_message ||
                            "We are improving the store. Please check back soon."
                        )}
                    </p>
                </section>
            </main>
        `;
    },

    apply(settings = {}) {
        this.settings =
            settings;

        this.applyTheme(settings);
        this.applyBranding(settings);
        this.applyHeader(settings);
        this.applyHero(settings);
        this.applyBenefits(settings);
        this.applyCategories(settings);
        this.applyFeatured(settings);
        this.applyStory(settings);
        this.applyTestimonials(settings);
        this.applyCommunity(settings);
        this.applyNewsletter(settings);
        this.applyFooter(settings);
        this.applySEO(settings);
        this.applyMaintenance(settings);
    },

    async load() {
        try {
            const response =
                await fetch(
                    "/api/website/settings",
                    {
                        headers: {
                            Accept:
                                "application/json"
                        },

                        cache:
                            "no-store"
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                data.success === false
            ) {
                throw new Error(
                    data.message ||
                    "Unable to load website settings."
                );
            }

            const settings =
                data.settings ||
                data;

            this.apply(settings);

            window.dispatchEvent(
                new CustomEvent(
                    "rukhnav:cms-ready",
                    {
                        detail: settings
                    }
                )
            );
        } catch (error) {
            console.warn(
                "Website Management settings are unavailable. Original storefront content remains visible.",
                error
            );
        }
    }
};

window.addEventListener(
    "message",
    event => {
        if (
            event.data?.type ===
            "RUKHNAV_CMS_PREVIEW"
        ) {
            RukhnavWebsiteCMS.apply(
                event.data.settings ||
                {}
            );
        }
    }
);

document.addEventListener(
    "DOMContentLoaded",
    () => {
        /*
         * Run after the original layout has rendered,
         * preserving every approved class and structure.
         */
        setTimeout(
            () =>
                RukhnavWebsiteCMS
                    .load(),
            80
        );
    }
);
