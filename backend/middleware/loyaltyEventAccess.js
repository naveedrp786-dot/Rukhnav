"use strict";

const db = require("../config/db");

/**
 * Allow access to the customer event menu
 * according to loyalty-category benefits.
 */
module.exports = async function loyaltyEventAccess(
    req,
    res,
    next
) {
    try {
        const customerId =
            req.customer?.id ||
            req.user?.id ||
            req.user?.customerId ||
            req.customerId ||
            null;

        if (!customerId) {
            return res.status(401).json({
                success: false,
                message:
                    "Customer authentication is required."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                cr.reward_points,
                cr.lifetime_points,
                cr.membership_level,
                lc.event_menu_enabled,
                lc.minimum_lifetime_points
            FROM customer_rewards cr
            JOIN customer_loyalty_categories lc
                ON lc.category_name =
                    cr.membership_level
            WHERE
                cr.customer_id = ?
                AND lc.status = 'Active'
            LIMIT 1
            `,
            [customerId]
        );

        if (rows.length === 0) {
            return res.status(403).json({
                success: false,
                message:
                    "Your loyalty membership could not be verified."
            });
        }

        const loyalty = rows[0];

        if (!Boolean(loyalty.event_menu_enabled)) {
            const [goldRows] = await db.query(
                `
                SELECT
                    category_name,
                    minimum_lifetime_points
                FROM customer_loyalty_categories
                WHERE
                    status = 'Active'
                    AND event_menu_enabled = 1
                    AND minimum_lifetime_points >
                        ?
                ORDER BY
                    minimum_lifetime_points ASC
                LIMIT 1
                `,
                [loyalty.lifetime_points]
            );

            const requiredCategory =
                goldRows.length > 0
                    ? goldRows[0]
                    : null;

            const pointsNeeded =
                requiredCategory
                    ? Math.max(
                        0,
                        Number(
                            requiredCategory
                                .minimum_lifetime_points
                        ) -
                        Number(
                            loyalty.lifetime_points
                        )
                    )
                    : 0;

            return res.status(403).json({
                success: false,
                code: "EVENT_MENU_LOCKED",
                message: requiredCategory
                    ? `Reach ${requiredCategory.category_name} membership to unlock the event menu.`
                    : "The event menu is not available for your current membership.",
                membershipLevel:
                    loyalty.membership_level,
                lifetimePoints: Number(
                    loyalty.lifetime_points
                ),
                requiredCategory:
                    requiredCategory
                        ? requiredCategory.category_name
                        : null,
                requiredLifetimePoints:
                    requiredCategory
                        ? Number(
                            requiredCategory
                                .minimum_lifetime_points
                        )
                        : null,
                pointsNeeded
            });
        }

        /*
         * Make loyalty information available
         * to the event controller if needed.
         */
        req.customerLoyalty = {
            membershipLevel:
                loyalty.membership_level,
            rewardPoints: Number(
                loyalty.reward_points
            ),
            lifetimePoints: Number(
                loyalty.lifetime_points
            ),
            eventMenuEnabled: true
        };

        return next();
    } catch (error) {
        console.error(
            "Event access middleware error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to verify event-menu access."
        });
    }
};