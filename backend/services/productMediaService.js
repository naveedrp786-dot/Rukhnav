"use strict";

const db = require("../config/db");

let cachedColumn = null;

function normalizeStoredPath(value) {
    if (!value) {
        return null;
    }

    const text = String(value).trim();

    if (!text) {
        return null;
    }

    if (
        /^https?:\/\//i.test(text) ||
        text.startsWith("/store/") ||
        text.startsWith("data:")
    ) {
        return text;
    }

    if (text.startsWith("/")) {
        return text;
    }

    if (text.startsWith("uploads/")) {
        return `/${text}`;
    }

    return `/uploads/products/${text}`;
}

async function getProductImageColumn(
    connection = db
) {
    if (cachedColumn) {
        return cachedColumn;
    }

    const [rows] =
        await connection.query(
            `
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'product_images'
              AND COLUMN_NAME IN (
                    'image_url',
                    'image_name'
              )
            ORDER BY FIELD(
                COLUMN_NAME,
                'image_url',
                'image_name'
            )
            LIMIT 1
            `
        );

    cachedColumn =
        rows[0]?.COLUMN_NAME ||
        rows[0]?.column_name ||
        null;

    return cachedColumn;
}

async function primaryImageSql(
    productAlias = "p",
    connection = db
) {
    const column =
        await getProductImageColumn(
            connection
        );

    const fallback = `
        CASE
            WHEN ${productAlias}.image IS NULL
                 OR ${productAlias}.image = ''
                THEN NULL
            WHEN ${productAlias}.image LIKE '/%'
                THEN ${productAlias}.image
            WHEN ${productAlias}.image LIKE 'uploads/%'
                THEN CONCAT('/', ${productAlias}.image)
            ELSE CONCAT(
                '/uploads/products/',
                ${productAlias}.image
            )
        END
    `;

    if (!column) {
        return fallback;
    }

    return `
        COALESCE(
            (
                SELECT
                    CASE
                        WHEN pi.${column} IS NULL
                             OR pi.${column} = ''
                            THEN NULL
                        WHEN pi.${column} LIKE '/%'
                            THEN pi.${column}
                        WHEN pi.${column} LIKE 'uploads/%'
                            THEN CONCAT('/', pi.${column})
                        ELSE CONCAT(
                            '/uploads/products/',
                            pi.${column}
                        )
                    END
                FROM product_images pi
                WHERE pi.product_id =
                    ${productAlias}.id
                ORDER BY
                    COALESCE(
                        pi.is_primary,
                        0
                    ) DESC,
                    COALESCE(
                        pi.sort_order,
                        0
                    ) ASC,
                    pi.id ASC
                LIMIT 1
            ),
            ${fallback}
        )
    `;
}

async function getPrimaryImage(
    productId,
    connection = db
) {
    const expression =
        await primaryImageSql(
            "p",
            connection
        );

    const [rows] =
        await connection.query(
            `
            SELECT
                ${expression}
                    AS image_url
            FROM products p
            WHERE p.id = ?
            LIMIT 1
            `,
            [productId]
        );

    return normalizeStoredPath(
        rows[0]?.image_url
    );
}

async function getProductImages(
    productId,
    connection = db
) {
    const column =
        await getProductImageColumn(
            connection
        );

    if (!column) {
        const primary =
            await getPrimaryImage(
                productId,
                connection
            );

        return primary
            ? [{
                id: null,
                product_id:
                    Number(productId),
                image_url:
                    primary,
                image_alt:
                    null,
                sort_order:
                    0,
                is_primary:
                    1,
                status:
                    "Active"
            }]
            : [];
    }

    const [rows] =
        await connection.query(
            `
            SELECT
                id,
                product_id,
                ${column} AS image_url,
                image_alt,
                sort_order,
                is_primary,
                status
            FROM product_images
            WHERE product_id = ?
              AND (
                    status = 'Active'
                    OR status IS NULL
              )
            ORDER BY
                COALESCE(
                    is_primary,
                    0
                ) DESC,
                COALESCE(
                    sort_order,
                    0
                ) ASC,
                id ASC
            `,
            [productId]
        );

    return rows.map(
        row => ({
            ...row,
            image_url:
                normalizeStoredPath(
                    row.image_url
                )
        })
    );
}

function clearSchemaCache() {
    cachedColumn = null;
}

module.exports = {
    normalizeStoredPath,
    getProductImageColumn,
    primaryImageSql,
    getPrimaryImage,
    getProductImages,
    clearSchemaCache
};
