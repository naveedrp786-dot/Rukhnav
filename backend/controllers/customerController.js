exports.login = async (req, res) => {

    console.log("Login API called");

    const { email, password } = req.body;

    console.log(email);

    // rest of your code...
}

const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET_KEY = "rukhnav_secret_key";

exports.register = async (req, res) => {

    try {

        const {
    first_name,
    last_name,
    email,
    phone,
    password
} = req.body;

        // Check if email already exists
        const [existingUser] = await db.query(
            "SELECT id FROM customers WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
        INSERT INTO customers
        (full_name,email,phone,password,address)
        VALUES (?,?,?,?,?)
        `;

        const [result] = await db.query(
    sql,
    [
        full_name,
        email,
        phone,
        hashedPassword,
        address
    ]
);

res.json({
    success: true,
    message: "Registration Successful"
});

    } catch (error) {

        res.status(500).json(error);

    }

};

exports.login = async (req, res) => {
    try {
        console.log("✅ Login API called");

        const { email, password } = req.body;

        const [result] = await db.query(
            "SELECT * FROM customers WHERE email = ?",
            [email]
        );

        if (result.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email not found"
            });
        }

        const customer = result[0];

        const match = await bcrypt.compare(password, customer.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Wrong password"
            });
        }

        const token = jwt.sign(
            {
                id: customer.id,
                email: customer.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "24h"
            }
        );

        return res.json({
            success: true,
            message: "Login Successful",
            token,
            customer: {
                id: customer.id,
                full_name: customer.full_name,
                email: customer.email
            }
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.profile = async (req, res) => {
    try {

        const [customer] = await db.query(
            `SELECT id,
                    full_name,
                    email,
                    phone,
                    address,
                    created_at
             FROM customers
             WHERE id = ?`,
            [req.user.id]
        );

        if (customer.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        res.json({
            success: true,
            customer: customer[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};