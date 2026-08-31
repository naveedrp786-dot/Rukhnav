"use strict";

const db = require("../config/db");

// =========================================
// Helpers
// =========================================

function getAdminId(req) {
    return (
        req.admin?.id ||
        req.admin?.adminId ||
        req.admin?.admin_id ||
        null
    );
}

function getStockStatus(stockQuantity, lowStockLevel) {
    const stock = Number(stockQuantity || 0);
    const lowLevel = Number(lowStockLevel || 0);

    if (stock <= 0) {
        return "Out of Stock";
    }

    if (stock <= lowLevel) {
        return "Low Stock";
    }

    return "In Stock";
}

function getPositiveInteger(value, fallback) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
        return fallback;
    }

    return number;
}

// =========================================
// Inventory Dashboard
// GET /api/inventory/dashboard
// =========================================

exports.getInventoryDashboard = async (req, res) => {
    try {
        const [[productSummary]] = await db.query(`
            SELECT
                COUNT(*) AS total_products,

                COALESCE(
                    SUM(stock_quantity),
                    0
                ) AS total_stock,

                COALESCE(
                    SUM(cost_price * stock_quantity),
                    0
                ) AS inventory_cost_value,

                COALESCE(
                    SUM(selling_price * stock_quantity),
                    0
                ) AS inventory_selling_value,

                COALESCE(
                    SUM(
                        (selling_price - cost_price)
                        * stock_quantity
                    ),
                    0
                ) AS expected_profit,

                COUNT(
                    CASE
                        WHEN stock_quantity > 0
                        AND stock_quantity <= low_stock_level
                        THEN 1
                    END
                ) AS low_stock_products,

                COUNT(
                    CASE
                        WHEN stock_quantity <= 0
                        THEN 1
                    END
                ) AS out_of_stock_products

            FROM products
        `);

        const [[todaySummary]] = await db.query(`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'Stock In'
                            THEN quantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS stock_in_today,

                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'Stock Out'
                            THEN quantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS stock_out_today,

                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'Adjustment'
                            AND new_stock > previous_stock
                            THEN new_stock - previous_stock
                            ELSE 0
                        END
                    ),
                    0
                ) AS adjustment_in_today,

                COALESCE(
                    SUM(
                        CASE
                            WHEN transaction_type = 'Adjustment'
                            AND new_stock < previous_stock
                            THEN previous_stock - new_stock
                            ELSE 0
                        END
                    ),
                    0
                ) AS adjustment_out_today

            FROM inventory_transactions

            WHERE DATE(created_at) = CURDATE()
        `);

        const [recentTransactions] = await db.query(`
            SELECT
                it.id,
                it.product_id,
                p.product_name,
                p.sku,
                it.transaction_type,
                it.quantity,
                it.previous_stock,
                it.new_stock,
                it.cost_price,
                it.supplier_id,
                s.supplier_name,
                it.reference,
                it.remarks,
                it.created_by,
                it.created_at

            FROM inventory_transactions it

            INNER JOIN products p
                ON p.id = it.product_id

            LEFT JOIN suppliers s
                ON s.id = it.supplier_id


            ORDER BY
                it.created_at DESC,
                it.id DESC

            LIMIT 10
        `);

        res.json({
            success: true,

            dashboard: {
                totalProducts:
                    Number(productSummary.total_products || 0),

                totalStock:
                    Number(productSummary.total_stock || 0),

                inventoryCostValue:
                    Number(
                        productSummary.inventory_cost_value || 0
                    ),

                inventorySellingValue:
                    Number(
                        productSummary.inventory_selling_value || 0
                    ),

                expectedProfit:
                    Number(productSummary.expected_profit || 0),

                lowStockProducts:
                    Number(
                        productSummary.low_stock_products || 0
                    ),

                outOfStockProducts:
                    Number(
                        productSummary.out_of_stock_products || 0
                    ),

                stockInToday:
                    Number(todaySummary.stock_in_today || 0),

                stockOutToday:
                    Number(todaySummary.stock_out_today || 0),

                adjustmentInToday:
                    Number(todaySummary.adjustment_in_today || 0),

                adjustmentOutToday:
                    Number(todaySummary.adjustment_out_today || 0)
            },

            recentTransactions
        });

    } catch (error) {
        console.error(
            "Inventory dashboard error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load inventory dashboard.",
            error: error.message
        });
    }
};

// =========================================
// Inventory Ledger
// GET /api/inventory/ledger
// =========================================

exports.getInventoryLedger = async (req, res) => {
    try {
        const page =
            getPositiveInteger(req.query.page, 1);

        const limit =
            Math.min(
                getPositiveInteger(req.query.limit, 20),
                100
            );

        const offset = (page - 1) * limit;

        const productId =
            req.query.productId
                ? Number(req.query.productId)
                : null;

        const transactionType =
            req.query.transactionType?.trim() || null;

        const search =
            req.query.search?.trim() || "";

        const fromDate =
            req.query.fromDate?.trim() || null;

        const toDate =
            req.query.toDate?.trim() || null;

        const allowedTypes = [
            "Stock In",
            "Stock Out",
            "Adjustment"
        ];

        if (
            transactionType &&
            !allowedTypes.includes(transactionType)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction type."
            });
        }

        const conditions = [];
        const values = [];

        if (
            productId &&
            Number.isInteger(productId) &&
            productId > 0
        ) {
            conditions.push("it.product_id = ?");
            values.push(productId);
        }

        if (transactionType) {
            conditions.push(
                "it.transaction_type = ?"
            );
            values.push(transactionType);
        }

        if (search) {
            conditions.push(`
                (
                    p.product_name LIKE ?
                    OR p.sku LIKE ?
                    OR it.reference LIKE ?
                    OR it.remarks LIKE ?
                )
            `);

            const keyword = `%${search}%`;

            values.push(
                keyword,
                keyword,
                keyword,
                keyword
            );
        }

        if (fromDate) {
            conditions.push(
                "DATE(it.created_at) >= ?"
            );
            values.push(fromDate);
        }

        if (toDate) {
            conditions.push(
                "DATE(it.created_at) <= ?"
            );
            values.push(toDate);
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const [[countRow]] = await db.query(`
            SELECT
                COUNT(*) AS total

            FROM inventory_transactions it

            INNER JOIN products p
                ON p.id = it.product_id

            ${whereClause}
        `, values);

        const [transactions] = await db.query(`
            SELECT
                it.id,
                it.product_id,
                p.product_name,
                p.sku,
                it.transaction_type,
                it.quantity,
                it.previous_stock,
                it.new_stock,
                it.cost_price,
                it.supplier_id,
                s.supplier_name,
                it.reference,
                it.remarks,
                it.created_by,
               
                it.created_at

            FROM inventory_transactions it

            INNER JOIN products p
                ON p.id = it.product_id

            LEFT JOIN suppliers s
                ON s.id = it.supplier_id

            ${whereClause}

            ORDER BY
                it.created_at DESC,
                it.id DESC

            LIMIT ?
            OFFSET ?
        `, [
            ...values,
            limit,
            offset
        ]);

        const total =
            Number(countRow.total || 0);

        res.json({
            success: true,
            transactions,

            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(total / limit)
            },

            filters: {
                productId,
                transactionType,
                search,
                fromDate,
                toDate
            }
        });

    } catch (error) {
        console.error(
            "Inventory ledger error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to load inventory ledger.",
            error: error.message
        });
    }
};

// =========================================
// Product Inventory History
// GET /api/inventory/product/:id
// =========================================

exports.getProductInventoryHistory = async (
    req,
    res
) => {
    try {
        const productId = Number(req.params.id);

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid product ID is required."
            });
        }

        const [productRows] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                cost_price,
                selling_price,
                stock_quantity,
                low_stock_level,
                stock_status,
                status

            FROM products

            WHERE id = ?
        `, [productId]);

        if (productRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const page =
            getPositiveInteger(req.query.page, 1);

        const limit =
            Math.min(
                getPositiveInteger(req.query.limit, 20),
                100
            );

        const offset = (page - 1) * limit;

        const [[countRow]] = await db.query(`
            SELECT
                COUNT(*) AS total

            FROM inventory_transactions

            WHERE product_id = ?
        `, [productId]);

        const [transactions] = await db.query(`
            SELECT
                it.id,
                it.transaction_type,
                it.quantity,
                it.previous_stock,
                it.new_stock,
                it.cost_price,
                it.supplier_id,
                s.supplier_name,
                it.reference,
                it.remarks,
                it.created_by,
                
                it.created_at

            FROM inventory_transactions it

            LEFT JOIN suppliers s
                ON s.id = it.supplier_id

            

            WHERE it.product_id = ?

            ORDER BY
                it.created_at DESC,
                it.id DESC

            LIMIT ?
            OFFSET ?
        `, [
            productId,
            limit,
            offset
        ]);

        const total =
            Number(countRow.total || 0);

        res.json({
            success: true,
            product: productRows[0],
            transactions,

            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error(
            "Product inventory history error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load product inventory history.",
            error: error.message
        });
    }
};

// =========================================
// Adjust Product Stock
// POST /api/inventory/adjust/:id
// =========================================

exports.adjustStock = async (req, res) => {
    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const productId =
            Number(req.params.id);

        const {
            adjustment_type,
            quantity,
            reason,
            reference
        } = req.body;

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "A valid product ID is required."
            });
        }

        const adjustmentType =
            adjustment_type?.trim();

        if (
            !["Increase", "Decrease"]
                .includes(adjustmentType)
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Adjustment type must be Increase or Decrease."
            });
        }

        const adjustmentQuantity =
            Number(quantity);

        if (
            !Number.isInteger(adjustmentQuantity) ||
            adjustmentQuantity <= 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Adjustment quantity must be a positive whole number."
            });
        }

        if (!reason || !reason.trim()) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Adjustment reason is required."
            });
        }

        const [productRows] =
            await connection.query(`
                SELECT
                    id,
                    product_name,
                    sku,
                    cost_price,
                    stock_quantity,
                    low_stock_level,
                    stock_status

                FROM products

                WHERE id = ?

                FOR UPDATE
            `, [productId]);

        if (productRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const product =
            productRows[0];

        const previousStock =
            Number(product.stock_quantity || 0);

        let newStock = previousStock;

        if (adjustmentType === "Increase") {
            newStock =
                previousStock + adjustmentQuantity;
        }

        if (adjustmentType === "Decrease") {
            if (
                adjustmentQuantity >
                previousStock
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Cannot decrease stock by ${adjustmentQuantity}. Current stock is ${previousStock}.`
                });
            }

            newStock =
                previousStock - adjustmentQuantity;
        }

        const newStockStatus =
            getStockStatus(
                newStock,
                product.low_stock_level
            );

        await connection.query(`
            UPDATE products

            SET
                stock_quantity = ?,
                stock_status = ?,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = ?
        `, [
            newStock,
            newStockStatus,
            productId
        ]);

        const adminId =
            getAdminId(req);

        const transactionReference =
            reference?.trim() ||
            `ADJ-${Date.now()}`;

        const [transactionResult] =
            await connection.query(`
                INSERT INTO inventory_transactions (
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
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                productId,
                "Adjustment",
                adjustmentQuantity,
                previousStock,
                newStock,
                Number(product.cost_price || 0),
                null,
                transactionReference,
                `${adjustmentType}: ${reason.trim()}`,
                adminId
            ]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message:
                "Stock adjusted successfully.",

            adjustment: {
                transactionId:
                    transactionResult.insertId,

                productId,
                productName:
                    product.product_name,

                sku:
                    product.sku,

                adjustmentType,
                quantity:
                    adjustmentQuantity,

                previousStock,
                newStock,
                stockStatus:
                    newStockStatus,

                reference:
                    transactionReference,

                reason:
                    reason.trim()
            }
        });

    } catch (error) {
        await connection.rollback();

        console.error(
            "Stock adjustment error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to adjust stock.",
            error: error.message
        });

    } finally {
        connection.release();
    }
};

// =========================================
// Legacy Absolute Stock Update
// PUT /api/inventory/stock/:id
// Keeps old route working with audit trail
// =========================================

exports.updateStock = async (req, res) => {
    const connection =
        await db.getConnection();

    try {
        await connection.beginTransaction();

        const productId =
            Number(req.params.id);

        const requestedStock =
            Number(req.body.stock_quantity);

        const reason =
            req.body.reason?.trim() ||
            "Manual stock correction";

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "A valid product ID is required."
            });
        }

        if (
            !Number.isInteger(requestedStock) ||
            requestedStock < 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Stock quantity must be zero or a positive whole number."
            });
        }

        const [productRows] =
            await connection.query(`
                SELECT
                    id,
                    product_name,
                    sku,
                    cost_price,
                    stock_quantity,
                    low_stock_level

                FROM products

                WHERE id = ?

                FOR UPDATE
            `, [productId]);

        if (productRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const product =
            productRows[0];

        const previousStock =
            Number(product.stock_quantity || 0);

        if (requestedStock === previousStock) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "The new stock quantity is the same as the current stock."
            });
        }

        const difference =
            Math.abs(
                requestedStock - previousStock
            );

        const direction =
            requestedStock > previousStock
                ? "Increase"
                : "Decrease";

        const stockStatus =
            getStockStatus(
                requestedStock,
                product.low_stock_level
            );

        await connection.query(`
            UPDATE products

            SET
                stock_quantity = ?,
                stock_status = ?,
                updated_at = CURRENT_TIMESTAMP

            WHERE id = ?
        `, [
            requestedStock,
            stockStatus,
            productId
        ]);

        const transactionReference =
            req.body.reference?.trim() ||
            `MANUAL-${Date.now()}`;

        await connection.query(`
            INSERT INTO inventory_transactions (
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            productId,
            "Adjustment",
            difference,
            previousStock,
            requestedStock,
            Number(product.cost_price || 0),
            null,
            transactionReference,
            `${direction}: ${reason}`,
            getAdminId(req)
        ]);

        await connection.commit();

        res.json({
            success: true,
            message:
                "Stock updated successfully.",

            stock: {
                productId,
                productName:
                    product.product_name,

                previousStock,
                newStock:
                    requestedStock,

                difference,
                direction,
                stockStatus
            }
        });

    } catch (error) {
        await connection.rollback();

        console.error(
            "Stock update error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Unable to update stock.",
            error: error.message
        });

    } finally {
        connection.release();
    }
};

// =========================================
// Low Stock Products
// GET /api/inventory/low-stock
// =========================================

exports.getLowStockProducts = async (
    req,
    res
) => {
    try {
        const [products] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                cost_price,
                selling_price,
                stock_quantity,
                low_stock_level,
                stock_status,
                status

            FROM products

            WHERE stock_quantity > 0
            AND stock_quantity <= low_stock_level

            ORDER BY
                stock_quantity ASC,
                product_name ASC
        `);

        res.json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {
        console.error(
            "Low-stock products error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load low-stock products.",
            error: error.message
        });
    }
};

// =========================================
// Out-of-Stock Products
// GET /api/inventory/out-of-stock
// =========================================

exports.getOutOfStockProducts = async (
    req,
    res
) => {
    try {
        const [products] = await db.query(`
            SELECT
                id,
                product_name,
                sku,
                cost_price,
                selling_price,
                stock_quantity,
                low_stock_level,
                stock_status,
                status

            FROM products

            WHERE stock_quantity <= 0

            ORDER BY product_name ASC
        `);

        res.json({
            success: true,
            count: products.length,
            products
        });

    } catch (error) {
        console.error(
            "Out-of-stock products error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load out-of-stock products.",
            error: error.message
        });
    }
};

// =========================================
// Combined Inventory Alerts
// GET /api/inventory/alerts
// =========================================

exports.getInventoryAlerts = async (
    req,
    res
) => {
    try {
        const [lowStockProducts] =
            await db.query(`
                SELECT
                    id,
                    product_name,
                    sku,
                    stock_quantity,
                    low_stock_level,
                    stock_status,
                    status

                FROM products

                WHERE stock_quantity > 0
                AND stock_quantity <= low_stock_level

                ORDER BY stock_quantity ASC
            `);

        const [outOfStockProducts] =
            await db.query(`
                SELECT
                    id,
                    product_name,
                    sku,
                    stock_quantity,
                    low_stock_level,
                    stock_status,
                    status

                FROM products

                WHERE stock_quantity <= 0

                ORDER BY product_name ASC
            `);

        res.json({
            success: true,

            summary: {
                lowStock:
                    lowStockProducts.length,

                outOfStock:
                    outOfStockProducts.length,

                totalAlerts:
                    lowStockProducts.length +
                    outOfStockProducts.length
            },

            lowStockProducts,
            outOfStockProducts
        });

    } catch (error) {
        console.error(
            "Inventory alerts error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load inventory alerts.",
            error: error.message
        });
    }
};

// =========================================
// Recent Inventory Transactions
// GET /api/inventory/recent
// =========================================

exports.getRecentTransactions = async (
    req,
    res
) => {
    try {
        const limit =
            Math.min(
                getPositiveInteger(req.query.limit, 20),
                100
            );

        const [transactions] = await db.query(`
            SELECT
                it.id,
                it.product_id,
                p.product_name,
                p.sku,
                it.transaction_type,
                it.quantity,
                it.previous_stock,
                it.new_stock,
                it.cost_price,
                it.supplier_id,
                s.supplier_name,
                it.reference,
                it.remarks,
                it.created_by,
                
                it.created_at

            FROM inventory_transactions it

            INNER JOIN products p
                ON p.id = it.product_id

            LEFT JOIN suppliers s
                ON s.id = it.supplier_id

            

            ORDER BY
                it.created_at DESC,
                it.id DESC

            LIMIT ?
        `, [limit]);

        res.json({
            success: true,
            count: transactions.length,
            transactions
        });

    } catch (error) {
        console.error(
            "Recent inventory transactions error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load recent inventory transactions.",
            error: error.message
        });
    }
};