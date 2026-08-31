"use strict";

const dashboardService = require("../services/dashboardService");
const analyticsService = require("../services/dashboardAnalyticsService");

const sendError = (res, error, context) => {
    console.error(`${context}:`, error);
    return res.status(500).json({
        success: false,
        message: "Unable to load dashboard data.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
};

const sendData = (res, message, data) => res.json({
    success: true,
    message,
    data
});

exports.getSummary = async (req, res) => {
    try {
        return sendData(
            res,
            "Dashboard summary fetched successfully.",
            await dashboardService.getSummary()
        );
    } catch (error) {
        return sendError(res, error, "Dashboard summary error");
    }
};

exports.getLatestOrders = async (req, res) => {
    try {
        const orders = await dashboardService.getLatestOrders(req.query.limit);
        return res.json({
            success: true,
            message: "Latest orders fetched successfully.",
            count: orders.length,
            orders
        });
    } catch (error) {
        return sendError(res, error, "Latest orders error");
    }
};

exports.getLowStockProducts = async (req, res) => {
    try {
        const products = await dashboardService.getLowStockProducts(req.query.limit);
        return res.json({
            success: true,
            message: "Low-stock products fetched successfully.",
            count: products.length,
            products
        });
    } catch (error) {
        return sendError(res, error, "Low-stock dashboard error");
    }
};

exports.getRecentCustomers = async (req, res) => {
    try {
        const customers = await dashboardService.getRecentCustomers(req.query.limit);
        return res.json({
            success: true,
            message: "Recent customers fetched successfully.",
            count: customers.length,
            customers
        });
    } catch (error) {
        return sendError(res, error, "Recent customers error");
    }
};

exports.getDailySales = async (req, res) => {
    try {
        return sendData(
            res,
            "Daily sales analytics fetched successfully.",
            await analyticsService.getDailySales(req.query.days)
        );
    } catch (error) {
        return sendError(res, error, "Daily sales analytics error");
    }
};

exports.getMonthlyRevenue = async (req, res) => {
    try {
        return sendData(
            res,
            "Monthly revenue analytics fetched successfully.",
            await analyticsService.getMonthlyRevenue(req.query.months)
        );
    } catch (error) {
        return sendError(res, error, "Monthly revenue analytics error");
    }
};

exports.getOrderStatusDistribution = async (req, res) => {
    try {
        return sendData(
            res,
            "Order-status analytics fetched successfully.",
            await analyticsService.getOrderStatusDistribution()
        );
    } catch (error) {
        return sendError(res, error, "Order-status analytics error");
    }
};

exports.getTopSellingProducts = async (req, res) => {
    try {
        return sendData(
            res,
            "Top-selling products fetched successfully.",
            await analyticsService.getTopSellingProducts(req.query.limit)
        );
    } catch (error) {
        return sendError(res, error, "Top-selling products error");
    }
};

exports.getPaymentMethodStatistics = async (req, res) => {
    try {
        return sendData(
            res,
            "Payment-method analytics fetched successfully.",
            await analyticsService.getPaymentMethodStatistics()
        );
    } catch (error) {
        return sendError(res, error, "Payment-method analytics error");
    }
};

exports.getCustomerGrowth = async (req, res) => {
    try {
        return sendData(
            res,
            "Customer-growth analytics fetched successfully.",
            await analyticsService.getCustomerGrowth(req.query.months)
        );
    } catch (error) {
        return sendError(res, error, "Customer-growth analytics error");
    }
};
