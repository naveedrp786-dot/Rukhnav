const db = require("../config/db");

exports.placeOrder = async (req, res) => {

    const customer_id = req.user.id;
    const { shipping_address, payment_method, coupon_code } = req.body;

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        // Get cart items
        const [cart] = await connection.query(
            `SELECT
                c.product_id,
                c.quantity,
                p.price,
                p.stock
             FROM cart c
             JOIN products p
             ON c.product_id = p.id
             WHERE c.customer_id = ?`,
            [customer_id]
        );

        if (cart.length === 0) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Cart is empty."
            });

        }

        let totalAmount = 0;

        for (const item of cart) {

            if (item.quantity > item.stock) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product ID ${item.product_id}`
                });

            }

            totalAmount += item.price * item.quantity;

        }

        let discountAmount = 0;
let appliedCoupon = null;

if (coupon_code) {

    const [coupon] = await connection.query(

        `SELECT *
         FROM coupons
         WHERE code = ?
         AND status = 'active'`,

        [coupon_code.toUpperCase()]

    );

    if (coupon.length === 0) {

        await connection.rollback();

        return res.status(400).json({
            success: false,
            message: "Invalid coupon."
        });

    }

    const c = coupon[0];

    if (new Date(c.expiry_date) < new Date()) {

        await connection.rollback();

        return res.status(400).json({
            success: false,
            message: "Coupon expired."
        });

    }

    if (totalAmount < Number(c.minimum_order)) {

        await connection.rollback();

        return res.status(400).json({
            success: false,
            message: `Minimum order is Rs. ${c.minimum_order}`
        });

    }

    if (
        c.usage_limit !== null &&
        c.used_count >= c.usage_limit
    ) {

        await connection.rollback();

        return res.status(400).json({
            success: false,
            message: "Coupon usage limit reached."
        });

    }

    if (c.discount_type === "percentage") {

        discountAmount =
            (totalAmount * Number(c.discount_value)) / 100;

    } else {

        discountAmount =
            Number(c.discount_value);

    }

    totalAmount =
        totalAmount - discountAmount;

    appliedCoupon =
        c.code;

}

        // Create order
        const [order] = await connection.query(

`INSERT INTO orders
(
customer_id,
total_amount,
discount_amount,
coupon_code,
payment_method,
shipping_address
)
VALUES (?, ?, ?, ?, ?, ?)`,

[
customer_id,
totalAmount,
discountAmount,
appliedCoupon,
payment_method || "Cash on Delivery",
shipping_address
]

);

if (appliedCoupon) {

    await connection.query(

        `UPDATE coupons
         SET used_count = used_count + 1
         WHERE code = ?`,

        [appliedCoupon]

    );

}

        const orderId = order.insertId;
                // Insert each cart item into order_items
        for (const item of cart) {

            const subtotal = item.price * item.quantity;

            await connection.query(
                `INSERT INTO order_items
                (order_id, product_id, price, quantity, subtotal)
                VALUES (?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.price,
                    item.quantity,
                    subtotal
                ]
            );

            // Reduce stock
            await connection.query(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ?`,
                [
                    item.quantity,
                    item.product_id
                ]
            );

        }

        // Empty customer's cart
        await connection.query(
            "DELETE FROM cart WHERE customer_id = ?",
            [customer_id]
        );

        // Save all changes
        // Save all changes
await connection.commit();

res.status(201).json({
    success: true,
    message: "Order placed successfully.",
    orderId,
    totalAmount,
    discountAmount,
    coupon: appliedCoupon
});

} catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    } finally {

        connection.release();

    }

};

// ==========================
// View My Orders
// ==========================
exports.getMyOrders = async (req, res) => {

    try {

        const customer_id = req.user.id;

        const [orders] = await db.query(

            `SELECT
                id,
                total_amount,
                order_status,
                payment_method,
                payment_status,
                created_at
             FROM orders
             WHERE customer_id = ?
             ORDER BY created_at DESC`,

            [customer_id]

        );

        res.json({

            success: true,
            totalOrders: orders.length,
            orders

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};

// ==========================
// View Single Order Details
// ==========================
exports.getOrderDetails = async (req, res) => {

    try {

        const customer_id = req.user.id;
        const orderId = req.params.id;

        // Check that the order belongs to the logged-in customer
        const [order] = await db.query(

            `SELECT
                id,
                total_amount,
                order_status,
                payment_method,
                payment_status,
                shipping_address,
                created_at
             FROM orders
             WHERE id = ?
             AND customer_id = ?`,

            [orderId, customer_id]

        );

        if (order.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Order not found."

            });

        }

        // Get products in this order
        const [items] = await db.query(

            `SELECT
                oi.product_id,
                p.product_name,
                p.image,
                oi.price,
                oi.quantity,
                oi.subtotal

             FROM order_items oi

             JOIN products p
             ON oi.product_id = p.id

             WHERE oi.order_id = ?`,

            [orderId]

        );

        res.json({

            success: true,
            order: order[0],
            items

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};
// ==========================
// Cancel Order
// ==========================
exports.cancelOrder = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const customer_id = req.user.id;
        const orderId = req.params.id;

        await connection.beginTransaction();

        // Check order
        const [order] = await connection.query(

            `SELECT *
             FROM orders
             WHERE id = ?
             AND customer_id = ?`,

            [orderId, customer_id]

        );

        if (order.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,
                message: "Order not found."

            });

        }

        if (order[0].order_status !== "Pending") {

            await connection.rollback();

            return res.status(400).json({

                success: false,
                message: "Only Pending orders can be cancelled."

            });

        }

        // Get ordered products
        const [items] = await connection.query(

            `SELECT product_id, quantity
             FROM order_items
             WHERE order_id = ?`,

            [orderId]

        );

        // Restore stock
        for (const item of items) {

            await connection.query(

                `UPDATE products
                 SET stock = stock + ?
                 WHERE id = ?`,

                [
                    item.quantity,
                    item.product_id
                ]

            );

        }

        // Update order status
        await connection.query(

            `UPDATE orders
             SET order_status='Cancelled'
             WHERE id=?`,

            [orderId]

        );

        await connection.commit();

        res.json({

            success: true,
            message: "Order cancelled successfully."

        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    } finally {

        connection.release();

    }

};