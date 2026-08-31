"use strict";

const PAYMENT_STATUS = Object.freeze({
    PENDING: "Pending",
    PROCESSING: "Processing",
    PAID: "Paid",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
    PARTIALLY_REFUNDED: "Partially Refunded",
    REFUNDED: "Refunded"
});

const ORDER_PAYMENT_STATUS = Object.freeze({
    PENDING: "Pending",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    PARTIALLY_REFUNDED: "Partially Refunded",
    REFUNDED: "Refunded"
});

const ALLOWED_METHODS = Object.freeze([
    "Cash on Delivery",
    "Cash",
    "JazzCash",
    "Easypaisa",
    "Bank Transfer",
    "Credit/Debit Card",
    "Wallet",
    "Other"
]);

const normaliseMethod = value => {
    if (value === undefined || value === null) return null;
    const candidate = String(value).trim().toLowerCase();
    return ALLOWED_METHODS.find(item => item.toLowerCase() === candidate) || null;
};

const normaliseTransactionStatus = value => {
    if (value === undefined || value === null || String(value).trim() === "") {
        return PAYMENT_STATUS.PAID;
    }
    const candidate = String(value).trim().toLowerCase();
    return Object.values(PAYMENT_STATUS)
        .find(item => item.toLowerCase() === candidate) || null;
};

const toMoney = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return Number(amount.toFixed(2));
};

module.exports = {
    PAYMENT_STATUS,
    ORDER_PAYMENT_STATUS,
    ALLOWED_METHODS,
    normaliseMethod,
    normaliseTransactionStatus,
    toMoney
};
