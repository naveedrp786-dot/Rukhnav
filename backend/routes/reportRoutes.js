"use strict";

const express = require("express");

const router = express.Router();


const reportController =
    require("../controllers/reportController");

const financialReportController =
    require(
        "../controllers/reports/financialReportController"
    );
const chartReportController =
    require(
        "../controllers/reports/chartReportController"
    );

const biReportController =
    require(
        "../controllers/reports/biReportController"
    );

const adminAuth =
    require("../middleware/adminAuth");


// Reports dashboard summary
router.get(
    "/dashboard",
    adminAuth,
    reportController.getDashboardSummary
);
// Daily sales report
router.get(
    "/sales/daily",
    adminAuth,
    reportController.getDailySalesReport
);

// Monthly sales report
router.get(
    "/sales/monthly",
    adminAuth,
    reportController.getMonthlySalesReport
);

// Yearly sales report
router.get(
    "/sales/yearly",
    adminAuth,
    reportController.getYearlySalesReport
);

// Custom sales date range
router.get(
    "/sales/range",
    adminAuth,
    reportController.getSalesRangeReport
);

// Inventory valuation report
router.get(
    "/inventory/valuation",
    adminAuth,
    reportController.getInventoryValuationReport
);

// Low-stock report
router.get(
    "/inventory/low-stock",
    adminAuth,
    reportController.getLowStockReport
);

// Out-of-stock report
router.get(
    "/inventory/out-of-stock",
    adminAuth,
    reportController.getOutOfStockReport
);

// Stock-movement report
router.get(
    "/inventory/movements",
    adminAuth,
    reportController.getStockMovementReport
);

// Top-selling products report
router.get(
    "/products/top-selling",
    adminAuth,
    reportController.getTopSellingProductsReport
);

// Slow-moving products report
router.get(
    "/products/slow-moving",
    adminAuth,
    reportController.getSlowMovingProductsReport
);

// Top-customers report
router.get(
    "/customers/top",
    adminAuth,
    reportController.getTopCustomersReport
);

// Inactive-customers report
router.get(
    "/customers/inactive",
    adminAuth,
    reportController.getInactiveCustomersReport
);

// Supplier-performance report
router.get(
    "/suppliers/performance",
    adminAuth,
    reportController.getSupplierPerformanceReport
);

// Financial summary dashboard
router.get(
    "/financial",
    adminAuth,
    financialReportController.getFinancialSummary
);

// Monthly revenue chart
router.get(
    "/charts/monthly-revenue",
    adminAuth,
    chartReportController.getMonthlyRevenueTrend
);

// Daily sales chart
router.get(
    "/charts/daily-sales",
    adminAuth,
    chartReportController.getDailySalesTrend
);

// Category sales chart
router.get(
    "/charts/category-sales",
    adminAuth,
    chartReportController.getCategorySalesPerformance
);

// Payment-method chart
router.get(
    "/charts/payment-methods",
    adminAuth,
    chartReportController.getPaymentMethodBreakdown
);

// Customer growth business intelligence
router.get(
    "/bi/customer-growth",
    adminAuth,
    biReportController.getCustomerGrowthAnalytics
);

module.exports = router;