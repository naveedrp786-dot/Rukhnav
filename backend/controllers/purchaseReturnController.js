// ======================================================
// RUKHNAV ERP
// Purchase Return Controller
// Part 1: Helpers, Summary and Purchase Return List
// ======================================================

const db = require("../config/db");


// ======================================================
// Allowed Purchase Return Statuses
// ======================================================

const PURCHASE_RETURN_STATUSES = [
    "Draft",
    "Completed",
    "Cancelled"
];


// ======================================================
// Allowed Sorting Options
// ======================================================

const SORT_FIELDS = {
    newest: "pr.created_at DESC, pr.id DESC",
    oldest: "pr.created_at ASC, pr.id ASC",
    amount_high: "pr.total_amount DESC, pr.id DESC",
    amount_low: "pr.total_amount ASC, pr.id ASC",
    return_date_newest: "pr.return_date DESC, pr.id DESC",
    return_date_oldest: "pr.return_date ASC, pr.id ASC",
    status: "pr.status ASC, pr.created_at DESC"
};


// ======================================================
// Helper: Positive Integer
// ======================================================

function positiveInteger(value, fallback = null) {

    const parsedValue = Number.parseInt(value, 10);

    if (
        Number.isInteger(parsedValue) &&
        parsedValue > 0
    ) {
        return parsedValue;
    }

    return fallback;

}


// ======================================================
// Helper: Safe Number
// ======================================================

function numberValue(value) {

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue)
        ? parsedValue
        : 0;

}


// ======================================================
// Helper: Nullable Text
// ======================================================

function nullableText(value, maxLength = 255) {

    if (
        value === undefined ||
        value === null
    ) {
        return null;
    }

    const cleanedValue = String(value).trim();

    if (!cleanedValue) {
        return null;
    }

    return cleanedValue.slice(
        0,
        maxLength
    );

}


// ======================================================
// Helper: Normalise Enum
// ======================================================

function normaliseEnum(value, allowedValues) {

    const requestedValue = String(
        value || ""
    )
        .trim()
        .toLowerCase();

    return allowedValues.find(
        (allowedValue) =>
            allowedValue.toLowerCase() === requestedValue
    ) || null;

}


// ======================================================
// Helper: Validate Date
// ======================================================

function validDate(value) {

    if (!value) {
        return null;
    }

    const cleanedValue = String(value).trim();

    const datePattern =
        /^\d{4}-\d{2}-\d{2}$/;

    if (!datePattern.test(cleanedValue)) {
        return null;
    }

    const parsedDate = new Date(
        `${cleanedValue}T00:00:00`
    );

    if (
        Number.isNaN(
            parsedDate.getTime()
        )
    ) {
        return null;
    }

    return cleanedValue;

}


// ======================================================
// Helper: CSV Cell
// Used later by Export API
// ======================================================

function csvCell(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    const text = String(value)
        .replace(/"/g, '""');

    return /[",\n\r]/.test(text)
        ? `"${text}"`
        : text;

}


// ======================================================
// Helper: Generate Purchase Return Number
// Used later by Create API
// ======================================================

function generateReturnNumber() {

    const currentDate = new Date();

    const year = currentDate
        .getFullYear();

    const month = String(
        currentDate.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        currentDate.getDate()
    ).padStart(2, "0");

    const randomNumber = Math.floor(
        100000 + Math.random() * 900000
    );

    return `PR-${year}${month}${day}-${randomNumber}`;

}


// ======================================================
// Helper: Rollback Transaction Quietly
// Used later by Create and Status APIs
// ======================================================

async function rollbackQuietly(connection) {

    if (!connection) {
        return;
    }

    try {

        await connection.rollback();

    } catch (error) {

        console.error(
            "Purchase return rollback failed:",
            error.message
        );

    }

}


// ======================================================
// Helper: Write Purchase Return Activity Log
// Used later by Create, Update and Status APIs
// ======================================================

async function writePurchaseReturnLog(
    connection,
    {
        purchaseReturnId,
        adminId,
        action,
        oldValue = null,
        newValue = null,
        notes = null
    }
) {

    await connection.query(
        `
        INSERT INTO purchase_return_activity_logs
        (
            purchase_return_id,
            admin_id,
            action,
            old_value,
            new_value,
            notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            purchaseReturnId,
            adminId || null,
            action,
            oldValue,
            newValue,
            notes
        ]
    );

}


// ======================================================
// Purchase Return Summary
// GET /api/admin/purchase-returns/summary
// ======================================================

exports.getPurchaseReturnSummary = async (
    req,
    res
) => {

    try {

        const [rows] = await db.query(
            `
            SELECT
                COUNT(*) AS total_returns,

                COALESCE(
                    SUM(status = 'Draft'),
                    0
                ) AS draft_returns,

                COALESCE(
                    SUM(status = 'Completed'),
                    0
                ) AS completed_returns,

                COALESCE(
                    SUM(status = 'Cancelled'),
                    0
                ) AS cancelled_returns,

                COALESCE(
                    SUM(total_amount),
                    0
                ) AS total_return_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'Completed'
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS completed_return_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'Draft'
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS draft_return_value,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'Cancelled'
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS cancelled_return_value

            FROM purchase_returns
            `
        );

        const summary = rows[0] || {};

        return res.json({
            success: true,
            message:
                "Purchase return summary fetched successfully.",

            summary: {
                total_returns:
                    numberValue(
                        summary.total_returns
                    ),

                draft_returns:
                    numberValue(
                        summary.draft_returns
                    ),

                completed_returns:
                    numberValue(
                        summary.completed_returns
                    ),

                cancelled_returns:
                    numberValue(
                        summary.cancelled_returns
                    ),

                total_return_value:
                    numberValue(
                        summary.total_return_value
                    ),

                completed_return_value:
                    numberValue(
                        summary.completed_return_value
                    ),

                draft_return_value:
                    numberValue(
                        summary.draft_return_value
                    ),

                cancelled_return_value:
                    numberValue(
                        summary.cancelled_return_value
                    )
            }
        });

    } catch (error) {

        console.error(
            "Purchase return summary error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch purchase return summary.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};


// ======================================================
// Get All Purchase Returns
// GET /api/admin/purchase-returns
// ======================================================

exports.getAllPurchaseReturns = async (
    req,
    res
) => {

    try {

        // ----------------------------------------------
        // Pagination
        // ----------------------------------------------

        const page = positiveInteger(
            req.query.page,
            1
        );

        const limit = Math.min(
            positiveInteger(
                req.query.limit,
                20
            ),
            100
        );

        const offset =
            (page - 1) * limit;


        // ----------------------------------------------
        // Filters
        // ----------------------------------------------

        const requestedStatus =
            nullableText(
                req.query.status,
                50
            );

        const status =
            requestedStatus
                ? normaliseEnum(
                    requestedStatus,
                    PURCHASE_RETURN_STATUSES
                )
                : null;

        const supplierId =
            req.query.supplier_id
                ? positiveInteger(
                    req.query.supplier_id,
                    null
                )
                : null;

        const purchaseOrderId =
            req.query.purchase_order_id
                ? positiveInteger(
                    req.query.purchase_order_id,
                    null
                )
                : null;

        const search =
            nullableText(
                req.query.search,
                150
            );

        const dateFrom =
            req.query.date_from
                ? validDate(
                    req.query.date_from
                )
                : null;

        const dateTo =
            req.query.date_to
                ? validDate(
                    req.query.date_to
                )
                : null;

        const sort =
            SORT_FIELDS[req.query.sort]
                ? req.query.sort
                : "newest";


        // ----------------------------------------------
        // Filter Validation
        // ----------------------------------------------

        if (
            requestedStatus &&
            !status
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `Invalid status. Use: ${PURCHASE_RETURN_STATUSES.join(", ")}.`
            });

        }

        if (
            req.query.supplier_id &&
            !supplierId
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid supplier ID is required."
            });

        }

        if (
            req.query.purchase_order_id &&
            !purchaseOrderId
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid purchase order ID is required."
            });

        }

        if (
            req.query.date_from &&
            !dateFrom
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "date_from must use YYYY-MM-DD format."
            });

        }

        if (
            req.query.date_to &&
            !dateTo
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "date_to must use YYYY-MM-DD format."
            });

        }

        if (
            dateFrom &&
            dateTo &&
            dateFrom > dateTo
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "date_from cannot be later than date_to."
            });

        }


        // ----------------------------------------------
        // Dynamic WHERE Conditions
        // ----------------------------------------------

        const conditions = [];

        const values = [];


        if (status) {

            conditions.push(
                "pr.status = ?"
            );

            values.push(status);

        }


        if (supplierId) {

            conditions.push(
                "pr.supplier_id = ?"
            );

            values.push(supplierId);

        }


        if (purchaseOrderId) {

            conditions.push(
                "pr.purchase_order_id = ?"
            );

            values.push(purchaseOrderId);

        }


        if (search) {

            conditions.push(
                `
                (
                    pr.return_number LIKE ?
                    OR pr.reason LIKE ?
                    OR pr.remarks LIKE ?
                    OR CAST(
                        pr.purchase_order_id AS CHAR
                    ) LIKE ?
                    OR CAST(
                        pr.supplier_id AS CHAR
                    ) LIKE ?
                )
                `
            );

            const searchTerm =
                `%${search}%`;

            values.push(
                searchTerm,
                searchTerm,
                searchTerm,
                searchTerm,
                searchTerm
            );

        }


        if (dateFrom) {

            conditions.push(
                "pr.return_date >= ?"
            );

            values.push(dateFrom);

        }


        if (dateTo) {

            conditions.push(
                "pr.return_date <= ?"
            );

            values.push(dateTo);

        }


        const whereClause =
            conditions.length
                ? `WHERE ${conditions.join(" AND ")}`
                : "";


        // ----------------------------------------------
        // Count Query
        // ----------------------------------------------

        const [countRows] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total
                FROM purchase_returns pr
                ${whereClause}
                `,
                values
            );

        const total =
            numberValue(
                countRows[0]?.total
            );


        // ----------------------------------------------
        // Purchase Returns Query
        // ----------------------------------------------

        const [purchaseReturns] =
            await db.query(
                `
                SELECT
                    pr.id,
                    pr.return_number,
                    pr.purchase_order_id,
                    pr.supplier_id,
                    pr.return_date,
                    pr.total_amount,
                    pr.reason,
                    pr.remarks,
                    pr.status,
                    pr.created_by,
                    pr.created_at,
                    s.supplier_name AS supplier_name,

                    COUNT(
                        pri.id
                    ) AS item_count,

                    COALESCE(
                        SUM(pri.quantity),
                        0
                    ) AS total_quantity

                FROM purchase_returns pr

                LEFT JOIN suppliers s
                    ON s.id = pr.supplier_id

                LEFT JOIN purchase_return_items pri
                    ON pri.purchase_return_id = pr.id

                ${whereClause}

                GROUP BY
                    pr.id,
                    pr.return_number,
                    pr.purchase_order_id,
                    pr.supplier_id,
                    pr.return_date,
                    pr.total_amount,
                    pr.reason,
                    pr.remarks,
                    pr.status,
                    pr.created_by,
                    pr.created_at,
                    s.supplier_name

                ORDER BY ${SORT_FIELDS[sort]}

                LIMIT ? OFFSET ?
                `,
                [
                    ...values,
                    limit,
                    offset
                ]
            );


        // ----------------------------------------------
        // Pagination Response
        // ----------------------------------------------

        const totalPages =
            total > 0
                ? Math.ceil(
                    total / limit
                )
                : 0;


        return res.json({
            success: true,
            message:
                "Purchase returns fetched successfully.",

            pagination: {
                page,
                limit,
                total,
                totalPages,

                hasNextPage:
                    page < totalPages,

                hasPreviousPage:
                    page > 1
            },

            filters: {
                status,
                supplier_id:
                    supplierId,

                purchase_order_id:
                    purchaseOrderId,

                search,
                date_from:
                    dateFrom,

                date_to:
                    dateTo,

                sort
            },

            purchaseReturns:
                purchaseReturns.map(
                    (purchaseReturn) => ({
                        ...purchaseReturn,

                        total_amount:
                            numberValue(
                                purchaseReturn.total_amount
                            ),

                        item_count:
                            numberValue(
                                purchaseReturn.item_count
                            ),

                        total_quantity:
                            numberValue(
                                purchaseReturn.total_quantity
                            )
                    })
                )
        });

    } catch (error) {

        console.error(
            "Purchase returns list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch purchase returns.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};


// ======================================================
// Export Helpers for Remaining Controller Parts
// ======================================================

exports.purchaseReturnHelpers = {
    PURCHASE_RETURN_STATUSES,
    SORT_FIELDS,
    positiveInteger,
    numberValue,
    nullableText,
    normaliseEnum,
    validDate,
    csvCell,
    generateReturnNumber,
    rollbackQuietly,
    writePurchaseReturnLog
};
// ======================================================
// Get Single Purchase Return
// GET /api/admin/purchase-returns/:id
// ======================================================

exports.getPurchaseReturnById = async (
    req,
    res
) => {

    try {

        const purchaseReturnId =
            positiveInteger(
                req.params.id,
                null
            );

        if (!purchaseReturnId) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid purchase return ID is required."
            });

        }


        // ----------------------------------------------
        // Get Main Purchase Return
        // ----------------------------------------------

        const [returnRows] =
            await db.query(
                `
                SELECT
                    pr.id,
                    pr.return_number,
                    pr.purchase_order_id,
                    pr.supplier_id,
                    pr.return_date,
                    pr.total_amount,
                    pr.reason,
                    pr.remarks,
                    pr.status,
                    pr.created_by,
                    pr.created_at,
                    s.supplier_name AS supplier_name
                FROM purchase_returns pr
                LEFT JOIN suppliers s
                    ON s.id = pr.supplier_id
                WHERE pr.id = ?
                LIMIT 1
                `,
                [purchaseReturnId]
            );

        if (!returnRows.length) {

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        // ----------------------------------------------
        // Get Return Items
        // ----------------------------------------------

        const [items] =
            await db.query(
                `
                SELECT
                    pri.id,
                    pri.purchase_return_id,
                    pri.purchase_order_item_id,
                    pri.product_id,
                    pri.quantity,
                    pri.unit_cost,
                    pri.total_cost,

                    p.product_name,
                    p.sku,
                    p.unit,
                    p.batch_number,
                    p.expiry_date

                FROM purchase_return_items pri

                LEFT JOIN products p
                    ON p.id = pri.product_id

                WHERE pri.purchase_return_id = ?

                ORDER BY pri.id ASC
                `,
                [purchaseReturnId]
            );


        // ----------------------------------------------
        // Get Activity History
        // ----------------------------------------------

        const [activity] =
            await db.query(
                `
                SELECT
                    pral.id,
                    pral.purchase_return_id,
                    pral.admin_id,
                    pral.action,
                    pral.old_value,
                    pral.new_value,
                    pral.notes,
                    pral.created_at,

                    TRIM(
                        CONCAT_WS(
                            ' ',
                            a.first_name,
                            a.last_name
                        )
                    ) AS admin_name

                FROM purchase_return_activity_logs pral

                LEFT JOIN admins a
                    ON a.id = pral.admin_id

                WHERE pral.purchase_return_id = ?

                ORDER BY pral.id DESC
                `,
                [purchaseReturnId]
            );


        // ----------------------------------------------
        // Get Supplier Refunds
        // ----------------------------------------------

        const [refunds] =
            await db.query(
                `
                SELECT
                    prr.id,
                    prr.purchase_return_id,
                    prr.supplier_id,
                    prr.amount,
                    prr.refund_method,
                    prr.reference_number,
                    prr.refund_date,
                    prr.notes,
                    prr.recorded_by,
                    prr.created_at,

                    TRIM(
                        CONCAT_WS(
                            ' ',
                            a.first_name,
                            a.last_name
                        )
                    ) AS recorded_by_name

                FROM purchase_return_refunds prr

                LEFT JOIN admins a
                    ON a.id = prr.recorded_by

                WHERE prr.purchase_return_id = ?

                ORDER BY prr.id DESC
                `,
                [purchaseReturnId]
            );


        const purchaseReturn =
            returnRows[0];


        return res.json({
            success: true,
            message:
                "Purchase return fetched successfully.",

            purchaseReturn: {
                ...purchaseReturn,

                total_amount:
                    numberValue(
                        purchaseReturn.total_amount
                    )
            },

            items:
                items.map(
                    (item) => ({
                        ...item,

                        quantity:
                            numberValue(
                                item.quantity
                            ),

                        unit_cost:
                            numberValue(
                                item.unit_cost
                            ),

                        total_cost:
                            numberValue(
                                item.total_cost
                            )
                    })
                ),

            activity,

            refunds:
                refunds.map(
                    (refund) => ({
                        ...refund,

                        amount:
                            numberValue(
                                refund.amount
                            )
                    })
                )
        });

    } catch (error) {

        console.error(
            "Get purchase return details error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch purchase return details.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};


// ======================================================
// Get Purchase Order Items for Return
// GET /api/admin/purchase-returns/purchase-order/:id/items
// ======================================================

exports.getPurchaseOrderItemsForReturn = async (
    req,
    res
) => {

    try {

        const purchaseOrderId =
            positiveInteger(
                req.params.id,
                null
            );

        if (!purchaseOrderId) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid purchase order ID is required."
            });

        }


        // ----------------------------------------------
        // Check Purchase Order
        // ----------------------------------------------

        const [purchaseOrders] =
            await db.query(
                `
                SELECT *
                FROM purchase_orders
                WHERE id = ?
                LIMIT 1
                `,
                [purchaseOrderId]
            );

        if (!purchaseOrders.length) {

            return res.status(404).json({
                success: false,
                message:
                    "Purchase order not found."
            });

        }


        // ----------------------------------------------
        // Get Purchase Order Items
        // ----------------------------------------------

        const [items] =
            await db.query(
                `
                SELECT
                    poi.id AS purchase_order_item_id,
                    poi.purchase_order_id,
                    poi.product_id,
                    poi.quantity AS purchased_quantity,
poi.unit_cost,
ROUND(
    poi.quantity * poi.unit_cost,
    2
) AS total,

p.product_name,
p.stock_quantity,

                    COALESCE(
                        (
                            SELECT
                                SUM(pri.quantity)

                            FROM purchase_return_items pri

                            INNER JOIN purchase_returns pr
                                ON pr.id =
                                    pri.purchase_return_id

                            WHERE
                                pri.purchase_order_item_id =
                                    poi.id

                                AND pr.status != 'Cancelled'
                        ),
                        0
                    ) AS already_returned_quantity

                FROM purchase_order_items poi

                LEFT JOIN products p
                    ON p.id = poi.product_id

                WHERE poi.purchase_order_id = ?

                ORDER BY poi.id ASC
                `,
                [purchaseOrderId]
            );


        const formattedItems =
            items.map(
                (item) => {

                    const purchasedQuantity =
                        numberValue(
                            item.purchased_quantity
                        );

                    const alreadyReturnedQuantity =
                        numberValue(
                            item.already_returned_quantity
                        );

                    return {
                        ...item,

                        purchased_quantity:
                            purchasedQuantity,

                        unit_cost:
                            numberValue(
                                item.unit_cost
                            ),

                        total:
                            numberValue(
                                item.total
                            ),

                        stock_quantity:
                            numberValue(
                                item.stock_quantity
                            ),

                        already_returned_quantity:
                            alreadyReturnedQuantity,

                        remaining_returnable_quantity:
                            Math.max(
                                purchasedQuantity -
                                alreadyReturnedQuantity,
                                0
                            )
                    };

                }
            );


        return res.json({
            success: true,
            message:
                "Purchase order items fetched successfully.",

            purchaseOrder:
                purchaseOrders[0],

            items:
                formattedItems
        });

    } catch (error) {

        console.error(
            "Get purchase order return items error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch purchase order items.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};


// ======================================================
// Create Purchase Return
// POST /api/admin/purchase-returns
// ======================================================

exports.createPurchaseReturn = async (
    req,
    res
) => {

    const purchaseOrderId =
        positiveInteger(
            req.body.purchase_order_id,
            null
        );

    const supplierId =
        positiveInteger(
            req.body.supplier_id,
            null
        );

    const returnDate =
        validDate(
            req.body.return_date
        );

    const reason =
        nullableText(
            req.body.reason,
            255
        );

    const remarks =
        nullableText(
            req.body.remarks,
            5000
        );

    const requestedStatus =
        normaliseEnum(
            req.body.status || "Draft",
            PURCHASE_RETURN_STATUSES
        );

    const items =
        Array.isArray(
            req.body.items
        )
            ? req.body.items
            : [];

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    // ----------------------------------------------
    // Basic Validation
    // ----------------------------------------------

    if (!purchaseOrderId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid purchase order ID is required."
        });

    }

    if (!supplierId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid supplier ID is required."
        });

    }

    if (!returnDate) {

        return res.status(400).json({
            success: false,
            message:
                "A valid return date is required in YYYY-MM-DD format."
        });

    }

    if (!reason) {

        return res.status(400).json({
            success: false,
            message:
                "A purchase return reason is required."
        });

    }

    if (!requestedStatus) {

        return res.status(400).json({
            success: false,
            message:
                `Invalid status. Use: ${PURCHASE_RETURN_STATUSES.join(", ")}.`
        });

    }

    if (!items.length) {

        return res.status(400).json({
            success: false,
            message:
                "At least one purchase return item is required."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // ----------------------------------------------
        // Lock and Validate Purchase Order
        // ----------------------------------------------

        const [purchaseOrders] =
            await connection.query(
                `
                SELECT *
                FROM purchase_orders
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [purchaseOrderId]
            );

        if (!purchaseOrders.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Purchase order not found."
            });

        }


        const purchaseOrder =
            purchaseOrders[0];


        // ----------------------------------------------
        // Validate Supplier
        // ----------------------------------------------

        if (
            Number(
                purchaseOrder.supplier_id
            ) !== supplierId
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "The selected supplier does not belong to this purchase order."
            });

        }


        // ----------------------------------------------
        // Prepare Return Items
        // ----------------------------------------------

        const preparedItems = [];

        let totalAmount = 0;


        for (
            let index = 0;
            index < items.length;
            index += 1
        ) {

            const inputItem =
                items[index];

            const purchaseOrderItemId =
                positiveInteger(
                    inputItem.purchase_order_item_id,
                    null
                );

            const productId =
                positiveInteger(
                    inputItem.product_id,
                    null
                );

            const quantity =
                numberValue(
                    inputItem.quantity
                );


            if (!purchaseOrderItemId) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Item ${index + 1}: a valid purchase order item ID is required.`
                });

            }


            if (!productId) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Item ${index + 1}: a valid product ID is required.`
                });

            }


            if (
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                !Number.isInteger(quantity)
            ) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Item ${index + 1}: return quantity must be a positive whole number.`
                });

            }


            // ------------------------------------------
            // Lock Purchase Order Item
            // ------------------------------------------

            const [purchaseItemRows] =
                await connection.query(
                    `
                    SELECT
                        poi.id,
                        poi.purchase_order_id,
                        poi.product_id,
                        poi.quantity,
                        poi.unit_cost,
                        ROUND(
    poi.quantity * poi.unit_cost,
    2
) AS total

                    FROM purchase_order_items poi

                    WHERE poi.id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [purchaseOrderItemId]
                );


            if (!purchaseItemRows.length) {

                await rollbackQuietly(
                    connection
                );

                return res.status(404).json({
                    success: false,
                    message:
                        `Item ${index + 1}: purchase order item not found.`
                });

            }


            const purchaseItem =
                purchaseItemRows[0];


            if (
                Number(
                    purchaseItem.purchase_order_id
                ) !== purchaseOrderId
            ) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Item ${index + 1} does not belong to the selected purchase order.`
                });

            }


            if (
                Number(
                    purchaseItem.product_id
                ) !== productId
            ) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Item ${index + 1}: product does not match the purchase order item.`
                });

            }


            // ------------------------------------------
            // Check Already Returned Quantity
            // ------------------------------------------

            const [returnedRows] =
                await connection.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(pri.quantity),
                            0
                        ) AS returned_quantity

                    FROM purchase_return_items pri

                    INNER JOIN purchase_returns pr
                        ON pr.id =
                            pri.purchase_return_id

                    WHERE
                        pri.purchase_order_item_id = ?

                        AND pr.status != 'Cancelled'
                    `,
                    [purchaseOrderItemId]
                );


            const purchasedQuantity =
                numberValue(
                    purchaseItem.quantity
                );

            const alreadyReturnedQuantity =
                numberValue(
                    returnedRows[0]
                        ?.returned_quantity
                );

            const availableQuantity =
                purchasedQuantity -
                alreadyReturnedQuantity;


            if (
                quantity >
                availableQuantity
            ) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Item ${index + 1}: only ${availableQuantity} unit(s) can still be returned.`
                });

            }


            const unitCost =
                numberValue(
                    purchaseItem.unit_cost
                );

            const totalCost =
                Number(
                    (
                        quantity *
                        unitCost
                    ).toFixed(2)
                );


            preparedItems.push({
                purchase_order_item_id:
                    purchaseOrderItemId,

                product_id:
                    productId,

                quantity,

                unit_cost:
                    unitCost,

                total_cost:
                    totalCost
            });


            totalAmount +=
                totalCost;

        }


        totalAmount =
            Number(
                totalAmount.toFixed(2)
            );


        // ----------------------------------------------
        // Generate Unique Return Number
        // ----------------------------------------------

        let returnNumber = null;

        let numberIsUnique = false;

        let attempts = 0;


        while (
            !numberIsUnique &&
            attempts < 10
        ) {

            attempts += 1;

            returnNumber =
                generateReturnNumber();

            const [existingRows] =
                await connection.query(
                    `
                    SELECT id
                    FROM purchase_returns
                    WHERE return_number = ?
                    LIMIT 1
                    `,
                    [returnNumber]
                );

            numberIsUnique =
                existingRows.length === 0;

        }


        if (!numberIsUnique) {

            throw new Error(
                "Unable to generate a unique purchase return number."
            );

        }


        // ----------------------------------------------
        // Insert Purchase Return
        // ----------------------------------------------

        const [returnResult] =
            await connection.query(
                `
                INSERT INTO purchase_returns
                (
                    return_number,
                    purchase_order_id,
                    supplier_id,
                    return_date,
                    total_amount,
                    reason,
                    remarks,
                    status,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    returnNumber,
                    purchaseOrderId,
                    supplierId,
                    returnDate,
                    totalAmount,
                    reason,
                    remarks,
                    requestedStatus,
                    adminId
                ]
            );


        const purchaseReturnId =
            returnResult.insertId;


        // ----------------------------------------------
        // Insert Purchase Return Items
        // ----------------------------------------------

        for (
            const preparedItem
            of preparedItems
        ) {

            await connection.query(
                `
                INSERT INTO purchase_return_items
                (
                    purchase_return_id,
                    purchase_order_item_id,
                    product_id,
                    quantity,
                    unit_cost,
                    total_cost
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    purchaseReturnId,
                    preparedItem
                        .purchase_order_item_id,

                    preparedItem
                        .product_id,

                    preparedItem
                        .quantity,

                    preparedItem
                        .unit_cost,

                    preparedItem
                        .total_cost
                ]
            );

        }


        // ----------------------------------------------
        // Adjust Stock Only If Completed
        // ----------------------------------------------

        if (
            requestedStatus === "Completed"
        ) {

            for (
                const preparedItem
                of preparedItems
            ) {

                const [productRows] =
                    await connection.query(
                        `
                        SELECT
                            id,
                            stock_quantity

                        FROM products

                        WHERE id = ?
                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            preparedItem
                                .product_id
                        ]
                    );


                if (!productRows.length) {

                    await rollbackQuietly(
                        connection
                    );

                    return res.status(404).json({
                        success: false,
                        message:
                            `Product ID ${preparedItem.product_id} was not found.`
                    });

                }


                const currentStock =
                    numberValue(
                        productRows[0]
                            .stock_quantity
                    );


                if (
                    currentStock <
                    preparedItem.quantity
                ) {

                    await rollbackQuietly(
                        connection
                    );

                    return res.status(400).json({
                        success: false,
                        message:
                            `Insufficient stock for product ID ${preparedItem.product_id}. Current stock: ${currentStock}.`
                    });

                }


                await connection.query(
                    `
                    UPDATE products

                    SET
                        stock_quantity =
                            stock_quantity - ?,

                        stock_status =
                            CASE
                                WHEN stock_quantity - ? <= 0
                                    THEN 'Out of Stock'

                                WHEN stock_quantity - ? <=
                                    low_stock_level
                                    THEN 'Low Stock'

                                ELSE 'In Stock'
                            END

                    WHERE id = ?
                    `,
                    [
                        preparedItem.quantity,
                        preparedItem.quantity,
                        preparedItem.quantity,
                        preparedItem.product_id
                    ]
                );

                // ------------------------------------------
                // Inventory Ledger - Purchase Return Out
                // ------------------------------------------

                const newStock =
                    currentStock -
                    preparedItem.quantity;

                await connection.query(
                    `
                    INSERT INTO inventory_transactions
                    (
                        product_id,
                        transaction_type,
                        quantity,
                        previous_stock,
                        new_stock,
                        cost_price,
                        supplier_id,
                        reference,
                        remarks,
                        created_by
                    )
                    VALUES (?, 'Stock Out', ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        preparedItem.product_id,
                        preparedItem.quantity,
                        currentStock,
                        newStock,
                        preparedItem.unit_cost || 0,
                        supplierId,
                        returnNumber,
                        `Purchase Return - ${returnNumber}`,
                        adminId
                    ]
                );

            }

        }


        // ----------------------------------------------
        // Write Activity Log
        // ----------------------------------------------

        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "PURCHASE_RETURN_CREATED",

                oldValue:
                    null,

                newValue:
                    JSON.stringify({
                        return_number:
                            returnNumber,

                        purchase_order_id:
                            purchaseOrderId,

                        supplier_id:
                            supplierId,

                        return_date:
                            returnDate,

                        total_amount:
                            totalAmount,

                        status:
                            requestedStatus
                    }),

                notes:
                    remarks
            }
        );


        await connection.commit();


        return res.status(201).json({
            success: true,
            message:
                requestedStatus === "Completed"
                    ? "Purchase return created and stock adjusted successfully."
                    : "Purchase return created successfully.",

            purchaseReturn: {
                id:
                    purchaseReturnId,

                return_number:
                    returnNumber,

                purchase_order_id:
                    purchaseOrderId,

                supplier_id:
                    supplierId,

                return_date:
                    returnDate,

                total_amount:
                    totalAmount,

                reason,

                remarks,

                status:
                    requestedStatus,

                item_count:
                    preparedItems.length,

                total_quantity:
                    preparedItems.reduce(
                        (
                            total,
                            item
                        ) =>
                            total +
                            item.quantity,
                        0
                    )
            },

            items:
                preparedItems
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Create purchase return error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to create purchase return.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};
// ======================================================
// Update Draft Purchase Return
// PUT /api/admin/purchase-returns/:id
// ======================================================

exports.updatePurchaseReturn = async (
    req,
    res
) => {

    const purchaseReturnId =
        positiveInteger(
            req.params.id,
            null
        );

    const returnDate =
        req.body.return_date
            ? validDate(
                req.body.return_date
            )
            : null;

    const reason =
        req.body.reason !== undefined
            ? nullableText(
                req.body.reason,
                255
            )
            : undefined;

    const remarks =
        req.body.remarks !== undefined
            ? nullableText(
                req.body.remarks,
                5000
            )
            : undefined;

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    if (!purchaseReturnId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid purchase return ID is required."
        });

    }


    if (
        req.body.return_date &&
        !returnDate
    ) {

        return res.status(400).json({
            success: false,
            message:
                "return_date must use YYYY-MM-DD format."
        });

    }


    if (
        req.body.reason !== undefined &&
        !reason
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Purchase return reason cannot be empty."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // ----------------------------------------------
        // Lock Purchase Return
        // ----------------------------------------------

        const [rows] =
            await connection.query(
                `
                SELECT
                    id,
                    return_number,
                    return_date,
                    reason,
                    remarks,
                    status
                FROM purchase_returns
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [purchaseReturnId]
            );


        if (!rows.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        const purchaseReturn =
            rows[0];


        if (
            purchaseReturn.status !== "Draft"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Only Draft purchase returns can be edited."
            });

        }


        const nextReturnDate =
            returnDate ||
            purchaseReturn.return_date;

        const nextReason =
            reason !== undefined
                ? reason
                : purchaseReturn.reason;

        const nextRemarks =
            remarks !== undefined
                ? remarks
                : purchaseReturn.remarks;


        // ----------------------------------------------
        // Update Purchase Return
        // ----------------------------------------------

        await connection.query(
            `
            UPDATE purchase_returns
            SET
                return_date = ?,
                reason = ?,
                remarks = ?
            WHERE id = ?
            `,
            [
                nextReturnDate,
                nextReason,
                nextRemarks,
                purchaseReturnId
            ]
        );


        // ----------------------------------------------
        // Activity Log
        // ----------------------------------------------

        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "PURCHASE_RETURN_UPDATED",

                oldValue:
                    JSON.stringify({
                        return_date:
                            purchaseReturn.return_date,

                        reason:
                            purchaseReturn.reason,

                        remarks:
                            purchaseReturn.remarks
                    }),

                newValue:
                    JSON.stringify({
                        return_date:
                            nextReturnDate,

                        reason:
                            nextReason,

                        remarks:
                            nextRemarks
                    }),

                notes:
                    "Draft purchase return updated."
            }
        );


        await connection.commit();


        return res.json({
            success: true,
            message:
                "Purchase return updated successfully.",

            purchaseReturn: {
                id:
                    purchaseReturnId,

                return_number:
                    purchaseReturn.return_number,

                return_date:
                    nextReturnDate,

                reason:
                    nextReason,

                remarks:
                    nextRemarks,

                status:
                    purchaseReturn.status
            }
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Update purchase return error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update purchase return.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};


// ======================================================
// Complete Purchase Return
// PUT /api/admin/purchase-returns/:id/complete
// ======================================================

exports.completePurchaseReturn = async (
    req,
    res
) => {

    const purchaseReturnId =
        positiveInteger(
            req.params.id,
            null
        );

    const notes =
        nullableText(
            req.body.notes,
            1000
        );

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    if (!purchaseReturnId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid purchase return ID is required."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // ----------------------------------------------
        // Lock Purchase Return
        // ----------------------------------------------

        const [returnRows] =
            await connection.query(
                `
                SELECT
                    id,
                    return_number,
                    status,
                    total_amount
                FROM purchase_returns
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [purchaseReturnId]
            );


        if (!returnRows.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        const purchaseReturn =
            returnRows[0];


        if (
            purchaseReturn.status ===
            "Completed"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Purchase return is already completed."
            });

        }


        if (
            purchaseReturn.status ===
            "Cancelled"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "A cancelled purchase return cannot be completed."
            });

        }


        // ----------------------------------------------
        // Get Return Items
        // ----------------------------------------------

        const [items] =
            await connection.query(
                `
                SELECT
                    id,
                    product_id,
                    quantity
                FROM purchase_return_items
                WHERE purchase_return_id = ?
                ORDER BY id ASC
                FOR UPDATE
                `,
                [purchaseReturnId]
            );


        if (!items.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Purchase return has no items."
            });

        }


        // ----------------------------------------------
        // Reduce Product Stock
        // ----------------------------------------------

        for (
            const item
            of items
        ) {

            const quantity =
                numberValue(
                    item.quantity
                );


            const [productRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        product_name,
                        stock_quantity,
                        low_stock_level
                    FROM products
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [item.product_id]
                );


            if (!productRows.length) {

                await rollbackQuietly(
                    connection
                );

                return res.status(404).json({
                    success: false,
                    message:
                        `Product ID ${item.product_id} was not found.`
                });

            }


            const product =
                productRows[0];

            const currentStock =
                numberValue(
                    product.stock_quantity
                );


            if (
                currentStock <
                quantity
            ) {

                await rollbackQuietly(
                    connection
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `Insufficient stock for ${product.product_name}. Available: ${currentStock}, required: ${quantity}.`
                });

            }


            await connection.query(
                `
                UPDATE products
                SET
                    stock_quantity =
                        stock_quantity - ?,

                    stock_status =
                        CASE
                            WHEN stock_quantity - ? <= 0
                                THEN 'Out of Stock'

                            WHEN stock_quantity - ? <=
                                low_stock_level
                                THEN 'Low Stock'

                            ELSE 'In Stock'
                        END
                WHERE id = ?
                `,
                [
                    quantity,
                    quantity,
                    quantity,
                    item.product_id
                ]
            );

            // ------------------------------------------
            // Inventory Ledger - Purchase Return Out
            // ------------------------------------------

            const newStock =
                currentStock -
                quantity;

            await connection.query(
                `
                INSERT INTO inventory_transactions
                (
                    product_id,
                    transaction_type,
                    quantity,
                    previous_stock,
                    new_stock,
                    cost_price,
                    supplier_id,
                    reference,
                    remarks,
                    created_by
                )
                SELECT
                    ?,
                    'Stock Out',
                    ?,
                    ?,
                    ?,
                    COALESCE(pri.unit_cost, 0),
                    pr.supplier_id,
                    pr.return_number,
                    CONCAT(
                        'Purchase Return - ',
                        pr.return_number
                    ),
                    ?
                FROM purchase_returns pr
                JOIN purchase_return_items pri
                    ON pri.purchase_return_id = pr.id
                WHERE pr.id = ?
                  AND pri.id = ?
                LIMIT 1
                `,
                [
                    item.product_id,
                    quantity,
                    currentStock,
                    newStock,
                    adminId,
                    purchaseReturnId,
                    item.id
                ]
            );

        }


        // ----------------------------------------------
        // Mark Return Completed
        // ----------------------------------------------

        await connection.query(
            `
            UPDATE purchase_returns
            SET status = 'Completed'
            WHERE id = ?
            `,
            [purchaseReturnId]
        );


        // ----------------------------------------------
        // Activity Log
        // ----------------------------------------------

        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "PURCHASE_RETURN_COMPLETED",

                oldValue:
                    purchaseReturn.status,

                newValue:
                    "Completed",

                notes:
                    notes ||
                    "Purchase return completed and stock reduced."
            }
        );


        await connection.commit();


        return res.json({
            success: true,
            message:
                "Purchase return completed and stock adjusted successfully.",

            purchaseReturn: {
                id:
                    purchaseReturnId,

                return_number:
                    purchaseReturn.return_number,

                previous_status:
                    purchaseReturn.status,

                status:
                    "Completed",

                total_amount:
                    numberValue(
                        purchaseReturn.total_amount
                    )
            }
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Complete purchase return error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to complete purchase return.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};


// ======================================================
// Cancel Purchase Return
// PUT /api/admin/purchase-returns/:id/cancel
// ======================================================

exports.cancelPurchaseReturn = async (
    req,
    res
) => {

    const purchaseReturnId =
        positiveInteger(
            req.params.id,
            null
        );

    const notes =
        nullableText(
            req.body.notes,
            1000
        );

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    if (!purchaseReturnId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid purchase return ID is required."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // ----------------------------------------------
        // Lock Purchase Return
        // ----------------------------------------------

        const [returnRows] =
            await connection.query(
                `
                SELECT
                    id,
                    return_number,
                    status,
                    total_amount
                FROM purchase_returns
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [purchaseReturnId]
            );


        if (!returnRows.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        const purchaseReturn =
            returnRows[0];


        if (
            purchaseReturn.status ===
            "Cancelled"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Purchase return is already cancelled."
            });

        }


        // ----------------------------------------------
        // Protect Completed Returns
        // ----------------------------------------------
        //
        // A completed purchase return has already affected
        // inventory. It must not be cancelled through the
        // ordinary Draft cancellation workflow.
        //
        // Any future reversal must use a dedicated,
        // auditable reversal operation.

        if (
            purchaseReturn.status ===
            "Completed"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(409).json({
                success: false,
                message:
                    "A completed purchase return cannot be cancelled. Use the purchase return reversal workflow instead."
            });

        }

        // ----------------------------------------------
        // Draft Cancellation
        // ----------------------------------------------
        //
        // Draft cancellation does not affect inventory
        // because stock has not yet been posted.

        // ----------------------------------------------
        // Mark Return Cancelled
        // ----------------------------------------------

        await connection.query(
            `
            UPDATE purchase_returns
            SET status = 'Cancelled'
            WHERE id = ?
            `,
            [purchaseReturnId]
        );


        // ----------------------------------------------
        // Activity Log
        // ----------------------------------------------

        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "PURCHASE_RETURN_CANCELLED",

                oldValue:
                    purchaseReturn.status,

                newValue:
                    "Cancelled",

                notes:
                    notes ||
                    "Draft purchase return cancelled."
            }
        );


        await connection.commit();


        return res.json({
            success: true,

            message:
                "Purchase return cancelled successfully.",

            purchaseReturn: {
                id:
                    purchaseReturnId,

                return_number:
                    purchaseReturn.return_number,

                previous_status:
                    purchaseReturn.status,

                status:
                    "Cancelled",

                total_amount:
                    numberValue(
                        purchaseReturn.total_amount
                    )
            }
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Cancel purchase return error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to cancel purchase return.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};


// ======================================================
// Delete Draft Purchase Return
// DELETE /api/admin/purchase-returns/:id
// ======================================================

exports.deletePurchaseReturn = async (
    req,
    res
) => {

    const purchaseReturnId =
        positiveInteger(
            req.params.id,
            null
        );

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    if (!purchaseReturnId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid purchase return ID is required."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        const [rows] =
            await connection.query(
                `
                SELECT
                    id,
                    return_number,
                    status
                FROM purchase_returns
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [purchaseReturnId]
            );


        if (!rows.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        const purchaseReturn =
            rows[0];


        if (
            purchaseReturn.status !==
            "Draft"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "Only Draft purchase returns can be deleted."
            });

        }


        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "PURCHASE_RETURN_DELETED",

                oldValue:
                    JSON.stringify(
                        purchaseReturn
                    ),

                newValue:
                    null,

                notes:
                    "Draft purchase return deleted."
            }
        );


        await connection.query(
            `
            DELETE FROM purchase_returns
            WHERE id = ?
            `,
            [purchaseReturnId]
        );


        await connection.commit();


        return res.json({
            success: true,
            message:
                "Draft purchase return deleted successfully."
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Delete purchase return error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete purchase return.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};
// ======================================================
// Record Supplier Refund
// POST /api/admin/purchase-returns/:id/refunds
// ======================================================

exports.recordSupplierRefund = async (
    req,
    res
) => {

    const purchaseReturnId =
        positiveInteger(
            req.params.id,
            null
        );

    const amount =
        numberValue(
            req.body.amount
        );

    const refundMethod =
        nullableText(
            req.body.refund_method,
            50
        );

    const referenceNumber =
        nullableText(
            req.body.reference_number,
            150
        );

    const refundDate =
        validDate(
            req.body.refund_date
        );

    const notes =
        nullableText(
            req.body.notes,
            5000
        );

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    const allowedRefundMethods = [
        "Cash",
        "Bank Transfer",
        "Cheque",
        "Supplier Credit",
        "Replacement",
        "Other"
    ];


    const normalisedRefundMethod =
        normaliseEnum(
            refundMethod,
            allowedRefundMethods
        );


    // ----------------------------------------------
    // Validation
    // ----------------------------------------------

    if (!purchaseReturnId) {

        return res.status(400).json({
            success: false,
            message:
                "A valid purchase return ID is required."
        });

    }


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Refund amount must be greater than zero."
        });

    }


    if (!normalisedRefundMethod) {

        return res.status(400).json({
            success: false,
            message:
                `Invalid refund method. Use: ${allowedRefundMethods.join(", ")}.`
        });

    }


    if (!refundDate) {

        return res.status(400).json({
            success: false,
            message:
                "A valid refund date is required in YYYY-MM-DD format."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        // ----------------------------------------------
        // Lock Purchase Return
        // ----------------------------------------------

        const [returnRows] =
            await connection.query(
                `
                SELECT
                    id,
                    return_number,
                    supplier_id,
                    total_amount,
                    status
                FROM purchase_returns
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [purchaseReturnId]
            );


        if (!returnRows.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        const purchaseReturn =
            returnRows[0];


        if (
            purchaseReturn.status ===
            "Cancelled"
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "A refund cannot be recorded for a cancelled purchase return."
            });

        }


        // ----------------------------------------------
        // Calculate Existing Refund Total
        // ----------------------------------------------

        const [refundTotalRows] =
            await connection.query(
                `
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS refunded_amount
                FROM purchase_return_refunds
                WHERE purchase_return_id = ?
                `,
                [purchaseReturnId]
            );


        const totalAmount =
            numberValue(
                purchaseReturn.total_amount
            );

        const existingRefundAmount =
            numberValue(
                refundTotalRows[0]
                    ?.refunded_amount
            );

        const remainingRefundAmount =
            Number(
                (
                    totalAmount -
                    existingRefundAmount
                ).toFixed(2)
            );


        if (
            remainingRefundAmount <= 0
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    "This purchase return has already been fully refunded."
            });

        }


        if (
            amount >
            remainingRefundAmount
        ) {

            await rollbackQuietly(
                connection
            );

            return res.status(400).json({
                success: false,
                message:
                    `Refund amount cannot exceed the remaining refundable amount of ${remainingRefundAmount.toFixed(2)}.`
            });

        }


        // ----------------------------------------------
        // Insert Refund
        // ----------------------------------------------

        const [refundResult] =
            await connection.query(
                `
                INSERT INTO purchase_return_refunds
                (
                    purchase_return_id,
                    supplier_id,
                    amount,
                    refund_method,
                    reference_number,
                    refund_date,
                    notes,
                    recorded_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    purchaseReturnId,
                    purchaseReturn.supplier_id,
                    amount,
                    normalisedRefundMethod,
                    referenceNumber,
                    refundDate,
                    notes,
                    adminId
                ]
            );


        const newRefundedAmount =
            Number(
                (
                    existingRefundAmount +
                    amount
                ).toFixed(2)
            );

        const newRemainingAmount =
            Number(
                (
                    totalAmount -
                    newRefundedAmount
                ).toFixed(2)
            );

        const refundStatus =
            newRemainingAmount <= 0
                ? "Refunded"
                : "Partial";


        // ----------------------------------------------
        // Activity Log
        // ----------------------------------------------

        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "SUPPLIER_REFUND_RECORDED",

                oldValue:
                    JSON.stringify({
                        refunded_amount:
                            existingRefundAmount,

                        remaining_amount:
                            remainingRefundAmount
                    }),

                newValue:
                    JSON.stringify({
                        refund_id:
                            refundResult.insertId,

                        amount,

                        refund_method:
                            normalisedRefundMethod,

                        reference_number:
                            referenceNumber,

                        refund_date:
                            refundDate,

                        refunded_amount:
                            newRefundedAmount,

                        remaining_amount:
                            newRemainingAmount,

                        refund_status:
                            refundStatus
                    }),

                notes:
                    notes ||
                    "Supplier refund recorded."
            }
        );


        await connection.commit();


        return res.status(201).json({
            success: true,
            message:
                newRemainingAmount <= 0
                    ? "Supplier refund recorded. Purchase return is now fully refunded."
                    : "Supplier refund recorded successfully.",

            refund: {
                id:
                    refundResult.insertId,

                purchase_return_id:
                    purchaseReturnId,

                supplier_id:
                    numberValue(
                        purchaseReturn.supplier_id
                    ),

                amount,

                refund_method:
                    normalisedRefundMethod,

                reference_number:
                    referenceNumber,

                refund_date:
                    refundDate,

                notes,

                recorded_by:
                    adminId
            },

            refundSummary: {
                total_amount:
                    totalAmount,

                previously_refunded:
                    existingRefundAmount,

                current_refund:
                    amount,

                total_refunded:
                    newRefundedAmount,

                remaining_amount:
                    newRemainingAmount,

                refund_status:
                    refundStatus
            }
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Record supplier refund error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to record supplier refund.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};


// ======================================================
// Delete Supplier Refund
// DELETE /api/admin/purchase-returns/:returnId/refunds/:refundId
// ======================================================

exports.deleteSupplierRefund = async (
    req,
    res
) => {

    const purchaseReturnId =
        positiveInteger(
            req.params.returnId,
            null
        );

    const refundId =
        positiveInteger(
            req.params.refundId,
            null
        );

    const adminId =
        Number(
            req.admin?.id
        ) || null;


    if (
        !purchaseReturnId ||
        !refundId
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Valid purchase return and refund IDs are required."
        });

    }


    let connection;


    try {

        connection =
            await db.getConnection();

        await connection.beginTransaction();


        const [refundRows] =
            await connection.query(
                `
                SELECT
                    id,
                    purchase_return_id,
                    supplier_id,
                    amount,
                    refund_method,
                    reference_number,
                    refund_date,
                    notes,
                    recorded_by,
                    created_at
                FROM purchase_return_refunds
                WHERE
                    id = ?
                    AND purchase_return_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    refundId,
                    purchaseReturnId
                ]
            );


        if (!refundRows.length) {

            await rollbackQuietly(
                connection
            );

            return res.status(404).json({
                success: false,
                message:
                    "Supplier refund record not found."
            });

        }


        const refund =
            refundRows[0];


        await connection.query(
            `
            DELETE FROM purchase_return_refunds
            WHERE id = ?
            `,
            [refundId]
        );


        await writePurchaseReturnLog(
            connection,
            {
                purchaseReturnId,

                adminId,

                action:
                    "SUPPLIER_REFUND_DELETED",

                oldValue:
                    JSON.stringify(
                        refund
                    ),

                newValue:
                    null,

                notes:
                    `Supplier refund record ${refundId} deleted.`
            }
        );


        await connection.commit();


        return res.json({
            success: true,
            message:
                "Supplier refund record deleted successfully."
        });

    } catch (error) {

        await rollbackQuietly(
            connection
        );

        console.error(
            "Delete supplier refund error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete supplier refund record.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }

};


// ======================================================
// Get Purchase Return Refund Summary
// GET /api/admin/purchase-returns/:id/refund-summary
// ======================================================

exports.getPurchaseReturnRefundSummary = async (
    req,
    res
) => {

    try {

        const purchaseReturnId =
            positiveInteger(
                req.params.id,
                null
            );


        if (!purchaseReturnId) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid purchase return ID is required."
            });

        }


        const [rows] =
            await db.query(
                `
                SELECT
                    pr.id,
                    pr.return_number,
                    pr.total_amount,

                    COALESCE(
                        SUM(prr.amount),
                        0
                    ) AS refunded_amount

                FROM purchase_returns pr

                LEFT JOIN purchase_return_refunds prr
                    ON prr.purchase_return_id =
                        pr.id

                WHERE pr.id = ?

                GROUP BY
                    pr.id,
                    pr.return_number,
                    pr.total_amount
                `,
                [purchaseReturnId]
            );


        if (!rows.length) {

            return res.status(404).json({
                success: false,
                message:
                    "Purchase return not found."
            });

        }


        const row =
            rows[0];

        const totalAmount =
            numberValue(
                row.total_amount
            );

        const refundedAmount =
            numberValue(
                row.refunded_amount
            );

        const remainingAmount =
            Math.max(
                Number(
                    (
                        totalAmount -
                        refundedAmount
                    ).toFixed(2)
                ),
                0
            );


        let refundStatus =
            "Pending";


        if (
            refundedAmount > 0 &&
            remainingAmount > 0
        ) {
            refundStatus =
                "Partial";
        }


        if (
            refundedAmount > 0 &&
            remainingAmount <= 0
        ) {
            refundStatus =
                "Refunded";
        }


        return res.json({
            success: true,

            refundSummary: {
                purchase_return_id:
                    purchaseReturnId,

                return_number:
                    row.return_number,

                total_amount:
                    totalAmount,

                refunded_amount:
                    refundedAmount,

                remaining_amount:
                    remainingAmount,

                refund_status:
                    refundStatus
            }
        });

    } catch (error) {

        console.error(
            "Purchase return refund summary error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch refund summary.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};


// ======================================================
// Get Purchase Return Form Options
// GET /api/admin/purchase-returns/form-options
// ======================================================

exports.getPurchaseReturnFormOptions = async (
    req,
    res
) => {

    try {

        /*
         * SELECT * is intentionally used here because
         * existing supplier and purchase-order schemas
         * may use different display-name columns.
         */

        const [suppliers] =
            await db.query(
                `
                SELECT *
                FROM suppliers
                ORDER BY id DESC
                `
            );


        const [purchaseOrders] =
            await db.query(
                `
                SELECT *
                FROM purchase_orders
                ORDER BY id DESC
                LIMIT 500
                `
            );


        const formattedSuppliers =
            suppliers.map(
                (supplier) => {

                    const supplierName =
                        supplier.supplier_name ||
                        supplier.company_name ||
                        supplier.business_name ||
                        supplier.name ||
                        supplier.contact_person ||
                        `Supplier #${supplier.id}`;


                    return {
                        id:
                            numberValue(
                                supplier.id
                            ),

                        supplier_name:
                            supplierName,

                        company_name:
                            supplier.company_name ||
                            null,

                        contact_person:
                            supplier.contact_person ||
                            null,

                        phone:
                            supplier.phone ||
                            supplier.mobile ||
                            null,

                        email:
                            supplier.email ||
                            null,

                        status:
                            supplier.status ||
                            null
                    };

                }
            );


        const formattedPurchaseOrders =
            purchaseOrders.map(
                (purchaseOrder) => {

                    const orderNumber =
                        purchaseOrder
                            .purchase_order_number ||

                        purchaseOrder
                            .order_number ||

                        purchaseOrder
                            .po_number ||

                        purchaseOrder
                            .purchase_number ||

                        `PO-${purchaseOrder.id}`;


                    return {
                        id:
                            numberValue(
                                purchaseOrder.id
                            ),

                        purchase_order_number:
                            orderNumber,

                        supplier_id:
                            numberValue(
                                purchaseOrder.supplier_id
                            ),

                        order_date:
                            purchaseOrder.order_date ||
                            purchaseOrder.purchase_date ||
                            purchaseOrder.created_at ||
                            null,

                        total_amount:
                            numberValue(
                                purchaseOrder.total_amount ??
                                purchaseOrder.grand_total ??
                                purchaseOrder.total
                            ),

                        status:
                            purchaseOrder.status ||
                            null
                    };

                }
            );


        return res.json({
            success: true,
            message:
                "Purchase return form options fetched successfully.",

            suppliers:
                formattedSuppliers,

            purchaseOrders:
                formattedPurchaseOrders,

            returnStatuses:
                PURCHASE_RETURN_STATUSES,

            refundMethods: [
                "Cash",
                "Bank Transfer",
                "Cheque",
                "Supplier Credit",
                "Replacement",
                "Other"
            ]
        });

    } catch (error) {

        console.error(
            "Purchase return form options error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to fetch purchase return form options.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};


// ======================================================
// Export Purchase Returns CSV
// GET /api/admin/purchase-returns/export/csv
// ======================================================

exports.exportPurchaseReturnsCsv = async (
    req,
    res
) => {

    try {

        const requestedStatus =
            nullableText(
                req.query.status,
                50
            );

        const status =
            requestedStatus
                ? normaliseEnum(
                    requestedStatus,
                    PURCHASE_RETURN_STATUSES
                )
                : null;

        const supplierId =
            req.query.supplier_id
                ? positiveInteger(
                    req.query.supplier_id,
                    null
                )
                : null;

        const search =
            nullableText(
                req.query.search,
                150
            );

        const dateFrom =
            req.query.date_from
                ? validDate(
                    req.query.date_from
                )
                : null;

        const dateTo =
            req.query.date_to
                ? validDate(
                    req.query.date_to
                )
                : null;


        if (
            requestedStatus &&
            !status
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid purchase return status."
            });

        }


        const conditions = [];

        const values = [];


        if (status) {

            conditions.push(
                "pr.status = ?"
            );

            values.push(status);

        }


        if (supplierId) {

            conditions.push(
                "pr.supplier_id = ?"
            );

            values.push(supplierId);

        }


        if (search) {

            conditions.push(
                `
                (
                    pr.return_number LIKE ?
                    OR pr.reason LIKE ?
                    OR pr.remarks LIKE ?
                )
                `
            );

            const searchTerm =
                `%${search}%`;

            values.push(
                searchTerm,
                searchTerm,
                searchTerm
            );

        }


        if (dateFrom) {

            conditions.push(
                "pr.return_date >= ?"
            );

            values.push(dateFrom);

        }


        if (dateTo) {

            conditions.push(
                "pr.return_date <= ?"
            );

            values.push(dateTo);

        }


        const whereClause =
            conditions.length
                ? `WHERE ${conditions.join(" AND ")}`
                : "";


        const [rows] =
            await db.query(
                `
                SELECT
                    pr.id,
                    pr.return_number,
                    pr.purchase_order_id,
                    pr.supplier_id,
                    pr.return_date,
                    pr.reason,
                    pr.status,
                    pr.total_amount,
                    pr.remarks,
                    pr.created_by,
                    pr.created_at,

                    COUNT(
                        DISTINCT pri.id
                    ) AS item_count,

                    COALESCE(
                        SUM(pri.quantity),
                        0
                    ) AS total_quantity,

                    COALESCE(
                        (
                            SELECT
                                SUM(prr.amount)
                            FROM purchase_return_refunds prr
                            WHERE
                                prr.purchase_return_id =
                                    pr.id
                        ),
                        0
                    ) AS refunded_amount

                FROM purchase_returns pr

                LEFT JOIN purchase_return_items pri
                    ON pri.purchase_return_id =
                        pr.id

                ${whereClause}

                GROUP BY
                    pr.id,
                    pr.return_number,
                    pr.purchase_order_id,
                    pr.supplier_id,
                    pr.return_date,
                    pr.reason,
                    pr.status,
                    pr.total_amount,
                    pr.remarks,
                    pr.created_by,
                    pr.created_at

                ORDER BY
                    pr.created_at DESC,
                    pr.id DESC
                `,
                values
            );


        const headers = [
            "ID",
            "Return Number",
            "Purchase Order ID",
            "Supplier ID",
            "Return Date",
            "Reason",
            "Status",
            "Item Count",
            "Total Quantity",
            "Total Amount",
            "Refunded Amount",
            "Remaining Amount",
            "Remarks",
            "Created By",
            "Created At"
        ];


        const csvRows = [
            headers
                .map(csvCell)
                .join(",")
        ];


        for (
            const row
            of rows
        ) {

            const totalAmount =
                numberValue(
                    row.total_amount
                );

            const refundedAmount =
                numberValue(
                    row.refunded_amount
                );

            const remainingAmount =
                Math.max(
                    Number(
                        (
                            totalAmount -
                            refundedAmount
                        ).toFixed(2)
                    ),
                    0
                );


            csvRows.push(
                [
                    row.id,
                    row.return_number,
                    row.purchase_order_id,
                    row.supplier_id,
                    row.return_date,
                    row.reason,
                    row.status,
                    row.item_count,
                    row.total_quantity,
                    totalAmount.toFixed(2),
                    refundedAmount.toFixed(2),
                    remainingAmount.toFixed(2),
                    row.remarks,
                    row.created_by,
                    row.created_at
                ]
                    .map(csvCell)
                    .join(",")
            );

        }


        const currentDate =
            new Date()
                .toISOString()
                .slice(0, 10);


        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="purchase-returns-${currentDate}.csv"`
        );


        return res.send(
            `\uFEFF${csvRows.join("\n")}`
        );

    } catch (error) {

        console.error(
            "Export purchase returns CSV error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to export purchase returns.",

            error:
                process.env.NODE_ENV === "production"
                    ? undefined
                    : error.message
        });

    }

};