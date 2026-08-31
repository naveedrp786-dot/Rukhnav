"use strict";

const db = require("../config/db");

const {
    awardPurchasePoints,
    reverseRefundPoints
} = require("./loyaltyTransactionService");

const {
    processFirstPaidSaleReferral
} = require("./referralService");

const POINTS_VALUE_IN_PKR = 100;

/**
 * Create an application error.
 */
function createError(
    message,
    statusCode = 400
) {
    const error = new Error(message);

    error.statusCode = statusCode;

    return error;
}

/**
 * Convert a database value safely.
 */
function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

/**
 * Get the correct membership category
 * based on the customer's lifetime points.
 */
async function getCategoryByLifetimePoints(
    connection,
    lifetimePoints
) {
    const [rows] =
        await connection.query(
            `
            SELECT
                id,
                category_name,
                minimum_lifetime_points,
                points_multiplier,
                discount_percentage,
                birthday_bonus_points,
                referral_bonus_points,
                event_menu_enabled,
                email_reminders_enabled,
                whatsapp_reminders_enabled,
                sms_reminders_enabled,
                priority_support_enabled,
                free_delivery_enabled

            FROM customer_loyalty_categories

            WHERE
                status = 'Active'
                AND minimum_lifetime_points <= ?

            ORDER BY
                minimum_lifetime_points DESC

            LIMIT 1
            `,
            [lifetimePoints]
        );

    if (rows.length === 0) {
        throw createError(
            "No active loyalty category is configured.",
            500
        );
    }

    return rows[0];
}

/**
 * Ensure that the customer has
 * a customer_rewards row.
 */
async function ensureCustomerRewards(
    connection,
    customerId
) {
    await connection.query(
        `
        INSERT INTO customer_rewards (
            customer_id,
            reward_points,
            lifetime_points,
            membership_level,
            membership_changed_at,
            total_spent,
            total_orders
        )
        VALUES (
            ?,
            0,
            0,
            'Bronze',
            NOW(),
            0.00,
            0
        )

        ON DUPLICATE KEY UPDATE
            customer_id = customer_id
        `,
        [customerId]
    );
}

/**
 * Recalculate total spending and total orders
 * from completed and fully paid sales.
 */
async function reconcileCustomerSalesTotals(
    customerId
) {
    const [[totals]] =
        await db.query(
            `
            SELECT
                COALESCE(
                    SUM(grand_total),
                    0
                ) AS total_spent,

                COUNT(*) AS total_orders

            FROM sales

            WHERE
                customer_id = ?
                AND payment_status = 'Paid'
                AND sale_status = 'Completed'
            `,
            [customerId]
        );

    await db.query(
        `
        UPDATE customer_rewards

        SET
            total_spent = ?,
            total_orders = ?

        WHERE customer_id = ?
        `,
        [
            toNumber(
                totals.total_spent
            ),

            toNumber(
                totals.total_orders
            ),

            customerId
        ]
    );
}

/**
 * Load and validate a paid sale.
 */
async function getEligiblePaidSale(
    saleId
) {
    const [rows] =
        await db.query(
            `
            SELECT
                id,
                sale_number,
                customer_id,
                grand_total,
                payment_status,
                sale_status

            FROM sales

            WHERE id = ?

            LIMIT 1
            `,
            [saleId]
        );

    if (rows.length === 0) {
        throw createError(
            "Sale not found.",
            404
        );
    }

    const sale =
        rows[0];

    if (
        sale.sale_status ===
        "Cancelled"
    ) {
        throw createError(
            "Loyalty points cannot be awarded for a cancelled sale.",
            400
        );
    }

    if (
        sale.payment_status !==
        "Paid"
    ) {
        throw createError(
            "Loyalty points can only be awarded for a fully paid sale.",
            400
        );
    }

    if (
        toNumber(
            sale.grand_total
        ) <= 0
    ) {
        throw createError(
            "The sale total must be greater than zero.",
            400
        );
    }

    return sale;
}

/**
 * Process the referral reward safely.
 *
 * A referral problem must not cancel
 * or fail an otherwise valid paid sale.
 */
async function processSaleReferralSafely(
    sale
) {
    try {
        return await processFirstPaidSaleReferral({
            referredCustomerId:
                sale.customer_id,

            saleId:
                sale.id,

            saleNumber:
                sale.sale_number
        });

    } catch (error) {
        console.error(
            "Referral bonus processing error:",
            {
                saleId:
                    sale.id,

                customerId:
                    sale.customer_id,

                message:
                    error.message,

                code:
                    error.code
            }
        );

        return {
            success: false,
            referralFound: null,
            rewarded: false,
            alreadyRewarded: false,
            message:
                "The sale succeeded, but the referral reward could not be processed.",
            error:
                error.message
        };
    }
}

/**
 * Process loyalty points after a sale
 * becomes fully paid.
 */
async function processPaidSale(
    saleId
) {
    const parsedSaleId =
        Number(saleId);

    if (
        !Number.isInteger(parsedSaleId) ||
        parsedSaleId <= 0
    ) {
        throw createError(
            "A valid sale ID is required.",
            400
        );
    }

    const sale =
        await getEligiblePaidSale(
            parsedSaleId
        );

    const saleTotal =
        toNumber(
            sale.grand_total
        );

    const connection =
        await db.getConnection();

    let previousCategory =
        "Bronze";

    let currentCategory =
        null;

    let basePoints =
        0;

    let pointsMultiplier =
        1;

    let earnedPoints =
        0;

    try {
        await connection
            .beginTransaction();

        await ensureCustomerRewards(
            connection,
            sale.customer_id
        );

        const [rewardRows] =
            await connection.query(
                `
                SELECT
                    lifetime_points,
                    membership_level

                FROM customer_rewards

                WHERE customer_id = ?

                LIMIT 1

                FOR UPDATE
                `,
                [sale.customer_id]
            );

        const rewards =
            rewardRows[0];

        previousCategory =
            rewards?.membership_level ||
            "Bronze";

        currentCategory =
            await getCategoryByLifetimePoints(
                connection,
                toNumber(
                    rewards
                        ?.lifetime_points
                )
            );

        basePoints =
            Math.floor(
                saleTotal /
                POINTS_VALUE_IN_PKR
            );

        pointsMultiplier =
            toNumber(
                currentCategory
                    .points_multiplier
            );

        earnedPoints =
            Math.floor(
                basePoints *
                pointsMultiplier
            );

        await connection.commit();

    } catch (error) {
        await connection.rollback();

        throw error;

    } finally {
        connection.release();
    }

    /*
     * Low-value paid sales may earn
     * zero purchase points.
     *
     * They can still qualify for the
     * first-sale referral bonus.
     */
    if (earnedPoints <= 0) {
        await reconcileCustomerSalesTotals(
            sale.customer_id
        );

        const referralResult =
            await processSaleReferralSafely(
                sale
            );

        const loyalty =
            await getCustomerLoyaltySummary(
                sale.customer_id
            );

        return {
            success: true,

            alreadyProcessed:
                false,

            message:
                "Sale completed, but its value was below the minimum required to earn a point.",

            saleId:
                sale.id,

            saleNumber:
                sale.sale_number,

            customerId:
                sale.customer_id,

            saleTotal,

            basePoints,

            pointsMultiplier,

            pointsAwarded:
                0,

            availablePoints:
                loyalty.availablePoints,

            lifetimePoints:
                loyalty.lifetimePoints,

            previousCategory,

            currentCategory:
                loyalty.membershipLevel,

            categoryChanged:
                false,

            eventMenuEnabled:
                loyalty
                    .benefits
                    .eventMenuEnabled,

            referral:
                referralResult
        };
    }

    /*
     * Award purchase points through the
     * central loyalty transaction service.
     */
    const ledgerResult =
        await awardPurchasePoints({
            customerId:
                sale.customer_id,

            points:
                earnedPoints,

            saleId:
                sale.id,

            saleNumber:
                sale.sale_number,

            description:
                `Points earned from sale ${sale.sale_number}`,

            metadata: {
                saleTotal,
                basePoints,
                pointsMultiplier
            }
        });

    await reconcileCustomerSalesTotals(
        sale.customer_id
    );

    /*
     * Process the referral after the
     * purchase-points transaction.
     */
    const referralResult =
        await processSaleReferralSafely(
            sale
        );

    const loyalty =
        await getCustomerLoyaltySummary(
            sale.customer_id
        );

    const categoryChanged =
        previousCategory !==
        loyalty.membershipLevel;

    return {
        success: true,

        alreadyProcessed:
            Boolean(
                ledgerResult
                    .alreadyProcessed
            ),

        message:
            ledgerResult.alreadyProcessed
                ? "Loyalty points were already awarded for this sale."
                : categoryChanged
                    ? `Points awarded and customer promoted to ${loyalty.membershipLevel}.`
                    : "Loyalty points awarded successfully.",

        saleId:
            sale.id,

        saleNumber:
            sale.sale_number,

        customerId:
            sale.customer_id,

        saleTotal,

        basePoints,

        pointsMultiplier,

        pointsAwarded:
            earnedPoints,

        availablePoints:
            loyalty.availablePoints,

        lifetimePoints:
            loyalty.lifetimePoints,

        previousCategory,

        currentCategory:
            loyalty.membershipLevel,

        categoryChanged,

        eventMenuEnabled:
            loyalty
                .benefits
                .eventMenuEnabled,

        referral:
            referralResult,

        transaction:
            ledgerResult.transaction ||
            null
    };
}

/**
 * Reverse previously awarded sale points
 * after a cancellation or full return.
 */
async function reverseSalePoints(
    saleId,
    reason =
        "Sale cancelled or returned"
) {
    const parsedSaleId =
        Number(saleId);

    if (
        !Number.isInteger(parsedSaleId) ||
        parsedSaleId <= 0
    ) {
        throw createError(
            "A valid sale ID is required.",
            400
        );
    }

    const [saleRows] =
        await db.query(
            `
            SELECT
                id,
                sale_number,
                customer_id,
                grand_total

            FROM sales

            WHERE id = ?

            LIMIT 1
            `,
            [parsedSaleId]
        );

    if (saleRows.length === 0) {
        throw createError(
            "Sale not found.",
            404
        );
    }

    const sale =
        saleRows[0];

    /*
     * Locate the original purchase-points
     * transaction for this sale.
     */
    const [earnedRows] =
        await db.query(
            `
            SELECT
                id,
                points_change,
                lifetime_points_change

            FROM customer_loyalty_transactions

            WHERE
                customer_id = ?
                AND source_id = ?
                AND points_change > 0
                AND source_type IN (
                    'Sale',
                    'Customer Sale',
                    'Purchase'
                )

            ORDER BY
                id ASC

            LIMIT 1
            `,
            [
                sale.customer_id,
                sale.id
            ]
        );

    if (earnedRows.length === 0) {
        throw createError(
            "No awarded loyalty points were found for this sale.",
            404
        );
    }

    const earnedTransaction =
        earnedRows[0];

    const awardedPoints =
        Math.abs(
            toNumber(
                earnedTransaction
                    .points_change
            )
        );

    const awardedLifetimePoints =
        Math.abs(
            toNumber(
                earnedTransaction
                    .lifetime_points_change
            )
        );

    const beforeSummary =
        await getCustomerLoyaltySummary(
            sale.customer_id
        );

    const ledgerResult =
        await reverseRefundPoints({
            customerId:
                sale.customer_id,

            points:
                awardedPoints,

            lifetimePoints:
                awardedLifetimePoints,

            saleId:
                sale.id,

            saleNumber:
                sale.sale_number,

            description:
                reason,

            metadata: {
                originalTransactionId:
                    earnedTransaction.id,

                saleTotal:
                    toNumber(
                        sale.grand_total
                    )
            }
        });

    await reconcileCustomerSalesTotals(
        sale.customer_id
    );

    const loyalty =
        await getCustomerLoyaltySummary(
            sale.customer_id
        );

    const categoryChanged =
        beforeSummary
            .membershipLevel !==
        loyalty.membershipLevel;

    return {
        success: true,

        alreadyReversed:
            Boolean(
                ledgerResult
                    .alreadyProcessed
            ),

        message:
            ledgerResult.alreadyProcessed
                ? "Points for this sale were already reversed."
                : categoryChanged
                    ? `Points reversed and membership changed to ${loyalty.membershipLevel}.`
                    : "Sale loyalty points reversed successfully.",

        saleId:
            sale.id,

        saleNumber:
            sale.sale_number,

        customerId:
            sale.customer_id,

        pointsReversed:
            awardedPoints,

        availablePoints:
            loyalty.availablePoints,

        lifetimePoints:
            loyalty.lifetimePoints,

        previousCategory:
            beforeSummary
                .membershipLevel,

        currentCategory:
            loyalty.membershipLevel,

        categoryChanged,

        transaction:
            ledgerResult.transaction ||
            null
    };
}

/**
 * Return a customer's complete loyalty
 * summary, benefits and category progress.
 */
async function getCustomerLoyaltySummary(
    customerId
) {
    const parsedCustomerId =
        Number.parseInt(
            customerId,
            10
        );

    if (
        !Number.isInteger(parsedCustomerId) ||
        parsedCustomerId <= 0
    ) {
        throw createError(
            "A valid customer ID is required.",
            400
        );
    }

    const [rows] =
        await db.query(
            `
            SELECT
                c.id AS customer_id,
                c.full_name,

                cr.reward_points,
                cr.lifetime_points,
                cr.membership_level,
                cr.membership_changed_at,
                cr.total_spent,
                cr.total_orders,

                lc.minimum_lifetime_points,
                lc.points_multiplier,
                lc.discount_percentage,
                lc.birthday_bonus_points,
                lc.referral_bonus_points,
                lc.event_menu_enabled,
                lc.email_reminders_enabled,
                lc.whatsapp_reminders_enabled,
                lc.sms_reminders_enabled,
                lc.priority_support_enabled,
                lc.free_delivery_enabled

            FROM customers c

            JOIN customer_rewards cr
                ON cr.customer_id =
                   c.id

            JOIN customer_loyalty_categories lc
                ON lc.category_name =
                   cr.membership_level

            WHERE
                c.id = ?
                AND lc.status = 'Active'

            LIMIT 1
            `,
            [parsedCustomerId]
        );

    if (rows.length === 0) {
        throw createError(
            "Customer loyalty record was not found.",
            404
        );
    }

    const loyalty =
        rows[0];

    const [nextRows] =
        await db.query(
            `
            SELECT
                category_name,
                minimum_lifetime_points

            FROM customer_loyalty_categories

            WHERE
                status = 'Active'
                AND minimum_lifetime_points > ?

            ORDER BY
                minimum_lifetime_points ASC

            LIMIT 1
            `,
            [
                loyalty
                    .lifetime_points
            ]
        );

    const nextCategory =
        nextRows.length > 0
            ? nextRows[0]
            : null;

    const pointsNeeded =
        nextCategory
            ? Math.max(
                0,

                toNumber(
                    nextCategory
                        .minimum_lifetime_points
                ) -
                toNumber(
                    loyalty
                        .lifetime_points
                )
            )
            : 0;

    return {
        customerId:
            loyalty.customer_id,

        fullName:
            loyalty.full_name,

        availablePoints:
            toNumber(
                loyalty.reward_points
            ),

        lifetimePoints:
            toNumber(
                loyalty.lifetime_points
            ),

        membershipLevel:
            loyalty.membership_level,

        membershipChangedAt:
            loyalty
                .membership_changed_at,

        totalSpent:
            toNumber(
                loyalty.total_spent
            ),

        totalOrders:
            toNumber(
                loyalty.total_orders
            ),

        benefits: {
            pointsMultiplier:
                toNumber(
                    loyalty
                        .points_multiplier
                ),

            discountPercentage:
                toNumber(
                    loyalty
                        .discount_percentage
                ),

            birthdayBonusPoints:
                toNumber(
                    loyalty
                        .birthday_bonus_points
                ),

            referralBonusPoints:
                toNumber(
                    loyalty
                        .referral_bonus_points
                ),

            eventMenuEnabled:
                Boolean(
                    loyalty
                        .event_menu_enabled
                ),

            emailRemindersEnabled:
                Boolean(
                    loyalty
                        .email_reminders_enabled
                ),

            whatsappRemindersEnabled:
                Boolean(
                    loyalty
                        .whatsapp_reminders_enabled
                ),

            smsRemindersEnabled:
                Boolean(
                    loyalty
                        .sms_reminders_enabled
                ),

            prioritySupportEnabled:
                Boolean(
                    loyalty
                        .priority_support_enabled
                ),

            freeDeliveryEnabled:
                Boolean(
                    loyalty
                        .free_delivery_enabled
                )
        },

        nextCategory:
            nextCategory
                ? {
                    name:
                        nextCategory
                            .category_name,

                    requiredLifetimePoints:
                        toNumber(
                            nextCategory
                                .minimum_lifetime_points
                        ),

                    pointsNeeded
                }
                : null,

        highestCategory:
            !nextCategory
    };
}

module.exports = {
    processPaidSale,
    reverseSalePoints,
    getCustomerLoyaltySummary
};
