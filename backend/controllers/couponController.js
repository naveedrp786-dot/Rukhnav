const db = require("../config/db");

// ==========================
// Create Coupon
// ==========================
exports.createCoupon = async (req, res) => {

    try {

        const {
            code,
            discount_type,
            discount_value,
            minimum_order,
            usage_limit,
            expiry_date
        } = req.body;

        // Validation
        if (
            !code ||
            !discount_type ||
            !discount_value ||
            !expiry_date
        ) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing."
            });
        }

        if (!["percentage", "fixed"].includes(discount_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discount type."
            });
        }

        // Check duplicate code
        const [existing] = await db.query(
            "SELECT id FROM coupons WHERE code = ?",
            [code]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Coupon code already exists."
            });
        }

        const [result] = await db.query(

            `INSERT INTO coupons
            (
                code,
                discount_type,
                discount_value,
                minimum_order,
                usage_limit,
                expiry_date
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                code.toUpperCase(),
                discount_type,
                discount_value,
                minimum_order || 0,
                usage_limit || null,
                expiry_date
            ]

        );

        res.status(201).json({
            success: true,
            message: "Coupon created successfully.",
            couponId: result.insertId
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
// Get All Coupons
// ==========================
exports.getCoupons = async (req, res) => {

    try {

        const [coupons] = await db.query(

            `SELECT *
             FROM coupons
             ORDER BY created_at DESC`

        );

        res.json({
            success: true,
            totalCoupons: coupons.length,
            coupons
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
// Update Coupon
// ==========================
exports.updateCoupon = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            code,
            discount_type,
            discount_value,
            minimum_order,
            usage_limit,
            expiry_date,
            status
        } = req.body;

        // Check coupon exists
        const [coupon] = await db.query(
            "SELECT id FROM coupons WHERE id = ?",
            [id]
        );

        if (coupon.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found."
            });
        }

        await db.query(

            `UPDATE coupons
             SET code = ?,
                 discount_type = ?,
                 discount_value = ?,
                 minimum_order = ?,
                 usage_limit = ?,
                 expiry_date = ?,
                 status = ?
             WHERE id = ?`,

            [
                code.toUpperCase(),
                discount_type,
                discount_value,
                minimum_order,
                usage_limit,
                expiry_date,
                status,
                id
            ]

        );

        res.json({
            success: true,
            message: "Coupon updated successfully."
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
// Delete Coupon
// ==========================
exports.deleteCoupon = async (req, res) => {

    try {

        const { id } = req.params;

        // Check coupon exists
        const [coupon] = await db.query(
            "SELECT id FROM coupons WHERE id = ?",
            [id]
        );

        if (coupon.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found."
            });
        }

        await db.query(
            "DELETE FROM coupons WHERE id = ?",
            [id]
        );

        res.json({
            success: true,
            message: "Coupon deleted successfully."
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
// Apply Coupon
// ==========================
exports.applyCoupon = async (req, res) => {

    try {

        const { code, orderTotal } = req.body;

        if (!code || !orderTotal) {
            return res.status(400).json({
                success: false,
                message: "Coupon code and order total are required."
            });
        }

        const [coupon] = await db.query(

            `SELECT *
             FROM coupons
             WHERE code = ?
             AND status = 'active'`,

            [code.toUpperCase()]

        );

        if (coupon.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Invalid coupon."
            });
        }

        const c = coupon[0];

        // Expiry Check
        if (new Date(c.expiry_date) < new Date()) {

            return res.status(400).json({
                success: false,
                message: "Coupon has expired."
            });

        }

        // Minimum Order
        if (Number(orderTotal) < Number(c.minimum_order)) {

            return res.status(400).json({
                success: false,
                message: `Minimum order should be Rs. ${c.minimum_order}`
            });

        }

        // Usage Limit
        if (
            c.usage_limit !== null &&
            c.used_count >= c.usage_limit
        ) {

            return res.status(400).json({
                success: false,
                message: "Coupon usage limit reached."
            });

        }

        let discount = 0;

        if (c.discount_type === "percentage") {

            discount =
                Number(orderTotal) *
                Number(c.discount_value) / 100;

        } else {

            discount = Number(c.discount_value);

        }

        const finalAmount =
            Number(orderTotal) - discount;

        return res.json({

            success: true,

            coupon: c.code,

            discount,

            finalAmount

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};