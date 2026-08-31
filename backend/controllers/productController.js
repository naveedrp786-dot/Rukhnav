const db = require("../config/db");


// ==========================
// Get Products
// ==========================
exports.getProducts = async (req, res) => {

    try {

        const {
            search,
            category,
            minPrice,
            maxPrice,
            sort,
            page = 1,
            limit = 10
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        let sql = `
        SELECT

    p.id,
    p.product_name,
    p.category,
    p.brand,
    p.description,
    p.ingredients,
    p.directions,
    p.warnings,
    p.selling_price,
    p.cost_price,
    p.discount_price,

    COALESCE(
        (
            SELECT image_url
            FROM product_images
            WHERE product_id = p.id
            ORDER BY sort_order
            LIMIT 1
        ),
        p.image
    ) AS image,

    p.status,
    p.is_featured,
    p.stock_quantity,
    p.low_stock_level,
    p.unit,
    p.weight,
    p.manufacturing_date,
    p.expiry_date,
    p.shelf_life,
    p.batch_number,
    p.sku,
    p.stock_status,
    p.created_at,
    p.updated_at,

            IFNULL(ROUND(AVG(r.rating),1),0) AS averageRating,

            COUNT(r.id) AS totalReviews

        FROM products p

        LEFT JOIN reviews r
        ON p.id = r.product_id
        `;

        let countSql = `
        SELECT COUNT(*) AS total
        FROM products p
        `;

        let conditions = [];
        let values = [];
        // Show only active products on normal Products page
conditions.push("p.status != 'Inactive'");

        // Search
        if (search) {

            conditions.push("p.product_name LIKE ?");

            values.push(`%${search}%`);

        }

        // Category
        if (category) {

            conditions.push("p.category = ?");

            values.push(category);

        }

        // Minimum Price
        if (minPrice) {

            conditions.push("p.selling_price >= ?");

            values.push(Number(minPrice));

        }

        // Maximum Price
        if (maxPrice) {

            conditions.push("p.selling_price <= ?");

            values.push(Number(maxPrice));

        }

        // WHERE
        if (conditions.length > 0) {

            const whereClause = " WHERE " + conditions.join(" AND ");

            sql += whereClause;

            countSql += whereClause;

        }

        sql += `
        GROUP BY p.id
        `;

        // Sorting
        switch (sort) {

            case "price_asc":
                sql += " ORDER BY p.selling_price ASC";
                break;

            case "price_desc":
                sql += " ORDER BY p.selling_price DESC";
                break;

            case "oldest":
                sql += " ORDER BY p.id ASC";
                break;

            default:
                sql += " ORDER BY p.id DESC";

        }

        // Pagination
        sql += " LIMIT ? OFFSET ?";

        const queryValues = [

            ...values,

            Number(limit),

            Number(offset)

        ];

        // Products
        const [products] = await db.query(
            sql,
            queryValues
        );

        // Total Count
        const [[totalResult]] = await db.query(
            countSql,
            values
        );

        const totalProducts = totalResult.total;

        const totalPages = Math.ceil(
            totalProducts / Number(limit)
        );

        return res.json({

            success: true,

            currentPage: Number(page),

            totalPages,

            totalProducts,

            products

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
// Get Product By ID
// ==========================
exports.getProductById = async (req, res) => {
    try {

        const { id } = req.params;

        const [product] = await db.query(
            "SELECT * FROM products WHERE id = ?",
            [id]
        );

        if (product.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.json({
            success: true,
            product: product[0]
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
// ==========================
// Add Product
// ==========================
exports.addProduct = async (req, res) => {

    try {

        const {
            product_name,
            sku,
            category,
            description,
            selling_price,
            stock_quantity,
            status
        } = req.body;

        const [result] = await db.query(

            `INSERT INTO products
            (
                product_name,
                sku,
                category,
                description,
                selling_price,
                stock_quantity,
                status
            )
            VALUES (?,?,?,?,?,?,?)`,

            [
                product_name,
                sku,
                category,
                description,
                selling_price,
                stock_quantity,
                status
            ]

        );

        const productId = result.insertId;

        if (req.files && req.files.length > 0) {

            for (const file of req.files) {

                await db.query(

    `INSERT INTO product_images
    (product_id,image_url)
    VALUES (?,?)`,

    [
        productId,
        file.filename
    ]

);

            }

        }

        res.json({

            success: true,

            message: "Product created successfully."

        });

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};

// ==========================
// Update Product
// ==========================
exports.updateProduct = async (req, res) => {

    try {

        console.log("========== UPDATE PRODUCT ==========");
        console.log("BODY:", req.body);
        console.log("FILES:", req.files);

        const { id } = req.params;

        const {
            product_name,
            sku,
            category,
            description,
            selling_price,
            stock_quantity,
            status
        } = req.body;

        const [existing] = await db.query(
            "SELECT image FROM products WHERE id=?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        let image = existing[0].image;

        if (req.files && req.files.length > 0) {
            image = req.files[0].filename;
        }

        console.log("IMAGE TO SAVE:", image);

        await db.query(
            `UPDATE products
             SET
                product_name=?,
                sku=?,
                category=?,
                description=?,
                selling_price=?,
                stock_quantity=?,
                image=?,
                status=?
             WHERE id=?`,
            [
                product_name,
                sku,
                category,
                description,
                selling_price,
                stock_quantity,
                image,
                status,
                id
            ]
        );
        const [check] = await db.query(
    "SELECT image FROM products WHERE id = ?",
    [id]
);

console.log("DATABASE IMAGE:", check[0].image);

        res.json({
            success: true,
            message: "Product updated successfully."
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
// Deactivate Product
// ==========================
exports.deleteProduct = async (req, res) => {

    try {

        const productId = Number(req.params.id);

        if (!productId) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });

        }

        const [result] = await db.query(
            `
            UPDATE products
            SET status = 'Inactive'
            WHERE id = ?
            `,
            [productId]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }

        return res.json({
            success: true,
            message: "Product moved to Inactive Products."
        });

    } catch (error) {

        console.error("Deactivate Product Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ==========================
// Get Inactive Products
// ==========================
exports.getInactiveProducts = async (req, res) => {

    try {

        const [products] = await db.query(
            `
            SELECT
                id,
                product_name,
                sku,
                category,
                selling_price,
                stock_quantity,
                stock_status,
                status,
                image,
                created_at
            FROM products
            WHERE status = 'Inactive'
            ORDER BY id DESC
            `
        );

        return res.json({
            success: true,
            products
        });

    } catch (error) {

        console.error("Get Inactive Products Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ==========================
// Restore Product
// ==========================
exports.restoreProduct = async (req, res) => {

    try {

        const productId = Number(req.params.id);

        const [result] = await db.query(
            `
            UPDATE products
            SET status = 'Active'
            WHERE id = ?
            `,
            [productId]
        );

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }

        return res.json({
            success: true,
            message: "Product restored successfully."
        });

    } catch (error) {

        console.error("Restore Product Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


// ==========================
// Permanently Delete Product
// ==========================
exports.permanentDeleteProduct = async (req, res) => {

    try {

        const productId = Number(req.params.id);

        if (!productId) {

            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });

        }

        const [product] = await db.query(
            `
            SELECT id, product_name
            FROM products
            WHERE id = ?
            `,
            [productId]
        );

        if (product.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Product not found."
            });

        }

        await db.query(
            `
            DELETE FROM products
            WHERE id = ?
            `,
            [productId]
        );

        return res.json({
            success: true,
            message: "Product permanently deleted."
        });

    } catch (error) {

        console.error("Permanent Delete Product Error:", error);

        if (
            error.code === "ER_ROW_IS_REFERENCED_2" ||
            error.errno === 1451
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "This product has transaction history and cannot be permanently deleted. Restore it or keep it inactive."
            });

        }

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};

// ==========================
// Top Rated Products
// ==========================
exports.getTopRatedProducts = async (req, res) => {

    try {

        const [products] = await db.query(

            `SELECT
                p.*,

                IFNULL(ROUND(AVG(r.rating),1),0) AS averageRating,

                COUNT(r.id) AS totalReviews

            FROM products p

            LEFT JOIN reviews r
            ON p.id = r.product_id

            GROUP BY p.id

            ORDER BY averageRating DESC,
                     totalReviews DESC

            LIMIT 10`

        );

        return res.json({
            success: true,
            totalProducts: products.length,
            products
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
// Best Selling Products
// ==========================
exports.getBestSellingProducts = async (req, res) => {

    try {

        const [products] = await db.query(

            `SELECT
                p.*,

                IFNULL(SUM(oi.quantity), 0) AS totalSold

            FROM products p

            LEFT JOIN order_items oi
            ON p.id = oi.product_id

            GROUP BY p.id

            ORDER BY totalSold DESC

            LIMIT 10`

        );

        return res.json({
            success: true,
            totalProducts: products.length,
            products
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
// Latest Products
// ==========================
exports.getLatestProducts = async (req, res) => {

    try {

        const [products] = await db.query(

            `SELECT
                p.*,

                IFNULL(ROUND(AVG(r.rating),1),0) AS averageRating,

                COUNT(r.id) AS totalReviews

            FROM products p

            LEFT JOIN reviews r
            ON p.id = r.product_id

            GROUP BY p.id

            ORDER BY p.id DESC

            LIMIT 10`

        );

        return res.json({
            success: true,
            totalProducts: products.length,
            products
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
// Featured Products
// ==========================
exports.getFeaturedProducts = async (req, res) => {

    try {

        const [products] = await db.query(

            `SELECT
                p.*,

                IFNULL(ROUND(AVG(r.rating),1),0) AS averageRating,

                COUNT(r.id) AS totalReviews

            FROM products p

            LEFT JOIN reviews r
            ON p.id = r.product_id

            WHERE p.is_featured = 1

            GROUP BY p.id

            ORDER BY p.id DESC`

        );

        res.json({
            success: true,
            totalProducts: products.length,
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