"use strict";

const db = require("../../config/db");

// =========================================
// Financial Summary Dashboard
// GET /api/reports/financial
// =========================================

exports.getFinancialSummary = async (req, res) => {
    try {
        // =========================================
        // Revenue Summary
        // Only completed sales are included
        // =========================================

        const [[revenue]] = await db.query(`
            SELECT
                COUNT(*) AS total_completed_sales,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_sale_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN DATE(sale_date) = CURDATE()
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS revenue_today,

                COALESCE(
                    SUM(
                        CASE
                            WHEN YEAR(sale_date) = YEAR(CURDATE())
                            AND MONTH(sale_date) = MONTH(CURDATE())
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS revenue_this_month,

                COALESCE(
                    SUM(
                        CASE
                            WHEN YEAR(sale_date) = YEAR(CURDATE())
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS revenue_this_year

            FROM sales

            WHERE LOWER(sale_status) = 'completed'
        `);

        // =========================================
        // Sales Payment Status
        // =========================================

        const [[salesPaymentStatus]] = await db.query(`
            SELECT
                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'paid'
                        THEN 1
                    END
                ) AS paid_sales_count,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'partial'
                        THEN 1
                    END
                ) AS partial_sales_count,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'pending'
                        THEN 1
                    END
                ) AS pending_sales_count,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status) = 'paid'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_sales_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status) = 'partial'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS partial_sales_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status) = 'pending'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_sales_value

            FROM sales

            WHERE LOWER(sale_status) != 'cancelled'
        `);

        // =========================================
        // Purchase Summary
        // Cancelled purchase orders are excluded
        // =========================================

        const [[purchases]] = await db.query(`
            SELECT
                COUNT(*) AS total_purchase_orders,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_purchase_value,

                COALESCE(
                    SUM(paid_amount),
                    0
                ) AS total_purchase_paid,

                COALESCE(
                    SUM(balance_amount),
                    0
                ) AS total_purchase_outstanding,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_purchase_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN DATE(order_date) = CURDATE()
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS purchases_today,

                COALESCE(
                    SUM(
                        CASE
                            WHEN YEAR(order_date) = YEAR(CURDATE())
                            AND MONTH(order_date) = MONTH(CURDATE())
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS purchases_this_month,

                COALESCE(
                    SUM(
                        CASE
                            WHEN YEAR(order_date) = YEAR(CURDATE())
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS purchases_this_year

            FROM purchase_orders

            WHERE status IS NULL
            OR LOWER(status) != 'cancelled'
        `);

        // =========================================
        // Purchase Payment Status
        // =========================================

        const [[purchasePaymentStatus]] = await db.query(`
            SELECT
                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'paid'
                        THEN 1
                    END
                ) AS paid_purchase_count,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'partial'
                        THEN 1
                    END
                ) AS partial_purchase_count,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'pending'
                        THEN 1
                    END
                ) AS pending_purchase_count,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status) = 'paid'
                            THEN grand_total
                            ELSE 0
                        END
                    ),
                    0
                ) AS paid_purchase_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status) = 'partial'
                            THEN balance_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS partial_purchase_outstanding,

                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status) = 'pending'
                            THEN balance_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_purchase_outstanding

            FROM purchase_orders

            WHERE status IS NULL
            OR LOWER(status) != 'cancelled'
        `);

        // =========================================
        // Inventory Summary
        // =========================================

        const [[inventory]] = await db.query(`
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

        // =========================================
        // Estimated Sales Gross Profit
        //
        // Cost is calculated using the product's
        // current cost_price.
        // =========================================

        const [[profitability]] = await db.query(`
            SELECT
                COALESCE(
                    SUM(si.total),
                    0
                ) AS net_product_sales,

                COALESCE(
                    SUM(
                        p.cost_price * si.quantity
                    ),
                    0
                ) AS estimated_cost_of_goods_sold,

                COALESCE(
                    SUM(si.total) -
                    SUM(
                        p.cost_price * si.quantity
                    ),
                    0
                ) AS estimated_gross_profit

            FROM sale_items si

            INNER JOIN sales s
                ON s.id = si.sale_id

            INNER JOIN products p
                ON p.id = si.product_id

            WHERE LOWER(s.sale_status) = 'completed'
        `);

        // =========================================
        // Customer and Supplier Summary
        // =========================================

        const [[customers]] = await db.query(`
            SELECT
                COUNT(*) AS total_customers,

                COUNT(
                    CASE
                        WHEN LOWER(status) = 'active'
                        THEN 1
                    END
                ) AS active_customers,

                COUNT(
                    CASE
                        WHEN YEAR(created_at) = YEAR(CURDATE())
                        AND MONTH(created_at) = MONTH(CURDATE())
                        THEN 1
                    END
                ) AS new_customers_this_month

            FROM customers

            WHERE deleted_at IS NULL
        `);

        const [[suppliers]] = await db.query(`
            SELECT
                COUNT(*) AS total_suppliers,

                COUNT(
                    CASE
                        WHEN LOWER(status) = 'active'
                        THEN 1
                    END
                ) AS active_suppliers,

                COALESCE(
                    SUM(current_balance),
                    0
                ) AS supplier_current_balance

            FROM suppliers
        `);

        // =========================================
        // Numeric Calculations
        // =========================================

        const totalRevenue =
            Number(revenue.total_revenue || 0);

        const totalPurchaseValue =
            Number(
                purchases.total_purchase_value || 0
            );

        const inventoryCostValue =
            Number(
                inventory.inventory_cost_value || 0
            );

        const inventorySellingValue =
            Number(
                inventory.inventory_selling_value || 0
            );

        const estimatedGrossProfit =
            Number(
                profitability.estimated_gross_profit || 0
            );

        const netProductSales =
            Number(
                profitability.net_product_sales || 0
            );

        const grossProfitMargin =
            netProductSales > 0
                ? (
                    estimatedGrossProfit /
                    netProductSales
                ) * 100
                : 0;

        const inventoryMargin =
            inventorySellingValue > 0
                ? (
                    (
                        inventorySellingValue -
                        inventoryCostValue
                    ) /
                    inventorySellingValue
                ) * 100
                : 0;

        const revenuePurchaseRatio =
            totalPurchaseValue > 0
                ? totalRevenue /
                  totalPurchaseValue
                : 0;

        const operatingDifference =
            totalRevenue -
            totalPurchaseValue;

        let financialPosition = "Balanced";

        if (operatingDifference > 0) {
            financialPosition = "Positive";
        }

        if (operatingDifference < 0) {
            financialPosition = "Negative";
        }

        let stockHealth = "Good";

        if (
            Number(
                inventory.out_of_stock_products || 0
            ) > 0
        ) {
            stockHealth =
                "Attention Required";
        } else if (
            Number(
                inventory.low_stock_products || 0
            ) > 0
        ) {
            stockHealth =
                "Monitor Low Stock";
        }

        let profitabilityStatus =
            "No Completed Sales";

        if (netProductSales > 0) {
            profitabilityStatus =
                estimatedGrossProfit >= 0
                    ? "Profitable"
                    : "Loss";
        }

        // =========================================
        // Response
        // =========================================

        res.json({
            success: true,

            report: {
                type:
                    "Financial Summary Dashboard",

                generatedAt:
                    new Date(),

                revenue: {
                    totalCompletedSales:
                        Number(
                            revenue.total_completed_sales || 0
                        ),

                    totalRevenue,

                    revenueToday:
                        Number(
                            revenue.revenue_today || 0
                        ),

                    revenueThisMonth:
                        Number(
                            revenue.revenue_this_month || 0
                        ),

                    revenueThisYear:
                        Number(
                            revenue.revenue_this_year || 0
                        ),

                    averageSaleValue:
                        Number(
                            revenue.average_sale_value || 0
                        )
                },

                salesPayments: {
                    paidSalesCount:
                        Number(
                            salesPaymentStatus.paid_sales_count || 0
                        ),

                    partialSalesCount:
                        Number(
                            salesPaymentStatus.partial_sales_count || 0
                        ),

                    pendingSalesCount:
                        Number(
                            salesPaymentStatus.pending_sales_count || 0
                        ),

                    paidSalesValue:
                        Number(
                            salesPaymentStatus.paid_sales_value || 0
                        ),

                    partialSalesValue:
                        Number(
                            salesPaymentStatus.partial_sales_value || 0
                        ),

                    pendingSalesValue:
                        Number(
                            salesPaymentStatus.pending_sales_value || 0
                        )
                },

                purchases: {
                    totalPurchaseOrders:
                        Number(
                            purchases.total_purchase_orders || 0
                        ),

                    totalPurchaseValue,

                    totalPurchasePaid:
                        Number(
                            purchases.total_purchase_paid || 0
                        ),

                    totalPurchaseOutstanding:
                        Number(
                            purchases.total_purchase_outstanding || 0
                        ),

                    purchasesToday:
                        Number(
                            purchases.purchases_today || 0
                        ),

                    purchasesThisMonth:
                        Number(
                            purchases.purchases_this_month || 0
                        ),

                    purchasesThisYear:
                        Number(
                            purchases.purchases_this_year || 0
                        ),

                    averagePurchaseValue:
                        Number(
                            purchases.average_purchase_value || 0
                        )
                },

                purchasePayments: {
                    paidPurchaseCount:
                        Number(
                            purchasePaymentStatus.paid_purchase_count || 0
                        ),

                    partialPurchaseCount:
                        Number(
                            purchasePaymentStatus.partial_purchase_count || 0
                        ),

                    pendingPurchaseCount:
                        Number(
                            purchasePaymentStatus.pending_purchase_count || 0
                        ),

                    paidPurchaseValue:
                        Number(
                            purchasePaymentStatus.paid_purchase_value || 0
                        ),

                    partialPurchaseOutstanding:
                        Number(
                            purchasePaymentStatus.partial_purchase_outstanding || 0
                        ),

                    pendingPurchaseOutstanding:
                        Number(
                            purchasePaymentStatus.pending_purchase_outstanding || 0
                        )
                },

                inventory: {
                    totalProducts:
                        Number(
                            inventory.total_products || 0
                        ),

                    totalStockQuantity:
                        Number(
                            inventory.total_stock_quantity || 0
                        ),

                    inventoryCostValue,

                    inventorySellingValue,

                    expectedInventoryProfit:
                        Number(
                            inventory.expected_inventory_profit || 0
                        ),

                    lowStockProducts:
                        Number(
                            inventory.low_stock_products || 0
                        ),

                    outOfStockProducts:
                        Number(
                            inventory.out_of_stock_products || 0
                        )
                },

                profitability: {
                    netProductSales,

                    estimatedCostOfGoodsSold:
                        Number(
                            profitability.estimated_cost_of_goods_sold || 0
                        ),

                    estimatedGrossProfit,

                    grossProfitMargin:
                        Number(
                            grossProfitMargin.toFixed(2)
                        ),

                    inventoryMargin:
                        Number(
                            inventoryMargin.toFixed(2)
                        ),

                    profitabilityStatus
                },

                businessKpis: {
                    revenuePurchaseRatio:
                        Number(
                            revenuePurchaseRatio.toFixed(2)
                        ),

                    operatingDifference:
                        Number(
                            operatingDifference.toFixed(2)
                        ),

                    financialPosition,

                    stockHealth
                },

                customers: {
                    totalCustomers:
                        Number(
                            customers.total_customers || 0
                        ),

                    activeCustomers:
                        Number(
                            customers.active_customers || 0
                        ),

                    newCustomersThisMonth:
                        Number(
                            customers.new_customers_this_month || 0
                        )
                },

                suppliers: {
                    totalSuppliers:
                        Number(
                            suppliers.total_suppliers || 0
                        ),

                    activeSuppliers:
                        Number(
                            suppliers.active_suppliers || 0
                        ),

                    supplierCurrentBalance:
                        Number(
                            suppliers.supplier_current_balance || 0
                        )
                }
            }
        });

    } catch (error) {
        console.error(
            "Financial summary report error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load financial summary report.",
            error:
                error.message
        });
    }
};