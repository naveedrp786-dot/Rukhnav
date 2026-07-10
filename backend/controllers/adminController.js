const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Register Admin
exports.register = async (req, res) => {
    try {

        const { full_name, email, password, role } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email and password are required."
            });
        }

        const [existingAdmin] = await db.query(
            "SELECT id FROM admins WHERE email = ?",
            [email]
        );

        if (existingAdmin.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const adminRole =
            role === "superadmin" ? "superadmin" : "admin";

        await db.query(
            `INSERT INTO admins
            (full_name, email, password, role)
            VALUES (?, ?, ?, ?)`,
            [
                full_name,
                email,
                hashedPassword,
                adminRole
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Admin registered successfully"
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// Login Admin
exports.login = async (req, res) => {
    try {

        const { email, password } = req.body;

        const [result] = await db.query(
            "SELECT * FROM admins WHERE email = ?",
            [email]
        );

        if (result.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Admin not found"
            });
        }

        const admin = result[0];

        const match = await bcrypt.compare(
            password,
            admin.password
        );

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Wrong password"
            });
        }

        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                role: admin.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "24h"
            }
        );

        return res.json({
            success: true,
            message: "Login successful",
            token
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

// Get All Admins
exports.getAllAdmins = async (req, res) => {
    try {

        const [admins] = await db.query(
            `SELECT id,
                    full_name,
                    email,
                    role,
                    created_at
             FROM admins`
        );

        return res.json({
            success: true,
            admins
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// ==========================
// Get All Orders (Admin)
// ==========================
exports.getAllOrders = async (req, res) => {

    try {

        const [orders] = await db.query(

            `SELECT
                o.id,
                c.full_name,
                c.email,
                o.total_amount,
                o.order_status,
                o.payment_method,
                o.payment_status,
                o.created_at

             FROM orders o

             JOIN customers c
             ON o.customer_id = c.id

             ORDER BY o.created_at DESC`

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
// Update Order Status
// ==========================
exports.updateOrderStatus = async (req, res) => {

    try {

        const { id } = req.params;
        const { order_status } = req.body;

const statusMap = {
    pending: "Pending",
    confirmed: "Confirmed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled"
};

const formattedStatus = statusMap[order_status.toLowerCase()];

if (!formattedStatus) {
    return res.status(400).json({
        success: false,
        message: "Invalid order status."
    });
}

        const [order] = await db.query(
            "SELECT id FROM orders WHERE id = ?",
            [id]
        );

        if (order.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        await db.query(
    "UPDATE orders SET order_status = ? WHERE id = ?",
    [formattedStatus, id]
);

        res.json({
            success: true,
            message: "Order status updated successfully."
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
// Dashboard Statistics
// ==========================
exports.dashboardStats = async (req, res) => {

    try {

        const [[customers]] = await db.query(
            "SELECT COUNT(*) AS totalCustomers FROM customers"
        );

        const [[admins]] = await db.query(
            "SELECT COUNT(*) AS totalAdmins FROM admins"
        );

        const [[products]] = await db.query(
            "SELECT COUNT(*) AS totalProducts FROM products"
        );

        const [[categories]] = await db.query(
            "SELECT COUNT(*) AS totalCategories FROM categories"
        );

        const [[orders]] = await db.query(
            "SELECT COUNT(*) AS totalOrders FROM orders"
        );

        const [[pending]] = await db.query(
            "SELECT COUNT(*) AS pendingOrders FROM orders WHERE order_status='Pending'"
        );

        const [[processing]] = await db.query(
            "SELECT COUNT(*) AS processingOrders FROM orders WHERE order_status='Processing'"
        );

        const [[shipped]] = await db.query(
            "SELECT COUNT(*) AS shippedOrders FROM orders WHERE order_status='Shipped'"
        );

        const [[delivered]] = await db.query(
            "SELECT COUNT(*) AS deliveredOrders FROM orders WHERE order_status='Delivered'"
        );

        const [[cancelled]] = await db.query(
            "SELECT COUNT(*) AS cancelledOrders FROM orders WHERE order_status='Cancelled'"
        );

        const [[revenue]] = await db.query(
            `SELECT
                IFNULL(SUM(total_amount),0) AS totalRevenue
             FROM orders
             WHERE order_status='Delivered'`
        );

        res.json({
            success: true,
            dashboard: {
                totalCustomers: customers.totalCustomers,
                totalAdmins: admins.totalAdmins,
                totalProducts: products.totalProducts,
                totalCategories: categories.totalCategories,
                totalOrders: orders.totalOrders,
                pendingOrders: pending.pendingOrders,
                processingOrders: processing.processingOrders,
                shippedOrders: shipped.shippedOrders,
                deliveredOrders: delivered.deliveredOrders,
                cancelledOrders: cancelled.cancelledOrders,
                totalRevenue: revenue.totalRevenue
            }
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
// Monthly Sales Report
// ==========================
exports.monthlySales = async (req, res) => {

    try {

        const [sales] = await db.query(

            `SELECT
                YEAR(created_at) AS year,
                MONTH(created_at) AS month,
                COUNT(*) AS totalOrders,
                IFNULL(SUM(total_amount), 0) AS totalSales

             FROM orders

             WHERE order_status = 'Delivered'

             GROUP BY
                YEAR(created_at),
                MONTH(created_at)

             ORDER BY
                year DESC,
                month DESC`

        );

        res.json({
            success: true,
            sales
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};