"use strict";

const db = require("../config/db");
const shipmentService = require("../services/shipmentService");
const { ALL_SHIPMENT_STATUSES } = require("../utils/shipmentStatusHelper");

const validId = value => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const handleError = (res, error, fallback) => {
    console.error(fallback, error);
    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : fallback,
        error: process.env.NODE_ENV === "production" ? undefined : error.message
    });
};

exports.createForOrder = async (req, res) => {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: "A valid order ID is required." });

    try {
        const shipment = await shipmentService.createShipment({
            orderId,
            adminId: validId(req.admin?.id),
            payload: req.body || {}
        });
        return res.status(201).json({ success: true, message: "Shipment created successfully.", shipment });
    } catch (error) {
        return handleError(res, error, "Unable to create shipment.");
    }
};

exports.getByOrder = async (req, res) => {
    const orderId = validId(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: "A valid order ID is required." });

    try {
        const [[shipment]] = await db.query("SELECT * FROM shipments WHERE order_id = ? LIMIT 1", [orderId]);
        if (!shipment) return res.status(404).json({ success: false, message: "Shipment not found for this order." });

        const [history] = await db.query(
            `
                SELECT h.*, CONCAT_WS(' ', a.first_name, a.last_name) AS changed_by_name
                FROM shipment_tracking_history h
                LEFT JOIN admins a ON a.id = h.changed_by
                WHERE h.shipment_id = ?
                ORDER BY h.created_at ASC, h.id ASC
            `,
            [shipment.id]
        );
        return res.json({ success: true, shipment, history });
    } catch (error) {
        return handleError(res, error, "Unable to retrieve shipment.");
    }
};

exports.getAll = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const offset = (page - 1) * limit;
        const search = String(req.query.search || "").trim().slice(0, 150);
        const status = String(req.query.status || "").trim();
        const where = [];
        const params = [];

        if (search) {
            const pattern = `%${search}%`;
            where.push("(s.shipment_number LIKE ? OR s.tracking_number LIKE ? OR s.courier_name LIKE ? OR o.order_number LIKE ?)");
            params.push(pattern, pattern, pattern, pattern);
        }
        if (status) {
            if (!ALL_SHIPMENT_STATUSES.some(item => item.toLowerCase() === status.toLowerCase())) {
                return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${ALL_SHIPMENT_STATUSES.join(", ")}.` });
            }
            where.push("LOWER(s.status) = LOWER(?)");
            params.push(status);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const [[count]] = await db.query(
            `SELECT COUNT(*) AS total FROM shipments s INNER JOIN orders o ON o.id = s.order_id ${whereSql}`,
            params
        );
        const [shipments] = await db.query(
            `
                SELECT s.*, o.order_number, o.order_status, o.full_name, o.phone, o.city
                FROM shipments s
                INNER JOIN orders o ON o.id = s.order_id
                ${whereSql}
                ORDER BY s.created_at DESC, s.id DESC
                LIMIT ? OFFSET ?
            `,
            [...params, limit, offset]
        );

        const total = Number(count.total || 0);
        return res.json({
            success: true,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            shipments
        });
    } catch (error) {
        return handleError(res, error, "Unable to retrieve shipments.");
    }
};

exports.getById = async (req, res) => {
    const shipmentId = validId(req.params.id);
    if (!shipmentId) return res.status(400).json({ success: false, message: "A valid shipment ID is required." });

    try {
        const [[shipment]] = await db.query(
            `
                SELECT s.*, o.order_number, o.order_status, o.full_name, o.phone, o.email, o.shipping_address, o.city
                FROM shipments s
                INNER JOIN orders o ON o.id = s.order_id
                WHERE s.id = ? LIMIT 1
            `,
            [shipmentId]
        );
        if (!shipment) return res.status(404).json({ success: false, message: "Shipment not found." });
        const [history] = await db.query(
            "SELECT * FROM shipment_tracking_history WHERE shipment_id = ? ORDER BY created_at ASC, id ASC",
            [shipmentId]
        );
        return res.json({ success: true, shipment, history });
    } catch (error) {
        return handleError(res, error, "Unable to retrieve shipment details.");
    }
};

exports.updateStatus = async (req, res) => {
    const shipmentId = validId(req.params.id);
    if (!shipmentId) return res.status(400).json({ success: false, message: "A valid shipment ID is required." });

    try {
        const result = await shipmentService.updateShipmentStatus({
            shipmentId,
            requestedStatus: req.body.status,
            adminId: validId(req.admin?.id),
            payload: req.body || {}
        });
        return res.json({ success: true, message: "Shipment status updated successfully.", ...result });
    } catch (error) {
        return handleError(res, error, "Unable to update shipment status.");
    }
};

const convenience = status => async (req, res) => {
    req.body = { ...(req.body || {}), status };
    return exports.updateStatus(req, res);
};

exports.dispatch = convenience("Picked Up");
exports.markInTransit = convenience("In Transit");
exports.markOutForDelivery = convenience("Out For Delivery");
exports.markDelivered = convenience("Delivered");
exports.markReturned = convenience("Returned");
