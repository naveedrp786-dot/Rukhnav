"use strict";

const pad = (value) => String(value).padStart(2, "0");

const formatDate = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatMonth = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const clampInteger = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
};

const createDailyBuckets = (days) => {
    const safeDays = clampInteger(days, 30, 7, 90);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = [];
    for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        buckets.push({
            date: formatDate(date),
            orders: 0,
            revenue: 0
        });
    }

    return buckets;
};

const createMonthlyBuckets = (months) => {
    const safeMonths = clampInteger(months, 12, 1, 24);
    const current = new Date();
    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    const buckets = [];
    for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
        const date = new Date(current.getFullYear(), current.getMonth() - offset, 1);
        buckets.push({
            month_key: formatMonth(date),
            year: date.getFullYear(),
            month_number: date.getMonth() + 1,
            month_name: date.toLocaleString("en-GB", { month: "short" }),
            orders: 0,
            revenue: 0,
            customers: 0
        });
    }

    return buckets;
};

module.exports = {
    clampInteger,
    createDailyBuckets,
    createMonthlyBuckets
};
