"use strict";

window.RukhnavModernCMS = {
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
        const assetPath = String(value || "").trim();

        if (!assetPath) {
            return "";
        }

        if (
            /^(https?:)?\/\//i.test(assetPath) ||
            assetPath.startsWith("data:")
        ) {
            return assetPath;
        }

        return assetPath;
    },

    setText(selector, value) {
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

    setVisible(selector, enabled) {
        const element =
            document.querySelector(selector);

        if (element) {
            element.hidden =
                enabled === false;
        }
    },


    ensureProceduralSmokeFilter() {
        if (
            document.getElementById(
                "rukhnav-smoke-svg"
            )
        ) {
            return;
        }

        const wrapper =
            document.createElement("div");

        wrapper.id =
            "rukhnav-smoke-svg";

        wrapper.setAttribute(
            "aria-hidden",
            "true"
        );

        wrapper.style.position =
            "absolute";

        wrapper.style.width =
            "0";

        wrapper.style.height =
            "0";

        wrapper.style.overflow =
            "hidden";

        wrapper.innerHTML = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="0"
                height="0"
            >
                <defs>

                    <filter
                        id="rukhnavSmokeFilter"
                        x="-45%"
                        y="-45%"
                        width="190%"
                        height="190%"
                        color-interpolation-filters="sRGB"
                    >
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.006 0.013"
                            numOctaves="5"
                            seed="37"
                            stitchTiles="stitch"
                            result="noise"
                        />

                        <feGaussianBlur
                            in="noise"
                            stdDeviation="1.8"
                            result="softNoise"
                        />

                        <feColorMatrix
                            in="softNoise"
                            type="luminanceToAlpha"
                            result="noiseAlpha"
                        />

                        <feComponentTransfer
                            in="noiseAlpha"
                            result="shapedNoise"
                        >
                            <feFuncA
                                type="gamma"
                                amplitude="1.18"
                                exponent="1.45"
                                offset="-0.12"
                            />
                        </feComponentTransfer>

                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="noise"
                            scale="28"
                            xChannelSelector="R"
                            yChannelSelector="B"
                            result="softDistortion"
                        />

                        <feComposite
                            in="softDistortion"
                            in2="shapedNoise"
                            operator="in"
                            result="texturedSmoke"
                        />

                        <feGaussianBlur
                            in="texturedSmoke"
                            stdDeviation="12"
                            result="featheredSmoke"
                        />

                        <feBlend
                            in="featheredSmoke"
                            in2="texturedSmoke"
                            mode="screen"
                        />
                    </filter>

                </defs>
            </svg>
        `;

        document.body.appendChild(
            wrapper
        );
    },


    ensureHeroSmokeLayers() {

        const heroCopies =
            document.querySelectorAll(
                ".hero-copy"
            );

        heroCopies.forEach(
            heroCopy => {

                if (
                    heroCopy.querySelector(
                        ".rukhnav-smoke-layer"
                    )
                ) {
                    return;
                }

                const smoke =
                    document.createElement(
                        "div"
                    );

                smoke.className =
                    "rukhnav-smoke-stack";

                smoke.setAttribute(
                    "aria-hidden",
                    "true"
                );

                smoke.innerHTML = `
                    <div
                        class="
                            rukhnav-smoke-layer
                            smoke-depth-back
                        "
                    ></div>

                    <div
                        class="
                            rukhnav-smoke-layer
                            smoke-depth-middle
                        "
                    ></div>

                    <div
                        class="
                            rukhnav-smoke-layer
                            smoke-depth-front
                        "
                    ></div>
                `;

                heroCopy.prepend(
                    smoke
                );
            }
        );
    },

    applyTheme(settings) {
        this.ensureProceduralSmokeFilter();
        this.ensureHeroSmokeLayers();

        const theme =
            settings.theme || {};

        const root =
            document.documentElement;

        const atmosphereMode =
            String(
                theme.atmosphere_mode ||
                "soft"
            ).toLowerCase();

        root.dataset.themeAtmosphere =
            atmosphereMode;

        /* =========================================================
           RUKHNAV THEME ENGINE V2
           Derived cinematic palette
           ========================================================= */

        const normalizeHex = (value, fallback) => {
            const raw = String(value || fallback || "")
                .trim()
                .replace("#", "");

            if (/^[0-9a-f]{3}$/i.test(raw)) {
                return "#" + raw
                    .split("")
                    .map(char => char + char)
                    .join("");
            }

            if (/^[0-9a-f]{6}$/i.test(raw)) {
                return "#" + raw;
            }

            return fallback;
        };

        const hexToRgb = hex => {
            const clean = normalizeHex(
                hex,
                "#17452f"
            ).slice(1);

            return {
                r: parseInt(clean.slice(0, 2), 16),
                g: parseInt(clean.slice(2, 4), 16),
                b: parseInt(clean.slice(4, 6), 16)
            };
        };

        const mix = (
            colorA,
            colorB,
            weight = 0.5
        ) => {
            const a = hexToRgb(colorA);
            const b = hexToRgb(colorB);

            const amount =
                Math.max(
                    0,
                    Math.min(1, weight)
                );

            const channel = (x, y) =>
                Math.round(
                    x + (y - x) * amount
                )
                    .toString(16)
                    .padStart(2, "0");

            return (
                "#" +
                channel(a.r, b.r) +
                channel(a.g, b.g) +
                channel(a.b, b.b)
            );
        };

        const alpha = (
            hex,
            opacity
        ) => {
            const rgb =
                hexToRgb(hex);

            return (
                `rgba(${rgb.r}, ` +
                `${rgb.g}, ` +
                `${rgb.b}, ` +
                `${opacity})`
            );
        };

        const primary =
            normalizeHex(
                theme.primary_color,
                "#17452f"
            );

        const secondary =
            normalizeHex(
                theme.secondary_color,
                "#d6a928"
            );

        const accent =
            normalizeHex(
                theme.accent_color,
                "#f4ead2"
            );

        const background =
            normalizeHex(
                theme.background_color,
                "#f7f4ec"
            );

        const surface =
            normalizeHex(
                theme.surface_color,
                "#ffffff"
            );

        /*
         * Theme V2 supports explicitly selected
         * cinematic shades from Website Management.
         * Older saved themes safely derive them
         * from the original palette.
         */
        const shade1 =
            normalizeHex(
                theme.shade_1,
                mix(
                    primary,
                    "#000000",
                    0.18
                )
            );

        const shade2 =
            normalizeHex(
                theme.shade_2,
                mix(
                    primary,
                    secondary,
                    0.28
                )
            );

        const shade3 =
            normalizeHex(
                theme.shade_3,
                mix(
                    secondary,
                    accent,
                    0.34
                )
            );

        const shade4 =
            normalizeHex(
                theme.shade_4,
                mix(
                    accent,
                    "#ffffff",
                    0.34
                )
            );

        const highlight =
            normalizeHex(
                theme.highlight_color,
                mix(
                    secondary,
                    "#ffffff",
                    0.18
                )
            );

        const glowColor =
            normalizeHex(
                theme.glow_color,
                secondary
            );

        const glow =
            alpha(
                glowColor,
                0.28
            );

        const heroGradient =
            `linear-gradient(135deg, ` +
            `${background} 0%, ` +
            `${shade4} 46%, ` +
            `${accent} 100%)`;

        const deepGradient =
            `linear-gradient(135deg, ` +
            `${shade1} 0%, ` +
            `${primary} 45%, ` +
            `${shade2} 100%)`;

        const buttonGradient =
            `linear-gradient(135deg, ` +
            `${primary} 0%, ` +
            `${shade2} 100%)`;

        const promoGradient =
            `linear-gradient(120deg, ` +
            `${primary} 0%, ` +
            `${secondary} 58%, ` +
            `${highlight} 100%)`;

        const softGradient =
            `linear-gradient(135deg, ` +
            `${background} 0%, ` +
            `${surface} 48%, ` +
            `${shade4} 100%)`;

        const spectrumGradient =
            `linear-gradient(120deg, ` +
            `${shade1} 0%, ` +
            `${shade2} 22%, ` +
            `${shade3} 46%, ` +
            `${shade4} 68%, ` +
            `${highlight} 84%, ` +
            `${glowColor} 100%)`;

        /*
         * =========================================================
         * RUKHNAV THEME ENGINE V2.1
         * ATMOSPHERIC MESH
         * =========================================================
         *
         * Multiple elliptical colour clouds are deliberately placed
         * at different coordinates and sizes. This avoids the flat
         * left-to-right gradient appearance of conventional themes.
         */

        /*
         * =========================================================
         * RUKHNAV THEME ENGINE V2.2
         * MULTI-CLOUD CINEMATIC MESH
         * =========================================================
         *
         * Smaller independent colour clouds preserve visible
         * colour identities instead of blending into one wash.
         */

        const meshGradient =
            `radial-gradient(ellipse 38% 42% at 4% 8%, ` +
            `${alpha(shade1, 0.96)} 0%, ` +
            `${alpha(shade1, 0.68)} 24%, ` +
            `transparent 58%), ` +

            `radial-gradient(ellipse 32% 38% at 28% 18%, ` +
            `${alpha(shade2, 0.94)} 0%, ` +
            `${alpha(shade2, 0.62)} 26%, ` +
            `transparent 60%), ` +

            `radial-gradient(ellipse 36% 34% at 56% 8%, ` +
            `${alpha(glowColor, 0.90)} 0%, ` +
            `${alpha(glowColor, 0.54)} 28%, ` +
            `transparent 62%), ` +

            `radial-gradient(ellipse 34% 42% at 88% 14%, ` +
            `${alpha(highlight, 0.94)} 0%, ` +
            `${alpha(highlight, 0.58)} 26%, ` +
            `transparent 60%), ` +

            `radial-gradient(ellipse 34% 38% at 12% 72%, ` +
            `${alpha(shade3, 0.92)} 0%, ` +
            `${alpha(shade3, 0.58)} 27%, ` +
            `transparent 62%), ` +

            `radial-gradient(ellipse 38% 44% at 40% 86%, ` +
            `${alpha(shade4, 0.90)} 0%, ` +
            `${alpha(shade4, 0.54)} 28%, ` +
            `transparent 62%), ` +

            `radial-gradient(ellipse 32% 38% at 68% 68%, ` +
            `${alpha(highlight, 0.88)} 0%, ` +
            `${alpha(highlight, 0.48)} 26%, ` +
            `transparent 60%), ` +

            `radial-gradient(ellipse 36% 40% at 96% 86%, ` +
            `${alpha(shade2, 0.90)} 0%, ` +
            `${alpha(shade2, 0.52)} 28%, ` +
            `transparent 62%), ` +

            `radial-gradient(ellipse 26% 30% at 48% 46%, ` +
            `${alpha(glowColor, 0.72)} 0%, ` +
            `transparent 64%), ` +

            `linear-gradient(135deg, ` +
            `${mix(background, shade1, 0.06)} 0%, ` +
            `${mix(background, shade4, 0.14)} 48%, ` +
            `${mix(background, highlight, 0.10)} 100%)`;

        /*
         * Secondary floating cloud field.
         * Intentionally smaller than V2.1 so individual colour
         * clouds remain visible after blur.
         */

        const meshCloudGradient =
            `radial-gradient(ellipse 30% 34% at 12% 24%, ` +
            `${alpha(glowColor, 0.78)} 0%, ` +
            `${alpha(glowColor, 0.36)} 32%, ` +
            `transparent 66%), ` +

            `radial-gradient(ellipse 28% 36% at 38% 14%, ` +
            `${alpha(shade2, 0.74)} 0%, ` +
            `transparent 64%), ` +

            `radial-gradient(ellipse 32% 30% at 68% 28%, ` +
            `${alpha(highlight, 0.76)} 0%, ` +
            `${alpha(highlight, 0.30)} 30%, ` +
            `transparent 66%), ` +

            `radial-gradient(ellipse 30% 36% at 88% 70%, ` +
            `${alpha(shade3, 0.72)} 0%, ` +
            `transparent 64%), ` +

            `radial-gradient(ellipse 34% 30% at 26% 82%, ` +
            `${alpha(shade4, 0.68)} 0%, ` +
            `transparent 66%)`;

        const darkMeshGradient =
            `radial-gradient(ellipse 68% 60% at 8% 12%, ` +
            `${alpha(shade2, 0.68)} 0%, ` +
            `transparent 58%), ` +

            `radial-gradient(ellipse 58% 68% at 88% 18%, ` +
            `${alpha(highlight, 0.54)} 0%, ` +
            `transparent 62%), ` +

            `radial-gradient(ellipse 62% 52% at 52% 88%, ` +
            `${alpha(glowColor, 0.48)} 0%, ` +
            `transparent 64%), ` +

            `radial-gradient(ellipse 46% 58% at 42% 42%, ` +
            `${alpha(shade3, 0.36)} 0%, ` +
            `transparent 62%), ` +

            `linear-gradient(140deg, ` +
            `${shade1} 0%, ` +
            `${primary} 52%, ` +
            `${mix(shade1, shade2, 0.42)} 100%)`;

        /*
         * Keep V2 smoke aliases for existing storefront CSS.
         * This makes V2.1 backwards-compatible.
         */
        const smokeGradient =
            meshGradient;

        const darkSmokeGradient =
            darkMeshGradient;

        const variables = {
            /*
             * Theme Engine V2
             * Cinematic multi-shade palette
             */
            "--shade-1": shade1,
            "--shade-2": shade2,
            "--shade-3": shade3,
            "--shade-4": shade4,

            "--highlight": highlight,
            "--glow-color": glowColor,
            "--glow": glow,

            "--hero-gradient":
                heroGradient,

            "--deep-gradient":
                deepGradient,

            "--button-gradient":
                buttonGradient,

            "--promo-gradient":
                promoGradient,

            "--soft-gradient":
                softGradient,

            "--spectrum-gradient":
                spectrumGradient,

            "--mesh-gradient":
                meshGradient,

            "--mesh-cloud-gradient":
                meshCloudGradient,

            "--dark-mesh-gradient":
                darkMeshGradient,

            "--smoke-gradient":
                smokeGradient,

            "--dark-smoke-gradient":
                darkSmokeGradient,

            "--primary": theme.primary_color,
            "--secondary": theme.secondary_color,
            "--accent": theme.accent_color,
            "--background": theme.background_color,
            "--surface": theme.surface_color,
            "--text": theme.text_color,
            "--heading-color":
                theme.heading_color ||
                theme.text_color,
            "--link-color":
                theme.link_color ||
                theme.primary_color,
            "--muted":
                theme.muted_color ||
                theme.muted_text_color,

            "--cms-body-size":
                theme.body_font_size !== undefined
                    ? `${theme.body_font_size}px`
                    : null,
            "--cms-h1-size":
                theme.h1_size !== undefined
                    ? `${theme.h1_size}px`
                    : null,
            "--cms-h2-size":
                theme.h2_size !== undefined
                    ? `${theme.h2_size}px`
                    : null,
            "--cms-h3-size":
                theme.h3_size !== undefined
                    ? `${theme.h3_size}px`
                    : null,
            "--cms-nav-size":
                theme.nav_font_size !== undefined
                    ? `${theme.nav_font_size}px`
                    : null,
            "--cms-brand-size":
                theme.brand_font_size !== undefined
                    ? `${theme.brand_font_size}px`
                    : null,
            "--cms-tagline-size":
                theme.tagline_font_size !== undefined
                    ? `${theme.tagline_font_size}px`
                    : null,
            "--cms-product-name-size":
                theme.product_name_size !== undefined
                    ? `${theme.product_name_size}px`
                    : null,
            "--cms-product-price-size":
                theme.product_price_size !== undefined
                    ? `${theme.product_price_size}px`
                    : null,
            "--cms-button-size":
                theme.button_font_size !== undefined
                    ? `${theme.button_font_size}px`
                    : null,
            "--cms-footer-size":
                theme.footer_font_size !== undefined
                    ? `${theme.footer_font_size}px`
                    : null,
            "--radius":
                theme.border_radius !== undefined
                    ? `${theme.border_radius}px`
                    : null,
            "--button-radius":
                theme.button_radius !== undefined
                    ? `${theme.button_radius}px`
                    : null,
            "--heading":
                theme.heading_font
                    ? `"${theme.heading_font}", serif`
                    : null,
            "--body":
                theme.body_font
                    ? `"${theme.body_font}", sans-serif`
                    : null
        };

        Object.entries(
            variables
        ).forEach(
            ([key, value]) => {
                if (value) {
                    root.style.setProperty(
                        key,
                        value
                    );
                }
            }
        );

        let style =
            document.getElementById(
                "rukhnavCmsCustomCss"
            );

        if (!style) {
            style =
                document.createElement(
                    "style"
                );

            style.id =
                "rukhnavCmsCustomCss";

            document.head.appendChild(
                style
            );
        }

        style.textContent =
            settings.advanced
                ?.custom_css || "";
    },

    applyBranding(settings) {
        const branding =
            settings.branding || {};

        document
            .querySelectorAll(
                ".brand img, .footer-brand img"
            )
            .forEach(img => {
                if (
                    branding.logo_url
                ) {
                    img.src =
                        this.asset(
                            branding.logo_url
                        );
                }

                img.alt =
                    branding.brand_name ||
                    "RUKHNAV";
            });

        document
            .querySelectorAll(
                ".brand strong, .footer-brand > strong, .mobile-menu .top strong"
            )
            .forEach(element => {
                if (
                    branding.brand_name
                ) {
                    element.textContent =
                        branding.brand_name;
                }
            });

        if (
            branding.favicon_url
        ) {
            let icon =
                document.querySelector(
                    'link[rel="icon"]'
                );

            if (!icon) {
                icon =
                    document.createElement(
                        "link"
                    );

                icon.rel = "icon";

                document.head.appendChild(
                    icon
                );
            }

            icon.href =
                this.asset(
                    branding.favicon_url
                );
        }
    },

    applyHeader(settings) {
        const header =
            settings.header || {};

        const announcement =
            document.getElementById(
                "announcement"
            );

        if (announcement) {
            announcement.hidden =
                header
                    .announcement_enabled ===
                false;

            if (
                header.announcement_text
            ) {
                announcement.textContent =
                    header.announcement_text;
            }
        }

        const searchInput =
            document.getElementById(
                "searchInput"
            );

        if (
            searchInput &&
            header.search_placeholder
        ) {
            searchInput.placeholder =
                header.search_placeholder;
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

        const nav =
            document.querySelector(
                ".categories-nav > div"
            );

        if (
            nav &&
            navigation.length
        ) {
            nav.innerHTML =
                navigation
                    .map(
                        item => `
                            <a href="${this.escape(
                                item.url ||
                                "#"
                            )}">
                                ${this.escape(
                                    item.label ||
                                    "Link"
                                )}
                            </a>
                        `
                    )
                    .join("");
        }
    },

    applyHero(settings) {
        const home =
            settings.home || {};

        this.setVisible(
            ".hero",
            home.hero_enabled
        );

        this.setText(
            "#heroEyebrow",
            home.hero_eyebrow
        );

        this.setText(
            "#heroTitle",
            home.hero_title
        );

        this.setText(
            "#heroText",
            home.hero_text
        );

        const primary =
            document.querySelector(
                ".hero-actions .primary"
            );

        const secondary =
            document.querySelector(
                ".hero-actions .secondary"
            );

        if (primary) {
            if (
                home.hero_primary_label
            ) {
                primary.textContent =
                    home
                        .hero_primary_label;
            }

            if (
                home.hero_primary_url
            ) {
                primary.href =
                    home
                        .hero_primary_url;
            }
        }

        if (secondary) {
            if (
                home.hero_secondary_label
            ) {
                secondary.textContent =
                    home
                        .hero_secondary_label;
            }

            if (
                home.hero_secondary_url
            ) {
                secondary.href =
                    home
                        .hero_secondary_url;
            }
        }

        const trust =
            document.querySelector(
                ".trust"
            );

        const trustItems = [
            home.hero_trust_1,
            home.hero_trust_2,
            home.hero_trust_3
        ].filter(Boolean);

        if (
            trust &&
            trustItems.length
        ) {
            const icons = [
                "fa-leaf",
                "fa-truck-fast",
                "fa-shield-heart"
            ];

            trust.innerHTML =
                trustItems
                    .map(
                        (item, index) => `
                            <b>
                                <i class="fa-solid ${
                                    icons[index] ||
                                    "fa-circle-check"
                                }"></i>
                                ${this.escape(
                                    item
                                )}
                            </b>
                        `
                    )
                    .join("");
        }

        const heroArt =
            document.querySelector(
                ".hero-art"
            );

        const bottle =
            document.querySelector(
                ".hero-art .bottle"
            );

        if (
            heroArt &&
            home.hero_image_url
        ) {
            heroArt.innerHTML = `
                <img
                    class="cms-modern-hero-image"
                    src="${this.escape(
                        this.asset(
                            home.hero_image_url
                        )
                    )}"
                    alt="${this.escape(
                        home.hero_image_alt ||
                        home.hero_title ||
                        "RUKHNAV hero"
                    )}"
                >
            `;
        } else if (bottle) {
            const brand =
                settings.branding
                    ?.brand_name ||
                "RUKHNAV";

            const small =
                bottle.querySelector(
                    "small"
                );

            const strong =
                bottle.querySelector(
                    "strong"
                );

            if (small) {
                small.textContent =
                    brand;
            }

            if (
                strong &&
                home.hero_artwork_text
            ) {
                strong.textContent =
                    home
                        .hero_artwork_text;
            }
        }
    },

    applyBenefits(settings) {
        const home =
            settings.home || {};

        this.setVisible(
            ".benefits",
            home.benefits_enabled
        );

        document
            .querySelectorAll(
                ".benefits article"
            )
            .forEach(
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

                    const titleEl =
                        article.querySelector(
                            "b"
                        );

                    const textEl =
                        article.querySelector(
                            "span"
                        );

                    if (
                        titleEl &&
                        title
                    ) {
                        titleEl.textContent =
                            title;
                    }

                    if (
                        textEl &&
                        text
                    ) {
                        textEl.textContent =
                            text;
                    }
                }
            );
    },

    applyCategories(settings) {
        const home =
            settings.home || {};

        const section =
            document.querySelector(
                ".section:has(.categories)"
            );

        if (!section) {
            return;
        }

        section.hidden =
            home.categories_enabled ===
            false;

        this.setText(
            ".section:has(.categories) .section-head span",
            home.categories_eyebrow
        );

        this.setText(
            ".section:has(.categories) .section-head h2",
            home.categories_title
        );

        const viewAll =
            section.querySelector(
                ".section-head > a"
            );

        if (viewAll) {
            if (
                home
                    .categories_button_label
            ) {
                viewAll.innerHTML =
                    `${this.escape(
                        home
                            .categories_button_label
                    )} <i class="fa-solid fa-arrow-right"></i>`;
            }

            if (
                home
                    .categories_button_url
            ) {
                viewAll.href =
                    home
                        .categories_button_url;
            }
        }

        /*
         * Category content is sourced from the ERP categories table.
         *
         * Website Management still controls this section's
         * visibility, eyebrow, title and View All button.
         *
         * This prevents CMS category cards from becoming a
         * second, manually maintained category database.
         */

        if (
            window.Store &&
            typeof Store.renderHomepageCategories ===
                "function"
        ) {
            Store.renderHomepageCategories();
        }
    },

    applyFeatured(settings) {
        const home =
            settings.home || {};

        const section =
            document.querySelector(
                ".section:has(#homeProducts)"
            );

        if (!section) {
            return;
        }

        section.hidden =
            home.featured_enabled ===
            false;

        this.setText(
            ".section:has(#homeProducts) .section-head span",
            home.featured_eyebrow
        );

        this.setText(
            ".section:has(#homeProducts) .section-head h2",
            home.featured_title
        );

        const viewAll =
            section.querySelector(
                ".section-head > a"
            );

        if (viewAll) {
            if (
                home
                    .featured_button_label
            ) {
                viewAll.innerHTML =
                    `${this.escape(
                        home
                            .featured_button_label
                    )} <i class="fa-solid fa-arrow-right"></i>`;
            }

            if (
                home
                    .featured_button_url
            ) {
                viewAll.href =
                    home
                        .featured_button_url;
            }
        }
    },

    applyStory(settings) {
        const home =
            settings.home || {};

        this.setVisible(
            ".story",
            home.story_enabled
        );

        this.setText(
            ".story > div:first-child > span",
            home.story_eyebrow
        );

        this.setText(
            ".story h2",
            home.story_title
        );

        this.setText(
            ".story p",
            home.story_text
        );

        const button =
            document.querySelector(
                ".story .btn"
            );

        if (button) {
            if (
                home.story_button_label
            ) {
                button.textContent =
                    home
                        .story_button_label;
            }

            if (
                home.story_button_url
            ) {
                button.href =
                    home
                        .story_button_url;
            }
        }

        const points =
            document.querySelectorAll(
                ".story-points b"
            );

        points.forEach(
            (point, index) => {
                const value =
                    home[
                        `story_point_${index + 1}`
                    ];

                if (!value) {
                    return;
                }

                const icon =
                    point.querySelector(
                        "i"
                    );

                point.textContent =
                    "";

                if (icon) {
                    point.appendChild(
                        icon
                    );

                    point.append(
                        " "
                    );
                }

                point.append(
                    value
                );
            }
        );
    },

    applyNewsletter(settings) {
        const home =
            settings.home || {};

        this.setVisible(
            ".newsletter",
            home.newsletter_enabled
        );

        this.setText(
            ".newsletter > div > div > span",
            home.newsletter_eyebrow
        );

        this.setText(
            ".newsletter h2",
            home.newsletter_title
        );

        this.setText(
            ".newsletter p",
            home.newsletter_text
        );

        const input =
            document.getElementById(
                "newsletterEmail"
            );

        if (
            input &&
            home.newsletter_placeholder
        ) {
            input.placeholder =
                home
                    .newsletter_placeholder;
        }

        // Current storefront HTML does not require
        // a newsletterButton id, so target the form button.
        const button =
            document.querySelector(
                "#newsletterForm button"
            );

        if (
            button &&
            home.newsletter_button_label
        ) {
            button.textContent =
                home
                    .newsletter_button_label;
        }
    },

    applyFooter(settings) {
        const footer =
            settings.footer || {};

        const contact =
            settings.contact || {};

        this.setText(
            ".footer-brand p",
            footer.short_description
        );

        this.setText(
            ".footer-bottom span:first-child",
            footer.copyright_text
        );

        document
            .querySelectorAll(
                ".footer-col"
            )
            .forEach(column => {
                const heading =
                    column
                        .querySelector(
                            "h3"
                        )
                        ?.textContent
                        ?.trim()
                        .toLowerCase();

                if (
                    heading !==
                    "contact"
                ) {
                    return;
                }

                const email =
                    column.querySelector(
                        'a[href^="mailto:"]'
                    );

                if (
                    email &&
                    contact.support_email
                ) {
                    email.href =
                        `mailto:${contact.support_email}`;

                    email.textContent =
                        contact.support_email;
                }

                const whatsapp =
                    [
                        ...column
                            .querySelectorAll(
                                "a"
                            )
                    ].find(
                        link =>
                            link
                                .textContent
                                .trim()
                                .toLowerCase() ===
                            "whatsapp"
                    );

                if (
                    whatsapp &&
                    contact.whatsapp_number
                ) {
                    whatsapp.href =
                        `https://wa.me/${String(
                            contact.whatsapp_number
                        ).replace(
                            /\D/g,
                            ""
                        )}`;
                }
            });
    },

    applyContact(settings) {
        const contact =
            settings.contact || {};

        const email =
            document.getElementById(
                "contactEmail"
            );

        if (
            email &&
            contact.support_email
        ) {
            email.textContent =
                contact.support_email;

            email.href =
                `mailto:${contact.support_email}`;
        }

        const whatsapp =
            document.getElementById(
                "contactWhatsapp"
            );

        if (
            whatsapp &&
            contact.whatsapp_number
        ) {
            const number =
                String(
                    contact.whatsapp_number
                ).replace(/\D/g, "");

            whatsapp.textContent =
                contact.whatsapp_number;

            whatsapp.href =
                `https://wa.me/${number}`;
        }

        this.setText(
            "#contactServiceArea",
            contact.service_area
        );

        this.setText(
            "#contactHours",
            contact.business_hours
        );

        const form =
            document.getElementById(
                "contactForm"
            );

        if (form) {
            form.dataset.supportEmail =
                contact.support_email || "";
        }
    },

    applyContactPage(settings) {
        const page =
            settings.pages?.contact || {};

        const main =
            document.querySelector(
                "main.info-page"
            );

        if (
            main &&
            page.enabled === false
        ) {
            main.hidden = true;
            return;
        }

        this.setText(
            ".info-hero > div:first-child > span",
            page.eyebrow
        );

        this.setText(
            ".info-hero > div:first-child > h1",
            page.title
        );

        this.setText(
            ".info-hero > div:first-child > p",
            page.description
        );

        this.setText(
            ".contact-form > div:first-child > h2",
            page.form_title
        );

        const setLabel = (
            inputId,
            value
        ) => {
            if (!value) return;

            const input =
                document.getElementById(
                    inputId
                );

            const label =
                input?.closest("label");

            if (!label) return;

            const nodes =
                [...label.childNodes];

            const textNode =
                nodes.find(
                    node =>
                        node.nodeType ===
                        Node.TEXT_NODE
                );

            if (textNode) {
                textNode.textContent =
                    value;
            }
        };

        setLabel(
            "contactName",
            page.name_label
        );

        setLabel(
            "contactReplyEmail",
            page.email_label
        );

        setLabel(
            "contactSubject",
            page.subject_label
        );

        setLabel(
            "contactMessage",
            page.message_label
        );

        const button =
            document.querySelector(
                "#contactForm button[type='submit']"
            );

        if (
            button &&
            page.submit_text
        ) {
            button.textContent =
                page.submit_text;
        }

        const form =
            document.getElementById(
                "contactForm"
            );

        if (form) {
            form.dataset.successText =
                page.success_text || "";
        }
    },

    applyLegalPage(settings) {
        const legal =
            settings.pages?.legal || {};

        const path =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();

        const map = {
            "privacy-policy.html": {
                enabled: legal.privacy_enabled,
                title: legal.privacy_title,
                intro: legal.privacy_intro
            },
            "terms.html": {
                enabled: legal.terms_enabled,
                title: legal.terms_title,
                intro: legal.terms_intro
            },
            "refund-policy.html": {
                enabled: legal.refund_enabled,
                title: legal.refund_title,
                intro: legal.refund_intro
            },
            "shipping-policy.html": {
                enabled: legal.shipping_enabled,
                title: legal.shipping_title,
                intro: legal.shipping_intro
            },
            "faq.html": {
                enabled: legal.faq_enabled,
                title: legal.faq_title,
                intro: legal.faq_intro
            }
        };

        const page = map[path];

        if (!page) {
            return;
        }

        const main =
            document.querySelector(
                "main.legal-page"
            );

        if (
            main &&
            page.enabled === false
        ) {
            main.hidden = true;
            return;
        }

        this.setText(
            ".legal-hero h1",
            page.title
        );

        this.setText(
            ".legal-hero p",
            page.intro
        );

        const contact =
            settings.contact || {};

        document
            .querySelectorAll(
                ".legal-content p"
            )
            .forEach(paragraph => {
                let text =
                    paragraph.textContent || "";

                if (
                    contact.support_email
                ) {
                    text =
                        text.replace(
                            /naveedrp786@gmail\.com/gi,
                            contact.support_email
                        );
                }

                if (
                    contact.whatsapp_number
                ) {
                    text =
                        text.replace(
                            /\+923081201745/g,
                            contact.whatsapp_number
                        );
                }

                paragraph.textContent =
                    text;
            });
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
            !advanced
                .maintenance_mode
        ) {
            return;
        }

        document.body.innerHTML = `
            <main style="min-height:100vh;display:grid;place-items:center;padding:40px;text-align:center;background:var(--background)">
                <section>
                    <h1 style="font-family:var(--heading);font-size:52px;color:var(--primary)">
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

        this.applyTheme(
            settings
        );

        this.applyBranding(
            settings
        );

        this.applyHeader(
            settings
        );

        this.applyHero(
            settings
        );

        this.applyBenefits(
            settings
        );

        this.applyCategories(
            settings
        );

        this.applyFeatured(
            settings
        );

        this.applyStory(
            settings
        );

        this.applyNewsletter(
            settings
        );

        this.applyFooter(
            settings
        );

        this.applyContact(
            settings
        );

        this.applyContactPage(
            settings
        );

        this.applyLegalPage(
            settings
        );

        this.applySEO(
            settings
        );

        this.applyMaintenance(
            settings
        );
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

            this.apply(
                data.settings ||
                data
            );
        } catch (error) {
            console.warn(
                "Website Management settings are unavailable. The original modern storefront remains unchanged.",
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
            RukhnavModernCMS.apply(
                event.data.settings ||
                {}
            );
        }
    }
);

document.addEventListener(
    "DOMContentLoaded",
    () => {
        setTimeout(
            () =>
                RukhnavModernCMS.load(),
            120
        );
    }
);
