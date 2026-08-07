// =====================================================
// RUKHNAV ERP
// Admin Controller
// Part 1
// =====================================================

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const logger = require("../utils/logger");

const {
    processOrderRewards
} = require("../services/rewardService");

const {
    reduceStock
} = require("../services/inventoryService");

const {
    sendEmail
} = require("../services/emailService");

// =====================================================
// Helper Functions
// =====================================================

const successResponse = (
    res,
    message,
    data = {},
    statusCode = 200
) => {

    return res.status(statusCode).json({

        success: true,
        message,
        ...data

    });

};

const errorResponse = (
    res,
    message,
    statusCode = 500
) => {

    return res.status(statusCode).json({

        success: false,
        message

    });

};

// =====================================================
// Register Admin
// =====================================================

exports.register = async (req, res) => {

    try {

        const {

            first_name,
            last_name,
            email,
            phone,
            password,
            role

        } = req.body;

        if (
            !first_name ||
            !last_name ||
            !email ||
            !password
        ) {

            return errorResponse(

                res,

                "First name, last name, email and password are required.",

                400

            );

        }

        const [existing] = await db.query(

            `SELECT id
             FROM admins
             WHERE email = ?`,

            [email]

        );

        if (existing.length > 0) {

            return errorResponse(

                res,

                "Email already exists.",

                409

            );

        }

        const hashedPassword = await bcrypt.hash(

            password,

            10

        );

        const allowedRoles = [

            "superadmin",
            "admin",
            "manager",
            "inventory",
            "finance",
            "support"

        ];

        const adminRole = allowedRoles.includes(role)

            ? role

            : "admin";

        const [result] = await db.query(
    `INSERT INTO admins
    (
        first_name,
        last_name,
        email,
        phone,
        password,
        role,
        status,
        profile_image
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        first_name,
        last_name,
        email,
        phone || null,
        hashedPassword,
        role || "admin",
        status || "active",
        profile_image
    ]
);

        // Send Welcome Email
        await sendEmail(

            email,

            "Welcome to RUKHNAV ERP",

            `
                <h2>Welcome ${first_name} ${last_name}</h2>

                <p>Your administrator account has been created successfully.</p>

                <p>Thank you for joining RUKHNAV ERP.</p>
            `

        );

        logger.info(

            `Admin created: ${email}`

        );

        return successResponse(

            res,

            "Admin registered successfully.",

            {

                adminId: result.insertId

            },

            201

        );

    }

    catch (error) {

        logger.error(error.message);

        return errorResponse(

            res,

            error.message

        );

    }

};
// =====================================================
// Login Admin
// =====================================================

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        // Validate Input
        if (!email || !password) {

            return errorResponse(
                res,
                "Email and password are required.",
                400
            );

        }

        // Find Admin
        const [admins] = await db.query(
            `SELECT *
             FROM admins
             WHERE email = ?`,
            [email]
        );

        if (admins.length === 0) {

            return errorResponse(
                res,
                "Invalid email or password.",
                401
            );

        }

        const admin = admins[0];

        // Check Status
        if (
            admin.status &&
            admin.status.toLowerCase() !== "active"
        ) {

            return errorResponse(
                res,
                "Your account has been disabled.",
                403
            );

        }

        // Compare Password
        const passwordMatched = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordMatched) {

            return errorResponse(
                res,
                "Invalid email or password.",
                401
            );

        }

        // Generate JWT Token
        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                role: admin.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        logger.info(`Admin Login: ${admin.email}`);

        return successResponse(
            res,
            "Login successful.",
            {
                token,
                admin: {
                    id: admin.id,
                    first_name: admin.first_name,
                    last_name: admin.last_name,
                    email: admin.email,
                    phone: admin.phone,
                    role: admin.role,
                    status: admin.status,
                    profile_image: admin.profile_image,
                    created_at: admin.created_at
                }
            }
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};
// =====================================================
// Get All Admins
// =====================================================

exports.getAdmins = async (req, res) => {

    try {

        const [admins] = await db.query(`
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                profile_image,
                created_at,
                updated_at
            FROM admins
            ORDER BY id DESC
        `);

        return successResponse(
            res,
            "Admins fetched successfully.",
            {
                total: admins.length,
                admins
            }
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};

// =====================================================
// Get Admin By ID
// =====================================================

exports.getAdminById = async (req, res) => {

    try {

        const { id } = req.params;

        const [admins] = await db.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                profile_image,
                created_at,
                updated_at
            FROM admins
            WHERE id = ?
            `,
            [id]
        );

        if (admins.length === 0) {

            return errorResponse(
                res,
                "Admin not found.",
                404
            );

        }

        return successResponse(
            res,
            "Admin fetched successfully.",
            {
                admin: admins[0]
            }
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};
// =====================================================
// Create Admin
// =====================================================

exports.createAdmin = async (req, res) => {

    try {

        const {
            first_name,
            last_name,
            email,
            phone,
            password,
            role,
            status
        } = req.body;

        const profile_image = req.file
    ? req.file.filename
    : null;

        if (!first_name || !last_name || !email || !password) {

            return errorResponse(
                res,
                "First name, last name, email and password are required.",
                400
            );

        }

        const [existing] = await db.query(
            "SELECT id FROM admins WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {

            return errorResponse(
                res,
                "Email already exists.",
                409
            );

        }

        const hashedPassword = await bcrypt.hash(password, 10);

       const [result] = await db.query(
    `INSERT INTO admins
    (
        first_name,
        last_name,
        email,
        phone,
        password,
        role,
        status,
        profile_image
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        first_name,
        last_name,
        email,
        phone || null,
        hashedPassword,
        role || "admin",
        status || "active",
        profile_image
    ]
);

        logger.info(`Admin created: ${email}`);

        return successResponse(
            res,
            "Admin created successfully.",
            {
                adminId: result.insertId
            },
            201
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};



// =====================================================
// Update Admin
// =====================================================

exports.updateAdmin = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            first_name,
            last_name,
            email,
            phone,
            role,
            status
        } = req.body;

        // Check if admin exists
        const [admins] = await db.query(
            "SELECT * FROM admins WHERE id = ?",
            [id]
        );

        if (admins.length === 0) {

            return errorResponse(
                res,
                "Admin not found.",
                404
            );

        }

        // Check duplicate email
        const [duplicate] = await db.query(
            "SELECT id FROM admins WHERE email = ? AND id != ?",
            [email, id]
        );

        if (duplicate.length > 0) {

            return errorResponse(
                res,
                "Email already exists.",
                409
            );

        }

        // Keep existing image unless a new one is uploaded
        let profile_image = admins[0].profile_image;

        if (req.file) {

            profile_image = req.file.filename;

        }

        await db.query(
            `UPDATE admins
             SET
                first_name = ?,
                last_name = ?,
                email = ?,
                phone = ?,
                role = ?,
                status = ?,
                profile_image = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                profile_image,
                id
            ]
        );

        logger.info(`Admin updated: ${id}`);

        return successResponse(
            res,
            "Admin updated successfully."
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};
// =====================================================
// Delete Admin
// =====================================================

exports.deleteAdmin = async (req, res) => {

    try {

        const { id } = req.params;

        // Check if admin exists
        const [admins] = await db.query(
            "SELECT id, first_name, last_name, email FROM admins WHERE id = ?",
            [id]
        );

        if (admins.length === 0) {

            return errorResponse(
                res,
                "Admin not found.",
                404
            );

        }

        // Prevent deleting your own account
        if (req.admin && Number(req.admin.id) === Number(id)) {

            return errorResponse(
                res,
                "You cannot delete your own account.",
                400
            );

        }

        // Delete Admin
        await db.query(
            "DELETE FROM admins WHERE id = ?",
            [id]
        );

        logger.info(
            `Admin deleted: ${admins[0].email}`
        );

        return successResponse(
            res,
            "Admin deleted successfully."
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};
// =====================================================
// Dashboard Statistics
// =====================================================

exports.dashboardStats = async (req, res) => {

    try {

        const [[customerCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM customers"
        );

        const [[productCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM products"
        );

        const [[orderCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM orders"
        );

        const [[adminCount]] = await db.query(
            "SELECT COUNT(*) AS total FROM admins"
        );

        const [[revenue]] = await db.query(
            `
            SELECT
                IFNULL(SUM(total_amount),0) AS totalRevenue
            FROM orders
            WHERE payment_status='paid'
            `
        );

        const [[pendingOrders]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM orders
            WHERE order_status='pending'
            `
        );

        const [[completedOrders]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM orders
            WHERE order_status='completed'
            `
        );

        const [[lowStock]] = await db.query(
            `
            SELECT COUNT(*) AS total
            FROM products
            WHERE stock_quantity <= low_stock_level
            `
        );

        return successResponse(
            res,
            "Dashboard statistics fetched successfully.",
            {
                dashboard: {
                    customers: customerCount.total,
                    admins: adminCount.total,
                    products: productCount.total,
                    orders: orderCount.total,
                    pendingOrders: pendingOrders.total,
                    completedOrders: completedOrders.total,
                    lowStockProducts: lowStock.total,
                    revenue: revenue.totalRevenue
                }
            }
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};

// =====================================================
// Monthly Sales
// =====================================================

exports.monthlySales = async (req, res) => {

    try {

        const [sales] = await db.query(

            `
            SELECT

                DATE_FORMAT(created_at,'%Y-%m') AS month,

                COUNT(id) AS totalOrders,

                SUM(total_amount) AS totalSales

            FROM orders

            GROUP BY DATE_FORMAT(created_at,'%Y-%m')

            ORDER BY month DESC

            LIMIT 12
            `

        );

        return successResponse(

            res,

            "Monthly sales fetched successfully.",

            {

                sales

            }

        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(

            res,

            error.message

        );

    }

};
// =====================================================
// Get All Orders
// =====================================================

exports.getAllOrders = async (req, res) => {

    try {

        const [orders] = await db.query(

            `
            SELECT

                o.id,
                o.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
                c.email,
                c.phone,

                o.total_amount,
                o.order_status,
                o.payment_method,
                o.payment_status,
                o.shipping_address,
                o.coupon_code,
                o.discount_amount,
                o.created_at

            FROM orders o

            LEFT JOIN customers c
                ON o.customer_id = c.id

            ORDER BY o.id DESC
            `

        );

        return successResponse(

            res,

            "Orders fetched successfully.",

            {

                total: orders.length,
                orders

            }

        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(

            res,

            error.message

        );

    }

};

// =====================================================
// Update Order Status
// =====================================================

exports.updateOrderStatus = async (req, res) => {

    try {

        const { id } = req.params;

        const { order_status } = req.body;

        if (!order_status) {

            return errorResponse(

                res,

                "Order status is required.",

                400

            );

        }

        const [orders] = await db.query(

            `
            SELECT *
            FROM orders
            WHERE id = ?
            `,

            [id]

        );

        if (orders.length === 0) {

            return errorResponse(

                res,

                "Order not found.",

                404

            );

        }

        await db.query(

            `
            UPDATE orders
            SET
                order_status = ?
            WHERE id = ?
            `,

            [

                order_status,
                id

            ]

        );

        // When an order is completed,
        // reduce inventory and award points

        if (order_status.toLowerCase() === "completed") {

            try {

                await reduceStock(id);

            } catch (err) {

                logger.error(
                    `Inventory Error: ${err.message}`
                );

            }

            try {

                await processOrderRewards(id);

            } catch (err) {

                logger.error(
                    `Reward Error: ${err.message}`
                );

            }

        }

        logger.info(

            `Order ${id} updated to ${order_status}`

        );

        return successResponse(

            res,

            "Order status updated successfully."

        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(

            res,

            error.message

        );

    }

};
// =====================================================
// Get Logged-in Admin Profile
// =====================================================

exports.getProfile = async (req, res) => {

    try {

        const adminId = req.admin.id;

        const [admins] = await db.query(

            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                profile_image,
                created_at,
                updated_at
            FROM admins
            WHERE id = ?
            `,

            [adminId]

        );

        if (admins.length === 0) {

            return errorResponse(
                res,
                "Admin not found.",
                404
            );

        }

        return successResponse(
            res,
            "Profile fetched successfully.",
            {
                admin: admins[0]
            }
        );

    } catch (error) {

        logger.error(error.stack || error.message);

        return errorResponse(
            res,
            error.message
        );

    }

};

// =====================================================
// Controller Loaded
// =====================================================

logger.info("✅ adminController loaded successfully.");