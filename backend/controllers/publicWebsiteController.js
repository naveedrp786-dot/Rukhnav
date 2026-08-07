const db = require("../config/db");

// ======================================
// Get Public Page by Key
// ======================================

exports.getPageByKey = async (req, res) => {
    try {
        const { pageKey } = req.params;

        const [sections] = await db.query(
            `
            SELECT
                id,
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
                mobile_image,
                background_color,
                text_color,
                status,
                sort_order
            FROM website_sections
            WHERE page_key = ?
              AND status = 'Active'
            ORDER BY sort_order ASC, id ASC
            `,
            [pageKey]
        );

        if (!sections.length) {
            return res.status(404).json({
                success: false,
                message: "Website page content not found."
            });
        }

        const sectionIds =
            sections.map(section => section.id);

        const [items] = await db.query(
            `
            SELECT
                id,
                section_id,
                item_key,
                eyebrow,
                title,
                subtitle,
                description,
                button_text,
                button_url,
                image,
                icon,
                status,
                sort_order
            FROM website_section_items
            WHERE section_id IN (?)
              AND status = 'Active'
            ORDER BY sort_order ASC, id ASC
            `,
            [sectionIds]
        );

        const itemsBySection = items.reduce(
            (result, item) => {
                const sectionId =
                    Number(item.section_id);

                if (!result[sectionId]) {
                    result[sectionId] = [];
                }

                result[sectionId].push(item);

                return result;
            },
            {}
        );

        const pageSections = sections.map(
            section => ({
                ...section,
                items:
                    itemsBySection[
                        Number(section.id)
                    ] || []
            })
        );

        return res.json({
            success: true,
            page_key: pageKey,
            sections: pageSections
        });

    } catch (error) {
        console.error(
            "Public website page error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ======================================
// Get Public Section by Keys
// ======================================

exports.getSectionByKeys = async (req, res) => {
    try {
        const { pageKey, sectionKey } =
            req.params;

        const [sections] = await db.query(
            `
            SELECT
                id,
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
                mobile_image,
                background_color,
                text_color,
                status,
                sort_order
            FROM website_sections
            WHERE page_key = ?
              AND section_key = ?
              AND status = 'Active'
            LIMIT 1
            `,
            [pageKey, sectionKey]
        );

        if (!sections.length) {
            return res.status(404).json({
                success: false,
                message: "Website section not found."
            });
        }

        const section = sections[0];

        const [items] = await db.query(
            `
            SELECT
                id,
                section_id,
                item_key,
                eyebrow,
                title,
                subtitle,
                description,
                button_text,
                button_url,
                image,
                icon,
                status,
                sort_order
            FROM website_section_items
            WHERE section_id = ?
              AND status = 'Active'
            ORDER BY sort_order ASC, id ASC
            `,
            [section.id]
        );

        return res.json({
            success: true,
            section,
            items
        });

    } catch (error) {
        console.error(
            "Public website section error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};