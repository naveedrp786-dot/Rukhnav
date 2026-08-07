"use strict";

const db = require("../config/db");

function toInt(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
    return String(value ?? "").trim();
}

function sendError(res, error, message) {
    console.error(message, error);
    return res.status(500).json({
        success: false,
        message,
        error: error.message
    });
}

exports.getSummary = async (req, res) => {
    try {
        const [[row]] = await db.query(`
            SELECT
                COUNT(*) AS total_referrals,
                SUM(status = 'Registered') AS registered_referrals,
                SUM(status = 'Qualified') AS qualified_referrals,
                SUM(status = 'Rewarded') AS rewarded_referrals,
                SUM(status = 'Cancelled') AS cancelled_referrals,
                COALESCE(SUM(referrer_reward_points), 0) AS total_points_awarded,
                COUNT(DISTINCT referrer_customer_id) AS active_referrers,
                COUNT(DISTINCT referred_customer_id) AS referred_customers,
                SUM(created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')) AS referrals_this_month
            FROM customer_referrals
        `);

        return res.json({
            success: true,
            summary: {
                totalReferrals: Number(row.total_referrals || 0),
                registeredReferrals: Number(row.registered_referrals || 0),
                qualifiedReferrals: Number(row.qualified_referrals || 0),
                rewardedReferrals: Number(row.rewarded_referrals || 0),
                cancelledReferrals: Number(row.cancelled_referrals || 0),
                totalPointsAwarded: Number(row.total_points_awarded || 0),
                activeReferrers: Number(row.active_referrers || 0),
                referredCustomers: Number(row.referred_customers || 0),
                referralsThisMonth: Number(row.referrals_this_month || 0)
            }
        });
    } catch (error) {
        return sendError(res, error, "Unable to load referral summary.");
    }
};

exports.getReferrals = async (req, res) => {
    try {
        const page = Math.max(1, toInt(req.query.page, 1));
        const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 20)));
        const offset = (page - 1) * limit;
        const status = clean(req.query.status);
        const search = clean(req.query.search);

        const where = [];
        const params = [];

        if (["Registered", "Qualified", "Rewarded", "Cancelled"].includes(status)) {
            where.push("r.status = ?");
            params.push(status);
        }

        if (search) {
            where.push(`(
                r.referral_code_used LIKE ? OR
                referrer.full_name LIKE ? OR
                referrer.email LIKE ? OR
                referrer.phone LIKE ? OR
                referred.full_name LIKE ? OR
                referred.email LIKE ? OR
                referred.phone LIKE ?
            )`);
            const like = `%${search}%`;
            params.push(like, like, like, like, like, like, like);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const [[countRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM customer_referrals r
            JOIN customers referrer ON referrer.id = r.referrer_customer_id
            JOIN customers referred ON referred.id = r.referred_customer_id
            ${whereSql}
        `, params);

        const [rows] = await db.query(`
            SELECT
                r.id,
                r.referral_code_used,
                r.referrer_customer_id,
                referrer.full_name AS referrer_name,
                referrer.email AS referrer_email,
                referrer.phone AS referrer_phone,
                referrer.referral_code AS referrer_code,
                COALESCE(referrer_rewards.membership_level, 'Bronze') AS referrer_membership,
                r.referred_customer_id,
                referred.full_name AS referred_name,
                referred.email AS referred_email,
                referred.phone AS referred_phone,
                referred.status AS referred_account_status,
                r.status,
                r.referrer_reward_points,
                r.referred_reward_points,
                r.qualified_at,
                r.rewarded_at,
                r.created_at,
                r.updated_at,
                first_sale.id AS first_paid_sale_id,
                first_sale.sale_number AS first_paid_sale_number,
                first_sale.grand_total AS first_paid_sale_total,
                first_sale.created_at AS first_paid_sale_date
            FROM customer_referrals r
            JOIN customers referrer ON referrer.id = r.referrer_customer_id
            JOIN customers referred ON referred.id = r.referred_customer_id
            LEFT JOIN customer_rewards referrer_rewards
                ON referrer_rewards.customer_id = r.referrer_customer_id
            LEFT JOIN sales first_sale
                ON first_sale.id = (
                    SELECT MIN(s2.id)
                    FROM sales s2
                    WHERE s2.customer_id = r.referred_customer_id
                      AND s2.payment_status = 'Paid'
                      AND s2.sale_status = 'Completed'
                )
            ${whereSql}
            ORDER BY r.id DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const total = Number(countRow.total || 0);

        return res.json({
            success: true,
            referrals: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit))
            }
        });
    } catch (error) {
        return sendError(res, error, "Unable to load referrals.");
    }
};

exports.getReferralById = async (req, res) => {
    try {
        const id = toInt(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, message: "A valid referral ID is required." });
        }

        const [rows] = await db.query(`
            SELECT
                r.*,
                referrer.full_name AS referrer_name,
                referrer.email AS referrer_email,
                referrer.phone AS referrer_phone,
                referrer.referral_code AS referrer_code,
                COALESCE(referrer_rewards.membership_level, 'Bronze') AS referrer_membership,
                referred.full_name AS referred_name,
                referred.email AS referred_email,
                referred.phone AS referred_phone,
                referred.status AS referred_account_status,
                first_sale.id AS first_paid_sale_id,
                first_sale.sale_number AS first_paid_sale_number,
                first_sale.payment_status AS first_paid_sale_payment_status,
                first_sale.sale_status AS first_paid_sale_status,
                first_sale.grand_total AS first_paid_sale_total,
                first_sale.created_at AS first_paid_sale_date
            FROM customer_referrals r
            JOIN customers referrer ON referrer.id = r.referrer_customer_id
            JOIN customers referred ON referred.id = r.referred_customer_id
            LEFT JOIN customer_rewards referrer_rewards
                ON referrer_rewards.customer_id = r.referrer_customer_id
            LEFT JOIN sales first_sale
                ON first_sale.id = (
                    SELECT MIN(s2.id)
                    FROM sales s2
                    WHERE s2.customer_id = r.referred_customer_id
                      AND s2.payment_status = 'Paid'
                      AND s2.sale_status = 'Completed'
                )
            WHERE r.id = ?
            LIMIT 1
        `, [id]);

        if (!rows.length) {
            return res.status(404).json({ success: false, message: "Referral was not found." });
        }

        return res.json({ success: true, referral: rows[0] });
    } catch (error) {
        return sendError(res, error, "Unable to load referral details.");
    }
};
