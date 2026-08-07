const db = require("../config/db");

// ======================================
// Get Products
// ======================================
exports.getProducts = async (req, res) => {

    try {

        const [products] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                stock_quantity
            FROM products
            ORDER BY product_name ASC
        `);

        res.json({
            success: true,
            products
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ======================================
// Get Suppliers
// ======================================
exports.getSuppliers = async (req, res) => {

    try {

        const [suppliers] = await db.query(`
            SELECT
                id,
                supplier_name
            FROM suppliers
            ORDER BY supplier_name ASC
        `);

        res.json({
            success: true,
            suppliers
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ======================================
// Stock In
// ======================================
exports.stockIn = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            product_id,
            supplier_id,
            quantity,
            cost_price,
            reference,
            remarks
        } = req.body;

        if (
            !product_id ||
            !quantity
        ) {

            return res.status(400).json({
                success: false,
                message: "Product and Quantity are required."
            });

        }

        // Get Current Stock

        const [[product]] = await connection.query(

            `SELECT
                stock_quantity
             FROM products
             WHERE id=?`,

            [product_id]

        );

        if (!product) {

            return res.status(404).json({

                success: false,

                message: "Product not found."

            });

        }

        const previousStock = Number(product.stock_quantity);

        const qty = Number(quantity);

        const newStock = previousStock + qty;

        // Stock Status

        let stockStatus = "In Stock";

        if (newStock <= 0) {

            stockStatus = "Out of Stock";

        } else if (newStock <= 10) {

            stockStatus = "Low Stock";

        }

        // Update Product

        await connection.query(

            `UPDATE products
             SET
                stock_quantity=?,
                cost_price=?,
                stock_status=?
             WHERE id=?`,

            [
                newStock,
                cost_price || 0,
                stockStatus,
                product_id
            ]

        );

        // Save Transaction

        await connection.query(

            `INSERT INTO inventory_transactions
            (
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
            VALUES
            (
                ?,?,?,?,?,?,?,?,?,?
            )`,

            [
                product_id,
                "Stock In",
                qty,
                previousStock,
                newStock,
                cost_price || 0,
                supplier_id || null,
                reference || null,
                remarks || null,
                req.admin.id
            ]

        );

        await connection.commit();

        res.json({

            success: true,

            message: "Stock added successfully.",

            previousStock,

            newStock

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