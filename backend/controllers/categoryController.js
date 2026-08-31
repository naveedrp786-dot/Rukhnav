const db = require("../config/db");

// ==========================================
// Get All Categories
// ==========================================

exports.getCategories = async (req, res) => {

    try {

        const [categories] = await db.query(
            `
            SELECT *
            FROM categories
            ORDER BY id DESC
            `
        );

        res.json({
            success: true,
            categories
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

// ==========================================
// Get Category By ID
// ==========================================

exports.getCategory = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM categories WHERE id=?",
            [req.params.id]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Category not found"
            });

        }

        res.json({
            success: true,
            category: rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

};

// ==========================================
// Add Category
// ==========================================

exports.createCategory = async (req, res) => {

    try {

        const {
            category_name,
            description,
            status
        } = req.body;

        const image = req.file
            ? req.file.filename
            : null;

        await db.query(
            `
            INSERT INTO categories
            (
                category_name,
                description,
                image,
                status
            )
            VALUES (?,?,?,?)
            `,
            [
                category_name,
                description,
                image,
                status || "active"
            ]
        );

        res.json({
            success: true,
            message: "Category created successfully."
        });

    } catch (err) {

    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {

        return res.status(409).json({
            success: false,
            message: "Category already exists."
        });

    }

    res.status(500).json({
        success: false,
        message: "Unable to create category."
    });

}

};

// ==========================================
// Update Category
// ==========================================

exports.updateCategory = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM categories WHERE id=?",
            [req.params.id]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Category not found"
            });

        }

        let image = rows[0].image;

        if (req.file) {

            image = req.file.filename;

        }

        const {
            category_name,
            description,
            status
        } = req.body;

        await db.query(
            `
            UPDATE categories
            SET
                category_name=?,
                description=?,
                image=?,
                status=?
            WHERE id=?
            `,
            [
                category_name,
                description,
                image,
                status,
                req.params.id
            ]
        );

        res.json({
            success: true,
            message: "Category updated successfully."
        });

    } catch (err) {

    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {

        return res.status(409).json({
            success: false,
            message: "Another category with this name already exists."
        });

    }

    res.status(500).json({
        success: false,
        message: "Unable to update category."
    });

}

};

// ==========================================
// Delete Category
// ==========================================

exports.deleteCategory = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM categories WHERE id=?",
            [req.params.id]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Category not found."
            });

        }

        await db.query(
            "DELETE FROM categories WHERE id=?",
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Category deleted successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: "Unable to delete category."
        });

    }

};

console.log("✅ Category Controller Loaded");