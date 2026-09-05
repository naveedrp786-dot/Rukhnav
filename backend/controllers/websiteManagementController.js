"use strict";

const db = require("../config/db");

const defaults = {"branding": {"brand_name": "RUKHNAV", "tagline": "Natural Beauty, Thoughtfully Made", "logo_url": "", "favicon_url": ""}, "theme": {"primary_color": "#17452f", "secondary_color": "#d6a928", "accent_color": "#f4ead2", "background_color": "#f7f4ec", "surface_color": "#ffffff", "text_color": "#1f2a24", "heading_color": "#1f2a24", "muted_color": "#6f776f", "link_color": "#17452f", "heading_font": "Playfair Display", "body_font": "DM Sans", "body_font_size": 14, "h1_size": 72, "h2_size": 42, "h3_size": 24, "nav_font_size": 12, "brand_font_size": 26, "tagline_font_size": 9, "product_name_size": 14, "product_price_size": 16, "button_font_size": 12, "footer_font_size": 11, "border_radius": 14, "button_radius": 10, "shade_1": "#17452f", "shade_2": "#246b4a", "shade_3": "#d6a928", "shade_4": "#f4ead2", "highlight_color": "#f0c84b", "glow_color": "#d6a928"}, "header": {"announcement_enabled": true, "announcement_text": "Free delivery on qualifying orders", "search_placeholder": "Search RUKHNAV products", "show_account": true, "show_wishlist": true, "show_cart": true}, "navigation": [{"label": "All Products", "url": "products.html", "enabled": true, "sort_order": 1}, {"label": "Hair Care", "url": "products.html?category=Hair%20Care", "enabled": true, "sort_order": 2}, {"label": "Skin Care", "url": "products.html?category=Skin%20Care", "enabled": true, "sort_order": 3}, {"label": "Herbal", "url": "products.html?category=Herbal", "enabled": true, "sort_order": 4}, {"label": "New Arrivals", "url": "products.html?sort=newest", "enabled": true, "sort_order": 5}, {"label": "Rewards", "url": "rewards.html", "enabled": true, "sort_order": 6}, {"label": "Returns", "url": "returns.html", "enabled": true, "sort_order": 7}, {"label": "Help", "url": "contact.html", "enabled": true, "sort_order": 8}], "home": {"hero_enabled": true, "hero_eyebrow": "Herbal Beauty & Care", "hero_title": "Nature-inspired care for your everyday beauty.", "hero_text": "Discover thoughtfully selected hair care, skin care and herbal products from RUKHNAV.", "hero_primary_label": "Shop Now", "hero_primary_url": "products.html", "hero_secondary_label": "Explore Hair Care", "hero_secondary_url": "products.html?category=Hair%20Care", "hero_image_url": "", "hero_image_alt": "RUKHNAV beauty collection", "hero_artwork_text": "Nature-led beauty", "hero_trust_1": "Herbal care", "hero_trust_2": "Pakistan delivery", "hero_trust_3": "Quality checked", "benefits_enabled": true, "benefit_1_title": "Nationwide delivery", "benefit_1_text": "Across Pakistan", "benefit_2_title": "Flexible payments", "benefit_2_text": "COD, EasyPaisa & more", "benefit_3_title": "Loyalty rewards", "benefit_3_text": "Earn and redeem points", "benefit_4_title": "Customer support", "benefit_4_text": "We're here to help", "categories_enabled": true, "categories_eyebrow": "Shop by need", "categories_title": "Popular categories", "categories_button_label": "View all", "categories_button_url": "products.html", "category_cards": [
    {
        "title": "Hair Care",
        "text": "Shampoo, oils and treatments",
        "url": "products.html?category=Hair%20Care",
        "image_url": "",
        "icon": "fa-droplet",
        "enabled": true
    },
    {
        "title": "Skin Care",
        "text": "Face wash, creams and essentials",
        "url": "products.html?category=Skin%20Care",
        "image_url": "",
        "icon": "fa-spa",
        "enabled": true
    },
    {
        "title": "Herbal Collection",
        "text": "Nature-inspired everyday care",
        "url": "products.html?category=Herbal",
        "image_url": "",
        "icon": "fa-leaf",
        "enabled": true
    },
    {
        "title": "New Arrivals",
        "text": "Explore the latest products",
        "url": "products.html?sort=newest",
        "image_url": "",
        "icon": "fa-sparkles",
        "enabled": true
    }
], "featured_enabled": true, "featured_eyebrow": "Customer favourites", "featured_title": "Featured products", "featured_button_label": "Shop all", "featured_button_url": "products.html", "story_enabled": true, "story_eyebrow": "Why RUKHNAV", "story_title": "Carefully selected products for everyday beauty", "story_text": "Quality-checked cosmetics and hair-care products with a shopping experience you can trust.", "story_button_label": "Discover our story", "story_button_url": "about.html", "story_point_1": "Nature inspired", "story_point_2": "Quality focused", "story_point_3": "Customer first", "newsletter_enabled": true, "newsletter_eyebrow": "Stay connected", "newsletter_title": "Beauty tips, new arrivals and special offers", "newsletter_text": "Join the RUKHNAV community and be the first to know.", "newsletter_placeholder": "Enter your email", "newsletter_button_label": "Subscribe"}, "contact": {"support_email": "naveedrp786@gmail.com", "support_phone": "+923081201745", "whatsapp_number": "+923081201745", "address": "", "city": "", "service_area": "Delivery across Pakistan", "business_hours": "Monday–Saturday, 9:00 AM–6:00 PM"}, "social": {"facebook_url": "", "instagram_url": "", "youtube_url": "", "tiktok_url": "", "x_url": ""}, "footer": {"short_description": "Natural cosmetics and hair-care products crafted with care.", "copyright_text": "© RUKHNAV. All rights reserved.", "show_payment_methods": true, "show_social_links": true, "show_newsletter": true}, "payments": {
    "cash_on_delivery_enabled": true,
    "bank_transfer_enabled": true,

    "easypaisa_enabled": true,
    "easypaisa_account_title": "",
    "easypaisa_account_number": "",
    "easypaisa_qr_url": "",
    "easypaisa_instructions": "Pay using Easypaisa, then enter your transaction reference and upload your payment receipt.",

    "jazzcash_enabled": true,
    "jazzcash_account_title": "",
    "jazzcash_account_number": "",
    "jazzcash_qr_url": "",
    "jazzcash_instructions": "Pay using JazzCash, then enter your transaction reference and upload your payment receipt.",

    "payment_message": "Secure and convenient payment options."
}, "delivery": {"free_delivery_enabled": true, "free_delivery_minimum": 3000, "standard_delivery_charge": 250, "delivery_message": "Delivery across Pakistan.", "return_message": "Easy returns subject to policy."}, "seo": {"site_title": "RUKHNAV | Herbal Beauty & Care", "site_description": "Premium herbal hair care, skin care and beauty products by RUKHNAV.", "keywords": "RUKHNAV, herbal beauty, hair care, skin care, cosmetics", "og_image_url": ""}, "advanced": {"maintenance_mode": false, "maintenance_message": "We are improving the store. Please check back soon.", "custom_css": ""}, "pages": {"products": {"enabled": true, "eyebrow": "Shop RUKHNAV", "title": "All Products", "description": "Explore herbal hair care, skin care and beauty products.", "search_placeholder": "Search products", "category_filter_enabled": true, "sort_enabled": true, "default_sort": "featured", "products_per_page": 24, "grid_columns_desktop": 4, "empty_title": "No products found", "empty_text": "Try a different search or category.", "view_button_text": "View Product", "add_to_cart_text": "Add to Cart", "out_of_stock_text": "Out of Stock", "sale_badge_text": "Sale", "new_badge_text": "New"}, "product_detail": {"enabled": true, "breadcrumb_home": "Home", "breadcrumb_products": "Products", "add_to_cart_text": "Add to Cart", "buy_now_text": "Buy Now", "wishlist_text": "Add to Wishlist", "in_stock_text": "In Stock", "out_of_stock_text": "Out of Stock", "low_stock_text": "Low Stock", "description_tab": "Description", "ingredients_tab": "Ingredients", "directions_tab": "Directions", "warnings_tab": "Warnings", "shipping_tab": "Shipping & Returns", "reviews_tab": "Reviews & Photos", "reviews_enabled": true, "reviews_eyebrow": "Verified Customer Experience", "reviews_title": "Customer Reviews & Photos", "reviews_description": "Read approved comments and customer photographs.", "write_review_text": "Write a Review", "verified_purchase_text": "Verified Purchase", "related_enabled": true, "related_title": "Related Products", "popular_enabled": true, "popular_title": "Popular Products", "recent_enabled": true, "recent_title": "Recently Viewed", "new_arrivals_enabled": true, "new_arrivals_title": "New Arrivals"}, "cart": {"enabled": true, "eyebrow": "Your Basket", "title": "Shopping Cart", "description": "Review your items before checkout.", "empty_title": "Your cart is empty", "empty_text": "Add products to your cart before continuing.", "continue_shopping_text": "Continue Shopping", "checkout_button_text": "Proceed to Checkout", "order_summary_title": "Order Summary", "subtotal_label": "Products subtotal", "delivery_label": "Delivery", "delivery_value_text": "Calculated at checkout", "discount_label": "Discount", "discount_value_text": "Apply coupon at checkout", "total_label": "Cart Total", "security_note": "Stock and prices will be verified again before your order is placed.", "payment_note_title": "Available payment options"}, "checkout": {"enabled": true, "eyebrow": "Secure Order Processing", "title": "Complete Your Order", "description": "Confirm delivery information and payment method.", "delivery_section_title": "Delivery Information", "payment_section_title": "Payment Method", "summary_title": "Order Summary", "full_name_label": "Full Name", "phone_label": "Phone Number", "email_label": "Email Address", "address_label": "Delivery Address", "city_label": "City", "postal_code_label": "Postal Code", "notes_label": "Order Notes", "place_order_text": "Place Order", "return_to_cart_text": "Return to Cart", "auth_required_title": "Sign in required", "auth_required_text": "Please sign in before checkout.", "empty_title": "Your cart is empty", "empty_text": "Add products before continuing to checkout.", "cod_title": "Cash on Delivery", "bank_transfer_title": "Bank Transfer", "easypaisa_title": "EasyPaisa", "jazzcash_title": "JazzCash", "terms_text": "By placing your order, you agree to our terms and privacy policy."}, "account": {"enabled": true, "eyebrow": "Customer Centre", "title": "My Account", "description": "Manage your profile, preferences and account activity.", "login_title": "Sign In", "login_text": "Access your orders, rewards and saved information.", "register_title": "Create Account", "register_text": "Join RUKHNAV and enjoy a personalized shopping experience.", "forgot_password_text": "Forgot Password?", "profile_title": "Profile", "preferences_title": "Preferences", "security_title": "Security", "delete_account_title": "Delete Account", "verification_title": "Verify Your Account", "logout_text": "Sign Out", "orders_enabled": true, "rewards_enabled": true, "events_enabled": true, "reviews_enabled": true}, "orders": {"enabled": true, "eyebrow": "Order History", "title": "My Orders", "description": "Track, review and manage your orders.", "empty_title": "No orders found", "empty_text": "Your completed purchases will appear here.", "view_details_text": "View Details", "cancel_text": "Cancel Order", "reorder_text": "Reorder", "review_text": "Review Products", "tracking_title": "Order Tracking", "payment_title": "Payment Information", "delivery_title": "Delivery Information", "items_title": "Order Items", "summary_title": "Order Summary", "invoice_text": "Download Invoice", "status_pending": "Pending", "status_confirmed": "Confirmed", "status_processing": "Processing", "status_packed": "Packed", "status_shipped": "Shipped", "status_delivered": "Delivered", "status_cancelled": "Cancelled"}, "wishlist": {"enabled": true, "eyebrow": "Saved Products", "title": "My Wishlist", "description": "Keep your favourite products in one place.", "empty_title": "Your wishlist is empty", "empty_text": "Save products you would like to revisit.", "browse_products_text": "Browse Products", "add_to_cart_text": "Add to Cart", "remove_text": "Remove"}, "rewards": {"enabled": true, "eyebrow": "RUKHNAV Rewards", "title": "Loyalty & Rewards", "description": "Earn points and enjoy membership benefits.", "available_points_label": "Available Points", "lifetime_points_label": "Lifetime Points", "membership_label": "Membership Level", "benefits_title": "Your Benefits", "history_title": "Points History", "empty_history_text": "No reward transactions yet."}, "events": {"enabled": true, "eyebrow": "Special Occasions", "title": "My Events", "description": "Save birthdays, anniversaries and important occasions.", "add_event_text": "Add Event", "empty_title": "No events saved", "empty_text": "Add an event to receive reminders.", "email_reminder_text": "Email Reminder", "whatsapp_reminder_text": "WhatsApp Reminder", "sms_reminder_text": "SMS Reminder"}, "reviews": {"enabled": true, "eyebrow": "Customer Stories", "title": "My Reviews", "description": "Manage reviews submitted for delivered products.", "eligible_title": "Products Available for Review", "submitted_title": "Submitted Reviews", "empty_eligible_text": "No delivered products are waiting for review.", "empty_submitted_text": "You have not submitted any reviews yet.", "submit_text": "Submit Review", "edit_text": "Edit Review", "delete_text": "Delete Review"}, "about": {"enabled": true, "eyebrow": "About RUKHNAV", "title": "Beauty inspired by nature and built around trust.", "description": "RUKHNAV brings together thoughtfully selected cosmetics, herbal care and hair-care products.", "mission_title": "Our Purpose", "mission_text": "To make premium personal care easier to discover and trust.", "button_text": "Explore Products", "button_url": "products.html"}, "contact": {"enabled": true, "eyebrow": "Customer Care", "title": "We are here to help.", "description": "Contact RUKHNAV for product, order, delivery or account support.", "form_title": "How can we help?", "name_label": "Full Name", "email_label": "Email Address", "subject_label": "Subject", "message_label": "Message", "submit_text": "Send Message", "success_text": "Your message has been prepared."}, "legal": {"privacy_enabled": true, "privacy_title": "Privacy Policy", "privacy_intro": "Learn how RUKHNAV handles customer information.", "terms_enabled": true, "terms_title": "Terms & Conditions", "terms_intro": "Review the terms that apply to use of the RUKHNAV store.", "refund_enabled": true, "refund_title": "Refund Policy", "refund_intro": "Review eligibility and conditions for returns and refunds.", "shipping_enabled": true, "shipping_title": "Shipping Policy", "shipping_intro": "Learn about delivery times, charges and service areas.", "faq_enabled": true, "faq_title": "Frequently Asked Questions", "faq_intro": "Find answers to common questions."}}};

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

const adminId = req =>
    req.admin?.id ||
    req.admin?.adminId ||
    req.admin?.userId ||
    null;

function parseJson(value) {
    if (!value) return {};
    try {
        return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
        return {};
    }
}

async function getRow() {
    const [[row]] = await db.query(
        `
        SELECT
            id,
            settings_json,
            published_json,
            status,
            updated_at,
            published_at
        FROM website_settings
        WHERE id = 1
        LIMIT 1
        `
    );
    return row || null;
}

async function history(settings, action, req) {
    try {
        await db.query(
            `
            INSERT INTO website_setting_history
                (settings_json, action_type, created_by)
            VALUES (?, ?, ?)
            `,
            [JSON.stringify(settings || {}), action, adminId(req)]
        );
    } catch (error) {
        console.warn("Website history skipped:", error.message);
    }
}

exports.getAdminSettings = async (req, res) => {
    try {
        const row = await getRow();

        if (!row) {
            return res.status(404).json({
                success: false,
                message: "Website settings are not initialized."
            });
        }

        return res.json({
            success: true,
            settings:
                deepMerge(
                    defaults,
                    parseJson(
                        row.settings_json
                    )
                ),

            publishedSettings:
                deepMerge(
                    defaults,
                    parseJson(
                        row.published_json
                    )
                ),
            status: row.status || "Published",
            updatedAt: row.updated_at,
            publishedAt: row.published_at
        });
    } catch (error) {
        console.error("Admin website settings error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load Website Management.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.saveDraft = async (req, res) => {
    try {
        const submitted =
            req.body?.settings &&
            typeof req.body.settings ===
                "object"
                ? req.body.settings
                : {};

        const settings =
            deepMerge(
                defaults,
                submitted
            );

        await db.query(
            `
            UPDATE website_settings
            SET
                settings_json = ?,
                status = 'Draft',
                updated_by = ?
            WHERE id = 1
            `,
            [JSON.stringify(settings), adminId(req)]
        );

        await history(settings, "Saved", req);

        return res.json({
            success: true,
            message: "Website draft saved."
        });
    } catch (error) {
        console.error("Save website draft error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to save website draft."
        });
    }
};

exports.publish = async (req, res) => {
    try {
        const row = await getRow();

        if (!row) {
            return res.status(404).json({
                success: false,
                message: "Website settings are not initialized."
            });
        }

        await db.query(
            `
            UPDATE website_settings
            SET
                published_json = settings_json,
                status = 'Published',
                published_by = ?,
                published_at = CURRENT_TIMESTAMP
            WHERE id = 1
            `,
            [adminId(req)]
        );

        await history(parseJson(row.settings_json), "Published", req);

        return res.json({
            success: true,
            message: "Website changes published."
        });
    } catch (error) {
        console.error("Publish website error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to publish website changes."
        });
    }
};

exports.restorePublished = async (req, res) => {
    try {
        const row = await getRow();

        if (!row?.published_json) {
            return res.status(409).json({
                success: false,
                message: "No published version is available."
            });
        }

        await db.query(
            `
            UPDATE website_settings
            SET
                settings_json = published_json,
                status = 'Published',
                updated_by = ?
            WHERE id = 1
            `,
            [adminId(req)]
        );

        await history(parseJson(row.published_json), "Restored", req);

        return res.json({
            success: true,
            message: "Draft restored to the published website."
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Unable to restore the published website."
        });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const [rows] = await db.query(
            `
            SELECT
                h.id,
                h.action_type,
                h.created_at,
                a.full_name AS created_by_name
            FROM website_setting_history h
            LEFT JOIN admins a ON a.id = h.created_by
            ORDER BY h.id DESC
            LIMIT 50
            `
        );

        return res.json({
            success: true,
            history: rows
        });
    } catch (error) {
        return res.json({
            success: true,
            history: []
        });
    }
};

exports.getPublicSettings = async (req, res) => {
    try {
        const row = await getRow();
        const settings =
            deepMerge(
                defaults,
                parseJson(
                    row?.published_json ||
                    row?.settings_json
                )
            );

        return res.json({
            success: true,
            settings,
            ...settings
        });
    } catch (error) {
        console.error("Public website settings error:", error);

        // The storefront must never break because CMS settings are unavailable.
        return res.json({
            success: true,
            settings: {},
            warning: "Storefront defaults are active."
        });
    }
};


exports.mergeMissingDefaults =
    async (req, res) => {
        try {
            const row =
                await getRow();

            if (!row) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Website settings are not initialized."
                });
            }

            const mergedSettings =
                deepMerge(
                    defaults,
                    parseJson(
                        row.settings_json
                    )
                );

            const mergedPublished =
                deepMerge(
                    defaults,
                    parseJson(
                        row.published_json ||
                        row.settings_json
                    )
                );

            await db.query(
                `
                UPDATE website_settings
                SET
                    settings_json = ?,
                    published_json = ?,
                    updated_by = ?
                WHERE id = 1
                `,
                [
                    JSON.stringify(
                        mergedSettings
                    ),
                    JSON.stringify(
                        mergedPublished
                    ),
                    adminId(req)
                ]
            );

            await history(
                mergedSettings,
                "Defaults Merged",
                req
            );

            return res.json({
                success: true,
                message:
                    "Missing page defaults were added. Existing settings were preserved.",
                settings:
                    mergedSettings
            });
        } catch (error) {
            console.error(
                "Merge Website Management defaults error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to merge missing page defaults."
            });
        }
    };

exports.getMedia = async (req, res) => {
    try {
        const [rows] = await db.query(
            `
            SELECT
                id,
                media_type,
                file_name,
                file_url,
                alt_text,
                file_size,
                mime_type,
                created_at
            FROM website_media
            ORDER BY id DESC
            LIMIT 200
            `
        );

        return res.json({
            success: true,
            media: rows
        });
    } catch (error) {
        return res.json({
            success: true,
            media: []
        });
    }
};

exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Select an image to upload."
            });
        }

        const fileUrl =
            `/uploads/website/${req.file.filename}`;

        const [result] = await db.query(
            `
            INSERT INTO website_media
                (
                    media_type,
                    file_name,
                    file_url,
                    alt_text,
                    file_size,
                    mime_type,
                    uploaded_by
                )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                String(req.body.media_type || "Image").slice(0, 30),
                req.file.originalname,
                fileUrl,
                String(req.body.alt_text || "").slice(0, 255) || null,
                req.file.size,
                req.file.mimetype,
                adminId(req)
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Image uploaded.",
            media: {
                id: result.insertId,
                file_url: fileUrl,
                file_name: req.file.originalname
            }
        });
    } catch (error) {
        console.error("Website media upload error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unable to upload image."
        });
    }
};
