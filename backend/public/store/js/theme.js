"use strict";

window.Theme = {
    settings: {},

    defaults: {
        branding: {
            brand_name: "RUKHNAV",
            tagline:
                "Natural Beauty, Thoughtfully Made",
            logo_url: "",
            favicon_url: ""
        },

        theme: {
            primary_color: "#17452f",
            secondary_color: "#d6a928",
            accent_color: "#f4ead2",
            background_color: "#f7f4ec",
            surface_color: "#ffffff",
            text_color: "#1f2a24",
            muted_text_color: "#6f776f",
            border_radius: 14
        },

        store: {
            currency_symbol: "Rs.",
            products_per_page: 24,
            default_sort: "featured"
        },

        header: {
            announcement_enabled: true,
            announcement_text:
                "Free delivery on qualifying orders",
            search_placeholder:
                "Search RUKHNAV products",
            show_account: true,
            show_wishlist: true,
            show_cart: true
        },

        navigation: [
            {
                label: "All products",
                url: "products.html",
                enabled: true,
                sort_order: 1
            },
            {
                label: "Hair Care",
                url:
                    "products.html?category=Hair%20Care",
                enabled: true,
                sort_order: 2
            },
            {
                label: "Skin Care",
                url:
                    "products.html?category=Skin%20Care",
                enabled: true,
                sort_order: 3
            },
            {
                label: "Herbal",
                url:
                    "products.html?category=Herbal",
                enabled: true,
                sort_order: 4
            },
            {
                label: "New Arrivals",
                url:
                    "products.html?sort=newest",
                enabled: true,
                sort_order: 5
            },
            {
                label: "Rewards",
                url: "rewards.html",
                enabled: true,
                sort_order: 6
            },
            {
                label: "Help",
                url: "contact.html",
                enabled: true,
                sort_order: 7
            }
        ],

        footer: {
            short_description:
                "Natural cosmetics and hair-care products crafted with care.",
            copyright_text:
                "© RUKHNAV. All rights reserved.",
            show_payment_methods: true,
            show_social_links: true
        },

        contact: {
            support_email:
                "naveedrp786@gmail.com",
            whatsapp_number:
                "+923081201745",
            service_area:
                "Delivery across Pakistan"
        },

        payments: {
            cash_on_delivery_enabled: true,
            easypaisa_enabled: true,
            jazzcash_enabled: true
        },

        seo: {
            site_title:
                "RUKHNAV | Herbal Beauty & Care"
        }
    },

    merge(base, override) {
        if (
            !override ||
            typeof override !== "object"
        ) {
            return structuredClone
                ? structuredClone(base)
                : JSON.parse(
                    JSON.stringify(base)
                );
        }

        const output =
            Array.isArray(base)
                ? [...base]
                : {...base};

        Object.entries(override)
            .forEach(([key, value]) => {
                if (
                    value &&
                    typeof value === "object" &&
                    !Array.isArray(value) &&
                    output[key] &&
                    typeof output[key] === "object" &&
                    !Array.isArray(output[key])
                ) {
                    output[key] =
                        this.merge(
                            output[key],
                            value
                        );
                } else {
                    output[key] =
                        value;
                }
            });

        return output;
    },

    asset(value = "") {
        if (!value) return "";

        if (
            /^(https?:)?\/\//i.test(value) ||
            value.startsWith("data:")
        ) {
            return value;
        }

        return value.startsWith("/")
            ? `${API.base}${value}`
            : `${API.base}/${value}`;
    },

    async load() {
        let loaded = {};

        try {
            const data =
                await API.get(
                    API.settings
                );

            loaded =
                data.settings ||
                data ||
                {};
        } catch (error) {
            console.warn(
                "Website settings unavailable; safe storefront defaults are being used.",
                error
            );
        }

        this.settings =
            this.merge(
                this.defaults,
                loaded
            );

        this.apply();

        return this.settings;
    },

    apply() {
        const theme =
            this.settings.theme ||
            {};

        const branding =
            this.settings.branding ||
            {};

        const seo =
            this.settings.seo ||
            {};

        const root =
            document.documentElement;

        const values = {
            "--primary":
                theme.primary_color,

            "--secondary":
                theme.secondary_color,

            "--accent":
                theme.accent_color,

            "--bg":
                theme.background_color,

            "--surface":
                theme.surface_color,

            "--text":
                theme.text_color,

            "--muted":
                theme.muted_color ||
                theme.muted_text_color,

            "--radius":
                theme.border_radius !==
                    undefined
                    ? `${Number(
                        theme.border_radius
                    )}px`
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

        document.title =
            seo.site_title ||
            branding.brand_name ||
            document.title;
    }
};
