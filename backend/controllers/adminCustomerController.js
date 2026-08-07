"use strict";

const bcrypt = require("bcrypt");
const db = require("../config/db");
const logger = require("../utils/logger");

// =====================================================
// Response Helpers
// =====================================================

const successResponse = (
    res,
    message,
    data = {},
    statusCode = 200
) => {
    return res.status(statusCode).json({
        success: true,
        message,
        ...data
    });
};

const errorResponse = (
    res,
    message,
    statusCode = 500,
    error = null
) => {
    const response = {
        success: false,
        message
    };

    if (
        process.env.NODE_ENV !== "production" &&
        error
    ) {
        response.error =
            error.message || String(error);
    }

    return res
        .status(statusCode)
        .json(response);
};

// =====================================================
// General Helpers
// =====================================================

const cleanText = (value) => {
    return String(value || "").trim();
};

const normaliseEmail = (value) => {
    return (
        cleanText(value).toLowerCase() ||
        null
    );
};

const normalisePhone = (value) => {
    const original = cleanText(value);

    if (!original) {
        return null;
    }

    let digits =
        original.replace(/\D/g, "");

    if (digits.startsWith("0092")) {
        digits = digits.substring(2);
    }

    if (digits.startsWith("92")) {
        return `+${digits}`;
    }

    if (digits.startsWith("0")) {
        return `+92${digits.substring(1)}`;
    }

    return `+${digits}`;
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
};

const isValidPhone = (phone) => {
    return /^\+[1-9]\d{9,14}$/
        .test(phone);
};

const parsePositiveInteger = (
    value,
    fallback,
    maximum = null
) => {
    const parsed =
        Number.parseInt(value, 10);

    if (
        !Number.isInteger(parsed) ||
        parsed <= 0
    ) {
        return fallback;
    }

    if (
        maximum &&
        parsed > maximum
    ) {
        return maximum;
    }

    return parsed;
};

const parseBoolean = (
    value,
    fallback = false
) => {
    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    ) {
        return true;
    }

    if (
        value === false ||
        value === 0 ||
        value === "0" ||
        value === "false"
    ) {
        return false;
    }

    return fallback;
};

const ALLOWED_STATUSES = [
    "Active",
    "Inactive",
    "Suspended",
    "Pending Verification",
    "Deletion Requested"
];

const ALLOWED_MEMBERSHIPS = [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum"
];

// =====================================================
// Customer Dashboard
// GET /api/admin/customers/dashboard
// =====================================================

exports.getCustomerDashboard = async (
    req,
    res
) => {
    try {
        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_customers,

                    SUM(
                        CASE
                            WHEN status = 'Active'
                            THEN 1
                            ELSE 0
                        END
                    ) AS active_customers,

                    SUM(
                        CASE
                            WHEN status =
                                'Pending Verification'
                            THEN 1
                            ELSE 0
                        END
                    ) AS pending_verification,

                    SUM(
                        CASE
                            WHEN status = 'Suspended'
                            THEN 1
                            ELSE 0
                        END
                    ) AS suspended_customers,

                    SUM(
                        CASE
                            WHEN status = 'Inactive'
                            THEN 1
                            ELSE 0
                        END
                    ) AS inactive_customers,

                    SUM(
                        CASE
                            WHEN status =
                                'Deletion Requested'
                            THEN 1
                            ELSE 0
                        END
                    ) AS deletion_requested,

                    SUM(
                        CASE
                            WHEN created_at >=
                                DATE_FORMAT(
                                    CURRENT_DATE,
                                    '%Y-%m-01'
                                )
                            THEN 1
                            ELSE 0
                        END
                    ) AS new_this_month

                FROM customers

                WHERE deleted_at IS NULL
            `);

        const [[loyalty]] =
            await db.query(`
                SELECT
                    COALESCE(
                        SUM(reward_points),
                        0
                    ) AS total_available_points,

                    COALESCE(
                        SUM(lifetime_points),
                        0
                    ) AS total_lifetime_points,

                    SUM(
                        CASE
                            WHEN membership_level =
                                'Bronze'
                            THEN 1
                            ELSE 0
                        END
                    ) AS bronze_members,

                    SUM(
                        CASE
                            WHEN membership_level =
                                'Silver'
                            THEN 1
                            ELSE 0
                        END
                    ) AS silver_members,

                    SUM(
                        CASE
                            WHEN membership_level =
                                'Gold'
                            THEN 1
                            ELSE 0
                        END
                    ) AS gold_members,

                    SUM(
                        CASE
                            WHEN membership_level =
                                'Platinum'
                            THEN 1
                            ELSE 0
                        END
                    ) AS platinum_members

                FROM customer_rewards
            `);

        return successResponse(
            res,
            "Customer dashboard fetched successfully.",
            {
                dashboard: {
                    totalCustomers:
                        Number(
                            summary
                                .total_customers || 0
                        ),

                    activeCustomers:
                        Number(
                            summary
                                .active_customers || 0
                        ),

                    pendingVerification:
                        Number(
                            summary
                                .pending_verification || 0
                        ),

                    suspendedCustomers:
                        Number(
                            summary
                                .suspended_customers || 0
                        ),

                    inactiveCustomers:
                        Number(
                            summary
                                .inactive_customers || 0
                        ),

                    deletionRequested:
                        Number(
                            summary
                                .deletion_requested || 0
                        ),

                    newThisMonth:
                        Number(
                            summary
                                .new_this_month || 0
                        ),

                    totalAvailablePoints:
                        Number(
                            loyalty
                                .total_available_points || 0
                        ),

                    totalLifetimePoints:
                        Number(
                            loyalty
                                .total_lifetime_points || 0
                        ),

                    bronzeMembers:
                        Number(
                            loyalty
                                .bronze_members || 0
                        ),

                    silverMembers:
                        Number(
                            loyalty
                                .silver_members || 0
                        ),

                    goldMembers:
                        Number(
                            loyalty
                                .gold_members || 0
                        ),

                    platinumMembers:
                        Number(
                            loyalty
                                .platinum_members || 0
                        )
                }
            }
        );
    } catch (error) {
        logger.error(
            `Customer dashboard error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load customer dashboard.",
            500,
            error
        );
    }
};

// =====================================================
// Get All Customers
// GET /api/admin/customers
// =====================================================

exports.getCustomers = async (
    req,
    res
) => {
    try {
        const page =
            parsePositiveInteger(
                req.query.page,
                1
            );

        const limit =
            parsePositiveInteger(
                req.query.limit,
                10,
                100
            );

        const offset =
            (page - 1) * limit;

        const search =
            cleanText(req.query.search);

        const status =
            cleanText(req.query.status);

        const membership =
            cleanText(
                req.query.membership
            );

        const fromDate =
            cleanText(
                req.query.from_date
            );

        const toDate =
            cleanText(
                req.query.to_date
            );

        const sortBy =
            cleanText(
                req.query.sort_by
            );

        const sortOrder =
            cleanText(
                req.query.sort_order
            ).toUpperCase() === "ASC"
                ? "ASC"
                : "DESC";

        const allowedSortColumns = {
            id: "c.id",
            name: "c.full_name",
            created_at: "c.created_at",
            last_login_at:
                "c.last_login_at",
            total_orders:
                "total_orders",
            total_spent:
                "total_spent",
            points:
                "available_points"
        };

        const orderColumn =
            allowedSortColumns[sortBy] ||
            "c.id";

        const where = [
            "c.deleted_at IS NULL"
        ];

        const params = [];

        if (search) {
            where.push(`
                (
                    c.full_name LIKE ?
                    OR c.first_name LIKE ?
                    OR c.last_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                    OR c.referral_code LIKE ?
                    OR CAST(c.id AS CHAR) LIKE ?
                )
            `);

            const pattern =
                `%${search}%`;

            params.push(
                pattern,
                pattern,
                pattern,
                pattern,
                pattern,
                pattern,
                pattern
            );
        }

        if (
            status &&
            ALLOWED_STATUSES.includes(
                status
            )
        ) {
            where.push(
                "c.status = ?"
            );

            params.push(status);
        }

        if (
            membership &&
            ALLOWED_MEMBERSHIPS.includes(
                membership
            )
        ) {
            where.push(`
                COALESCE(
                    cr.membership_level,
                    'Bronze'
                ) = ?
            `);

            params.push(membership);
        }

        if (fromDate) {
            where.push(
                "DATE(c.created_at) >= ?"
            );

            params.push(fromDate);
        }

        if (toDate) {
            where.push(
                "DATE(c.created_at) <= ?"
            );

            params.push(toDate);
        }

        const whereSql =
            where.join(" AND ");

        const [[countRow]] =
            await db.query(
                `
                SELECT
                    COUNT(
                        DISTINCT c.id
                    ) AS total

                FROM customers c

                LEFT JOIN customer_rewards cr
                    ON cr.customer_id =
                        c.id

                WHERE ${whereSql}
                `,
                params
            );

        const [customers] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.city,
                    c.country,
                    c.postal_code,
                    c.status,
                    c.referral_code,
                    c.email_verified_at,
                    c.phone_verified_at,
                    c.last_login_at,
                    c.created_at,
                    c.updated_at,

                    COALESCE(
                        cr.membership_level,
                        'Bronze'
                    ) AS membership_level,

                    COALESCE(
                        cr.reward_points,
                        0
                    ) AS available_points,

                    COALESCE(
                        cr.lifetime_points,
                        0
                    ) AS lifetime_points,

                    COUNT(
                        DISTINCT o.id
                    ) AS total_orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN o.order_status
                                    != 'cancelled'
                                THEN o.grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_spent

                FROM customers c

                LEFT JOIN customer_rewards cr
                    ON cr.customer_id =
                        c.id

                LEFT JOIN orders o
                    ON o.customer_id =
                        c.id

                WHERE ${whereSql}

                GROUP BY
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.city,
                    c.country,
                    c.postal_code,
                    c.status,
                    c.referral_code,
                    c.email_verified_at,
                    c.phone_verified_at,
                    c.last_login_at,
                    c.created_at,
                    c.updated_at,
                    cr.membership_level,
                    cr.reward_points,
                    cr.lifetime_points

                ORDER BY
                    ${orderColumn}
                    ${sortOrder}

                LIMIT ?
                OFFSET ?
                `,
                [
                    ...params,
                    limit,
                    offset
                ]
            );

        const total =
            Number(
                countRow.total || 0
            );

        return successResponse(
            res,
            "Customers fetched successfully.",
            {
                customers:
                    customers.map(
                        (customer) => ({
                            ...customer,

                            available_points:
                                Number(
                                    customer
                                        .available_points || 0
                                ),

                            lifetime_points:
                                Number(
                                    customer
                                        .lifetime_points || 0
                                ),

                            total_orders:
                                Number(
                                    customer
                                        .total_orders || 0
                                ),

                            total_spent:
                                Number(
                                    customer
                                        .total_spent || 0
                                )
                        })
                    ),

                pagination: {
                    page,
                    limit,
                    total,

                    totalPages:
                        Math.ceil(
                            total / limit
                        )
                },

                filters: {
                    search,
                    status:
                        status || null,

                    membership:
                        membership || null,

                    fromDate:
                        fromDate || null,

                    toDate:
                        toDate || null
                }
            }
        );
    } catch (error) {
        logger.error(
            `Get customers error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load customers.",
            500,
            error
        );
    }
};

// =====================================================
// Get Customer By ID
// GET /api/admin/customers/:id
// =====================================================

exports.getCustomerById = async (
    req,
    res
) => {
    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        if (
            !Number.isInteger(
                customerId
            ) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        const [customerRows] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.city,
                    c.country,
                    c.postal_code,
                    c.status,
                    c.referral_code,
                    c.referred_by_customer_id,
                    c.email_verified_at,
                    c.phone_verified_at,
                    c.email_reminders_enabled,
                    c.whatsapp_reminders_enabled,
                    c.sms_reminders_enabled,
                    c.failed_login_attempts,
                    c.account_locked_until,
                    c.last_login_at,
                    c.created_at,
                    c.updated_at,

                    referrer.full_name
                        AS referred_by_name,

                    referrer.referral_code
                        AS referrer_code,

                    COALESCE(
                        cr.membership_level,
                        'Bronze'
                    ) AS membership_level,

                    COALESCE(
                        cr.reward_points,
                        0
                    ) AS available_points,

                    COALESCE(
                        cr.lifetime_points,
                        0
                    ) AS lifetime_points,

                    cr.membership_changed_at

                FROM customers c

                LEFT JOIN customers referrer
                    ON referrer.id =
                        c.referred_by_customer_id

                LEFT JOIN customer_rewards cr
                    ON cr.customer_id =
                        c.id

                WHERE c.id = ?
                AND c.deleted_at IS NULL

                LIMIT 1
                `,
                [customerId]
            );

        if (
            customerRows.length === 0
        ) {
            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        const [[orderSummary]] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total_orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN order_status
                                    != 'cancelled'
                                THEN grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_spent,

                    COALESCE(
                        AVG(
                            CASE
                                WHEN order_status
                                    != 'cancelled'
                                THEN grand_total
                            END
                        ),
                        0
                    ) AS average_order_value,

                    SUM(
                        CASE
                            WHEN order_status =
                                'pending'
                            THEN 1
                            ELSE 0
                        END
                    ) AS pending_orders,

                    SUM(
                        CASE
                            WHEN order_status =
                                'delivered'
                            THEN 1
                            ELSE 0
                        END
                    ) AS delivered_orders,

                    SUM(
                        CASE
                            WHEN order_status =
                                'cancelled'
                            THEN 1
                            ELSE 0
                        END
                    ) AS cancelled_orders,

                    MAX(created_at)
                        AS last_order_at

                FROM orders

                WHERE customer_id = ?
                `,
                [customerId]
            );

        const [recentOrders] = await db.query(`
    SELECT
        id,
        order_number,
        order_status,
        payment_method,
        payment_status,
        delivery_charges,
        discount_amount,
        grand_total,
        tracking_number,
        tracking_url,
        estimated_delivery_date,
        created_at

    FROM orders

    WHERE customer_id = ?

    ORDER BY id DESC

    LIMIT 10
`,
[customerId]);

        const [[eventSummary]] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total_events,

                    SUM(
                        CASE
                            WHEN status = 'Active'
                            THEN 1
                            ELSE 0
                        END
                    ) AS active_events

                FROM customer_events

                WHERE customer_id = ?
                `,
                [customerId]
            );

        const [[referralSummary]] =
            await db.query(
                `
                SELECT
                    COUNT(*)
                        AS total_referrals,

                    SUM(
                        CASE
                            WHEN status =
                                'Qualified'
                            THEN 1
                            ELSE 0
                        END
                    ) AS qualified_referrals,

                    SUM(
                        CASE
                            WHEN status =
                                'Rewarded'
                            THEN 1
                            ELSE 0
                        END
                    ) AS rewarded_referrals,

                    COALESCE(
                        SUM(
                            referrer_reward_points
                        ),
                        0
                    ) AS referral_points

                FROM customer_referrals

                WHERE
                    referrer_customer_id = ?
                `,
                [customerId]
            );

        const customer = {
            ...customerRows[0],

            available_points:
                Number(
                    customerRows[0]
                        .available_points || 0
                ),

            lifetime_points:
                Number(
                    customerRows[0]
                        .lifetime_points || 0
                )
        };

        return successResponse(
            res,
            "Customer fetched successfully.",
            {
                customer,

                orderSummary: {
                    totalOrders:
                        Number(
                            orderSummary
                                .total_orders || 0
                        ),

                    totalSpent:
                        Number(
                            orderSummary
                                .total_spent || 0
                        ),

                    averageOrderValue:
                        Number(
                            orderSummary
                                .average_order_value || 0
                        ),

                    pendingOrders:
                        Number(
                            orderSummary
                                .pending_orders || 0
                        ),

                    deliveredOrders:
                        Number(
                            orderSummary
                                .delivered_orders || 0
                        ),

                    cancelledOrders:
                        Number(
                            orderSummary
                                .cancelled_orders || 0
                        ),

                    lastOrderAt:
                        orderSummary
                            .last_order_at ||
                        null
                },

                eventSummary: {
                    totalEvents:
                        Number(
                            eventSummary
                                .total_events || 0
                        ),

                    activeEvents:
                        Number(
                            eventSummary
                                .active_events || 0
                        )
                },

                referralSummary: {
                    totalReferrals:
                        Number(
                            referralSummary
                                .total_referrals || 0
                        ),

                    qualifiedReferrals:
                        Number(
                            referralSummary
                                .qualified_referrals || 0
                        ),

                    rewardedReferrals:
                        Number(
                            referralSummary
                                .rewarded_referrals || 0
                        ),

                    referralPoints:
                        Number(
                            referralSummary
                                .referral_points || 0
                        )
                },

                recentOrders:
                    recentOrders.map(
                        (order) => ({
                            ...order,

                            delivery_charges:
                                Number(
                                    order
                                        .delivery_charges || 0
                                ),

                            discount_amount:
                                Number(
                                    order
                                        .discount_amount || 0
                                ),

                            grand_total:
                                Number(
                                    order
                                        .grand_total || 0
                                )
                        })
                    )
            }
        );
    } catch (error) {
        logger.error(
            `Get customer details error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load customer details.",
            500,
            error
        );
    }
};

// =====================================================
// Update Customer
// PUT /api/admin/customers/:id
// =====================================================

exports.updateCustomer = async (
    req,
    res
) => {
    let connection;

    try {
        connection =
            await db.getConnection();

        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        if (
            !Number.isInteger(
                customerId
            ) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        const {
            first_name,
            last_name,
            full_name,
            email,
            phone,
            address,
            city,
            country,
            postal_code,
            email_reminders_enabled,
            whatsapp_reminders_enabled,
            sms_reminders_enabled
        } = req.body;

        const cleanFirstName =
            cleanText(first_name);

        const cleanLastName =
            cleanText(last_name);

        const cleanFullName =
            cleanText(full_name) ||
            [
                cleanFirstName,
                cleanLastName
            ]
                .filter(Boolean)
                .join(" ");

        const cleanEmail =
            normaliseEmail(email);

        const cleanPhone =
            normalisePhone(phone);

        if (!cleanFullName) {
            return errorResponse(
                res,
                "Customer name is required.",
                400
            );
        }

        if (
            !cleanEmail &&
            !cleanPhone
        ) {
            return errorResponse(
                res,
                "An email address or phone number is required.",
                400
            );
        }

        if (
            cleanEmail &&
            !isValidEmail(cleanEmail)
        ) {
            return errorResponse(
                res,
                "Please enter a valid email address.",
                400
            );
        }

        if (
            cleanPhone &&
            !isValidPhone(cleanPhone)
        ) {
            return errorResponse(
                res,
                "Please enter a valid phone number.",
                400
            );
        }

        await connection
            .beginTransaction();

        const [existingRows] =
            await connection.query(
                `
                SELECT
                    id,
                    email,
                    phone

                FROM customers

                WHERE id = ?
                AND deleted_at IS NULL

                LIMIT 1
                `,
                [customerId]
            );

        if (
            existingRows.length === 0
        ) {
            await connection.rollback();

            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        const [duplicateRows] =
            await connection.query(
                `
                SELECT
                    id,
                    email,
                    phone

                FROM customers

                WHERE id != ?
                AND deleted_at IS NULL
                AND (
                    (
                        ? IS NOT NULL
                        AND email = ?
                    )
                    OR
                    (
                        ? IS NOT NULL
                        AND phone = ?
                    )
                )

                LIMIT 1
                `,
                [
                    customerId,
                    cleanEmail,
                    cleanEmail,
                    cleanPhone,
                    cleanPhone
                ]
            );

        if (
            duplicateRows.length > 0
        ) {
            await connection.rollback();

            const duplicate =
                duplicateRows[0];

            let message =
                "Another customer already uses these contact details.";

            if (
                cleanEmail &&
                duplicate.email ===
                    cleanEmail
            ) {
                message =
                    "Another customer already uses this email address.";
            } else if (
                cleanPhone &&
                duplicate.phone ===
                    cleanPhone
            ) {
                message =
                    "Another customer already uses this phone number.";
            }

            return errorResponse(
                res,
                message,
                409
            );
        }

        await connection.query(
            `
            UPDATE customers

            SET
                first_name = ?,
                last_name = ?,
                full_name = ?,
                email = ?,
                phone = ?,
                address = ?,
                city = ?,
                country = ?,
                postal_code = ?,
                email_reminders_enabled = ?,
                whatsapp_reminders_enabled = ?,
                sms_reminders_enabled = ?,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
            AND deleted_at IS NULL
            `,
            [
                cleanFirstName || null,
                cleanLastName || null,
                cleanFullName,
                cleanEmail,
                cleanPhone,
                cleanText(address) ||
                    null,
                cleanText(city) ||
                    null,
                cleanText(country) ||
                    "Pakistan",
                cleanText(postal_code) ||
                    null,

                Number(
                    parseBoolean(
                        email_reminders_enabled
                    )
                ),

                Number(
                    parseBoolean(
                        whatsapp_reminders_enabled
                    )
                ),

                Number(
                    parseBoolean(
                        sms_reminders_enabled
                    )
                ),

                customerId
            ]
        );

        await connection.commit();

        logger.info(
            `Customer updated by admin: customer=${customerId}, admin=${
                req.admin?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            "Customer updated successfully."
        );
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        logger.error(
            `Update customer error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to update customer.",
            500,
            error
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// =====================================================
// Admin Reset Customer Password
// PATCH /api/admin/customers/:id/reset-password
// =====================================================

exports.resetCustomerPassword = async (
    req,
    res
) => {
    let connection;

    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        const newPassword =
            typeof req.body.new_password ===
                "string"
                ? req.body.new_password
                : "";

        const confirmPassword =
            typeof req.body.confirm_password ===
                "string"
                ? req.body.confirm_password
                : "";

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        if (newPassword.length < 8) {
            return errorResponse(
                res,
                "New password must contain at least 8 characters.",
                400
            );
        }

        if (
            confirmPassword &&
            newPassword !== confirmPassword
        ) {
            return errorResponse(
                res,
                "Password confirmation does not match.",
                400
            );
        }

        connection =
            await db.getConnection();

        await connection.beginTransaction();

        const [customerRows] =
            await connection.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status
                FROM customers
                WHERE id = ?
                  AND deleted_at IS NULL
                LIMIT 1
                FOR UPDATE
                `,
                [customerId]
            );

        if (customerRows.length === 0) {
            await connection.rollback();

            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        const hashedPassword =
            await bcrypt.hash(
                newPassword,
                10
            );

        await connection.query(
            `
            UPDATE customers
            SET
                password = ?,
                password_changed_at =
                    CURRENT_TIMESTAMP,
                failed_login_attempts = 0,
                account_locked_until = NULL,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
              AND deleted_at IS NULL
            `,
            [
                hashedPassword,
                customerId
            ]
        );

        /*
         * Revoke all active customer sessions.
         * The customer must sign in again with
         * the new password.
         */
        await connection.query(
            `
            UPDATE customer_sessions
            SET
                revoked_at =
                    CURRENT_TIMESTAMP
            WHERE customer_id = ?
              AND revoked_at IS NULL
            `,
            [customerId]
        );

        await connection.commit();

        logger.info(
            `Customer password reset by admin: customer=${customerId}, admin=${
                req.admin?.id ||
                req.user?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            "Customer password reset successfully. The customer has been logged out from all devices.",
            {
                customer: {
                    id:
                        customerRows[0].id,

                    full_name:
                        customerRows[0]
                            .full_name,

                    email:
                        customerRows[0].email,

                    phone:
                        customerRows[0].phone
                }
            }
        );

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logger.error(
                    `Reset-password rollback error: ${
                        rollbackError.message
                    }`
                );
            }
        }

        logger.error(
            `Admin reset customer password error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to reset customer password.",
            500,
            error
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// =====================================================
// Update Customer Status
// PATCH /api/admin/customers/:id/status
// =====================================================

exports.updateCustomerStatus = async (
    req,
    res
) => {
    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        const status =
            cleanText(
                req.body.status
            );

        if (
            !Number.isInteger(
                customerId
            ) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        if (
            !ALLOWED_STATUSES.includes(
                status
            )
        ) {
            return errorResponse(
                res,
                `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`,
                400
            );
        }

        const [result] =
            await db.query(
                `
                UPDATE customers

                SET
                    status = ?,

                    failed_login_attempts =
                        CASE
                            WHEN ? = 'Active'
                            THEN 0
                            ELSE
                                failed_login_attempts
                        END,

                    account_locked_until =
                        CASE
                            WHEN ? = 'Active'
                            THEN NULL
                            ELSE
                                account_locked_until
                        END,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?
                AND deleted_at IS NULL
                `,
                [
                    status,
                    status,
                    status,
                    customerId
                ]
            );

        if (
            result.affectedRows === 0
        ) {
            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        logger.info(
            `Customer status updated: customer=${customerId}, status=${status}, admin=${
                req.admin?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            `Customer status changed to ${status}.`,
            {
                customerId,
                status
            }
        );
    } catch (error) {
        logger.error(
            `Update customer status error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to update customer status.",
            500,
            error
        );
    }
};

// =====================================================
// Update Customer Verification
// PATCH /api/admin/customers/:id/verification
// =====================================================

exports.updateCustomerVerification =
async (
    req,
    res
) => {
    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        const emailVerified =
            parseBoolean(
                req.body.email_verified
            );

        const phoneVerified =
            parseBoolean(
                req.body.phone_verified
            );

        if (
            !Number.isInteger(
                customerId
            ) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        const [result] =
            await db.query(
                `
                UPDATE customers

                SET
                    email_verified_at =
                        CASE
                            WHEN ? = 1
                            THEN COALESCE(
                                email_verified_at,
                                CURRENT_TIMESTAMP
                            )
                            ELSE NULL
                        END,

                    phone_verified_at =
                        CASE
                            WHEN ? = 1
                            THEN COALESCE(
                                phone_verified_at,
                                CURRENT_TIMESTAMP
                            )
                            ELSE NULL
                        END,

                    status =
                        CASE
                            WHEN ? = 1
                                OR ? = 1
                            THEN
                                CASE
                                    WHEN status =
                                        'Pending Verification'
                                    THEN 'Active'
                                    ELSE status
                                END
                            ELSE status
                        END,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?
                AND deleted_at IS NULL
                `,
                [
                    Number(
                        emailVerified
                    ),

                    Number(
                        phoneVerified
                    ),

                    Number(
                        emailVerified
                    ),

                    Number(
                        phoneVerified
                    ),

                    customerId
                ]
            );

        if (
            result.affectedRows === 0
        ) {
            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        logger.info(
            `Customer verification updated: customer=${customerId}, admin=${
                req.admin?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            "Customer verification updated successfully.",
            {
                customerId,
                emailVerified,
                phoneVerified
            }
        );
    } catch (error) {
        logger.error(
            `Customer verification error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to update customer verification.",
            500,
            error
        );
    }
};

// =====================================================
// Soft Delete Customer
// DELETE /api/admin/customers/:id
// =====================================================

exports.deleteCustomer = async (
    req,
    res
) => {
    let connection;

    try {
        connection =
            await db.getConnection();

        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        if (
            !Number.isInteger(
                customerId
            ) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        await connection
            .beginTransaction();

        const [rows] =
            await connection.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status

                FROM customers

                WHERE id = ?
                AND deleted_at IS NULL

                LIMIT 1
                `,
                [customerId]
            );

        if (
            rows.length === 0
        ) {
            await connection.rollback();

            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        await connection.query(
            `
            UPDATE customers

            SET
                status = 'Inactive',
                deleted_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
            `,
            [customerId]
        );

        await connection.query(
            `
            UPDATE
                customer_account_deletion_requests

            SET
                status = 'Completed',
                completed_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE customer_id = ?
            AND status = 'Pending'
            `,
            [customerId]
        );

        await connection.commit();

        logger.info(
            `Customer soft deleted: customer=${customerId}, admin=${
                req.admin?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            "Customer account deleted successfully.",
            {
                customer: {
                    id:
                        rows[0].id,

                    full_name:
                        rows[0]
                            .full_name,

                    email:
                        rows[0].email,

                    phone:
                        rows[0].phone
                }
            }
        );
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        logger.error(
            `Delete customer error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to delete customer.",
            500,
            error
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// =====================================================
// Permanently Delete Customer
// DELETE /api/admin/customers/:id/permanent
// =====================================================

exports.permanentlyDeleteCustomer = async (
    req,
    res
) => {
    let connection;
    let transactionStarted = false;

    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        const confirmation =
            cleanText(
                req.body?.confirmation
            );

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        if (
            confirmation !==
            "PERMANENTLY DELETE CUSTOMER"
        ) {
            return errorResponse(
                res,
                "Type PERMANENTLY DELETE CUSTOMER to confirm permanent deletion.",
                400
            );
        }

        connection =
            await db.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [customerRows] =
            await connection.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status,
                    deleted_at
                FROM customers
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [customerId]
            );

        if (customerRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        const customer =
            customerRows[0];

        /*
         * Permanent deletion is deliberately restricted
         * to customers that were soft-deleted first.
         */
        if (!customer.deleted_at) {
            await connection.rollback();
            transactionStarted = false;

            return errorResponse(
                res,
                "Soft-delete the customer before permanent deletion.",
                409
            );
        }

        /*
         * Find every direct foreign key that references
         * customers.id in the current database.
         */
        const [foreignKeys] =
            await connection.query(
                `
                SELECT DISTINCT
                    TABLE_NAME AS table_name,
                    COLUMN_NAME AS column_name
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE
                    REFERENCED_TABLE_SCHEMA =
                        DATABASE()
                    AND REFERENCED_TABLE_NAME =
                        'customers'
                    AND REFERENCED_COLUMN_NAME =
                        'id'
                ORDER BY TABLE_NAME, COLUMN_NAME
                `
            );

        const safeIdentifier =
            /^[A-Za-z0-9_]+$/;

        const cleanupSummary = [];

        for (const foreignKey of foreignKeys) {
            const tableName =
                foreignKey.table_name;

            const columnName =
                foreignKey.column_name;

            if (
                !safeIdentifier.test(tableName) ||
                !safeIdentifier.test(columnName)
            ) {
                throw new Error(
                    "Unsafe foreign-key identifier detected."
                );
            }

            /*
             * customers.referred_by_customer_id is a
             * self-reference. Other customers must remain;
             * only their referral link is cleared.
             */
            if (tableName === "customers") {
                const [result] =
                    await connection.query(
                        `
                        UPDATE \`${tableName}\`
                        SET
                            \`${columnName}\` = NULL,
                            updated_at =
                                CURRENT_TIMESTAMP
                        WHERE \`${columnName}\` = ?
                        `,
                        [customerId]
                    );

                cleanupSummary.push({
                    table:
                        tableName,

                    action:
                        "reference-cleared",

                    affectedRows:
                        result.affectedRows
                });

                continue;
            }

            /*
             * Delete direct customer-owned rows. Existing
             * ON DELETE CASCADE rules continue to handle
             * dependent child records where configured.
             */
            const [result] =
                await connection.query(
                    `
                    DELETE FROM \`${tableName}\`
                    WHERE \`${columnName}\` = ?
                    `,
                    [customerId]
                );

            cleanupSummary.push({
                table:
                    tableName,

                action:
                    "deleted",

                affectedRows:
                    result.affectedRows
            });
        }

        const [deleteResult] =
            await connection.query(
                `
                DELETE FROM customers
                WHERE id = ?
                  AND deleted_at IS NOT NULL
                `,
                [customerId]
            );

        if (deleteResult.affectedRows !== 1) {
            throw new Error(
                "Customer permanent deletion did not complete."
            );
        }

        await connection.commit();
        transactionStarted = false;

        logger.info(
            `Customer permanently deleted: customer=${customerId}, admin=${
                req.admin?.id ||
                req.user?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            "Customer and related records were permanently deleted.",
            {
                deletedCustomer: {
                    id:
                        customer.id,

                    full_name:
                        customer.full_name,

                    email:
                        customer.email,

                    phone:
                        customer.phone
                },

                cleanupSummary
            }
        );

    } catch (error) {
        if (
            connection &&
            transactionStarted
        ) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logger.error(
                    `Permanent-delete rollback error: ${
                        rollbackError.message
                    }`
                );
            }
        }

        logger.error(
            `Permanent customer deletion error: ${
                error.stack ||
                error.message
            }`
        );

        /*
         * A foreign-key error normally means a table has
         * dependent records without cascading deletion.
         * Nothing is deleted because the transaction rolls back.
         */
        if (
            error.code ===
                "ER_ROW_IS_REFERENCED_2" ||
            error.errno === 1451
        ) {
            return errorResponse(
                res,
                "Permanent deletion was blocked by related business records. Remove the dependent test records first, then try again.",
                409,
                error
            );
        }

        return errorResponse(
            res,
            "Unable to permanently delete the customer.",
            500,
            error
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// =====================================================
// Get Deleted Customers
// GET /api/admin/customers/deleted
// =====================================================

exports.getDeletedCustomers = async (
    req,
    res
) => {
    try {
        const search =
            cleanText(
                req.query.search
            );

        const where = [
            "deleted_at IS NOT NULL"
        ];

        const params = [];

        if (search) {
            where.push(`
                (
                    full_name LIKE ?
                    OR email LIKE ?
                    OR phone LIKE ?
                    OR CAST(id AS CHAR) LIKE ?
                )
            `);

            const pattern =
                `%${search}%`;

            params.push(
                pattern,
                pattern,
                pattern,
                pattern
            );
        }

        const [customers] =
            await db.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status,
                    created_at,
                    updated_at,
                    deleted_at
                FROM customers
                WHERE ${where.join(" AND ")}
                ORDER BY deleted_at DESC, id DESC
                LIMIT 500
                `,
                params
            );

        return successResponse(
            res,
            "Deleted customers fetched successfully.",
            {
                customers,
                total:
                    customers.length
            }
        );

    } catch (error) {
        logger.error(
            `Get deleted customers error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load deleted customers.",
            500,
            error
        );
    }
};

// =====================================================
// Restore Deleted Customer
// PATCH /api/admin/customers/:id/restore
// =====================================================

exports.restoreDeletedCustomer = async (
    req,
    res
) => {
    let connection;

    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        if (
            !Number.isInteger(
                customerId
            ) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        connection =
            await db.getConnection();

        await connection.beginTransaction();

        const [rows] =
            await connection.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status,
                    email_verified_at,
                    phone_verified_at,
                    deleted_at
                FROM customers
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [customerId]
            );

        if (rows.length === 0) {
            await connection.rollback();

            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        const customer =
            rows[0];

        if (!customer.deleted_at) {
            await connection.rollback();

            return errorResponse(
                res,
                "Customer is not deleted.",
                409
            );
        }

        const restoredStatus =
            customer.email_verified_at ||
            customer.phone_verified_at
                ? "Active"
                : "Pending Verification";

        await connection.query(
            `
            UPDATE customers
            SET
                deleted_at = NULL,
                status = ?,
                failed_login_attempts = 0,
                account_locked_until = NULL,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [
                restoredStatus,
                customerId
            ]
        );

        await connection.query(
            `
            UPDATE
                customer_account_deletion_requests
            SET
                status = 'Cancelled',
                cancelled_at =
                    CURRENT_TIMESTAMP,
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE customer_id = ?
              AND status IN (
                    'Pending',
                    'Completed'
              )
            `,
            [customerId]
        );

        await connection.commit();

        logger.info(
            `Customer restored: customer=${customerId}, admin=${
                req.admin?.id ||
                req.user?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            "Customer restored successfully.",
            {
                customer: {
                    id:
                        customer.id,

                    full_name:
                        customer.full_name,

                    email:
                        customer.email,

                    phone:
                        customer.phone,

                    status:
                        restoredStatus
                }
            }
        );

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logger.error(
                    `Restore customer rollback error: ${
                        rollbackError.message
                    }`
                );
            }
        }

        logger.error(
            `Restore customer error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to restore the customer.",
            500,
            error
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// =====================================================
// Get Customer 360 Activity
// GET /api/admin/customers/:id/activity
// =====================================================

exports.getCustomerActivity360 = async (
    req,
    res
) => {
    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        const [[customer]] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.city,
                    c.country,
                    c.postal_code,
                    c.status,
                    c.created_at,
                    c.last_login_at,
                    c.email_verified_at,
                    c.phone_verified_at,

                    cp.profile_picture,

                    COALESCE(
                        cr.membership_level,
                        'Bronze'
                    ) AS membership_level,

                    COALESCE(
                        cr.reward_points,
                        0
                    ) AS available_points,

                    COALESCE(
                        cr.lifetime_points,
                        0
                    ) AS lifetime_points

                FROM customers c

                LEFT JOIN customer_profiles cp
                    ON cp.customer_id =
                        c.id

                LEFT JOIN customer_rewards cr
                    ON cr.customer_id =
                        c.id

                WHERE
                    c.id = ?
                    AND c.deleted_at IS NULL

                LIMIT 1
                `,
                [customerId]
            );

        if (!customer) {
            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        /*
         * Optional customer activity sections must never
         * prevent the complete 360 profile from opening.
         */
        const safeRows = async (
            label,
            sql,
            values = []
        ) => {
            try {
                const [rows] =
                    await db.query(
                        sql,
                        values
                    );

                return rows;
            } catch (error) {
                logger.warn(
                    `Customer 360 ${label} query skipped: ${
                        error.message
                    }`
                );

                return [];
            }
        };

        const [
            addresses,
            orders,
            wishlist,
            cart,
            reviews,
            events,
            loyaltyTransactions
        ] = await Promise.all([
            safeRows(
                "addresses",
                `
                SELECT
                    id,
                    full_name,
                    phone,
                    address_line1,
                    address_line2,
                    city,
                    province,
                    postal_code,
                    country,
                    address_type,
                    is_default,
                    created_at

                FROM customer_addresses

                WHERE customer_id = ?

                ORDER BY
                    is_default DESC,
                    id DESC

                LIMIT 20
                `,
                [customerId]
            ),

            safeRows(
                "orders",
                `
                SELECT
                    id,
                    order_number,
                    order_status,
                    payment_status,
                    payment_method,
                    grand_total,
                    tracking_number,
                    created_at

                FROM orders

                WHERE customer_id = ?

                ORDER BY id DESC

                LIMIT 20
                `,
                [customerId]
            ),

            safeRows(
                "wishlist",
                `
                SELECT
                    w.id
                        AS wishlist_id,
                    w.product_id,
                    p.product_name,
                    p.selling_price
                        AS price,
                    p.stock_quantity
                        AS stock,
                    p.status,
                    w.created_at

                FROM wishlist w

                INNER JOIN products p
                    ON p.id =
                        w.product_id

                WHERE w.customer_id = ?

                ORDER BY w.id DESC

                LIMIT 30
                `,
                [customerId]
            ),

            safeRows(
                "cart",
                `
                SELECT
                    c.id
                        AS cart_id,
                    c.product_id,
                    p.product_name,
                    p.selling_price
                        AS price,
                    c.quantity,

                    (
                        p.selling_price *
                        c.quantity
                    ) AS subtotal,

                    c.created_at

                FROM cart c

                INNER JOIN products p
                    ON p.id =
                        c.product_id

                WHERE c.customer_id = ?

                ORDER BY c.id DESC

                LIMIT 30
                `,
                [customerId]
            ),

            safeRows(
                "reviews",
                `
                SELECT
                    r.id,
                    r.product_id,
                    p.product_name,
                    r.rating,
                    r.comment,
                    r.status,
                    r.verified_purchase,
                    r.helpful_count,
                    r.created_at

                FROM reviews r

                INNER JOIN products p
                    ON p.id =
                        r.product_id

                WHERE r.customer_id = ?

                ORDER BY r.id DESC

                LIMIT 30
                `,
                [customerId]
            ),

            safeRows(
                "events",
                `
                SELECT
                    id,
                    event_type,
                    event_name,
                    event_date,
                    recurrence,
                    reminder_days,
                    remind_by_email,
                    remind_by_whatsapp,
                    remind_by_sms,
                    status,
                    created_at

                FROM customer_events

                WHERE customer_id = ?

                ORDER BY
                    event_date ASC,
                    id DESC

                LIMIT 30
                `,
                [customerId]
            ),

            safeRows(
                "loyalty",
                `
                SELECT
                    id,
                    transaction_type,
                    points_change,
                    lifetime_points_change,
                    balance_before,
                    balance_after,
                    membership_before,
                    membership_after,
                    source_type,
                    reference_number,
                    description,
                    created_at

                FROM customer_loyalty_transactions

                WHERE customer_id = ?

                ORDER BY id DESC

                LIMIT 40
                `,
                [customerId]
            )
        ]);

        return successResponse(
            res,
            "Customer activity fetched successfully.",
            {
                customer: {
                    ...customer,

                    available_points:
                        Number(
                            customer
                                .available_points || 0
                        ),

                    lifetime_points:
                        Number(
                            customer
                                .lifetime_points || 0
                        )
                },

                addresses,
                orders,
                wishlist,
                cart,
                reviews,
                events,
                loyaltyTransactions,

                summary: {
                    addresses:
                        addresses.length,

                    orders:
                        orders.length,

                    wishlist:
                        wishlist.length,

                    cart:
                        cart.length,

                    reviews:
                        reviews.length,

                    events:
                        events.length,

                    loyaltyTransactions:
                        loyaltyTransactions.length
                }
            }
        );

    } catch (error) {
        logger.error(
            `Get customer 360 activity error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load customer activity.",
            500,
            error
        );
    }
};



// =====================================================
// Get Customer Analytics
// GET /api/admin/customers/:id/analytics
// =====================================================

exports.getCustomerAnalytics = async (
    req,
    res
) => {
    try {
        const customerId =
            Number.parseInt(
                req.params.id,
                10
            );

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            return errorResponse(
                res,
                "A valid customer ID is required.",
                400
            );
        }

        const [[customer]] =
            await db.query(
                `
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status,
                    created_at,
                    last_login_at
                FROM customers
                WHERE id = ?
                  AND deleted_at IS NULL
                LIMIT 1
                `,
                [customerId]
            );

        if (!customer) {
            return errorResponse(
                res,
                "Customer was not found.",
                404
            );
        }

        const safeOne = async (
            label,
            sql,
            values = []
        ) => {
            try {
                const [[row]] =
                    await db.query(
                        sql,
                        values
                    );

                return row || {};
            } catch (error) {
                logger.warn(
                    `Customer analytics ${label} skipped: ${
                        error.message
                    }`
                );

                return {};
            }
        };

        const safeRows = async (
            label,
            sql,
            values = []
        ) => {
            try {
                const [rows] =
                    await db.query(
                        sql,
                        values
                    );

                return rows;
            } catch (error) {
                logger.warn(
                    `Customer analytics ${label} skipped: ${
                        error.message
                    }`
                );

                return [];
            }
        };

        const [
            orderSummary,
            monthlySpending,
            statusBreakdown,
            loyaltySummary,
            engagementSummary
        ] = await Promise.all([
            safeOne(
                "order summary",
                `
                SELECT
                    COUNT(*) AS total_orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN order_status !=
                                    'Cancelled'
                                THEN grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS lifetime_value,

                    COALESCE(
                        AVG(
                            CASE
                                WHEN order_status !=
                                    'Cancelled'
                                THEN grand_total
                                ELSE NULL
                            END
                        ),
                        0
                    ) AS average_order_value,

                    MAX(created_at)
                        AS last_order_at,

                    MIN(created_at)
                        AS first_order_at,

                    SUM(
                        CASE
                            WHEN order_status =
                                'Delivered'
                            THEN 1
                            ELSE 0
                        END
                    ) AS delivered_orders,

                    SUM(
                        CASE
                            WHEN order_status =
                                'Cancelled'
                            THEN 1
                            ELSE 0
                        END
                    ) AS cancelled_orders

                FROM orders

                WHERE customer_id = ?
                `,
                [customerId]
            ),

            safeRows(
                "monthly spending",
                `
                SELECT
                    DATE_FORMAT(
                        created_at,
                        '%Y-%m'
                    ) AS month,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN order_status !=
                                    'Cancelled'
                                THEN grand_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS amount,

                    COUNT(*) AS orders

                FROM orders

                WHERE
                    customer_id = ?
                    AND created_at >=
                        DATE_SUB(
                            CURRENT_DATE,
                            INTERVAL 11 MONTH
                        )

                GROUP BY
                    DATE_FORMAT(
                        created_at,
                        '%Y-%m'
                    )

                ORDER BY month ASC
                `,
                [customerId]
            ),

            safeRows(
                "status breakdown",
                `
                SELECT
                    order_status AS status,
                    COUNT(*) AS total
                FROM orders
                WHERE customer_id = ?
                GROUP BY order_status
                ORDER BY total DESC
                `,
                [customerId]
            ),

            safeOne(
                "loyalty summary",
                `
                SELECT
                    COALESCE(
                        cr.reward_points,
                        0
                    ) AS available_points,

                    COALESCE(
                        cr.lifetime_points,
                        0
                    ) AS lifetime_points,

                    COALESCE(
                        cr.membership_level,
                        'Bronze'
                    ) AS membership_level,

                    (
                        SELECT COUNT(*)
                        FROM
                            customer_loyalty_transactions clt
                        WHERE
                            clt.customer_id =
                                cr.customer_id
                    ) AS loyalty_entries

                FROM customer_rewards cr

                WHERE cr.customer_id = ?

                LIMIT 1
                `,
                [customerId]
            ),

            safeOne(
                "engagement summary",
                `
                SELECT
                    (
                        SELECT COUNT(*)
                        FROM reviews
                        WHERE customer_id = ?
                    ) AS reviews,

                    (
                        SELECT COUNT(*)
                        FROM customer_events
                        WHERE customer_id = ?
                    ) AS events,

                    (
                        SELECT COUNT(*)
                        FROM wishlist
                        WHERE customer_id = ?
                    ) AS wishlist_items,

                    (
                        SELECT COUNT(*)
                        FROM cart
                        WHERE customer_id = ?
                    ) AS cart_items
                `,
                [
                    customerId,
                    customerId,
                    customerId,
                    customerId
                ]
            )
        ]);

        const totalOrders =
            Number(
                orderSummary.total_orders || 0
            );

        const lifetimeValue =
            Number(
                orderSummary.lifetime_value || 0
            );

        const averageOrderValue =
            Number(
                orderSummary.average_order_value || 0
            );

        const accountAgeDays =
            Math.max(
                1,
                Math.floor(
                    (
                        Date.now() -
                        new Date(
                            customer.created_at
                        ).getTime()
                    ) /
                    86400000
                )
            );

        const orderFrequencyDays =
            totalOrders > 1
                ? Math.round(
                    accountAgeDays /
                    totalOrders
                )
                : null;

        return successResponse(
            res,
            "Customer analytics fetched successfully.",
            {
                customer,

                metrics: {
                    totalOrders,
                    lifetimeValue,
                    averageOrderValue,
                    deliveredOrders:
                        Number(
                            orderSummary
                                .delivered_orders || 0
                        ),
                    cancelledOrders:
                        Number(
                            orderSummary
                                .cancelled_orders || 0
                        ),
                    firstOrderAt:
                        orderSummary.first_order_at ||
                        null,
                    lastOrderAt:
                        orderSummary.last_order_at ||
                        null,
                    accountAgeDays,
                    orderFrequencyDays,
                    availablePoints:
                        Number(
                            loyaltySummary
                                .available_points || 0
                        ),
                    lifetimePoints:
                        Number(
                            loyaltySummary
                                .lifetime_points || 0
                        ),
                    membershipLevel:
                        loyaltySummary
                            .membership_level ||
                        "Bronze",
                    loyaltyEntries:
                        Number(
                            loyaltySummary
                                .loyalty_entries || 0
                        ),
                    reviews:
                        Number(
                            engagementSummary
                                .reviews || 0
                        ),
                    events:
                        Number(
                            engagementSummary
                                .events || 0
                        ),
                    wishlistItems:
                        Number(
                            engagementSummary
                                .wishlist_items || 0
                        ),
                    cartItems:
                        Number(
                            engagementSummary
                                .cart_items || 0
                        )
                },

                monthlySpending:
                    monthlySpending.map(
                        row => ({
                            month:
                                row.month,
                            amount:
                                Number(
                                    row.amount || 0
                                ),
                            orders:
                                Number(
                                    row.orders || 0
                                )
                        })
                    ),

                statusBreakdown:
                    statusBreakdown.map(
                        row => ({
                            status:
                                row.status ||
                                "Unknown",
                            total:
                                Number(
                                    row.total || 0
                                )
                        })
                    )
            }
        );

    } catch (error) {
        logger.error(
            `Get customer analytics error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load customer analytics.",
            500,
            error
        );
    }
};

// =====================================================
// Get Account Deletion Requests
// GET /api/admin/customers/deletion-requests
// =====================================================

exports.getAccountDeletionRequests = async (
    req,
    res
) => {
    try {
        const status =
            cleanText(
                req.query.status
            );

        const search =
            cleanText(
                req.query.search
            );

        const where = [
            "1 = 1"
        ];

        const params = [];

        if (status) {
            where.push(
                "dr.status = ?"
            );

            params.push(
                status
            );
        }

        if (search) {
            where.push(`
                (
                    c.full_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                    OR CAST(c.id AS CHAR) LIKE ?
                    OR dr.reason LIKE ?
                )
            `);

            const pattern =
                `%${search}%`;

            params.push(
                pattern,
                pattern,
                pattern,
                pattern,
                pattern
            );
        }

        const [requests] =
            await db.query(
                `
                SELECT
                    dr.id,
                    dr.customer_id,
                    dr.reason,
                    dr.additional_details,
                    dr.status,
                    dr.requested_at,
                    dr.scheduled_for,
                    dr.cancelled_at,
                    dr.completed_at,
                    dr.created_at,
                    dr.updated_at,

                    c.full_name,
                    c.email,
                    c.phone,
                    c.status
                        AS customer_status,
                    c.email_verified_at,
                    c.phone_verified_at,
                    c.deleted_at

                FROM
                    customer_account_deletion_requests dr

                JOIN customers c
                    ON c.id =
                        dr.customer_id

                WHERE
                    ${where.join(" AND ")}

                ORDER BY
                    CASE dr.status
                        WHEN 'Pending' THEN 1
                        WHEN 'Rejected' THEN 2
                        WHEN 'Completed' THEN 3
                        WHEN 'Cancelled' THEN 4
                        ELSE 5
                    END,
                    dr.requested_at DESC,
                    dr.id DESC

                LIMIT 500
                `,
                params
            );

        return successResponse(
            res,
            "Account-deletion requests fetched successfully.",
            {
                requests,
                total:
                    requests.length
            }
        );

    } catch (error) {
        logger.error(
            `Get account-deletion requests error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to load account-deletion requests.",
            500,
            error
        );
    }
};


// =====================================================
// Update Account Deletion Request Status
// PATCH /api/admin/customers/deletion-requests/:requestId/status
// =====================================================

exports.updateAccountDeletionRequestStatus = async (
    req,
    res
) => {
    let connection;

    try {
        const requestId =
            Number.parseInt(
                req.params.requestId,
                10
            );

        const newStatus =
            cleanText(
                req.body?.status
            );

        const allowedStatuses = [
            "Rejected",
            "Completed",
            "Cancelled"
        ];

        if (
            !Number.isInteger(requestId) ||
            requestId <= 0
        ) {
            return errorResponse(
                res,
                "A valid deletion-request ID is required.",
                400
            );
        }

        if (
            !allowedStatuses.includes(
                newStatus
            )
        ) {
            return errorResponse(
                res,
                "Status must be Rejected, Completed or Cancelled.",
                400
            );
        }

        connection =
            await db.getConnection();

        await connection.beginTransaction();

        const [rows] =
            await connection.query(
                `
                SELECT
                    dr.id,
                    dr.customer_id,
                    dr.status,
                    c.status
                        AS customer_status,
                    c.email_verified_at,
                    c.phone_verified_at,
                    c.deleted_at

                FROM
                    customer_account_deletion_requests dr

                JOIN customers c
                    ON c.id =
                        dr.customer_id

                WHERE
                    dr.id = ?

                LIMIT 1
                FOR UPDATE
                `,
                [requestId]
            );

        if (rows.length === 0) {
            await connection.rollback();

            return errorResponse(
                res,
                "Account-deletion request was not found.",
                404
            );
        }

        const record =
            rows[0];

        if (
            record.status !==
            "Pending"
        ) {
            await connection.rollback();

            return errorResponse(
                res,
                "Only pending deletion requests can be updated.",
                409
            );
        }

        if (
            newStatus ===
            "Completed"
        ) {
            await connection.query(
                `
                UPDATE customers
                SET
                    status =
                        'Inactive',
                    deleted_at =
                        COALESCE(
                            deleted_at,
                            CURRENT_TIMESTAMP
                        ),
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [record.customer_id]
            );

            await connection.query(
                `
                UPDATE
                    customer_account_deletion_requests
                SET
                    status =
                        'Completed',
                    completed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [requestId]
            );

        } else {
            const restoredStatus =
                record.email_verified_at ||
                record.phone_verified_at
                    ? "Active"
                    : "Pending Verification";

            await connection.query(
                `
                UPDATE customers
                SET
                    status = ?,
                    deletion_requested_at =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [
                    restoredStatus,
                    record.customer_id
                ]
            );

            await connection.query(
                `
                UPDATE
                    customer_account_deletion_requests
                SET
                    status = ?,
                    cancelled_at =
                        CASE
                            WHEN ? =
                                'Cancelled'
                            THEN
                                CURRENT_TIMESTAMP
                            ELSE
                                cancelled_at
                        END,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    newStatus,
                    newStatus,
                    requestId
                ]
            );
        }

        await connection.commit();

        logger.info(
            `Account-deletion request updated: request=${requestId}, status=${newStatus}, admin=${
                req.admin?.id ||
                req.user?.id ||
                "unknown"
            }`
        );

        return successResponse(
            res,
            `Account-deletion request marked ${newStatus}.`,
            {
                requestId,
                customerId:
                    record.customer_id,
                status:
                    newStatus
            }
        );

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch {}
        }

        logger.error(
            `Update account-deletion request error: ${
                error.stack ||
                error.message
            }`
        );

        return errorResponse(
            res,
            "Unable to update the account-deletion request.",
            500,
            error
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
};
