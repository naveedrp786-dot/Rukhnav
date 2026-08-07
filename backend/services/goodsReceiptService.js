const db = require("../config/db");

// =====================================================
// Helpers
// =====================================================
const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const toPositiveInteger = (value, fieldName) => {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        throw createError(`${fieldName} must be a positive whole number.`);
    }

    return number;
};

const formatDatePart = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}${month}${day}`;
};

const calculateStockStatus = (stockQuantity, lowStockLevel) => {
    if (stockQuantity <= 0) {
        return "Out of Stock";
    }

    if (stockQuantity <= lowStockLevel) {
        return "Low Stock";
    }

    return "In Stock";
};

const getAdminId = (adminId) => {
    const id = Number(adminId);

    return Number.isInteger(id) && id > 0 ? id : null;
};

// =====================================================
// Create Goods Receipt Note
// =====================================================
exports.createGoodsReceipt = async ({
    purchaseOrderId,
    receiptDate,
    supplierDeliveryNote = null,
    vehicleNumber = null,
    remarks = null,
    items,
    adminId
}) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const poId = toPositiveInteger(
            purchaseOrderId,
            "Purchase order ID"
        );

        if (!Array.isArray(items) || items.length === 0) {
            throw createError(
                "At least one received item is required."
            );
        }

        const [[purchaseOrder]] = await connection.query(
            `
            SELECT
                po.id,
                po.po_number,
                po.supplier_id,
                po.status,
                po.order_date
            FROM purchase_orders po
            WHERE po.id = ?
            FOR UPDATE
            `,
            [poId]
        );

        if (!purchaseOrder) {
            throw createError(
                "Purchase order not found.",
                404
            );
        }

        if (
            purchaseOrder.status === "Cancelled" ||
            purchaseOrder.status === "Closed"
        ) {
            throw createError(
                `A ${purchaseOrder.status} purchase order cannot receive goods.`
            );
        }

        if (purchaseOrder.status === "Draft") {
            throw createError(
                "Approve or order the purchase order before receiving goods."
            );
        }

        const requestedItemIds = items.map((item) =>
            toPositiveInteger(
                item.purchase_order_item_id,
                "Purchase order item ID"
            )
        );

        if (new Set(requestedItemIds).size !== requestedItemIds.length) {
            throw createError(
                "The same purchase order item cannot appear more than once in one GRN."
            );
        }

        const placeholders = requestedItemIds
            .map(() => "?")
            .join(",");

        const [purchaseItems] = await connection.query(
            `
            SELECT
                poi.id,
                poi.purchase_order_id,
                poi.product_id,
                poi.quantity,
                poi.received_quantity,
                poi.unit_cost,
                p.product_name,
                p.stock_quantity,
                p.low_stock_level
            FROM purchase_order_items poi
            INNER JOIN products p
                ON p.id = poi.product_id
            WHERE poi.purchase_order_id = ?
              AND poi.id IN (${placeholders})
            FOR UPDATE
            `,
            [poId, ...requestedItemIds]
        );

        if (purchaseItems.length !== requestedItemIds.length) {
            throw createError(
                "One or more purchase order items are invalid or do not belong to this purchase order."
            );
        }

        const purchaseItemMap = new Map(
            purchaseItems.map((item) => [Number(item.id), item])
        );

        let totalReceivedQuantity = 0;
        let totalAcceptedQuantity = 0;
        let totalRejectedQuantity = 0;
        let totalAmount = 0;

        const preparedItems = items.map((inputItem) => {
            const purchaseOrderItemId = toPositiveInteger(
                inputItem.purchase_order_item_id,
                "Purchase order item ID"
            );

            const poItem = purchaseItemMap.get(
                purchaseOrderItemId
            );

            const receivedQuantity = toPositiveInteger(
                inputItem.received_quantity,
                `Received quantity for ${poItem.product_name}`
            );

            const acceptedQuantity =
                inputItem.accepted_quantity === undefined ||
                inputItem.accepted_quantity === null ||
                inputItem.accepted_quantity === ""
                    ? receivedQuantity
                    : Number(inputItem.accepted_quantity);

            const rejectedQuantity =
                inputItem.rejected_quantity === undefined ||
                inputItem.rejected_quantity === null ||
                inputItem.rejected_quantity === ""
                    ? receivedQuantity - acceptedQuantity
                    : Number(inputItem.rejected_quantity);

            if (
                !Number.isInteger(acceptedQuantity) ||
                acceptedQuantity < 0
            ) {
                throw createError(
                    `Accepted quantity for ${poItem.product_name} must be a non-negative whole number.`
                );
            }

            if (
                !Number.isInteger(rejectedQuantity) ||
                rejectedQuantity < 0
            ) {
                throw createError(
                    `Rejected quantity for ${poItem.product_name} must be a non-negative whole number.`
                );
            }

            if (
                acceptedQuantity + rejectedQuantity !==
                receivedQuantity
            ) {
                throw createError(
                    `Accepted plus rejected quantity must equal received quantity for ${poItem.product_name}.`
                );
            }

            const orderedQuantity = Number(poItem.quantity);
            const previouslyReceivedQuantity = Number(
                poItem.received_quantity || 0
            );
            const remainingQuantity =
                orderedQuantity - previouslyReceivedQuantity;

            if (receivedQuantity > remainingQuantity) {
                throw createError(
                    `${poItem.product_name}: only ${remainingQuantity} unit(s) remain outstanding.`
                );
            }

            const unitCost = Number(poItem.unit_cost);
            const lineTotal = acceptedQuantity * unitCost;

            totalReceivedQuantity += receivedQuantity;
            totalAcceptedQuantity += acceptedQuantity;
            totalRejectedQuantity += rejectedQuantity;
            totalAmount += lineTotal;

            return {
                poItem,
                purchaseOrderItemId,
                productId: Number(poItem.product_id),
                orderedQuantity,
                previouslyReceivedQuantity,
                receivedQuantity,
                acceptedQuantity,
                rejectedQuantity,
                unitCost,
                lineTotal,
                conditionStatus:
                    inputItem.condition_status || "Good",
                rejectionReason:
                    inputItem.rejection_reason?.trim() || null,
                itemRemarks:
                    inputItem.remarks?.trim() || null
            };
        });

        const temporaryNumber =
            `PENDING-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

        const [grnResult] = await connection.query(
            `
            INSERT INTO goods_receipts (
                grn_number,
                purchase_order_id,
                supplier_id,
                receipt_date,
                supplier_delivery_note,
                vehicle_number,
                status,
                total_received_quantity,
                total_accepted_quantity,
                total_rejected_quantity,
                total_amount,
                remarks,
                received_by
            )
            VALUES (?, ?, ?, ?, ?, ?, 'Posted', ?, ?, ?, ?, ?, ?)
            `,
            [
                temporaryNumber,
                poId,
                purchaseOrder.supplier_id,
                receiptDate || new Date(),
                supplierDeliveryNote?.trim() || null,
                vehicleNumber?.trim() || null,
                totalReceivedQuantity,
                totalAcceptedQuantity,
                totalRejectedQuantity,
                totalAmount,
                remarks?.trim() || null,
                getAdminId(adminId)
            ]
        );

        const goodsReceiptId = grnResult.insertId;
        const grnNumber =
            `GRN-${formatDatePart()}-${String(goodsReceiptId).padStart(6, "0")}`;

        await connection.query(
            `
            UPDATE goods_receipts
            SET grn_number = ?
            WHERE id = ?
            `,
            [grnNumber, goodsReceiptId]
        );

        for (const item of preparedItems) {
            const [grnItemResult] = await connection.query(
                `
                INSERT INTO goods_receipt_items (
                    goods_receipt_id,
                    purchase_order_item_id,
                    product_id,
                    ordered_quantity,
                    previously_received_quantity,
                    received_quantity,
                    accepted_quantity,
                    rejected_quantity,
                    unit_cost,
                    line_total,
                    condition_status,
                    rejection_reason,
                    remarks,
                    inventory_updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    goodsReceiptId,
                    item.purchaseOrderItemId,
                    item.productId,
                    item.orderedQuantity,
                    item.previouslyReceivedQuantity,
                    item.receivedQuantity,
                    item.acceptedQuantity,
                    item.rejectedQuantity,
                    item.unitCost,
                    item.lineTotal,
                    item.conditionStatus,
                    item.rejectionReason,
                    item.itemRemarks,
                    item.acceptedQuantity > 0
                        ? new Date()
                        : null
                ]
            );

            const newReceivedQuantity =
                item.previouslyReceivedQuantity +
                item.receivedQuantity;

            await connection.query(
                `
                UPDATE purchase_order_items
                SET received_quantity = ?
                WHERE id = ?
                `,
                [
                    newReceivedQuantity,
                    item.purchaseOrderItemId
                ]
            );

            if (item.acceptedQuantity > 0) {
                const previousStock = Number(
                    item.poItem.stock_quantity
                );
                const newStock =
                    previousStock + item.acceptedQuantity;
                const stockStatus = calculateStockStatus(
                    newStock,
                    Number(item.poItem.low_stock_level || 0)
                );

                await connection.query(
                    `
                    UPDATE products
                    SET
                        stock_quantity = ?,
                        cost_price = ?,
                        stock_status = ?
                    WHERE id = ?
                    `,
                    [
                        newStock,
                        item.unitCost,
                        stockStatus,
                        item.productId
                    ]
                );

                await connection.query(
                    `
                    INSERT INTO inventory_transactions (
                        product_id,
                        transaction_type,
                        quantity,
                        previous_stock,
                        new_stock,
                        cost_price,
                        supplier_id,
                        reference,
                        remarks,
                        created_by
                    )
                    VALUES (?, 'Stock In', ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        item.productId,
                        item.acceptedQuantity,
                        previousStock,
                        newStock,
                        item.unitCost,
                        purchaseOrder.supplier_id,
                        grnNumber,
                        `Goods received against ${purchaseOrder.po_number}`,
                        getAdminId(adminId)
                    ]
                );
            }

            await connection.query(
                `
                UPDATE goods_receipt_items
                SET inventory_updated_at =
                    CASE
                        WHEN accepted_quantity > 0
                        THEN COALESCE(inventory_updated_at, NOW())
                        ELSE NULL
                    END
                WHERE id = ?
                `,
                [grnItemResult.insertId]
            );
        }

        const [[receiptProgress]] = await connection.query(
            `
            SELECT
                COALESCE(SUM(quantity), 0) AS ordered_quantity,
                COALESCE(SUM(received_quantity), 0) AS received_quantity
            FROM purchase_order_items
            WHERE purchase_order_id = ?
            `,
            [poId]
        );

        const orderedTotal = Number(
            receiptProgress.ordered_quantity || 0
        );
        const receivedTotal = Number(
            receiptProgress.received_quantity || 0
        );

        let newStatus = "Ordered";

        if (receivedTotal > 0 && receivedTotal < orderedTotal) {
            newStatus = "Partially Received";
        }

        if (
            orderedTotal > 0 &&
            receivedTotal >= orderedTotal
        ) {
            newStatus = "Received";
        }

        const oldStatus = purchaseOrder.status;

        await connection.query(
            `
            UPDATE purchase_orders
            SET status = ?
            WHERE id = ?
            `,
            [newStatus, poId]
        );

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
            VALUES (?, ?, 'GOODS_RECEIVED', ?, ?, ?, ?)
            `,
            [
                poId,
                goodsReceiptId,
                oldStatus,
                newStatus,
                `${grnNumber} posted. Received ${totalReceivedQuantity}, accepted ${totalAcceptedQuantity}, rejected ${totalRejectedQuantity}.`,
                getAdminId(adminId)
            ]
        );

        await connection.commit();

        return {
            id: goodsReceiptId,
            grn_number: grnNumber,
            purchase_order_id: poId,
            po_number: purchaseOrder.po_number,
            status: "Posted",
            purchase_order_status: newStatus,
            total_received_quantity: totalReceivedQuantity,
            total_accepted_quantity: totalAcceptedQuantity,
            total_rejected_quantity: totalRejectedQuantity,
            total_amount: Number(totalAmount.toFixed(2))
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// =====================================================
// Get All GRNs
// =====================================================
exports.getGoodsReceipts = async ({
    purchaseOrderId = null,
    status = null
} = {}) => {
    const conditions = [];
    const values = [];

    if (purchaseOrderId) {
        conditions.push("gr.purchase_order_id = ?");
        values.push(Number(purchaseOrderId));
    }

    if (status) {
        conditions.push("gr.status = ?");
        values.push(status);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [rows] = await db.query(
        `
        SELECT
            gr.*,
            po.po_number,
            s.supplier_name,
            a.full_name AS received_by_name
        FROM goods_receipts gr
        INNER JOIN purchase_orders po
            ON po.id = gr.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = gr.supplier_id
        LEFT JOIN admins a
            ON a.id = gr.received_by
        ${whereClause}
        ORDER BY gr.id DESC
        `,
        values
    );

    return rows;
};

// =====================================================
// Get One GRN
// =====================================================
exports.getGoodsReceiptById = async (goodsReceiptId) => {
    const id = toPositiveInteger(
        goodsReceiptId,
        "Goods receipt ID"
    );

    const [headers] = await db.query(
        `
        SELECT
            gr.*,
            po.po_number,
            po.order_date,
            s.supplier_name,
            s.contact_person,
            s.phone,
            s.email,
            s.address,
            s.city,
            s.country,
            a.full_name AS received_by_name
        FROM goods_receipts gr
        INNER JOIN purchase_orders po
            ON po.id = gr.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = gr.supplier_id
        LEFT JOIN admins a
            ON a.id = gr.received_by
        WHERE gr.id = ?
        LIMIT 1
        `,
        [id]
    );

    if (headers.length === 0) {
        throw createError(
            "Goods receipt note not found.",
            404
        );
    }

    const [items] = await db.query(
        `
        SELECT
            gri.*,
            p.product_name,
            p.sku,
            p.unit
        FROM goods_receipt_items gri
        INNER JOIN products p
            ON p.id = gri.product_id
        WHERE gri.goods_receipt_id = ?
        ORDER BY gri.id ASC
        `,
        [id]
    );

    return {
        goods_receipt: headers[0],
        items
    };
};

// =====================================================
// Get GRNs for One Purchase Order
// =====================================================
exports.getPurchaseOrderGoodsReceipts = async (
    purchaseOrderId
) => {
    const poId = toPositiveInteger(
        purchaseOrderId,
        "Purchase order ID"
    );

    const [rows] = await db.query(
        `
        SELECT
            gr.*,
            a.full_name AS received_by_name
        FROM goods_receipts gr
        LEFT JOIN admins a
            ON a.id = gr.received_by
        WHERE gr.purchase_order_id = ?
        ORDER BY gr.id DESC
        `,
        [poId]
    );

    return rows;
};
