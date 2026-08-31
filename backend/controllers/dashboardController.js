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

// ==========================
// Sales Analytics
// ==========================
exports.salesAnalytics = async (req, res) => {

    try {

        const [[today]] = await db.query(`
            SELECT
                COUNT(*) AS totalOrders,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE DATE(created_at) = CURDATE()
            AND payment_status='Paid'
        `);

        const [[month]] = await db.query(`
            SELECT
                COUNT(*) AS totalOrders,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE MONTH(created_at)=MONTH(CURDATE())
            AND YEAR(created_at)=YEAR(CURDATE())
            AND payment_status='Paid'
        `);

        const [[year]] = await db.query(`
            SELECT
                COUNT(*) AS totalOrders,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE YEAR(created_at)=YEAR(CURDATE())
            AND payment_status='Paid'
        `);

        res.json({
            success: true,
            analytics: {
                today: {
                    orders: today.totalOrders,
                    revenue: today.revenue || 0
                },
                thisMonth: {
                    orders: month.totalOrders,
                    revenue: month.revenue || 0
                },
                thisYear: {
                    orders: year.totalOrders,
                    revenue: year.revenue || 0
                }
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================
// Best Selling Products
// ==========================
exports.bestSellingProducts = async (req, res) => {

    try {

        const [products] = await db.query(`
            SELECT
                p.id,
                p.product_name,
                SUM(oi.quantity) AS quantitySold,
                SUM(oi.subtotal) AS revenue,
                COUNT(DISTINCT oi.order_id) AS orders
            FROM order_items oi
            JOIN products p
                ON oi.product_id = p.id
            JOIN orders o
                ON oi.order_id = o.id
            WHERE
                o.payment_status = 'Paid'
                AND o.order_status = 'Delivered'
            GROUP BY p.id, p.product_name
            ORDER BY quantitySold DESC
        `);

        res.json({
            success: true,
            products
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================
// Top Customers Report
// ==========================
exports.topCustomers = async (req, res) => {

    try {

        const [customers] = await db.query(`
            SELECT
                c.id,
                c.full_name,
                c.email,
                COUNT(o.id) AS totalOrders,
                SUM(o.total_amount) AS totalSpent,
                cr.reward_points,
                cr.membership_level
            FROM customers c
            JOIN orders o
                ON c.id = o.customer_id
            LEFT JOIN customer_rewards cr
                ON c.id = cr.customer_id
            WHERE
                o.payment_status = 'Paid'
                AND o.order_status = 'Delivered'
            GROUP BY
                c.id,
                c.full_name,
                c.email,
                cr.reward_points,
                cr.membership_level
            ORDER BY totalSpent DESC
        `);

        res.json({
            success: true,
            customers
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================
// Sales by Category
// ==========================
exports.salesByCategory = async (req, res) => {

    try {

        const [categories] = await db.query(`
            SELECT
                p.category,
                COUNT(DISTINCT oi.order_id) AS totalOrders,
                SUM(oi.quantity) AS productsSold,
                SUM(oi.subtotal) AS revenue
            FROM order_items oi
            JOIN products p
                ON oi.product_id = p.id
            JOIN orders o
                ON oi.order_id = o.id
            WHERE
                o.payment_status = 'Paid'
                AND o.order_status = 'Delivered'
            GROUP BY p.category
            ORDER BY revenue DESC
        `);

        res.json({
            success: true,
            categories
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================
// Monthly Sales Trend
// ==========================
exports.monthlySalesTrend = async (req, res) => {

    try {

        const [sales] = await db.query(`
            SELECT
                MONTHNAME(created_at) AS month,
                MONTH(created_at) AS monthNumber,
                COUNT(*) AS totalOrders,
                SUM(total_amount) AS revenue
            FROM orders
            WHERE
                payment_status = 'Paid'
                AND order_status = 'Delivered'
                AND YEAR(created_at) = YEAR(CURDATE())
            GROUP BY
                MONTH(created_at),
                MONTHNAME(created_at)
            ORDER BY
                MONTH(created_at)
        `);

        res.json({
            success: true,
            salesTrend: sales
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================
// Customer Growth Analytics
// ==========================
exports.customerGrowth = async (req, res) => {

    try {

        const [customers] = await db.query(`
            SELECT
                MONTHNAME(created_at) AS month,
                MONTH(created_at) AS monthNumber,
                COUNT(*) AS newCustomers
            FROM customers
            WHERE YEAR(created_at) = YEAR(CURDATE())
            GROUP BY
                MONTH(created_at),
                MONTHNAME(created_at)
            ORDER BY
                MONTH(created_at)
        `);

        res.json({
            success: true,
            customerGrowth: customers
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// =======================================
// Admin Dashboard Summary
// =======================================
exports.getAdminDashboard = async (req, res) => {

    try {

        const [[products]] = await db.query(
            "SELECT COUNT(*) AS total FROM products"
        );

        const [[customers]] = await db.query(
            "SELECT COUNT(*) AS total FROM customers"
        );

        const [[orders]] = await db.query(
            "SELECT COUNT(*) AS total FROM orders"
        );

        const [[sales]] = await db.query(
            `SELECT IFNULL(SUM(total_amount),0) AS revenue
             FROM orders
             WHERE payment_status='Paid'`
        );

        const [[inventory]] = await db.query(
            `SELECT IFNULL(SUM(price * stock_quantity),0) AS value
             FROM products`
        );

        const [[lowStock]] = await db.query(
            `SELECT COUNT(*) AS total
             FROM products
             WHERE stock_quantity <= low_stock_level`
        );

        res.json({
            success: true,
            dashboard: {
                products: products.total,
                customers: customers.total,
                orders: orders.total,
                revenue: sales.revenue,
                inventory: inventory.value,
                lowStock: lowStock.total
            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};