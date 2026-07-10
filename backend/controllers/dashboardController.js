const db = require("../config/db");

exports.getDashboard = async (req, res) => {

    try {

        const customerId = req.user.id;

        // Profile
        const [profile] = await db.query(
    `SELECT
        c.full_name,
        c.email,
        cp.profile_picture
     FROM customers c
     LEFT JOIN customer_profiles cp
        ON c.id = cp.customer_id
     WHERE c.id = ?`,
    [customerId]
);
if (profile.length && profile[0].profile_picture) {
    profile[0].profile_picture =
        `${req.protocol}://${req.get("host")}/${profile[0].profile_picture}`;
}

        // Total Orders
        const [orders] = await db.query(
            `SELECT COUNT(*) AS totalOrders
             FROM orders
             WHERE customer_id = ?`,
            [customerId]
        );

        // Wishlist Count
        const [wishlist] = await db.query(
            `SELECT COUNT(*) AS totalWishlist
             FROM wishlist
             WHERE customer_id = ?`,
            [customerId]
        );

        // Cart Count
        const [cart] = await db.query(
            `SELECT COUNT(*) AS totalCart
             FROM cart
             WHERE customer_id = ?`,
            [customerId]
        );

        // Reviews Count
        const [reviews] = await db.query(
            `SELECT COUNT(*) AS totalReviews
             FROM reviews
             WHERE customer_id = ?`,
            [customerId]
        );

        // Recent Orders
        const [recentOrders] = await db.query(
            `SELECT
                id,
                total_amount,
                order_status,
                created_at
             FROM orders
             WHERE customer_id = ?
             ORDER BY id DESC
             LIMIT 5`,
            [customerId]
        );

        res.json({
            success: true,
            dashboard: {
                customer: profile[0],
                totalOrders: orders[0].totalOrders,
                totalWishlist: wishlist[0].totalWishlist,
                totalCart: cart[0].totalCart,
                totalReviews: reviews[0].totalReviews,
                recentOrders
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};