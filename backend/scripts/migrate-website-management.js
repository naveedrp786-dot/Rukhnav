"use strict";

require("dotenv").config();
const db = require("../config/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS website_settings (
                id INT PRIMARY KEY DEFAULT 1,
                settings_json LONGTEXT NOT NULL,
                published_json LONGTEXT NULL,
                status ENUM('Draft','Published') NOT NULL DEFAULT 'Draft',
                updated_by INT NULL,
                published_by INT NULL,
                published_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS website_media (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                media_type ENUM('Image','Logo','Favicon','Banner','Video') NOT NULL DEFAULT 'Image',
                file_name VARCHAR(255) NOT NULL,
                file_url VARCHAR(500) NOT NULL,
                alt_text VARCHAR(255) NULL,
                file_size BIGINT NULL,
                mime_type VARCHAR(120) NULL,
                uploaded_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                INDEX idx_website_media_type (media_type, created_at)
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS website_setting_history (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                settings_json LONGTEXT NOT NULL,
                action_type ENUM('Saved','Published','Restored') NOT NULL,
                created_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        const defaults = {
            branding: {
                brand_name: "RUKHNAV",
                tagline: "Natural Beauty, Thoughtfully Made",
                logo_url: "/store/logo.png",
                favicon_url: "/favicon.ico"
            },
            theme: {
                primary_color: "#17452f",
                secondary_color: "#d6a928",
                accent_color: "#f4ead2",
                background_color: "#f7f4ec",
                surface_color: "#ffffff",
                text_color: "#1f2a24",
                muted_color: "#6f776f",
                heading_font: "Playfair Display",
                body_font: "DM Sans",
                border_radius: 14,
                button_radius: 10
            },
            header: {
                announcement_enabled: true,
                announcement_text: "Free delivery on qualifying orders",
                announcement_link_text: "",
                announcement_link_url: "",
                search_placeholder: "Search RUKHNAV products",
                show_account: true,
                show_wishlist: true,
                show_cart: true
            },
            navigation: [
                {"label":"All Products","url":"products.html","enabled":true,"sort_order":1},
                {"label":"Hair Care","url":"products.html?category=Hair%20Care","enabled":true,"sort_order":2},
                {"label":"Skin Care","url":"products.html?category=Skin%20Care","enabled":true,"sort_order":3},
                {"label":"Herbal","url":"products.html?category=Herbal","enabled":true,"sort_order":4},
                {"label":"New Arrivals","url":"products.html?sort=newest","enabled":true,"sort_order":5},
                {"label":"Rewards","url":"account.html#rewards","enabled":true,"sort_order":6},
                {"label":"Help","url":"contact.html","enabled":true,"sort_order":7}
            ],
            home: {
                hero_enabled: true,
                hero_eyebrow: "Herbal Beauty & Care",
                hero_title: "Nature-inspired care for your everyday beauty.",
                hero_text: "Discover thoughtfully selected hair care, skin care and herbal products from RUKHNAV.",
                hero_primary_label: "Shop Now",
                hero_primary_url: "products.html",
                hero_secondary_label: "Explore Hair Care",
                hero_secondary_url: "products.html?category=Hair%20Care",
                hero_image_url: "",
                hero_image_alt: "RUKHNAV herbal beauty products",
                hero_artwork_text: "Nature-led beauty",
                hero_trust_1: "Herbal care",
                hero_trust_2: "Pakistan delivery",
                hero_trust_3: "Quality checked",

                benefits_enabled: true,
                benefit_1_title: "Nationwide delivery",
                benefit_1_text: "Across Pakistan",
                benefit_2_title: "Flexible payments",
                benefit_2_text: "COD, EasyPaisa & more",
                benefit_3_title: "Loyalty rewards",
                benefit_3_text: "Earn and redeem points",
                benefit_4_title: "Customer support",
                benefit_4_text: "We're here to help",

                categories_enabled: true,
                categories_eyebrow: "Shop by need",
                categories_title: "Popular categories",
                categories_button_label: "View all",
                categories_button_url: "products.html",
                category_cards: [
                    {
                        title: "Hair Care",
                        text: "Shampoo, oils and treatments",
                        url: "products.html?category=Hair%20Care",
                        image_url: "",
                        icon: "fa-wand-magic-sparkles",
                        enabled: true
                    },
                    {
                        title: "Skin Care",
                        text: "Face wash, creams and essentials",
                        url: "products.html?category=Skin%20Care",
                        image_url: "",
                        icon: "fa-droplet",
                        enabled: true
                    },
                    {
                        title: "Herbal Collection",
                        text: "Nature-inspired everyday care",
                        url: "products.html?category=Herbal",
                        image_url: "",
                        icon: "fa-leaf",
                        enabled: true
                    },
                    {
                        title: "New Arrivals",
                        text: "Explore the latest products",
                        url: "products.html?sort=newest",
                        image_url: "",
                        icon: "fa-sparkles",
                        enabled: true
                    }
                ],

                featured_enabled: true,
                featured_eyebrow: "Customer favourites",
                featured_title: "Featured products",
                featured_button_label: "Shop all",
                featured_button_url: "products.html",
                featured_product_limit: 10,
                products_loading_text: "Loading products",
                products_empty_title: "Products are coming soon",
                products_empty_text: "",

                story_enabled: true,
                story_eyebrow: "Why RUKHNAV",
                story_title: "Carefully selected products for everyday beauty",
                story_text: "Quality-checked cosmetics and hair-care products with a shopping experience you can trust.",
                story_button_label: "Discover our story",
                story_button_url: "about.html",
                story_point_1: "Nature inspired",
                story_point_2: "Quality focused",
                story_point_3: "Customer first",

                newsletter_enabled: true,
                newsletter_eyebrow: "Stay connected",
                newsletter_title: "Beauty tips, new arrivals and special offers",
                newsletter_text: "Join the RUKHNAV community and be the first to know.",
                newsletter_placeholder: "Enter your email",
                newsletter_button_label: "Subscribe",
                newsletter_success_message: "Thank you for subscribing."
            },
            promo_banners: [
                {
                    "title":"Free delivery",
                    "text":"Available on qualifying orders.",
                    "image_url":"",
                    "button_label":"Shop Now",
                    "button_url":"products.html",
                    "enabled":true,
                    "sort_order":1
                }
            ],
            contact: {
                support_email: "naveedrp786@gmail.com",
                support_phone: "+923081201745",
                whatsapp_number: "+923081201745",
                address: "",
                city: "",
                service_area: "Delivery across Pakistan",
                business_hours: "Monday–Saturday, 9:00 AM–6:00 PM"
            },
            social: {
                facebook_url: "",
                instagram_url: "",
                youtube_url: "",
                tiktok_url: "",
                x_url: ""
            },
            footer: {
                short_description: "Natural cosmetics and hair-care products crafted with care.",
                copyright_text: "© RUKHNAV. All rights reserved.",
                show_payment_methods: true,
                show_social_links: true,
                show_newsletter: true
            },
            payments: {
                cash_on_delivery_enabled: true,
                bank_transfer_enabled: true,
                easypaisa_enabled: true,
                jazzcash_enabled: true,
                payment_message: "Secure and convenient payment options."
            },
            delivery: {
                free_delivery_enabled: true,
                free_delivery_minimum: 3000,
                standard_delivery_charge: 250,
                delivery_message: "Delivery across Pakistan.",
                return_message: "Easy returns subject to policy."
            },
            seo: {
                site_title: "RUKHNAV | Herbal Beauty & Care",
                site_description: "Premium herbal hair care, skin care and beauty products by RUKHNAV.",
                keywords: "RUKHNAV, herbal beauty, hair care, skin care, cosmetics",
                og_image_url: ""
            },
            advanced: {
                maintenance_mode: false,
                maintenance_message: "We are improving the store. Please check back soon.",
                custom_css: "",
                custom_head_html: "",
                custom_footer_html: ""
            }
        }

        payload = json.dumps(defaults, ensure_ascii=false)
        await db.query(
            `
            INSERT INTO website_settings
                (id, settings_json, published_json, status)
            VALUES
                (1, ?, ?, 'Published')
            ON DUPLICATE KEY UPDATE
                id = id
            `,
            [payload, payload]
        )

        console.log("Website Management CMS migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Website Management CMS migration failed:", error);
        process.exit(1);
    }
}

run();
