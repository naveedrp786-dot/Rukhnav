"use strict";

const db = require("../../config/db");

// =========================================
// Utility: Validate Year
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

// =========================================
// Customer Growth Analytics
// GET /api/reports/bi/customer-growth
// =========================================

exports.getCustomerGrowthAnalytics = async (
    req,
    res
) => {
    try {
        const year =
            getValidYear(req.query.year);

        const previousYear =
            year - 1;

        // =========================================
        // Monthly Registrations for Selected Year
        // =========================================

        const [monthlyRows] = await db.query(`
            SELECT
                MONTH(created_at) AS month_number,

                COUNT(*) AS new_customers,

                COUNT(
                    CASE
                        WHEN LOWER(status) = 'active'
                        THEN 1
                    END
                ) AS active_customers_registered,

                COUNT(
                    CASE
                        WHEN LOWER(status) = 'inactive'
                        THEN 1
                    END
                ) AS inactive_customers_registered

            FROM customers

            WHERE deleted_at IS NULL
            AND YEAR(created_at) = ?

            GROUP BY
                MONTH(created_at)

            ORDER BY
                MONTH(created_at) ASC
        `, [year]);

        // =========================================
        // Customers Registered Before Selected Year
        // Used for cumulative-growth chart
        // =========================================

        const [[beforeYear]] = await db.query(`
            SELECT
                COUNT(*) AS customers_before_year

            FROM customers

            WHERE deleted_at IS NULL
            AND created_at < ?
        `, [
            `${year}-01-01`
        ]);

        // =========================================
        // Current Customer Status Breakdown
        // =========================================

        const [[statusSummary]] = await db.query(`
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
                        WHEN LOWER(status) = 'inactive'
                        THEN 1
                    END
                ) AS inactive_customers,

                COUNT(
                    CASE
                        WHEN LOWER(status) = 'pending verification'
                        THEN 1
                    END
                ) AS pending_verification_customers,

                COUNT(
                    CASE
                        WHEN status IS NULL
                        OR TRIM(status) = ''
                        THEN 1
                    END
                ) AS status_not_set

            FROM customers

            WHERE deleted_at IS NULL
        `);

        // =========================================
        // Registrations This Month and This Year
        // Based on the actual current date
        // =========================================

        const [[currentPeriod]] = await db.query(`
            SELECT
                COUNT(
                    CASE
                        WHEN YEAR(created_at) = YEAR(CURDATE())
                        AND MONTH(created_at) = MONTH(CURDATE())
                        THEN 1
                    END
                ) AS new_customers_this_month,

                COUNT(
                    CASE
                        WHEN YEAR(created_at) = YEAR(CURDATE())
                        THEN 1
                    END
                ) AS new_customers_this_year,

                COUNT(
                    CASE
                        WHEN DATE(created_at) = CURDATE()
                        THEN 1
                    END
                ) AS new_customers_today

            FROM customers

            WHERE deleted_at IS NULL
        `);

        // =========================================
        // Selected Year vs Previous Year
        // =========================================

        const [[yearComparison]] = await db.query(`
            SELECT
                COUNT(
                    CASE
                        WHEN YEAR(created_at) = ?
                        THEN 1
                    END
                ) AS selected_year_customers,

                COUNT(
                    CASE
                        WHEN YEAR(created_at) = ?
                        THEN 1
                    END
                ) AS previous_year_customers

            FROM customers

            WHERE deleted_at IS NULL
        `, [
            year,
            previousYear
        ]);

        // =========================================
        // Month Structure
        // =========================================

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

        const monthlyMap =
            new Map(
                monthlyRows.map((row) => [
                    Number(row.month_number),
                    row
                ])
            );

        let cumulativeCustomers =
            Number(
                beforeYear.customers_before_year || 0
            );

        const monthlyData =
            monthNames.map(
                (monthName, index) => {
                    const monthNumber =
                        index + 1;

                    const row =
                        monthlyMap.get(
                            monthNumber
                        );

                    const newCustomers =
                        Number(
                            row?.new_customers || 0
                        );

                    cumulativeCustomers +=
                        newCustomers;

                    return {
                        monthNumber,

                        monthName,

                        shortMonth:
                            monthName.substring(
                                0,
                                3
                            ),

                        newCustomers,

                        activeCustomersRegistered:
                            Number(
                                row?.active_customers_registered || 0
                            ),

                        inactiveCustomersRegistered:
                            Number(
                                row?.inactive_customers_registered || 0
                            ),

                        cumulativeCustomers
                    };
                }
            );

        // =========================================
        // Growth Calculations
        // =========================================

        const selectedYearCustomers =
            Number(
                yearComparison.selected_year_customers || 0
            );

        const previousYearCustomers =
            Number(
                yearComparison.previous_year_customers || 0
            );

        let yearOverYearGrowthRate = 0;

        if (previousYearCustomers > 0) {
            yearOverYearGrowthRate =
                (
                    (
                        selectedYearCustomers -
                        previousYearCustomers
                    ) /
                    previousYearCustomers
                ) * 100;
        } else if (
            selectedYearCustomers > 0
        ) {
            yearOverYearGrowthRate = 100;
        }

        const highestGrowthMonth =
            monthlyData.reduce(
                (
                    highest,
                    month
                ) =>
                    month.newCustomers >
                    highest.newCustomers
                        ? month
                        : highest,
                monthlyData[0]
            );

        const averageMonthlyRegistrations =
            selectedYearCustomers > 0
                ? selectedYearCustomers / 12
                : 0;

        const totalCustomers =
            Number(
                statusSummary.total_customers || 0
            );

        const activeCustomers =
            Number(
                statusSummary.active_customers || 0
            );

        const inactiveCustomers =
            Number(
                statusSummary.inactive_customers || 0
            );

        const pendingVerificationCustomers =
            Number(
                statusSummary
                    .pending_verification_customers || 0
            );

        const statusNotSet =
            Number(
                statusSummary.status_not_set || 0
            );

        const knownStatusTotal =
            activeCustomers +
            inactiveCustomers +
            pendingVerificationCustomers +
            statusNotSet;

        const otherStatusCustomers =
            Math.max(
                totalCustomers -
                knownStatusTotal,
                0
            );

        const activeCustomerPercentage =
            totalCustomers > 0
                ? (
                    activeCustomers /
                    totalCustomers
                ) * 100
                : 0;

        // =========================================
        // Growth Direction
        // =========================================

        let growthDirection =
            "No Change";

        if (yearOverYearGrowthRate > 0) {
            growthDirection =
                "Growing";
        } else if (
            yearOverYearGrowthRate < 0
        ) {
            growthDirection =
                "Declining";
        }

        // =========================================
        // Response
        // =========================================

        res.json({
            success: true,

            analytics: {
                type:
                    "Customer Growth Analytics",

                generatedAt:
                    new Date(),

                filters: {
                    year,

                    previousYear
                },

                summary: {
                    totalCustomers,

                    activeCustomers,

                    inactiveCustomers,

                    pendingVerificationCustomers,

                    otherStatusCustomers,

                    newCustomersToday:
                        Number(
                            currentPeriod.new_customers_today || 0
                        ),

                    newCustomersThisMonth:
                        Number(
                            currentPeriod.new_customers_this_month || 0
                        ),

                    newCustomersThisYear:
                        Number(
                            currentPeriod.new_customers_this_year || 0
                        ),

                    selectedYearCustomers,

                    previousYearCustomers,

                    yearOverYearGrowthRate:
                        Number(
                            yearOverYearGrowthRate.toFixed(2)
                        ),

                    growthDirection,

                    averageMonthlyRegistrations:
                        Number(
                            averageMonthlyRegistrations.toFixed(2)
                        ),

                    activeCustomerPercentage:
                        Number(
                            activeCustomerPercentage.toFixed(2)
                        )
                },

                highestGrowthMonth: {
                    monthNumber:
                        highestGrowthMonth.monthNumber,

                    monthName:
                        highestGrowthMonth.monthName,

                    newCustomers:
                        highestGrowthMonth.newCustomers
                },

                statusBreakdown: {
                    labels: [
                        "Active",
                        "Inactive",
                        "Pending Verification",
                        "Other"
                    ],

                    datasets: {
                        customers: [
                            activeCustomers,
                            inactiveCustomers,
                            pendingVerificationCustomers,
                            otherStatusCustomers
                        ]
                    },

                    data: [
                        {
                            status:
                                "Active",

                            customers:
                                activeCustomers,

                            percentage:
                                totalCustomers > 0
                                    ? Number(
                                        (
                                            activeCustomers /
                                            totalCustomers *
                                            100
                                        ).toFixed(2)
                                    )
                                    : 0
                        },
                        {
                            status:
                                "Inactive",

                            customers:
                                inactiveCustomers,

                            percentage:
                                totalCustomers > 0
                                    ? Number(
                                        (
                                            inactiveCustomers /
                                            totalCustomers *
                                            100
                                        ).toFixed(2)
                                    )
                                    : 0
                        },
                        {
                            status:
                                "Pending Verification",

                            customers:
                                pendingVerificationCustomers,

                            percentage:
                                totalCustomers > 0
                                    ? Number(
                                        (
                                            pendingVerificationCustomers /
                                            totalCustomers *
                                            100
                                        ).toFixed(2)
                                    )
                                    : 0
                        },
                        {
                            status:
                                "Other",

                            customers:
                                otherStatusCustomers,

                            percentage:
                                totalCustomers > 0
                                    ? Number(
                                        (
                                            otherStatusCustomers /
                                            totalCustomers *
                                            100
                                        ).toFixed(2)
                                    )
                                    : 0
                        }
                    ]
                },

                monthlyGrowth: {
                    labels:
                        monthlyData.map(
                            (item) =>
                                item.shortMonth
                        ),

                    datasets: {
                        newCustomers:
                            monthlyData.map(
                                (item) =>
                                    item.newCustomers
                            ),

                        cumulativeCustomers:
                            monthlyData.map(
                                (item) =>
                                    item.cumulativeCustomers
                            ),

                        activeRegistrations:
                            monthlyData.map(
                                (item) =>
                                    item.activeCustomersRegistered
                            ),

                        inactiveRegistrations:
                            monthlyData.map(
                                (item) =>
                                    item.inactiveCustomersRegistered
                            )
                    },

                    data:
                        monthlyData
                }
            }
        });

    } catch (error) {
        console.error(
            "Customer growth analytics error:",
            error
        );

        res.status(500).json({
            success: false,

            message:
                "Unable to load customer growth analytics.",

            error:
                error.message
        });
    }
};