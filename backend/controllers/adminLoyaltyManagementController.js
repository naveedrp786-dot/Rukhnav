"use strict";

const db = require("../config/db");

// =========================================
// Helpers
// =========================================

function createError(
    message,
    statusCode = 400
) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function sendError(res, error) {
    console.error(
        "Admin loyalty management error:",
        error
    );

    return res
        .status(error.statusCode || 500)
        .json({
            success: false,
            message:
                error.statusCode &&
                error.statusCode < 500
                    ? error.message
                    : "An unexpected loyalty-management error occurred.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
}

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function toBooleanNumber(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    )
        ? 1
        : 0;
}

function getAdminId(req) {
    return (
        req.admin?.id ||
        req.user?.id ||
        req.user?.adminId ||
        req.adminId ||
        null
    );
}

async function getCategoryForPoints(
    connection,
    lifetimePoints
) {
    const [rows] =
        await connection.query(
            `
            SELECT
                id,
                category_name,
                minimum_lifetime_points
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
            "No active loyalty category is available for these points.",
            500
        );
    }

    return rows[0];
}

// =========================================
// Get All Loyalty Categories
// =========================================

exports.getCategories = async (
    req,
    res
) => {
    try {
        const [categories] =
            await db.query(
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
                    free_delivery_enabled,
                    description,
                    status,
                    created_at,
                    updated_at
                FROM customer_loyalty_categories
                ORDER BY
                    minimum_lifetime_points ASC
                `
            );

        return res.json({
            success: true,
            count: categories.length,
            categories: categories.map(
                (category) => ({
                    ...category,

                    minimum_lifetime_points:
                        toNumber(
                            category
                                .minimum_lifetime_points
                        ),

                    points_multiplier:
                        toNumber(
                            category
                                .points_multiplier
                        ),

                    discount_percentage:
                        toNumber(
                            category
                                .discount_percentage
                        ),

                    birthday_bonus_points:
                        toNumber(
                            category
                                .birthday_bonus_points
                        ),

                    referral_bonus_points:
                        toNumber(
                            category
                                .referral_bonus_points
                        ),

                    event_menu_enabled:
                        Boolean(
                            category
                                .event_menu_enabled
                        ),

                    email_reminders_enabled:
                        Boolean(
                            category
                                .email_reminders_enabled
                        ),

                    whatsapp_reminders_enabled:
                        Boolean(
                            category
                                .whatsapp_reminders_enabled
                        ),

                    sms_reminders_enabled:
                        Boolean(
                            category
                                .sms_reminders_enabled
                        ),

                    priority_support_enabled:
                        Boolean(
                            category
                                .priority_support_enabled
                        ),

                    free_delivery_enabled:
                        Boolean(
                            category
                                .free_delivery_enabled
                        )
                })
            )
        });
    } catch (error) {
        return sendError(res, error);
    }
};
// =========================================
// Get Loyalty Dashboard Summary
// =========================================

exports.getDashboardSummary = async (
    req,
    res
) => {
    try {
        const [rows] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total_customers,

                    COALESCE(
                        SUM(cr.reward_points),
                        0
                    ) AS total_available_points,

                    COALESCE(
                        SUM(cr.lifetime_points),
                        0
                    ) AS total_lifetime_points,

                    SUM(
                        CASE
                            WHEN cr.membership_level =
                                'Bronze'
                            THEN 1
                            ELSE 0
                        END
                    ) AS bronze_members,

                    SUM(
                        CASE
                            WHEN cr.membership_level =
                                'Silver'
                            THEN 1
                            ELSE 0
                        END
                    ) AS silver_members,

                    SUM(
                        CASE
                            WHEN cr.membership_level =
                                'Gold'
                            THEN 1
                            ELSE 0
                        END
                    ) AS gold_members,

                    SUM(
                        CASE
                            WHEN cr.membership_level =
                                'Platinum'
                            THEN 1
                            ELSE 0
                        END
                    ) AS platinum_members

                FROM customer_rewards cr

                JOIN customers c
                    ON c.id = cr.customer_id

                WHERE c.deleted_at IS NULL
                `
            );

        const summary =
            rows[0] || {};

        return res.json({
            success: true,
            summary: {
                totalCustomers:
                    Number(
                        summary.total_customers ||
                        0
                    ),

                totalAvailablePoints:
                    Number(
                        summary
                            .total_available_points ||
                        0
                    ),

                totalLifetimePoints:
                    Number(
                        summary
                            .total_lifetime_points ||
                        0
                    ),

                bronzeMembers:
                    Number(
                        summary.bronze_members ||
                        0
                    ),

                silverMembers:
                    Number(
                        summary.silver_members ||
                        0
                    ),

                goldMembers:
                    Number(
                        summary.gold_members ||
                        0
                    ),

                platinumMembers:
                    Number(
                        summary
                            .platinum_members ||
                        0
                    )
            }
        });
    } catch (error) {
        return sendError(
            res,
            error
        );
    }
};

// =========================================
// Update Loyalty Category
// =========================================

exports.updateCategory = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        const categoryId =
            Number(req.params.id);

        if (
            !Number.isInteger(categoryId) ||
            categoryId <= 0
        ) {
            throw createError(
                "A valid category ID is required."
            );
        }

        const minimumLifetimePoints =
            Number(
                req.body
                    .minimum_lifetime_points
            );

        const pointsMultiplier =
            Number(
                req.body.points_multiplier
            );

        const discountPercentage =
            Number(
                req.body
                    .discount_percentage
            );

        const birthdayBonusPoints =
            Number(
                req.body
                    .birthday_bonus_points
            );

        const referralBonusPoints =
            Number(
                req.body
                    .referral_bonus_points
            );

        const description =
            String(
                req.body.description || ""
            ).trim();

        const status =
            req.body.status === "Inactive"
                ? "Inactive"
                : "Active";

        if (
            !Number.isInteger(
                minimumLifetimePoints
            ) ||
            minimumLifetimePoints < 0
        ) {
            throw createError(
                "Minimum lifetime points must be a non-negative integer."
            );
        }

        if (
            !Number.isFinite(
                pointsMultiplier
            ) ||
            pointsMultiplier < 1 ||
            pointsMultiplier > 10
        ) {
            throw createError(
                "Points multiplier must be between 1 and 10."
            );
        }

        if (
            !Number.isFinite(
                discountPercentage
            ) ||
            discountPercentage < 0 ||
            discountPercentage > 100
        ) {
            throw createError(
                "Discount percentage must be between 0 and 100."
            );
        }

        if (
            !Number.isInteger(
                birthdayBonusPoints
            ) ||
            birthdayBonusPoints < 0 ||
            !Number.isInteger(
                referralBonusPoints
            ) ||
            referralBonusPoints < 0
        ) {
            throw createError(
                "Bonus points must be non-negative integers."
            );
        }

        if (description.length > 255) {
            throw createError(
                "Description cannot exceed 255 characters."
            );
        }

        await connection.beginTransaction();

        const [categoryRows] =
            await connection.query(
                `
                SELECT
                    id,
                    category_name
                FROM customer_loyalty_categories
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [categoryId]
            );

        if (categoryRows.length === 0) {
            throw createError(
                "Loyalty category was not found.",
                404
            );
        }

        const category =
            categoryRows[0];

        if (
            category.category_name ===
                "Bronze" &&
            (
                minimumLifetimePoints !== 0 ||
                status !== "Active"
            )
        ) {
            throw createError(
                "Bronze must remain active with zero minimum points."
            );
        }

        const [duplicateRows] =
            await connection.query(
                `
                SELECT id
                FROM customer_loyalty_categories
                WHERE
                    minimum_lifetime_points = ?
                    AND id <> ?
                    AND status = 'Active'
                LIMIT 1
                `,
                [
                    minimumLifetimePoints,
                    categoryId
                ]
            );

        if (duplicateRows.length > 0) {
            throw createError(
                "Another active category already uses this minimum-points value."
            );
        }

        await connection.query(
            `
            UPDATE customer_loyalty_categories
            SET
                minimum_lifetime_points = ?,
                points_multiplier = ?,
                discount_percentage = ?,
                birthday_bonus_points = ?,
                referral_bonus_points = ?,
                event_menu_enabled = ?,
                email_reminders_enabled = ?,
                whatsapp_reminders_enabled = ?,
                sms_reminders_enabled = ?,
                priority_support_enabled = ?,
                free_delivery_enabled = ?,
                description = ?,
                status = ?
            WHERE id = ?
            `,
            [
                minimumLifetimePoints,
                pointsMultiplier,
                discountPercentage,
                birthdayBonusPoints,
                referralBonusPoints,
                toBooleanNumber(
                    req.body
                        .event_menu_enabled
                ),
                toBooleanNumber(
                    req.body
                        .email_reminders_enabled
                ),
                toBooleanNumber(
                    req.body
                        .whatsapp_reminders_enabled
                ),
                toBooleanNumber(
                    req.body
                        .sms_reminders_enabled
                ),
                toBooleanNumber(
                    req.body
                        .priority_support_enabled
                ),
                toBooleanNumber(
                    req.body
                        .free_delivery_enabled
                ),
                description || null,
                status,
                categoryId
            ]
        );

        /*
         * Recalculate every customer's category
         * when category requirements change.
         */
        const [rewardRows] =
            await connection.query(
                `
                SELECT
                    customer_id,
                    lifetime_points,
                    membership_level
                FROM customer_rewards
                FOR UPDATE
                `
            );

        let membershipsChanged = 0;

        for (const rewards of rewardRows) {
            const correctCategory =
                await getCategoryForPoints(
                    connection,
                    toNumber(
                        rewards.lifetime_points
                    )
                );

            if (
                rewards.membership_level !==
                correctCategory.category_name
            ) {
                await connection.query(
                    `
                    UPDATE customer_rewards
                    SET
                        membership_level = ?,
                        membership_changed_at =
                            NOW()
                    WHERE customer_id = ?
                    `,
                    [
                        correctCategory
                            .category_name,
                        rewards.customer_id
                    ]
                );

                membershipsChanged += 1;
            }
        }

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Loyalty category updated successfully.",
            categoryId,
            categoryName:
                category.category_name,
            membershipsChanged
        });
    } catch (error) {
        await connection.rollback();
        return sendError(res, error);
    } finally {
        connection.release();
    }
};

// =========================================
// Get Customer Loyalty List
// =========================================

exports.getCustomers = async (
    req,
    res
) => {
    try {
        const page = Math.max(
            Number(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                Number(req.query.limit) || 20,
                1
            ),
            100
        );

        const offset =
            (page - 1) * limit;

        const search =
            String(
                req.query.search || ""
            ).trim();

        const category =
            String(
                req.query.category || ""
            ).trim();

        const conditions = [
            "c.deleted_at IS NULL"
        ];

        const parameters = [];

        if (search) {
            conditions.push(`
                (
                    c.full_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                    OR c.referral_code LIKE ?
                )
            `);

            const searchValue =
                `%${search}%`;

            parameters.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        if (
            [
                "Bronze",
                "Silver",
                "Gold",
                "Platinum"
            ].includes(category)
        ) {
            conditions.push(
                "cr.membership_level = ?"
            );

            parameters.push(category);
        }

        const whereClause =
            conditions.join(" AND ");

        const [countRows] =
            await db.query(
                `
                SELECT COUNT(*) AS total
                FROM customers c
                JOIN customer_rewards cr
                    ON cr.customer_id = c.id
                WHERE ${whereClause}
                `,
                parameters
            );

        const [customers] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.status,
                    c.referral_code,
                    cr.reward_points,
                    cr.lifetime_points,
                    cr.membership_level,
                    cr.membership_changed_at,
                    cr.total_spent,
                    cr.total_orders,
                    lc.points_multiplier,
                    lc.discount_percentage,
                    lc.event_menu_enabled
                FROM customers c
                JOIN customer_rewards cr
                    ON cr.customer_id = c.id
                JOIN customer_loyalty_categories lc
                    ON lc.category_name =
                        cr.membership_level
                WHERE ${whereClause}
                ORDER BY
                    cr.lifetime_points DESC,
                    c.id DESC
                LIMIT ?
                OFFSET ?
                `,
                [
                    ...parameters,
                    limit,
                    offset
                ]
            );

        const total =
            toNumber(countRows[0].total);

        return res.json({
            success: true,
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(total / limit)
            },
            customers: customers.map(
                (customer) => ({
                    ...customer,
                    reward_points:
                        toNumber(
                            customer.reward_points
                        ),
                    lifetime_points:
                        toNumber(
                            customer.lifetime_points
                        ),
                    total_spent:
                        toNumber(
                            customer.total_spent
                        ),
                    total_orders:
                        toNumber(
                            customer.total_orders
                        ),
                    points_multiplier:
                        toNumber(
                            customer
                                .points_multiplier
                        ),
                    discount_percentage:
                        toNumber(
                            customer
                                .discount_percentage
                        ),
                    event_menu_enabled:
                        Boolean(
                            customer
                                .event_menu_enabled
                        )
                })
            )
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// =========================================
// Get Customer Points History
// =========================================

exports.getCustomerPointsHistory = async (
    req,
    res
) => {
    try {
        const customerId =
            Number(req.params.customerId);

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            throw createError(
                "A valid customer ID is required."
            );
        }

        const [customerRows] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.full_name,
                    c.email,
                    c.phone,
                    cr.reward_points,
                    cr.lifetime_points,
                    cr.membership_level,
                    cr.total_spent,
                    cr.total_orders
                FROM customers c
                JOIN customer_rewards cr
                    ON cr.customer_id = c.id
                WHERE c.id = ?
                LIMIT 1
                `,
                [customerId]
            );

        if (customerRows.length === 0) {
            throw createError(
                "Customer loyalty record was not found.",
                404
            );
        }

        const [transactions] =
            await db.query(
                `
                SELECT
                    id,
                    transaction_type,
                    points,
                    available_balance_after,
                    lifetime_points_after,
                    sale_id,
                    reference_type,
                    reference_id,
                    description,
                    created_by_admin_id,
                    created_at
                FROM customer_points_transactions
                WHERE customer_id = ?
                ORDER BY id DESC
                LIMIT 200
                `,
                [customerId]
            );

        return res.json({
            success: true,
            customer: customerRows[0],
            transactionCount:
                transactions.length,
            transactions
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// =========================================
// Manually Adjust Customer Points
// =========================================

exports.adjustCustomerPoints = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        const customerId =
            Number(req.params.customerId);

        const points =
            Number(req.body.points);

        const reason =
            String(
                req.body.reason || ""
            ).trim();

        const affectLifetimePoints =
            req.body
                .affect_lifetime_points ===
                undefined
                ? true
                : toBooleanNumber(
                    req.body
                        .affect_lifetime_points
                ) === 1;

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            throw createError(
                "A valid customer ID is required."
            );
        }

        if (
            !Number.isInteger(points) ||
            points === 0
        ) {
            throw createError(
                "Points must be a non-zero integer."
            );
        }

        if (!reason) {
            throw createError(
                "A reason for the adjustment is required."
            );
        }

        if (reason.length > 255) {
            throw createError(
                "The adjustment reason cannot exceed 255 characters."
            );
        }

        await connection.beginTransaction();

        const [rewardRows] =
            await connection.query(
                `
                SELECT
                    reward_points,
                    lifetime_points,
                    membership_level
                FROM customer_rewards
                WHERE customer_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [customerId]
            );

        if (rewardRows.length === 0) {
            throw createError(
                "Customer rewards record was not found.",
                404
            );
        }

        const rewards =
            rewardRows[0];

        const newAvailablePoints =
            toNumber(
                rewards.reward_points
            ) + points;

        const newLifetimePoints =
            affectLifetimePoints
                ? toNumber(
                    rewards.lifetime_points
                ) + points
                : toNumber(
                    rewards.lifetime_points
                );

        if (newAvailablePoints < 0) {
            throw createError(
                "The adjustment would make available points negative."
            );
        }

        if (newLifetimePoints < 0) {
            throw createError(
                "The adjustment would make lifetime points negative."
            );
        }

        const newCategory =
            await getCategoryForPoints(
                connection,
                newLifetimePoints
            );

        const categoryChanged =
            rewards.membership_level !==
            newCategory.category_name;

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
                newAvailablePoints,
                newLifetimePoints,
                newCategory.category_name,
                newCategory.category_name,
                customerId
            ]
        );

        await connection.query(
            `
            INSERT INTO customer_points_transactions (
                customer_id,
                transaction_type,
                points,
                available_balance_after,
                lifetime_points_after,
                reference_type,
                description,
                created_by_admin_id
            )
            VALUES (
                ?,
                'Manual Adjustment',
                ?,
                ?,
                ?,
                'Admin Adjustment',
                ?,
                ?
            )
            `,
            [
                customerId,
                points,
                newAvailablePoints,
                newLifetimePoints,
                reason,
                getAdminId(req)
            ]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: categoryChanged
                ? `Points adjusted and membership changed to ${newCategory.category_name}.`
                : "Customer points adjusted successfully.",
            adjustment: {
                customerId,
                points,
                affectLifetimePoints,
                availablePoints:
                    newAvailablePoints,
                lifetimePoints:
                    newLifetimePoints,
                previousCategory:
                    rewards.membership_level,
                currentCategory:
                    newCategory.category_name,
                categoryChanged,
                reason
            }
        });
    } catch (error) {
        await connection.rollback();
        return sendError(res, error);
    } finally {
        connection.release();
    }
};