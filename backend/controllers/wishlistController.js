const db = require("../config/db");

// ==========================
// Add Product to Wishlist
// ==========================
exports.addToWishlist = async (req, res) => {

    try {

        const customer_id = req.user.id;
        const { product_id } = req.body;

        // Validate
        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required."
            });
        }

        // Check product exists
        const [product] = await db.query(
            "SELECT id FROM products WHERE id = ?",
            [product_id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // Check duplicate
        const [existing] = await db.query(
            `SELECT id
             FROM wishlist
             WHERE customer_id = ?
             AND product_id = ?`,
            [customer_id, product_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Product already exists in wishlist."
            });
        }

        // Insert
        const [result] = await db.query(
            `INSERT INTO wishlist
            (customer_id, product_id)
            VALUES (?, ?)`,
            [customer_id, product_id]
        );

        res.status(201).json({
            success: true,
            message: "Product added to wishlist.",
            wishlistId: result.insertId
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
// Get Customer Wishlist
// ==========================
exports.getWishlist = async (req, res) => {

    try {

        const customer_id = req.user.id;

        const [wishlist] = await db.query(

    `SELECT
        w.id AS wishlist_id,
        p.id AS product_id,
        p.product_name,
        p.selling_price AS price,
        p.image,
        p.stock_quantity AS stock,
        p.status,
        w.created_at

     FROM wishlist w

     JOIN products p
        ON w.product_id = p.id

     WHERE w.customer_id = ?

     ORDER BY w.created_at DESC`,
    [customer_id]

);

        res.json({
            success: true,
            totalItems: wishlist.length,
            wishlist
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
// Remove Product from Wishlist
// ==========================
exports.removeFromWishlist = async (req, res) => {

    try {

        const customer_id = req.user.id;
        const { id } = req.params;

        // Check wishlist item belongs to customer
        const [wishlist] = await db.query(
            `SELECT id
             FROM wishlist
             WHERE id = ?
             AND customer_id = ?`,
            [id, customer_id]
        );

        if (wishlist.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Wishlist item not found."
            });
        }

        // Delete item
        await db.query(
            "DELETE FROM wishlist WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Product removed from wishlist."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};