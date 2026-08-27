"use strict";

const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const inventoryService =
    require("../services/inventoryService");

function getAdminId(req) {
    return (
        req.admin?.id ||
        req.admin?.adminId ||
        req.admin?.admin_id ||
        null
    );
}

const productUploadDirectory =
    path.join(
        __dirname,
        "..",
        "uploads",
        "products"
    );

// ==========================================
// Remove Uploaded Files after Failed Request
// ==========================================
async function removeUploadedFiles(
    files = []
) {
    await Promise.all(
        files.map(async file => {
            const filename =
                path.basename(
                    file.filename
                );

            const filePath =
                path.join(
                    productUploadDirectory,
                    filename
                );

            try {
                await fs.promises.unlink(
                    filePath
                );
            } catch (error) {
                if (
                    error.code !== "ENOENT"
                ) {
                    console.error(
                        "Image cleanup error:",
                        error
                    );
                }
            }
        })
    );
}

// ==========================================
// Add Product Images inside Transaction
// ==========================================
async function insertProductImages(
    connection,
    productId,
    files = []
) {
    if (files.length === 0) {
        return [];
    }

    const [[orderResult]] =
        await connection.query(
            `
            SELECT
                COALESCE(
                    MAX(sort_order),
                    0
                ) AS maximum_order
            FROM product_images
            WHERE product_id = ?
            `,
            [productId]
        );

    let nextOrder =
        Number(
            orderResult.maximum_order
        ) + 1;

    const images = [];

    for (const file of files) {
        const [result] =
            await connection.query(
                `
                INSERT INTO product_images
                (
                    product_id,
                    image_url,
                    sort_order
                )
                VALUES (?, ?, ?)
                `,
                [
                    productId,
                    file.filename,
                    nextOrder
                ]
            );

        images.push({
            id: result.insertId,
            product_id: productId,
            image_url: file.filename,
            sort_order: nextOrder
        });

        nextOrder += 1;
    }

    return images;
}

// ==========================================
// Synchronize Main Product Image
// ==========================================
async function synchronizeMainImage(
    connection,
    productId
) {
    const [images] =
        await connection.query(
            `
            SELECT image_url
            FROM product_images
            WHERE product_id = ?
            ORDER BY
                sort_order ASC,
                id ASC
            LIMIT 1
            `,
            [productId]
        );

    const mainImage =
        images.length > 0
            ? images[0].image_url
            : null;

    await connection.query(
        `
        UPDATE products
        SET image = ?
        WHERE id = ?
        `,
        [
            mainImage,
            productId
        ]
    );

    return mainImage;
}

// ==========================================
// Public: Get Product with Full Gallery
// ==========================================
exports.getProductById = async (
    req,
    res
) => {
    try {
        const productId =
            Number(req.params.id);

        if (
            !Number.isInteger(productId) ||
            productId < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid product ID is required."
            });
        }

        const [productRows] =
            await db.query(
                `
                SELECT
                    p.*,

                    IFNULL(
                        ROUND(
                            AVG(r.rating),
                            1
                        ),
                        0
                    ) AS averageRating,

                    COUNT(r.id)
                        AS totalReviews

                FROM products p

                LEFT JOIN reviews r
                    ON r.product_id =
                       p.id

                WHERE p.id = ?
                  AND p.status !=
                      'Inactive'

                GROUP BY p.id

                LIMIT 1
                `,
                [productId]
            );

        if (
            productRows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Product not found or unavailable."
            });
        }

        const [images] =
            await db.query(
                `
                SELECT
                    id,
                    product_id,
                    image_url,
                    sort_order,
                    created_at
                FROM product_images
                WHERE product_id = ?
                ORDER BY
                    sort_order ASC,
                    id ASC
                `,
                [productId]
            );

        const product =
            productRows[0];

        const normalizeProductImageUrl =
            value => {
                const raw =
                    String(value || "").trim();

                if (!raw) {
                    return null;
                }

                if (
                    raw.startsWith("http://") ||
                    raw.startsWith("https://")
                ) {
                    return raw;
                }

                if (raw.startsWith("/")) {
                    return raw;
                }

                return `/uploads/products/${raw}`;
            };

        const normalizedImages =
            images.map(
                (
                    image,
                    index
                ) => ({
                    ...image,
                    is_main:
                        index === 0,
                    image_url:
                        normalizeProductImageUrl(
                            image.image_url
                        )
                })
            );

        const mainImage =
            normalizedImages.length > 0
                ? normalizedImages[0]
                    .image_url
                : product.image;

        return res.json({
            success: true,
            product: {
                ...product,
                image: mainImage,
                main_image:
                    mainImage,
                image_url:
                    normalizeProductImageUrl(
                        mainImage
                    ),
                images:
                    normalizedImages
            }
        });
    } catch (error) {
        console.error(
            "Get product details error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve product details.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// ==========================================
// Admin: Create Product with Gallery
// ==========================================
exports.addProduct = async (
    req,
    res
) => {
    const files = req.files || [];

    const productName =
        String(
            req.body.product_name || ""
        ).trim();

    const sku =
        String(
            req.body.sku || ""
        ).trim();

    const category =
        String(
            req.body.category || ""
        ).trim();

    const description =
        String(
            req.body.description || ""
        ).trim();

    const ingredients =
        String(
            req.body.ingredients || ""
        ).trim();

    const directions =
        String(
            req.body.directions || ""
        ).trim();

    const warnings =
        String(
            req.body.warnings || ""
        ).trim();

    const sellingPrice =
        Number(
            req.body.selling_price
        );

    const stockQuantity =
        Number(
            req.body.stock_quantity || 0
        );

    const status =
        String(
            req.body.status || "Active"
        ).trim();

    if (!productName) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Product name is required."
        });
    }

    if (!category) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Product category is required."
        });
    }

    if (
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0
    ) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Enter a valid selling price."
        });
    }

    if (
        !Number.isInteger(stockQuantity) ||
        stockQuantity < 0
    ) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Enter a valid stock quantity."
        });
    }

    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const [result] =
            await connection.query(
                `
                INSERT INTO products
                (
                    product_name,
                    sku,
                    category,
                    description,
                    ingredients,
                    directions,
                    warnings,
                    selling_price,
                    stock_quantity,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    productName,
                    sku || null,
                    category,
                    description || null,
                    ingredients || null,
                    directions || null,
                    warnings || null,
                    sellingPrice,
                    stockQuantity,
                    status
                ]
            );

        const productId =
            result.insertId;

        const [createdProductRows] =
            await connection.query(
                `
                SELECT
                    cost_price,
                    low_stock_level
                FROM products
                WHERE id = ?
                LIMIT 1
                `,
                [productId]
            );

        const createdProduct =
            createdProductRows[0] || {};

        const stockStatus =
            inventoryService.getStockStatus(
                stockQuantity,
                createdProduct.low_stock_level
            );

        await connection.query(
            `
            UPDATE products
            SET stock_status = ?
            WHERE id = ?
            `,
            [
                stockStatus,
                productId
            ]
        );

        if (stockQuantity > 0) {
            await inventoryService.recordMovement(
                connection,
                {
                    productId,
                    transactionType: "Stock In",
                    quantity: stockQuantity,
                    previousStock: 0,
                    newStock: stockQuantity,
                    costPrice:
                        Number(
                            createdProduct.cost_price || 0
                        ),
                    supplierId: null,
                    reference:
                        `OPENING-${productId}-${Date.now()}`,
                    remarks:
                        "Opening stock recorded during product creation.",
                    createdBy:
                        getAdminId(req)
                }
            );
        }

        const images =
            await insertProductImages(
                connection,
                productId,
                files
            );

        const mainImage =
            await synchronizeMainImage(
                connection,
                productId
            );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                "Product created successfully.",
            product: {
                id: productId,
                product_name:
                    productName,
                main_image:
                    mainImage,
                opening_stock:
                    stockQuantity,
                stock_status:
                    stockStatus,
                total_images:
                    images.length,
                images
            }
        });
    } catch (error) {
        await connection.rollback();

        await removeUploadedFiles(files);

        console.error(
            "Create product error:",
            error
        );

        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "A product with this SKU already exists."
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Unable to create product.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    } finally {
        connection.release();
    }
};

// ==========================================
// Admin: Update Product and Add Images
// ==========================================
exports.updateProduct = async (
    req,
    res
) => {
    const files = req.files || [];

    const productId =
        Number(req.params.id);

    if (
        !Number.isInteger(productId) ||
        productId < 1
    ) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "A valid product ID is required."
        });
    }

    const productName =
        String(
            req.body.product_name || ""
        ).trim();

    const sku =
        String(
            req.body.sku || ""
        ).trim();

    const category =
        String(
            req.body.category || ""
        ).trim();

    const description =
        String(
            req.body.description || ""
        ).trim();

    const ingredients =
        String(
            req.body.ingredients || ""
        ).trim();

    const directions =
        String(
            req.body.directions || ""
        ).trim();

    const warnings =
        String(
            req.body.warnings || ""
        ).trim();

    const sellingPrice =
        Number(
            req.body.selling_price
        );

    const stockQuantity =
        Number(
            req.body.stock_quantity
        );

    const status =
        String(
            req.body.status || "Active"
        ).trim();

    if (
        !productName ||
        !category
    ) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Product name and category are required."
        });
    }

    if (
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0
    ) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Enter a valid selling price."
        });
    }

    if (
        !Number.isInteger(stockQuantity) ||
        stockQuantity < 0
    ) {
        await removeUploadedFiles(files);

        return res.status(400).json({
            success: false,
            message:
                "Enter a valid stock quantity."
        });
    }

    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const [productRows] =
            await connection.query(
                `
                SELECT
                    id,
                    stock_quantity,
                    cost_price,
                    low_stock_level
                FROM products
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [productId]
            );

        if (
            productRows.length === 0
        ) {
            await connection.rollback();

            await removeUploadedFiles(
                files
            );

            return res.status(404).json({
                success: false,
                message:
                    "Product not found."
            });
        }

        const existingProduct =
            productRows[0];

        const previousStock =
            Number(
                existingProduct.stock_quantity || 0
            );

        const stockStatus =
            inventoryService.getStockStatus(
                stockQuantity,
                existingProduct.low_stock_level
            );

        await connection.query(
            `
            UPDATE products
            SET
                product_name = ?,
                sku = ?,
                category = ?,
                description = ?,
                ingredients = ?,
                directions = ?,
                warnings = ?,
                selling_price = ?,
                stock_quantity = ?,
                stock_status = ?,
                status = ?
            WHERE id = ?
            `,
            [
                productName,
                sku || null,
                category,
                description || null,
                ingredients || null,
                directions || null,
                warnings || null,
                sellingPrice,
                stockQuantity,
                stockStatus,
                status,
                productId
            ]
        );

        if (stockQuantity !== previousStock) {
            const difference =
                Math.abs(
                    stockQuantity - previousStock
                );

            const direction =
                stockQuantity > previousStock
                    ? "Increase"
                    : "Decrease";

            await inventoryService.recordMovement(
                connection,
                {
                    productId,
                    transactionType:
                        "Adjustment",
                    quantity:
                        difference,
                    previousStock,
                    newStock:
                        stockQuantity,
                    costPrice:
                        Number(
                            existingProduct.cost_price || 0
                        ),
                    supplierId:
                        null,
                    reference:
                        `PRODUCT-EDIT-${productId}-${Date.now()}`,
                    remarks:
                        `${direction}: stock changed from ${previousStock} to ${stockQuantity} while editing the product.`,
                    createdBy:
                        getAdminId(req)
                }
            );
        }

        const addedImages =
            await insertProductImages(
                connection,
                productId,
                files
            );

        const mainImage =
            await synchronizeMainImage(
                connection,
                productId
            );

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Product updated successfully.",
            product: {
                id: productId,
                product_name:
                    productName,
                main_image:
                    mainImage,
                previous_stock:
                    previousStock,
                new_stock:
                    stockQuantity,
                stock_status:
                    stockStatus,
                stock_changed:
                    stockQuantity !== previousStock,
                added_images:
                    addedImages.length,
                images:
                    addedImages
            }
        });
    } catch (error) {
        await connection.rollback();

        await removeUploadedFiles(files);

        console.error(
            "Update product error:",
            error
        );

        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Another product already uses this SKU."
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Unable to update product.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    } finally {
        connection.release();
    }
};