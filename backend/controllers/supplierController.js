const db = require("../config/db");

// =====================================
// Get all suppliers
// =====================================
exports.getSuppliers = async (req, res) => {
    try {
        const [suppliers] = await db.query(`
            SELECT
                id,
                supplier_name,
                contact_person,
                phone,
                email,
                address,
                city,
                country,
                tax_number,
                opening_balance,
                current_balance,
                status,
                notes,
                created_at,
                updated_at
            FROM suppliers
            WHERE status = 'Active'
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            suppliers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Get inactive suppliers
// =====================================
exports.getInactiveSuppliers = async (req, res) => {
    try {
        const [suppliers] = await db.query(`
            SELECT
                id,
                supplier_name,
                contact_person,
                phone,
                email,
                address,
                city,
                country,
                tax_number,
                opening_balance,
                current_balance,
                status,
                notes,
                created_at,
                updated_at
            FROM suppliers
            WHERE status = 'Inactive'
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            suppliers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Get single supplier
// =====================================
exports.getSupplierById = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                id,
                supplier_name,
                contact_person,
                phone,
                email,
                address,
                city,
                country,
                tax_number,
                opening_balance,
                current_balance,
                status,
                notes,
                created_at,
                updated_at
            FROM suppliers
            WHERE id = ?
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        res.json({
            success: true,
            supplier: rows[0]
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Create supplier
// =====================================
exports.createSupplier = async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address,
            city,
            country,
            tax_number,
            opening_balance,
            notes
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required."
            });
        }

        const cleanEmail = email ? email.trim() : null;

        if (cleanEmail) {
            const [existingEmail] = await db.query(
                `SELECT id FROM suppliers WHERE email = ? LIMIT 1`,
                [cleanEmail]
            );

            if (existingEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "A supplier with this email already exists."
                });
            }
        }

        const openingBalance = Number(opening_balance || 0);

        const [result] = await db.query(`
            INSERT INTO suppliers (
                supplier_name,
                contact_person,
                phone,
                email,
                address,
                city,
                country,
                tax_number,
                opening_balance,
                current_balance,
                status,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
        `, [
            supplier_name.trim(),
            contact_person?.trim() || null,
            phone?.trim() || null,
            cleanEmail,
            address?.trim() || null,
            city?.trim() || null,
            country?.trim() || "Pakistan",
            tax_number?.trim() || null,
            openingBalance,
            openingBalance,
            notes?.trim() || null
        ]);

        res.status(201).json({
            success: true,
            message: "Supplier created successfully.",
            supplierId: result.insertId
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Update supplier
// =====================================
exports.updateSupplier = async (req, res) => {
    try {
        const {
            supplier_name,
            contact_person,
            phone,
            email,
            address,
            city,
            country,
            tax_number,
            opening_balance,
            current_balance,
            notes
        } = req.body;

        const [existingSupplier] = await db.query(
            `SELECT id FROM suppliers WHERE id = ?`,
            [req.params.id]
        );

        if (existingSupplier.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required."
            });
        }

        const cleanEmail = email ? email.trim() : null;

        if (cleanEmail) {
            const [duplicateEmail] = await db.query(`
                SELECT id
                FROM suppliers
                WHERE email = ?
                AND id <> ?
                LIMIT 1
            `, [cleanEmail, req.params.id]);

            if (duplicateEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Another supplier already uses this email."
                });
            }
        }

        await db.query(`
            UPDATE suppliers
            SET
                supplier_name = ?,
                contact_person = ?,
                phone = ?,
                email = ?,
                address = ?,
                city = ?,
                country = ?,
                tax_number = ?,
                opening_balance = ?,
                current_balance = ?,
                notes = ?
            WHERE id = ?
        `, [
            supplier_name.trim(),
            contact_person?.trim() || null,
            phone?.trim() || null,
            cleanEmail,
            address?.trim() || null,
            city?.trim() || null,
            country?.trim() || "Pakistan",
            tax_number?.trim() || null,
            Number(opening_balance || 0),
            Number(current_balance || 0),
            notes?.trim() || null,
            req.params.id
        ]);

        res.json({
            success: true,
            message: "Supplier updated successfully."
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Deactivate supplier
// =====================================
exports.deactivateSupplier = async (req, res) => {
    try {
        const [result] = await db.query(`
            UPDATE suppliers
            SET status = 'Inactive'
            WHERE id = ?
            AND status = 'Active'
        `, [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Active supplier not found."
            });
        }

        res.json({
            success: true,
            message: "Supplier deactivated successfully."
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Restore supplier
// =====================================
exports.restoreSupplier = async (req, res) => {
    try {
        const [result] = await db.query(`
            UPDATE suppliers
            SET status = 'Active'
            WHERE id = ?
            AND status = 'Inactive'
        `, [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Inactive supplier not found."
            });
        }

        res.json({
            success: true,
            message: "Supplier restored successfully."
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// =====================================
// Permanent delete supplier
// =====================================
exports.permanentDeleteSupplier = async (req, res) => {
    try {
        const [supplierRows] = await db.query(
            `SELECT id, status FROM suppliers WHERE id = ?`,
            [req.params.id]
        );

        if (supplierRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        if (supplierRows[0].status !== "Inactive") {
            return res.status(400).json({
                success: false,
                message: "Deactivate the supplier before permanent deletion."
            });
        }

        await db.query(
            `DELETE FROM suppliers WHERE id = ?`,
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Supplier permanently deleted."
        });

    } catch (err) {
        if (
            err.code === "ER_ROW_IS_REFERENCED_2" ||
            err.errno === 1451
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This supplier has purchase or transaction history and cannot be permanently deleted. Restore it or keep it inactive."
            });
        }

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};