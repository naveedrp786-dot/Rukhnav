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

const inventoryService =
    require("./inventoryService");

const notificationHooks =
    require("./notificationHooks");

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
                    grand_total,
                    payment_method,
                    payment_status,
                    tracking_number,
                    tracking_url,
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

        // Website stock is reserved when the order is placed.
        // Once Confirmed, an ERP Sale + Invoice exists and its
        // cancellation workflow must own stock/refund reversal.
        if (
            newStatus === "Cancelled" &&
            oldStatus !== "Pending"
        ) {
            const [linkedSales] =
                await connection.query(
                    `
                    SELECT
                        id,
                        sale_number,
                        sale_status,
                        payment_status
                    FROM sales
                    WHERE order_id = ?
                    LIMIT 1
                    `,
                    [orderId]
                );

            if (linkedSales.length) {
                const error = new Error(
                    `Order ${order.order_number || order.id} is linked to ERP sale ${linkedSales[0].sale_number}. Cancel the linked sale from Sales Management so inventory, invoice, refund and loyalty records remain synchronized.`
                );
                error.statusCode = 409;
                throw error;
            }

            const error = new Error(
                `Only Pending website orders can be cancelled directly from Order Management.`
            );
            error.statusCode = 409;
            throw error;
        }

        // Pending order cancellation: return reserved stock exactly once.
        if (
            newStatus === "Cancelled" &&
            oldStatus === "Pending"
        ) {
            const [items] =
                await connection.query(
                    `
                    SELECT
                        oi.product_id,
                        oi.quantity,
                        p.stock_quantity,
                        p.low_stock_level,
                        p.cost_price
                    FROM order_items oi
                    INNER JOIN products p
                        ON p.id = oi.product_id
                    WHERE oi.order_id = ?
                    ORDER BY oi.id ASC
                    FOR UPDATE
                    `,
                    [orderId]
                );

            if (!items.length) {
                const error = new Error(
                    "Order items were not found. Inventory cannot be restored safely."
                );
                error.statusCode = 409;
                throw error;
            }

            for (const item of items) {
                const previousStock =
                    Number(item.stock_quantity || 0);

                const restoredQuantity =
                    Number(item.quantity || 0);

                const newStock =
                    previousStock + restoredQuantity;

                const stockStatus =
                    inventoryService.getStockStatus(
                        newStock,
                        item.low_stock_level
                    );

                await connection.query(
                    `
                    UPDATE products
                    SET
                        stock_quantity = ?,
                        stock_status = ?
                    WHERE id = ?
                    `,
                    [
                        newStock,
                        stockStatus,
                        item.product_id
                    ]
                );

                await inventoryService.recordMovement(
                    connection,
                    {
                        productId:
                            item.product_id,
                        transactionType:
                            "Stock In",
                        quantity:
                            restoredQuantity,
                        previousStock,
                        newStock,
                        costPrice:
                            Number(item.cost_price || 0),
                        supplierId:
                            null,
                        reference:
                            order.order_number ||
                            `ORDER-${order.id}`,
                        remarks:
                            `Stock restored after admin cancellation of website order ${order.order_number || order.id}`,
                        createdBy:
                            adminId || null
                    }
                );
            }
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

        // =============================================
        // Customer Order Status Notification
        //
        // The order transaction has already committed.
        // Notification delivery is asynchronous and must
        // never roll back a successful order transition.
        // =============================================

        if (order.customer_id) {
            notificationHooks
                .orderStatusChanged({
                    customerId:
                        order.customer_id,
                    orderId,
                    orderNumber:
                        order.order_number,
                    orderStatus:
                        newStatus,
                    grandTotal:
                        order.grand_total,
                    paymentMethod:
                        order.payment_method,
                    paymentStatus:
                        order.payment_status,
                    trackingNumber:
                        order.tracking_number || "",
                    trackingUrl:
                        order.tracking_url || "",
                    orderUrl:
                        `/store/order-details.html?id=${orderId}`
                })
                .catch(error => {
                    console.error(
                        "Order status notification queue error:",
                        error.message
                    );
                });
        }

        // =============================================
        // Already-Paid Order -> Loyalty -> Referral
        //
        // Sale/Invoice must commit first because the
        // loyalty service uses its own DB connection.
        // =============================================

        let loyaltyProcessing = null;

        if (
            salesIntegration &&
            salesIntegration.saleId &&
            salesIntegration.paymentStatus === "Paid"
        ) {
            loyaltyProcessing =
                await orderSalesIntegrationService
                    .processPaidOrderSale(
                        salesIntegration.saleId
                    );
        }

        return {
            order: updatedRows[0],
            oldStatus,
            newStatus,
            historyId: historyResult.insertId,
            changedByAdminId: adminId || null,
            notes: safeNotes,
            salesIntegration,
            loyaltyProcessing
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
