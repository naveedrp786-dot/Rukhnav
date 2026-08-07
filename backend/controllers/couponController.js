"use strict";

const db = require("../config/db");

/* =====================================================
   Constants
===================================================== */

const COUPON_TYPES = [
    "Birthday",
    "Anniversary",
    "Loyalty",
    "Promotion",
    "Welcome"
];

const DISCOUNT_TYPES = [
    "percentage",
    "fixed"
];

const STATUSES = [
    "active",
    "inactive"
];

/* =====================================================
   Helpers
===================================================== */

const parseId = value => {
    const id =
        Number.parseInt(value, 10);

    return (
        Number.isInteger(id) &&
        id > 0
    )
        ? id
        : null;
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

const cleanText = (
    value,
    maximum = 255
) =>
    String(value || "")
        .trim()
        .slice(0, maximum);

const normalizeCode = value =>
    cleanText(value, 50)
        .toUpperCase()
        .replace(/\s+/g, "");

const toMoney = value => {
    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 0
    ) {
        return null;
    }

    return Number(
        number.toFixed(2)
    );
};

const isValidDate = value => {
    if (!value) {
        return false;
    }

    const date =
        new Date(value);

    return !Number.isNaN(
        date.getTime()
    );
};

const couponAvailability = coupon => {
    if (
        String(
            coupon.status
        ).toLowerCase() !== "active"
    ) {
        return "Inactive";
    }

    if (
        coupon.expiry_date &&
        new Date(
            coupon.expiry_date
        ) < new Date()
    ) {
        return "Expired";
    }

    if (
        coupon.usage_limit !== null &&
        Number(
            coupon.used_count || 0
        ) >=
        Number(
            coupon.usage_limit
        )
    ) {
        return "Usage Limit Reached";
    }

    return "Active";
};

const validateCouponPayload = (
    payload,
    updating = false
) => {
    const code =
        normalizeCode(
            payload.code
        );

    const couponType =
        cleanText(
            payload.coupon_type
        ) ||
        "Promotion";

    const discountType =
        cleanText(
            payload.discount_type
        ).toLowerCase();

    const discountValue =
        toMoney(
            payload.discount_value
        );

    const minimumOrder =
        toMoney(
            payload.minimum_order ??
            0
        );

    const customerId =
        payload.customer_id ===
        null ||
        payload.customer_id ===
        undefined ||
        payload.customer_id ===
        ""
            ? null
            : parseId(
                payload.customer_id
            );

    const usageLimit =
        payload.usage_limit ===
        null ||
        payload.usage_limit ===
        undefined ||
        payload.usage_limit ===
        ""
            ? null
            : parsePositiveInteger(
                payload.usage_limit,
                null
            );

    const expiryDate =
        cleanText(
            payload.expiry_date,
            30
        );

    const status =
        cleanText(
            payload.status ||
            "active"
        ).toLowerCase();

    if (!code) {
        return {
            error:
                "Coupon code is required."
        };
    }

    if (
        !/^[A-Z0-9_-]{3,50}$/.test(
            code
        )
    ) {
        return {
            error:
                "Coupon code may only contain letters, numbers, hyphens and underscores."
        };
    }

    if (
        !COUPON_TYPES.includes(
            couponType
        )
    ) {
        return {
            error:
                `Invalid coupon type. Allowed values: ${COUPON_TYPES.join(
                    ", "
                )}.`
        };
    }

    if (
        !DISCOUNT_TYPES.includes(
            discountType
        )
    ) {
        return {
            error:
                "Discount type must be percentage or fixed."
        };
    }

    if (
        discountValue === null ||
        discountValue <= 0
    ) {
        return {
            error:
                "Discount value must be greater than zero."
        };
    }

    if (
        discountType ===
        "percentage" &&
        discountValue > 100
    ) {
        return {
            error:
                "Percentage discount cannot exceed 100%."
        };
    }

    if (
        minimumOrder === null
    ) {
        return {
            error:
                "Minimum order must be a valid non-negative amount."
        };
    }

    if (
        payload.customer_id &&
        !customerId
    ) {
        return {
            error:
                "A valid customer ID is required."
        };
    }

    if (
        payload.usage_limit !==
        null &&
        payload.usage_limit !==
        undefined &&
        payload.usage_limit !==
        "" &&
        !usageLimit
    ) {
        return {
            error:
                "Usage limit must be a positive integer."
        };
    }

    if (
        !expiryDate ||
        !isValidDate(
            expiryDate
        )
    ) {
        return {
            error:
                "A valid expiry date is required."
        };
    }

    if (
        !STATUSES.includes(
            status
        )
    ) {
        return {
            error:
                "Status must be active or inactive."
        };
    }

    return {
        value: {
            code,
            customerId,
            couponType,
            discountType,
            discountValue,
            minimumOrder,
            usageLimit,
            expiryDate,
            status
        }
    };
};

/* =====================================================
   Coupon Dashboard
   GET /api/coupons/dashboard
===================================================== */

exports.getDashboard = async (
    req,
    res
) => {
    try {
        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_coupons,

                    SUM(
                        CASE
                            WHEN status = 'active'
                            AND expiry_date >= CURRENT_DATE
                            AND (
                                usage_limit IS NULL
                                OR used_count < usage_limit
                            )
                            THEN 1
                            ELSE 0
                        END
                    ) AS active_coupons,

                    SUM(
                        CASE
                            WHEN expiry_date < CURRENT_DATE
                            THEN 1
                            ELSE 0
                        END
                    ) AS expired_coupons,

                    SUM(
                        CASE
                            WHEN status = 'inactive'
                            THEN 1
                            ELSE 0
                        END
                    ) AS inactive_coupons,

                    SUM(
                        CASE
                            WHEN usage_limit IS NOT NULL
                            AND used_count >= usage_limit
                            THEN 1
                            ELSE 0
                        END
                    ) AS exhausted_coupons,

                    COALESCE(
                        SUM(used_count),
                        0
                    ) AS total_uses,

                    COALESCE(
                        AVG(discount_value),
                        0
                    ) AS average_discount_value

                FROM coupons
            `);

        const [typeBreakdown] =
            await db.query(`
                SELECT
                    coupon_type AS couponType,
                    COUNT(*) AS couponCount,
                    COALESCE(
                        SUM(used_count),
                        0
                    ) AS totalUses

                FROM coupons

                GROUP BY coupon_type

                ORDER BY couponCount DESC
            `);

        return res.json({
            success: true,
            message:
                "Coupon dashboard fetched successfully.",

            dashboard: {
                totalCoupons:
                    Number(
                        summary.total_coupons ||
                        0
                    ),

                activeCoupons:
                    Number(
                        summary.active_coupons ||
                        0
                    ),

                expiredCoupons:
                    Number(
                        summary.expired_coupons ||
                        0
                    ),

                inactiveCoupons:
                    Number(
                        summary.inactive_coupons ||
                        0
                    ),

                exhaustedCoupons:
                    Number(
                        summary.exhausted_coupons ||
                        0
                    ),

                totalUses:
                    Number(
                        summary.total_uses ||
                        0
                    ),

                averageDiscountValue:
                    Number(
                        summary.average_discount_value ||
                        0
                    )
            },

            typeBreakdown:
                typeBreakdown.map(
                    item => ({
                        couponType:
                            item.couponType,

                        couponCount:
                            Number(
                                item.couponCount ||
                                0
                            ),

                        totalUses:
                            Number(
                                item.totalUses ||
                                0
                            )
                    })
                )
        });
    } catch (error) {
        console.error(
            "Coupon dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch coupon dashboard.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

/* =====================================================
   Create Coupon
   POST /api/coupons
===================================================== */

exports.createCoupon = async (
    req,
    res
) => {
    try {
        const validation =
            validateCouponPayload(
                req.body || {}
            );

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message:
                    validation.error
            });
        }

        const coupon =
            validation.value;

        const [existing] =
            await db.query(
                `
                    SELECT id
                    FROM coupons
                    WHERE code = ?
                    LIMIT 1
                `,
                [coupon.code]
            );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Coupon code already exists."
            });
        }

        if (coupon.customerId) {
            const [customers] =
                await db.query(
                    `
                        SELECT id
                        FROM customers
                        WHERE id = ?
                        LIMIT 1
                    `,
                    [
                        coupon.customerId
                    ]
                );

            if (
                customers.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Customer not found."
                });
            }
        }

        const [result] =
            await db.query(
                `
                    INSERT INTO coupons
                    (
                        customer_id,
                        coupon_type,
                        code,
                        discount_type,
                        discount_value,
                        minimum_order,
                        usage_limit,
                        used_count,
                        expiry_date,
                        status
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, 0, ?, ?
                    )
                `,
                [
                    coupon.customerId,
                    coupon.couponType,
                    coupon.code,
                    coupon.discountType,
                    coupon.discountValue,
                    coupon.minimumOrder,
                    coupon.usageLimit,
                    coupon.expiryDate,
                    coupon.status
                ]
            );

        const [rows] =
            await db.query(
                `
                    SELECT *
                    FROM coupons
                    WHERE id = ?
                    LIMIT 1
                `,
                [
                    result.insertId
                ]
            );

        return res.status(201).json({
            success: true,
            message:
                "Coupon created successfully.",
            coupon:
                rows[0]
        });
    } catch (error) {
        console.error(
            "Create coupon error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to create coupon.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

/* =====================================================
   Get All Coupons
   GET /api/coupons
===================================================== */

exports.getCoupons = async (
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
                20,
                100
            );

        const offset =
            (
                page - 1
            ) * limit;

        const search =
            cleanText(
                req.query.search,
                100
            );

        const status =
            cleanText(
                req.query.status
            ).toLowerCase();

        const couponType =
            cleanText(
                req.query.coupon_type
            );

        const discountType =
            cleanText(
                req.query.discount_type
            ).toLowerCase();

        const customerId =
            req.query.customer_id
                ? parseId(
                    req.query.customer_id
                )
                : null;

        if (
            status &&
            !STATUSES.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid coupon status."
            });
        }

        if (
            couponType &&
            !COUPON_TYPES.includes(
                couponType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid coupon type."
            });
        }

        if (
            discountType &&
            !DISCOUNT_TYPES.includes(
                discountType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid discount type."
            });
        }

        if (
            req.query.customer_id &&
            !customerId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid customer ID is required."
            });
        }

        const conditions = [];
        const values = [];

        if (search) {
            const pattern =
                `%${search}%`;

            conditions.push(`
                (
                    cp.code LIKE ?
                    OR cp.coupon_type LIKE ?
                    OR c.full_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                )
            `);

            values.push(
                pattern,
                pattern,
                pattern,
                pattern,
                pattern
            );
        }

        if (status) {
            conditions.push(
                "cp.status = ?"
            );

            values.push(status);
        }

        if (couponType) {
            conditions.push(
                "cp.coupon_type = ?"
            );

            values.push(
                couponType
            );
        }

        if (discountType) {
            conditions.push(
                "cp.discount_type = ?"
            );

            values.push(
                discountType
            );
        }

        if (customerId) {
            conditions.push(
                "cp.customer_id = ?"
            );

            values.push(
                customerId
            );
        }

        const whereClause =
            conditions.length
                ? `WHERE ${conditions.join(
                    " AND "
                )}`
                : "";

        const [[countRow]] =
            await db.query(
                `
                    SELECT
                        COUNT(*) AS total

                    FROM coupons cp

                    LEFT JOIN customers c
                        ON c.id = cp.customer_id

                    ${whereClause}
                `,
                values
            );

        const [coupons] =
            await db.query(
                `
                    SELECT
                        cp.*,

                        c.full_name AS customer_name,
                        c.email AS customer_email,
                        c.phone AS customer_phone,

                        CASE
                            WHEN cp.status = 'inactive'
                            THEN 'Inactive'

                            WHEN cp.expiry_date <
                                CURRENT_DATE
                            THEN 'Expired'

                            WHEN cp.usage_limit IS NOT NULL
                            AND cp.used_count >=
                                cp.usage_limit
                            THEN 'Usage Limit Reached'

                            ELSE 'Active'
                        END AS availability_status

                    FROM coupons cp

                    LEFT JOIN customers c
                        ON c.id = cp.customer_id

                    ${whereClause}

                    ORDER BY
                        cp.created_at DESC,
                        cp.id DESC

                    LIMIT ?
                    OFFSET ?
                `,
                [
                    ...values,
                    limit,
                    offset
                ]
            );

        const totalRecords =
            Number(
                countRow.total ||
                0
            );

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    totalRecords /
                    limit
                )
            );

        return res.json({
            success: true,
            message:
                "Coupons fetched successfully.",

            coupons,

            pagination: {
                currentPage:
                    page,

                limit,

                totalRecords,

                totalPages,

                hasPreviousPage:
                    page > 1,

                hasNextPage:
                    page < totalPages
            }
        });
    } catch (error) {
        console.error(
            "Get coupons error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch coupons.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

/* =====================================================
   Get One Coupon
   GET /api/coupons/:id
===================================================== */

exports.getCouponById = async (
    req,
    res
) => {
    try {
        const couponId =
            parseId(
                req.params.id
            );

        if (!couponId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid coupon ID is required."
            });
        }

        const [rows] =
            await db.query(
                `
                    SELECT
                        cp.*,

                        c.full_name AS customer_name,
                        c.email AS customer_email,
                        c.phone AS customer_phone

                    FROM coupons cp

                    LEFT JOIN customers c
                        ON c.id = cp.customer_id

                    WHERE cp.id = ?

                    LIMIT 1
                `,
                [couponId]
            );

        if (
            rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Coupon not found."
            });
        }

        return res.json({
            success: true,
            message:
                "Coupon fetched successfully.",

            coupon: {
                ...rows[0],

                availability_status:
                    couponAvailability(
                        rows[0]
                    )
            }
        });
    } catch (error) {
        console.error(
            "Get coupon details error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch coupon details.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

/* =====================================================
   Update Coupon
   PUT /api/coupons/:id
===================================================== */

exports.updateCoupon = async (
    req,
    res
) => {
    try {
        const couponId =
            parseId(
                req.params.id
            );

        if (!couponId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid coupon ID is required."
            });
        }

        const [existingRows] =
            await db.query(
                `
                    SELECT *
                    FROM coupons
                    WHERE id = ?
                    LIMIT 1
                `,
                [couponId]
            );

        if (
            existingRows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Coupon not found."
            });
        }

        const existing =
            existingRows[0];

        const validation =
            validateCouponPayload({
                ...existing,
                ...(req.body || {})
            }, true);

        if (validation.error) {
            return res.status(400).json({
                success: false,
                message:
                    validation.error
            });
        }

        const coupon =
            validation.value;

        const [duplicates] =
            await db.query(
                `
                    SELECT id
                    FROM coupons
                    WHERE code = ?
                    AND id <> ?
                    LIMIT 1
                `,
                [
                    coupon.code,
                    couponId
                ]
            );

        if (
            duplicates.length > 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Coupon code already exists."
            });
        }

        if (coupon.customerId) {
            const [customers] =
                await db.query(
                    `
                        SELECT id
                        FROM customers
                        WHERE id = ?
                        LIMIT 1
                    `,
                    [
                        coupon.customerId
                    ]
                );

            if (
                customers.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Customer not found."
                });
            }
        }

        await db.query(
            `
                UPDATE coupons

                SET
                    customer_id = ?,
                    coupon_type = ?,
                    code = ?,
                    discount_type = ?,
                    discount_value = ?,
                    minimum_order = ?,
                    usage_limit = ?,
                    expiry_date = ?,
                    status = ?

                WHERE id = ?
            `,
            [
                coupon.customerId,
                coupon.couponType,
                coupon.code,
                coupon.discountType,
                coupon.discountValue,
                coupon.minimumOrder,
                coupon.usageLimit,
                coupon.expiryDate,
                coupon.status,
                couponId
            ]
        );

        const [rows] =
            await db.query(
                `
                    SELECT *
                    FROM coupons
                    WHERE id = ?
                    LIMIT 1
                `,
                [couponId]
            );

        return res.json({
            success: true,
            message:
                "Coupon updated successfully.",
            coupon:
                rows[0]
        });
    } catch (error) {
        console.error(
            "Update coupon error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update coupon.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

/* =====================================================
   Delete Coupon
   DELETE /api/coupons/:id
===================================================== */

exports.deleteCoupon = async (
    req,
    res
) => {
    try {
        const couponId =
            parseId(
                req.params.id
            );

        if (!couponId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid coupon ID is required."
            });
        }

        const [result] =
            await db.query(
                `
                    DELETE FROM coupons
                    WHERE id = ?
                `,
                [couponId]
            );

        if (
            result.affectedRows === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Coupon not found."
            });
        }

        return res.json({
            success: true,
            message:
                "Coupon deleted successfully."
        });
    } catch (error) {
        console.error(
            "Delete coupon error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete coupon.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

/* =====================================================
   Apply Coupon Preview
   POST /api/coupons/apply

   This validates and calculates only.
   It does not increment used_count.
===================================================== */

exports.applyCoupon = async (
    req,
    res
) => {
    try {
        const code =
            normalizeCode(
                req.body.code
            );

        const orderTotal =
            toMoney(
                req.body.orderTotal
            );

        const customerId =
            req.body.customerId
                ? parseId(
                    req.body.customerId
                )
                : null;

        if (!code) {
            return res.status(400).json({
                success: false,
                message:
                    "Coupon code is required."
            });
        }

        if (
            orderTotal === null ||
            orderTotal <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid order total greater than zero is required."
            });
        }

        const [rows] =
            await db.query(
                `
                    SELECT *
                    FROM coupons
                    WHERE code = ?
                    LIMIT 1
                `,
                [code]
            );

        if (
            rows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Invalid coupon."
            });
        }

        const coupon =
            rows[0];

        // Customer-specific coupon validation.
        if (
            coupon.customer_id !== null &&
            Number(coupon.customer_id) !==
                customerId
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "This coupon is not available for your account."
            });
        }

        if (
            String(
                coupon.status
            ).toLowerCase() !==
            "active"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This coupon is inactive."
            });
        }

        if (
            coupon.expiry_date &&
            new Date(
                coupon.expiry_date
            ) <
            new Date()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Coupon has expired."
            });
        }

        if (
            Number(orderTotal) <
            Number(
                coupon.minimum_order ||
                0
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Minimum order should be PKR ${Number(
                        coupon.minimum_order ||
                        0
                    ).toFixed(2)}.`
            });
        }

        if (
            coupon.usage_limit !== null &&
            Number(
                coupon.used_count ||
                0
            ) >=
            Number(
                coupon.usage_limit
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Coupon usage limit reached."
            });
        }

        if (
            coupon.customer_id !== null
        ) {
            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "This coupon is assigned to a specific customer."
                });
            }

            if (
                Number(
                    coupon.customer_id
                ) !==
                Number(customerId)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "This coupon is not available for this customer."
                });
            }
        }

        let discountAmount = 0;

let appliedCoupon = null;
let appliedCouponId = null;

        if (
            coupon.discount_type ===
            "percentage"
        ) {
            discountAmount =
                orderTotal *
                Number(
                    coupon.discount_value
                ) /
                100;
        } else {
            discountAmount =
                Number(
                    coupon.discount_value
                );
        }

        discountAmount =
            Math.min(
                orderTotal,
                Number(
                    discountAmount.toFixed(2)
                )
            );

        const finalAmount =
            Number(
                Math.max(
                    0,
                    orderTotal -
                    discountAmount
                ).toFixed(2)
            );

        return res.json({
            success: true,
            message:
                "Coupon applied successfully.",

            coupon: {
                id:
                    coupon.id,

                code:
                    coupon.code,

                couponType:
                    coupon.coupon_type,

                discountType:
                    coupon.discount_type,

                discountValue:
                    Number(
                        coupon.discount_value
                    ),

                minimumOrder:
                    Number(
                        coupon.minimum_order ||
                        0
                    ),

                expiryDate:
                    coupon.expiry_date
            },

            calculation: {
                orderTotal,
                discountAmount,
                finalAmount
            }
        });
    } catch (error) {
        console.error(
            "Apply coupon error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to apply coupon.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};