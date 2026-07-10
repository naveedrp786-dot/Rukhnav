const db = require("../config/db");

// ==========================
// Get All Categories
// ==========================
exports.getCategories = async (req, res) => {
    try {

        const [categories] = await db.query(
            `SELECT *
             FROM categories
             WHERE status='active'
             ORDER BY category_name`
        );

        res.json({
            success: true,
            categories
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
// Add Category
// ==========================
exports.addCategory = async (req, res) => {
    try {

        const {
            category_name,
            description,
            status
        } = req.body;

        if (!category_name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        const [existing] = await db.query(
            "SELECT id FROM categories WHERE category_name=?",
            [category_name]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Category already exists."
            });
        }

        const [result] = await db.query(
            `INSERT INTO categories
            (category_name,description,status)
            VALUES (?,?,?)`,
            [
                category_name,
                description,
                status || "active"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Category added successfully",
            categoryId: result.insertId
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
// Update Category
// ==========================
exports.updateCategory = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            category_name,
            description,
            status
        } = req.body;

        const [result] = await db.query(
            `UPDATE categories
             SET
                category_name=?,
                description=?,
                status=?
             WHERE id=?`,
            [
                category_name,
                description,
                status,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            message: "Category updated successfully"
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
// Delete Category
// ==========================
exports.deleteCategory = async (req, res) => {
    try {

        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM categories WHERE id=?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};