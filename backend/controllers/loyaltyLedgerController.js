"use strict";

const db =
    require("../config/db");

const {
    LoyaltyServiceError,
    applyManualAdjustment,
    redeemRewardPoints
} = require(
    "../services/loyaltyTransactionService"
);

// =========================================
// Controller Error Handler
// =========================================

const handleControllerError = (
    error,
    res,
    defaultMessage
) => {
    console.error(
        defaultMessage,
        error
    );

    if (
        error instanceof
        LoyaltyServiceError
    ) {
        return res
            .status(
                error.statusCode || 400
            )
            .json({
                success: false,
                code:
                    error.code,
                message:
                    error.message
            });
    }

    return res
        .status(500)
        .json({
            success: false,
            message:
                defaultMessage,
            error:
                error.message
        });
};

// =========================================
// Admin Manual Points Adjustment
// POST /api/loyalty/admin/adjust-points
// =========================================

exports.adjustCustomerPoints =
    async (
        req,
        res
    ) => {
        try {
            const {
    points,
    qualifiesForLifetime = false,
    reason,
    referenceNumber = null,
    metadata = null
} = req.body;

const customerId =
    req.params.customerId ||
    req.body.customerId;

            const adminId =
                req.admin?.id ||
                req.user?.id ||
                null;

            const result =
                await applyManualAdjustment({
                    customerId,
                    points,
                    qualifiesForLifetime,
                    reason,
                    referenceNumber,
                    createdByAdminId:
                        adminId,
                    metadata
                });

            return res.json({
                success: true,

                message:
                    result.alreadyProcessed
                        ? "This adjustment was already processed."
                        : "Customer loyalty points adjusted successfully.",

                alreadyProcessed:
                    result.alreadyProcessed,

                membershipChanged:
                    result.membershipChanged ||
                    false,

                rewards:
                    result.rewards ||
                    null,

                transaction:
                    result.transaction
            });

        } catch (error) {
            return handleControllerError(
                error,
                res,
                "Unable to adjust customer loyalty points."
            );
        }
    };

// =========================================
// Customer Reward Redemption
// POST /api/loyalty/redeem
// =========================================

exports.redeemCustomerPoints =
    async (
        req,
        res
    ) => {
        try {
            const customerId =
                req.customer?.id ||
                req.user?.id ||
                req.customerId;

            if (!customerId) {
                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Customer authentication is required."
                    });
            }

            const {
                points,
                referenceNumber = null,
                description = null,
                metadata = null
            } = req.body;

            const result =
                await redeemRewardPoints({
                    customerId,
                    points,
                    referenceNumber,
                    description,
                    metadata
                });

            return res.json({
                success: true,

                message:
                    result.alreadyProcessed
                        ? "This reward redemption was already processed."
                        : "Reward points redeemed successfully.",

                alreadyProcessed:
                    result.alreadyProcessed,

                rewards:
                    result.rewards ||
                    null,

                transaction:
                    result.transaction
            });

        } catch (error) {
            return handleControllerError(
                error,
                res,
                "Unable to redeem reward points."
            );
        }
    };

// =========================================
// Customer Transaction History
// GET /api/loyalty/transactions
// =========================================

exports.getCustomerTransactions =
    async (
        req,
        res
    ) => {
        try {
            const customerId =
                req.customer?.id ||
                req.user?.id ||
                req.customerId;

            if (!customerId) {
                return res
                    .status(401)
                    .json({
                        success: false,
                        message:
                            "Customer authentication is required."
                    });
            }

            const page =
                Math.max(
                    Number.parseInt(
                        req.query.page,
                        10
                    ) || 1,
                    1
                );

            const limit =
                Math.min(
                    Math.max(
                        Number.parseInt(
                            req.query.limit,
                            10
                        ) || 20,
                        1
                    ),
                    100
                );

            const offset =
                (page - 1) *
                limit;

            const conditions = [
                "customer_id = ?"
            ];

            const values = [
                customerId
            ];

            if (
                req.query.transactionType
            ) {
                conditions.push(
                    "transaction_type = ?"
                );

                values.push(
                    req.query.transactionType
                );
            }

            if (req.query.fromDate) {
                conditions.push(
                    "DATE(created_at) >= ?"
                );

                values.push(
                    req.query.fromDate
                );
            }

            if (req.query.toDate) {
                conditions.push(
                    "DATE(created_at) <= ?"
                );

                values.push(
                    req.query.toDate
                );
            }

            const whereClause =
                `WHERE ${conditions.join(
                    " AND "
                )}`;

            const [[countRow]] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM customer_loyalty_transactions
                    ${whereClause}
                    `,
                    values
                );

            const [transactions] =
                await db.query(
                    `
                    SELECT
                        id,
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
                        metadata,
                        created_at
                    FROM customer_loyalty_transactions
                    ${whereClause}
                    ORDER BY
                        id DESC
                    LIMIT ?
                    OFFSET ?
                    `,
                    [
                        ...values,
                        limit,
                        offset
                    ]
                );

            const total =
                Number(
                    countRow.total || 0
                );

            return res.json({
                success: true,

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(
                            total /
                            limit
                        )
                },

                transactions
            });

        } catch (error) {
            return handleControllerError(
                error,
                res,
                "Unable to load loyalty transaction history."
            );
        }
    };

// =========================================
// Admin Customer Transaction History
// GET /api/loyalty/admin/transactions/:customerId
// =========================================

exports.getAdminCustomerTransactions =
    async (
        req,
        res
    ) => {
        try {
            const customerId =
                Number.parseInt(
                    req.params.customerId,
                    10
                );

            if (
                !Number.isInteger(
                    customerId
                ) ||
                customerId <= 0
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            "A valid customer ID is required."
                    });
            }

            const page =
                Math.max(
                    Number.parseInt(
                        req.query.page,
                        10
                    ) || 1,
                    1
                );

            const limit =
                Math.min(
                    Math.max(
                        Number.parseInt(
                            req.query.limit,
                            10
                        ) || 20,
                        1
                    ),
                    100
                );

            const offset =
                (page - 1) *
                limit;

            const conditions = [
                "clt.customer_id = ?"
            ];

            const values = [
                customerId
            ];

            if (
                req.query.transactionType
            ) {
                conditions.push(
                    "clt.transaction_type = ?"
                );

                values.push(
                    req.query.transactionType
                );
            }

            if (req.query.fromDate) {
                conditions.push(
                    "DATE(clt.created_at) >= ?"
                );

                values.push(
                    req.query.fromDate
                );
            }

            if (req.query.toDate) {
                conditions.push(
                    "DATE(clt.created_at) <= ?"
                );

                values.push(
                    req.query.toDate
                );
            }

            const whereClause =
                `WHERE ${conditions.join(
                    " AND "
                )}`;

            const [[customer]] =
                await db.query(
                    `
                    SELECT
                        c.id,
                        c.full_name,
                        c.email,
                        c.phone,

                        COALESCE(
                            cr.reward_points,
                            0
                        ) AS reward_points,

                        COALESCE(
                            cr.lifetime_points,
                            0
                        ) AS lifetime_points,

                        COALESCE(
                            cr.membership_level,
                            'Bronze'
                        ) AS membership_level

                    FROM customers c

                    LEFT JOIN customer_rewards cr
                        ON cr.customer_id =
                           c.id

                    WHERE c.id = ?

                    LIMIT 1
                    `,
                    [customerId]
                );

            if (!customer) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            "Customer not found."
                    });
            }

            const [[countRow]] =
                await db.query(
                    `
                    SELECT
                        COUNT(*) AS total
                    FROM customer_loyalty_transactions clt
                    ${whereClause}
                    `,
                    values
                );

            const [transactions] =
                await db.query(
                    `
                    SELECT
                        clt.id,
                        clt.customer_id,
                        clt.transaction_type,
                        clt.points_change,
                        clt.lifetime_points_change,
                        clt.balance_before,
                        clt.balance_after,
                        clt.lifetime_before,
                        clt.lifetime_after,
                        clt.membership_before,
                        clt.membership_after,
                        clt.source_type,
                        clt.source_id,
                        clt.reference_number,
                        clt.description,
                        clt.created_by_admin_id,
                        clt.metadata,
                        clt.created_at

                    FROM customer_loyalty_transactions clt

                    ${whereClause}

                    ORDER BY
                        clt.id DESC

                    LIMIT ?
                    OFFSET ?
                    `,
                    [
                        ...values,
                        limit,
                        offset
                    ]
                );

            const total =
                Number(
                    countRow.total || 0
                );

            return res.json({
                success: true,

                customer: {
                    id:
                        customer.id,

                    fullName:
                        customer.full_name,

                    email:
                        customer.email,

                    phone:
                        customer.phone,

                    rewardPoints:
                        Number(
                            customer.reward_points || 0
                        ),

                    lifetimePoints:
                        Number(
                            customer.lifetime_points || 0
                        ),

                    membershipLevel:
                        customer.membership_level
                },

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(
                            total /
                            limit
                        )
                },

                transactions
            });

        } catch (error) {
            return handleControllerError(
                error,
                res,
                "Unable to load customer loyalty transactions."
            );
        }
    };