"use strict";

const db = require("../config/db");

const DEFAULTS = {
    "branding": {
        "brand_name": {
            "value": "RUKHNAV",
            "valueType": "Text",
            "label": "Brand Name",
            "sortOrder": 1
        },
        "tagline": {
            "value": "Nature, Beauty & Care",
            "valueType": "Text",
            "label": "Tagline",
            "sortOrder": 2
        },
        "logo_url": {
            "value": "",
            "valueType": "Image",
            "label": "Logo",
            "sortOrder": 3
        },
        "logo_alt": {
            "value": "RUKHNAV",
            "valueType": "Text",
            "label": "Logo Alt Text",
            "sortOrder": 4
        },
        "favicon_url": {
            "value": "",
            "valueType": "Image",
            "label": "Favicon",
            "sortOrder": 5
        }
    },
    "theme": {
        "primary_color": {
            "value": "#173f2b",
            "valueType": "Text",
            "label": "Primary Color",
            "sortOrder": 1
        },
        "secondary_color": {
            "value": "#e5b83d",
            "valueType": "Text",
            "label": "Secondary Color",
            "sortOrder": 2
        },
        "accent_color": {
            "value": "#b98a24",
            "valueType": "Text",
            "label": "Accent Color",
            "sortOrder": 3
        },
        "background_color": {
            "value": "#f7f4ec",
            "valueType": "Text",
            "label": "Background Color",
            "sortOrder": 4
        },
        "surface_color": {
            "value": "#ffffff",
            "valueType": "Text",
            "label": "Surface Color",
            "sortOrder": 5
        },
        "text_color": {
            "value": "#1f2a22",
            "valueType": "Text",
            "label": "Text Color",
            "sortOrder": 6
        },
        "muted_text_color": {
            "value": "#66736a",
            "valueType": "Text",
            "label": "Muted Text Color",
            "sortOrder": 7
        },
        "heading_font": {
            "value": "Poppins",
            "valueType": "Text",
            "label": "Heading Font",
            "sortOrder": 8
        },
        "body_font": {
            "value": "Poppins",
            "valueType": "Text",
            "label": "Body Font",
            "sortOrder": 9
        },
        "border_radius": {
            "value": "14",
            "valueType": "Number",
            "label": "Border Radius",
            "sortOrder": 10
        },
        "product_card_style": {
            "value": "elevated",
            "valueType": "Text",
            "label": "Product Card Style",
            "sortOrder": 11
        }
    },
    "header": {
        "announcement_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Announcement Enabled",
            "sortOrder": 1
        },
        "announcement_text": {
            "value": "Free delivery on qualifying orders",
            "valueType": "Text",
            "label": "Announcement Text",
            "sortOrder": 2
        },
        "announcement_link": {
            "value": "",
            "valueType": "URL",
            "label": "Announcement Link",
            "sortOrder": 3
        },
        "search_placeholder": {
            "value": "Search RUKHNAV products",
            "valueType": "Text",
            "label": "Search Placeholder",
            "sortOrder": 4
        },
        "show_categories": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Categories",
            "sortOrder": 5
        },
        "show_account": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Account",
            "sortOrder": 6
        },
        "show_wishlist": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Wishlist",
            "sortOrder": 7
        },
        "show_orders": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Orders",
            "sortOrder": 8
        },
        "show_cart": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Cart",
            "sortOrder": 9
        },
        "sticky_header": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Sticky Header",
            "sortOrder": 10
        }
    },
    "footer": {
        "short_description": {
            "value": "Natural cosmetics and hair-care products crafted with care.",
            "valueType": "Textarea",
            "label": "Brand Description",
            "sortOrder": 1
        },
        "copyright_text": {
            "value": "© RUKHNAV. All rights reserved.",
            "valueType": "Text",
            "label": "Copyright Text",
            "sortOrder": 2
        },
        "show_newsletter": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Newsletter",
            "sortOrder": 3
        },
        "newsletter_title": {
            "value": "Stay connected with RUKHNAV",
            "valueType": "Text",
            "label": "Newsletter Title",
            "sortOrder": 4
        },
        "newsletter_text": {
            "value": "Receive product news, beauty tips and special offers.",
            "valueType": "Textarea",
            "label": "Newsletter Text",
            "sortOrder": 5
        },
        "show_payment_icons": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Payment Icons",
            "sortOrder": 6
        }
    },
    "store": {
        "currency_code": {
            "value": "PKR",
            "valueType": "Text",
            "label": "Currency Code",
            "sortOrder": 1
        },
        "currency_symbol": {
            "value": "Rs.",
            "valueType": "Text",
            "label": "Currency Symbol",
            "sortOrder": 2
        },
        "show_currency_code": {
            "value": "false",
            "valueType": "Boolean",
            "label": "Show Currency Code",
            "sortOrder": 3
        },
        "tax_included": {
            "value": "false",
            "valueType": "Boolean",
            "label": "Tax Included",
            "sortOrder": 4
        },
        "show_out_of_stock": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Show Out-of-stock Products",
            "sortOrder": 5
        },
        "allow_backorders": {
            "value": "false",
            "valueType": "Boolean",
            "label": "Allow Backorders",
            "sortOrder": 6
        },
        "wishlist_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Wishlist Enabled",
            "sortOrder": 7
        },
        "reviews_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Reviews Enabled",
            "sortOrder": 8
        },
        "loyalty_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Loyalty Enabled",
            "sortOrder": 9
        },
        "coupons_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Coupons Enabled",
            "sortOrder": 10
        },
        "compare_enabled": {
            "value": "false",
            "valueType": "Boolean",
            "label": "Compare Enabled",
            "sortOrder": 11
        },
        "recently_viewed_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Recently Viewed Enabled",
            "sortOrder": 12
        },
        "products_per_page": {
            "value": "24",
            "valueType": "Number",
            "label": "Products Per Page",
            "sortOrder": 13
        },
        "default_sort": {
            "value": "featured",
            "valueType": "Text",
            "label": "Default Sort",
            "sortOrder": 14
        }
    },
    "payments": {
        "cash_on_delivery_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Cash on Delivery",
            "sortOrder": 1
        },
        "easypaisa_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "EasyPaisa Enabled",
            "sortOrder": 2
        },
        "jazzcash_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "JazzCash Enabled",
            "sortOrder": 3
        },
        "bank_transfer_enabled": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Bank Transfer Enabled",
            "sortOrder": 4
        },
        "card_enabled": {
            "value": "false",
            "valueType": "Boolean",
            "label": "Card Enabled",
            "sortOrder": 5
        },
        "easypaisa_number": {
            "value": "",
            "valueType": "Phone",
            "label": "EasyPaisa Number",
            "sortOrder": 6
        },
        "jazzcash_number": {
            "value": "",
            "valueType": "Phone",
            "label": "JazzCash Number",
            "sortOrder": 7
        },
        "bank_name": {
            "value": "",
            "valueType": "Text",
            "label": "Bank Name",
            "sortOrder": 8
        },
        "bank_account_title": {
            "value": "",
            "valueType": "Text",
            "label": "Account Title",
            "sortOrder": 9
        },
        "bank_account_number": {
            "value": "",
            "valueType": "Text",
            "label": "Account Number",
            "sortOrder": 10
        },
        "bank_iban": {
            "value": "",
            "valueType": "Text",
            "label": "IBAN",
            "sortOrder": 11
        }
    },
    "contact": {
        "support_email": {
            "value": "",
            "valueType": "Email",
            "label": "Support Email",
            "sortOrder": 1
        },
        "support_phone": {
            "value": "",
            "valueType": "Phone",
            "label": "Support Phone",
            "sortOrder": 2
        },
        "whatsapp_number": {
            "value": "",
            "valueType": "Phone",
            "label": "WhatsApp Number",
            "sortOrder": 3
        },
        "address": {
            "value": "",
            "valueType": "Textarea",
            "label": "Address",
            "sortOrder": 4
        },
        "city": {
            "value": "",
            "valueType": "Text",
            "label": "City",
            "sortOrder": 5
        },
        "country": {
            "value": "Pakistan",
            "valueType": "Text",
            "label": "Country",
            "sortOrder": 6
        },
        "business_hours": {
            "value": "",
            "valueType": "Textarea",
            "label": "Business Hours",
            "sortOrder": 7
        }
    },
    "social": {
        "facebook_url": {
            "value": "",
            "valueType": "URL",
            "label": "Facebook URL",
            "sortOrder": 1
        },
        "instagram_url": {
            "value": "",
            "valueType": "URL",
            "label": "Instagram URL",
            "sortOrder": 2
        },
        "tiktok_url": {
            "value": "",
            "valueType": "URL",
            "label": "TikTok URL",
            "sortOrder": 3
        },
        "youtube_url": {
            "value": "",
            "valueType": "URL",
            "label": "YouTube URL",
            "sortOrder": 4
        },
        "x_url": {
            "value": "",
            "valueType": "URL",
            "label": "X / Twitter URL",
            "sortOrder": 5
        },
        "pinterest_url": {
            "value": "",
            "valueType": "URL",
            "label": "Pinterest URL",
            "sortOrder": 6
        }
    },
    "seo": {
        "site_title": {
            "value": "RUKHNAV",
            "valueType": "Text",
            "label": "Site Title",
            "sortOrder": 1
        },
        "meta_description": {
            "value": "Discover RUKHNAV natural cosmetics and hair-care products.",
            "valueType": "Textarea",
            "label": "Meta Description",
            "sortOrder": 2
        },
        "meta_keywords": {
            "value": "RUKHNAV, cosmetics, hair care, herbal beauty",
            "valueType": "Textarea",
            "label": "Meta Keywords",
            "sortOrder": 3
        },
        "og_image_url": {
            "value": "",
            "valueType": "Image",
            "label": "Open Graph Image",
            "sortOrder": 4
        },
        "robots_index": {
            "value": "true",
            "valueType": "Boolean",
            "label": "Allow Indexing",
            "sortOrder": 5
        },
        "google_site_verification": {
            "value": "",
            "valueType": "Text",
            "label": "Google Site Verification",
            "sortOrder": 6
        },
        "facebook_domain_verification": {
            "value": "",
            "valueType": "Text",
            "label": "Facebook Domain Verification",
            "sortOrder": 7
        }
    }
};

const ALLOWED_GROUPS = new Set(Object.keys(DEFAULTS));

function cleanGroup(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "");
}

function parseValue(value, type) {
    if (type === "Boolean") {
        return String(value).toLowerCase() === "true";
    }

    if (type === "Number") {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    return value ?? "";
}

function serialiseValue(value, type) {
    if (type === "Boolean") {
        return value ? "true" : "false";
    }

    if (type === "Number") {
        const number = Number(value);
        return Number.isFinite(number) ? String(number) : "0";
    }

    return String(value ?? "").trim();
}

async function loadSettings(connection = db, publicOnly = false) {
    const [rows] = await connection.query(`
        SELECT
            setting_group,
            setting_key,
            setting_value,
            value_type,
            label,
            is_public,
            sort_order,
            updated_at
        FROM website_settings
        ${publicOnly ? "WHERE is_public = 1" : ""}
        ORDER BY
            setting_group ASC,
            sort_order ASC,
            id ASC
    `);

    const settings = {};
    const metadata = {};

    for (const row of rows) {
        const group = cleanGroup(row.setting_group);

        if (!settings[group]) {
            settings[group] = {};
            metadata[group] = {};
        }

        settings[group][row.setting_key] =
            parseValue(row.setting_value, row.value_type);

        metadata[group][row.setting_key] = {
            valueType: row.value_type,
            label: row.label,
            isPublic: Boolean(row.is_public),
            sortOrder: Number(row.sort_order || 0),
            updatedAt: row.updated_at
        };
    }

    for (const [group, keys] of Object.entries(DEFAULTS)) {
        if (!settings[group]) {
            settings[group] = {};
        }

        if (!metadata[group]) {
            metadata[group] = {};
        }

        for (const [key, definition] of Object.entries(keys)) {
            if (settings[group][key] === undefined) {
                settings[group][key] =
                    parseValue(definition.value, definition.valueType);

                metadata[group][key] = {
                    valueType: definition.valueType,
                    label: definition.label,
                    isPublic: true,
                    sortOrder: definition.sortOrder,
                    updatedAt: null
                };
            }
        }
    }

    return { settings, metadata };
}

async function upsertGroup(connection, group, payload) {
    const definitions = DEFAULTS[group];

    for (const [key, definition] of Object.entries(definitions)) {
        const value =
            Object.prototype.hasOwnProperty.call(payload, key)
                ? payload[key]
                : definition.value;

        await connection.query(
            `
                INSERT INTO website_settings
                (
                    setting_group,
                    setting_key,
                    setting_value,
                    value_type,
                    label,
                    is_public,
                    sort_order
                )
                VALUES (?, ?, ?, ?, ?, 1, ?)

                ON DUPLICATE KEY UPDATE
                    setting_value = VALUES(setting_value),
                    value_type = VALUES(value_type),
                    label = VALUES(label),
                    is_public = VALUES(is_public),
                    sort_order = VALUES(sort_order),
                    updated_at = CURRENT_TIMESTAMP
            `,
            [
                group,
                key,
                serialiseValue(value, definition.valueType),
                definition.valueType,
                definition.label,
                definition.sortOrder
            ]
        );
    }
}

exports.getAdminSettings = async (req, res) => {
    try {
        const result = await loadSettings();

        return res.json({
            success: true,
            message: "Website settings fetched successfully.",
            ...result
        });
    } catch (error) {
        console.error("Get website settings error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch website settings.",
            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });
    }
};

exports.updateGroup = async (req, res) => {
    const group = cleanGroup(req.params.group);

    if (!ALLOWED_GROUPS.has(group)) {
        return res.status(400).json({
            success: false,
            message: "A valid website settings group is required."
        });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            success: false,
            message: "Settings must be supplied as a JSON object."
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        await upsertGroup(connection, group, req.body);
        await connection.commit();

        const { settings } = await loadSettings();

        return res.json({
            success: true,
            message: `${group} settings updated successfully.`,
            group,
            settings: settings[group]
        });
    } catch (error) {
        await connection.rollback();

        console.error("Update website settings error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update website settings.",
            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });
    } finally {
        connection.release();
    }
};

exports.resetGroup = async (req, res) => {
    const group = cleanGroup(req.params.group);

    if (!ALLOWED_GROUPS.has(group)) {
        return res.status(400).json({
            success: false,
            message: "A valid website settings group is required."
        });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const payload = Object.fromEntries(
            Object.entries(DEFAULTS[group]).map(([key, definition]) => [
                key,
                parseValue(definition.value, definition.valueType)
            ])
        );

        await upsertGroup(connection, group, payload);
        await connection.commit();

        return res.json({
            success: true,
            message: `${group} settings restored to defaults.`,
            group,
            settings: payload
        });
    } catch (error) {
        await connection.rollback();

        console.error("Reset website settings error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to reset website settings.",
            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });
    } finally {
        connection.release();
    }
};

exports.getPublicSettings = async (req, res) => {
    try {
        const { settings } = await loadSettings(db, true);

        return res.json({
            success: true,
            settings,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get public website settings error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load website settings.",
            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });
    }
};
