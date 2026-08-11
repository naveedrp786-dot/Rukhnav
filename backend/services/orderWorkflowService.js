"use strict";

const db = require("../config/db");
const {
    normaliseStatus,
    canTransition,
    getAllowedTransitions,
    getTimestampColumn
} = require("../utils/orderStatusHelper");

const orderSalesIntegrationService =
    require("./orderSalesIntegrationService");

const cleanNotes = value => {
    if (value === undefined || value === null) {
        return null;
    }

    const notes = String(value).trim();
    return notes ? notes.slice(0, 2000) : null;
};

const rollbackQuietly = async connection => {
    try {
        await connection.rollback();
    } catch (error) {
        console.error("Order workflow rollback error:", error.message);
    }
};

const updateOrderStatus = async ({ orderId, requestedStatus, adminId, notes }) => {
    const newStatus = normaliseStatus(requestedStatus);

    if (!newStatus) {
        const error = new Error("Invalid order status.");
        error.statusCode = 400;
        throw error;
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [rows] = await connection.query(
            `
                SELECT
                    id,
                    order_number,
                    customer_id,
                    order_status,
                    payment_status,
                    cancellation_reason
                FROM orders
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
            `,
            [orderId]
        );

        if (rows.length === 0) {
            const error = new Error("Order not found.");
            error.statusCode = 404;
            throw error;
        }

        const order = rows[0];
        const oldStatus = normaliseStatus(order.order_status);

        if (!oldStatus) {
            const error = new Error(`The current order status '${order.order_status}' is not supported.`);
            error.statusCode = 409;
            throw error;
        }

        if (oldStatus === newStatus) {
            const error = new Error(`Order is already ${newStatus}.`);
            error.statusCode = 409;
            throw error;
        }

        if (!canTransition(oldStatus, newStatus)) {
            const allowed = getAllowedTransitions(oldStatus);
            const error = new Error(
                allowed.length > 0
                    ? `Cannot change order from ${oldStatus} to ${newStatus}. Allowed next status: ${allowed.join(", ")}.`
                    : `${oldStatus} is a final status and cannot be changed.`
            );
            error.statusCode = 409;
            throw error;
        }

        const timestampColumn = getTimestampColumn(newStatus);
        const safeNotes = cleanNotes(notes);
        const updateParts = ["order_status = ?"];
        const updateValues = [newStatus];

        if (timestampColumn) {
            // Column name is selected only from a fixed internal allow-list.
            updateParts.push(`${timestampColumn} = COALESCE(${timestampColumn}, CURRENT_TIMESTAMP)`);
        }

        if (newStatus === "Cancelled" && safeNotes) {
            updateParts.push("cancellation_reason = ?");
            updateValues.push(safeNotes.slice(0, 500));
        }

        updateValues.push(orderId);

        await connection.query(
            `
                UPDATE orders
                SET ${updateParts.join(", ")}
                WHERE id = ?
            `,
            updateValues
        );

        const [historyResult] = await connection.query(
            `
                INSERT INTO order_status_history
                (
                    order_id,
                    old_status,
                    new_status,
                    changed_by_type,
                    changed_by_id,
                    notes
                )
                VALUES (?, ?, ?, 'Admin', ?, ?)
            `,
            [orderId, oldStatus, newStatus, adminId || null, safeNotes]
        );

        // =============================================
        // Website Order -> ERP Sale -> Invoice
        // =============================================

        let salesIntegration = null;

        if (newStatus === "Confirmed") {
            salesIntegration =
                await orderSalesIntegrationService.ensureSaleForOrder(
                    connection,
                    {
                        orderId,
                        adminId: adminId || null
                    }
                );
        }

        const [updatedRows] = await connection.query(
            `
                SELECT
                    id,
                    order_number,
                    customer_id,
                    order_status,
                    payment_status,
                    confirmed_at,
                    processing_at,
                    packed_at,
                    ready_for_pickup_at,
                    handed_to_courier_at,
                    in_transit_at,
                    out_for_delivery_at,
                    delivered_at,
                    cancelled_at,
                    returned_at,
                    refunded_at,
                    updated_at
                FROM orders
                WHERE id = ?
                LIMIT 1
            `,
            [orderId]
        );

        await connection.commit();

        return {
            order: updatedRows[0],
            oldStatus,
            newStatus,
            historyId: historyResult.insertId,
            changedByAdminId: adminId || null,
            notes: safeNotes,
            salesIntegration
        };
    } catch (error) {
        if (connection) {
            await rollbackQuietly(connection);
        }
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    updateOrderStatus
};
