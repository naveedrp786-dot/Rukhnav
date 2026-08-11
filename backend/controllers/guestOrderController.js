"use strict";

const crypto = require("crypto");
const db = require("../config/db");

const inventoryService =
    require("../services/inventoryService");

const ALLOWED_PAYMENT_METHODS = new Set([
    "cash_on_delivery",
    "bank_transfer",
    "easypaisa",
    "jazzcash"
]);

function cleanText(value, maximum = 500) {
    return String(value || "")
        .trim()
        .slice(0, maximum);
}

function normalizeEmail(value) {
    const email =
        cleanText(value, 150)
            .toLowerCase();

    return email || null;
}

function normalizePhone(value) {
    let phone =
        cleanText(value, 30)
            .replace(/[^\d+]/g, "");

    if (!phone) {
        return null;
    }

    if (phone.startsWith("00")) {
        phone =
            `+${phone.slice(2)}`;
    }

    if (/^03\d{9}$/.test(phone)) {
        phone =
            `+92${phone.slice(1)}`;
    } else if (/^3\d{9}$/.test(phone)) {
        phone =
            `+92${phone}`;
    } else if (/^92\d{10}$/.test(phone)) {
        phone =
            `+${phone}`;
    }

    return phone;
}

function isValidPhone(phone) {
    return /^\+[1-9]\d{9,14}$/
        .test(phone || "");
}

function isValidEmail(email) {
    return !email ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email);
}

function accepted(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    );
}

function makeOrderNumber(orderId) {
    const date =
        new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

    return `ORD-${date}-${String(orderId).padStart(6, "0")}`;
}

function calculateDeliveryCharges(subtotal) {
    /*
     * Keep this aligned with the authenticated checkout.
     * Orders of Rs. 2,500 or more receive free delivery.
     */
    return subtotal >= 2500
        ? 0
        : 250;
}

function sha256(value) {
    return crypto
        .createHash("sha256")
        .update(value)
        .digest("hex");
}

function createGuestToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function getRequestIp(req) {
    return String(
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        req.ip ||
        ""
    )
        .split(",")[0]
        .trim()
        .slice(0, 64) ||
        null;
}

function safeAttribution(body) {
    const attribution =
        body.attribution &&
        typeof body.attribution === "object"
            ? body.attribution
            : {};

    return {
        orderSource:
            cleanText(
                attribution.order_source ||
                body.order_source ||
                "direct",
                50
            ) || "direct",

        landingPage:
            cleanText(
                attribution.landing_page ||
                body.landing_page,
                500
            ) || null,

        referrerUrl:
            cleanText(
                attribution.referrer_url ||
                body.referrer_url,
                500
            ) || null,

        utmSource:
            cleanText(
                attribution.utm_source ||
                body.utm_source,
                100
            ) || null,

        utmMedium:
            cleanText(
                attribution.utm_medium ||
                body.utm_medium,
                100
            ) || null,

        utmCampaign:
            cleanText(
                attribution.utm_campaign ||
                body.utm_campaign,
                150
            ) || null,

        utmContent:
            cleanText(
                attribution.utm_content ||
                body.utm_content,
                150
            ) || null,

        utmTerm:
            cleanText(
                attribution.utm_term ||
                body.utm_term,
                150
            ) || null,

        fbclid:
            cleanText(
                attribution.fbclid ||
                body.fbclid,
                255
            ) || null
    };
}

/**
 * POST /api/orders/guest
 *
 * Public guest checkout. Product prices and stock are
 * always loaded and calculated by the server.
 */
exports.placeGuestOrder = async (
    req,
    res
) => {
    let connection;
    let transactionStarted = false;

    try {
        const fullName =
            cleanText(
                req.body.full_name,
                150
            );

        const phone =
            normalizePhone(
                req.body.phone
            );

        const email =
            normalizeEmail(
                req.body.email
            );

        const shippingAddress =
            cleanText(
                req.body.shipping_address ||
                req.body.delivery_address,
                2000
            );

        const city =
            cleanText(
                req.body.city,
                100
            );

        const postalCode =
            cleanText(
                req.body.postal_code,
                30
            ) || null;

        const orderNotes =
            cleanText(
                req.body.order_notes,
                2000
            ) || null;

        const paymentMethod =
            cleanText(
                req.body.payment_method ||
                "cash_on_delivery",
                50
            )
                .toLowerCase();

        const transactionId =
            cleanText(
                req.body.transaction_id,
                150
            ) || null;

        const paymentPhone =
            normalizePhone(
                req.body.payment_phone
            );

        const items =
            Array.isArray(
                req.body.items
            )
                ? req.body.items
                : [];

        const termsAccepted =
            accepted(
                req.body.accept_terms
            );

        const privacyAccepted =
            accepted(
                req.body.accept_privacy
            );

        if (!fullName) {
            return res.status(400).json({
                success: false,
                message:
                    "Full name is required."
            });
        }

        if (!phone || !isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid mobile number is required."
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid email address."
            });
        }

        if (!shippingAddress) {
            return res.status(400).json({
                success: false,
                message:
                    "Delivery address is required."
            });
        }

        if (!city) {
            return res.status(400).json({
                success: false,
                message:
                    "City is required."
            });
        }

        if (
            !ALLOWED_PAYMENT_METHODS
                .has(paymentMethod)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Selected payment method is not available."
            });
        }

        if (
            !termsAccepted ||
            !privacyAccepted
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "You must accept the Terms & Conditions and Privacy Policy before placing a guest order."
            });
        }

        if (
            items.length < 1 ||
            items.length > 50
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "At least one valid product is required."
            });
        }

        const requestedItems = [];

        for (const item of items) {
            const productId =
                Number.parseInt(
                    item.product_id,
                    10
                );

            const quantity =
                Number.parseInt(
                    item.quantity,
                    10
                );

            if (
                !Number.isInteger(productId) ||
                productId <= 0 ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                quantity > 50
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Every order item requires a valid product and quantity."
                });
            }

            requestedItems.push({
                productId,
                quantity
            });
        }

        /*
         * Merge duplicate product lines to prevent stock
         * checks being bypassed with repeated IDs.
         */
        const mergedMap =
            new Map();

        for (const item of requestedItems) {
            mergedMap.set(
                item.productId,
                (
                    mergedMap.get(
                        item.productId
                    ) || 0
                ) +
                item.quantity
            );
        }

        const mergedItems =
            [...mergedMap.entries()]
                .map(
                    ([
                        productId,
                        quantity
                    ]) => ({
                        productId,
                        quantity
                    })
                );

        const productIds =
            mergedItems.map(
                item =>
                    item.productId
            );

        connection =
            await db.getConnection();

        await connection
            .beginTransaction();

        transactionStarted = true;

        const placeholders =
            productIds
                .map(() => "?")
                .join(",");

        const [products] =
            await connection.query(
                `
                SELECT
                    id,
                    product_name,
                    selling_price,
                    stock_quantity,
                    low_stock_level,
                    cost_price,
                    image,
                    status
                FROM products
                WHERE id IN (${placeholders})
                FOR UPDATE
                `,
                productIds
            );

        if (
            products.length !==
            productIds.length
        ) {
            throw Object.assign(
                new Error(
                    "One or more selected products were not found."
                ),
                {
                    statusCode: 404
                }
            );
        }

        const productMap =
            new Map(
                products.map(
                    product => [
                        Number(product.id),
                        product
                    ]
                )
            );

        const orderItems = [];
        let subtotal = 0;

        for (const requested of mergedItems) {
            const product =
                productMap.get(
                    requested.productId
                );

            const status =
                String(
                    product.status || ""
                )
                    .toLowerCase();

            if (
                status &&
                ![
                    "active",
                    "available"
                ].includes(status)
            ) {
                throw Object.assign(
                    new Error(
                        `${product.product_name} is not available for purchase.`
                    ),
                    {
                        statusCode: 409
                    }
                );
            }

            const stock =
                Number(
                    product.stock_quantity ||
                    0
                );

            if (
                stock <
                requested.quantity
            ) {
                throw Object.assign(
                    new Error(
                        `${product.product_name} has only ${stock} item(s) available.`
                    ),
                    {
                        statusCode: 409
                    }
                );
            }

            const price =
                Number(
                    product.selling_price
                );

            if (
                !Number.isFinite(price) ||
                price < 0
            ) {
                throw new Error(
                    `Invalid selling price for ${product.product_name}.`
                );
            }

            const lineSubtotal =
                Number(
                    (
                        price *
                        requested.quantity
                    ).toFixed(2)
                );

            subtotal +=
                lineSubtotal;

            orderItems.push({
                productId:
                    Number(product.id),

                productName:
                    product.product_name,

                image:
                    product.image,

                price,

                quantity:
                    requested.quantity,

                subtotal:
                    lineSubtotal
            });
        }

        subtotal =
            Number(
                subtotal.toFixed(2)
            );

        const deliveryCharges =
            calculateDeliveryCharges(
                subtotal
            );

        const grandTotal =
            Number(
                (
                    subtotal +
                    deliveryCharges
                ).toFixed(2)
            );

        const guestToken =
            createGuestToken();

        const attribution =
            safeAttribution(
                req.body
            );

        const paymentStatus =
            "Pending";

        const [orderResult] =
            await connection.query(
                `
                INSERT INTO orders
                (
                    customer_id,
                    checkout_type,
                    order_source,
                    landing_page,
                    referrer_url,
                    utm_source,
                    utm_medium,
                    utm_campaign,
                    utm_content,
                    utm_term,
                    fbclid,
                    guest_access_token_hash,
                    guest_terms_accepted,
                    guest_terms_accepted_at,
                    guest_privacy_accepted,
                    guest_privacy_accepted_at,
                    guest_consent_ip,
                    guest_consent_user_agent,
                    full_name,
                    phone,
                    email,
                    grand_total,
                    order_status,
                    payment_method,
                    payment_status,
                    transaction_id,
                    payment_phone,
                    shipping_address,
                    city,
                    postal_code,
                    order_notes,
                    coupon_code,
                    discount_amount,
                    delivery_charges,
                    address_id
                )
                VALUES
                (
                    NULL,
                    'guest',
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?,
                    1,
                    CURRENT_TIMESTAMP,
                    1,
                    CURRENT_TIMESTAMP,
                    ?, ?,
                    ?, ?, ?, ?,
                    'Pending',
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    NULL,
                    0,
                    ?,
                    NULL
                )
                `,
                [
                    attribution.orderSource,
                    attribution.landingPage,
                    attribution.referrerUrl,
                    attribution.utmSource,
                    attribution.utmMedium,
                    attribution.utmCampaign,
                    attribution.utmContent,
                    attribution.utmTerm,
                    attribution.fbclid,
                    sha256(guestToken),
                    getRequestIp(req),
                    cleanText(
                        req.headers["user-agent"],
                        500
                    ) || null,
                    fullName,
                    phone,
                    email,
                    grandTotal,
                    paymentMethod,
                    paymentStatus,
                    transactionId,
                    paymentPhone,
                    shippingAddress,
                    city,
                    postalCode,
                    orderNotes,
                    deliveryCharges
                ]
            );

        const orderId =
            orderResult.insertId;

        const orderNumber =
            makeOrderNumber(orderId);

        await connection.query(
            `
            UPDATE orders
            SET order_number = ?
            WHERE id = ?
            `,
            [
                orderNumber,
                orderId
            ]
        );

        for (const item of orderItems) {
            await connection.query(
                `
                INSERT INTO order_items
                (
                    order_id,
                    product_id,
                    price,
                    quantity,
                    subtotal
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    orderId,
                    item.productId,
                    item.price,
                    item.quantity,
                    item.subtotal
                ]
            );

            const product =
                productMap.get(
                    Number(item.productId)
                );

            if (!product) {
                throw new Error(
                    `Product ${item.productId} was not found while reserving guest order stock.`
                );
            }

            const previousStock =
                Number(
                    product.stock_quantity || 0
                );

            const quantity =
                Number(item.quantity);

            if (
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                previousStock < quantity
            ) {
                throw new Error(
                    `Unable to reserve stock for ${item.productName}.`
                );
            }

            const newStock =
                previousStock - quantity;

            const stockStatus =
                inventoryService.getStockStatus(
                    newStock,
                    product.low_stock_level
                );

            const [stockResult] =
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
                        item.productId
                    ]
                );

            if (
                stockResult.affectedRows !==
                1
            ) {
                throw new Error(
                    `Unable to reserve stock for ${item.productName}.`
                );
            }

            await inventoryService.recordMovement(
                connection,
                {
                    productId:
                        item.productId,
                    transactionType:
                        "Stock Out",
                    quantity,
                    previousStock,
                    newStock,
                    costPrice:
                        Number(
                            product.cost_price || 0
                        ),
                    supplierId:
                        null,
                    reference:
                        orderNumber,
                    remarks:
                        `Guest website order ${orderNumber}`,
                    createdBy:
                        null
                }
            );

            // Keep our locked product object synchronized
            // in case the same product is referenced again.
            product.stock_quantity =
                newStock;
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message:
                "Your order has been placed successfully.",

            order: {
                id:
                    orderId,

                order_number:
                    orderNumber,

                checkout_type:
                    "guest",

                order_status:
                    "Pending",

                payment_status:
                    paymentStatus,

                payment_method:
                    paymentMethod,

                subtotal,

                delivery_charges:
                    deliveryCharges,

                grand_total:
                    grandTotal,

                full_name:
                    fullName,

                phone,

                email,

                city,

                items:
                    orderItems
            },

            guestAccessToken:
                guestToken
        });

    } catch (error) {
        if (
            connection &&
            transactionStarted
        ) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Guest order rollback error:",
                    rollbackError
                );
            }
        }

        console.error(
            "Place guest order error:",
            error
        );

        return res
            .status(
                error.statusCode ||
                500
            )
            .json({
                success: false,
                message:
                    error.statusCode
                        ? error.message
                        : "Unable to place your order.",

                error:
                    process.env.NODE_ENV ===
                    "production"
                        ? undefined
                        : error.message
            });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

/**
 * GET /api/orders/guest/:orderNumber?token=...
 *
 * Allows a guest to view only the order linked to the
 * secret token returned after checkout.
 */
exports.getGuestOrder = async (
    req,
    res
) => {
    try {
        const orderNumber =
            cleanText(
                req.params.orderNumber,
                50
            );

        const token =
            cleanText(
                req.query.token,
                200
            );

        if (
            !orderNumber ||
            !token
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Order number and guest access token are required."
            });
        }

        const [orders] =
            await db.query(
                `
                SELECT
                    id,
                    order_number,
                    checkout_type,
                    full_name,
                    phone,
                    email,
                    grand_total,
                    discount_amount,
                    delivery_charges,
                    order_status,
                    payment_method,
                    payment_status,
                    shipping_address,
                    city,
                    postal_code,
                    tracking_number,
                    tracking_url,
                    estimated_delivery_date,
                    created_at
                FROM orders
                WHERE order_number = ?
                  AND checkout_type = 'guest'
                  AND guest_access_token_hash = ?
                LIMIT 1
                `,
                [
                    orderNumber,
                    sha256(token)
                ]
            );

        if (!orders.length) {
            return res.status(404).json({
                success: false,
                message:
                    "Guest order was not found."
            });
        }

        const order =
            orders[0];

        const [items] =
            await db.query(
                `
                SELECT
                    oi.product_id,
                    p.product_name,
                    p.image,
                    oi.price,
                    oi.quantity,
                    oi.subtotal
                FROM order_items oi
                LEFT JOIN products p
                    ON p.id = oi.product_id
                WHERE oi.order_id = ?
                ORDER BY oi.id
                `,
                [order.id]
            );

        return res.json({
            success: true,
            order: {
                ...order,
                items
            }
        });

    } catch (error) {
        console.error(
            "Get guest order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load guest order details.",

            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};
