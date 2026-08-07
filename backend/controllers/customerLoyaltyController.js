"use strict";

const customerLoyaltyService =
    require("../services/customerLoyaltyService");

/**
 * Get the authenticated customer's ID.
 */
function getAuthenticatedCustomerId(req) {
    return (
        req.customer?.id ||
        req.user?.id ||
        req.user?.customerId ||
        req.customerId ||
        null
    );
}

/**
 * Send a consistent error response.
 */
function sendError(res, error) {
    console.error("Customer loyalty error:", error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message:
            error.statusCode && error.statusCode < 500
                ? error.message
                : "An unexpected loyalty-system error occurred."
    });
}

/**
 * Customer: Get personal loyalty summary.
 */
exports.getMyLoyaltySummary = async (req, res) => {
    try {
        const customerId =
            getAuthenticatedCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication is required."
            });
        }

        const loyalty =
            await customerLoyaltyService
                .getCustomerLoyaltySummary(customerId);

        return res.status(200).json({
            success: true,
            message:
                "Customer loyalty summary retrieved successfully.",
            loyalty
        });
    } catch (error) {
        return sendError(res, error);
    }
};

/**
 * Admin: Award points for a fully paid sale.
 */
exports.processPaidSale = async (req, res) => {
    try {
        const saleId = Number(req.params.saleId);

        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid sale ID is required."
            });
        }

        const result =
            await customerLoyaltyService
                .processPaidSale(saleId);

        return res.status(200).json(result);
    } catch (error) {
        return sendError(res, error);
    }
};

/**
 * Admin: Reverse points for a cancelled
 * or fully returned sale.
 */
exports.reverseSalePoints = async (req, res) => {
    try {
        const saleId = Number(req.params.saleId);

        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid sale ID is required."
            });
        }

        const reason =
            typeof req.body?.reason === "string" &&
            req.body.reason.trim()
                ? req.body.reason.trim()
                : "Sale cancelled or fully returned";

        if (reason.length > 255) {
            return res.status(400).json({
                success: false,
                message:
                    "The reversal reason cannot exceed 255 characters."
            });
        }

        const result =
            await customerLoyaltyService
                .reverseSalePoints(
                    saleId,
                    reason
                );

        return res.status(200).json(result);
    } catch (error) {
        return sendError(res, error);
    }
};