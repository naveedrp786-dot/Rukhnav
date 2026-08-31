const db = require("../config/db");

// ==========================
// Add Customer Address
// ==========================
exports.addAddress = async (req, res) => {

    try {

        const customerId = req.user.id;

        const {
            full_name,
            phone,
            address_line1,
            address_line2,
            city,
            province,
            postal_code,
            country,
            address_type
        } = req.body;

        await db.query(
            `
            INSERT INTO customer_addresses
            (
                customer_id,
                full_name,
                phone,
                address_line1,
                address_line2,
                city,
                province,
                postal_code,
                country,
                address_type
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                customerId,
                full_name,
                phone,
                address_line1,
                address_line2,
                city,
                province,
                postal_code,
                country,
                address_type
            ]
        );

        res.status(201).json({
            success: true,
            message: "Address added successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================
// Get Customer Addresses
// ==========================
exports.getAddresses = async (req, res) => {

    try {

        const customerId = req.user.id;

        const [addresses] = await db.query(
            `
            SELECT *
            FROM customer_addresses
            WHERE customer_id = ?
            ORDER BY is_default DESC, id DESC
            `,
            [customerId]
        );

        res.json({
            success: true,
            addresses
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};