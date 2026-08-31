"use strict";

const db = require("../config/db");

// ==========================================
// Add Product to Cart
// ==========================================
exports.addToCart = async (req, res) => {
    try {
        const customerId = req.user.id;

        const productId =
            Number(req.body.product_id);

        const quantity =
            Number(req.body.quantity || 1);

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

        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Quantity must be at least 1."
            });
        }

        const [productRows] =
            await db.query(
                `
                SELECT
                    id,
                    product_name,
                    selling_price,
                    stock_quantity,
                    status
                FROM products
                WHERE id = ?
                LIMIT 1
                `,
                [productId]
            );

        if (productRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const product = productRows[0];

        if (
            String(product.status).toLowerCase() ===
            "inactive"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This product is currently unavailable."
            });
        }

        if (
            Number(product.stock_quantity) < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This product is out of stock."
            });
        }

        const [existingRows] =
            await db.query(
                `
                SELECT
                    id,
                    quantity
                FROM cart
                WHERE customer_id = ?
                  AND product_id = ?
                LIMIT 1
                `,
                [
                    customerId,
                    productId
                ]
            );

        const existingQuantity =
            existingRows.length > 0
                ? Number(
                    existingRows[0].quantity
                )
                : 0;

        const requestedTotal =
            existingQuantity + quantity;

        if (
            requestedTotal >
            Number(product.stock_quantity)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Only ${product.stock_quantity} unit(s) of ${product.product_name} are available.`,
                availableStock:
                    Number(
                        product.stock_quantity
                    ),
                currentCartQuantity:
                    existingQuantity
            });
        }

        if (existingRows.length > 0) {
            await db.query(
                `
                UPDATE cart
                SET quantity = ?
                WHERE id = ?
                  AND customer_id = ?
                `,
                [
                    requestedTotal,
                    existingRows[0].id,
                    customerId
                ]
            );

            return res.json({
                success: true,
                message:
                    "Cart updated successfully.",
                cartItemId:
                    existingRows[0].id,
                quantity: requestedTotal
            });
        }

        const [result] =
            await db.query(
                `
                INSERT INTO cart
                (
                    customer_id,
                    product_id,
                    quantity
                )
                VALUES (?, ?, ?)
                `,
                [
                    customerId,
                    productId,
                    quantity
                ]
            );

        return res.status(201).json({
            success: true,
            message:
                "Product added to cart.",
            cartItemId: result.insertId,
            quantity
        });
    } catch (error) {
        console.error(
            "Add to cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to add product to cart.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// ==========================================
// Get Logged-In Customer Cart
// ==========================================
exports.getCart = async (req, res) => {
    try {
        const customerId = req.user.id;

        const [cart] =
            await db.query(
                `
                SELECT
                    c.id AS cart_id,
                    p.id AS product_id,
                    p.product_name,

                    p.selling_price AS price,
                    p.selling_price,

                    COALESCE(
                        (
                            SELECT
                                pi.image_url
                            FROM product_images pi
                            WHERE
                                pi.product_id =
                                p.id
                            ORDER BY
                                pi.sort_order ASC,
                                pi.id ASC
                            LIMIT 1
                        ),
                        p.image
                    ) AS image,

                    p.stock_quantity,
                    p.stock_status,
                    p.status AS product_status,
                    c.quantity,

                    (
                        p.selling_price *
                        c.quantity
                    ) AS subtotal

                FROM cart c

                INNER JOIN products p
                    ON p.id = c.product_id

                WHERE c.customer_id = ?

                ORDER BY c.id DESC
                `,
                [customerId]
            );

        const grandTotal =
            cart.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.subtotal || 0
                    ),
                0
            );

        return res.json({
            success: true,
            itemCount: cart.length,
            cart,
            grandTotal:
                Number(
                    grandTotal.toFixed(2)
                )
        });
    } catch (error) {
        console.error(
            "Get cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve cart.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// ==========================================
// Update Cart Quantity
// ==========================================
exports.updateCart = async (
    req,
    res
) => {
    try {
        const customerId = req.user.id;
        const cartItemId =
            Number(req.params.id);
        const quantity =
            Number(req.body.quantity);

        if (
            !Number.isInteger(cartItemId) ||
            cartItemId < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid cart item ID is required."
            });
        }

        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Quantity must be at least 1."
            });
        }

        const [cartRows] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.product_id,
                    p.product_name,
                    p.stock_quantity,
                    p.status
                FROM cart c

                INNER JOIN products p
                    ON p.id = c.product_id

                WHERE c.id = ?
                  AND c.customer_id = ?

                LIMIT 1
                `,
                [
                    cartItemId,
                    customerId
                ]
            );

        if (cartRows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Cart item not found."
            });
        }

        const cartItem = cartRows[0];

        if (
            String(cartItem.status)
                .toLowerCase() ===
            "inactive"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This product is currently unavailable."
            });
        }

        if (
            quantity >
            Number(
                cartItem.stock_quantity
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Only ${cartItem.stock_quantity} unit(s) of ${cartItem.product_name} are available.`,
                availableStock:
                    Number(
                        cartItem.stock_quantity
                    )
            });
        }

        await db.query(
            `
            UPDATE cart
            SET quantity = ?
            WHERE id = ?
              AND customer_id = ?
            `,
            [
                quantity,
                cartItemId,
                customerId
            ]
        );

        return res.json({
            success: true,
            message:
                "Cart updated successfully.",
            cartItemId,
            quantity
        });
    } catch (error) {
        console.error(
            "Update cart error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update cart.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// ==========================================
// Remove Item from Cart
// ==========================================
exports.removeFromCart = async (
    req,
    res
) => {
    try {
        const customerId = req.user.id;
        const cartItemId =
            Number(req.params.id);

        if (
            !Number.isInteger(cartItemId) ||
            cartItemId < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid cart item ID is required."
            });
        }

        const [result] =
            await db.query(
                `
                DELETE FROM cart
                WHERE id = ?
                  AND customer_id = ?
                `,
                [
                    cartItemId,
                    customerId
                ]
            );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Cart item not found."
            });
        }

        return res.json({
            success: true,
            message:
                "Item removed from cart successfully."
        });
    } catch (error) {
        console.error(
            "Remove cart item error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to remove cart item.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};