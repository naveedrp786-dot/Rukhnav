"use strict";

const db = require("../config/db");

// =========================================
// Reports Dashboard Summary
// GET /api/reports/dashboard
// =========================================

exports.getDashboardSummary = async (req, res) => {
    try {
        // =====================================
        // Sales summary
        // =====================================

        const [[salesSummary]] = await db.query(`
            SELECT
                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    SUM(
                        CASE
                            WHEN payment_status = 'Paid'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_sales_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN payment_status = 'Partial'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS partial_sales_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN payment_status = 'Pending'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_sales_value,

                COUNT(
                    CASE
                        WHEN payment_status = 'Paid'
                        THEN 1
                    END
                ) AS paid_sales_count,

                COUNT(
                    CASE
                        WHEN payment_status = 'Partial'
                        THEN 1
                    END
                ) AS partial_sales_count,

                COUNT(
                    CASE
                        WHEN payment_status = 'Pending'
                        THEN 1
                    END
                ) AS pending_sales_count

            FROM sales

            WHERE sale_status = 'Completed'
        `);

        // =====================================
        // Today's sales summary
        // =====================================

        const [[todaySales]] = await db.query(`
            SELECT
                COUNT(*) AS sales_count,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS sales_value

            FROM sales

            WHERE sale_status = 'Completed'
            AND DATE(sale_date) = CURDATE()
        `);

        // =====================================
        // Purchase summary
        // =====================================

        const [[purchaseSummary]] = await db.query(`
            SELECT
                COUNT(*) AS total_purchase_orders,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_purchases,

                COALESCE(
                    SUM(paid_amount),
                    0
                ) AS total_paid,

                COALESCE(
                    SUM(balance_amount),
                    0
                ) AS total_outstanding,

                COUNT(
                    CASE
                        WHEN status = 'Received'
                        THEN 1
                    END
                ) AS received_orders,

                COUNT(
                    CASE
                        WHEN status = 'Ordered'
                        THEN 1
                    END
                ) AS ordered_purchases,

                COUNT(
                    CASE
                        WHEN status = 'Draft'
                        THEN 1
                    END
                ) AS draft_purchases

            FROM purchase_orders

            WHERE status != 'Cancelled'
        `);

        // =====================================
        // Inventory summary
        // =====================================

        const [[inventorySummary]] = await db.query(`
            SELECT
                COUNT(*) AS total_products,

                COALESCE(
                    SUM(stock_quantity),
                    0
                ) AS total_stock_quantity,

                COALESCE(
                    SUM(
                        cost_price * stock_quantity
                    ),
                    0
                ) AS inventory_cost_value,

                COALESCE(
                    SUM(
                        selling_price * stock_quantity
                    ),
                    0
                ) AS inventory_selling_value,

                COALESCE(
                    SUM(
                        (
                            selling_price - cost_price
                        ) * stock_quantity
                    ),
                    0
                ) AS expected_inventory_profit,

                COUNT(
                    CASE
                        WHEN stock_quantity > 0
                        AND stock_quantity <= low_stock_level
                        THEN 1
                    END
                ) AS low_stock_products,

                COUNT(
                    CASE
                        WHEN stock_quantity <= 0
                        THEN 1
                    END
                ) AS out_of_stock_products

            FROM products

            WHERE status IS NULL
            OR LOWER(status) != 'inactive'
        `);

        // =====================================
        // Customer summary
        // =====================================

        const [[customerSummary]] = await db.query(`
            SELECT
                COUNT(*) AS total_customers,

                COUNT(
                    CASE
                        WHEN status = 'Active'
                        THEN 1
                    END
                ) AS active_customers,

                COUNT(
                    CASE
                        WHEN status = 'Pending Verification'
                        THEN 1
                    END
                ) AS pending_verification,

                COUNT(
                    CASE
                        WHEN status = 'Inactive'
                        THEN 1
                    END
                ) AS inactive_customers,

                COUNT(
                    CASE
                        WHEN DATE(created_at) = CURDATE()
                        THEN 1
                    END
                ) AS new_customers_today

            FROM customers

            WHERE deleted_at IS NULL
        `);

        // =====================================
        // Supplier summary
        // =====================================

        const [[supplierSummary]] = await db.query(`
            SELECT
                COUNT(*) AS total_suppliers,

                COUNT(
                    CASE
                        WHEN status = 'Active'
                        THEN 1
                    END
                ) AS active_suppliers,

                COUNT(
                    CASE
                        WHEN status = 'Inactive'
                        THEN 1
                    END
                ) AS inactive_suppliers,

                COALESCE(
                    SUM(current_balance),
                    0
                ) AS supplier_current_balance

            FROM suppliers
        `);

        // =====================================
        // Recent sales
        // =====================================

        const [recentSales] = await db.query(`
            SELECT
                s.id,
                s.sale_number,
                s.sale_date,
                s.customer_id,
                c.full_name AS customer_name,
                s.grand_total,
                s.payment_status,
                s.payment_method,
                s.sale_status

            FROM sales s

            LEFT JOIN customers c
                ON c.id = s.customer_id

            ORDER BY
                s.sale_date DESC,
                s.id DESC

            LIMIT 5
        `);

        // =====================================
        // Final response
        // =====================================

        res.json({
            success: true,

            dashboard: {
                sales: {
                    totalSales:
                        Number(
                            salesSummary.total_sales || 0
                        ),

                    totalRevenue:
                        Number(
                            salesSummary.total_revenue || 0
                        ),

                    paidSalesValue:
                        Number(
                            salesSummary.paid_sales_value || 0
                        ),

                    partialSalesValue:
                        Number(
                            salesSummary.partial_sales_value || 0
                        ),

                    pendingSalesValue:
                        Number(
                            salesSummary.pending_sales_value || 0
                        ),

                    paidSalesCount:
                        Number(
                            salesSummary.paid_sales_count || 0
                        ),

                    partialSalesCount:
                        Number(
                            salesSummary.partial_sales_count || 0
                        ),

                    pendingSalesCount:
                        Number(
                            salesSummary.pending_sales_count || 0
                        ),

                    todaySalesCount:
                        Number(
                            todaySales.sales_count || 0
                        ),

                    todaySalesValue:
                        Number(
                            todaySales.sales_value || 0
                        )
                },

                purchases: {
                    totalPurchaseOrders:
                        Number(
                            purchaseSummary
                                .total_purchase_orders || 0
                        ),

                    totalPurchases:
                        Number(
                            purchaseSummary.total_purchases || 0
                        ),

                    totalPaid:
                        Number(
                            purchaseSummary.total_paid || 0
                        ),

                    totalOutstanding:
                        Number(
                            purchaseSummary.total_outstanding || 0
                        ),

                    receivedOrders:
                        Number(
                            purchaseSummary.received_orders || 0
                        ),

                    orderedPurchases:
                        Number(
                            purchaseSummary.ordered_purchases || 0
                        ),

                    draftPurchases:
                        Number(
                            purchaseSummary.draft_purchases || 0
                        )
                },

                inventory: {
                    totalProducts:
                        Number(
                            inventorySummary.total_products || 0
                        ),

                    totalStockQuantity:
                        Number(
                            inventorySummary
                                .total_stock_quantity || 0
                        ),

                    inventoryCostValue:
                        Number(
                            inventorySummary
                                .inventory_cost_value || 0
                        ),

                    inventorySellingValue:
                        Number(
                            inventorySummary
                                .inventory_selling_value || 0
                        ),

                    expectedInventoryProfit:
                        Number(
                            inventorySummary
                                .expected_inventory_profit || 0
                        ),

                    lowStockProducts:
                        Number(
                            inventorySummary
                                .low_stock_products || 0
                        ),

                    outOfStockProducts:
                        Number(
                            inventorySummary
                                .out_of_stock_products || 0
                        )
                },

                customers: {
                    totalCustomers:
                        Number(
                            customerSummary.total_customers || 0
                        ),

                    activeCustomers:
                        Number(
                            customerSummary.active_customers || 0
                        ),

                    pendingVerification:
                        Number(
                            customerSummary
                                .pending_verification || 0
                        ),

                    inactiveCustomers:
                        Number(
                            customerSummary
                                .inactive_customers || 0
                        ),

                    newCustomersToday:
                        Number(
                            customerSummary
                                .new_customers_today || 0
                        )
                },

                suppliers: {
                    totalSuppliers:
                        Number(
                            supplierSummary.total_suppliers || 0
                        ),

                    activeSuppliers:
                        Number(
                            supplierSummary.active_suppliers || 0
                        ),

                    inactiveSuppliers:
                        Number(
                            supplierSummary.inactive_suppliers || 0
                        ),

                    currentBalance:
                        Number(
                            supplierSummary
                                .supplier_current_balance || 0
                        )
                }
            },

            recentSales
        });

    } catch (error) {
        console.error(
            "Reports dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load reports dashboard.",
            error: error.message
        });
    }
};
// =========================================
// Daily Sales Report
// GET /api/reports/sales/daily
// =========================================

exports.getDailySalesReport = async (req, res) => {
    try {
        const reportDate =
            req.query.date || null;

        const selectedDate =
            reportDate || new Date()
                .toISOString()
                .split("T")[0];

        const [[summary]] = await db.query(`
            SELECT
                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(discount),
                    0
                ) AS discount,

                COALESCE(
                    SUM(tax),
                    0
                ) AS tax,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    SUM(
                        CASE
                            WHEN payment_status = 'Paid'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN payment_status = 'Partial'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS partial_amount,

                COALESCE(
                    SUM(
                        CASE
                            WHEN payment_status = 'Pending'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_amount

            FROM sales

            WHERE DATE(sale_date) = ?
            AND sale_status = 'Completed'
        `, [selectedDate]);

        const [sales] = await db.query(`
            SELECT
                s.id,
                s.sale_number,
                s.sale_date,
                s.customer_id,
                c.full_name AS customer_name,
                s.subtotal,
                s.discount,
                s.tax,
                s.grand_total,
                s.payment_method,
                s.payment_status,
                s.sale_status

            FROM sales s

            LEFT JOIN customers c
                ON c.id = s.customer_id

            WHERE DATE(s.sale_date) = ?
            AND s.sale_status = 'Completed'

            ORDER BY
                s.sale_date DESC,
                s.id DESC
        `, [selectedDate]);

        res.json({
            success: true,

            report: {
                type: "Daily Sales",
                date: selectedDate,

                summary: {
                    totalSales:
                        Number(summary.total_sales || 0),

                    subtotal:
                        Number(summary.subtotal || 0),

                    discount:
                        Number(summary.discount || 0),

                    tax:
                        Number(summary.tax || 0),

                    totalRevenue:
                        Number(summary.total_revenue || 0),

                    paidAmount:
                        Number(summary.paid_amount || 0),

                    partialAmount:
                        Number(summary.partial_amount || 0),

                    pendingAmount:
                        Number(summary.pending_amount || 0)
                },

                sales
            }
        });

    } catch (error) {
        console.error(
            "Daily sales report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load daily sales report.",
            error: error.message
        });
    }
};

// =========================================
// Monthly Sales Report
// GET /api/reports/sales/monthly
// =========================================

exports.getMonthlySalesReport = async (req, res) => {
    try {
        const currentDate = new Date();

        const year =
            Number(
                req.query.year ||
                currentDate.getFullYear()
            );

        const month =
            Number(
                req.query.month ||
                currentDate.getMonth() + 1
            );

        if (
            !Number.isInteger(year) ||
            year < 2000 ||
            year > 2100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid year between 2000 and 2100 is required."
            });
        }

        if (
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Month must be between 1 and 12."
            });
        }

        const [[summary]] = await db.query(`
            SELECT
                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(discount),
                    0
                ) AS discount,

                COALESCE(
                    SUM(tax),
                    0
                ) AS tax,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_sale_value

            FROM sales

            WHERE YEAR(sale_date) = ?
            AND MONTH(sale_date) = ?
            AND sale_status = 'Completed'
        `, [year, month]);

        const [dailyTrend] = await db.query(`
            SELECT
                DATE(sale_date) AS sale_date,
                COUNT(*) AS total_sales,
                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue

            FROM sales

            WHERE YEAR(sale_date) = ?
            AND MONTH(sale_date) = ?
            AND sale_status = 'Completed'

            GROUP BY DATE(sale_date)

            ORDER BY DATE(sale_date)
        `, [year, month]);

        const [paymentMethods] = await db.query(`
            SELECT
                payment_method,
                COUNT(*) AS total_sales,
                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue

            FROM sales

            WHERE YEAR(sale_date) = ?
            AND MONTH(sale_date) = ?
            AND sale_status = 'Completed'

            GROUP BY payment_method

            ORDER BY total_revenue DESC
        `, [year, month]);

        res.json({
            success: true,

            report: {
                type: "Monthly Sales",
                year,
                month,

                summary: {
                    totalSales:
                        Number(summary.total_sales || 0),

                    subtotal:
                        Number(summary.subtotal || 0),

                    discount:
                        Number(summary.discount || 0),

                    tax:
                        Number(summary.tax || 0),

                    totalRevenue:
                        Number(summary.total_revenue || 0),

                    averageSaleValue:
                        Number(
                            summary.average_sale_value || 0
                        )
                },

                dailyTrend,
                paymentMethods
            }
        });

    } catch (error) {
        console.error(
            "Monthly sales report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load monthly sales report.",
            error: error.message
        });
    }
};

// =========================================
// Yearly Sales Report
// GET /api/reports/sales/yearly
// =========================================

exports.getYearlySalesReport = async (req, res) => {
    try {
        const currentYear =
            new Date().getFullYear();

        const year =
            Number(req.query.year || currentYear);

        if (
            !Number.isInteger(year) ||
            year < 2000 ||
            year > 2100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid year between 2000 and 2100 is required."
            });
        }

        const [[summary]] = await db.query(`
            SELECT
                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(discount),
                    0
                ) AS discount,

                COALESCE(
                    SUM(tax),
                    0
                ) AS tax,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_sale_value

            FROM sales

            WHERE YEAR(sale_date) = ?
            AND sale_status = 'Completed'
        `, [year]);

        const [monthlyTrend] = await db.query(`
            SELECT
                MONTH(sale_date) AS month_number,
                MONTHNAME(sale_date) AS month_name,
                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue

            FROM sales

            WHERE YEAR(sale_date) = ?
            AND sale_status = 'Completed'

            GROUP BY
                MONTH(sale_date),
                MONTHNAME(sale_date)

            ORDER BY MONTH(sale_date)
        `, [year]);

        res.json({
            success: true,

            report: {
                type: "Yearly Sales",
                year,

                summary: {
                    totalSales:
                        Number(summary.total_sales || 0),

                    subtotal:
                        Number(summary.subtotal || 0),

                    discount:
                        Number(summary.discount || 0),

                    tax:
                        Number(summary.tax || 0),

                    totalRevenue:
                        Number(summary.total_revenue || 0),

                    averageSaleValue:
                        Number(
                            summary.average_sale_value || 0
                        )
                },

                monthlyTrend
            }
        });

    } catch (error) {
        console.error(
            "Yearly sales report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load yearly sales report.",
            error: error.message
        });
    }
};

// =========================================
// Custom Date Range Sales Report
// GET /api/reports/sales/range
// =========================================

exports.getSalesRangeReport = async (req, res) => {
    try {
        const {
            fromDate,
            toDate
        } = req.query;

        if (!fromDate || !toDate) {
            return res.status(400).json({
                success: false,
                message:
                    "Both fromDate and toDate are required."
            });
        }

        const from =
            new Date(`${fromDate}T00:00:00`);

        const to =
            new Date(`${toDate}T23:59:59`);

        if (
            Number.isNaN(from.getTime()) ||
            Number.isNaN(to.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Dates must use YYYY-MM-DD format."
            });
        }

        if (from > to) {
            return res.status(400).json({
                success: false,
                message:
                    "fromDate cannot be later than toDate."
            });
        }

        const [[summary]] = await db.query(`
            SELECT
                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(subtotal),
                    0
                ) AS subtotal,

                COALESCE(
                    SUM(discount),
                    0
                ) AS discount,

                COALESCE(
                    SUM(tax),
                    0
                ) AS tax,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_sale_value

            FROM sales

            WHERE DATE(sale_date)
                BETWEEN ? AND ?

            AND sale_status = 'Completed'
        `, [
            fromDate,
            toDate
        ]);

        const [sales] = await db.query(`
            SELECT
                s.id,
                s.sale_number,
                s.sale_date,
                s.customer_id,
                c.full_name AS customer_name,
                s.subtotal,
                s.discount,
                s.tax,
                s.grand_total,
                s.payment_method,
                s.payment_status,
                s.sale_status

            FROM sales s

            LEFT JOIN customers c
                ON c.id = s.customer_id

            WHERE DATE(s.sale_date)
                BETWEEN ? AND ?

            AND s.sale_status = 'Completed'

            ORDER BY
                s.sale_date DESC,
                s.id DESC
        `, [
            fromDate,
            toDate
        ]);

        res.json({
            success: true,

            report: {
                type: "Custom Sales Range",
                fromDate,
                toDate,

                summary: {
                    totalSales:
                        Number(summary.total_sales || 0),

                    subtotal:
                        Number(summary.subtotal || 0),

                    discount:
                        Number(summary.discount || 0),

                    tax:
                        Number(summary.tax || 0),

                    totalRevenue:
                        Number(summary.total_revenue || 0),

                    averageSaleValue:
                        Number(
                            summary.average_sale_value || 0
                        )
                },

                sales
            }
        });

    } catch (error) {
        console.error(
            "Sales range report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load sales range report.",
            error: error.message
        });
    }
};
// =========================================
// Inventory Valuation Report
// GET /api/reports/inventory/valuation
// =========================================

exports.getInventoryValuationReport = async (
    req,
    res
) => {
    try {
        const [[summary]] = await db.query(`
            SELECT
                COUNT(*) AS total_products,

                COALESCE(
                    SUM(stock_quantity),
                    0
                ) AS total_stock_quantity,

                COALESCE(
                    SUM(
                        cost_price * stock_quantity
                    ),
                    0
                ) AS inventory_cost_value,

                COALESCE(
                    SUM(
                        selling_price * stock_quantity
                    ),
                    0
                ) AS inventory_selling_value,

                COALESCE(
                    SUM(
                        (
                            selling_price - cost_price
                        ) * stock_quantity
                    ),
                    0
                ) AS expected_profit,

                COUNT(
                    CASE
                        WHEN stock_quantity > 0
                        AND stock_quantity <= low_stock_level
                        THEN 1
                    END
                ) AS low_stock_products,

                COUNT(
                    CASE
                        WHEN stock_quantity <= 0
                        THEN 1
                    END
                ) AS out_of_stock_products

            FROM products

            WHERE status IS NULL
            OR LOWER(status) != 'inactive'
        `);

        const [products] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                category,
                brand,
                cost_price,
                selling_price,
                stock_quantity,
                low_stock_level,
                stock_status,

                (
                    cost_price * stock_quantity
                ) AS cost_value,

                (
                    selling_price * stock_quantity
                ) AS selling_value,

                (
                    (
                        selling_price - cost_price
                    ) * stock_quantity
                ) AS expected_profit

            FROM products

            WHERE status IS NULL
            OR LOWER(status) != 'inactive'

            ORDER BY
                cost_value DESC,
                product_name ASC
        `);

        const formattedProducts =
            products.map((product) => ({
                ...product,

                cost_price:
                    Number(product.cost_price || 0),

                selling_price:
                    Number(product.selling_price || 0),

                stock_quantity:
                    Number(product.stock_quantity || 0),

                low_stock_level:
                    Number(product.low_stock_level || 0),

                cost_value:
                    Number(product.cost_value || 0),

                selling_value:
                    Number(product.selling_value || 0),

                expected_profit:
                    Number(product.expected_profit || 0)
            }));

        res.json({
            success: true,

            report: {
                type: "Inventory Valuation",

                summary: {
                    totalProducts:
                        Number(
                            summary.total_products || 0
                        ),

                    totalStockQuantity:
                        Number(
                            summary.total_stock_quantity || 0
                        ),

                    inventoryCostValue:
                        Number(
                            summary.inventory_cost_value || 0
                        ),

                    inventorySellingValue:
                        Number(
                            summary.inventory_selling_value || 0
                        ),

                    expectedProfit:
                        Number(
                            summary.expected_profit || 0
                        ),

                    lowStockProducts:
                        Number(
                            summary.low_stock_products || 0
                        ),

                    outOfStockProducts:
                        Number(
                            summary.out_of_stock_products || 0
                        )
                },

                products: formattedProducts
            }
        });

    } catch (error) {
        console.error(
            "Inventory valuation report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load inventory valuation report.",
            error: error.message
        });
    }
};

// =========================================
// Low Stock Report
// GET /api/reports/inventory/low-stock
// =========================================

exports.getLowStockReport = async (
    req,
    res
) => {
    try {
        const [products] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                category,
                brand,
                cost_price,
                selling_price,
                stock_quantity,
                low_stock_level,
                stock_status,

                (
                    low_stock_level -
                    stock_quantity
                ) AS shortage_quantity

            FROM products

            WHERE stock_quantity > 0
            AND stock_quantity <= low_stock_level

            AND (
                status IS NULL
                OR LOWER(status) != 'inactive'
            )

            ORDER BY
                stock_quantity ASC,
                product_name ASC
        `);

        const formattedProducts =
            products.map((product) => ({
                ...product,

                cost_price:
                    Number(product.cost_price || 0),

                selling_price:
                    Number(product.selling_price || 0),

                stock_quantity:
                    Number(product.stock_quantity || 0),

                low_stock_level:
                    Number(product.low_stock_level || 0),

                shortage_quantity:
                    Number(product.shortage_quantity || 0)
            }));

        res.json({
            success: true,

            report: {
                type: "Low Stock",

                summary: {
                    totalLowStockProducts:
                        formattedProducts.length
                },

                products: formattedProducts
            }
        });

    } catch (error) {
        console.error(
            "Low-stock report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load low-stock report.",
            error: error.message
        });
    }
};

// =========================================
// Out-of-Stock Report
// GET /api/reports/inventory/out-of-stock
// =========================================

exports.getOutOfStockReport = async (
    req,
    res
) => {
    try {
        const [products] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                category,
                brand,
                cost_price,
                selling_price,
                stock_quantity,
                low_stock_level,
                stock_status

            FROM products

            WHERE stock_quantity <= 0

            AND (
                status IS NULL
                OR LOWER(status) != 'inactive'
            )

            ORDER BY product_name ASC
        `);

        const formattedProducts =
            products.map((product) => ({
                ...product,

                cost_price:
                    Number(product.cost_price || 0),

                selling_price:
                    Number(product.selling_price || 0),

                stock_quantity:
                    Number(product.stock_quantity || 0),

                low_stock_level:
                    Number(product.low_stock_level || 0)
            }));

        res.json({
            success: true,

            report: {
                type: "Out of Stock",

                summary: {
                    totalOutOfStockProducts:
                        formattedProducts.length
                },

                products: formattedProducts
            }
        });

    } catch (error) {
        console.error(
            "Out-of-stock report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load out-of-stock report.",
            error: error.message
        });
    }
};

// =========================================
// Stock Movement Report
// GET /api/reports/inventory/movements
// =========================================

exports.getStockMovementReport = async (
    req,
    res
) => {
    try {
        const page =
            Number.parseInt(
                req.query.page,
                10
            ) || 1;

        const limit =
            Math.min(
                Number.parseInt(
                    req.query.limit,
                    10
                ) || 20,
                100
            );

        const offset =
            (page - 1) * limit;

        const {
            productId,
            transactionType,
            fromDate,
            toDate,
            search
        } = req.query;

        const conditions = [];
        const values = [];

        const allowedTransactionTypes = [
            "Stock In",
            "Stock Out",
            "Adjustment"
        ];

        if (productId) {
            const parsedProductId =
                Number(productId);

            if (
                !Number.isInteger(parsedProductId) ||
                parsedProductId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A valid productId is required."
                });
            }

            conditions.push(
                "it.product_id = ?"
            );

            values.push(parsedProductId);
        }

        if (transactionType) {
            if (
                !allowedTransactionTypes
                    .includes(transactionType)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid transactionType."
                });
            }

            conditions.push(
                "it.transaction_type = ?"
            );

            values.push(transactionType);
        }

        if (fromDate) {
            conditions.push(
                "DATE(it.created_at) >= ?"
            );

            values.push(fromDate);
        }

        if (toDate) {
            conditions.push(
                "DATE(it.created_at) <= ?"
            );

            values.push(toDate);
        }

        if (search && search.trim()) {
            const keyword =
                `%${search.trim()}%`;

            conditions.push(`
                (
                    p.product_name LIKE ?
                    OR p.sku LIKE ?
                    OR it.reference LIKE ?
                    OR it.remarks LIKE ?
                )
            `);

            values.push(
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const [[countResult]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total

                FROM inventory_transactions it

                INNER JOIN products p
                    ON p.id = it.product_id

                ${whereClause}
            `, values);

        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_transactions,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN it.transaction_type = 'Stock In'
                                THEN it.quantity
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_stock_in,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN it.transaction_type = 'Stock Out'
                                THEN it.quantity
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_stock_out,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN it.transaction_type = 'Adjustment'
                                AND it.new_stock >
                                    it.previous_stock
                                THEN
                                    it.new_stock -
                                    it.previous_stock
                                ELSE 0
                            END
                        ),
                        0
                    ) AS adjustment_in,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN it.transaction_type = 'Adjustment'
                                AND it.new_stock <
                                    it.previous_stock
                                THEN
                                    it.previous_stock -
                                    it.new_stock
                                ELSE 0
                            END
                        ),
                        0
                    ) AS adjustment_out

                FROM inventory_transactions it

                INNER JOIN products p
                    ON p.id = it.product_id

                ${whereClause}
            `, values);

        const [movements] =
            await db.query(`
                SELECT
                    it.id,
                    it.product_id,
                    p.product_name,
                    p.sku,
                    it.transaction_type,
                    it.quantity,
                    it.previous_stock,
                    it.new_stock,
                    it.cost_price,
                    it.supplier_id,
                    s.supplier_name,
                    it.reference,
                    it.remarks,
                    it.created_by,
                    it.created_at

                FROM inventory_transactions it

                INNER JOIN products p
                    ON p.id = it.product_id

                LEFT JOIN suppliers s
                    ON s.id = it.supplier_id

                ${whereClause}

                ORDER BY
                    it.created_at DESC,
                    it.id DESC

                LIMIT ?
                OFFSET ?
            `, [
                ...values,
                limit,
                offset
            ]);

        const total =
            Number(countResult.total || 0);

        res.json({
            success: true,

            report: {
                type: "Stock Movement",

                filters: {
                    productId:
                        productId || null,

                    transactionType:
                        transactionType || null,

                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null,

                    search:
                        search || null
                },

                summary: {
                    totalTransactions:
                        Number(
                            summary.total_transactions || 0
                        ),

                    totalStockIn:
                        Number(
                            summary.total_stock_in || 0
                        ),

                    totalStockOut:
                        Number(
                            summary.total_stock_out || 0
                        ),

                    adjustmentIn:
                        Number(
                            summary.adjustment_in || 0
                        ),

                    adjustmentOut:
                        Number(
                            summary.adjustment_out || 0
                        )
                },

                movements,

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error(
            "Stock movement report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load stock movement report.",
            error: error.message
        });
    }
};
// =========================================
// Top-Selling Products Report
// GET /api/reports/products/top-selling
// =========================================

exports.getTopSellingProductsReport = async (
    req,
    res
) => {
    try {
        const {
            fromDate,
            toDate,
            category
        } = req.query;

        const limit = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.limit,
                    10
                ) || 10,
                1
            ),
            100
        );

        const conditions = [
            "LOWER(s.sale_status) = 'completed'"
        ];

        const values = [];

        if (fromDate) {
            conditions.push(
                "DATE(s.sale_date) >= ?"
            );

            values.push(fromDate);
        }

        if (toDate) {
            conditions.push(
                "DATE(s.sale_date) <= ?"
            );

            values.push(toDate);
        }

        if (category && category.trim()) {
            conditions.push(
                "p.category = ?"
            );

            values.push(category.trim());
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(
                        DISTINCT si.product_id
                    ) AS products_sold,

                    COALESCE(
                        SUM(si.quantity),
                        0
                    ) AS total_quantity_sold,

                    COALESCE(
                        SUM(si.total),
                        0
                    ) AS total_sales_value,

                    COUNT(
                        DISTINCT s.id
                    ) AS total_sales

                FROM sale_items si

                INNER JOIN sales s
                    ON s.id = si.sale_id

                INNER JOIN products p
                    ON p.id = si.product_id

                ${whereClause}
            `, values);

        const [products] =
            await db.query(`
                SELECT
                    si.product_id,
                    p.product_name,
                    p.sku,
                    p.category,
                    p.brand,
                    p.cost_price,
                    p.selling_price,
                    p.stock_quantity,
                    p.stock_status,

                    COUNT(
                        DISTINCT si.sale_id
                    ) AS number_of_sales,

                    COALESCE(
                        SUM(si.quantity),
                        0
                    ) AS quantity_sold,

                    COALESCE(
                        SUM(
                            si.unit_price *
                            si.quantity
                        ),
                        0
                    ) AS gross_sales_value,

                    COALESCE(
                        SUM(si.discount),
                        0
                    ) AS total_discount,

                    COALESCE(
                        SUM(si.total),
                        0
                    ) AS net_sales_value,

                    COALESCE(
                        AVG(si.unit_price),
                        0
                    ) AS average_selling_price,

                    COALESCE(
                        SUM(
                            (
                                si.unit_price -
                                p.cost_price
                            ) *
                            si.quantity
                        ),
                        0
                    ) AS estimated_gross_profit,

                    MAX(
                        s.sale_date
                    ) AS last_sale_date

                FROM sale_items si

                INNER JOIN sales s
                    ON s.id = si.sale_id

                INNER JOIN products p
                    ON p.id = si.product_id

                ${whereClause}

                GROUP BY
                    si.product_id,
                    p.product_name,
                    p.sku,
                    p.category,
                    p.brand,
                    p.cost_price,
                    p.selling_price,
                    p.stock_quantity,
                    p.stock_status

                ORDER BY
                    quantity_sold DESC,
                    net_sales_value DESC,
                    p.product_name ASC

                LIMIT ?
            `, [
                ...values,
                limit
            ]);

        const formattedProducts =
            products.map(
                (product, index) => ({
                    rank: index + 1,

                    productId:
                        Number(product.product_id),

                    productName:
                        product.product_name,

                    sku:
                        product.sku,

                    category:
                        product.category,

                    brand:
                        product.brand,

                    costPrice:
                        Number(
                            product.cost_price || 0
                        ),

                    sellingPrice:
                        Number(
                            product.selling_price || 0
                        ),

                    currentStock:
                        Number(
                            product.stock_quantity || 0
                        ),

                    stockStatus:
                        product.stock_status,

                    numberOfSales:
                        Number(
                            product.number_of_sales || 0
                        ),

                    quantitySold:
                        Number(
                            product.quantity_sold || 0
                        ),

                    grossSalesValue:
                        Number(
                            product.gross_sales_value || 0
                        ),

                    totalDiscount:
                        Number(
                            product.total_discount || 0
                        ),

                    netSalesValue:
                        Number(
                            product.net_sales_value || 0
                        ),

                    averageSellingPrice:
                        Number(
                            product.average_selling_price || 0
                        ),

                    estimatedGrossProfit:
                        Number(
                            product.estimated_gross_profit || 0
                        ),

                    lastSaleDate:
                        product.last_sale_date
                })
            );

        res.json({
            success: true,

            report: {
                type: "Top Selling Products",

                filters: {
                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null,

                    category:
                        category || null,

                    limit
                },

                summary: {
                    productsSold:
                        Number(
                            summary.products_sold || 0
                        ),

                    totalQuantitySold:
                        Number(
                            summary.total_quantity_sold || 0
                        ),

                    totalSalesValue:
                        Number(
                            summary.total_sales_value || 0
                        ),

                    totalSales:
                        Number(
                            summary.total_sales || 0
                        )
                },

                products: formattedProducts
            }
        });

    } catch (error) {
        console.error(
            "Top-selling products report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load top-selling products report.",
            error: error.message
        });
    }
};

// =========================================
// Slow-Moving Products Report
// GET /api/reports/products/slow-moving
// =========================================

exports.getSlowMovingProductsReport = async (
    req,
    res
) => {
    try {
        const days = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.days,
                    10
                ) || 90,
                1
            ),
            3650
        );

        const maximumQuantitySold =
            Math.max(
                Number.parseInt(
                    req.query.maximumQuantitySold,
                    10
                ) || 5,
                0
            );

        const page = Math.max(
            Number.parseInt(
                req.query.page,
                10
            ) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.limit,
                    10
                ) || 20,
                1
            ),
            100
        );

        const offset =
            (page - 1) * limit;

        const category =
            req.query.category
                ? req.query.category.trim()
                : "";

        const search =
            req.query.search
                ? req.query.search.trim()
                : "";

        const productConditions = [
            `(
                p.status IS NULL
                OR LOWER(p.status) != 'inactive'
            )`
        ];

        const productValues = [];

        if (category) {
            productConditions.push(
                "p.category = ?"
            );

            productValues.push(category);
        }

        if (search) {
            const keyword =
                `%${search}%`;

            productConditions.push(`
                (
                    p.product_name LIKE ?
                    OR p.sku LIKE ?
                    OR p.brand LIKE ?
                )
            `);

            productValues.push(
                keyword,
                keyword,
                keyword
            );
        }

        const productWhereClause =
            `WHERE ${productConditions.join(
                " AND "
            )}`;

        /*
         * Sales are aggregated only for completed
         * sales within the selected number of days.
         *
         * Products without any sales are retained
         * because this report uses LEFT JOIN.
         */

        const countSql = `
            SELECT
                COUNT(*) AS total

            FROM (
                SELECT
                    p.id

                FROM products p

                LEFT JOIN sale_items si
                    ON si.product_id = p.id

                LEFT JOIN sales s
                    ON s.id = si.sale_id
                    AND LOWER(
                        s.sale_status
                    ) = 'completed'
                    AND DATE(s.sale_date) >=
                        DATE_SUB(
                            CURDATE(),
                            INTERVAL ? DAY
                        )

                ${productWhereClause}

                GROUP BY p.id

                HAVING
                    COALESCE(
                        SUM(
                            CASE
                                WHEN s.id IS NOT NULL
                                THEN si.quantity
                                ELSE 0
                            END
                        ),
                        0
                    ) <= ?
            ) AS slow_products
        `;

        const countValues = [
            days,
            ...productValues,
            maximumQuantitySold
        ];

        const [[countResult]] =
            await db.query(
                countSql,
                countValues
            );

        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS slow_moving_products,

                    COALESCE(
                        SUM(report.current_stock),
                        0
                    ) AS slow_moving_stock_quantity,

                    COALESCE(
                        SUM(
                            report.current_stock *
                            report.cost_price
                        ),
                        0
                    ) AS slow_moving_cost_value,

                    COALESCE(
                        SUM(
                            report.current_stock *
                            report.selling_price
                        ),
                        0
                    ) AS slow_moving_selling_value,

                    SUM(
                        CASE
                            WHEN report.quantity_sold = 0
                            THEN 1
                            ELSE 0
                        END
                    ) AS products_with_no_sales

                FROM (
                    SELECT
                        p.id,
                        p.cost_price,
                        p.selling_price,
                        p.stock_quantity
                            AS current_stock,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN s.id IS NOT NULL
                                    THEN si.quantity
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS quantity_sold

                    FROM products p

                    LEFT JOIN sale_items si
                        ON si.product_id = p.id

                    LEFT JOIN sales s
                        ON s.id = si.sale_id
                        AND LOWER(
                            s.sale_status
                        ) = 'completed'
                        AND DATE(s.sale_date) >=
                            DATE_SUB(
                                CURDATE(),
                                INTERVAL ? DAY
                            )

                    ${productWhereClause}

                    GROUP BY
                        p.id,
                        p.cost_price,
                        p.selling_price,
                        p.stock_quantity

                    HAVING
                        quantity_sold <= ?
                ) AS report
            `, [
                days,
                ...productValues,
                maximumQuantitySold
            ]);

        const [products] =
            await db.query(`
                SELECT
                    p.id AS product_id,
                    p.product_name,
                    p.sku,
                    p.category,
                    p.brand,
                    p.cost_price,
                    p.selling_price,
                    p.stock_quantity,
                    p.low_stock_level,
                    p.stock_status,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN s.id IS NOT NULL
                            THEN s.id
                        END
                    ) AS number_of_sales,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN s.id IS NOT NULL
                                THEN si.quantity
                                ELSE 0
                            END
                        ),
                        0
                    ) AS quantity_sold,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN s.id IS NOT NULL
                                THEN si.total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS sales_value,

                    MAX(
                        CASE
                            WHEN s.id IS NOT NULL
                            THEN s.sale_date
                        END
                    ) AS last_sale_date,

                    (
                        p.stock_quantity *
                        p.cost_price
                    ) AS current_stock_cost_value,

                    (
                        p.stock_quantity *
                        p.selling_price
                    ) AS current_stock_selling_value

                FROM products p

                LEFT JOIN sale_items si
                    ON si.product_id = p.id

                LEFT JOIN sales s
                    ON s.id = si.sale_id
                    AND LOWER(
                        s.sale_status
                    ) = 'completed'
                    AND DATE(s.sale_date) >=
                        DATE_SUB(
                            CURDATE(),
                            INTERVAL ? DAY
                        )

                ${productWhereClause}

                GROUP BY
                    p.id,
                    p.product_name,
                    p.sku,
                    p.category,
                    p.brand,
                    p.cost_price,
                    p.selling_price,
                    p.stock_quantity,
                    p.low_stock_level,
                    p.stock_status

                HAVING
                    quantity_sold <= ?

                ORDER BY
                    quantity_sold ASC,
                    last_sale_date ASC,
                    p.stock_quantity DESC,
                    p.product_name ASC

                LIMIT ?
                OFFSET ?
            `, [
                days,
                ...productValues,
                maximumQuantitySold,
                limit,
                offset
            ]);

        const formattedProducts =
            products.map((product) => ({
                productId:
                    Number(product.product_id),

                productName:
                    product.product_name,

                sku:
                    product.sku,

                category:
                    product.category,

                brand:
                    product.brand,

                costPrice:
                    Number(
                        product.cost_price || 0
                    ),

                sellingPrice:
                    Number(
                        product.selling_price || 0
                    ),

                currentStock:
                    Number(
                        product.stock_quantity || 0
                    ),

                lowStockLevel:
                    Number(
                        product.low_stock_level || 0
                    ),

                stockStatus:
                    product.stock_status,

                numberOfSales:
                    Number(
                        product.number_of_sales || 0
                    ),

                quantitySold:
                    Number(
                        product.quantity_sold || 0
                    ),

                salesValue:
                    Number(
                        product.sales_value || 0
                    ),

                lastSaleDate:
                    product.last_sale_date,

                currentStockCostValue:
                    Number(
                        product.current_stock_cost_value || 0
                    ),

                currentStockSellingValue:
                    Number(
                        product.current_stock_selling_value || 0
                    ),

                movementStatus:
                    Number(
                        product.quantity_sold || 0
                    ) === 0
                        ? "No Sales"
                        : "Slow Moving"
            }));

        const total =
            Number(countResult.total || 0);

        res.json({
            success: true,

            report: {
                type: "Slow Moving Products",

                filters: {
                    days,
                    maximumQuantitySold,

                    category:
                        category || null,

                    search:
                        search || null
                },

                summary: {
                    slowMovingProducts:
                        Number(
                            summary.slow_moving_products || 0
                        ),

                    productsWithNoSales:
                        Number(
                            summary.products_with_no_sales || 0
                        ),

                    slowMovingStockQuantity:
                        Number(
                            summary.slow_moving_stock_quantity || 0
                        ),

                    slowMovingCostValue:
                        Number(
                            summary.slow_moving_cost_value || 0
                        ),

                    slowMovingSellingValue:
                        Number(
                            summary.slow_moving_selling_value || 0
                        )
                },

                products:
                    formattedProducts,

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error(
            "Slow-moving products report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load slow-moving products report.",
            error: error.message
        });
    }
};
// =========================================
// Top Customers Report
// GET /api/reports/customers/top
// =========================================

exports.getTopCustomersReport = async (
    req,
    res
) => {
    try {
        const {
            fromDate,
            toDate,
            search
        } = req.query;

        const sortBy =
            req.query.sortBy || "spending";

        const allowedSortOptions = [
            "spending",
            "orders",
            "recent"
        ];

        if (
            !allowedSortOptions.includes(sortBy)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "sortBy must be spending, orders, or recent."
            });
        }

        const limit = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.limit,
                    10
                ) || 10,
                1
            ),
            100
        );

        const conditions = [
            "s.customer_id IS NOT NULL",
            "LOWER(s.sale_status) = 'completed'"
        ];

        const values = [];

        if (fromDate) {
            conditions.push(
                "DATE(s.sale_date) >= ?"
            );

            values.push(fromDate);
        }

        if (toDate) {
            conditions.push(
                "DATE(s.sale_date) <= ?"
            );

            values.push(toDate);
        }

        if (search && search.trim()) {
            const keyword =
                `%${search.trim()}%`;

            conditions.push(`
                (
                    c.full_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                )
            `);

            values.push(
                keyword,
                keyword,
                keyword
            );
        }

        const whereClause =
            `WHERE ${conditions.join(" AND ")}`;

        let orderByClause = `
            total_spent DESC,
            total_orders DESC,
            c.full_name ASC
        `;

        if (sortBy === "orders") {
            orderByClause = `
                total_orders DESC,
                total_spent DESC,
                c.full_name ASC
            `;
        }

        if (sortBy === "recent") {
            orderByClause = `
                last_purchase_date DESC,
                total_spent DESC,
                c.full_name ASC
            `;
        }

        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(
                        DISTINCT s.customer_id
                    ) AS purchasing_customers,

                    COUNT(
                        DISTINCT s.id
                    ) AS total_sales,

                    COALESCE(
                        SUM(s.grand_total),
                        0
                    ) AS total_revenue,

                    COALESCE(
                        AVG(s.grand_total),
                        0
                    ) AS average_sale_value

                FROM sales s

                INNER JOIN customers c
                    ON c.id = s.customer_id

                ${whereClause}
            `, values);

        const [customers] =
            await db.query(`
                SELECT
                    c.id AS customer_id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.city,
                    c.country,
                    c.status,
                    c.created_at,

                    COUNT(
                        DISTINCT s.id
                    ) AS total_orders,

                    COALESCE(
                        SUM(s.subtotal),
                        0
                    ) AS total_subtotal,

                    COALESCE(
                        SUM(s.discount),
                        0
                    ) AS total_discount,

                    COALESCE(
                        SUM(s.tax),
                        0
                    ) AS total_tax,

                    COALESCE(
                        SUM(s.grand_total),
                        0
                    ) AS total_spent,

                    COALESCE(
                        AVG(s.grand_total),
                        0
                    ) AS average_order_value,

                    MIN(
                        s.sale_date
                    ) AS first_purchase_date,

                    MAX(
                        s.sale_date
                    ) AS last_purchase_date

                FROM customers c

                INNER JOIN sales s
                    ON s.customer_id = c.id

                ${whereClause}

                GROUP BY
                    c.id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.city,
                    c.country,
                    c.status,
                    c.created_at

                ORDER BY
                    ${orderByClause}

                LIMIT ?
            `, [
                ...values,
                limit
            ]);

        const formattedCustomers =
            customers.map(
                (customer, index) => ({
                    rank: index + 1,

                    customerId:
                        Number(
                            customer.customer_id
                        ),

                    fullName:
                        customer.full_name,

                    email:
                        customer.email,

                    phone:
                        customer.phone,

                    city:
                        customer.city,

                    country:
                        customer.country,

                    status:
                        customer.status,

                    customerSince:
                        customer.created_at,

                    totalOrders:
                        Number(
                            customer.total_orders || 0
                        ),

                    totalSubtotal:
                        Number(
                            customer.total_subtotal || 0
                        ),

                    totalDiscount:
                        Number(
                            customer.total_discount || 0
                        ),

                    totalTax:
                        Number(
                            customer.total_tax || 0
                        ),

                    totalSpent:
                        Number(
                            customer.total_spent || 0
                        ),

                    averageOrderValue:
                        Number(
                            customer.average_order_value || 0
                        ),

                    firstPurchaseDate:
                        customer.first_purchase_date,

                    lastPurchaseDate:
                        customer.last_purchase_date
                })
            );

        res.json({
            success: true,

            report: {
                type: "Top Customers",

                filters: {
                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null,

                    search:
                        search || null,

                    sortBy,
                    limit
                },

                summary: {
                    purchasingCustomers:
                        Number(
                            summary.purchasing_customers || 0
                        ),

                    totalSales:
                        Number(
                            summary.total_sales || 0
                        ),

                    totalRevenue:
                        Number(
                            summary.total_revenue || 0
                        ),

                    averageSaleValue:
                        Number(
                            summary.average_sale_value || 0
                        )
                },

                customers:
                    formattedCustomers
            }
        });

    } catch (error) {
        console.error(
            "Top-customers report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load top-customers report.",
            error: error.message
        });
    }
};

// =========================================
// Inactive Customers Report
// GET /api/reports/customers/inactive
// =========================================

exports.getInactiveCustomersReport = async (
    req,
    res
) => {
    try {
        const days = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.days,
                    10
                ) || 90,
                1
            ),
            3650
        );

        const page = Math.max(
            Number.parseInt(
                req.query.page,
                10
            ) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.limit,
                    10
                ) || 20,
                1
            ),
            100
        );

        const offset =
            (page - 1) * limit;

        const search =
            req.query.search
                ? req.query.search.trim()
                : "";

        const customerStatus =
            req.query.status
                ? req.query.status.trim()
                : "";

        const conditions = [
            "c.deleted_at IS NULL"
        ];

        const values = [];

        if (search) {
            const keyword =
                `%${search}%`;

            conditions.push(`
                (
                    c.full_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                    OR c.city LIKE ?
                )
            `);

            values.push(
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        if (customerStatus) {
            conditions.push(
                "c.status = ?"
            );

            values.push(customerStatus);
        }

        const whereClause =
            `WHERE ${conditions.join(" AND ")}`;

        const inactivityHaving = `
            HAVING
                last_purchase_date IS NULL
                OR last_purchase_date <
                    DATE_SUB(
                        CURDATE(),
                        INTERVAL ? DAY
                    )
        `;

        const countSql = `
            SELECT
                COUNT(*) AS total

            FROM (
                SELECT
                    c.id,

                    MAX(
                        CASE
                            WHEN LOWER(
                                s.sale_status
                            ) = 'completed'
                            THEN s.sale_date
                        END
                    ) AS last_purchase_date

                FROM customers c

                LEFT JOIN sales s
                    ON s.customer_id = c.id

                ${whereClause}

                GROUP BY c.id

                ${inactivityHaving}
            ) AS inactive_customers
        `;

        const [[countResult]] =
            await db.query(
                countSql,
                [
                    ...values,
                    days
                ]
            );

        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS inactive_customers,

                    SUM(
                        CASE
                            WHEN report.last_purchase_date
                                IS NULL
                            THEN 1
                            ELSE 0
                        END
                    ) AS never_purchased_customers,

                    COALESCE(
                        SUM(report.total_spent),
                        0
                    ) AS historical_revenue,

                    COALESCE(
                        SUM(report.total_orders),
                        0
                    ) AS historical_orders

                FROM (
                    SELECT
                        c.id,

                        COUNT(
                            DISTINCT
                            CASE
                                WHEN LOWER(
                                    s.sale_status
                                ) = 'completed'
                                THEN s.id
                            END
                        ) AS total_orders,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN LOWER(
                                        s.sale_status
                                    ) = 'completed'
                                    THEN s.grand_total
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS total_spent,

                        MAX(
                            CASE
                                WHEN LOWER(
                                    s.sale_status
                                ) = 'completed'
                                THEN s.sale_date
                            END
                        ) AS last_purchase_date

                    FROM customers c

                    LEFT JOIN sales s
                        ON s.customer_id = c.id

                    ${whereClause}

                    GROUP BY c.id

                    ${inactivityHaving}
                ) AS report
            `, [
                ...values,
                days
            ]);

        const [customers] =
            await db.query(`
                SELECT
                    c.id AS customer_id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.city,
                    c.country,
                    c.status,
                    c.created_at,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN LOWER(
                                s.sale_status
                            ) = 'completed'
                            THEN s.id
                        END
                    ) AS total_orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN LOWER(
                                    s.sale_status
                                ) = 'completed'
                                THEN s.grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_spent,

                    MAX(
                        CASE
                            WHEN LOWER(
                                s.sale_status
                            ) = 'completed'
                            THEN s.sale_date
                        END
                    ) AS last_purchase_date,

                    CASE
                        WHEN MAX(
                            CASE
                                WHEN LOWER(
                                    s.sale_status
                                ) = 'completed'
                                THEN s.sale_date
                            END
                        ) IS NULL
                        THEN NULL

                        ELSE DATEDIFF(
                            CURDATE(),

                            MAX(
                                CASE
                                    WHEN LOWER(
                                        s.sale_status
                                    ) = 'completed'
                                    THEN s.sale_date
                                END
                            )
                        )
                    END AS days_since_last_purchase

                FROM customers c

                LEFT JOIN sales s
                    ON s.customer_id = c.id

                ${whereClause}

                GROUP BY
                    c.id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.city,
                    c.country,
                    c.status,
                    c.created_at

                ${inactivityHaving}

                ORDER BY
                    last_purchase_date ASC,
                    c.created_at ASC,
                    c.full_name ASC

                LIMIT ?
                OFFSET ?
            `, [
                ...values,
                days,
                limit,
                offset
            ]);

        const formattedCustomers =
            customers.map((customer) => ({
                customerId:
                    Number(
                        customer.customer_id
                    ),

                fullName:
                    customer.full_name,

                email:
                    customer.email,

                phone:
                    customer.phone,

                city:
                    customer.city,

                country:
                    customer.country,

                status:
                    customer.status,

                customerSince:
                    customer.created_at,

                totalOrders:
                    Number(
                        customer.total_orders || 0
                    ),

                totalSpent:
                    Number(
                        customer.total_spent || 0
                    ),

                lastPurchaseDate:
                    customer.last_purchase_date,

                daysSinceLastPurchase:
                    customer.days_since_last_purchase === null
                        ? null
                        : Number(
                            customer.days_since_last_purchase
                        ),

                inactivityStatus:
                    customer.last_purchase_date
                        ? "Inactive Customer"
                        : "Never Purchased"
            }));

        const total =
            Number(
                countResult.total || 0
            );

        res.json({
            success: true,

            report: {
                type: "Inactive Customers",

                filters: {
                    days,

                    search:
                        search || null,

                    status:
                        customerStatus || null
                },

                summary: {
                    inactiveCustomers:
                        Number(
                            summary.inactive_customers || 0
                        ),

                    neverPurchasedCustomers:
                        Number(
                            summary.never_purchased_customers || 0
                        ),

                    historicalRevenue:
                        Number(
                            summary.historical_revenue || 0
                        ),

                    historicalOrders:
                        Number(
                            summary.historical_orders || 0
                        )
                },

                customers:
                    formattedCustomers,

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error(
            "Inactive-customers report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load inactive-customers report.",
            error: error.message
        });
    }
};
// =========================================
// Supplier Performance Report
// GET /api/reports/suppliers/performance
// =========================================

exports.getSupplierPerformanceReport = async (
    req,
    res
) => {
    try {
        const {
            fromDate,
            toDate,
            search
        } = req.query;

        const supplierStatus =
            req.query.status
                ? req.query.status.trim()
                : "";

        const sortBy =
            req.query.sortBy || "purchaseValue";

        const allowedSortOptions = [
            "purchaseValue",
            "orders",
            "outstanding",
            "recent"
        ];

        if (
            !allowedSortOptions.includes(sortBy)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "sortBy must be purchaseValue, orders, outstanding, or recent."
            });
        }

        const page = Math.max(
            Number.parseInt(
                req.query.page,
                10
            ) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                Number.parseInt(
                    req.query.limit,
                    10
                ) || 20,
                1
            ),
            100
        );

        const offset =
            (page - 1) * limit;

        const supplierConditions = [];
        const supplierValues = [];

        if (supplierStatus) {
            supplierConditions.push(
                "sp.status = ?"
            );

            supplierValues.push(
                supplierStatus
            );
        }

        if (search && search.trim()) {
            const keyword =
                `%${search.trim()}%`;

            supplierConditions.push(`
                (
                    sp.supplier_name LIKE ?
                    OR sp.contact_person LIKE ?
                )
            `);

            supplierValues.push(
                keyword,
                keyword
            );
        }

        const supplierWhereClause =
            supplierConditions.length > 0
                ? `WHERE ${supplierConditions.join(
                    " AND "
                )}`
                : "";

        const purchaseJoinConditions = [
            "po.supplier_id = sp.id"
        ];

        const purchaseValues = [];

        if (fromDate) {
            purchaseJoinConditions.push(
                "DATE(po.order_date) >= ?"
            );

            purchaseValues.push(
                fromDate
            );
        }

        if (toDate) {
            purchaseJoinConditions.push(
                "DATE(po.order_date) <= ?"
            );

            purchaseValues.push(
                toDate
            );
        }

        /*
         * Cancelled purchase orders are excluded
         * from supplier performance totals.
         */
        purchaseJoinConditions.push(`
            (
                po.status IS NULL
                OR LOWER(po.status) != 'cancelled'
            )
        `);

        const purchaseJoinClause =
            purchaseJoinConditions.join(
                " AND "
            );

        let orderByClause = `
            total_purchase_value DESC,
            total_purchase_orders DESC,
            sp.supplier_name ASC
        `;

        if (sortBy === "orders") {
            orderByClause = `
                total_purchase_orders DESC,
                total_purchase_value DESC,
                sp.supplier_name ASC
            `;
        }

        if (sortBy === "outstanding") {
            orderByClause = `
                outstanding_balance DESC,
                total_purchase_value DESC,
                sp.supplier_name ASC
            `;
        }

        if (sortBy === "recent") {
            orderByClause = `
                last_purchase_date DESC,
                total_purchase_value DESC,
                sp.supplier_name ASC
            `;
        }

        const [[countResult]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total

                FROM suppliers sp

                ${supplierWhereClause}
            `, supplierValues);

        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(
                        DISTINCT sp.id
                    ) AS total_suppliers,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN LOWER(
                                sp.status
                            ) = 'active'
                            THEN sp.id
                        END
                    ) AS active_suppliers,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN LOWER(
                                sp.status
                            ) = 'inactive'
                            THEN sp.id
                        END
                    ) AS inactive_suppliers,

                    COUNT(
                        DISTINCT po.id
                    ) AS total_purchase_orders,

                    COALESCE(
                        SUM(po.grand_total),
                        0
                    ) AS total_purchase_value,

                    COALESCE(
                        SUM(po.paid_amount),
                        0
                    ) AS total_paid_amount,

                    COALESCE(
                        SUM(po.balance_amount),
                        0
                    ) AS total_outstanding_amount,

                    COALESCE(
                        AVG(po.grand_total),
                        0
                    ) AS average_purchase_value,

                    COALESCE(
                        SUM(sp.current_balance),
                        0
                    ) AS supplier_current_balance

                FROM suppliers sp

                LEFT JOIN purchase_orders po
                    ON ${purchaseJoinClause}

                ${supplierWhereClause}
            `, [
                ...purchaseValues,
                ...supplierValues
            ]);

        const [suppliers] =
            await db.query(`
                SELECT
                    sp.id AS supplier_id,
                    sp.supplier_name,
                    sp.contact_person,
                    sp.status,
                    sp.opening_balance,
                    sp.current_balance,

                    COUNT(
                        DISTINCT po.id
                    ) AS total_purchase_orders,

                    COALESCE(
                        SUM(po.subtotal),
                        0
                    ) AS total_subtotal,

                    COALESCE(
                        SUM(po.discount),
                        0
                    ) AS total_discount,

                    COALESCE(
                        SUM(po.tax),
                        0
                    ) AS total_tax,

                    COALESCE(
                        SUM(po.shipping),
                        0
                    ) AS total_shipping,

                    COALESCE(
                        SUM(po.grand_total),
                        0
                    ) AS total_purchase_value,

                    COALESCE(
                        SUM(po.paid_amount),
                        0
                    ) AS total_paid_amount,

                    COALESCE(
                        SUM(po.balance_amount),
                        0
                    ) AS outstanding_balance,

                    COALESCE(
                        AVG(po.grand_total),
                        0
                    ) AS average_purchase_value,

                    MIN(
                        po.order_date
                    ) AS first_purchase_date,

                    MAX(
                        po.order_date
                    ) AS last_purchase_date,

                    MAX(
                        po.expected_date
                    ) AS latest_expected_date,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN LOWER(
                                po.payment_status
                            ) = 'paid'
                            THEN po.id
                        END
                    ) AS paid_purchase_orders,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN LOWER(
                                po.payment_status
                            ) = 'partial'
                            THEN po.id
                        END
                    ) AS partial_purchase_orders,

                    COUNT(
                        DISTINCT
                        CASE
                            WHEN LOWER(
                                po.payment_status
                            ) = 'pending'
                            THEN po.id
                        END
                    ) AS pending_purchase_orders

                FROM suppliers sp

                LEFT JOIN purchase_orders po
                    ON ${purchaseJoinClause}

                ${supplierWhereClause}

                GROUP BY
                    sp.id,
                    sp.supplier_name,
                    sp.contact_person,
                    sp.status,
                    sp.opening_balance,
                    sp.current_balance

                ORDER BY
                    ${orderByClause}

                LIMIT ?
                OFFSET ?
            `, [
                ...purchaseValues,
                ...supplierValues,
                limit,
                offset
            ]);

        const formattedSuppliers =
            suppliers.map(
                (supplier, index) => ({
                    rank:
                        offset + index + 1,

                    supplierId:
                        Number(
                            supplier.supplier_id
                        ),

                    supplierName:
                        supplier.supplier_name,

                    contactPerson:
                        supplier.contact_person,

                    status:
                        supplier.status,

                    openingBalance:
                        Number(
                            supplier.opening_balance || 0
                        ),

                    currentBalance:
                        Number(
                            supplier.current_balance || 0
                        ),

                    totalPurchaseOrders:
                        Number(
                            supplier.total_purchase_orders || 0
                        ),

                    paidPurchaseOrders:
                        Number(
                            supplier.paid_purchase_orders || 0
                        ),

                    partialPurchaseOrders:
                        Number(
                            supplier.partial_purchase_orders || 0
                        ),

                    pendingPurchaseOrders:
                        Number(
                            supplier.pending_purchase_orders || 0
                        ),

                    totalSubtotal:
                        Number(
                            supplier.total_subtotal || 0
                        ),

                    totalDiscount:
                        Number(
                            supplier.total_discount || 0
                        ),

                    totalTax:
                        Number(
                            supplier.total_tax || 0
                        ),

                    totalShipping:
                        Number(
                            supplier.total_shipping || 0
                        ),

                    totalPurchaseValue:
                        Number(
                            supplier.total_purchase_value || 0
                        ),

                    totalPaidAmount:
                        Number(
                            supplier.total_paid_amount || 0
                        ),

                    outstandingBalance:
                        Number(
                            supplier.outstanding_balance || 0
                        ),

                    averagePurchaseValue:
                        Number(
                            supplier.average_purchase_value || 0
                        ),

                    firstPurchaseDate:
                        supplier.first_purchase_date,

                    lastPurchaseDate:
                        supplier.last_purchase_date,

                    latestExpectedDate:
                        supplier.latest_expected_date,

                    performanceStatus:
                        Number(
                            supplier.total_purchase_orders || 0
                        ) === 0
                            ? "No Purchases"
                            : Number(
                                supplier.outstanding_balance || 0
                            ) > 0
                                ? "Outstanding Balance"
                                : "Clear"
                })
            );

        const total =
            Number(
                countResult.total || 0
            );

        res.json({
            success: true,

            report: {
                type:
                    "Supplier Performance",

                filters: {
                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null,

                    search:
                        search || null,

                    status:
                        supplierStatus || null,

                    sortBy
                },

                summary: {
                    totalSuppliers:
                        Number(
                            summary.total_suppliers || 0
                        ),

                    activeSuppliers:
                        Number(
                            summary.active_suppliers || 0
                        ),

                    inactiveSuppliers:
                        Number(
                            summary.inactive_suppliers || 0
                        ),

                    totalPurchaseOrders:
                        Number(
                            summary.total_purchase_orders || 0
                        ),

                    totalPurchaseValue:
                        Number(
                            summary.total_purchase_value || 0
                        ),

                    totalPaidAmount:
                        Number(
                            summary.total_paid_amount || 0
                        ),

                    totalOutstandingAmount:
                        Number(
                            summary.total_outstanding_amount || 0
                        ),

                    averagePurchaseValue:
                        Number(
                            summary.average_purchase_value || 0
                        ),

                    supplierCurrentBalance:
                        Number(
                            summary.supplier_current_balance || 0
                        )
                },

                suppliers:
                    formattedSuppliers,

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(
                            total / limit
                        )
                }
            }
        });

    } catch (error) {
        console.error(
            "Supplier-performance report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load supplier-performance report.",
            error:
                error.message
        });
    }
};

