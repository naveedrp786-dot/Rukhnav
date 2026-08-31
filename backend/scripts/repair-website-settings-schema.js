"use strict";

require("dotenv").config();
const db = require("../config/db");

const defaults = {
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
            "RUKHNAV | Herbal Beauty & Care",
        site_description:
            "RUKHNAV herbal cosmetics and hair-care products."
    },

    advanced: {
        maintenance_mode: false,
        maintenance_message:
            "We are improving the store. Please check back soon.",
        custom_css: ""
    }
};

async function columnExists(
    connection,
    table,
    column
) {
    const [rows] =
        await connection.query(
            `
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
            `,
            [table, column]
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
            "website_settings",
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
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

        const payload =
            JSON.stringify(defaults);

        const [[existing]] =
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

        if (!existing) {
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
                [payload, payload]
            );
        } else {
            const working =
                existing.settings_json ||
                existing.published_json ||
                payload;

            const published =
                existing.published_json ||
                existing.settings_json ||
                payload;

            await connection.query(
                `
                UPDATE website_settings
                SET
                    settings_json = ?,
                    published_json = ?,
                    status =
                        CASE
                            WHEN status IS NULL
                              OR status = ''
                            THEN 'Published'
                            ELSE status
                        END,
                    published_at =
                        COALESCE(
                            published_at,
                            CURRENT_TIMESTAMP
                        )
                WHERE id = 1
                `,
                [working, published]
            );
        }

        await connection.commit();

        console.log(
            "Website settings schema repaired successfully."
        );

        process.exit(0);
    } catch (error) {
        await connection.rollback();

        console.error(
            "Website settings schema repair failed:",
            error
        );

        process.exit(1);
    } finally {
        connection.release();
    }
}

run();
