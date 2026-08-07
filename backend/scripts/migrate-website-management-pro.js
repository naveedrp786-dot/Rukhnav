"use strict";

require("dotenv").config();
const db = require("../config/db");

const defaults = {"branding": {"brand_name": "RUKHNAV", "tagline": "Natural Beauty, Thoughtfully Made", "logo_url": "", "favicon_url": ""}, "theme": {"primary_color": "#17452f", "secondary_color": "#d6a928", "accent_color": "#f4ead2", "background_color": "#f7f4ec", "surface_color": "#ffffff", "text_color": "#1f2a24", "muted_color": "#6f776f", "heading_font": "Playfair Display", "body_font": "DM Sans", "border_radius": 14, "button_radius": 10}, "header": {"announcement_enabled": true, "announcement_text": "Free delivery on qualifying orders", "search_placeholder": "Search RUKHNAV products", "show_account": true, "show_wishlist": true, "show_cart": true}, "navigation": [{"label": "All Products", "url": "products.html", "enabled": true, "sort_order": 1}, {"label": "Hair Care", "url": "products.html?category=Hair%20Care", "enabled": true, "sort_order": 2}, {"label": "Skin Care", "url": "products.html?category=Skin%20Care", "enabled": true, "sort_order": 3}, {"label": "Herbal", "url": "products.html?category=Herbal", "enabled": true, "sort_order": 4}, {"label": "New Arrivals", "url": "products.html?sort=newest", "enabled": true, "sort_order": 5}, {"label": "Rewards", "url": "rewards.html", "enabled": true, "sort_order": 6}, {"label": "Help", "url": "contact.html", "enabled": true, "sort_order": 7}], "home": {"hero_enabled": true, "hero_eyebrow": "Herbal Beauty & Care", "hero_title": "Nature-inspired care for your everyday beauty.", "hero_text": "Discover thoughtfully selected hair care, skin care and herbal products from RUKHNAV.", "hero_primary_label": "Shop Now", "hero_primary_url": "products.html", "hero_secondary_label": "Explore Hair Care", "hero_secondary_url": "products.html?category=Hair%20Care", "hero_image_url": "", "hero_image_alt": "RUKHNAV beauty collection", "hero_artwork_text": "Nature-led beauty", "hero_trust_1": "Herbal care", "hero_trust_2": "Pakistan delivery", "hero_trust_3": "Quality checked", "benefits_enabled": true, "benefit_1_title": "Nationwide delivery", "benefit_1_text": "Across Pakistan", "benefit_2_title": "Flexible payments", "benefit_2_text": "COD, EasyPaisa & more", "benefit_3_title": "Loyalty rewards", "benefit_3_text": "Earn and redeem points", "benefit_4_title": "Customer support", "benefit_4_text": "We're here to help", "categories_enabled": true, "categories_eyebrow": "Shop by need", "categories_title": "Popular categories", "categories_button_label": "View all", "categories_button_url": "products.html", "category_cards": [], "featured_enabled": true, "featured_eyebrow": "Customer favourites", "featured_title": "Featured products", "featured_button_label": "Shop all", "featured_button_url": "products.html", "story_enabled": true, "story_eyebrow": "Why RUKHNAV", "story_title": "Carefully selected products for everyday beauty", "story_text": "Quality-checked cosmetics and hair-care products with a shopping experience you can trust.", "story_button_label": "Discover our story", "story_button_url": "about.html", "story_point_1": "Nature inspired", "story_point_2": "Quality focused", "story_point_3": "Customer first", "newsletter_enabled": true, "newsletter_eyebrow": "Stay connected", "newsletter_title": "Beauty tips, new arrivals and special offers", "newsletter_text": "Join the RUKHNAV community and be the first to know.", "newsletter_placeholder": "Enter your email", "newsletter_button_label": "Subscribe"}, "contact": {"support_email": "naveedrp786@gmail.com", "support_phone": "+923081201745", "whatsapp_number": "+923081201745", "address": "", "city": "", "service_area": "Delivery across Pakistan", "business_hours": "Monday–Saturday, 9:00 AM–6:00 PM"}, "social": {"facebook_url": "", "instagram_url": "", "youtube_url": "", "tiktok_url": "", "x_url": ""}, "footer": {"short_description": "Natural cosmetics and hair-care products crafted with care.", "copyright_text": "© RUKHNAV. All rights reserved.", "show_payment_methods": true, "show_social_links": true, "show_newsletter": true}, "payments": {"cash_on_delivery_enabled": true, "bank_transfer_enabled": true, "easypaisa_enabled": true, "jazzcash_enabled": true, "payment_message": "Secure and convenient payment options."}, "delivery": {"free_delivery_enabled": true, "free_delivery_minimum": 3000, "standard_delivery_charge": 250, "delivery_message": "Delivery across Pakistan.", "return_message": "Easy returns subject to policy."}, "seo": {"site_title": "RUKHNAV | Herbal Beauty & Care", "site_description": "Premium herbal hair care, skin care and beauty products by RUKHNAV.", "keywords": "RUKHNAV, herbal beauty, hair care, skin care, cosmetics", "og_image_url": ""}, "advanced": {"maintenance_mode": false, "maintenance_message": "We are improving the store. Please check back soon.", "custom_css": ""}, "pages": {"products": {"enabled": true, "eyebrow": "Shop RUKHNAV", "title": "All Products", "description": "Explore herbal hair care, skin care and beauty products.", "search_placeholder": "Search products", "category_filter_enabled": true, "sort_enabled": true, "default_sort": "featured", "products_per_page": 24, "grid_columns_desktop": 4, "empty_title": "No products found", "empty_text": "Try a different search or category.", "view_button_text": "View Product", "add_to_cart_text": "Add to Cart", "out_of_stock_text": "Out of Stock", "sale_badge_text": "Sale", "new_badge_text": "New"}, "product_detail": {"enabled": true, "breadcrumb_home": "Home", "breadcrumb_products": "Products", "add_to_cart_text": "Add to Cart", "buy_now_text": "Buy Now", "wishlist_text": "Add to Wishlist", "in_stock_text": "In Stock", "out_of_stock_text": "Out of Stock", "low_stock_text": "Low Stock", "description_tab": "Description", "ingredients_tab": "Ingredients", "directions_tab": "Directions", "warnings_tab": "Warnings", "shipping_tab": "Shipping & Returns", "reviews_tab": "Reviews & Photos", "reviews_enabled": true, "reviews_eyebrow": "Verified Customer Experience", "reviews_title": "Customer Reviews & Photos", "reviews_description": "Read approved comments and customer photographs.", "write_review_text": "Write a Review", "verified_purchase_text": "Verified Purchase", "related_enabled": true, "related_title": "Related Products", "popular_enabled": true, "popular_title": "Popular Products", "recent_enabled": true, "recent_title": "Recently Viewed", "new_arrivals_enabled": true, "new_arrivals_title": "New Arrivals"}, "cart": {"enabled": true, "eyebrow": "Your Basket", "title": "Shopping Cart", "description": "Review your items before checkout.", "empty_title": "Your cart is empty", "empty_text": "Add products to your cart before continuing.", "continue_shopping_text": "Continue Shopping", "checkout_button_text": "Proceed to Checkout", "order_summary_title": "Order Summary", "subtotal_label": "Products subtotal", "delivery_label": "Delivery", "delivery_value_text": "Calculated at checkout", "discount_label": "Discount", "discount_value_text": "Apply coupon at checkout", "total_label": "Cart Total", "security_note": "Stock and prices will be verified again before your order is placed.", "payment_note_title": "Available payment options"}, "checkout": {"enabled": true, "eyebrow": "Secure Order Processing", "title": "Complete Your Order", "description": "Confirm delivery information and payment method.", "delivery_section_title": "Delivery Information", "payment_section_title": "Payment Method", "summary_title": "Order Summary", "full_name_label": "Full Name", "phone_label": "Phone Number", "email_label": "Email Address", "address_label": "Delivery Address", "city_label": "City", "postal_code_label": "Postal Code", "notes_label": "Order Notes", "place_order_text": "Place Order", "return_to_cart_text": "Return to Cart", "auth_required_title": "Sign in required", "auth_required_text": "Please sign in before checkout.", "empty_title": "Your cart is empty", "empty_text": "Add products before continuing to checkout.", "cod_title": "Cash on Delivery", "bank_transfer_title": "Bank Transfer", "easypaisa_title": "EasyPaisa", "jazzcash_title": "JazzCash", "terms_text": "By placing your order, you agree to our terms and privacy policy."}, "account": {"enabled": true, "eyebrow": "Customer Centre", "title": "My Account", "description": "Manage your profile, preferences and account activity.", "login_title": "Sign In", "login_text": "Access your orders, rewards and saved information.", "register_title": "Create Account", "register_text": "Join RUKHNAV and enjoy a personalized shopping experience.", "forgot_password_text": "Forgot Password?", "profile_title": "Profile", "preferences_title": "Preferences", "security_title": "Security", "delete_account_title": "Delete Account", "verification_title": "Verify Your Account", "logout_text": "Sign Out", "orders_enabled": true, "rewards_enabled": true, "events_enabled": true, "reviews_enabled": true}, "orders": {"enabled": true, "eyebrow": "Order History", "title": "My Orders", "description": "Track, review and manage your orders.", "empty_title": "No orders found", "empty_text": "Your completed purchases will appear here.", "view_details_text": "View Details", "cancel_text": "Cancel Order", "reorder_text": "Reorder", "review_text": "Review Products", "tracking_title": "Order Tracking", "payment_title": "Payment Information", "delivery_title": "Delivery Information", "items_title": "Order Items", "summary_title": "Order Summary", "invoice_text": "Download Invoice", "status_pending": "Pending", "status_confirmed": "Confirmed", "status_processing": "Processing", "status_packed": "Packed", "status_shipped": "Shipped", "status_delivered": "Delivered", "status_cancelled": "Cancelled"}, "wishlist": {"enabled": true, "eyebrow": "Saved Products", "title": "My Wishlist", "description": "Keep your favourite products in one place.", "empty_title": "Your wishlist is empty", "empty_text": "Save products you would like to revisit.", "browse_products_text": "Browse Products", "add_to_cart_text": "Add to Cart", "remove_text": "Remove"}, "rewards": {"enabled": true, "eyebrow": "RUKHNAV Rewards", "title": "Loyalty & Rewards", "description": "Earn points and enjoy membership benefits.", "available_points_label": "Available Points", "lifetime_points_label": "Lifetime Points", "membership_label": "Membership Level", "benefits_title": "Your Benefits", "history_title": "Points History", "empty_history_text": "No reward transactions yet."}, "events": {"enabled": true, "eyebrow": "Special Occasions", "title": "My Events", "description": "Save birthdays, anniversaries and important occasions.", "add_event_text": "Add Event", "empty_title": "No events saved", "empty_text": "Add an event to receive reminders.", "email_reminder_text": "Email Reminder", "whatsapp_reminder_text": "WhatsApp Reminder", "sms_reminder_text": "SMS Reminder"}, "reviews": {"enabled": true, "eyebrow": "Customer Stories", "title": "My Reviews", "description": "Manage reviews submitted for delivered products.", "eligible_title": "Products Available for Review", "submitted_title": "Submitted Reviews", "empty_eligible_text": "No delivered products are waiting for review.", "empty_submitted_text": "You have not submitted any reviews yet.", "submit_text": "Submit Review", "edit_text": "Edit Review", "delete_text": "Delete Review"}, "about": {"enabled": true, "eyebrow": "About RUKHNAV", "title": "Beauty inspired by nature and built around trust.", "description": "RUKHNAV brings together thoughtfully selected cosmetics, herbal care and hair-care products.", "mission_title": "Our Purpose", "mission_text": "To make premium personal care easier to discover and trust.", "button_text": "Explore Products", "button_url": "products.html"}, "contact": {"enabled": true, "eyebrow": "Customer Care", "title": "We are here to help.", "description": "Contact RUKHNAV for product, order, delivery or account support.", "form_title": "How can we help?", "name_label": "Full Name", "email_label": "Email Address", "subject_label": "Subject", "message_label": "Message", "submit_text": "Send Message", "success_text": "Your message has been prepared."}, "legal": {"privacy_enabled": true, "privacy_title": "Privacy Policy", "privacy_intro": "Learn how RUKHNAV handles customer information.", "terms_enabled": true, "terms_title": "Terms & Conditions", "terms_intro": "Review the terms that apply to use of the RUKHNAV store.", "refund_enabled": true, "refund_title": "Refund Policy", "refund_intro": "Review eligibility and conditions for returns and refunds.", "shipping_enabled": true, "shipping_title": "Shipping Policy", "shipping_intro": "Learn about delivery times, charges and service areas.", "faq_enabled": true, "faq_title": "Frequently Asked Questions", "faq_intro": "Find answers to common questions."}}};

function isPlainObject(value) {
    return (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function deepMerge(defaultValue, existingValue) {
    if (Array.isArray(defaultValue)) {
        return Array.isArray(existingValue) && existingValue.length
            ? existingValue
            : defaultValue;
    }

    if (isPlainObject(defaultValue)) {
        const output = {};
        const existing =
            isPlainObject(existingValue)
                ? existingValue
                : {};

        for (const key of Object.keys(defaultValue)) {
            output[key] =
                deepMerge(
                    defaultValue[key],
                    existing[key]
                );
        }

        for (const key of Object.keys(existing)) {
            if (!(key in output)) {
                output[key] = existing[key];
            }
        }

        return output;
    }

    return (
        existingValue !== undefined &&
        existingValue !== null &&
        existingValue !== ""
    )
        ? existingValue
        : defaultValue;
}

function parseJson(value) {
    if (!value) return {};

    try {
        return typeof value === "string"
            ? JSON.parse(value)
            : value;
    } catch {
        return {};
    }
}

async function columnExists(connection, column) {
    const [rows] =
        await connection.query(
            `
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'website_settings'
              AND COLUMN_NAME = ?
            LIMIT 1
            `,
            [column]
        );

    return rows.length > 0;
}

async function ensureColumn(
    connection,
    column,
    definition
) {
    if (
        await columnExists(
            connection,
            column
        )
    ) {
        return;
    }

    await connection.query(
        `
        ALTER TABLE website_settings
        ADD COLUMN ${column} ${definition}
        `
    );

    console.log(
        `Added website_settings.${column}`
    );
}

async function run() {
    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS website_settings (
                id INT PRIMARY KEY DEFAULT 1,
                settings_json LONGTEXT NULL,
                published_json LONGTEXT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'Published',
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

        await ensureColumn(
            connection,
            "settings_json",
            "LONGTEXT NULL"
        );

        await ensureColumn(
            connection,
            "published_json",
            "LONGTEXT NULL"
        );

        await ensureColumn(
            connection,
            "status",
            "VARCHAR(30) NOT NULL DEFAULT 'Published'"
        );

        await ensureColumn(
            connection,
            "updated_by",
            "INT NULL"
        );

        await ensureColumn(
            connection,
            "published_by",
            "INT NULL"
        );

        await ensureColumn(
            connection,
            "published_at",
            "DATETIME NULL"
        );

        await ensureColumn(
            connection,
            "created_at",
            "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
        );

        await ensureColumn(
            connection,
            "updated_at",
            "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        );

        await connection.query(`
            CREATE TABLE IF NOT EXISTS website_media (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                media_type VARCHAR(30) NOT NULL DEFAULT 'Image',
                file_name VARCHAR(255) NOT NULL,
                file_url VARCHAR(500) NOT NULL,
                alt_text VARCHAR(255) NULL,
                file_size BIGINT NULL,
                mime_type VARCHAR(120) NULL,
                uploaded_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_website_media_type (
                    media_type,
                    created_at
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS website_setting_history (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                settings_json LONGTEXT NOT NULL,
                action_type VARCHAR(30) NOT NULL,
                created_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        const [[row]] =
            await connection.query(
                `
                SELECT
                    id,
                    settings_json,
                    published_json
                FROM website_settings
                WHERE id = 1
                LIMIT 1
                `
            );

        const defaultPayload =
            JSON.stringify(defaults);

        if (!row) {
            await connection.query(
                `
                INSERT INTO website_settings
                (
                    id,
                    settings_json,
                    published_json,
                    status,
                    published_at
                )
                VALUES
                (
                    1,
                    ?,
                    ?,
                    'Published',
                    CURRENT_TIMESTAMP
                )
                `,
                [
                    defaultPayload,
                    defaultPayload
                ]
            );

            console.log(
                "Created Website Management defaults."
            );
        } else {
            const currentSettings =
                parseJson(
                    row.settings_json ||
                    row.published_json
                );

            const currentPublished =
                parseJson(
                    row.published_json ||
                    row.settings_json
                );

            const mergedSettings =
                deepMerge(
                    defaults,
                    currentSettings
                );

            const mergedPublished =
                deepMerge(
                    defaults,
                    currentPublished
                );

            await connection.query(
                `
                UPDATE website_settings
                SET
                    settings_json = ?,
                    published_json = ?,
                    status =
                        COALESCE(
                            NULLIF(status, ''),
                            'Published'
                        ),
                    published_at =
                        COALESCE(
                            published_at,
                            CURRENT_TIMESTAMP
                        )
                WHERE id = 1
                `,
                [
                    JSON.stringify(
                        mergedSettings
                    ),
                    JSON.stringify(
                        mergedPublished
                    )
                ]
            );

            console.log(
                "Merged missing Website Management defaults without overwriting existing values."
            );
        }

        await connection.commit();

        console.log(
            "Website Management Pro all-page settings are ready."
        );

        console.log(
            `Initialized page groups: ${Object.keys(defaults.pages || {}).join(", ")}`
        );

        process.exit(0);
    } catch (error) {
        await connection.rollback();

        console.error(
            "Website Management defaults migration failed:",
            error
        );

        process.exit(1);
    } finally {
        connection.release();
    }
}

run();
