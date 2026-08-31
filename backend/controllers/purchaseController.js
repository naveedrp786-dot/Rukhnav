"use strict";

const db = require("../config/db");

const PO_STATUSES = [
    "Draft",
    "Approved",
    "Ordered",
    "Partially Received",
    "Received",
    "Closed",
    "Cancelled"
];

function httpError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function positiveInteger(value, fieldName) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        throw httpError(`${fieldName} must be a positive whole number.`);
    }

    return number;
}

function nonNegativeNumber(value, fieldName) {
    const number = Number(value ?? 0);

    if (!Number.isFinite(number) || number < 0) {
        throw httpError(`${fieldName} must be zero or greater.`);
    }

    return number;
}

function cleanText(value, maxLength = 1000) {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();
    return text ? text.slice(0, maxLength) : null;
}

function validDate(value, fieldName, required = false) {
    if (!value) {
        if (required) throw httpError(`${fieldName} is required.`);
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw httpError(`${fieldName} must be a valid date.`);
    }

    return String(value).slice(0, 10);
}

function adminIdFromRequest(req) {
    const id = Number(req.admin?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function calculatePaymentStatus(grandTotal, paidAmount) {
    if (paidAmount <= 0) return "Unpaid";
    if (paidAmount >= grandTotal) return "Paid";
    return "Partial";
}

function prepareItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw httpError("At least one purchase item is required.");
    }

    const productIds = new Set();

    return items.map((item, index) => {
        const row = index + 1;
        const productId = positiveInteger(
            item.product_id,
            `Product ID on row ${row}`
        );
        const quantity = positiveInteger(
            item.quantity,
            `Quantity on row ${row}`
        );
        const unitCost = nonNegativeNumber(
            item.unit_cost,
            `Unit cost on row ${row}`
        );

        if (productIds.has(productId)) {
            throw httpError(
                `Product ID ${productId} appears more than once.`
            );
        }

        productIds.add(productId);

        return {
            productId,
            quantity,
            unitCost,
            totalCost: Number((quantity * unitCost).toFixed(2))
        };
    });
}

async function confirmSupplierAndProducts(connection, supplierId, items) {
    const [[supplier]] = await connection.query(
        `
        SELECT id, supplier_name, status
        FROM suppliers
        WHERE id = ?
        LIMIT 1
        `,
        [supplierId]
    );

    if (!supplier) {
        throw httpError("Supplier not found.", 404);
    }

    if (
        supplier.status &&
        !["Active", "active"].includes(supplier.status)
    ) {
        throw httpError("The selected supplier is not active.");
    }

    const productIds = items.map((item) => item.productId);
    const placeholders = productIds.map(() => "?").join(",");

    const [products] = await connection.query(
        `
        SELECT id, product_name
        FROM products
        WHERE id IN (${placeholders})
        `,
        productIds
    );

    if (products.length !== productIds.length) {
        throw httpError("One or more selected products do not exist.");
    }

    return supplier;
}

async function generatePoNumber(connection) {
    const [result] = await connection.query(
        `
        INSERT INTO purchase_order_number_sequences (created_at)
        VALUES (NOW())
        `
    );

    const sequence = result.insertId;
    const now = new Date();

    const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("");

    return `PO-${datePart}-${String(sequence).padStart(6, "0")}`;
}

async function writeActivity(
    connection,
    {
        purchaseOrderId,
        activityType,
        oldStatus = null,
        newStatus = null,
        description,
        performedBy = null
    }
) {
    await connection.query(
        `
        INSERT INTO purchase_order_activity_logs (
            purchase_order_id,
            goods_receipt_id,
            activity_type,
            old_status,
            new_status,
            description,
            performed_by
        )
        VALUES (?, NULL, ?, ?, ?, ?, ?)
        `,
        [
            purchaseOrderId,
            activityType,
            oldStatus,
            newStatus,
            description,
            performedBy
        ]
    );
}

// ============================================================
// POST /api/purchases
// Create a purchase order. New POs are Draft by default.
// ============================================================
exports.createPurchaseOrder = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const supplierId = positiveInteger(
            req.body.supplier_id,
            "Supplier ID"
        );
        const orderDate = validDate(
            req.body.order_date,
            "Order date",
            true
        );
        const expectedDate = validDate(
            req.body.expected_date,
            "Expected date"
        );
        const paymentMethod =
            cleanText(req.body.payment_method, 50) || "Cash";
        const discount = nonNegativeNumber(
            req.body.discount,
            "Discount"
        );
        const tax = nonNegativeNumber(req.body.tax, "Tax");
        const shipping = nonNegativeNumber(
            req.body.shipping,
            "Shipping"
        );
        const remarks = cleanText(req.body.remarks, 5000);
        const items = prepareItems(req.body.items);
        const adminId = adminIdFromRequest(req);

        await confirmSupplierAndProducts(
            connection,
            supplierId,
            items
        );

        const subtotal = Number(
            items
                .reduce((sum, item) => sum + item.totalCost, 0)
                .toFixed(2)
        );
        const grandTotal = Number(
            (subtotal - discount + tax + shipping).toFixed(2)
        );

        if (grandTotal < 0) {
            throw httpError(
                "Grand total cannot be negative. Check the discount."
            );
        }

        const poNumber = await generatePoNumber(connection);

        const [poResult] = await connection.query(
            `
            INSERT INTO purchase_orders (
                po_number,
                supplier_id,
                order_date,
                expected_date,
                payment_method,
                subtotal,
                discount,
                tax,
                shipping,
                grand_total,
                paid_amount,
                balance_amount,
                payment_status,
                status,
                remarks,
                created_by,
                approved_by,
                approved_at,
                cancelled_by,
                cancelled_at,
                cancellation_reason
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                0, ?, 'Unpaid', 'Draft', ?, ?,
                NULL, NULL, NULL, NULL, NULL
            )
            `,
            [
                poNumber,
                supplierId,
                orderDate,
                expectedDate,
                paymentMethod,
                subtotal,
                discount,
                tax,
                shipping,
                grandTotal,
                grandTotal,
                remarks,
                adminId
            ]
        );

        const purchaseOrderId = poResult.insertId;

        for (const item of items) {
            await connection.query(
                `
                INSERT INTO purchase_order_items (
                    purchase_order_id,
                    product_id,
                    quantity,
                    unit_cost,
                    total_cost,
                    received_quantity
                )
                VALUES (?, ?, ?, ?, ?, 0)
                `,
                [
                    purchaseOrderId,
                    item.productId,
                    item.quantity,
                    item.unitCost,
                    item.totalCost
                ]
            );
        }

        await writeActivity(connection, {
            purchaseOrderId,
            activityType: "CREATED",
            newStatus: "Draft",
            description: `${poNumber} created as Draft.`,
            performedBy: adminId
        });

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Purchase order created successfully.",
            purchaseOrder: {
                id: purchaseOrderId,
                po_number: poNumber,
                status: "Draft",
                subtotal,
                discount,
                tax,
                shipping,
                grand_total: grandTotal,
                paid_amount: 0,
                balance_amount: grandTotal,
                payment_status: "Unpaid"
            }
        });
    } catch (error) {
        await connection.rollback();

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// ============================================================
// GET /api/purchases
// ============================================================
exports.getPurchaseOrders = async (req, res) => {
    try {
        const conditions = [];
        const values = [];

        if (req.query.status) {
            conditions.push("po.status = ?");
            values.push(req.query.status);
        }

        if (req.query.supplier_id) {
            conditions.push("po.supplier_id = ?");
            values.push(
                positiveInteger(req.query.supplier_id, "Supplier ID")
            );
        }

        if (req.query.search) {
            conditions.push(
                "(po.po_number LIKE ? OR s.supplier_name LIKE ?)"
            );
            const search = `%${String(req.query.search).trim()}%`;
            values.push(search, search);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [orders] = await db.query(
            `
            SELECT
                po.*,
                s.supplier_name,
                CONCAT(
    COALESCE(creator.first_name, ''),
    ' ',
    COALESCE(creator.last_name, '')
) AS created_by_name,

CONCAT(
    COALESCE(approver.first_name, ''),
    ' ',
    COALESCE(approver.last_name, '')
) AS approved_by_name,
                COALESCE(
                    (
                        SELECT SUM(poi.quantity)
                        FROM purchase_order_items poi
                        WHERE poi.purchase_order_id = po.id
                    ),
                    0
                ) AS ordered_quantity,
                COALESCE(
                    (
                        SELECT SUM(poi.received_quantity)
                        FROM purchase_order_items poi
                        WHERE poi.purchase_order_id = po.id
                    ),
                    0
                ) AS received_quantity
            FROM purchase_orders po
            INNER JOIN suppliers s
                ON s.id = po.supplier_id
            LEFT JOIN admins creator
                ON creator.id = po.created_by
            LEFT JOIN admins approver
                ON approver.id = po.approved_by
            ${whereClause}
            ORDER BY po.id DESC
            `,
            values
        );

        return res.json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================================
// GET /api/purchases/:id
// ============================================================
exports.getPurchaseOrderById = async (req, res) => {
    try {
        const purchaseOrderId = positiveInteger(
            req.params.id,
            "Purchase order ID"
        );

        const [orders] = await db.query(
            `
            SELECT
                po.*,
                s.supplier_name,
                s.contact_person,
                s.phone AS supplier_phone,
                s.email AS supplier_email,
                s.address AS supplier_address,
                CONCAT(
    COALESCE(creator.first_name, ''),
    ' ',
    COALESCE(creator.last_name, '')
) AS created_by_name,

CONCAT(
    COALESCE(approver.first_name, ''),
    ' ',
    COALESCE(approver.last_name, '')
) AS approved_by_name
            FROM purchase_orders po
            INNER JOIN suppliers s
                ON s.id = po.supplier_id
            LEFT JOIN admins creator
                ON creator.id = po.created_by
            LEFT JOIN admins approver
                ON approver.id = po.approved_by
            WHERE po.id = ?
            LIMIT 1
            `,
            [purchaseOrderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Purchase order not found."
            });
        }

        const [items] = await db.query(
            `
            SELECT
                poi.*,
                p.product_name,
                p.sku,
                p.unit,
                (poi.quantity - poi.received_quantity)
                    AS remaining_quantity
            FROM purchase_order_items poi
            INNER JOIN products p
                ON p.id = poi.product_id
            WHERE poi.purchase_order_id = ?
            ORDER BY poi.id ASC
            `,
            [purchaseOrderId]
        );

        const [activity] = await db.query(
            `
            SELECT
                poal.*,
                TRIM(
    CONCAT(
        COALESCE(a.first_name, ''),
        ' ',
        COALESCE(a.last_name, '')
    )
) AS performed_by_name
            FROM purchase_order_activity_logs poal
            LEFT JOIN admins a
                ON a.id = poal.performed_by
            WHERE poal.purchase_order_id = ?
            ORDER BY poal.id DESC
            `,
            [purchaseOrderId]
        );

        return res.json({
            success: true,
            purchase: orders[0],
            items,
            activity
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================================
// PUT /api/purchases/:id
// Draft only
// ============================================================
exports.updatePurchase = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const purchaseOrderId = positiveInteger(
            req.params.id,
            "Purchase order ID"
        );
        const adminId = adminIdFromRequest(req);

        const [[current]] = await connection.query(
            `
            SELECT *
            FROM purchase_orders
            WHERE id = ?
            FOR UPDATE
            `,
            [purchaseOrderId]
        );

        if (!current) {
            throw httpError("Purchase order not found.", 404);
        }

        if (current.status !== "Draft") {
            throw httpError(
                "Only Draft purchase orders can be edited."
            );
        }

        const supplierId = positiveInteger(
            req.body.supplier_id,
            "Supplier ID"
        );
        const orderDate = validDate(
            req.body.order_date,
            "Order date",
            true
        );
        const expectedDate = validDate(
            req.body.expected_date,
            "Expected date"
        );
        const paymentMethod =
            cleanText(req.body.payment_method, 50) || "Cash";
        const discount = nonNegativeNumber(
            req.body.discount,
            "Discount"
        );
        const tax = nonNegativeNumber(req.body.tax, "Tax");
        const shipping = nonNegativeNumber(
            req.body.shipping,
            "Shipping"
        );
        const remarks = cleanText(req.body.remarks, 5000);
        const items = prepareItems(req.body.items);

        await confirmSupplierAndProducts(
            connection,
            supplierId,
            items
        );

        const subtotal = Number(
            items
                .reduce((sum, item) => sum + item.totalCost, 0)
                .toFixed(2)
        );
        const grandTotal = Number(
            (subtotal - discount + tax + shipping).toFixed(2)
        );

        if (grandTotal < 0) {
            throw httpError("Grand total cannot be negative.");
        }

        await connection.query(
            `
            UPDATE purchase_orders
            SET
                supplier_id = ?,
                order_date = ?,
                expected_date = ?,
                payment_method = ?,
                subtotal = ?,
                discount = ?,
                tax = ?,
                shipping = ?,
                grand_total = ?,
                balance_amount = ?,
                payment_status = 'Unpaid',
                remarks = ?
            WHERE id = ?
            `,
            [
                supplierId,
                orderDate,
                expectedDate,
                paymentMethod,
                subtotal,
                discount,
                tax,
                shipping,
                grandTotal,
                grandTotal,
                remarks,
                purchaseOrderId
            ]
        );

        await connection.query(
            `
            DELETE FROM purchase_order_items
            WHERE purchase_order_id = ?
            `,
            [purchaseOrderId]
        );

        for (const item of items) {
            await connection.query(
                `
                INSERT INTO purchase_order_items (
                    purchase_order_id,
                    product_id,
                    quantity,
                    unit_cost,
                    total_cost,
                    received_quantity
                )
                VALUES (?, ?, ?, ?, ?, 0)
                `,
                [
                    purchaseOrderId,
                    item.productId,
                    item.quantity,
                    item.unitCost,
                    item.totalCost
                ]
            );
        }

        await writeActivity(connection, {
            purchaseOrderId,
            activityType: "UPDATED",
            oldStatus: "Draft",
            newStatus: "Draft",
            description: `${current.po_number} updated.`,
            performedBy: adminId
        });

        await connection.commit();

        return res.json({
            success: true,
            message: "Draft purchase order updated successfully."
        });
    } catch (error) {
        await connection.rollback();

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

async function changeStatus(req, res, allowedFrom, newStatus, activityType) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const purchaseOrderId = positiveInteger(
            req.params.id,
            "Purchase order ID"
        );
        const adminId = adminIdFromRequest(req);

        const [[purchaseOrder]] = await connection.query(
            `
            SELECT id, po_number, status
            FROM purchase_orders
            WHERE id = ?
            FOR UPDATE
            `,
            [purchaseOrderId]
        );

        if (!purchaseOrder) {
            throw httpError("Purchase order not found.", 404);
        }

        if (!allowedFrom.includes(purchaseOrder.status)) {
            throw httpError(
                `Purchase order cannot move from ${purchaseOrder.status} to ${newStatus}.`
            );
        }

        if (newStatus === "Approved") {
            await connection.query(
                `
                UPDATE purchase_orders
                SET
                    status = 'Approved',
                    approved_by = ?,
                    approved_at = NOW()
                WHERE id = ?
                `,
                [adminId, purchaseOrderId]
            );
        } else {
            await connection.query(
                `
                UPDATE purchase_orders
                SET status = ?
                WHERE id = ?
                `,
                [newStatus, purchaseOrderId]
            );
        }

        await writeActivity(connection, {
            purchaseOrderId,
            activityType,
            oldStatus: purchaseOrder.status,
            newStatus,
            description:
                `${purchaseOrder.po_number} changed from ` +
                `${purchaseOrder.status} to ${newStatus}.`,
            performedBy: adminId
        });

        await connection.commit();

        return res.json({
            success: true,
            message: `Purchase order is now ${newStatus}.`,
            purchase_order_id: purchaseOrderId,
            status: newStatus
        });
    } catch (error) {
        await connection.rollback();

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
}

// POST /api/purchases/:id/approve
exports.approvePurchaseOrder = (req, res) =>
    changeStatus(req, res, ["Draft"], "Approved", "APPROVED");

// POST /api/purchases/:id/order
exports.markPurchaseOrderOrdered = (req, res) =>
    changeStatus(
        req,
        res,
        ["Approved"],
        "Ordered",
        "ORDERED"
    );

// POST /api/purchases/:id/close
exports.closePurchaseOrder = (req, res) =>
    changeStatus(
        req,
        res,
        ["Received"],
        "Closed",
        "CLOSED"
    );

// ============================================================
// POST /api/purchases/:id/cancel
// ============================================================
exports.cancelPurchaseOrder = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const purchaseOrderId = positiveInteger(
            req.params.id,
            "Purchase order ID"
        );
        const reason = cleanText(
            req.body.reason || req.body.cancellation_reason,
            1000
        );
        const adminId = adminIdFromRequest(req);

        if (!reason) {
            throw httpError("Cancellation reason is required.");
        }

        const [[purchaseOrder]] = await connection.query(
            `
            SELECT id, po_number, status
            FROM purchase_orders
            WHERE id = ?
            FOR UPDATE
            `,
            [purchaseOrderId]
        );

        if (!purchaseOrder) {
            throw httpError("Purchase order not found.", 404);
        }

        if (
            ["Partially Received", "Received", "Closed", "Cancelled"]
                .includes(purchaseOrder.status)
        ) {
            throw httpError(
                `A ${purchaseOrder.status} purchase order cannot be cancelled here.`
            );
        }

        await connection.query(
            `
            UPDATE purchase_orders
            SET
                status = 'Cancelled',
                cancelled_by = ?,
                cancelled_at = NOW(),
                cancellation_reason = ?
            WHERE id = ?
            `,
            [adminId, reason, purchaseOrderId]
        );

        await writeActivity(connection, {
            purchaseOrderId,
            activityType: "CANCELLED",
            oldStatus: purchaseOrder.status,
            newStatus: "Cancelled",
            description:
                `${purchaseOrder.po_number} cancelled. Reason: ${reason}`,
            performedBy: adminId
        });

        await connection.commit();

        return res.json({
            success: true,
            message: "Purchase order cancelled successfully.",
            status: "Cancelled"
        });
    } catch (error) {
        await connection.rollback();

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// ============================================================
// DELETE /api/purchases/:id
// Draft only, no hard-delete of processed POs
// ============================================================
exports.deletePurchase = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const purchaseOrderId = positiveInteger(
            req.params.id,
            "Purchase order ID"
        );

        const [[purchaseOrder]] = await connection.query(
            `
            SELECT id, po_number, status
            FROM purchase_orders
            WHERE id = ?
            FOR UPDATE
            `,
            [purchaseOrderId]
        );

        if (!purchaseOrder) {
            throw httpError("Purchase order not found.", 404);
        }

        if (purchaseOrder.status !== "Draft") {
            throw httpError(
                "Only Draft purchase orders can be deleted."
            );
        }

        await connection.query(
            `
            DELETE FROM purchase_order_activity_logs
            WHERE purchase_order_id = ?
            `,
            [purchaseOrderId]
        );

        await connection.query(
            `
            DELETE FROM purchase_order_items
            WHERE purchase_order_id = ?
            `,
            [purchaseOrderId]
        );

        await connection.query(
            `
            DELETE FROM purchase_orders
            WHERE id = ?
            `,
            [purchaseOrderId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: "Draft purchase order deleted successfully."
        });
    } catch (error) {
        await connection.rollback();

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    } finally {
        connection.release();
    }
};

// The old direct receive endpoint is deliberately disabled.
// Goods must be received through POST /api/grn/purchase-orders/:id.
exports.receivePurchaseOrder = async (req, res) => {
    return res.status(410).json({
        success: false,
        message:
            "Direct receiving is disabled. Use the GRN endpoint: " +
            "POST /api/grn/purchase-orders/:id"
    });
};
