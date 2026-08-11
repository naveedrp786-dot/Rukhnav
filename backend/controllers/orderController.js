"use strict";

const inventoryService =
    require("../services/inventoryService");

const db = require("../config/db");
const notificationHooks =
    require("../services/notificationHooks");

// =====================================================
// Configuration
// =====================================================

// Delivery rules.
//
// Railway environment variables may override these values,
// but the application must always have safe production
// defaults aligned with the storefront and guest checkout.
//
// Default:
// - Rs. 250 delivery charge
// - Free delivery on orders of Rs. 2,500 or more

const DEFAULT_DELIVERY_CHARGES =
    Number(
        process.env.DELIVERY_CHARGES ||
        250
    );

const FREE_DELIVERY_MINIMUM =
    Number(
        process.env.FREE_DELIVERY_MINIMUM ||
        2500
    );

const ALLOWED_PAYMENT_METHODS = {
    cash_on_delivery: "cash_on_delivery",
    "cash on delivery": "cash_on_delivery",
    cod: "cash_on_delivery",

    jazzcash: "jazzcash",
    "jazz cash": "jazzcash",

    easypaisa: "easypaisa",
    "easy paisa": "easypaisa",

    bank_transfer: "bank_transfer",
    "bank transfer": "bank_transfer"
};

// =====================================================
// Helpers
// =====================================================

const cleanText = (value, maxLength = 255) => {
    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
};

const nullableText = (
    value,
    maxLength = 255
) => {
    const result = cleanText(
        value,
        maxLength
    );

    return result || null;
};

const normalisePaymentMethod = value => {
    const cleaned = cleanText(
        value || "cash_on_delivery",
        50
    ).toLowerCase();

    return (
        ALLOWED_PAYMENT_METHODS[cleaned] ||
        null
    );
};

const isValidEmail = email => {
    if (!email) {
        return true;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
};

const makeOrderNumber = orderId => {
    const now = new Date();

    const year = now
        .getFullYear()
        .toString();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    const paddedId = String(
        orderId
    ).padStart(6, "0");

    return `RUK-${year}${month}${day}-${paddedId}`;
};

const calculateDeliveryCharges = subtotal => {
    if (
        FREE_DELIVERY_MINIMUM > 0 &&
        subtotal >= FREE_DELIVERY_MINIMUM
    ) {
        return 0;
    }

    return Math.max(
        0,
        Number(
            DEFAULT_DELIVERY_CHARGES.toFixed(
                2
            )
        )
    );
};

const rollbackQuietly = async connection => {
    try {
        await connection.rollback();
    } catch (rollbackError) {
        console.error(
            "Rollback error:",
            rollbackError
        );
    }
};

// =====================================================
// Place Customer Order
// =====================================================

exports.placeOrder = async (req, res) => {
    const customerId = Number(
        req.user?.id
    );

    if (
        !Number.isInteger(customerId) ||
        customerId < 1
    ) {
        return res.status(401).json({
            success: false,
            message:
                "Customer authentication is required."
        });
    }

    const fullName = cleanText(
        req.body.full_name,
        150
    );

    const phone = cleanText(
        req.body.phone,
        30
    );

    const email = cleanText(
        req.body.email,
        150
    ).toLowerCase();

    const shippingAddress = cleanText(
        req.body.shipping_address,
        2000
    );

    const city = nullableText(
        req.body.city,
        100
    );

    const postalCode = nullableText(
        req.body.postal_code,
        30
    );

    const orderNotes = nullableText(
        req.body.order_notes,
        2000
    );

    const transactionId = nullableText(
        req.body.transaction_id,
        150
    );

    const paymentPhone = nullableText(
        req.body.payment_phone,
        30
    );

    const addressId =
        req.body.address_id === undefined ||
        req.body.address_id === null ||
        req.body.address_id === ""
            ? null
            : Number(req.body.address_id);

    const couponCode =
        req.body.coupon_code
            ? cleanText(
                  req.body.coupon_code,
                  50
              ).toUpperCase()
            : null;

    const paymentMethod =
        normalisePaymentMethod(
            req.body.payment_method
        );

    // -------------------------------------------------
    // Basic checkout validation
    // -------------------------------------------------

    if (!fullName) {
        return res.status(400).json({
            success: false,
            message:
                "Full name is required."
        });
    }

    if (!phone) {
        return res.status(400).json({
            success: false,
            message:
                "Phone number is required."
        });
    }

    if (!shippingAddress) {
        return res.status(400).json({
            success: false,
            message:
                "Shipping address is required."
        });
    }

    if (!paymentMethod) {
        return res.status(400).json({
            success: false,
            message:
                "Invalid payment method. Use cash_on_delivery, jazzcash, easypaisa, or bank_transfer."
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            message:
                "Please enter a valid email address."
        });
    }

    if (
        addressId !== null &&
        (
            !Number.isInteger(addressId) ||
            addressId < 1
        )
    ) {
        return res.status(400).json({
            success: false,
            message:
                "A valid address ID is required."
        });
    }

    const requiresPaymentReference =
        [
            "jazzcash",
            "easypaisa",
            "bank_transfer"
        ].includes(paymentMethod);

    if (
        requiresPaymentReference &&
        !transactionId
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Transaction ID is required for the selected payment method."
        });
    }

    if (
        [
            "jazzcash",
            "easypaisa"
        ].includes(paymentMethod) &&
        !paymentPhone
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Payment phone number is required."
        });
    }

    let connection;

    try {
        connection =
            await db.getConnection();

        await connection.beginTransaction();

        // -------------------------------------------------
        // Validate customer
        // -------------------------------------------------

        const [customerRows] =
            await connection.query(
                `
                SELECT
                    c.id,
                    c.status,
                    COALESCE(
                        cr.membership_level,
                        'Bronze'
                    ) AS membership_level,
                    COALESCE(
                        clc.discount_percentage,
                        0
                    ) AS loyalty_discount_percentage,
                    COALESCE(
                        clc.free_delivery_enabled,
                        0
                    ) AS free_delivery_enabled
                FROM customers c
                LEFT JOIN customer_rewards cr
                    ON cr.customer_id = c.id
                LEFT JOIN customer_loyalty_categories clc
                    ON LOWER(clc.category_name) =
                       LOWER(
                           COALESCE(
                               cr.membership_level,
                               'Bronze'
                           )
                       )
                   AND LOWER(clc.status) = 'active'
                WHERE c.id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [customerId]
            );

        if (
            customerRows.length === 0
        ) {
            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });
        }

        const customerStatus =
            String(
                customerRows[0].status ||
                    ""
            ).toLowerCase();

        if (
            customerStatus &&
            ![
                "active",
                "verified"
            ].includes(customerStatus)
        ) {
            await rollbackQuietly(
                connection
            );

            return res.status(403).json({
                success: false,
                message:
                    "Your customer account is not active."
            });
        }

        // -------------------------------------------------
        // Validate saved address ownership
        // -------------------------------------------------

        if (addressId !== null) {
            const [addressRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM customer_addresses
                    WHERE id = ?
                      AND customer_id = ?
                    LIMIT 1
                    `,
                    [
                        addressId,
                        customerId
                    ]
                );

            if (
                addressRows.length === 0
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        "The selected delivery address is invalid."
                });
            }
        }

        // -------------------------------------------------
        // Lock cart products
        // -------------------------------------------------

        const [cart] =
            await connection.query(
                `
                SELECT
                    c.id AS cart_id,
                    c.product_id,
                    c.quantity,
                    p.product_name,
                    p.selling_price,
                    p.stock_quantity,
                    p.status
                FROM cart c

                INNER JOIN products p
                    ON p.id = c.product_id

                WHERE c.customer_id = ?

                ORDER BY c.id ASC

                FOR UPDATE
                `,
                [customerId]
            );

        if (cart.length === 0) {
            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Your cart is empty."
            });
        }

        let subtotalAmount = 0;

        for (const item of cart) {
            const quantity = Number(
                item.quantity
            );

            const stockQuantity = Number(
                item.stock_quantity
            );

            const sellingPrice = Number(
                item.selling_price
            );

            const productStatus =
                String(
                    item.status || ""
                ).toLowerCase();

            if (
                !Number.isInteger(
                    quantity
                ) ||
                quantity < 1
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Invalid quantity for ${item.product_name}.`
                });
            }

            if (
                !Number.isFinite(
                    sellingPrice
                ) ||
                sellingPrice < 0
            ) {
                throw new Error(
                    `Invalid selling price for ${item.product_name}.`
                );
            }

            if (
                productStatus ===
                "inactive"
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `${item.product_name} is currently unavailable.`
                });
            }

            if (
                stockQuantity < quantity
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Only ${stockQuantity} unit(s) of ${item.product_name} are available.`
                });
            }

            subtotalAmount +=
                sellingPrice *
                quantity;
        }

        subtotalAmount = Number(
            subtotalAmount.toFixed(2)
        );

        // -------------------------------------------------
        // Coupon validation
        // -------------------------------------------------

        let discountAmount = 0;
        let appliedCoupon = null;
        let appliedCouponId = null;

        if (couponCode) {
            const [couponRows] =
                await connection.query(
                    `
                    SELECT *
                    FROM coupons
                    WHERE UPPER(code) = ?
                      AND LOWER(status) =
                          'active'
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [couponCode]
                );

            if (
                couponRows.length === 0
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid coupon code."
                });
            }

            const coupon =
                couponRows[0];

            // A customer-specific coupon may only be used
            // by the customer to whom it was assigned.
            if (
                coupon.customer_id !== null &&
                Number(coupon.customer_id) !==
                    customerId
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(403).json({
                    success: false,
                    message:
                        "This coupon is not available for your account."
                });
            }

            if (
                coupon.expiry_date &&
                new Date(
                    coupon.expiry_date
                ) < new Date()
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        "This coupon has expired."
                });
            }

            const minimumOrder =
                Number(
                    coupon.minimum_order ||
                        0
                );

            if (
                subtotalAmount <
                minimumOrder
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `The minimum order amount for this coupon is Rs. ${minimumOrder.toFixed(
                            2
                        )}.`
                });
            }

            if (
                coupon.usage_limit !==
                    null &&
                Number(
                    coupon.used_count || 0
                ) >=
                    Number(
                        coupon.usage_limit
                    )
            ) {
                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        "This coupon has reached its usage limit."
                });
            }

            const discountType =
                String(
                    coupon.discount_type ||
                        ""
                ).toLowerCase();

            const discountValue =
                Number(
                    coupon.discount_value ||
                        0
                );

            if (
                discountType ===
                "percentage"
            ) {
                discountAmount =
                    subtotalAmount *
                    (
                        discountValue /
                        100
                    );
            } else {
                discountAmount =
                    discountValue;
            }

            discountAmount = Math.min(
                Math.max(
                    discountAmount,
                    0
                ),
                subtotalAmount
            );

            discountAmount = Number(
                discountAmount.toFixed(2)
            );

            appliedCoupon =
                coupon.code;

            appliedCouponId =
                coupon.id;
        }

        // -------------------------------------------------
        // Secure server-side totals
        // -------------------------------------------------

        /*
         * Loyalty benefits are calculated by the server.
         * Never trust a membership discount or free-delivery
         * value supplied by the browser.
         */
        const loyaltyMembershipLevel =
            cleanText(
                customerRows[0].membership_level ||
                "Bronze",
                50
            ) || "Bronze";

        const loyaltyDiscountPercentage =
            Math.min(
                Math.max(
                    Number(
                        customerRows[0]
                            .loyalty_discount_percentage ||
                        0
                    ),
                    0
                ),
                100
            );

        /*
         * Apply the membership discount after the coupon.
         * This prevents discounts from exceeding the
         * remaining merchandise value.
         */
        const amountAfterCoupon =
            Math.max(
                0,
                subtotalAmount -
                discountAmount
            );

        const loyaltyDiscountAmount =
            Number(
                Math.min(
                    amountAfterCoupon,
                    amountAfterCoupon *
                    (
                        loyaltyDiscountPercentage /
                        100
                    )
                ).toFixed(2)
            );

        const freeDeliveryEnabled =
            Number(
                customerRows[0]
                    .free_delivery_enabled ||
                0
            ) === 1;

        const deliveryCharges =
            freeDeliveryEnabled
                ? 0
                : calculateDeliveryCharges(
                      subtotalAmount
                  );

        /*
         * Reward-point redemption is intentionally zero
         * until checkout redemption/reservation/reversal
         * is implemented transactionally.
         */
        const rewardPointsRedeemed = 0;
        const rewardPointsDiscountAmount = 0;

        const grandTotal = Number(
            Math.max(
                0,
                subtotalAmount -
                discountAmount -
                loyaltyDiscountAmount -
                rewardPointsDiscountAmount +
                deliveryCharges
            ).toFixed(2)
        );

        // Online/manual transfers remain Pending until
        // verified by an administrator.
        const paymentStatus =
            "Pending";

        // -------------------------------------------------
        // Create order
        // -------------------------------------------------

        const [orderResult] =
            await connection.query(
                `
                INSERT INTO orders
                (
                    customer_id,
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
                    loyalty_discount_amount,
                    loyalty_membership_level,
                    loyalty_discount_percentage,
                    reward_points_redeemed,
                    reward_points_discount_amount,
                    delivery_charges,
                    address_id
                )
                VALUES
                (
                    ?, ?, ?, ?, ?,
                    'Pending',
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?
                )
                `,
                [
                    customerId,
                    fullName,
                    phone,
                    email || null,
                    grandTotal,
                    paymentMethod,
                    paymentStatus,
                    transactionId,
                    paymentPhone,
                    shippingAddress,
                    city,
                    postalCode,
                    orderNotes,
                    appliedCoupon,
                    discountAmount,
                    loyaltyDiscountAmount,
                    loyaltyMembershipLevel,
                    loyaltyDiscountPercentage,
                    rewardPointsRedeemed,
                    rewardPointsDiscountAmount,
                    deliveryCharges,
                    addressId
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

        // -------------------------------------------------
        // Save order items and reduce stock
        // -------------------------------------------------

        for (const item of cart) {
            const price = Number(
                item.selling_price
            );

            const quantity = Number(
                item.quantity
            );

            const itemSubtotal =
                Number(
                    (
                        price *
                        quantity
                    ).toFixed(2)
                );

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
                    item.product_id,
                    price,
                    quantity,
                    itemSubtotal
                ]
            );

            const [productRows] =
                await connection.query(
                    `
                    SELECT
                        stock_quantity,
                        low_stock_level,
                        cost_price
                    FROM products
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [item.product_id]
                );

            if (!productRows.length) {
                throw new Error(
                    `Product not found for ${item.product_name}.`
                );
            }

            const previousStock =
                Number(productRows[0].stock_quantity);

            if (previousStock < quantity) {
                throw new Error(
                    `Unable to reserve stock for ${item.product_name}.`
                );
            }

            const newStock =
                previousStock - quantity;

            const stockStatus =
                inventoryService.getStockStatus(
                    newStock,
                    productRows[0].low_stock_level
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
                        "Stock Out",
                    quantity,
                    previousStock,
                    newStock,
                    costPrice:
                        Number(
                            productRows[0].cost_price || 0
                        ),
                    supplierId: null,
                    reference:
                        orderNumber,
                    remarks:
                        `Website order ${orderNumber}`,
                    createdBy: null
                }
            );
        }

        // -------------------------------------------------
        // Record coupon usage
        // -------------------------------------------------

        if (
            appliedCoupon &&
            appliedCouponId
        ) {
            const [couponUpdateResult] =
                await connection.query(
                    `
                    UPDATE coupons
                    SET
                        used_count =
                            COALESCE(
                                used_count,
                                0
                            ) + 1,
                        used_at =
                            CURRENT_TIMESTAMP
                    WHERE id = ?
                      AND LOWER(status) =
                          'active'
                      AND (
                            usage_limit IS NULL
                            OR used_count < usage_limit
                      )
                    `,
                    [appliedCouponId]
                );

            if (
                couponUpdateResult.affectedRows ===
                0
            ) {
                throw new Error(
                    "The coupon could not be reserved because its usage limit was reached."
                );
            }

            await connection.query(
                `
                INSERT INTO coupon_usage_history
                (
                    coupon_id,
                    customer_id,
                    order_id,
                    coupon_code,
                    order_total,
                    discount_amount,
                    final_total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    appliedCouponId,
                    customerId,
                    orderId,
                    appliedCoupon,
                    subtotalAmount,
                    discountAmount,
                    grandTotal
                ]
            );
        }

        // -------------------------------------------------
        // Clear cart
        // -------------------------------------------------

        await connection.query(
            `
            DELETE FROM cart
            WHERE customer_id = ?
            `,
            [customerId]
        );

        await connection.commit();


        notificationHooks
            .orderPlaced({
                customerId,
                orderId,
                orderNumber,
                grandTotal,
                orderStatus:
                    "Pending"
            });

        return res.status(201).json({
            success: true,
            message:
                "Order placed successfully.",
            order: {
                id: orderId,
                orderNumber,
                customerId,
                fullName,
                phone,
                email: email || null,
                subtotalAmount,
                discountAmount,
                couponId:
                    appliedCouponId,
                couponCode:
                    appliedCoupon,
                deliveryCharges,
                grandTotal,
                paymentMethod,
                paymentStatus,
                orderStatus:
                    "Pending",
                transactionId,
                paymentPhone,
                shippingAddress,
                city,
                postalCode,
                orderNotes,
                addressId
            }
        });
    } catch (error) {
        if (connection) {
            await rollbackQuietly(
                connection
            );
        }

        console.error(
            "Place order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to place the order.",
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

// =====================================================
// Get Logged-In Customer Orders
// =====================================================

exports.getMyOrders = async (
    req,
    res
) => {
    try {
        const customerId = Number(
            req.user?.id
        );

        const [orders] =
            await db.query(
                `
                SELECT
                    o.id,
                    o.order_number,
                    o.full_name,
                    o.phone,
                    o.email,
                    o.grand_total,
                    o.discount_amount,
                    o.delivery_charges,
                    o.coupon_code,
                    o.order_status,
                    o.payment_method,
                    o.payment_status,
                    o.shipping_address,
                    o.city,
                    o.postal_code,
                    o.created_at,
                    o.confirmed_at,
                    o.shipped_at,
                    o.delivered_at,
                    o.cancelled_at,
                    o.tracking_number,
                    o.tracking_url,
                    o.estimated_delivery_date,

                    COUNT(oi.id)
                        AS item_count,

                    COALESCE(
                        SUM(oi.quantity),
                        0
                    ) AS total_quantity

                FROM orders o

                LEFT JOIN order_items oi
                    ON oi.order_id = o.id

                WHERE o.customer_id = ?

                GROUP BY o.id

                ORDER BY
                    o.created_at DESC,
                    o.id DESC
                `,
                [customerId]
            );

        return res.json({
            success: true,
            totalOrders:
                orders.length,
            orders
        });
    } catch (error) {
        console.error(
            "Get customer orders error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve orders.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// =====================================================
// Get One Customer Order
// =====================================================

exports.getOrderDetails = async (
    req,
    res
) => {
    try {
        const customerId = Number(
            req.user?.id
        );

        const orderId = Number(
            req.params.id
        );

        if (
            !Number.isInteger(orderId) ||
            orderId < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid order ID is required."
            });
        }

        const [orderRows] =
            await db.query(
                `
                SELECT
                    id,
                    order_number,
                    customer_id,
                    full_name,
                    phone,
                    email,
                    grand_total,
                    discount_amount,
                    delivery_charges,
                    coupon_code,
                    order_status,
                    payment_method,
                    payment_status,
                    transaction_id,
                    payment_phone,
                    shipping_address,
                    city,
                    postal_code,
                    order_notes,
                    address_id,
                    created_at,
                    confirmed_at,
                    shipped_at,
                    delivered_at,
                    cancelled_at,
                    tracking_number,
                    tracking_url,
                    estimated_delivery_date
                FROM orders
                WHERE id = ?
                  AND customer_id = ?
                LIMIT 1
                `,
                [
                    orderId,
                    customerId
                ]
            );

        if (
            orderRows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Order not found."
            });
        }

        const [items] =
            await db.query(
                `
                SELECT
                    oi.id,
                    oi.product_id,
                    p.product_name,

                    COALESCE(
                        (
                            SELECT
                                pi.image_url
                            FROM product_images pi
                            WHERE
                                pi.product_id =
                                p.id
                            ORDER BY
                                pi.sort_order ASC,
                                pi.id ASC
                            LIMIT 1
                        ),
                        p.image
                    ) AS image,

                    oi.price,
                    oi.quantity,
                    oi.subtotal

                FROM order_items oi

                LEFT JOIN products p
                    ON p.id =
                       oi.product_id

                WHERE oi.order_id = ?

                ORDER BY oi.id ASC
                `,
                [orderId]
            );

        const itemsSubtotal =
            items.reduce(
                (total, item) =>
                    total +
                    Number(
                        item.subtotal || 0
                    ),
                0
            );

        return res.json({
            success: true,
            order: {
                ...orderRows[0],
                subtotalAmount:
                    Number(
                        itemsSubtotal.toFixed(
                            2
                        )
                    )
            },
            itemCount:
                items.length,
            totalQuantity:
                items.reduce(
                    (total, item) =>
                        total +
                        Number(
                            item.quantity ||
                                0
                        ),
                    0
                ),
            items
        });
    } catch (error) {
        console.error(
            "Get order details error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to retrieve order details.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// =====================================================
// Cancel Pending Customer Order
// =====================================================

exports.cancelOrder = async (
    req,
    res
) => {
    const customerId = Number(
        req.user?.id
    );

    const orderId = Number(
        req.params.id
    );

    if (
        !Number.isInteger(orderId) ||
        orderId < 1
    ) {
        return res.status(400).json({
            success: false,
            message:
                "A valid order ID is required."
        });
    }

    let connection;

    try {
        connection =
            await db.getConnection();

        await connection.beginTransaction();

        const [orderRows] =
            await connection.query(
                `
                SELECT
                    id,
                    order_number,
                    order_status,
                    payment_status,
                    coupon_code
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

        if (
            orderRows.length === 0
        ) {
            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Order not found."
            });
        }

        const order =
            orderRows[0];

        if (
            String(
                order.order_status
            ).toLowerCase() !==
            "pending"
        ) {
            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Only pending orders can be cancelled by the customer."
            });
        }

        if (
            String(
                order.payment_status
            ).toLowerCase() ===
            "paid"
        ) {
            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "A paid order cannot be cancelled automatically. Please contact customer support."
            });
        }

        const [items] =
            await connection.query(
                `
                SELECT
                    product_id,
                    quantity
                FROM order_items
                WHERE order_id = ?
                FOR UPDATE
                `,
                [orderId]
            );

        for (const item of items) {
            const [productRows] =
                await connection.query(
                    `
                    SELECT
                        stock_quantity,
                        low_stock_level,
                        cost_price
                    FROM products
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [item.product_id]
                );

            if (!productRows.length) {
                throw new Error(
                    `Product ${item.product_id} was not found while restoring cancelled order stock.`
                );
            }

            const previousStock =
                Number(productRows[0].stock_quantity);

            const restoredQuantity =
                Number(item.quantity);

            const newStock =
                previousStock +
                restoredQuantity;

            const stockStatus =
                inventoryService.getStockStatus(
                    newStock,
                    productRows[0].low_stock_level
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
                        Number(
                            productRows[0].cost_price || 0
                        ),
                    supplierId: null,
                    reference:
                        order.order_number,
                    remarks:
                        `Stock restored after cancellation of website order ${order.order_number}`,
                    createdBy: null
                }
            );
        }

        await connection.query(
            `
            UPDATE orders
            SET
                order_status =
                    'Cancelled',
                cancelled_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
              AND customer_id = ?
              AND order_status =
                  'Pending'
            `,
            [
                orderId,
                customerId
            ]
        );

        if (order.coupon_code) {
            const [couponRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM coupons
                    WHERE code = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [order.coupon_code]
                );

            if (couponRows.length > 0) {
                const couponId =
                    couponRows[0].id;

                await connection.query(
                    `
                    DELETE FROM coupon_usage_history
                    WHERE coupon_id = ?
                      AND order_id = ?
                    `,
                    [
                        couponId,
                        orderId
                    ]
                );

                await connection.query(
                    `
                    UPDATE coupons
                    SET
                        used_count =
                            GREATEST(
                                COALESCE(
                                    used_count,
                                    0
                                ) - 1,
                                0
                            ),
                        used_at =
                            (
                                SELECT MAX(cuh.created_at)
                                FROM coupon_usage_history cuh
                                WHERE cuh.coupon_id = ?
                            )
                    WHERE id = ?
                    `,
                    [
                        couponId,
                        couponId
                    ]
                );
            }
        }

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Order cancelled successfully.",
            order: {
                id: orderId,
                orderNumber:
                    order.order_number,
                orderStatus:
                    "Cancelled"
            }
        });
    } catch (error) {
        if (connection) {
            await rollbackQuietly(
                connection
            );
        }

        console.error(
            "Cancel order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to cancel the order.",
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