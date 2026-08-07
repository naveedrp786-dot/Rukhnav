"use strict";

const db = require("../config/db");

const customerId = req =>
    Number(
        req.user?.id ||
        req.user?.customerId
    );

async function tableExists(name) {
    const [rows] =
        await db.query(
            `
            SELECT 1
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            LIMIT 1
            `,
            [name]
        );

    return rows.length > 0;
}

exports.getCoupons = async (
    req,
    res
) => {
    try {
        const customer =
            customerId(req);

        const [available] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.code,
                    c.coupon_type,
                    c.discount_type,
                    c.discount_value,
                    c.minimum_order,
                    c.expiry_date,
                    c.status
                FROM coupons c
                WHERE c.status = 'active'
                  AND (
                        c.customer_id IS NULL
                        OR c.customer_id = ?
                  )
                  AND (
                        c.expiry_date IS NULL
                        OR c.expiry_date >= CURRENT_DATE
                  )
                  AND (
                        c.usage_limit IS NULL
                        OR c.used_count < c.usage_limit
                  )
                  AND NOT EXISTS (
                        SELECT 1
                        FROM customer_coupon_redemptions r
                        WHERE r.coupon_id = c.id
                          AND r.customer_id = ?
                          AND r.status = 'Used'
                  )
                ORDER BY
                    c.expiry_date ASC,
                    c.id DESC
                `,
                [customer, customer]
            );

        const [used] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.code,
                    c.coupon_type,
                    c.discount_type,
                    c.discount_value,
                    c.minimum_order,
                    c.expiry_date,
                    r.discount_amount,
                    r.redeemed_at
                FROM customer_coupon_redemptions r
                INNER JOIN coupons c
                    ON c.id = r.coupon_id
                WHERE r.customer_id = ?
                  AND r.status = 'Used'
                ORDER BY r.redeemed_at DESC
                `,
                [customer]
            );

        const [expired] =
            await db.query(
                `
                SELECT
                    c.id,
                    c.code,
                    c.coupon_type,
                    c.discount_type,
                    c.discount_value,
                    c.minimum_order,
                    c.expiry_date,
                    c.status
                FROM coupons c
                WHERE (
                        c.customer_id IS NULL
                        OR c.customer_id = ?
                )
                  AND (
                        c.status <> 'active'
                        OR (
                            c.expiry_date IS NOT NULL
                            AND c.expiry_date < CURRENT_DATE
                        )
                        OR (
                            c.usage_limit IS NOT NULL
                            AND c.used_count >= c.usage_limit
                        )
                  )
                ORDER BY c.expiry_date DESC
                LIMIT 100
                `,
                [customer]
            );

        return res.json({
            success: true,
            coupons: {
                available,
                used,
                expired
            }
        });
    } catch (error) {
        console.error(
            "Customer coupons error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load customer coupons."
        });
    }
};

exports.getSummary = async (
    req,
    res
) => {
    try {
        const customer =
            customerId(req);

        const counts = {
            addresses: 0,
            availableCoupons: 0,
            reviews: 0,
            orders: 0,
            wishlist: 0,
            events: 0
        };

        const queries = [];

        if (
            await tableExists(
                "customer_addresses"
            )
        ) {
            queries.push(
                db.query(
                    `
                    SELECT COUNT(*) AS total
                    FROM customer_addresses
                    WHERE customer_id = ?
                    `,
                    [customer]
                ).then(
                    ([rows]) =>
                        counts.addresses =
                            Number(
                                rows[0]?.total ||
                                0
                            )
                )
            );
        }

        if (
            await tableExists("coupons")
        ) {
            queries.push(
                db.query(
                    `
                    SELECT COUNT(*) AS total
                    FROM coupons c
                    WHERE c.status = 'active'
                      AND (
                            c.customer_id IS NULL
                            OR c.customer_id = ?
                      )
                      AND (
                            c.expiry_date IS NULL
                            OR c.expiry_date >= CURRENT_DATE
                      )
                    `,
                    [customer]
                ).then(
                    ([rows]) =>
                        counts.availableCoupons =
                            Number(
                                rows[0]?.total ||
                                0
                            )
                )
            );
        }

        const optional = [
            [
                "product_reviews",
                "reviews",
                `
                SELECT COUNT(*) AS total
                FROM product_reviews
                WHERE customer_id = ?
                `
            ],
            [
                "orders",
                "orders",
                `
                SELECT COUNT(*) AS total
                FROM orders
                WHERE customer_id = ?
                `
            ],
            [
                "wishlist",
                "wishlist",
                `
                SELECT COUNT(*) AS total
                FROM wishlist
                WHERE customer_id = ?
                `
            ],
            [
                "customer_events",
                "events",
                `
                SELECT COUNT(*) AS total
                FROM customer_events
                WHERE customer_id = ?
                  AND status = 'Active'
                `
            ]
        ];

        for (
            const [
                table,
                key,
                sql
            ] of optional
        ) {
            if (
                await tableExists(table)
            ) {
                queries.push(
                    db.query(
                        sql,
                        [customer]
                    ).then(
                        ([rows]) =>
                            counts[key] =
                                Number(
                                    rows[0]?.total ||
                                    0
                                )
                    ).catch(() => {})
                );
            }
        }

        await Promise.allSettled(
            queries
        );

        return res.json({
            success: true,
            counts
        });
    } catch (error) {
        return res.json({
            success: true,
            counts: {}
        });
    }
};
