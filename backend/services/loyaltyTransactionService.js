"use strict";

const db = require("../config/db");

const VALID_TRANSACTION_TYPES = new Set([
    "Purchase Earned",
    "Referral Bonus",
    "Birthday Bonus",
    "Manual Credit",
    "Manual Debit",
    "Reward Redemption",
    "Points Expiry",
    "Refund Reversal",
    "Opening Balance",
    "Other"
]);

const VALID_MEMBERSHIP_LEVELS = new Set([
    "Bronze",
    "Silver",
    "Gold",
    "Platinum"
]);

// =========================================
// Custom Service Error
// =========================================

class LoyaltyServiceError extends Error {
    constructor(
        message,
        statusCode = 400,
        code = "LOYALTY_ERROR"
    ) {
        super(message);

        this.name =
            "LoyaltyServiceError";

        this.statusCode =
            statusCode;

        this.code =
            code;
    }
}

// =========================================
// Utility Functions
// =========================================

const toInteger = (
    value,
    fieldName
) => {
    const parsedValue =
        Number.parseInt(value, 10);

    if (!Number.isInteger(parsedValue)) {
        throw new LoyaltyServiceError(
            `${fieldName} must be a valid integer.`,
            400,
            "INVALID_INTEGER"
        );
    }

    return parsedValue;
};

const normaliseOptionalText = (
    value,
    maximumLength
) => {
    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const text =
        String(value).trim();

    if (!text) {
        return null;
    }

    return text.substring(
        0,
        maximumLength
    );
};

const normaliseMetadata = (
    metadata
) => {
    if (
        metadata === undefined ||
        metadata === null
    ) {
        return null;
    }

    if (
        typeof metadata !== "object" ||
        Array.isArray(metadata)
    ) {
        throw new LoyaltyServiceError(
            "metadata must be a JSON object.",
            400,
            "INVALID_METADATA"
        );
    }

    return JSON.stringify(metadata);
};

// =========================================
// Get Membership from Lifetime Points
// =========================================

const getMembershipForLifetimePoints =
    async (
        connection,
        lifetimePoints
    ) => {
        const [rows] =
            await connection.query(
                `
                SELECT
                    category_name,
                    minimum_lifetime_points
                FROM customer_loyalty_categories
                WHERE status = 'Active'
                AND minimum_lifetime_points <= ?
                ORDER BY
                    minimum_lifetime_points DESC
                LIMIT 1
                `,
                [lifetimePoints]
            );

        if (!rows.length) {
            return "Bronze";
        }

        const membershipLevel =
            rows[0].category_name;

        return VALID_MEMBERSHIP_LEVELS.has(
            membershipLevel
        )
            ? membershipLevel
            : "Bronze";
    };

// =========================================
// Check Existing Idempotent Transaction
// =========================================

const getExistingTransactionByKey =
    async (
        connection,
        idempotencyKey
    ) => {
        if (!idempotencyKey) {
            return null;
        }

        const [rows] =
            await connection.query(
                `
                SELECT *
                FROM customer_loyalty_transactions
                WHERE idempotency_key = ?
                LIMIT 1
                `,
                [idempotencyKey]
            );

        return rows[0] || null;
    };

// =========================================
// Ensure Customer Rewards Record Exists
// =========================================

const ensureRewardAccount =
    async (
        connection,
        customerId
    ) => {
        const [customerRows] =
            await connection.query(
                `
                SELECT id
                FROM customers
                WHERE id = ?
                LIMIT 1
                `,
                [customerId]
            );

        if (!customerRows.length) {
            throw new LoyaltyServiceError(
                "Customer not found.",
                404,
                "CUSTOMER_NOT_FOUND"
            );
        }

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
                customer_id = VALUES(customer_id)
            `,
            [customerId]
        );
    };

// =========================================
// Apply Loyalty Transaction
// =========================================

const applyLoyaltyTransaction =
    async ({
        customerId,
        transactionType,
        pointsChange,
        lifetimePointsChange = 0,
        sourceType = null,
        sourceId = null,
        referenceNumber = null,
        description = null,
        idempotencyKey = null,
        createdByAdminId = null,
        metadata = null,
        existingConnection = null
    }) => {
        const parsedCustomerId =
            toInteger(
                customerId,
                "customerId"
            );

        const parsedPointsChange =
            toInteger(
                pointsChange,
                "pointsChange"
            );

        const parsedLifetimeChange =
            toInteger(
                lifetimePointsChange,
                "lifetimePointsChange"
            );

        if (
            !VALID_TRANSACTION_TYPES.has(
                transactionType
            )
        ) {
            throw new LoyaltyServiceError(
                "Invalid loyalty transaction type.",
                400,
                "INVALID_TRANSACTION_TYPE"
            );
        }

        if (parsedPointsChange === 0) {
            throw new LoyaltyServiceError(
                "pointsChange cannot be zero.",
                400,
                "ZERO_POINTS_CHANGE"
            );
        }

        const safeSourceType =
            normaliseOptionalText(
                sourceType,
                50
            );

        const parsedSourceId =
            sourceId === undefined ||
            sourceId === null ||
            sourceId === ""
                ? null
                : toInteger(
                    sourceId,
                    "sourceId"
                );

        const safeReferenceNumber =
            normaliseOptionalText(
                referenceNumber,
                100
            );

        const safeDescription =
            normaliseOptionalText(
                description,
                255
            );

        const safeIdempotencyKey =
            normaliseOptionalText(
                idempotencyKey,
                150
            );

        const parsedAdminId =
            createdByAdminId === undefined ||
            createdByAdminId === null ||
            createdByAdminId === ""
                ? null
                : toInteger(
                    createdByAdminId,
                    "createdByAdminId"
                );

        const safeMetadata =
            normaliseMetadata(metadata);

        /*
         * Normally the loyalty service owns
         * its database transaction.
         *
         * Checkout may provide an existing
         * connection so the order, inventory
         * and points commit or roll back together.
         */
        const ownsConnection =
            !existingConnection;

        const connection =
            existingConnection ||
            await db.getConnection();

        try {
            if (ownsConnection) {
                await connection.beginTransaction();
            }

            const existingTransaction =
                await getExistingTransactionByKey(
                    connection,
                    safeIdempotencyKey
                );

            if (existingTransaction) {
                if (ownsConnection) {
                    await connection.commit();
                }

                return {
                    alreadyProcessed: true,
                    transaction:
                        existingTransaction
                };
            }

            await ensureRewardAccount(
                connection,
                parsedCustomerId
            );

            const [rewardRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        customer_id,
                        reward_points,
                        lifetime_points,
                        membership_level,
                        membership_changed_at,
                        total_spent,
                        total_orders
                    FROM customer_rewards
                    WHERE customer_id = ?
                    FOR UPDATE
                    `,
                    [parsedCustomerId]
                );

            const rewardAccount =
                rewardRows[0];

            const balanceBefore =
                Number(
                    rewardAccount.reward_points || 0
                );

            const lifetimeBefore =
                Number(
                    rewardAccount.lifetime_points || 0
                );

            const membershipBefore =
                rewardAccount.membership_level ||
                "Bronze";

            const balanceAfter =
                balanceBefore +
                parsedPointsChange;

            const lifetimeAfter =
                lifetimeBefore +
                parsedLifetimeChange;

            if (balanceAfter < 0) {
                throw new LoyaltyServiceError(
                    "Customer does not have enough reward points.",
                    409,
                    "INSUFFICIENT_REWARD_POINTS"
                );
            }

            if (lifetimeAfter < 0) {
                throw new LoyaltyServiceError(
                    "Lifetime points cannot become negative.",
                    409,
                    "INVALID_LIFETIME_BALANCE"
                );
            }

            const membershipAfter =
                await getMembershipForLifetimePoints(
                    connection,
                    lifetimeAfter
                );

            const membershipChanged =
                membershipAfter !==
                membershipBefore;

            await connection.query(
                `
                UPDATE customer_rewards
                SET
                    reward_points = ?,
                    lifetime_points = ?,
                    membership_level = ?,
                    membership_changed_at =
                        CASE
                            WHEN membership_level <> ?
                            THEN NOW()
                            ELSE membership_changed_at
                        END
                WHERE customer_id = ?
                `,
                [
                    balanceAfter,
                    lifetimeAfter,
                    membershipAfter,
                    membershipAfter,
                    parsedCustomerId
                ]
            );

            const [insertResult] =
                await connection.query(
                    `
                    INSERT INTO customer_loyalty_transactions (
                        customer_id,
                        transaction_type,
                        points_change,
                        lifetime_points_change,
                        balance_before,
                        balance_after,
                        lifetime_before,
                        lifetime_after,
                        membership_before,
                        membership_after,
                        source_type,
                        source_id,
                        reference_number,
                        description,
                        idempotency_key,
                        created_by_admin_id,
                        metadata
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    `,
                    [
                        parsedCustomerId,
                        transactionType,
                        parsedPointsChange,
                        parsedLifetimeChange,
                        balanceBefore,
                        balanceAfter,
                        lifetimeBefore,
                        lifetimeAfter,
                        membershipBefore,
                        membershipAfter,
                        safeSourceType,
                        parsedSourceId,
                        safeReferenceNumber,
                        safeDescription,
                        safeIdempotencyKey,
                        parsedAdminId,
                        safeMetadata
                    ]
                );

            const [transactionRows] =
                await connection.query(
                    `
                    SELECT *
                    FROM customer_loyalty_transactions
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [insertResult.insertId]
                );

            if (ownsConnection) {
                await connection.commit();
            }

            return {
                alreadyProcessed: false,

                membershipChanged,

                transaction:
                    transactionRows[0],

                rewards: {
                    customerId:
                        parsedCustomerId,

                    rewardPoints:
                        balanceAfter,

                    lifetimePoints:
                        lifetimeAfter,

                    membershipLevel:
                        membershipAfter
                }
            };

        } catch (error) {
            if (ownsConnection) {
                await connection.rollback();
            }

            if (
                error.code ===
                "ER_DUP_ENTRY"
            ) {
                throw new LoyaltyServiceError(
                    "This loyalty transaction has already been processed.",
                    409,
                    "DUPLICATE_LOYALTY_TRANSACTION"
                );
            }

            throw error;

        } finally {
            if (ownsConnection) {
                connection.release();
            }
        }
    };

// =========================================
// Convenience Functions
// =========================================

const awardPurchasePoints =
    async ({
        customerId,
        points,
        saleId,
        saleNumber = null,
        description = null,
        metadata = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints <= 0) {
            throw new LoyaltyServiceError(
                "Purchase points must be greater than zero.",
                400,
                "INVALID_PURCHASE_POINTS"
            );
        }

        return applyLoyaltyTransaction({
            customerId,
            transactionType:
                "Purchase Earned",
            pointsChange:
                parsedPoints,
            lifetimePointsChange:
                parsedPoints,
            sourceType:
                "Sale",
            sourceId:
                saleId,
            referenceNumber:
                saleNumber,
            description:
                description ||
                "Points earned from completed purchase.",
            idempotencyKey:
                `purchase-earned:sale:${saleId}`,
            metadata
        });
    };

const redeemRewardPoints =
    async ({
        customerId,
        points,
        referenceNumber = null,
        description = null,
        metadata = null,
        existingConnection = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints <= 0) {
            throw new LoyaltyServiceError(
                "Redemption points must be greater than zero.",
                400,
                "INVALID_REDEMPTION_POINTS"
            );
        }

        return applyLoyaltyTransaction({
            customerId,
            transactionType:
                "Reward Redemption",
            pointsChange:
                -parsedPoints,
            lifetimePointsChange:
                0,
            sourceType:
                "Reward Redemption",
            referenceNumber,
            description:
                description ||
                "Reward points redeemed.",
            idempotencyKey:
                referenceNumber
                    ? `reward-redemption:${referenceNumber}`
                    : null,
            metadata,
            existingConnection
        });
    };

// =========================================
// Award Referral Bonus
// =========================================

const awardReferralBonus =
    async ({
        customerId,
        points,
        referredCustomerId,
        referenceNumber = null,
        description = null,
        metadata = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints <= 0) {
            throw new LoyaltyServiceError(
                "Referral bonus points must be greater than zero.",
                400,
                "INVALID_REFERRAL_POINTS"
            );
        }

        const parsedReferredCustomerId =
            toInteger(
                referredCustomerId,
                "referredCustomerId"
            );

        return applyLoyaltyTransaction({
            customerId,

            transactionType:
                "Referral Bonus",

            pointsChange:
                parsedPoints,

            lifetimePointsChange:
                parsedPoints,

            sourceType:
                "Customer Referral",

            sourceId:
                parsedReferredCustomerId,

            referenceNumber,

            description:
                description ||
                "Referral bonus awarded.",

            idempotencyKey:
                `referral-bonus:customer:${parsedReferredCustomerId}`,

            metadata
        });
    };

// =========================================
// Award Birthday Bonus
// =========================================

const awardBirthdayBonus =
    async ({
        customerId,
        points,
        eventId = null,
        year = new Date().getFullYear(),
        referenceNumber = null,
        description = null,
        metadata = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints <= 0) {
            throw new LoyaltyServiceError(
                "Birthday bonus points must be greater than zero.",
                400,
                "INVALID_BIRTHDAY_POINTS"
            );
        }

        const parsedYear =
            toInteger(
                year,
                "year"
            );

        const parsedEventId =
            eventId === undefined ||
            eventId === null ||
            eventId === ""
                ? null
                : toInteger(
                    eventId,
                    "eventId"
                );

        return applyLoyaltyTransaction({
            customerId,

            transactionType:
                "Birthday Bonus",

            pointsChange:
                parsedPoints,

            lifetimePointsChange:
                parsedPoints,

            sourceType:
                "Customer Event",

            sourceId:
                parsedEventId,

            referenceNumber,

            description:
                description ||
                `Birthday bonus awarded for ${parsedYear}.`,

            idempotencyKey:
                `birthday-bonus:customer:${customerId}:year:${parsedYear}`,

            metadata: {
                ...(metadata || {}),
                year:
                    parsedYear
            }
        });
    };

// =========================================
// Apply Manual Admin Adjustment
// =========================================

const applyManualAdjustment =
    async ({
        customerId,
        points,
        qualifiesForLifetime = false,
        reason,
        referenceNumber = null,
        createdByAdminId = null,
        metadata = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints === 0) {
            throw new LoyaltyServiceError(
                "Adjustment points cannot be zero.",
                400,
                "ZERO_ADJUSTMENT"
            );
        }

        const safeReason =
            normaliseOptionalText(
                reason,
                255
            );

        if (!safeReason) {
            throw new LoyaltyServiceError(
                "A reason is required for manual adjustment.",
                400,
                "ADJUSTMENT_REASON_REQUIRED"
            );
        }

        const isCredit =
            parsedPoints > 0;

        return applyLoyaltyTransaction({
            customerId,

            transactionType:
                isCredit
                    ? "Manual Credit"
                    : "Manual Debit",

            pointsChange:
                parsedPoints,

            lifetimePointsChange:
                qualifiesForLifetime
                    ? parsedPoints
                    : 0,

            sourceType:
                "Admin Adjustment",

            referenceNumber,

            description:
                safeReason,

            idempotencyKey:
                referenceNumber
                    ? `manual-adjustment:${referenceNumber}`
                    : null,

            createdByAdminId,

            metadata: {
                ...(metadata || {}),

                qualifiesForLifetime:
                    Boolean(
                        qualifiesForLifetime
                    )
            }
        });
    };

// =========================================
// Expire Reward Points
// =========================================

const expireRewardPoints =
    async ({
        customerId,
        points,
        referenceNumber = null,
        description = null,
        metadata = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints <= 0) {
            throw new LoyaltyServiceError(
                "Expiry points must be greater than zero.",
                400,
                "INVALID_EXPIRY_POINTS"
            );
        }

        return applyLoyaltyTransaction({
            customerId,

            transactionType:
                "Points Expiry",

            pointsChange:
                -parsedPoints,

            lifetimePointsChange:
                0,

            sourceType:
                "Points Expiry",

            referenceNumber,

            description:
                description ||
                "Unused reward points expired.",

            idempotencyKey:
                referenceNumber
                    ? `points-expiry:${referenceNumber}`
                    : null,

            metadata
        });
    };

// =========================================
// Reverse Points After Refund
// =========================================

const reverseRefundPoints =
    async ({
        customerId,
        points,
        lifetimePoints = null,
        saleId,
        saleNumber = null,
        description = null,
        metadata = null
    }) => {
        const parsedPoints =
            toInteger(
                points,
                "points"
            );

        if (parsedPoints <= 0) {
            throw new LoyaltyServiceError(
                "Refund reversal points must be greater than zero.",
                400,
                "INVALID_REFUND_POINTS"
            );
        }

        const parsedLifetimePoints =
            lifetimePoints === undefined ||
            lifetimePoints === null
                ? parsedPoints
                : toInteger(
                    lifetimePoints,
                    "lifetimePoints"
                );

        if (parsedLifetimePoints < 0) {
            throw new LoyaltyServiceError(
                "Lifetime reversal points cannot be negative.",
                400,
                "INVALID_LIFETIME_REVERSAL"
            );
        }

        return applyLoyaltyTransaction({
            customerId,

            transactionType:
                "Refund Reversal",

            pointsChange:
                -parsedPoints,

            lifetimePointsChange:
                -parsedLifetimePoints,

            sourceType:
                "Sale Refund",

            sourceId:
                saleId,

            referenceNumber:
                saleNumber,

            description:
                description ||
                "Previously earned purchase points reversed after refund.",

            idempotencyKey:
                `refund-reversal:sale:${saleId}`,

            metadata
        });
    };

module.exports = {
    LoyaltyServiceError,

    applyLoyaltyTransaction,

    awardPurchasePoints,

    awardReferralBonus,

    awardBirthdayBonus,

    applyManualAdjustment,

    redeemRewardPoints,

    expireRewardPoints,

    reverseRefundPoints
};