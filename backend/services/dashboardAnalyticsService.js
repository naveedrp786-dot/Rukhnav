"use strict";

const db = require("../config/db");
const {
    clampInteger,
    createDailyBuckets,
    createMonthlyBuckets
} = require("../utils/dateRange");

const toNumber = (value) => Number(value || 0);

exports.getDailySales = async (days = 30) => {
    const safeDays = clampInteger(days, 30, 7, 90);

    const [rows] = await db.query(
        `SELECT
            DATE_FORMAT(created_at, '%Y-%m-%d') AS sale_date,
            COUNT(*) AS orders,
            COALESCE(SUM(grand_total), 0) AS revenue
         FROM orders
         WHERE LOWER(payment_status) = 'paid'
           AND LOWER(order_status) <> 'cancelled'
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
         ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d') ASC`,
        [safeDays - 1]
    );

    const rowMap = new Map(
        rows.map((row) => [row.sale_date, {
            orders: toNumber(row.orders),
            revenue: toNumber(row.revenue)
        }])
    );

    return createDailyBuckets(safeDays).map((bucket) => ({
        ...bucket,
        ...(rowMap.get(bucket.date) || {})
    }));
};

exports.getMonthlyRevenue = async (months = 12) => {
    const safeMonths = clampInteger(months, 12, 1, 24);

    const [rows] = await db.query(
        `SELECT
            DATE_FORMAT(created_at, '%Y-%m') AS month_key,
            COUNT(*) AS orders,
            COALESCE(SUM(grand_total), 0) AS revenue
         FROM orders
         WHERE LOWER(payment_status) = 'paid'
           AND LOWER(order_status) <> 'cancelled'
           AND created_at >= DATE_FORMAT(
                DATE_SUB(CURDATE(), INTERVAL ? MONTH),
                '%Y-%m-01'
           )
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY DATE_FORMAT(created_at, '%Y-%m')`,
        [safeMonths - 1]
    );

    const rowMap = new Map(
        rows.map((row) => [row.month_key, {
            orders: toNumber(row.orders),
            revenue: toNumber(row.revenue)
        }])
    );

    return createMonthlyBuckets(safeMonths).map((bucket) => ({
        month_key: bucket.month_key,
        year: bucket.year,
        month_number: bucket.month_number,
        month_name: bucket.month_name,
        orders: rowMap.get(bucket.month_key)?.orders || 0,
        revenue: rowMap.get(bucket.month_key)?.revenue || 0
    }));
};

exports.getOrderStatusDistribution = async () => {
    const statuses = [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled"
    ];

    const [rows] = await db.query(
        `SELECT order_status AS status, COUNT(*) AS total
         FROM orders
         GROUP BY order_status`
    );

    const rowMap = new Map(
        rows.map((row) => [String(row.status).toLowerCase(), toNumber(row.total)])
    );

    return statuses.map((status) => ({
        status,
        total: rowMap.get(status.toLowerCase()) || 0
    }));
};

exports.getTopSellingProducts = async (limit = 10) => {
    const safeLimit = clampInteger(limit, 10, 1, 50);

    const [rows] = await db.query(
        `SELECT
            p.id AS product_id,
            p.product_name,
            p.sku,
            COUNT(DISTINCT oi.order_id) AS orders,
            COALESCE(SUM(oi.quantity), 0) AS units_sold,
            COALESCE(SUM(oi.subtotal), 0) AS revenue
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         INNER JOIN products p ON p.id = oi.product_id
         WHERE LOWER(o.payment_status) = 'paid'
           AND LOWER(o.order_status) = 'delivered'
         GROUP BY p.id, p.product_name, p.sku
         ORDER BY units_sold DESC, revenue DESC, p.id ASC
         LIMIT ?`,
        [safeLimit]
    );

    return rows.map((row) => ({
        ...row,
        product_id: toNumber(row.product_id),
        orders: toNumber(row.orders),
        units_sold: toNumber(row.units_sold),
        revenue: toNumber(row.revenue)
    }));
};

exports.getPaymentMethodStatistics = async () => {
    const [rows] = await db.query(
        `SELECT
            payment_method,
            COUNT(*) AS order_count,
            SUM(LOWER(payment_status) = 'paid') AS paid_order_count,
            COALESCE(SUM(grand_total), 0) AS order_value,
            COALESCE(SUM(CASE
                WHEN LOWER(payment_status) = 'paid' THEN grand_total
                ELSE 0
            END), 0) AS paid_value
         FROM orders
         WHERE LOWER(order_status) <> 'cancelled'
         GROUP BY payment_method
         ORDER BY order_count DESC, payment_method ASC`
    );

    return rows.map((row) => ({
        payment_method: row.payment_method || "Unknown",
        order_count: toNumber(row.order_count),
        paid_order_count: toNumber(row.paid_order_count),
        order_value: toNumber(row.order_value),
        paid_value: toNumber(row.paid_value)
    }));
};

exports.getCustomerGrowth = async (months = 12) => {
    const safeMonths = clampInteger(months, 12, 1, 24);

    const [rows] = await db.query(
        `SELECT
            DATE_FORMAT(created_at, '%Y-%m') AS month_key,
            COUNT(*) AS customers
         FROM customers
         WHERE created_at >= DATE_FORMAT(
            DATE_SUB(CURDATE(), INTERVAL ? MONTH),
            '%Y-%m-01'
         )
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY DATE_FORMAT(created_at, '%Y-%m')`,
        [safeMonths - 1]
    );

    const rowMap = new Map(
        rows.map((row) => [row.month_key, toNumber(row.customers)])
    );

    return createMonthlyBuckets(safeMonths).map((bucket) => ({
        month_key: bucket.month_key,
        year: bucket.year,
        month_number: bucket.month_number,
        month_name: bucket.month_name,
        customers: rowMap.get(bucket.month_key) || 0
    }));
};
