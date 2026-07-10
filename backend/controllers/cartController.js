const db = require("../config/db");

// ==========================
// Add Product to Cart
// ==========================
exports.addToCart = async (req, res) => {
    try {

        const customer_id = req.user.id;
        const { product_id, quantity } = req.body;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required."
            });
        }

        const qty = quantity || 1;

        // Check if product exists
        const [product] = await db.query(
            "SELECT id, stock FROM products WHERE id = ?",
            [product_id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // Check if already in cart
        const [existing] = await db.query(
            "SELECT id, quantity FROM cart WHERE customer_id=? AND product_id=?",
            [customer_id, product_id]
        );

        if (existing.length > 0) {

            await db.query(
                "UPDATE cart SET quantity = quantity + ? WHERE id=?",
                [qty, existing[0].id]
            );

            return res.json({
                success: true,
                message: "Cart updated successfully."
            });
        }

        await db.query(
            "INSERT INTO cart (customer_id, product_id, quantity) VALUES (?,?,?)",
            [customer_id, product_id, qty]
        );

        res.status(201).json({
            success: true,
            message: "Product added to cart."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// ==========================
// View My Cart
// ==========================
exports.getCart = async (req, res) => {
    try {

        const customer_id = req.user.id;

        const [cart] = await db.query(
            `SELECT
                c.id AS cart_id,
                p.id AS product_id,
                p.product_name,
                p.price,
                p.image,
                c.quantity,
                (p.price * c.quantity) AS subtotal
             FROM cart c
             JOIN products p
               ON c.product_id = p.id
             WHERE c.customer_id = ?`,
            [customer_id]
        );

        const grandTotal = cart.reduce(
            (sum, item) => sum + Number(item.subtotal),
            0
        );

        res.json({
            success: true,
            cart,
            grandTotal
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// ==========================
// Update Cart Quantity
// ==========================
exports.updateCart = async (req, res) => {
    try {

        const customer_id = req.user.id;
        const { id } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be at least 1."
            });
        }

        // Check cart item
        const [cartItem] = await db.query(
            `SELECT c.id, c.product_id, p.stock
             FROM cart c
             JOIN products p ON c.product_id = p.id
             WHERE c.id = ? AND c.customer_id = ?`,
            [id, customer_id]
        );

        if (cartItem.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });
        }

        if (quantity > cartItem[0].stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${cartItem[0].stock} items available in stock.`
            });
        }

        await db.query(
            "UPDATE cart SET quantity=? WHERE id=?",
            [quantity, id]
        );

        res.json({
            success: true,
            message: "Cart updated successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// ==========================
// Remove Item From Cart
// ==========================
exports.removeFromCart = async (req, res) => {

    try {

        const customer_id = req.user.id;
        const { id } = req.params;

        // Check if the cart item belongs to the logged-in customer
        const [cartItem] = await db.query(
            "SELECT id FROM cart WHERE id = ? AND customer_id = ?",
            [id, customer_id]
        );

        if (cartItem.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found."
            });
        }

        await db.query(
            "DELETE FROM cart WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Item removed from cart successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};