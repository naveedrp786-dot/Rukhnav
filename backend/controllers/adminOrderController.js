"use strict";

const db = require("../config/db");
const { ALL_STATUSES, normaliseStatus } = require("../utils/orderStatusHelper");
const orderWorkflowService = require("../services/orderWorkflowService");

const positiveInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const cleanSearch = value => String(value || "").trim().slice(0, 150);

/* =====================================================
   Orders Dashboard Summary
   GET /api/admin/orders/summary
===================================================== */

exports.getOrderSummary = async (
    req,
    res
) => {
    try {
        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_orders,

                    SUM(
                        CASE
                            WHEN order_status = 'Pending'
                            THEN 1
                            ELSE 0
                        END
                    ) AS pending_orders,

                    SUM(
                        CASE
                            WHEN order_status = 'Confirmed'
                            THEN 1
                            ELSE 0
                        END
                    ) AS confirmed_orders,

                    SUM(
                        CASE
                            WHEN order_status = 'Processing'
                            THEN 1
                            ELSE 0
                        END
                    ) AS processing_orders,

                    SUM(
                        CASE
                            WHEN order_status = 'Shipped'
                            THEN 1
                            ELSE 0
                        END
                    ) AS shipped_orders,

                    SUM(
                        CASE
                            WHEN order_status = 'Delivered'
                            THEN 1
                            ELSE 0
                        END
                    ) AS delivered_orders,

                    SUM(
                        CASE
                            WHEN order_status = 'Cancelled'
                            THEN 1
                            ELSE 0
                        END
                    ) AS cancelled_orders,

                    SUM(
                        CASE
                            WHEN DATE(created_at) = CURRENT_DATE
                            THEN 1
                            ELSE 0
                        END
                    ) AS today_orders,

                    SUM(
                        CASE
                            WHEN created_at >=
                                DATE_FORMAT(
                                    CURRENT_DATE,
                                    '%Y-%m-01'
                                )
                            THEN 1
                            ELSE 0
                        END
                    ) AS month_orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_status = 'Paid'
                                THEN grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS paid_revenue,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_status IN (
                                    'Pending',
                                    'Partially Paid'
                                )
                                THEN balance_amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS pending_payment_value,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN order_status = 'Delivered'
                                AND payment_status = 'Paid'
                                THEN grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS delivered_revenue,

                    COALESCE(
                        AVG(grand_total),
                        0
                    ) AS average_order_value

                FROM orders
            `);

        return res.json({
            success: true,
            message:
                "Order summary fetched successfully.",

            summary: {
                totalOrders:
                    Number(
                        summary.total_orders || 0
                    ),

                pendingOrders:
                    Number(
                        summary.pending_orders || 0
                    ),

                confirmedOrders:
                    Number(
                        summary.confirmed_orders || 0
                    ),

                processingOrders:
                    Number(
                        summary.processing_orders || 0
                    ),

                shippedOrders:
                    Number(
                        summary.shipped_orders || 0
                    ),

                deliveredOrders:
                    Number(
                        summary.delivered_orders || 0
                    ),

                cancelledOrders:
                    Number(
                        summary.cancelled_orders || 0
                    ),

                todayOrders:
                    Number(
                        summary.today_orders || 0
                    ),

                monthOrders:
                    Number(
                        summary.month_orders || 0
                    ),

                paidRevenue:
                    Number(
                        summary.paid_revenue || 0
                    ),

                pendingPaymentValue:
                    Number(
                        summary.pending_payment_value || 0
                    ),

                deliveredRevenue:
                    Number(
                        summary.delivered_revenue || 0
                    ),

                averageOrderValue:
                    Number(
                        summary.average_order_value || 0
                    )
            }
        });
    } catch (error) {
        console.error(
            "Admin order summary error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve order summary.",

            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};


exports.getAllOrders = async (req, res) => {
    try {
        const page = positiveInteger(req.query.page, 1);
        const limit = Math.min(positiveInteger(req.query.limit, 20), 100);
        const offset = (page - 1) * limit;
        const search = cleanSearch(req.query.search);
        const status = req.query.status ? normaliseStatus(req.query.status) : null;
        const paymentStatus = cleanSearch(req.query.payment_status).toLowerCase();
        const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;
        const dateFrom = cleanSearch(req.query.date_from);
        const dateTo = cleanSearch(req.query.date_to);

        if (req.query.status && !status) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values: ${ALL_STATUSES.join(", ")}.`
            });
        }

        if (customerId !== null && (!Number.isInteger(customerId) || customerId < 1)) {
            return res.status(400).json({
                success: false,
                message: "A valid customer_id is required."
            });
        }

        const where = [];
        const params = [];

        if (search) {
            where.push(`(
                o.order_number LIKE ? OR
                o.full_name LIKE ? OR
                o.phone LIKE ? OR
                o.email LIKE ?
            )`);
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern, pattern);
        }

        if (status) {
            where.push("o.order_status = ?");
            params.push(status);
        }

        if (paymentStatus) {
            where.push("LOWER(o.payment_status) = ?");
            params.push(paymentStatus);
        }

        if (customerId !== null) {
            where.push("o.customer_id = ?");
            params.push(customerId);
        }

        if (dateFrom) {
            where.push("DATE(o.created_at) >= ?");
            params.push(dateFrom);
        }

        if (dateTo) {
            where.push("DATE(o.created_at) <= ?");
            params.push(dateTo);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const [[countRow]] = await db.query(
            `SELECT COUNT(*) AS total FROM orders o ${whereSql}`,
            params
        );

        const [orders] = await db.query(
            `
                SELECT
                    o.id,
                    o.order_number,
                    o.customer_id,
                    o.full_name,
                    o.phone,
                    o.email,
                    o.city,
                    o.grand_total,
                    o.discount_amount,
                    o.delivery_charges,
                    o.order_status,
                    o.payment_method,
                    o.payment_status,
                    o.tracking_number,
                    o.estimated_delivery_date,
                    o.created_at,
COUNT(oi.id) AS item_count,
                    COALESCE(SUM(oi.quantity), 0) AS total_quantity
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                ${whereSql}
                GROUP BY o.id
                ORDER BY o.created_at DESC, o.id DESC
                LIMIT ? OFFSET ?
            `,
            [...params, limit, offset]
        );

        const total = Number(countRow.total || 0);

        return res.json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            filters: {
                search: search || null,
                status,
                paymentStatus: paymentStatus || null,
                customerId,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null
            },
            orders
        });
    } catch (error) {
        console.error("Admin get orders error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve orders.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId < 1) {
            return res.status(400).json({ success: false, message: "A valid order ID is required." });
        }

        const [orderRows] = await db.query(
            `SELECT * FROM orders WHERE id = ? LIMIT 1`,
            [orderId]
        );

        if (orderRows.length === 0) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const [items] = await db.query(
            `
                SELECT
                    oi.id,
                    oi.product_id,
                    p.product_name,
                    oi.price,
                    oi.quantity,
                    oi.subtotal
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC
            `,
            [orderId]
        );

        const [history] = await db.query(
            `
                SELECT
                    h.id,
                    h.order_id,
                    h.old_status,
                    h.new_status,
                    h.changed_by_type,
                    h.changed_by_id,
                    h.notes,
                    h.created_at,
                    CONCAT_WS(' ', a.first_name, a.last_name) AS changed_by_name,
                    a.email AS changed_by_email
                FROM order_status_history h
                LEFT JOIN admins a ON a.id = h.changed_by_id
                WHERE h.order_id = ?
                ORDER BY h.created_at ASC, h.id ASC
            `,
            [orderId]
        );

        return res.json({
            success: true,
            order: orderRows[0],
            itemCount: items.length,
            totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
            items,
            history
        });
    } catch (error) {
        console.error("Admin get order details error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve order details.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.getOrderHistory = async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId < 1) {
            return res.status(400).json({ success: false, message: "A valid order ID is required." });
        }

        const [[order]] = await db.query(
            `SELECT id, order_number, order_status FROM orders WHERE id = ? LIMIT 1`,
            [orderId]
        );

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const [history] = await db.query(
            `
                SELECT
                    h.id,
                    h.old_status,
                    h.new_status,
                    h.changed_by_type,
                    h.changed_by_id,
                    h.notes,
                    h.created_at,
                    CONCAT_WS(' ', a.first_name, a.last_name) AS changed_by_name
                FROM order_status_history h
                LEFT JOIN admins a ON a.id = h.changed_by_id
                WHERE h.order_id = ?
                ORDER BY h.created_at ASC, h.id ASC
            `,
            [orderId]
        );

        return res.json({ success: true, order, total: history.length, history });
    } catch (error) {
        console.error("Admin get order history error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve order history.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const adminId = Number(req.admin?.id);
        const requestedStatus = req.body.status || req.body.order_status;

        if (!Number.isInteger(orderId) || orderId < 1) {
            return res.status(400).json({ success: false, message: "A valid order ID is required." });
        }

        if (!Number.isInteger(adminId) || adminId < 1) {
            return res.status(401).json({ success: false, message: "Admin authentication is required." });
        }

        if (!requestedStatus) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const result = await orderWorkflowService.updateOrderStatus({
            orderId,
            requestedStatus,
            adminId,
            notes: req.body.notes
        });

        return res.json({
            success: true,
            message: `Order status changed from ${result.oldStatus} to ${result.newStatus}.`,
            workflow: result
        });
    } catch (error) {
        console.error("Admin update order status error:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Unable to update order status."
        });
    }
};
