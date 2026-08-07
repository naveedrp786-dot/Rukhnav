"use strict";

const db = require("../../config/db");

// =========================================
// Utility Functions
// =========================================

const getValidYear = (value) => {
    const currentYear =
        new Date().getFullYear();

    const parsedYear =
        Number.parseInt(value, 10);

    if (
        Number.isInteger(parsedYear) &&
        parsedYear >= 2000 &&
        parsedYear <= 2100
    ) {
        return parsedYear;
    }

    return currentYear;
};

const getValidMonth = (value) => {
    const currentMonth =
        new Date().getMonth() + 1;

    const parsedMonth =
        Number.parseInt(value, 10);

    if (
        Number.isInteger(parsedMonth) &&
        parsedMonth >= 1 &&
        parsedMonth <= 12
    ) {
        return parsedMonth;
    }

    return currentMonth;
};

const getPositiveLimit = (
    value,
    fallback = 10,
    maximum = 100
) => {
    const parsedLimit =
        Number.parseInt(value, 10);

    if (
        Number.isInteger(parsedLimit) &&
        parsedLimit > 0
    ) {
        return Math.min(
            parsedLimit,
            maximum
        );
    }

    return fallback;
};

// =========================================
// Monthly Revenue Trend
// GET /api/reports/charts/monthly-revenue
// =========================================

exports.getMonthlyRevenueTrend = async (
    req,
    res
) => {
    try {
        const year =
            getValidYear(req.query.year);

        const [rows] = await db.query(`
            SELECT
                MONTH(sale_date) AS month_number,

                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_sale_value

            FROM sales

            WHERE LOWER(sale_status) = 'completed'
            AND YEAR(sale_date) = ?

            GROUP BY
                MONTH(sale_date)

            ORDER BY
                MONTH(sale_date) ASC
        `, [year]);

        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];

        const monthMap =
            new Map(
                rows.map((row) => [
                    Number(row.month_number),
                    row
                ])
            );

        const data =
            monthNames.map(
                (monthName, index) => {
                    const monthNumber =
                        index + 1;

                    const row =
                        monthMap.get(
                            monthNumber
                        );

                    return {
                        monthNumber,
                        monthName,

                        shortMonth:
                            monthName.substring(
                                0,
                                3
                            ),

                        totalSales:
                            Number(
                                row?.total_sales || 0
                            ),

                        totalRevenue:
                            Number(
                                row?.total_revenue || 0
                            ),

                        averageSaleValue:
                            Number(
                                row?.average_sale_value || 0
                            )
                    };
                }
            );

        const totalRevenue =
            data.reduce(
                (
                    total,
                    month
                ) =>
                    total +
                    month.totalRevenue,
                0
            );

        const totalSales =
            data.reduce(
                (
                    total,
                    month
                ) =>
                    total +
                    month.totalSales,
                0
            );

        const highestRevenueMonth =
            data.reduce(
                (
                    highest,
                    month
                ) =>
                    month.totalRevenue >
                    highest.totalRevenue
                        ? month
                        : highest,
                data[0]
            );

        res.json({
            success: true,

            chart: {
                type:
                    "Monthly Revenue Trend",

                filters: {
                    year
                },

                summary: {
                    totalRevenue,

                    totalSales,

                    averageSaleValue:
                        totalSales > 0
                            ? Number(
                                (
                                    totalRevenue /
                                    totalSales
                                ).toFixed(2)
                            )
                            : 0,

                    highestRevenueMonth: {
                        monthNumber:
                            highestRevenueMonth
                                .monthNumber,

                        monthName:
                            highestRevenueMonth
                                .monthName,

                        revenue:
                            highestRevenueMonth
                                .totalRevenue
                    }
                },

                labels:
                    data.map(
                        (item) =>
                            item.shortMonth
                    ),

                datasets: {
                    revenue:
                        data.map(
                            (item) =>
                                item.totalRevenue
                        ),

                    sales:
                        data.map(
                            (item) =>
                                item.totalSales
                        ),

                    averageSaleValue:
                        data.map(
                            (item) =>
                                item.averageSaleValue
                        )
                },

                data
            }
        });

    } catch (error) {
        console.error(
            "Monthly revenue chart error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load monthly revenue chart.",
            error:
                error.message
        });
    }
};

// =========================================
// Daily Sales Trend
// GET /api/reports/charts/daily-sales
// =========================================

exports.getDailySalesTrend = async (
    req,
    res
) => {
    try {
        const year =
            getValidYear(req.query.year);

        const month =
            getValidMonth(
                req.query.month
            );

        const [rows] = await db.query(`
            SELECT
                DAY(sale_date) AS day_number,

                DATE(sale_date) AS sale_day,

                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_revenue,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_sale_value

            FROM sales

            WHERE LOWER(sale_status) = 'completed'
            AND YEAR(sale_date) = ?
            AND MONTH(sale_date) = ?

            GROUP BY
                DAY(sale_date),
                DATE(sale_date)

            ORDER BY
                DAY(sale_date) ASC
        `, [
            year,
            month
        ]);

        const daysInMonth =
            new Date(
                year,
                month,
                0
            ).getDate();

        const rowMap =
            new Map(
                rows.map((row) => [
                    Number(row.day_number),
                    row
                ])
            );

        const data =
            Array.from(
                {
                    length:
                        daysInMonth
                },
                (_, index) => {
                    const dayNumber =
                        index + 1;

                    const row =
                        rowMap.get(
                            dayNumber
                        );

                    const date =
                        `${year}-${String(
                            month
                        ).padStart(
                            2,
                            "0"
                        )}-${String(
                            dayNumber
                        ).padStart(
                            2,
                            "0"
                        )}`;

                    return {
                        dayNumber,
                        date,

                        totalSales:
                            Number(
                                row?.total_sales || 0
                            ),

                        totalRevenue:
                            Number(
                                row?.total_revenue || 0
                            ),

                        averageSaleValue:
                            Number(
                                row?.average_sale_value || 0
                            )
                    };
                }
            );

        const totalRevenue =
            data.reduce(
                (
                    total,
                    day
                ) =>
                    total +
                    day.totalRevenue,
                0
            );

        const totalSales =
            data.reduce(
                (
                    total,
                    day
                ) =>
                    total +
                    day.totalSales,
                0
            );

        const highestRevenueDay =
            data.reduce(
                (
                    highest,
                    day
                ) =>
                    day.totalRevenue >
                    highest.totalRevenue
                        ? day
                        : highest,
                data[0]
            );

        res.json({
            success: true,

            chart: {
                type:
                    "Daily Sales Trend",

                filters: {
                    year,
                    month
                },

                summary: {
                    totalRevenue,

                    totalSales,

                    averageSaleValue:
                        totalSales > 0
                            ? Number(
                                (
                                    totalRevenue /
                                    totalSales
                                ).toFixed(2)
                            )
                            : 0,

                    highestRevenueDay: {
                        date:
                            highestRevenueDay
                                .date,

                        revenue:
                            highestRevenueDay
                                .totalRevenue,

                        sales:
                            highestRevenueDay
                                .totalSales
                    }
                },

                labels:
                    data.map(
                        (item) =>
                            String(
                                item.dayNumber
                            )
                    ),

                datasets: {
                    revenue:
                        data.map(
                            (item) =>
                                item.totalRevenue
                        ),

                    sales:
                        data.map(
                            (item) =>
                                item.totalSales
                        ),

                    averageSaleValue:
                        data.map(
                            (item) =>
                                item.averageSaleValue
                        )
                },

                data
            }
        });

    } catch (error) {
        console.error(
            "Daily sales chart error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load daily sales chart.",
            error:
                error.message
        });
    }
};

// =========================================
// Category Sales Performance
// GET /api/reports/charts/category-sales
// =========================================

exports.getCategorySalesPerformance = async (
    req,
    res
) => {
    try {
        const {
            fromDate,
            toDate
        } = req.query;

        const limit =
            getPositiveLimit(
                req.query.limit,
                10,
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

        const whereClause =
            `WHERE ${conditions.join(
                " AND "
            )}`;

        const [rows] = await db.query(`
            SELECT
                COALESCE(
                    NULLIF(
                        TRIM(p.category),
                        ''
                    ),
                    'Uncategorised'
                ) AS category_name,

                COUNT(
                    DISTINCT s.id
                ) AS total_sales,

                COUNT(
                    DISTINCT p.id
                ) AS products_sold,

                COALESCE(
                    SUM(si.quantity),
                    0
                ) AS total_quantity_sold,

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
                    SUM(
                        p.cost_price *
                        si.quantity
                    ),
                    0
                ) AS estimated_cost,

                COALESCE(
                    SUM(si.total) -
                    SUM(
                        p.cost_price *
                        si.quantity
                    ),
                    0
                ) AS estimated_profit

            FROM sale_items si

            INNER JOIN sales s
                ON s.id = si.sale_id

            INNER JOIN products p
                ON p.id = si.product_id

            ${whereClause}

            GROUP BY
                category_name

            ORDER BY
                net_sales_value DESC,
                total_quantity_sold DESC,
                category_name ASC

            LIMIT ?
        `, [
            ...values,
            limit
        ]);

        const data =
            rows.map(
                (row, index) => {
                    const netSalesValue =
                        Number(
                            row.net_sales_value || 0
                        );

                    const estimatedProfit =
                        Number(
                            row.estimated_profit || 0
                        );

                    return {
                        rank:
                            index + 1,

                        category:
                            row.category_name,

                        totalSales:
                            Number(
                                row.total_sales || 0
                            ),

                        productsSold:
                            Number(
                                row.products_sold || 0
                            ),

                        totalQuantitySold:
                            Number(
                                row.total_quantity_sold || 0
                            ),

                        grossSalesValue:
                            Number(
                                row.gross_sales_value || 0
                            ),

                        totalDiscount:
                            Number(
                                row.total_discount || 0
                            ),

                        netSalesValue,

                        estimatedCost:
                            Number(
                                row.estimated_cost || 0
                            ),

                        estimatedProfit,

                        estimatedProfitMargin:
                            netSalesValue > 0
                                ? Number(
                                    (
                                        estimatedProfit /
                                        netSalesValue *
                                        100
                                    ).toFixed(2)
                                )
                                : 0
                    };
                }
            );

        const totalNetSales =
            data.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.netSalesValue,
                0
            );

        const totalQuantitySold =
            data.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.totalQuantitySold,
                0
            );

        const totalEstimatedProfit =
            data.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    item.estimatedProfit,
                0
            );

        res.json({
            success: true,

            chart: {
                type:
                    "Category Sales Performance",

                filters: {
                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null,

                    limit
                },

                summary: {
                    categoriesReturned:
                        data.length,

                    totalNetSales,

                    totalQuantitySold,

                    totalEstimatedProfit
                },

                labels:
                    data.map(
                        (item) =>
                            item.category
                    ),

                datasets: {
                    netSales:
                        data.map(
                            (item) =>
                                item.netSalesValue
                        ),

                    quantitySold:
                        data.map(
                            (item) =>
                                item.totalQuantitySold
                        ),

                    estimatedProfit:
                        data.map(
                            (item) =>
                                item.estimatedProfit
                        )
                },

                data
            }
        });

    } catch (error) {
        console.error(
            "Category sales chart error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load category sales chart.",
            error:
                error.message
        });
    }
};

// =========================================
// Payment Method Breakdown
// GET /api/reports/charts/payment-methods
// =========================================

exports.getPaymentMethodBreakdown = async (
    req,
    res
) => {
    try {
        const {
            fromDate,
            toDate
        } = req.query;

        const conditions = [
            "LOWER(sale_status) != 'cancelled'"
        ];

        const values = [];

        if (fromDate) {
            conditions.push(
                "DATE(sale_date) >= ?"
            );

            values.push(fromDate);
        }

        if (toDate) {
            conditions.push(
                "DATE(sale_date) <= ?"
            );

            values.push(toDate);
        }

        const whereClause =
            `WHERE ${conditions.join(
                " AND "
            )}`;

        const [rows] = await db.query(`
            SELECT
                COALESCE(
                    NULLIF(
                        TRIM(payment_method),
                        ''
                    ),
                    'Not Specified'
                ) AS payment_method_name,

                COUNT(*) AS total_sales,

                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_value,

                COALESCE(
                    AVG(grand_total),
                    0
                ) AS average_value,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'paid'
                        THEN 1
                    END
                ) AS paid_sales,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'partial'
                        THEN 1
                    END
                ) AS partial_sales,

                COUNT(
                    CASE
                        WHEN LOWER(payment_status) = 'pending'
                        THEN 1
                    END
                ) AS pending_sales

            FROM sales

            ${whereClause}

            GROUP BY
                payment_method_name

            ORDER BY
                total_value DESC,
                total_sales DESC,
                payment_method_name ASC
        `, values);

        const totalValue =
            rows.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Number(
                        row.total_value || 0
                    ),
                0
            );

        const totalSales =
            rows.reduce(
                (
                    total,
                    row
                ) =>
                    total +
                    Number(
                        row.total_sales || 0
                    ),
                0
            );

        const data =
            rows.map(
                (row, index) => {
                    const methodValue =
                        Number(
                            row.total_value || 0
                        );

                    return {
                        rank:
                            index + 1,

                        paymentMethod:
                            row.payment_method_name,

                        totalSales:
                            Number(
                                row.total_sales || 0
                            ),

                        totalValue:
                            methodValue,

                        averageValue:
                            Number(
                                row.average_value || 0
                            ),

                        paidSales:
                            Number(
                                row.paid_sales || 0
                            ),

                        partialSales:
                            Number(
                                row.partial_sales || 0
                            ),

                        pendingSales:
                            Number(
                                row.pending_sales || 0
                            ),

                        valuePercentage:
                            totalValue > 0
                                ? Number(
                                    (
                                        methodValue /
                                        totalValue *
                                        100
                                    ).toFixed(2)
                                )
                                : 0
                    };
                }
            );

        res.json({
            success: true,

            chart: {
                type:
                    "Payment Method Breakdown",

                filters: {
                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null
                },

                summary: {
                    paymentMethods:
                        data.length,

                    totalSales,

                    totalValue
                },

                labels:
                    data.map(
                        (item) =>
                            item.paymentMethod
                    ),

                datasets: {
                    salesCount:
                        data.map(
                            (item) =>
                                item.totalSales
                        ),

                    salesValue:
                        data.map(
                            (item) =>
                                item.totalValue
                        ),

                    valuePercentage:
                        data.map(
                            (item) =>
                                item.valuePercentage
                        )
                },

                data
            }
        });

    } catch (error) {
        console.error(
            "Payment-method chart error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load payment-method chart.",
            error:
                error.message
        });
    }
};