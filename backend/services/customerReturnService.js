"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const customerLoyaltyService =
    require("./customerLoyaltyService");

const loyaltyTransactionService =
    require("./loyaltyTransactionService");

const orderSalesIntegrationService =
    require("./orderSalesIntegrationService");

const inventoryService =
    require("./inventoryService");

const RETURN_WINDOW_DAYS = Math.max(1, Number(process.env.CUSTOMER_RETURN_WINDOW_DAYS || 14));
const ACTIVE_REQUEST_STATUSES = ["Requested", "Under Review", "Approved", "Received", "Inspected"];

const fail = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const cleanText = (value, maxLength = 2000) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.slice(0, maxLength) : null;
};

const sha256 = value =>
    crypto
        .createHash("sha256")
        .update(String(value))
        .digest("hex");


const verifyGuestReturnAccessToken = ({
    token,
    orderNumber = null,
    orderId = null
}) => {

    token =
        cleanText(
            token,
            4000
        );

    if (!token) {
        throw fail(
            "Guest return authorization is required.",
            401
        );
    }

    const secret =
        process.env.JWT_SECRET;

    if (!secret) {
        console.error(
            "Guest return authorization error: JWT_SECRET is not configured."
        );

        throw fail(
            "Return verification is temporarily unavailable.",
            500
        );
    }

    let decoded;

    try {

        decoded =
            jwt.verify(
                token,
                secret
            );

    } catch (error) {

        if (
            error?.name ===
            "TokenExpiredError"
        ) {
            throw fail(
                "Your return verification has expired. Please verify the order again.",
                401
            );
        }

        throw fail(
            "Invalid return verification. Please verify the order again.",
            401
        );
    }

    if (
        decoded?.scope !==
        "guest_return"
    ) {
        throw fail(
            "Invalid return verification.",
            403
        );
    }

    const tokenOrderId =
        Number(
            decoded.orderId
        );

    const tokenOrderNumber =
        cleanText(
            decoded.orderNumber,
            50
        );

    if (
        !Number.isInteger(
            tokenOrderId
        ) ||
        tokenOrderId < 1 ||
        !tokenOrderNumber
    ) {
        throw fail(
            "Invalid return verification.",
            403
        );
    }

    if (
        orderNumber &&
        tokenOrderNumber !==
            cleanText(
                orderNumber,
                50
            )
    ) {
        throw fail(
            "Return verification does not belong to this order.",
            403
        );
    }

    if (
        orderId !== null &&
        orderId !== undefined &&
        tokenOrderId !==
            Number(orderId)
    ) {
        throw fail(
            "Return verification does not belong to this order.",
            403
        );
    }

    return {
        orderId:
            tokenOrderId,

        orderNumber:
            tokenOrderNumber
    };
};


const money = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

const positiveId = (value, label = "ID") => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw fail(`A valid ${label} is required.`);
    return n;
};

const makeNumber = (prefix, id, now = new Date()) => {
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `${prefix}-${date}-${String(id).padStart(6, "0")}`;
};

const rollbackQuietly = async connection => {
    try { await connection.rollback(); } catch (_) { /* no-op */ }
};

const addActivity = async (connection, data) => {
    await connection.query(
        `INSERT INTO customer_return_activity_logs
         (return_request_id, actor_type, actor_id, action, from_status, to_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.returnRequestId, data.actorType, data.actorId || null, data.action,
         data.fromStatus || null, data.toStatus || null, cleanText(data.notes)]
    );
};

const assertReturnWindow = deliveredAt => {
    const delivered = new Date(deliveredAt);
    if (!deliveredAt || Number.isNaN(delivered.getTime())) throw fail("The order has no valid delivery date.");
    const deadline = new Date(delivered);
    deadline.setDate(deadline.getDate() + RETURN_WINDOW_DAYS);
    if (new Date() > deadline) throw fail(`The ${RETURN_WINDOW_DAYS}-day return period has expired.`);
};

const updateOrderPaymentSummary = async (connection, orderId) => {
    const [[order]] = await connection.query(
        `SELECT id, grand_total FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`, [orderId]
    );
    if (!order) throw fail("Order not found.", 404);

    const [[totals]] = await connection.query(
        `SELECT
            COALESCE(SUM(CASE WHEN status IN ('Paid','Partially Refunded','Refunded') THEN amount ELSE 0 END),0) gross_paid,
            COALESCE(SUM(refunded_amount),0) refunded
         FROM payment_transactions WHERE order_id = ?`, [orderId]
    );

    const grand = money(order.grand_total);
    const gross = Math.max(0, money(totals.gross_paid));
    const refunded = Math.max(0, money(totals.refunded));
    const net = Math.max(0, money(gross - refunded));

    // Refunds do not create a new receivable. Outstanding balance is based
    // on the original gross payment, not on the post-refund retained amount.
    const balance = Math.max(0, money(grand - gross));

    let status = "Pending";
    if (refunded > 0 && net <= 0) status = "Refunded";
    else if (refunded > 0) status = "Partially Refunded";
    else if (grand > 0 && gross >= grand) status = "Paid";
    else if (gross > 0) status = "Partially Paid";

    await connection.query(
        `UPDATE orders SET paid_amount = ?, balance_amount = ?, payment_status = ? WHERE id = ?`,
        [net, balance, status, orderId]
    );

    return {
        gross_paid_amount: gross,
        refunded_amount: refunded,
        paid_amount: net,
        net_paid_amount: net,
        balance_amount: balance,
        payment_status: status
    };
};

const calculateReturnFinancials = async (
    connection,
    {
        orderId,
        grossAmount
    }
) => {
    const [[order]] = await connection.query(
        `SELECT
            id,
            discount_amount,
            loyalty_discount_amount,
            reward_points_discount_amount
         FROM orders
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [orderId]
    );

    if (!order) throw fail("Order not found.", 404);

    const [[subtotalRow]] = await connection.query(
        `SELECT COALESCE(SUM(subtotal), 0) AS merchandise_subtotal
         FROM order_items
         WHERE order_id = ?`,
        [orderId]
    );

    const merchandiseSubtotal = money(subtotalRow.merchandise_subtotal);
    const gross = Math.max(0, money(grossAmount));

    if (gross <= 0 || merchandiseSubtotal <= 0) {
        return {
            gross_return_amount: gross,
            coupon_discount_share: 0,
            loyalty_discount_share: 0,
            reward_discount_share: 0,
            effective_refund_amount: gross
        };
    }

    const ratio = Math.min(1, gross / merchandiseSubtotal);

    let couponShare = money(
        Math.max(0, Number(order.discount_amount || 0)) * ratio
    );
    let loyaltyShare = money(
        Math.max(0, Number(order.loyalty_discount_amount || 0)) * ratio
    );
    let rewardShare = money(
        Math.max(0, Number(order.reward_points_discount_amount || 0)) * ratio
    );

    // Defensive cap for malformed historical orders whose merchandise
    // discounts exceed merchandise value. Reduce later discounts first.
    let totalShare = money(couponShare + loyaltyShare + rewardShare);

    if (totalShare > gross) {
        let excess = money(totalShare - gross);

        const rewardReduction = Math.min(rewardShare, excess);
        rewardShare = money(rewardShare - rewardReduction);
        excess = money(excess - rewardReduction);

        const loyaltyReduction = Math.min(loyaltyShare, excess);
        loyaltyShare = money(loyaltyShare - loyaltyReduction);
        excess = money(excess - loyaltyReduction);

        const couponReduction = Math.min(couponShare, excess);
        couponShare = money(couponShare - couponReduction);
    }

    totalShare = money(couponShare + loyaltyShare + rewardShare);

    return {
        gross_return_amount: gross,
        coupon_discount_share: couponShare,
        loyalty_discount_share: loyaltyShare,
        reward_discount_share: rewardShare,
        effective_refund_amount: Math.max(0, money(gross - totalShare))
    };
};

const createReturnRequestForOrder = async ({
    customerId = null,
    payload = {},
    guestOrderNumber = null,
    guestToken = null,
    returnAccessToken = null
}) => {

    const reason =
        cleanText(
            payload.reason,
            100
        );

    const customerNotes =
        cleanText(
            payload.customer_notes
        );

    const requestedItems =
        Array.isArray(payload.items)
            ? payload.items
            : [];

    if (!reason) {
        throw fail(
            "A return reason is required."
        );
    }

    if (!requestedItems.length) {
        throw fail(
            "At least one return item is required."
        );
    }

    const guestMode =
        Boolean(
            guestOrderNumber &&
            (
                guestToken ||
                returnAccessToken
            )
        );

    const returnAccess =
        (
            guestMode &&
            returnAccessToken
        )
            ? verifyGuestReturnAccessToken({
                token:
                    returnAccessToken,

                orderNumber:
                    guestOrderNumber
            })
            : null;

    let orderId = null;

    if (!guestMode) {
        customerId =
            positiveId(
                customerId,
                "customer ID"
            );

        orderId =
            positiveId(
                payload.order_id,
                "order ID"
            );
    }

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        let order = null;

        // ==========================================
        // Secure Guest Order Ownership
        // ==========================================

        if (guestMode) {

            let rows;

            if (returnAccess) {

                [rows] =
                    await connection.query(
                        `
                        SELECT
                            id,
                            order_number,
                            customer_id,
                            order_status,
                            delivered_at
                        FROM orders
                        WHERE id = ?
                          AND order_number = ?
                          AND checkout_type = 'guest'
                          AND customer_id IS NULL
                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            returnAccess.orderId,
                            returnAccess.orderNumber
                        ]
                    );

            } else {

                [rows] =
                    await connection.query(
                        `
                        SELECT
                            id,
                            order_number,
                            customer_id,
                            order_status,
                            delivered_at
                        FROM orders
                        WHERE order_number = ?
                          AND checkout_type = 'guest'
                          AND customer_id IS NULL
                          AND guest_access_token_hash = ?
                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            guestOrderNumber,
                            sha256(
                                guestToken
                            )
                        ]
                    );
            }

            order =
                rows[0] || null;

            if (!order) {
                throw fail(
                    "Guest order was not found.",
                    404
                );
            }

            orderId =
                Number(order.id);

            customerId =
                null;

        } else {

            const [rows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        order_number,
                        customer_id,
                        order_status,
                        delivered_at
                    FROM orders
                    WHERE id = ?
                      AND customer_id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        orderId,
                        customerId
                    ]
                );

            order =
                rows[0] || null;

            if (!order) {
                throw fail(
                    "Order not found.",
                    404
                );
            }
        }

        if (
            String(
                order.order_status
            ).toLowerCase() !==
            "delivered"
        ) {
            throw fail(
                "Only delivered orders can be returned.",
                409
            );
        }

        assertReturnWindow(
            order.delivered_at
        );

        // ==========================================
        // Requested Quantities
        // ==========================================

        const quantities =
            new Map();

        for (
            const row of requestedItems
        ) {

            const orderItemId =
                positiveId(
                    row.order_item_id,
                    "order item ID"
                );

            const quantity =
                Number(
                    row.quantity
                );

            if (
                !Number.isInteger(quantity) ||
                quantity < 1
            ) {
                throw fail(
                    "Each return quantity must be a positive whole number."
                );
            }

            quantities.set(
                orderItemId,
                (
                    quantities.get(
                        orderItemId
                    ) || 0
                ) + quantity
            );
        }

        const ids =
            [...quantities.keys()];

        const marks =
            ids
                .map(() => "?")
                .join(",");

        const [orderItems] =
            await connection.query(
                `
                SELECT
                    oi.id,
                    oi.product_id,
                    oi.quantity,
                    oi.price,
                    p.product_name
                FROM order_items oi
                LEFT JOIN products p
                    ON p.id = oi.product_id
                WHERE oi.order_id = ?
                  AND oi.id IN (${marks})
                FOR UPDATE
                `,
                [
                    orderId,
                    ...ids
                ]
            );

        if (
            orderItems.length !==
            ids.length
        ) {
            throw fail(
                "One or more selected items do not belong to this order."
            );
        }

        const [usedRows] =
            await connection.query(
                `
                SELECT
                    cri.order_item_id,
                    COALESCE(
                        SUM(
                            cri.requested_quantity
                        ),
                        0
                    ) AS already_requested
                FROM customer_return_items cri
                JOIN customer_return_requests crr
                    ON crr.id =
                       cri.return_request_id
                WHERE crr.order_id = ?
                  AND crr.status IN (
                    ${ACTIVE_REQUEST_STATUSES
                        .map(() => "?")
                        .join(",")}
                  )
                GROUP BY
                    cri.order_item_id
                `,
                [
                    orderId,
                    ...ACTIVE_REQUEST_STATUSES
                ]
            );

        const used =
            new Map(
                usedRows.map(
                    row => [
                        Number(
                            row.order_item_id
                        ),
                        Number(
                            row.already_requested
                        )
                    ]
                )
            );

        let requestedAmount = 0;

        const items =
            orderItems.map(
                item => {

                    const requestedQuantity =
                        quantities.get(
                            Number(item.id)
                        );

                    const remaining =
                        Number(
                            item.quantity
                        ) -
                        (
                            used.get(
                                Number(item.id)
                            ) || 0
                        );

                    if (
                        requestedQuantity >
                        remaining
                    ) {
                        throw fail(
                            `${item.product_name || "Product"}: only ${remaining} unit(s) remain returnable.`,
                            409
                        );
                    }

                    const unitPrice =
                        money(
                            item.price
                        );

                    const amount =
                        money(
                            unitPrice *
                            requestedQuantity
                        );

                    requestedAmount =
                        money(
                            requestedAmount +
                            amount
                        );

                    return {
                        ...item,
                        requestedQuantity,
                        unitPrice,
                        amount
                    };
                }
            );

        // ==========================================
        // Return Request
        // ==========================================

        const [result] =
            await connection.query(
                `
                INSERT INTO customer_return_requests
                (
                    order_id,
                    customer_id,
                    reason,
                    customer_notes,
                    status,
                    requested_amount
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    'Requested',
                    ?
                )
                `,
                [
                    orderId,
                    customerId,
                    reason,
                    customerNotes,
                    requestedAmount
                ]
            );

        const returnId =
            result.insertId;

        const returnNumber =
            makeNumber(
                "RET",
                returnId
            );

        await connection.query(
            `
            UPDATE customer_return_requests
            SET return_number = ?
            WHERE id = ?
            `,
            [
                returnNumber,
                returnId
            ]
        );

        for (
            const item of items
        ) {

            await connection.query(
                `
                INSERT INTO customer_return_items
                (
                    return_request_id,
                    order_item_id,
                    product_id,
                    requested_quantity,
                    unit_price,
                    requested_amount,
                    gross_return_amount,
                    effective_refund_amount,
                    item_status
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'Requested'
                )
                `,
                [
                    returnId,
                    item.id,
                    item.product_id,
                    item.requestedQuantity,
                    item.unitPrice,
                    item.amount,
                    item.amount,
                    item.amount
                ]
            );
        }

        await addActivity(
            connection,
            {
                returnRequestId:
                    returnId,

                actorType:
                    guestMode
                        ? "Guest"
                        : "Customer",

                actorId:
                    customerId,

                action:
                    "Return request submitted",

                toStatus:
                    "Requested",

                notes:
                    reason
            }
        );

        await connection.commit();

        return {
            id:
                returnId,

            return_number:
                returnNumber,

            order_id:
                orderId,

            order_number:
                order.order_number,

            customer_id:
                customerId,

            checkout_type:
                guestMode
                    ? "guest"
                    : "customer",

            status:
                "Requested",

            requested_amount:
                requestedAmount,

            item_count:
                items.length
        };

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        throw error;

    } finally {

        connection.release();
    }
};


exports.createReturnRequest =
    async ({
        customerId,
        payload
    }) => {

        return createReturnRequestForOrder(
            {
                customerId,
                payload
            }
        );
    };


exports.createGuestReturnRequest =
    async ({
        orderNumber,
        guestToken,
        returnAccessToken,
        payload
    }) => {

        orderNumber =
            cleanText(
                orderNumber,
                50
            );

        guestToken =
            cleanText(
                guestToken,
                200
            );

        returnAccessToken =
            cleanText(
                returnAccessToken,
                4000
            );

        if (
            !orderNumber ||
            (
                !guestToken &&
                !returnAccessToken
            )
        ) {
            throw fail(
                "Order number and guest return authorization are required.",
                401
            );
        }

        return createReturnRequestForOrder(
            {
                customerId:
                    null,

                payload,

                guestOrderNumber:
                    orderNumber,

                guestToken,

                returnAccessToken
            }
        );
    };


exports.getCustomerReturns = async customerId => {
    customerId = positiveId(customerId, "customer ID");
    const [rows] = await db.query(
        `SELECT crr.id, crr.return_number, crr.order_id, o.order_number, crr.reason, crr.status,
                crr.requested_amount, crr.approved_amount, crr.refund_amount, crr.created_at, crr.updated_at,
                COUNT(cri.id) item_count, COALESCE(SUM(cri.requested_quantity),0) total_quantity
         FROM customer_return_requests crr JOIN orders o ON o.id = crr.order_id
         LEFT JOIN customer_return_items cri ON cri.return_request_id = crr.id
         WHERE crr.customer_id = ? GROUP BY crr.id ORDER BY crr.created_at DESC, crr.id DESC`, [customerId]
    );
    return rows;
};

exports.getReturnDetails = async ({ returnId, customerId = null, admin = false }) => {
    returnId = positiveId(returnId, "return ID");
    const params = [returnId];
    let owner = "";
    if (!admin) { customerId = positiveId(customerId, "customer ID"); owner = "AND crr.customer_id = ?"; params.push(customerId); }
    const [[request]] = await db.query(
        `SELECT crr.*, o.order_number, o.order_status, o.payment_status, o.payment_method, o.grand_total,
                o.delivered_at,
                COALESCE(c.full_name, o.full_name) customer_name,
                COALESCE(c.email, o.email) customer_email,
                COALESCE(c.phone, o.phone) customer_phone
         FROM customer_return_requests crr JOIN orders o ON o.id = crr.order_id
         LEFT JOIN customers c ON c.id = crr.customer_id WHERE crr.id = ? ${owner} LIMIT 1`, params
    );
    if (!request) throw fail("Return request not found.", 404);
    const [items] = await db.query(
        `SELECT cri.*, p.product_name, oi.quantity purchased_quantity, oi.subtotal purchased_subtotal
         FROM customer_return_items cri JOIN order_items oi ON oi.id = cri.order_item_id
         LEFT JOIN products p ON p.id = cri.product_id WHERE cri.return_request_id = ? ORDER BY cri.id`, [returnId]
    );
    const [activity] = await db.query(
        `SELECT id, actor_type, actor_id, action, from_status, to_status, notes, created_at
         FROM customer_return_activity_logs WHERE return_request_id = ? ORDER BY created_at, id`, [returnId]
    );
    const [movements] = await db.query(
        `SELECT rim.*, p.product_name FROM return_inventory_movements rim
         LEFT JOIN products p ON p.id = rim.product_id WHERE rim.return_request_id = ? ORDER BY rim.id`, [returnId]
    );

    const [media] = await db.query(
        `SELECT
            id,
            return_request_id,
            return_item_id,
            media_type,
            file_path,
            original_filename,
            mime_type,
            file_size,
            uploaded_by,
            created_at
         FROM customer_return_media
         WHERE return_request_id = ?
         ORDER BY id`,
        [returnId]
    );

    // ==========================================
    // Return Payment Settlement Summary
    // ==========================================
    //
    // A return value is not automatically a cash
    // refund. Only money that was actually recorded
    // as paid can be refunded.
    //
    // This is especially important for unpaid COD
    // orders, where approved merchandise may be
    // returned but no customer payment exists.

    const [[paymentTotals]] = await db.query(
        `SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN status IN (
                            'Paid',
                            'Partially Refunded',
                            'Refunded'
                        )
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS gross_paid_amount,

            COALESCE(
                SUM(refunded_amount),
                0
            ) AS refunded_amount

         FROM payment_transactions
         WHERE order_id = ?`,
        [request.order_id]
    );

    const grossPaidAmount =
        Math.max(
            0,
            money(
                paymentTotals?.gross_paid_amount || 0
            )
        );

    const alreadyRefundedAmount =
        Math.max(
            0,
            money(
                paymentTotals?.refunded_amount || 0
            )
        );

    const refundableAmount =
        Math.max(
            0,
            money(
                grossPaidAmount -
                alreadyRefundedAmount
            )
        );

    const approvedReturnAmount =
        Math.max(
            0,
            money(
                request.approved_amount || 0
            )
        );

    const maximumReturnRefund =
        Math.min(
            approvedReturnAmount,
            refundableAmount
        );

    const paymentMethod =
        String(
            request.payment_method || ""
        ).trim().toLowerCase();

    const paymentStatus =
        String(
            request.payment_status || ""
        ).trim().toLowerCase();

    const unpaidCod =
        paymentMethod === "cash_on_delivery" &&
        grossPaidAmount <= 0 &&
        ![
            "paid",
            "partially paid",
            "partially refunded",
            "refunded"
        ].includes(paymentStatus);

    const payment_settlement = {
        payment_method:
            request.payment_method || null,

        payment_status:
            request.payment_status || null,

        order_grand_total:
            money(
                request.grand_total || 0
            ),

        approved_return_amount:
            approvedReturnAmount,

        gross_paid_amount:
            grossPaidAmount,

        already_refunded_amount:
            alreadyRefundedAmount,

        net_paid_amount:
            Math.max(
                0,
                money(
                    grossPaidAmount -
                    alreadyRefundedAmount
                )
            ),

        refundable_amount:
            refundableAmount,

        maximum_return_refund:
            maximumReturnRefund,

        monetary_refund_available:
            maximumReturnRefund > 0,

        unpaid_cod:
            unpaidCod
    };

    return {
        return_request: request,
        items,
        activity,
        inventory_movements: movements,
        media,
        payment_settlement
    };
};


exports.saveReturnMedia = async ({
    returnId,
    customerId = null,
    guestToken = null,
    returnAccessToken = null,
    files = []
}) => {

    returnId =
        positiveId(
            returnId,
            "return ID"
        );

    const guestMode =
        Boolean(
            guestToken ||
            returnAccessToken
        );

    const mediaReturnAccess =
        (
            guestMode &&
            returnAccessToken
        )
            ? verifyGuestReturnAccessToken({
                token:
                    returnAccessToken
            })
            : null;

    if (!Array.isArray(files) || !files.length) {
        throw fail(
            "Select at least one return photo or video."
        );
    }

    const images =
        files.filter(
            file =>
                String(file.mimetype || "")
                    .startsWith("image/")
        );

    const videos =
        files.filter(
            file =>
                String(file.mimetype || "")
                    .startsWith("video/")
        );

    if (images.length > 5) {
        throw fail(
            "Upload no more than five return images."
        );
    }

    if (videos.length > 1) {
        throw fail(
            "Upload no more than one return video."
        );
    }

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        let request = null;

        if (guestMode) {

            let rows;

            if (mediaReturnAccess) {

                [rows] =
                    await connection.query(
                        `
                        SELECT
                            crr.id,
                            crr.order_id,
                            crr.customer_id,
                            crr.status
                        FROM customer_return_requests crr
                        JOIN orders o
                            ON o.id =
                               crr.order_id
                        WHERE crr.id = ?
                          AND crr.customer_id IS NULL
                          AND o.checkout_type = 'guest'
                          AND o.id = ?
                          AND o.order_number = ?
                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            returnId,
                            mediaReturnAccess.orderId,
                            mediaReturnAccess.orderNumber
                        ]
                    );

            } else {

                [rows] =
                    await connection.query(
                        `
                        SELECT
                            crr.id,
                            crr.order_id,
                            crr.customer_id,
                            crr.status
                        FROM customer_return_requests crr
                        JOIN orders o
                            ON o.id =
                               crr.order_id
                        WHERE crr.id = ?
                          AND crr.customer_id IS NULL
                          AND o.checkout_type = 'guest'
                          AND o.guest_access_token_hash = ?
                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            returnId,
                            sha256(
                                cleanText(
                                    guestToken,
                                    200
                                ) || ""
                            )
                        ]
                    );
            }

            request =
                rows[0] || null;

        } else {

            customerId =
                positiveId(
                    customerId,
                    "customer ID"
                );

            const [rows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        order_id,
                        customer_id,
                        status
                    FROM customer_return_requests
                    WHERE id = ?
                      AND customer_id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [
                        returnId,
                        customerId
                    ]
                );

            request =
                rows[0] || null;
        }

        if (!request) {
            throw fail(
                "Return request was not found.",
                404
            );
        }

        if (
            ![
                "Requested",
                "Under Review",
                "Approved",
                "Awaiting Return"
            ].includes(
                String(request.status)
            )
        ) {
            throw fail(
                "Evidence can no longer be added to this return request.",
                409
            );
        }

        const created = [];

        for (const file of files) {

            const mediaType =
                String(file.mimetype || "")
                    .startsWith("video/")
                    ? "Video"
                    : "Image";

            const filePath =
                `/uploads/returns/${file.filename}`;

            const [result] =
                await connection.query(
                    `
                    INSERT INTO customer_return_media
                    (
                        return_request_id,
                        return_item_id,
                        media_type,
                        file_path,
                        original_filename,
                        mime_type,
                        file_size,
                        uploaded_by
                    )
                    VALUES
                    (
                        ?,
                        NULL,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    `,
                    [
                        returnId,
                        mediaType,
                        filePath,
                        cleanText(
                            file.originalname,
                            255
                        ),
                        cleanText(
                            file.mimetype,
                            100
                        ),
                        Number(
                            file.size || 0
                        ),
                        guestMode
                            ? "Guest"
                            : "Customer"
                    ]
                );

            created.push({
                id:
                    result.insertId,

                return_request_id:
                    returnId,

                media_type:
                    mediaType,

                file_path:
                    filePath,

                original_filename:
                    file.originalname || null,

                mime_type:
                    file.mimetype || null,

                file_size:
                    Number(file.size || 0),

                uploaded_by:
                    guestMode
                        ? "Guest"
                        : "Customer"
            });
        }

        await addActivity(
            connection,
            {
                returnRequestId:
                    returnId,

                actorType:
                    guestMode
                        ? "Guest"
                        : "Customer",

                actorId:
                    customerId,

                action:
                    "Return evidence uploaded",

                notes:
                    `${created.length} evidence file(s) uploaded`
            }
        );

        await connection.commit();

        return created;

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        throw error;

    } finally {

        connection.release();
    }
};


exports.cancelCustomerReturn = async ({ returnId, customerId, notes }) => {
    returnId = positiveId(returnId, "return ID"); customerId = positiveId(customerId, "customer ID");
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[row]] = await connection.query(
            `SELECT id, status FROM customer_return_requests WHERE id = ? AND customer_id = ? LIMIT 1 FOR UPDATE`, [returnId, customerId]
        );
        if (!row) throw fail("Return request not found.", 404);
        if (row.status !== "Requested") throw fail("Only an unreviewed return request can be cancelled.", 409);
        await connection.query(`UPDATE customer_return_requests SET status='Cancelled', cancelled_at=CURRENT_TIMESTAMP WHERE id=?`, [returnId]);
        await addActivity(connection, { returnRequestId: returnId, actorType: "Customer", actorId: customerId,
            action: "Return request cancelled", fromStatus: "Requested", toStatus: "Cancelled", notes });
        await connection.commit(); return { id: returnId, status: "Cancelled" };
    } catch (error) { await rollbackQuietly(connection); throw error; } finally { connection.release(); }
};

exports.getAdminReturnSummary = async () => {
    const [[row]] = await db.query(
        `SELECT COUNT(*) total_returns,
            SUM(status='Requested') requested_returns, SUM(status='Under Review') under_review_returns,
            SUM(status='Approved') approved_returns, SUM(status='Rejected') rejected_returns,
            SUM(status='Cancelled') cancelled_returns, SUM(status='Received') received_returns,
            SUM(status='Inspected') inspected_returns, SUM(status='Completed') completed_returns,
            SUM(status='Refunded') refunded_returns, COALESCE(SUM(requested_amount),0) requested_value,
            COALESCE(SUM(approved_amount),0) approved_value, COALESCE(SUM(refund_amount),0) refunded_value
         FROM customer_return_requests`
    );
    return Object.fromEntries(Object.entries(row || {}).map(([k,v]) => [k, Number(v || 0)]));
};

exports.getAdminReturns = async filters => {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
    const where = [], params = [];
    if (filters.status) { where.push("crr.status = ?"); params.push(cleanText(filters.status, 40)); }
    if (filters.search) {
        where.push("(crr.return_number LIKE ? OR o.order_number LIKE ? OR COALESCE(c.full_name,o.full_name) LIKE ? OR COALESCE(c.email,o.email) LIKE ? OR COALESCE(c.phone,o.phone) LIKE ?)");
        const p = `%${cleanText(filters.search, 150)}%`; params.push(p,p,p,p,p);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [[count]] = await db.query(
        `SELECT COUNT(*) total FROM customer_return_requests crr JOIN orders o ON o.id=crr.order_id
         LEFT JOIN customers c ON c.id=crr.customer_id ${sqlWhere}`, params
    );
    const [rows] = await db.query(
        `SELECT crr.id, crr.return_number, crr.order_id, o.order_number, crr.customer_id,
                COALESCE(c.full_name,o.full_name) customer_name,
                COALESCE(c.email,o.email) customer_email,
                COALESCE(c.phone,o.phone) customer_phone,
                crr.reason, crr.status, crr.requested_amount, crr.approved_amount, crr.refund_amount,
                crr.created_at, crr.updated_at, COUNT(cri.id) item_count,
                COALESCE(SUM(cri.requested_quantity),0) total_quantity
         FROM customer_return_requests crr JOIN orders o ON o.id=crr.order_id
         LEFT JOIN customers c ON c.id=crr.customer_id LEFT JOIN customer_return_items cri ON cri.return_request_id=crr.id
         ${sqlWhere} GROUP BY crr.id ORDER BY crr.created_at DESC, crr.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, (page-1)*limit]
    );
    const total = Number(count.total || 0);
    return { returns: rows, pagination: { page, limit, total, total_pages: Math.ceil(total/limit) } };
};

exports.reviewReturnRequest = async ({ returnId, adminId, decision, adminNotes }) => {
    returnId = positiveId(returnId, "return ID"); adminId = positiveId(adminId, "admin ID");
    const action = String(decision || "").trim().toLowerCase();
    if (!["review","approve","reject"].includes(action)) throw fail("Decision must be review, approve, or reject.");
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[row]] = await connection.query(
            `SELECT id,status,requested_amount FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`, [returnId]
        );
        if (!row) throw fail("Return request not found.",404);
        if (!["Requested","Under Review"].includes(row.status)) throw fail("This return request has already been decided.",409);
        const map={review:"Under Review",approve:"Approved",reject:"Rejected"}; const next=map[action];
        let extra="";
        if(next==="Approved") extra=", approved_at=CURRENT_TIMESTAMP, approved_amount=requested_amount";
        if(next==="Rejected") extra=", rejected_at=CURRENT_TIMESTAMP, approved_amount=0";
        await connection.query(
            `UPDATE customer_return_requests SET status=?,admin_notes=?,reviewed_by_admin_id=?,reviewed_at=CURRENT_TIMESTAMP ${extra} WHERE id=?`,
            [next, cleanText(adminNotes), adminId, returnId]
        );
        if(next==="Approved") await connection.query(
            `UPDATE customer_return_items SET item_status='Approved',approved_quantity=requested_quantity,approved_amount=requested_amount WHERE return_request_id=?`,[returnId]
        );
        if(next==="Rejected") await connection.query(
            `UPDATE customer_return_items SET item_status='Rejected',approved_quantity=0,approved_amount=0 WHERE return_request_id=?`,[returnId]
        );
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,
            action:`Return request ${action === "review" ? "moved under review" : action + "d"}`,
            fromStatus:row.status,toStatus:next,notes:adminNotes});
        await connection.commit(); return {id:returnId,status:next};
    } catch(error){await rollbackQuietly(connection);throw error;} finally{connection.release();}
};

exports.receiveReturn = async ({ returnId, adminId, notes }) => {
    returnId=positiveId(returnId,"return ID"); adminId=positiveId(adminId,"admin ID");
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        const [[row]]=await connection.query(`SELECT id,status,order_id FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`,[returnId]);
        if(!row) throw fail("Return request not found.",404);
        if(row.status!=="Approved") throw fail("Only an approved return can be marked received.",409);
        await connection.query(`UPDATE customer_return_requests SET status='Received',received_at=CURRENT_TIMESTAMP WHERE id=?`,[returnId]);
        await connection.query(`UPDATE customer_return_items SET item_status='Received',received_quantity=approved_quantity WHERE return_request_id=?`,[returnId]);
        await connection.query(`UPDATE orders SET order_status='Returned',returned_at=COALESCE(returned_at,CURRENT_TIMESTAMP) WHERE id=?`,[row.order_id]);
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,action:"Returned goods received",fromStatus:"Approved",toStatus:"Received",notes});
        await connection.commit(); return {id:returnId,status:"Received"};
    }catch(error){await rollbackQuietly(connection);throw error;}finally{connection.release();}
};

exports.inspectReturn = async ({ returnId, adminId, payload }) => {
    returnId=positiveId(returnId,"return ID"); adminId=positiveId(adminId,"admin ID");
    const itemInput=Array.isArray(payload.items)?payload.items:[];
    if(!itemInput.length) throw fail("Inspection items are required.");
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        const [[row]]=await connection.query(`SELECT id,status,order_id FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`,[returnId]);
        if(!row) throw fail("Return request not found.",404);
        if(row.status!=="Received") throw fail("Only a received return can be inspected.",409);
        const requestOrderId = Number(row.order_id);
        const [items]=await connection.query(`SELECT * FROM customer_return_items WHERE return_request_id=? FOR UPDATE`,[returnId]);
        const byId=new Map(items.map(i=>[Number(i.id),i]));
        let approvedTotal=0;
        for(const input of itemInput){
            const id=positiveId(input.return_item_id,"return item ID"); const item=byId.get(id);
            if(!item) throw fail("One or more inspection items are invalid.");
            const accepted=Number(input.accepted_quantity); const received=Number(item.received_quantity || item.approved_quantity || 0);
            if(!Number.isInteger(accepted)||accepted<0||accepted>received) throw fail("Accepted quantity must be between zero and received quantity.");
            const condition=cleanText(input.condition_status,40)||"Good";
            if(!["Good","Opened","Damaged","Expired","Not Resellable"].includes(condition)) throw fail("Invalid condition status.");

            const grossAcceptedAmount = money(Number(item.unit_price) * accepted);
            const financials = await calculateReturnFinancials(
                connection,
                {
                    orderId: requestOrderId,
                    grossAmount: grossAcceptedAmount
                }
            );

            approvedTotal = money(
                approvedTotal +
                financials.effective_refund_amount
            );

            await connection.query(
                `UPDATE customer_return_items
                 SET
                    item_status='Inspected',
                    accepted_quantity=?,
                    restock_quantity=0,
                    gross_return_amount=?,
                    coupon_discount_share=?,
                    loyalty_discount_share=?,
                    reward_discount_share=?,
                    effective_refund_amount=?,
                    approved_amount=?,
                    condition_status=?,
                    inspection_notes=?
                 WHERE id=?`,
                [
                    accepted,
                    financials.gross_return_amount,
                    financials.coupon_discount_share,
                    financials.loyalty_discount_share,
                    financials.reward_discount_share,
                    financials.effective_refund_amount,
                    financials.effective_refund_amount,
                    condition,
                    cleanText(input.inspection_notes),
                    id
                ]
            );
        }
        await connection.query(`UPDATE customer_return_requests SET status='Inspected',approved_amount=?,inspection_notes=?,inspected_at=CURRENT_TIMESTAMP WHERE id=?`,
            [approvedTotal,cleanText(payload.inspection_notes),returnId]);
        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,action:"Returned goods inspected",fromStatus:"Received",toStatus:"Inspected",notes:payload.inspection_notes});
        await connection.commit(); return {id:returnId,status:"Inspected",approved_amount:approvedTotal};
    }catch(error){await rollbackQuietly(connection);throw error;}finally{connection.release();}
};

exports.completeReturn = async ({ returnId, adminId, payload }) => {
    returnId=positiveId(returnId,"return ID"); adminId=positiveId(adminId,"admin ID");
    const refundRequested = payload.issue_refund !== false;
    const restock = payload.restock !== false;
    const connection=await db.getConnection();
    try{
        await connection.beginTransaction();
        const [[request]]=await connection.query(
            `SELECT * FROM customer_return_requests WHERE id=? LIMIT 1 FOR UPDATE`,[returnId]
        );
        if(!request) throw fail("Return request not found.",404);
        if(request.status!=="Inspected") throw fail("Only an inspected return can be completed.",409);
        const [items]=await connection.query(`SELECT * FROM customer_return_items WHERE return_request_id=? FOR UPDATE`,[returnId]);

        if(restock){
            for(const item of items){
                const accepted=Number(item.accepted_quantity||0);
                const eligible=item.condition_status === "Good" ? accepted : 0;
                if(eligible<1) continue;
                const [[product]]=await connection.query(`SELECT id,stock_quantity,low_stock_level FROM products WHERE id=? LIMIT 1 FOR UPDATE`,[item.product_id]);
                if(!product) continue;
                const before =
                    Number(product.stock_quantity || 0);

                const after =
                    before + eligible;

                const status =
                    inventoryService.getStockStatus(
                        after,
                        Number(product.low_stock_level || 0)
                    );

                await connection.query(
                    `UPDATE products
                     SET stock_quantity=?,
                         stock_status=?
                     WHERE id=?`,
                    [
                        after,
                        status,
                        item.product_id
                    ]
                );

                // ==========================================
                // Return-specific inventory audit
                // ==========================================

                await connection.query(
                    `INSERT INTO return_inventory_movements
                    (
                        return_request_id,
                        return_item_id,
                        product_id,
                        quantity,
                        stock_before,
                        stock_after,
                        movement_type,
                        created_by
                    )
                    VALUES(?,?,?,?,?,?,'Return Restock',?)`,
                    [
                        returnId,
                        item.id,
                        item.product_id,
                        eligible,
                        before,
                        after,
                        adminId
                    ]
                );

                // ==========================================
                // Central Inventory Ledger
                // ==========================================

                await inventoryService.recordMovement(
                    connection,
                    {
                        productId:
                            item.product_id,

                        transactionType:
                            "Stock In",

                        quantity:
                            eligible,

                        previousStock:
                            before,

                        newStock:
                            after,

                        reference:
                            request.return_number ||
                            `RETURN-${returnId}`,

                        remarks:
                            `Customer Return Restock - Return #${request.return_number || returnId}`,

                        createdBy:
                            adminId
                    }
                );

                await connection.query(
                    `UPDATE customer_return_items
                     SET restock_quantity=?
                     WHERE id=?`,
                    [
                        eligible,
                        item.id
                    ]
                );
            }
        }

        const refundableTarget=money(payload.refund_amount ?? request.approved_amount);
        if(refundableTarget<0||refundableTarget>money(request.approved_amount)) throw fail("Refund amount cannot exceed the inspected approved amount.");
        let remaining=refundRequested?refundableTarget:0;
        let refunded=0;
        let paymentSummary=null;
        if(remaining>0){
            const [payments]=await connection.query(
                `SELECT * FROM payment_transactions WHERE order_id=? AND status IN ('Paid','Partially Refunded') ORDER BY paid_at DESC,id DESC FOR UPDATE`,[request.order_id]
            );
            for(const payment of payments){
                if(remaining<=0) break;
                const available=money(Number(payment.amount)-Number(payment.refunded_amount||0));
                if(available<=0) continue;
                const amount=Math.min(available,remaining);
                const [r]=await connection.query(
                    `INSERT INTO payment_refunds(payment_transaction_id,order_id,amount,reason,status,refunded_by,completed_at)
                     VALUES(?,?,?,'Customer return','Completed',?,CURRENT_TIMESTAMP)`,[payment.id,request.order_id,amount,adminId]
                );
                await connection.query(`UPDATE payment_refunds SET refund_number=? WHERE id=?`,[makeNumber("REF",r.insertId),r.insertId]);
                const newRefunded=money(Number(payment.refunded_amount||0)+amount);
                await connection.query(`UPDATE payment_transactions SET refunded_amount=?,status=? WHERE id=?`,
                    [newRefunded,newRefunded>=money(payment.amount)?"Refunded":"Partially Refunded",payment.id]);
                remaining=money(remaining-amount); refunded=money(refunded+amount);
            }
            if(remaining>0) throw fail(`Only PKR ${refunded.toFixed(2)} is currently refundable from recorded paid transactions.`,409);
            paymentSummary =
                await updateOrderPaymentSummary(
                    connection,
                    request.order_id
                );
        }

        const orderFullyRefunded =
            String(
                paymentSummary?.payment_status ||
                ""
            ).toLowerCase() === "refunded";

        let salesSync=null;

        if(refunded>0){
            salesSync =
                await orderSalesIntegrationService
                    .syncOrderPaymentToSale(
                        connection,
                        request.order_id
                    );
        }

        const finalStatus=refunded>0?"Refunded":"Completed";
        await connection.query(
            `UPDATE customer_return_requests SET status=?,refund_amount=?,completed_at=CURRENT_TIMESTAMP,refunded_at=CASE WHEN ?>0 THEN CURRENT_TIMESTAMP ELSE refunded_at END WHERE id=?`,
            [finalStatus,refunded,refunded,returnId]
        );
        await connection.query(`UPDATE customer_return_items SET item_status=? WHERE return_request_id=?`,[finalStatus,returnId]);
        if(orderFullyRefunded) {
            await connection.query(
                `UPDATE orders
                 SET order_status='Refunded',
                     refunded_at=COALESCE(
                         refunded_at,
                         CURRENT_TIMESTAMP
                     )
                 WHERE id=?`,
                [request.order_id]
            );
        }
        let rewardRestoration=null;

        /*
         * Restore reward points that were redeemed against
         * the returned merchandise.
         *
         * This happens inside the same DB transaction as the
         * monetary refund, so the points credit and refund
         * succeed or roll back together.
         */
        if(refunded>0){
            const [[rewardOrder]] = await connection.query(
                `SELECT
                    customer_id,
                    order_number,
                    reward_points_redeemed,
                    reward_points_discount_amount
                 FROM orders
                 WHERE id=?
                 LIMIT 1
                 FOR UPDATE`,
                [request.order_id]
            );

            const [[rewardShareRow]] = await connection.query(
                `SELECT
                    COALESCE(SUM(reward_discount_share),0)
                        AS reward_discount_share
                 FROM customer_return_items
                 WHERE return_request_id=?`,
                [returnId]
            );

            const totalRedeemed =
                Math.max(
                    0,
                    Number(
                        rewardOrder?.reward_points_redeemed || 0
                    )
                );

            const totalRewardDiscount =
                Math.max(
                    0,
                    money(
                        rewardOrder?.reward_points_discount_amount || 0
                    )
                );

            const inspectedRewardShare =
                Math.max(
                    0,
                    money(
                        rewardShareRow?.reward_discount_share || 0
                    )
                );

            /*
             * If admin issues less than the full approved refund,
             * restore only the proportional reward-point share.
             */
            const refundScale =
                money(request.approved_amount) > 0
                    ? Math.min(
                        1,
                        Math.max(
                            0,
                            refunded /
                            money(request.approved_amount)
                        )
                    )
                    : 0;

            const refundableRewardShare =
                money(
                    inspectedRewardShare *
                    refundScale
                );

            let pointsToRestore =
                totalRedeemed > 0 &&
                totalRewardDiscount > 0 &&
                refundableRewardShare > 0
                    ? Math.round(
                        totalRedeemed *
                        Math.min(
                            1,
                            refundableRewardShare /
                            totalRewardDiscount
                        )
                    )
                    : 0;

            /*
             * Cap the total restored points across all returns
             * for this order so the customer can never receive
             * more than originally redeemed.
             */
            if(pointsToRestore>0){
                const [[alreadyRestoredRow]] =
                    await connection.query(
                        `SELECT
                            COALESCE(
                                SUM(points_change),
                                0
                            ) AS restored_points
                         FROM customer_loyalty_transactions
                         WHERE customer_id=?
                           AND source_type='Reward Restoration'
                           AND source_id=?
                           AND points_change>0`,
                        [
                            rewardOrder.customer_id,
                            request.order_id
                        ]
                    );

                const alreadyRestored =
                    Math.max(
                        0,
                        Number(
                            alreadyRestoredRow?.restored_points || 0
                        )
                    );

                pointsToRestore =
                    Math.min(
                        pointsToRestore,
                        Math.max(
                            0,
                            totalRedeemed -
                            alreadyRestored
                        )
                    );
            }

            if(pointsToRestore>0){
                rewardRestoration =
                    await loyaltyTransactionService
                        .restoreRedeemedRewardPoints({
                            customerId:
                                rewardOrder.customer_id,

                            points:
                                pointsToRestore,

                            orderId:
                                request.order_id,

                            returnId,

                            orderNumber:
                                rewardOrder.order_number,

                            description:
                                `Reward points restored for customer return ${request.return_number}`,

                            metadata: {
                                refundAmount:
                                    refunded,

                                approvedAmount:
                                    money(
                                        request.approved_amount
                                    ),

                                rewardDiscountShare:
                                    refundableRewardShare
                            },

                            createdByAdminId:
                                adminId,

                            existingConnection:
                                connection
                        });
            }
        }

        /*
         * Reverse purchase-earned loyalty points inside the
         * SAME transaction as the refund.
         */
        let transactionalLoyaltyReversal=null;

        if(
            orderFullyRefunded &&
            salesSync?.linked &&
            salesSync?.saleId
        ){
            const [[saleForReversal]] =
                await connection.query(
                    `SELECT
                        id,
                        sale_number,
                        customer_id,
                        grand_total
                     FROM sales
                     WHERE id=?
                     LIMIT 1
                     FOR UPDATE`,
                    [salesSync.saleId]
                );

            if(saleForReversal){
                const [[earnedTransaction]] =
                    await connection.query(
                        `SELECT
                            id,
                            points_change,
                            lifetime_points_change
                         FROM customer_loyalty_transactions
                         WHERE
                            customer_id=?
                            AND source_id=?
                            AND points_change>0
                            AND source_type IN (
                                'Sale',
                                'Customer Sale',
                                'Purchase'
                            )
                         ORDER BY id ASC
                         LIMIT 1`,
                        [
                            saleForReversal.customer_id,
                            saleForReversal.id
                        ]
                    );

                if(earnedTransaction){
                    const awardedPoints =
                        Math.abs(
                            Number(
                                earnedTransaction.points_change || 0
                            )
                        );

                    const awardedLifetimePoints =
                        Math.abs(
                            Number(
                                earnedTransaction
                                    .lifetime_points_change || 0
                            )
                        );

                    if(
                        awardedPoints > 0 ||
                        awardedLifetimePoints > 0
                    ){
                        transactionalLoyaltyReversal =
                            await loyaltyTransactionService
                                .reverseRefundPoints({
                                    customerId:
                                        saleForReversal.customer_id,

                                    points:
                                        awardedPoints,

                                    lifetimePoints:
                                        awardedLifetimePoints,

                                    saleId:
                                        saleForReversal.id,

                                    saleNumber:
                                        saleForReversal.sale_number,

                                    description:
                                        `Website order ${request.order_id} fully refunded through customer return`,

                                    metadata: {
                                        originalTransactionId:
                                            earnedTransaction.id,

                                        saleTotal:
                                            Number(
                                                saleForReversal.grand_total || 0
                                            ),

                                        returnId:
                                            Number(returnId),

                                        orderId:
                                            Number(request.order_id),

                                        source:
                                            "customer_return_atomic_reversal"
                                    },

                                    existingConnection:
                                        connection
                                });
                    }
                }else{
                    transactionalLoyaltyReversal={
                        success:true,
                        pointsReversed:0,
                        message:
                            "No purchase loyalty points had been awarded for this sale."
                    };
                }
            }
        }

        await addActivity(connection,{returnRequestId:returnId,actorType:"Admin",actorId:adminId,action:refunded>0?"Return completed and refund issued":"Return completed",fromStatus:"Inspected",toStatus:finalStatus,notes:payload.notes});

        await connection.commit();

        let loyaltyReversal=
            transactionalLoyaltyReversal;

        let loyaltyWarning=null;

        return {
            id:returnId,
            status:finalStatus,
            refund_amount:refunded,
            restocked:restock,
            paymentSummary,
            orderFullyRefunded,
            salesSync,
            rewardRestoration,
            loyaltyReversal,
            loyaltyWarning
        };
    }catch(error){await rollbackQuietly(connection);throw error;}finally{connection.release();}
};

exports.RETURN_WINDOW_DAYS = RETURN_WINDOW_DAYS;
