const db = require("../config/db");

// ==========================
// Get All Products
// ==========================
// ==========================
// Get Products
// ==========================
exports.getProducts = async (req, res) => {

    try {

        // Query Parameters
        const {
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    limit = 10
} = req.query;

        const offset = (page - 1) * limit;

        let sql = `
SELECT
    p.*,

    IFNULL(ROUND(AVG(r.rating),1),0) AS averageRating,

    COUNT(r.id) AS totalReviews

FROM products p

LEFT JOIN reviews r
ON p.id = r.product_id
`;
        let countSql = "SELECT COUNT(*) AS total FROM products";

        let conditions = [];
        let values = [];

        // Search by Product Name
        // Search by Product Name
if (search) {
    conditions.push("p.product_name LIKE ?");
    values.push(`%${search}%`);
}

// Filter by Category
if (category) {
    conditions.push("p.category = ?");
    values.push(category);
}

// Filter by Minimum Price
if (minPrice) {
    conditions.push("p.price >= ?");
    values.push(Number(minPrice));
}

// Filter by Maximum Price
if (maxPrice) {
    conditions.push("p.price <= ?");
    values.push(Number(maxPrice));
}

        // Apply WHERE clause
        if (conditions.length > 0) {

    sql += " WHERE " + conditions.join(" AND ");
    countSql += " WHERE " + conditions.join(" AND ");

}

sql += " GROUP BY p.id";

        // Order & Pagination
        // Sorting
if (sort === "price_asc") {

    sql += " ORDER BY price ASC";

} else if (sort === "price_desc") {

    sql += " ORDER BY price DESC";

} else if (sort === "oldest") {

    sql += " ORDER BY id ASC";

} else {

    // Default & newest
    sql += " ORDER BY id DESC";

}

// Pagination
sql += " LIMIT ? OFFSET ?";

        const queryValues = [...values, Number(limit), Number(offset)];

        // Get Products
        const [products] = await db.query(
            sql,
            queryValues
        );

        // Get Total Products
        const [[totalResult]] = await db.query(
            countSql,
            values
        );

        const totalProducts = totalResult.total;
        const totalPages = Math.ceil(totalProducts / limit);

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
// Add Product
// ==========================
exports.addProduct = async (req, res) => {
    try {

        const {
            product_name,
            category,
            description,
            price,
            stock,
            status
        } = req.body;

        const image = req.file
            ? `/uploads/products/${req.file.filename}`
            : null;

        if (!product_name || !price) {
            return res.status(400).json({
                success: false,
                message: "Product name and price are required."
            });
        }

        const [result] = await db.query(
            `INSERT INTO products
            (product_name, category, description, price, stock, image, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                product_name,
                category,
                description,
                price,
                stock,
                image,
                status || "active"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Product added successfully",
            productId: result.insertId,
            image
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
// Update Product
// ==========================
exports.updateProduct = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            product_name,
            category,
            description,
            price,
            stock,
            status
        } = req.body;

        let image = null;

        if (req.file) {
            image = `/uploads/products/${req.file.filename}`;
        } else {

            const [oldProduct] = await db.query(
                "SELECT image FROM products WHERE id=?",
                [id]
            );

            if (oldProduct.length > 0) {
                image = oldProduct[0].image;
            }
        }

        const [result] = await db.query(
            `UPDATE products
             SET
                product_name=?,
                category=?,
                description=?,
                price=?,
                stock=?,
                image=?,
                status=?
             WHERE id=?`,
            [
                product_name,
                category,
                description,
                price,
                stock,
                image,
                status,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            message: "Product updated successfully"
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
// Delete Product
// ==========================
exports.deleteProduct = async (req, res) => {
    try {

        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM products WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.json({
            success: true,
            message: "Product deleted successfully"
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