"use strict";

const db = require("../config/db");
const paymentService =
    require("../services/paymentService");

const parseId = value => {
    const id = Number.parseInt(value, 10);

    return (
        Number.isInteger(id) &&
        id > 0
    )
        ? id
        : null;
};

const positiveInteger = (
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

const clean = value =>
    String(value || "").trim();

const adminIdFrom = req =>
    req.admin?.id ||
    req.admin?.adminId ||
    req.admin?.userId ||
    null;

const ALLOWED_STATUSES = [
    "Pending",
    "Paid",
    "Failed",
    "Partially Refunded",
    "Refunded"
];

const ALLOWED_METHODS = [
    "Cash on Delivery",
    "Bank Transfer",
    "EasyPaisa",
    "JazzCash",
    "Stripe"
];

/* =====================================================
   Record Payment for Order
===================================================== */

exports.recordForOrder = async (
    req,
    res
) => {
    try {
        const orderId =
            parseId(req.params.id);

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid order ID is required."
            });
        }

        const result =
            await paymentService.recordPayment({
                orderId,
                adminId:
                    adminIdFrom(req),
                payload:
                    req.body || {}
            });

        return res.status(201).json({
            success: true,
            message:
                "Payment recorded successfully.",
            ...result
        });
    } catch (error) {
        console.error(
            "Record payment error:",
            error
        );

        return res
            .status(
                error.statusCode || 500
            )
            .json({
                success: false,
                message: error.message
            });
    }
};

exports.getForOrder = async (
    req,
    res
) => {
    try {
        const orderId =
            parseId(req.params.id);

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid order ID is required."
            });
        }

        const result =
            await paymentService
                .getOrderPayments(orderId);

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        return res
            .status(
                error.statusCode || 500
            )
            .json({
                success: false,
                message: error.message
            });
    }
};

/* =====================================================
   Payment Dashboard
   Source of truth: payment_transactions
===================================================== */

exports.getDashboard = async (
    req,
    res
) => {
    try {
        const [[summary]] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_payments,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN status IN (
                                    'Paid',
                                    'Partially Refunded'
                                )
                                THEN
                                    amount -
                                    COALESCE(
                                        refunded_amount,
                                        0
                                    )
                                ELSE 0
                            END
                        ),
                        0
                    ) AS total_collected,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN status IN (
                                    'Paid',
                                    'Partially Refunded'
                                )
                                AND DATE(
                                    COALESCE(
                                        paid_at,
                                        created_at
                                    )
                                ) = CURRENT_DATE
                                THEN
                                    amount -
                                    COALESCE(
                                        refunded_amount,
                                        0
                                    )
                                ELSE 0
                            END
                        ),
                        0
                    ) AS today_collections,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN status IN (
                                    'Paid',
                                    'Partially Refunded'
                                )
                                AND YEAR(
                                    COALESCE(
                                        paid_at,
                                        created_at
                                    )
                                ) =
                                    YEAR(CURRENT_DATE)
                                AND MONTH(
                                    COALESCE(
                                        paid_at,
                                        created_at
                                    )
                                ) =
                                    MONTH(CURRENT_DATE)
                                THEN
                                    amount -
                                    COALESCE(
                                        refunded_amount,
                                        0
                                    )
                                ELSE 0
                            END
                        ),
                        0
                    ) AS monthly_collections,

                    SUM(
                        status IN (
                            'Paid',
                            'Partially Refunded'
                        )
                    ) AS successful_payments,

                    SUM(
                        status = 'Pending'
                    ) AS pending_payments,

                    SUM(
                        status = 'Failed'
                    ) AS failed_payments,

                    SUM(
                        status IN (
                            'Refunded',
                            'Partially Refunded'
                        )
                    ) AS refunded_payments,

                    COALESCE(
                        SUM(
                            refunded_amount
                        ),
                        0
                    ) AS refunded_amount

                FROM payment_transactions
            `);

        const [[outstanding]] =
            await db.query(`
                SELECT
                    COUNT(*) AS outstanding_orders,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN payment_status NOT IN (
                                    'Paid',
                                    'Refunded'
                                )
                                THEN GREATEST(
                                    0,
                                    grand_total -
                                    COALESCE(
                                        paid_amount,
                                        0
                                    )
                                )
                                ELSE 0
                            END
                        ),
                        0
                    ) AS outstanding_amount

                FROM orders

                WHERE
                    order_status !=
                        'Cancelled'
                    AND payment_status NOT IN (
                        'Paid',
                        'Refunded'
                    )
                    AND GREATEST(
                        0,
                        grand_total -
                        COALESCE(
                            paid_amount,
                            0
                        )
                    ) > 0
            `);

        const [methodBreakdown] =
            await db.query(`
                SELECT
                    payment_method AS paymentMethod,

                    COUNT(*) AS paymentCount,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN status IN (
                                    'Paid',
                                    'Partially Refunded'
                                )
                                THEN
                                    amount -
                                    COALESCE(
                                        refunded_amount,
                                        0
                                    )
                                ELSE 0
                            END
                        ),
                        0
                    ) AS collectedAmount

                FROM payment_transactions

                GROUP BY
                    payment_method

                ORDER BY
                    collectedAmount DESC
            `);

        return res.json({
            success: true,

            dashboard: {
                totalPayments:
                    Number(
                        summary.total_payments || 0
                    ),

                totalCollected:
                    Number(
                        summary.total_collected || 0
                    ),

                todayCollections:
                    Number(
                        summary.today_collections || 0
                    ),

                monthlyCollections:
                    Number(
                        summary.monthly_collections || 0
                    ),

                successfulPayments:
                    Number(
                        summary.successful_payments || 0
                    ),

                pendingPayments:
                    Number(
                        summary.pending_payments || 0
                    ),

                refundedPayments:
                    Number(
                        summary.refunded_payments || 0
                    ),

                refundedAmount:
                    Number(
                        summary.refunded_amount || 0
                    ),

                outstandingOrders:
                    Number(
                        outstanding.outstanding_orders || 0
                    ),

                outstandingAmount:
                    Number(
                        outstanding.outstanding_amount || 0
                    )
            },

            methodBreakdown:
                methodBreakdown.map(
                    item => ({
                        paymentMethod:
                            item.paymentMethod,

                        paymentCount:
                            Number(
                                item.paymentCount || 0
                            ),

                        collectedAmount:
                            Number(
                                item.collectedAmount || 0
                            )
                    })
                )
        });
    } catch (error) {
        console.error(
            "Payment dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch payment dashboard.",
            error:
                process.env.NODE_ENV !==
                "production"
                    ? error.message
                    : undefined
        });
    }
};

/* =====================================================
   Get All Payment Transactions
===================================================== */

exports.getAll = async (
    req,
    res
) => {
    try {
        const page =
            positiveInteger(
                req.query.page,
                1
            );

        const limit =
            positiveInteger(
                req.query.limit,
                20,
                100
            );

        const offset =
            (page - 1) *
            limit;

        const search =
            clean(
                req.query.search
            );

        const status =
            clean(
                req.query.status
            );

        const method =
            clean(
                req.query.method
            );

        const conditions = [];
        const values = [];

        if (search) {
            const value =
                `%${search}%`;

            conditions.push(`
                (
                    CAST(pt.id AS CHAR) LIKE ?
                    OR pt.payment_number LIKE ?
                    OR CAST(pt.order_id AS CHAR) LIKE ?
                    OR o.order_number LIKE ?
                    OR c.full_name LIKE ?
                    OR c.email LIKE ?
                    OR c.phone LIKE ?
                    OR pt.transaction_reference LIKE ?
                )
            `);

            values.push(
                value,
                value,
                value,
                value,
                value,
                value,
                value,
                value
            );
        }

        if (status) {
            if (
                !ALLOWED_STATUSES.includes(
                    status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payment status."
                });
            }

            conditions.push(
                "pt.status = ?"
            );

            values.push(status);
        }

        if (method) {
            if (
                !ALLOWED_METHODS.includes(
                    method
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payment method."
                });
            }

            conditions.push(
                "pt.payment_method = ?"
            );

            values.push(method);
        }

        if (req.query.customer_id) {
            conditions.push(
                "pt.customer_id = ?"
            );

            values.push(
                parseId(
                    req.query.customer_id
                )
            );
        }

        if (req.query.order_id) {
            conditions.push(
                "pt.order_id = ?"
            );

            values.push(
                parseId(
                    req.query.order_id
                )
            );
        }

        if (req.query.date_from) {
            conditions.push(`
                DATE(
                    COALESCE(
                        pt.paid_at,
                        pt.created_at
                    )
                ) >= ?
            `);

            values.push(
                clean(
                    req.query.date_from
                )
            );
        }

        if (req.query.date_to) {
            conditions.push(`
                DATE(
                    COALESCE(
                        pt.paid_at,
                        pt.created_at
                    )
                ) <= ?
            `);

            values.push(
                clean(
                    req.query.date_to
                )
            );
        }

        const where =
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

                FROM payment_transactions pt

                INNER JOIN orders o
                    ON o.id =
                        pt.order_id

                INNER JOIN customers c
                    ON c.id =
                        pt.customer_id

                ${where}
                `,
                values
            );

        const [payments] =
            await db.query(
                `
                SELECT
                    pt.id,
                    pt.payment_number,
                    pt.order_id,
                    pt.customer_id,
                    pt.payment_method,
                    pt.status AS payment_status,
                    pt.transaction_reference,
                    pt.gateway_transaction_id,
                    pt.amount,
                    pt.refunded_amount,
                    pt.currency,
                    pt.notes,
                    pt.paid_at,
                    pt.created_at,

                    o.order_number,
                    o.order_status,
                    o.payment_status AS order_payment_status,
                    o.grand_total AS order_total,
                    o.paid_amount AS order_paid_amount,
                    o.balance_amount AS order_balance_amount,

                    c.full_name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone

                FROM payment_transactions pt

                INNER JOIN orders o
                    ON o.id =
                        pt.order_id

                INNER JOIN customers c
                    ON c.id =
                        pt.customer_id

                ${where}

                ORDER BY
                    COALESCE(
                        pt.paid_at,
                        pt.created_at
                    ) DESC,
                    pt.id DESC

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
                countRow.total || 0
            );

        return res.json({
            success: true,

            payments:
                payments.map(
                    payment => ({
                        ...payment,

                        amount:
                            Number(
                                payment.amount || 0
                            ),

                        refunded_amount:
                            Number(
                                payment.refunded_amount || 0
                            ),

                        order_total:
                            Number(
                                payment.order_total || 0
                            ),

                        order_paid_amount:
                            Number(
                                payment.order_paid_amount || 0
                            ),

                        order_balance_amount:
                            Number(
                                payment.order_balance_amount || 0
                            )
                    })
                ),

            pagination: {
                currentPage:
                    page,

                limit,

                totalRecords,

                totalPages:
                    Math.max(
                        1,
                        Math.ceil(
                            totalRecords /
                            limit
                        )
                    )
            }
        });
    } catch (error) {
        console.error(
            "Get all payments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch payments.",
            error:
                process.env.NODE_ENV !==
                "production"
                    ? error.message
                    : undefined
        });
    }
};

/* =====================================================
   Outstanding Customer Orders
===================================================== */

exports.getOutstanding = async (
    req,
    res
) => {
    try {
        const [orders] =
            await db.query(`
                SELECT
                    o.id,
                    o.order_number,
                    o.customer_id,
                    o.order_status,
                    o.payment_method,
                    o.payment_status,
                    o.grand_total,
                    COALESCE(
                        o.paid_amount,
                        0
                    ) AS paid_amount,

                    GREATEST(
                        0,
                        o.grand_total -
                        COALESCE(
                            o.paid_amount,
                            0
                        )
                    ) AS balance_amount,

                    o.created_at,

                    c.full_name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone

                FROM orders o

                INNER JOIN customers c
                    ON c.id =
                        o.customer_id

                WHERE
                    o.order_status !=
                        'Cancelled'
                    AND o.payment_status NOT IN (
                        'Paid',
                        'Refunded'
                    )
                    AND GREATEST(
                        0,
                        o.grand_total -
                        COALESCE(
                            o.paid_amount,
                            0
                        )
                    ) > 0

                ORDER BY
                    o.created_at DESC,
                    o.id DESC
            `);

        return res.json({
            success: true,

            orders:
                orders.map(
                    order => ({
                        ...order,

                        grand_total:
                            Number(
                                order.grand_total || 0
                            ),

                        paid_amount:
                            Number(
                                order.paid_amount || 0
                            ),

                        balance_amount:
                            Number(
                                order.balance_amount || 0
                            )
                    })
                )
        });
    } catch (error) {
        console.error(
            "Outstanding payments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load remaining customer payments.",
            error:
                process.env.NODE_ENV !==
                "production"
                    ? error.message
                    : undefined
        });
    }
};

exports.getById = async (
    req,
    res
) => {
    try {
        const paymentId =
            parseId(req.params.id);

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid payment ID is required."
            });
        }

        const [rows] =
            await db.query(
                `
                SELECT
                    pt.id,
                    pt.payment_number,
                    pt.order_id,
                    pt.customer_id,
                    pt.payment_method,
                    pt.status AS payment_status,
                    pt.transaction_reference,
                    pt.gateway_transaction_id,
                    pt.amount,
                    pt.refunded_amount,
                    pt.currency,
                    pt.notes,
                    pt.paid_at,
                    pt.created_at,

                    o.order_number,
                    o.order_status,
                    o.payment_status AS order_payment_status,
                    o.grand_total AS order_total,
                    o.paid_amount AS order_paid_amount,
                    o.balance_amount AS order_balance_amount,

                    c.full_name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    c.address AS customer_address,
                    c.city AS customer_city

                FROM payment_transactions pt

                INNER JOIN orders o
                    ON o.id =
                        pt.order_id

                INNER JOIN customers c
                    ON c.id =
                        pt.customer_id

                WHERE pt.id = ?

                LIMIT 1
                `,
                [paymentId]
            );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message:
                    "Payment not found."
            });
        }

        const payment = {
            ...rows[0],

            amount:
                Number(
                    rows[0].amount || 0
                ),

            refunded_amount:
                Number(
                    rows[0].refunded_amount || 0
                ),

            order_total:
                Number(
                    rows[0].order_total || 0
                ),

            order_paid_amount:
                Number(
                    rows[0].order_paid_amount || 0
                ),

            order_balance_amount:
                Number(
                    rows[0].order_balance_amount || 0
                )
        };

        return res.json({
            success: true,
            payment
        });
    } catch (error) {
        console.error(
            "Get payment details error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch payment details.",
            error:
                process.env.NODE_ENV !==
                "production"
                    ? error.message
                    : undefined
        });
    }
};

exports.refund = async (
    req,
    res
) => {
    try {
        const paymentId =
            parseId(
                req.params.paymentId
            );

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid payment ID is required."
            });
        }

        const result =
            await paymentService.refundPayment({
                paymentId,
                adminId:
                    adminIdFrom(req),
                payload:
                    req.body || {}
            });

        return res.status(201).json({
            success: true,
            message:
                "Refund recorded successfully.",
            ...result
        });
    } catch (error) {
        return res
            .status(
                error.statusCode || 500
            )
            .json({
                success: false,
                message: error.message
            });
    }
};
