const db = require("../config/db");


// =======================================
// Create Stock Adjustment
// =======================================

exports.createStockAdjustment = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {

            product_id,
            adjustment_type,
            quantity,
            reason,
            remarks

        } = req.body;


        // Get logged-in admin ID from authentication middleware

        const adjustedBy = Number(

            req.admin?.id ||
            req.user?.id ||
            req.adminId ||
            0

        );


        const productId =
            Number(product_id);

        const adjustmentQuantity =
            Number(quantity);

        const adjustmentType =
            String(adjustment_type || "")
                .trim()
                .toUpperCase();


        // Validate required fields

        if (

            !productId ||
            !adjustmentType ||
            !adjustmentQuantity ||
            !reason

        ) {

            return res.status(400).json({

                success: false,
                message: "Required fields are missing."

            });

        }


        // Validate logged-in admin

        if (!adjustedBy) {

            return res.status(401).json({

                success: false,
                message: "Unable to identify the logged-in admin."

            });

        }


        // Validate adjustment type

        if (

            adjustmentType !== "IN" &&
            adjustmentType !== "OUT"

        ) {

            return res.status(400).json({

                success: false,
                message: "Invalid adjustment type."

            });

        }


        // Validate quantity

        if (

            !Number.isInteger(adjustmentQuantity) ||
            adjustmentQuantity <= 0

        ) {

            return res.status(400).json({

                success: false,
                message: "Quantity must be a whole number greater than zero."

            });

        }


        await connection.beginTransaction();


        // Check product and lock stock row

        const [productRows] =
    await connection.query(
        `
        SELECT
            id,
            product_name,
            stock_quantity
        FROM products
        WHERE id = ?
        FOR UPDATE
        `,
        [productId]
    );


        if (productRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({

                success: false,
                message: "Product not found."

            });

        }


        const currentStock =
    Number(productRows[0].stock_quantity || 0);


        // Prevent negative stock

        if (

            adjustmentType === "OUT" &&
            adjustmentQuantity > currentStock

        ) {

            await connection.rollback();

            return res.status(400).json({

                success: false,
                message: "Insufficient stock."

            });

        }


        // Generate adjustment number

        const adjustmentNumber =

            "SA-" +
            Date.now();


        // Save stock adjustment

        const [result] =
            await connection.query(

                `
                INSERT INTO stock_adjustments
                (
                    adjustment_number,
                    product_id,
                    adjustment_type,
                    quantity,
                    reason,
                    remarks,
                    adjusted_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,

                [

                    adjustmentNumber,
                    productId,
                    adjustmentType,
                    adjustmentQuantity,
                    String(reason).trim(),
                    String(remarks || "").trim(),
                    adjustedBy

                ]

            );


        // Update product stock

if (adjustmentType === "IN") {

    await connection.query(

        `
        UPDATE products
        SET stock_quantity = stock_quantity + ?
        WHERE id = ?
        `,

        [
            adjustmentQuantity,
            productId
        ]

    );

} else {

    await connection.query(

        `
        UPDATE products
        SET stock_quantity = stock_quantity - ?
        WHERE id = ?
        `,

        [
            adjustmentQuantity,
            productId
        ]

    );

}


// Update Stock Status

await connection.query(

    `
    UPDATE products
    SET stock_status =
        CASE
            WHEN stock_quantity <= 0 THEN 'Out of Stock'
            WHEN stock_quantity <= low_stock_level THEN 'Low Stock'
            ELSE 'In Stock'
        END
    WHERE id = ?
    `,

    [productId]

);


// Commit Transaction

await connection.commit();

        return res.status(201).json({

            success: true,
            message: "Stock adjusted successfully.",
            adjustmentId: result.insertId,
            adjustmentNumber: adjustmentNumber

        });


    } catch (err) {

        await connection.rollback();

        console.error(
            "Create Stock Adjustment Error:",
            err
        );

        return res.status(500).json({

            success: false,
            message: err.message

        });


    } finally {

        connection.release();

    }

};

// =======================================
// Get All Stock Adjustments
// =======================================

exports.getStockAdjustments = async (req, res) => {

    try {

        const [rows] = await db.query(

            `
            SELECT

                sa.id,
                sa.adjustment_number,
                sa.product_id,

                p.product_name,

                sa.adjustment_type,
                sa.quantity,
                sa.reason,
                sa.remarks,
                sa.adjusted_by,

                CONCAT(
                    a.first_name,
                    ' ',
                    a.last_name
                ) AS adjusted_by_name,

                sa.created_at

            FROM stock_adjustments sa

            JOIN products p
                ON sa.product_id = p.id

            LEFT JOIN admins a
                ON sa.adjusted_by = a.id

            ORDER BY sa.id DESC
            `

        );


        return res.json({

            success: true,
            adjustments: rows

        });


    } catch (err) {

        console.error(
            "Get Stock Adjustments Error:",
            err
        );

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};


// =======================================
// Get Single Stock Adjustment
// =======================================

exports.getStockAdjustmentById = async (req, res) => {

    try {

        const adjustmentId =
            Number(req.params.id);


        if (!adjustmentId) {

            return res.status(400).json({

                success: false,
                message: "Invalid stock adjustment ID."

            });

        }


        const [rows] = await db.query(

            `
            SELECT

                sa.id,
                sa.adjustment_number,
                sa.product_id,

                p.product_name,

                sa.adjustment_type,
                sa.quantity,
                sa.reason,
                sa.remarks,
                sa.adjusted_by,

                CONCAT(
                    a.first_name,
                    ' ',
                    a.last_name
                ) AS adjusted_by_name,

                sa.created_at

            FROM stock_adjustments sa

            JOIN products p
                ON sa.product_id = p.id

            LEFT JOIN admins a
                ON sa.adjusted_by = a.id

            WHERE sa.id = ?
            `,

            [adjustmentId]

        );


        if (rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Stock adjustment not found."

            });

        }


        return res.json({

            success: true,
            adjustment: rows[0]

        });


    } catch (err) {

        console.error(
            "Get Stock Adjustment By ID Error:",
            err
        );

        return res.status(500).json({

            success: false,
            message: err.message

        });

    }

};