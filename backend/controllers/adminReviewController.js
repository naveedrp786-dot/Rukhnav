"use strict";

const db = require("../config/db");

let capabilitiesCache = null;

async function getCapabilities() {
    if (capabilitiesCache) return capabilitiesCache;

    const [columns] = await db.query("SHOW COLUMNS FROM reviews");
    const names = new Set(columns.map(row => String(row.Field)));

    capabilitiesCache = {
        status: names.has("status"),
        verifiedPurchase: names.has("verified_purchase"),
        helpfulCount: names.has("helpful_count"),
        updatedAt: names.has("updated_at"),
        adminReply: names.has("admin_reply"),
        featured: names.has("featured"),
        approvedBy: names.has("approved_by"),
        approvedAt: names.has("approved_at")
    };

    return capabilitiesCache;
}

function clean(value) {
    return String(value ?? "").trim();
}

exports.getSummary = async (req, res) => {
    try {
        const caps = await getCapabilities();
        const statusParts = caps.status
            ? `,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_reviews,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved_reviews,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_reviews`
            : ", 0 AS pending_reviews, COUNT(*) AS approved_reviews, 0 AS rejected_reviews";

        const [[row]] = await db.query(`
            SELECT
                COUNT(*) AS total_reviews,
                COALESCE(AVG(rating), 0) AS average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS five_star_reviews
                ${statusParts}
            FROM reviews
        `);

        res.json({
            success: true,
            summary: {
                totalReviews: Number(row.total_reviews || 0),
                averageRating: Number(row.average_rating || 0),
                fiveStarReviews: Number(row.five_star_reviews || 0),
                pendingReviews: Number(row.pending_reviews || 0),
                approvedReviews: Number(row.approved_reviews || 0),
                rejectedReviews: Number(row.rejected_reviews || 0),
                moderationEnabled: caps.status
            }
        });
    } catch (error) {
        console.error("Admin review summary error:", error);
        res.status(500).json({ success: false, message: "Unable to load review summary.", error: error.message });
    }
};

exports.getReviews = async (req, res) => {
    try {
        const caps = await getCapabilities();
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(5, Number.parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;
        const search = clean(req.query.search);
        const rating = Number.parseInt(req.query.rating, 10);
        const status = clean(req.query.status);

        const where = [];
        const params = [];

        if (search) {
            where.push("(c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR p.product_name LIKE ? OR r.comment LIKE ?)");
            const like = `%${search}%`;
            params.push(like, like, like, like, like);
        }

        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
            where.push("r.rating = ?");
            params.push(rating);
        }

        if (status && caps.status) {
            where.push("r.status = ?");
            params.push(status);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const statusSelect = caps.status ? "r.status" : "'Approved' AS status";
        const verifiedSelect = caps.verifiedPurchase ? "r.verified_purchase" : "0 AS verified_purchase";
        const helpfulSelect = caps.helpfulCount ? "r.helpful_count" : "0 AS helpful_count";
        const updatedSelect = caps.updatedAt ? "r.updated_at" : "r.created_at AS updated_at";

        const [rows] = await db.query(`
            SELECT
                r.id,
                r.customer_id,
                r.product_id,
                r.rating,
                r.comment,
                ${statusSelect},
                ${verifiedSelect},
                ${helpfulSelect},
                r.created_at,
                ${updatedSelect},
                c.full_name AS customer_name,
                c.email AS customer_email,
                c.phone AS customer_phone,
                p.product_name
            FROM reviews r
            JOIN customers c ON c.id = r.customer_id
            JOIN products p ON p.id = r.product_id
            ${whereSql}
            ORDER BY r.id DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const [[countRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM reviews r
            JOIN customers c ON c.id = r.customer_id
            JOIN products p ON p.id = r.product_id
            ${whereSql}
        `, params);

        const total = Number(countRow.total || 0);

        res.json({
            success: true,
            reviews: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit))
            },
            capabilities: {
                moderationEnabled: caps.status
            }
        });
    } catch (error) {
        console.error("Admin review list error:", error);
        res.status(500).json({ success: false, message: "Unable to load reviews.", error: error.message });
    }
};

exports.getReviewById = async (req, res) => {
    try {
        const caps = await getCapabilities();
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "A valid review ID is required." });
        }

        const statusSelect = caps.status ? "r.status" : "'Approved' AS status";
        const verifiedSelect = caps.verifiedPurchase ? "r.verified_purchase" : "0 AS verified_purchase";
        const helpfulSelect = caps.helpfulCount ? "r.helpful_count" : "0 AS helpful_count";
        const featuredSelect = caps.featured ? "r.featured" : "0 AS featured";
        const approvedBySelect = caps.approvedBy ? "r.approved_by" : "NULL AS approved_by";
        const approvedAtSelect = caps.approvedAt ? "r.approved_at" : "NULL AS approved_at";
        const adminReplySelect = caps.adminReply
            ? `COALESCE(
                    (
                        SELECT rr.reply_text
                        FROM review_replies rr
                        WHERE rr.review_id = r.id
                          AND rr.status = 'Active'
                        ORDER BY rr.id DESC
                        LIMIT 1
                    ),
                    r.admin_reply
               ) AS admin_reply`
            : `(
                    SELECT rr.reply_text
                    FROM review_replies rr
                    WHERE rr.review_id = r.id
                      AND rr.status = 'Active'
                    ORDER BY rr.id DESC
                    LIMIT 1
               ) AS admin_reply`;

        const [rows] = await db.query(`
            SELECT
                r.id,
                r.customer_id,
                r.product_id,
                r.rating,
                r.comment,
                ${statusSelect},
                ${verifiedSelect},
                ${helpfulSelect},
                ${featuredSelect},
                ${approvedBySelect},
                ${approvedAtSelect},
                ${adminReplySelect},
                r.created_at,
                r.updated_at,
                c.full_name AS customer_name,
                c.email AS customer_email,
                c.phone AS customer_phone,
                p.product_name,
                CONCAT_WS(' ', a.first_name, a.last_name) AS approved_by_name
            FROM reviews r
            JOIN customers c ON c.id = r.customer_id
            JOIN products p ON p.id = r.product_id
            LEFT JOIN admins a
                ON a.id = r.approved_by
            WHERE r.id = ?
            LIMIT 1
        `, [id]);

        if (!rows.length) {
            return res.status(404).json({ success: false, message: "Review not found." });
        }

        res.json({ success: true, review: rows[0], capabilities: { moderationEnabled: caps.status } });
    } catch (error) {
        console.error("Admin review details error:", error);
        res.status(500).json({ success: false, message: "Unable to load review details.", error: error.message });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const caps = await getCapabilities();
        if (!caps.status) {
            return res.status(409).json({
                success: false,
                message: "This database uses the legacy reviews table and does not have a moderation status column yet."
            });
        }

        const id = Number.parseInt(req.params.id, 10);
        const status = clean(req.body.status);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "A valid review ID is required." });
        }
        if (!["Pending", "Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be Pending, Approved or Rejected." });
        }

        const adminId = Number(
            req.admin?.id ||
            req.admin?.admin_id ||
            req.admin?.adminId ||
            0
        );

        let result;

        if (status === "Approved") {
            [result] = await db.query(
                `
                UPDATE reviews
                SET
                    status = ?,
                    approved_by = ?,
                    approved_at = NOW()
                WHERE id = ?
                `,
                [status, adminId || null, id]
            );
        } else {
            [result] = await db.query(
                `
                UPDATE reviews
                SET
                    status = ?,
                    approved_by = NULL,
                    approved_at = NULL,
                    featured = CASE
                        WHEN ? = 'Rejected' THEN 0
                        ELSE featured
                    END
                WHERE id = ?
                `,
                [status, status, id]
            );
        }

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        res.json({
            success: true,
            message: `Review marked ${status}.`,
            status
        });
    } catch (error) {
        console.error("Admin review status error:", error);
        res.status(500).json({ success: false, message: "Unable to update review status.", error: error.message });
    }
};


// ============================================================
// Save / Update Admin Reply
// ============================================================
exports.saveReply = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const reviewId = Number.parseInt(req.params.id, 10);
        const replyText = clean(req.body.reply_text);
        const adminId = Number(
            req.admin?.id ||
            req.admin?.admin_id ||
            req.admin?.adminId ||
            0
        );

        if (!Number.isInteger(reviewId) || reviewId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid review ID is required."
            });
        }

        if (!replyText) {
            return res.status(400).json({
                success: false,
                message: "Reply text is required."
            });
        }

        if (replyText.length > 5000) {
            return res.status(400).json({
                success: false,
                message: "Reply must be 5000 characters or fewer."
            });
        }

        const [reviews] = await connection.query(
            "SELECT id FROM reviews WHERE id = ? LIMIT 1",
            [reviewId]
        );

        if (!reviews.length) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        await connection.beginTransaction();

        // Keep reply history but expose only the newest active reply.
        await connection.query(
            `
            UPDATE review_replies
            SET status = 'Inactive'
            WHERE review_id = ?
              AND status = 'Active'
            `,
            [reviewId]
        );

        const [result] = await connection.query(
            `
            INSERT INTO review_replies
                (review_id, admin_id, reply_text, status)
            VALUES (?, ?, ?, 'Active')
            `,
            [reviewId, adminId || null, replyText]
        );

        // Keep legacy reviews.admin_reply synchronized.
        await connection.query(
            `
            UPDATE reviews
            SET admin_reply = ?
            WHERE id = ?
            `,
            [replyText, reviewId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: "Admin reply saved successfully.",
            reply: {
                id: result.insertId,
                review_id: reviewId,
                admin_id: adminId || null,
                reply_text: replyText
            }
        });

    } catch (error) {
        try {
            await connection.rollback();
        } catch {}

        console.error("Admin review reply error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to save review reply.",
            error: error.message
        });

    } finally {
        connection.release();
    }
};


// ============================================================
// Delete / Remove Admin Reply
// ============================================================
exports.deleteReply = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const reviewId = Number.parseInt(req.params.id, 10);

        if (!Number.isInteger(reviewId) || reviewId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid review ID is required."
            });
        }

        await connection.beginTransaction();

        await connection.query(
            `
            UPDATE review_replies
            SET status = 'Inactive'
            WHERE review_id = ?
              AND status = 'Active'
            `,
            [reviewId]
        );

        await connection.query(
            `
            UPDATE reviews
            SET admin_reply = NULL
            WHERE id = ?
            `,
            [reviewId]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: "Admin reply removed successfully."
        });

    } catch (error) {
        try {
            await connection.rollback();
        } catch {}

        console.error("Admin review reply delete error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to remove review reply.",
            error: error.message
        });

    } finally {
        connection.release();
    }
};


// ============================================================
// Toggle Featured Review
// ============================================================
exports.updateFeatured = async (req, res) => {
    try {
        const reviewId = Number.parseInt(req.params.id, 10);

        if (!Number.isInteger(reviewId) || reviewId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid review ID is required."
            });
        }

        const featured =
            req.body.featured === true ||
            req.body.featured === 1 ||
            req.body.featured === "1" ||
            String(req.body.featured).toLowerCase() === "true"
                ? 1
                : 0;

        const [result] = await db.query(
            `
            UPDATE reviews
            SET featured = ?
            WHERE id = ?
            `,
            [featured, reviewId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Review not found."
            });
        }

        return res.json({
            success: true,
            message: featured
                ? "Review marked as featured."
                : "Review removed from featured reviews.",
            featured: Boolean(featured)
        });

    } catch (error) {
        console.error("Admin review featured error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to update featured review.",
            error: error.message
        });
    }
};
