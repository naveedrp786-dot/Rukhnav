const db = require("../config/db");

const toNumber = (value) => Number(value || 0);

const normaliseRowNumbers = (row, keys) => {
    const result = { ...row };
    keys.forEach((key) => {
        result[key] = toNumber(result[key]);
    });
    return result;
};

exports.getSummary = async () => {
    const [revenueRows, orderRows, customerRows, inventoryRows, paymentRows] =
        await Promise.all([
            db.query(`
                SELECT
                    COALESCE(SUM(CASE
                        WHEN payment_status = 'Paid' THEN grand_total
                        ELSE 0
                    END), 0) AS total_revenue,
                    COALESCE(SUM(CASE
                        WHEN payment_status = 'Paid'
                         AND DATE(created_at) = CURDATE()
                        THEN grand_total ELSE 0
                    END), 0) AS today_revenue,
                    COALESCE(SUM(CASE
                        WHEN payment_status = 'Paid'
                         AND YEAR(created_at) = YEAR(CURDATE())
                         AND MONTH(created_at) = MONTH(CURDATE())
                        THEN grand_total ELSE 0
                    END), 0) AS month_revenue,
                    COALESCE(SUM(CASE
                        WHEN payment_status = 'Paid'
                         AND YEAR(created_at) = YEAR(CURDATE())
                        THEN grand_total ELSE 0
                    END), 0) AS year_revenue
                FROM orders
            `),
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    SUM(LOWER(order_status) = 'pending') AS pending,
                    SUM(LOWER(order_status) = 'confirmed') AS confirmed,
                    SUM(LOWER(order_status) = 'processing') AS processing,
                    SUM(LOWER(order_status) = 'shipped') AS shipped,
                    SUM(LOWER(order_status) = 'delivered') AS delivered,
                    SUM(LOWER(order_status) = 'cancelled') AS cancelled
                FROM orders
            `),
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    SUM(LOWER(status) = 'active') AS active,
                    SUM(
                        YEAR(created_at) = YEAR(CURDATE())
                        AND MONTH(created_at) = MONTH(CURDATE())
                    ) AS new_this_month
                FROM customers
            `),
            db.query(`
                SELECT
                    COUNT(*) AS total_products,
                    SUM(LOWER(status) = 'active') AS active_products,
                    SUM(stock_quantity > 0 AND stock_quantity <= low_stock_level)
                        AS low_stock,
                    SUM(stock_quantity <= 0) AS out_of_stock,
                    COALESCE(SUM(stock_quantity), 0) AS total_units,
                    COALESCE(SUM(selling_price * stock_quantity), 0)
                        AS inventory_value
                FROM products
            `),
            db.query(`
                SELECT
                    SUM(LOWER(payment_status) = 'paid') AS paid_orders,
                    SUM(LOWER(payment_status) = 'pending') AS pending_orders,
                    COALESCE(SUM(CASE
                        WHEN LOWER(payment_status) = 'pending'
                         AND LOWER(order_status) <> 'cancelled'
                        THEN grand_total ELSE 0
                    END), 0) AS pending_value
                FROM orders
            `)
        ]);

    return {
        revenue: normaliseRowNumbers(revenueRows[0][0], [
            "total_revenue",
            "today_revenue",
            "month_revenue",
            "year_revenue"
        ]),
        orders: normaliseRowNumbers(orderRows[0][0], [
            "total",
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled"
        ]),
        customers: normaliseRowNumbers(customerRows[0][0], [
            "total",
            "active",
            "new_this_month"
        ]),
        inventory: normaliseRowNumbers(inventoryRows[0][0], [
            "total_products",
            "active_products",
            "low_stock",
            "out_of_stock",
            "total_units",
            "inventory_value"
        ]),
        payments: normaliseRowNumbers(paymentRows[0][0], [
            "paid_orders",
            "pending_orders",
            "pending_value"
        ])
    };
};

exports.getLatestOrders = async (limit = 10) => {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);

    const [rows] = await db.query(
        `SELECT
            o.id,
            o.customer_id,
            o.full_name,
            o.phone,
            o.email,
            o.city,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.grand_total,
            o.created_at,
            COUNT(oi.id) AS line_items,
            COALESCE(SUM(oi.quantity), 0) AS total_quantity
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         GROUP BY
            o.id,
            o.customer_id,
            o.full_name,
            o.phone,
            o.email,
            o.city,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.grand_total,
            o.created_at
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT ?`,
        [safeLimit]
    );

    return rows.map((row) => normaliseRowNumbers(row, [
        "id",
        "customer_id",
        "grand_total",
        "line_items",
        "total_quantity"
    ]));
};

exports.getLowStockProducts = async (limit = 10) => {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);

    const [rows] = await db.query(
        `SELECT
            id,
            product_name,
            sku,
            selling_price,
            stock_quantity,
            low_stock_level,
            stock_status,
            status
         FROM products
         WHERE stock_quantity <= low_stock_level
         ORDER BY stock_quantity ASC, product_name ASC
         LIMIT ?`,
        [safeLimit]
    );

    return rows.map((row) => normaliseRowNumbers(row, [
        "id",
        "selling_price",
        "stock_quantity",
        "low_stock_level"
    ]));
};

exports.getRecentCustomers = async (limit = 10) => {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 50);

    const [rows] = await db.query(
        `SELECT
            id,
            full_name,
            email,
            phone,
            status,
            created_at
         FROM customers
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [safeLimit]
    );

    return rows.map((row) => normaliseRowNumbers(row, ["id"]));
};
