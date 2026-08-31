"use strict";

const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const productUploadDirectory =
    path.join(
        __dirname,
        "..",
        "uploads",
        "products"
    );

// ==========================================
// Safely Remove Physical Image
// ==========================================
async function removeImageFile(
    imageName
) {
    if (!imageName) {
        return;
    }

    const safeFilename =
        path.basename(imageName);

    const imagePath =
        path.join(
            productUploadDirectory,
            safeFilename
        );

    try {
        await fs.promises.unlink(
            imagePath
        );
    } catch (error) {
        if (
            error.code !== "ENOENT"
        ) {
            console.error(
                "Product image deletion error:",
                error
            );
        }
    }
}

// ==========================================
// Remove Newly Uploaded Files after Error
// ==========================================
async function removeUploadedFiles(
    files = []
) {
    await Promise.all(
        files.map(file =>
            removeImageFile(
                file.filename
            )
        )
    );
}

// ==========================================
// Synchronize Legacy Main Image Field
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
// Normalize Image Order
// ==========================================
async function normalizeImageOrder(
    connection,
    productId,
    mainImageId = null
) {
    const [images] =
        await connection.query(
            `
            SELECT id
            FROM product_images
            WHERE product_id = ?
            ORDER BY
                CASE
                    WHEN id = ? THEN 0
                    ELSE 1
                END,
                sort_order ASC,
                id ASC
            `,
            [
                productId,
                mainImageId || 0
            ]
        );

    for (
        let index = 0;
        index < images.length;
        index += 1
    ) {
        await connection.query(
            `
            UPDATE product_images
            SET sort_order = ?
            WHERE id = ?
              AND product_id = ?
            `,
            [
                index + 1,
                images[index].id,
                productId
            ]
        );
    }
}

// ==========================================
// Public: Get Product Image Gallery
// ==========================================
exports.getProductImages = async (
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
                    id,
                    product_name,
                    image
                FROM products
                WHERE id = ?
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
                    "Product not found."
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

        return res.json({
            success: true,
            productId,
            productName:
                productRows[0]
                    .product_name,
            totalImages:
                images.length,
            mainImage:
                images.length > 0
                    ? images[0].image_url
                    : productRows[0].image,
            images: images.map(
                (
                    image,
                    index
                ) => ({
                    ...image,
                    is_main:
                        index === 0
                })
            )
        });
    } catch (error) {
        console.error(
            "Get product images error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve product images.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// ==========================================
// Admin: Upload More Product Images
// ==========================================
exports.addProductImages = async (
    req,
    res
) => {
    const productId =
        Number(req.params.id);

    if (
        !Number.isInteger(productId) ||
        productId < 1
    ) {
        await removeUploadedFiles(
            req.files
        );

        return res.status(400).json({
            success: false,
            message:
                "A valid product ID is required."
        });
    }

    if (
        !req.files ||
        req.files.length === 0
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Select at least one product image."
        });
    }

    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const [productRows] =
            await connection.query(
                `
                SELECT id
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
                req.files
            );

            return res.status(404).json({
                success: false,
                message:
                    "Product not found."
            });
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

        const addedImages = [];

        for (const file of req.files) {
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

            addedImages.push({
                id: result.insertId,
                product_id:
                    productId,
                image_url:
                    file.filename,
                sort_order:
                    nextOrder,
                is_main:
                    nextOrder === 1
            });

            nextOrder += 1;
        }

        const mainImage =
            await synchronizeMainImage(
                connection,
                productId
            );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                `${addedImages.length} product image(s) uploaded successfully.`,
            productId,
            mainImage,
            images: addedImages
        });
    } catch (error) {
        await connection.rollback();

        await removeUploadedFiles(
            req.files
        );

        console.error(
            "Add product images error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to upload product images.",
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
// Admin: Set Main Product Image
// ==========================================
exports.setMainProductImage = async (
    req,
    res
) => {
    const productId =
        Number(req.params.id);

    const imageId =
        Number(req.params.imageId);

    if (
        !Number.isInteger(productId) ||
        productId < 1 ||
        !Number.isInteger(imageId) ||
        imageId < 1
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Valid product and image IDs are required."
        });
    }

    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const [imageRows] =
            await connection.query(
                `
                SELECT
                    id,
                    image_url
                FROM product_images
                WHERE id = ?
                  AND product_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    imageId,
                    productId
                ]
            );

        if (
            imageRows.length === 0
        ) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Product image not found."
            });
        }

        await normalizeImageOrder(
            connection,
            productId,
            imageId
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
                "Main product image updated successfully.",
            productId,
            imageId,
            mainImage
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Set main image error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update the main product image.",
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
// Admin: Delete One Product Image
// ==========================================
exports.deleteProductImage = async (
    req,
    res
) => {
    const productId =
        Number(req.params.id);

    const imageId =
        Number(req.params.imageId);

    if (
        !Number.isInteger(productId) ||
        productId < 1 ||
        !Number.isInteger(imageId) ||
        imageId < 1
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Valid product and image IDs are required."
        });
    }

    const connection =
        await db.getConnection();

    let deletedImageName = null;

    try {
        await connection.beginTransaction();

        const [imageRows] =
            await connection.query(
                `
                SELECT
                    id,
                    image_url
                FROM product_images
                WHERE id = ?
                  AND product_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    imageId,
                    productId
                ]
            );

        if (
            imageRows.length === 0
        ) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Product image not found."
            });
        }

        deletedImageName =
            imageRows[0].image_url;

        await connection.query(
            `
            DELETE FROM product_images
            WHERE id = ?
              AND product_id = ?
            `,
            [
                imageId,
                productId
            ]
        );

        await normalizeImageOrder(
            connection,
            productId
        );

        const mainImage =
            await synchronizeMainImage(
                connection,
                productId
            );

        await connection.commit();

        await removeImageFile(
            deletedImageName
        );

        return res.json({
            success: true,
            message:
                "Product image deleted successfully.",
            productId,
            imageId,
            mainImage
        });
    } catch (error) {
        await connection.rollback();

        console.error(
            "Delete product image error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete the product image.",
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