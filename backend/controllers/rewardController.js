const db = require("../config/db");

// =====================================
// Get Reward Balance
// =====================================
exports.getRewardBalance = async (req, res) => {

    try {

        const { customerId } = req.params;

        const [rows] = await db.query(
            `
            SELECT *
            FROM customer_rewards
            WHERE customer_id = ?
            `,
            [customerId]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Reward account not found."
            });

        }

        res.json({
            success: true,
            rewards: rows[0]
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// =====================================
// Redeem Reward Points
// =====================================
exports.redeemPoints = async (req, res) => {

    try {

        const {
            customer_id,
            points
        } = req.body;

        const [rows] = await db.query(
            `
            SELECT *
            FROM customer_rewards
            WHERE customer_id=?
            `,
            [customer_id]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Reward account not found."
            });

        }

        const reward = rows[0];

        if (reward.reward_points < points) {

            return res.status(400).json({
                success: false,
                message: "Not enough reward points."
            });

        }

        await db.query(
            `
            UPDATE customer_rewards
            SET reward_points = reward_points - ?
            WHERE customer_id = ?
            `,
            [points, customer_id]
        );

        await db.query(
            `
            INSERT INTO reward_transactions
            (
                customer_id,
                transaction_type,
                points,
                description
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                customer_id,
                "Redeem",
                points,
                "Reward redemption"
            ]
        );

        res.json({
            success: true,
            redeemedPoints: points,
            discountValue: points
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};