const db = require("../config/db");

// ==========================
// Add Review
// ==========================
exports.addReview = async (req, res) => {

    try {

        const customer_id = req.user.id;

        const {
            product_id,
            rating,
            comment
        } = req.body;

        // Validation
        if (!product_id || !rating) {
            return res.status(400).json({
                success: false,
                message: "Product ID and rating are required."
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5."
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

        // Prevent duplicate reviews
        const [existingReview] = await db.query(
            `SELECT id
             FROM reviews
             WHERE customer_id = ?
             AND product_id = ?`,
            [customer_id, product_id]
        );

        if (existingReview.length > 0) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product."
            });
        }

        // Insert review
        const [result] = await db.query(
            `INSERT INTO reviews
            (customer_id, product_id, rating, comment)
            VALUES (?, ?, ?, ?)`,
            [
                customer_id,
                product_id,
                rating,
                comment || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Review added successfully.",
            reviewId: result.insertId
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
// Get Product Reviews
// ==========================
exports.getProductReviews = async (req, res) => {

    try {

        const { id } = req.params;

        // Check product exists
        const [product] = await db.query(
            "SELECT id FROM products WHERE id = ?",
            [id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const [reviews] = await db.query(

            `SELECT
                c.full_name,
                r.rating,
                r.comment,
                r.created_at

             FROM reviews r

             JOIN customers c
             ON r.customer_id = c.id

             WHERE r.product_id = ?

             ORDER BY r.created_at DESC`,
            [id]

        );

        const [[stats]] = await db.query(

            `SELECT
                COUNT(*) AS totalReviews,
                ROUND(AVG(rating),1) AS averageRating

             FROM reviews

             WHERE product_id = ?`,
            [id]

        );

        res.json({
            success: true,
            averageRating: stats.averageRating || 0,
            totalReviews: stats.totalReviews,
            reviews
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
// Update Review
// ==========================
exports.updateReview = async (req, res) => {

    try {

        const customer_id = req.user.id;
        const { id } = req.params;
        const { rating, comment } = req.body;

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5."
            });
        }

        // Check review exists and belongs to customer
        const [review] = await db.query(
            `SELECT id
             FROM reviews
             WHERE id = ?
             AND customer_id = ?`,
            [id, customer_id]
        );

        if (review.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        // Update review
        await db.query(
            `UPDATE reviews
             SET rating = ?, comment = ?
             WHERE id = ?`,
            [
                rating,
                comment || null,
                id
            ]
        );

        res.json({
            success: true,
            message: "Review updated successfully."
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
// Delete Review
// ==========================
exports.deleteReview = async (req, res) => {

    try {

        const customer_id = req.user.id;
        const { id } = req.params;

        // Check review exists
        const [review] = await db.query(
            `SELECT id
             FROM reviews
             WHERE id = ?
             AND customer_id = ?`,
            [id, customer_id]
        );

        if (review.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        await db.query(
            "DELETE FROM reviews WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Review deleted successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};