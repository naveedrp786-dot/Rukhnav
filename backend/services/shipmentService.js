"use strict";

const db = require("../config/db");

const notificationHooks =
    require("./notificationHooks");
const {
    normaliseStatus,
    canTransition,
    getAllowedTransitions,
    getTimestampColumn
} = require("../utils/orderStatusHelper");
const {
    SHIPMENT_STATUS,
    normaliseShipmentStatus,
    canTransitionShipment,
    getAllowedShipmentTransitions,
    getOrderStatusForShipment
} = require("../utils/shipmentStatusHelper");

const cleanText = (value, max = 255) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, max) : null;
};

const money = value => {
    const number = Number(value || 0);
    return Number.isFinite(number) && number >= 0 ? Number(number.toFixed(2)) : null;
};

const fail = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const rollbackQuietly = async connection => {
    try { await connection.rollback(); } catch (_) { /* no-op */ }
};

const makeShipmentNumber = (shipmentId, now = new Date()) => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `SHP-${y}${m}${d}-${String(shipmentId).padStart(6, "0")}`;
};

const applyOrderStatus = async ({ connection, order, newOrderStatus, adminId, notes }) => {
    if (!newOrderStatus) return order.order_status;

    const oldOrderStatus = normaliseStatus(order.order_status);
    const canonicalNewStatus = normaliseStatus(newOrderStatus);

    if (!oldOrderStatus || !canonicalNewStatus) {
        throw fail("The related order has an unsupported status.", 409);
    }

    if (oldOrderStatus === canonicalNewStatus) return oldOrderStatus;

    if (!canTransition(oldOrderStatus, canonicalNewStatus)) {
        const allowed = getAllowedTransitions(oldOrderStatus);
        throw fail(
            `Shipment update requires order status ${canonicalNewStatus}, but order is ${oldOrderStatus}. Allowed next order status: ${allowed.join(", ") || "none"}.`,
            409
        );
    }

    const timestampColumn = getTimestampColumn(canonicalNewStatus);
    const parts = ["order_status = ?"];
    const values = [canonicalNewStatus];

    if (timestampColumn) {
        parts.push(`${timestampColumn} = COALESCE(${timestampColumn}, CURRENT_TIMESTAMP)`);
    }

    await connection.query(
        `UPDATE orders SET ${parts.join(", ")} WHERE id = ?`,
        [...values, order.id]
    );

    await connection.query(
        `
            INSERT INTO order_status_history
            (order_id, old_status, new_status, changed_by_type, changed_by_id, notes)
            VALUES (?, ?, ?, 'Admin', ?, ?)
        `,
        [order.id, oldOrderStatus, canonicalNewStatus, adminId || null, notes]
    );

    order.order_status = canonicalNewStatus;
    return canonicalNewStatus;
};

const createShipment = async ({ orderId, adminId, payload }) => {
    const courierName = cleanText(payload.courier_name, 150);
    const serviceType = cleanText(payload.service_type, 100);
    const trackingNumber = cleanText(payload.tracking_number, 150);
    const trackingUrl = cleanText(payload.tracking_url, 500);
    const estimatedDeliveryDate = cleanText(payload.estimated_delivery_date, 10);
    const deliveryNotes = cleanText(payload.delivery_notes, 2000);
    const shippingCost = money(payload.shipping_cost);

    if (!courierName) throw fail("Courier name is required.");
    if (!trackingNumber) throw fail("Tracking number is required.");
    if (shippingCost === null) throw fail("Shipping cost must be zero or a positive number.");

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [orderRows] = await connection.query(
            `
                SELECT
                    id,
                    order_number,
                    customer_id,
                    order_status,
                    grand_total,
                    payment_method,
                    payment_status
                FROM orders
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
            `,
            [orderId]
        );

        if (!orderRows.length) throw fail("Order not found.", 404);
        const order = orderRows[0];

        const [existing] = await connection.query(
            "SELECT id FROM shipments WHERE order_id = ? LIMIT 1 FOR UPDATE",
            [orderId]
        );
        if (existing.length) throw fail("A shipment already exists for this order.", 409);

        const orderStatus = normaliseStatus(order.order_status);
        if (!["Packed", "Ready For Pickup"].includes(orderStatus)) {
            throw fail("A shipment can only be created when the order is Packed or Ready For Pickup.", 409);
        }

        const [result] = await connection.query(
            `
                INSERT INTO shipments
                (
                    order_id, courier_name, service_type, tracking_number,
                    tracking_url, shipping_cost, estimated_delivery_date,
                    delivery_notes, status, created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ready', ?)
            `,
            [
                orderId, courierName, serviceType, trackingNumber,
                trackingUrl, shippingCost, estimatedDeliveryDate,
                deliveryNotes, adminId || null
            ]
        );

        const shipmentId = result.insertId;
        const shipmentNumber = makeShipmentNumber(shipmentId);

        await connection.query(
            "UPDATE shipments SET shipment_number = ? WHERE id = ?",
            [shipmentNumber, shipmentId]
        );

        await connection.query(
            `
                INSERT INTO shipment_tracking_history
                (shipment_id, old_status, new_status, location, notes, changed_by)
                VALUES (?, NULL, 'Ready', NULL, ?, ?)
            `,
            [shipmentId, deliveryNotes || "Shipment created and ready for courier pickup.", adminId || null]
        );

        const previousOrderStatus =
            order.order_status;

        await applyOrderStatus({
            connection,
            order,
            newOrderStatus: "Ready For Pickup",
            adminId,
            notes: `Shipment ${shipmentNumber} created with ${courierName}.`
        });

        await connection.query(
            `
                UPDATE orders
                SET tracking_number = ?, tracking_url = ?, estimated_delivery_date = ?
                WHERE id = ?
            `,
            [trackingNumber, trackingUrl, estimatedDeliveryDate, orderId]
        );

        const [[shipment]] = await connection.query(
            "SELECT * FROM shipments WHERE id = ? LIMIT 1",
            [shipmentId]
        );

        await connection.commit();

        if (
            order.customer_id &&
            String(previousOrderStatus) !==
                String(order.order_status)
        ) {
            notificationHooks
                .orderStatusChanged({
                    customerId:
                        order.customer_id,
                    orderId:
                        order.id,
                    orderNumber:
                        order.order_number,
                    orderStatus:
                        order.order_status,
                    grandTotal:
                        order.grand_total,
                    paymentMethod:
                        order.payment_method,
                    paymentStatus:
                        order.payment_status,
                    trackingNumber:
                        trackingNumber || "",
                    trackingUrl:
                        trackingUrl || "",
                    orderUrl:
                        `/store/order-details.html?id=${order.id}`
                })
                .catch(error => {
                    console.error(
                        "Shipment order-status notification queue error:",
                        error.message
                    );
                });
        }

        return shipment;
    } catch (error) {
        if (connection) await rollbackQuietly(connection);
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

const updateShipmentStatus = async ({ shipmentId, requestedStatus, adminId, payload = {} }) => {
    const newStatus = normaliseShipmentStatus(requestedStatus);
    if (!newStatus) throw fail("Invalid shipment status.");

    const notes = cleanText(payload.notes || payload.delivery_notes, 2000);
    const location = cleanText(payload.location, 255);
    const receiverName = cleanText(payload.receiver_name, 150);
    const receiverPhone = cleanText(payload.receiver_phone, 30);

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `
                SELECT
                    s.*,
                    o.order_number,
                    o.order_status,
                    o.customer_id,
                    o.grand_total,
                    o.payment_method,
                    o.payment_status
                FROM shipments s
                INNER JOIN orders o ON o.id = s.order_id
                WHERE s.id = ?
                LIMIT 1
                FOR UPDATE
            `,
            [shipmentId]
        );

        if (!rows.length) throw fail("Shipment not found.", 404);
        const shipment = rows[0];
        const oldStatus = normaliseShipmentStatus(shipment.status);

        if (oldStatus === newStatus) throw fail(`Shipment is already ${newStatus}.`, 409);
        if (!canTransitionShipment(oldStatus, newStatus)) {
            const allowed = getAllowedShipmentTransitions(oldStatus);
            throw fail(
                allowed.length
                    ? `Cannot change shipment from ${oldStatus} to ${newStatus}. Allowed next status: ${allowed.join(", ")}.`
                    : `${oldStatus} is a final shipment status.`,
                409
            );
        }

        const updateParts = ["status = ?"];
        const updateValues = [newStatus];

        if (newStatus === SHIPMENT_STATUS.PICKED_UP) updateParts.push("picked_up_at = COALESCE(picked_up_at, CURRENT_TIMESTAMP)");
        if (newStatus === SHIPMENT_STATUS.IN_TRANSIT) updateParts.push("in_transit_at = COALESCE(in_transit_at, CURRENT_TIMESTAMP)");
        if (newStatus === SHIPMENT_STATUS.OUT_FOR_DELIVERY) updateParts.push("out_for_delivery_at = COALESCE(out_for_delivery_at, CURRENT_TIMESTAMP)");
        if (newStatus === SHIPMENT_STATUS.DELIVERED) {
            updateParts.push("actual_delivery_date = COALESCE(actual_delivery_date, CURRENT_TIMESTAMP)");
            if (receiverName) { updateParts.push("receiver_name = ?"); updateValues.push(receiverName); }
            if (receiverPhone) { updateParts.push("receiver_phone = ?"); updateValues.push(receiverPhone); }
        }
        if (newStatus === SHIPMENT_STATUS.RETURNED) updateParts.push("returned_at = COALESCE(returned_at, CURRENT_TIMESTAMP)");
        if (newStatus === SHIPMENT_STATUS.CANCELLED) updateParts.push("cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP)");
        if (notes) { updateParts.push("delivery_notes = ?"); updateValues.push(notes); }

        await connection.query(
            `UPDATE shipments SET ${updateParts.join(", ")} WHERE id = ?`,
            [...updateValues, shipmentId]
        );

        await connection.query(
            `
                INSERT INTO shipment_tracking_history
                (shipment_id, old_status, new_status, location, notes, changed_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            [shipmentId, oldStatus, newStatus, location, notes, adminId || null]
        );

        const order = {
            id:
                shipment.order_id,
            order_number:
                shipment.order_number,
            customer_id:
                shipment.customer_id,
            order_status:
                shipment.order_status,
            grand_total:
                shipment.grand_total,
            payment_method:
                shipment.payment_method,
            payment_status:
                shipment.payment_status
        };

        const previousOrderStatus =
            order.order_status;

        await applyOrderStatus({
            connection,
            order,
            newOrderStatus: getOrderStatusForShipment(newStatus),
            adminId,
            notes: notes || `Shipment ${shipment.shipment_number} changed to ${newStatus}.`
        });

        const [[updatedShipment]] = await connection.query(
            "SELECT * FROM shipments WHERE id = ? LIMIT 1",
            [shipmentId]
        );

        await connection.commit();

        if (
            order.customer_id &&
            String(previousOrderStatus) !==
                String(order.order_status)
        ) {
            notificationHooks
                .orderStatusChanged({
                    customerId:
                        order.customer_id,
                    orderId:
                        order.id,
                    orderNumber:
                        order.order_number,
                    orderStatus:
                        order.order_status,
                    grandTotal:
                        order.grand_total,
                    paymentMethod:
                        order.payment_method,
                    paymentStatus:
                        order.payment_status,
                    trackingNumber:
                        updatedShipment.tracking_number ||
                        "",
                    trackingUrl:
                        updatedShipment.tracking_url ||
                        "",
                    orderUrl:
                        `/store/order-details.html?id=${order.id}`
                })
                .catch(error => {
                    console.error(
                        "Shipment order-status notification queue error:",
                        error.message
                    );
                });
        }

        return {
            shipment: updatedShipment,
            oldStatus,
            newStatus,
            orderStatus: order.order_status
        };
    } catch (error) {
        if (connection) await rollbackQuietly(connection);
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createShipment,
    updateShipmentStatus
};
