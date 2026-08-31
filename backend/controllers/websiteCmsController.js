const db = require("../config/db");

// ==========================================
// Get Website Sections
// ==========================================

exports.getSections = async (req, res) => {

    try {

        const [sections] = await db.query(`
            SELECT *
            FROM website_sections
            ORDER BY page_key,
                     sort_order,
                     id
        `);

        res.json({
            success: true,
            sections
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================================
// Get Single Section
// ==========================================

exports.getSection = async (req, res) => {

    try {

        const [rows] = await db.query(
            `
            SELECT *
            FROM website_sections
            WHERE id = ?
            `,
            [req.params.id]
        );

        if (!rows.length) {

            return res.status(404).json({
                success: false,
                message: "Section not found."
            });

        }

        res.json({
            success: true,
            section: rows[0]
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================================
// Create Section
// ==========================================

exports.createSection = async (req, res) => {

    try {

        const {

            page_key,
            section_key,
            section_name,
            eyebrow,
            title,
            subtitle,
            content,
            button_text,
            button_url,
            status,
            sort_order

        } = req.body;

        let image = null;

        if (req.file) {

            image = req.file.filename;

        }

        const [result] = await db.query(
            `
            INSERT INTO website_sections
            (
                page_key,
                section_key,
                section_name,
                eyebrow,
                title,
                subtitle,
                content,
                button_text,
                button_url,
                image,
                status,
                sort_order
            )
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                page_key,
                section_key,
                section_name,
                eyebrow,
                title,
                subtitle,
                content,
                button_text,
                button_url,
                image,
                status,
                sort_order
            ]
        );

        res.status(201).json({

            success: true,
            message: "Website section created successfully.",
            id: result.insertId

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// ==========================================
// Update Section
// ==========================================

exports.updateSection = async (req, res) => {

    try {

        const {

            page_key,
            section_key,
            section_name,
            eyebrow,
            title,
            subtitle,
            content,
            button_text,
            button_url,
            status,
            sort_order

        } = req.body;

        let sql = `
            UPDATE website_sections
            SET
                page_key=?,
                section_key=?,
                section_name=?,
                eyebrow=?,
                title=?,
                subtitle=?,
                content=?,
                button_text=?,
                button_url=?,
                status=?,
                sort_order=?
        `;

        const values = [

            page_key,
            section_key,
            section_name,
            eyebrow,
            title,
            subtitle,
            content,
            button_text,
            button_url,
            status,
            sort_order

        ];

        if (req.file) {

            sql += `,
                image=?
            `;

            values.push(req.file.filename);

        }

        sql += `
            WHERE id=?
        `;

        values.push(req.params.id);

        await db.query(sql, values);

        res.json({

            success: true,
            message: "Website section updated successfully."

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// ==========================================
// Delete Section
// ==========================================

exports.deleteSection = async (req, res) => {

    try {

        await db.query(
            `
            DELETE
            FROM website_sections
            WHERE id=?
            `,
            [req.params.id]
        );

        res.json({

            success: true,
            message: "Section deleted successfully."

        });

    } catch (err) {

        console.error(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// ==========================================
// Get Items By Section
// ==========================================

exports.getSectionItems = async (req, res) => {

    try {

        const [items] = await db.query(
            `
            SELECT *
            FROM website_section_items
            WHERE section_id = ?
            ORDER BY sort_order, id
            `,
            [req.params.sectionId]
        );

        res.json({
            success: true,
            items
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// ==========================================
// Create Section Item
// ==========================================

exports.createSectionItem = async (req, res) => {

    try {

        const {
            section_id,
            item_key,
            eyebrow,
            title,
            subtitle,
            description,
            icon,
            button_text,
            button_url,
            status,
            sort_order
        } = req.body;

        const image = req.file
            ? req.file.filename
            : null;

        const [result] = await db.query(
            `
            INSERT INTO website_section_items
            (
                section_id,
                item_key,
                eyebrow,
                title,
                subtitle,
                description,
                image,
                icon,
                button_text,
                button_url,
                status,
                sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                section_id,
                item_key,
                eyebrow,
                title,
                subtitle,
                description,
                image,
                icon,
                button_text,
                button_url,
                status || "Active",
                sort_order || 0
            ]
        );

        res.status(201).json({
            success: true,
            message: "Section item created successfully.",
            id: result.insertId
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// ==========================================
// Update Section Item
// ==========================================

exports.updateSectionItem = async (req, res) => {

    try {

        const {
            item_key,
            eyebrow,
            title,
            subtitle,
            description,
            icon,
            button_text,
            button_url,
            status,
            sort_order
        } = req.body;

        let sql = `
            UPDATE website_section_items
            SET
                item_key = ?,
                eyebrow = ?,
                title = ?,
                subtitle = ?,
                description = ?,
                icon = ?,
                button_text = ?,
                button_url = ?,
                status = ?,
                sort_order = ?
        `;

        const values = [
            item_key,
            eyebrow,
            title,
            subtitle,
            description,
            icon,
            button_text,
            button_url,
            status,
            sort_order
        ];

        if (req.file) {

            sql += `,
                image = ?
            `;

            values.push(req.file.filename);

        }

        sql += `
            WHERE id = ?
        `;

        values.push(req.params.id);

        const [result] = await db.query(sql, values);

        if (!result.affectedRows) {

            return res.status(404).json({
                success: false,
                message: "Section item not found."
            });

        }

        res.json({
            success: true,
            message: "Section item updated successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// ==========================================
// Delete Section Item
// ==========================================

exports.deleteSectionItem = async (req, res) => {

    try {

        const [result] = await db.query(
            `
            DELETE FROM website_section_items
            WHERE id = ?
            `,
            [req.params.id]
        );

        if (!result.affectedRows) {

            return res.status(404).json({
                success: false,
                message: "Section item not found."
            });

        }

        res.json({
            success: true,
            message: "Section item deleted successfully."
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};