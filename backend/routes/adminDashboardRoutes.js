"use strict";

const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const controller = require("../controllers/adminDashboardController");

router.use(adminAuth);

router.get("/summary", controller.getSummary);
router.get("/latest-orders", controller.getLatestOrders);
router.get("/low-stock", controller.getLowStockProducts);
router.get("/recent-customers", controller.getRecentCustomers);

router.get("/charts/daily-sales", controller.getDailySales);
router.get("/charts/monthly-revenue", controller.getMonthlyRevenue);
router.get("/charts/order-status", controller.getOrderStatusDistribution);
router.get("/charts/top-products", controller.getTopSellingProducts);
router.get("/charts/payment-methods", controller.getPaymentMethodStatistics);
router.get("/charts/customer-growth", controller.getCustomerGrowth);

module.exports = router;
