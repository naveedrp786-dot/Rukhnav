"use strict";

const db = require("../config/db");

const customerLoyaltyService =
    require(
        "../services/customerLoyaltyService"
    );

const inventoryService =
    require(
        "../services/inventoryService"
    );

// =====================================
// Helper Functions
// =====================================

function createError(
    message,
    statusCode = 400
) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function toMoney(value) {
    return Number(
        toNumber(value).toFixed(2)
    );
}

function getAdminId(req) {
    return (
        req.admin?.id ||
        req.admin?.adminId ||
        req.admin?.admin_id ||
        null
    );
}

function generateNumber(prefix) {
    const date =
        new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");

    const random =
        Math.floor(
            Math.random() * 900000 +
            100000
        );

    return `${prefix}-${date}-${random}`;
}

// =====================================
// Create Sale
// =====================================

exports.createSale = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    let transactionCommitted = false;

    try {
        await connection.beginTransaction();

        const {
            customer_id,
            items,
            discount = 0,
            tax = 0,
            payment_method = "Cash",
            payment_amount = 0,
            remarks = ""
        } = req.body;

        const customerId =
            Number(customer_id);

        const discountAmount =
            toMoney(discount);

        const taxAmount =
            toMoney(tax);

        const paymentAmount =
            toMoney(payment_amount);

        const allowedPaymentMethods = [
            "Cash",
            "Card",
            "Bank Transfer",
            "Online"
        ];

        // =====================================
        // Validate Customer
        // =====================================

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0
        ) {
            throw createError(
                "A valid customer is required."
            );
        }

        const [customerRows] =
            await connection.query(
                `
                SELECT
                    id,
                    full_name,
                    status,
                    deleted_at
                FROM customers
                WHERE id = ?
                LIMIT 1
                `,
                [customerId]
            );

        if (customerRows.length === 0) {
            throw createError(
                "Customer was not found.",
                404
            );
        }

        const customer =
            customerRows[0];

        if (
            customer.status !== "Active" ||
            customer.deleted_at
        ) {
            throw createError(
                "Only an active customer can make a sale."
            );
        }

        // =====================================
        // Validate Sale Items
        // =====================================

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {
            throw createError(
                "At least one product is required."
            );
        }

        if (items.length > 200) {
            throw createError(
                "A sale cannot contain more than 200 product lines."
            );
        }

        if (
            discountAmount < 0 ||
            taxAmount < 0 ||
            paymentAmount < 0
        ) {
            throw createError(
                "Discount, tax and payment amounts cannot be negative."
            );
        }

        if (
            !allowedPaymentMethods.includes(
                payment_method
            )
        ) {
            throw createError(
                "Please select a valid payment method."
            );
        }

        const productIds =
            new Set();

        const preparedItems = [];

        let subtotal = 0;

        /*
         * Lock each product until the
         * sale transaction finishes.
         */
        for (const item of items) {
            const productId =
                Number(item.product_id);

            const quantity =
                Number(item.quantity);

            if (
                !Number.isInteger(productId) ||
                productId <= 0
            ) {
                throw createError(
                    "Every sale item must contain a valid product ID."
                );
            }

            if (
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {
                throw createError(
                    "Every product quantity must be a positive integer."
                );
            }

            if (
                productIds.has(productId)
            ) {
                throw createError(
                    `Product ID ${productId} appears more than once in the sale.`
                );
            }

            productIds.add(productId);

            const [productRows] =
                await connection.query(
                    `
                    SELECT
                        id,
                        product_name,
                        selling_price,
                        cost_price,
                        stock_quantity,
                        low_stock_level
                    FROM products
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [productId]
                );

            if (
                productRows.length === 0
            ) {
                throw createError(
                    `Product ID ${productId} was not found.`,
                    404
                );
            }

            const product =
                productRows[0];

            const previousStock =
                toNumber(
                    product.stock_quantity
                );

            if (
                previousStock < quantity
            ) {
                throw createError(
                    `${product.product_name} has only ${previousStock} item(s) in stock.`
                );
            }

            const unitPrice =
                toMoney(
                    product.selling_price
                );

            const lineTotal =
                toMoney(
                    unitPrice * quantity
                );

            subtotal =
                toMoney(
                    subtotal + lineTotal
                );

            preparedItems.push({
                productId,
                productName:
                    product.product_name,
                quantity,
                unitPrice,
                costPrice:
                    toMoney(
                        product.cost_price
                    ),
                lineTotal,
                previousStock,
                lowStockLevel:
                    toNumber(
                        product.low_stock_level
                    )
            });
        }

        // =====================================
        // Calculate Sale Total
        // =====================================

        if (
            discountAmount >
            subtotal + taxAmount
        ) {
            throw createError(
                "Discount cannot exceed the subtotal plus tax."
            );
        }

        const grandTotal =
            toMoney(
                subtotal -
                discountAmount +
                taxAmount
            );

        if (grandTotal <= 0) {
            throw createError(
                "Sale grand total must be greater than zero."
            );
        }

        if (
            paymentAmount > grandTotal
        ) {
            throw createError(
                "Payment amount cannot exceed the sale grand total."
            );
        }

        let paymentStatus =
            "Pending";

        if (
            paymentAmount >= grandTotal
        ) {
            paymentStatus =
                "Paid";
        } else if (
            paymentAmount > 0
        ) {
            paymentStatus =
                "Partial";
        }

        const balanceAmount =
            toMoney(
                grandTotal -
                paymentAmount
            );

        const saleNumber =
            generateNumber("SAL");

        // =====================================
        // Create Sale Header
        // =====================================

        const [saleResult] =
            await connection.query(
                `
                INSERT INTO sales (
                    sale_number,
                    customer_id,
                    subtotal,
                    discount,
                    tax,
                    grand_total,
                    payment_status,
                    payment_method,
                    remarks
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
                    ?
                )
                `,
                [
                    saleNumber,
                    customerId,
                    subtotal,
                    discountAmount,
                    taxAmount,
                    grandTotal,
                    paymentStatus,
                    payment_method,
                    String(
                        remarks || ""
                    ).trim() || null
                ]
            );

        const saleId =
            saleResult.insertId;

        // =====================================
        // Sale Items and Stock
        // =====================================

        for (
            const item of preparedItems
        ) {
            await connection.query(
                `
                INSERT INTO sale_items (
                    sale_id,
                    product_id,
                    quantity,
                    unit_price,
                    discount,
                    total
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    ?
                )
                `,
                [
                    saleId,
                    item.productId,
                    item.quantity,
                    item.unitPrice,
                    item.lineTotal
                ]
            );

            const newStock =
                item.previousStock -
                item.quantity;

            const stockStatus =
                inventoryService.getStockStatus(
                    newStock,
                    item.lowStockLevel
                );

            await connection.query(
                `
                UPDATE products
                SET
                    stock_quantity = ?,
                    stock_status = ?
                WHERE id = ?
                `,
                [
                    newStock,
                    stockStatus,
                    item.productId
                ]
            );

            await inventoryService.recordMovement(
                connection,
                {
                    productId:
                        item.productId,
                    transactionType:
                        "Stock Out",
                    quantity:
                        item.quantity,
                    previousStock:
                        item.previousStock,
                    newStock,
                    costPrice:
                        item.costPrice,
                    supplierId:
                        null,
                    reference:
                        saleNumber,
                    remarks:
                        `Customer sale ${saleNumber}`,
                    createdBy:
                        getAdminId(req)
                }
            );
        }

        // =====================================
        // Create Invoice
        // =====================================

        const invoiceNumber =
            generateNumber("INV");

        const [invoiceResult] =
            await connection.query(
                `
                INSERT INTO invoices (
                    invoice_number,
                    sale_id,
                    customer_id,
                    invoice_date,
                    subtotal,
                    product_discount,
                    tax,
                    grand_total,
                    paid_amount,
                    balance_amount,
                    payment_status,
                    payment_method,
                    status,
                    remarks
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    NOW(),
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'Issued',
                    ?
                )
                `,
                [
                    invoiceNumber,
                    saleId,
                    customerId,
                    subtotal,
                    discountAmount,
                    taxAmount,
                    grandTotal,
                    paymentAmount,
                    balanceAmount,
                    paymentStatus,
                    payment_method,
                    String(
                        remarks || ""
                    ).trim() || null
                ]
            );

        const invoiceId =
            invoiceResult.insertId;

        // =====================================
        // Create Invoice Items
        // =====================================

        for (
            const item of preparedItems
        ) {
            await connection.query(
                `
                INSERT INTO invoice_items (
                    invoice_id,
                    product_id,
                    product_name,
                    quantity,
                    unit_price,
                    discount,
                    total
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    ?
                )
                `,
                [
                    invoiceId,
                    item.productId,
                    item.productName,
                    item.quantity,
                    item.unitPrice,
                    item.lineTotal
                ]
            );
        }

        // =====================================
        // Record Initial Payment
        // =====================================

        if (paymentAmount > 0) {
            await connection.query(
                `
                INSERT INTO customer_payments (
                    sale_id,
                    customer_id,
                    payment_date,
                    payment_method,
                    amount,
                    reference_no,
                    remarks
                )
                VALUES (
                    ?,
                    ?,
                    CURDATE(),
                    ?,
                    ?,
                    ?,
                    ?
                )
                `,
                [
                    saleId,
                    customerId,
                    payment_method,
                    paymentAmount,
                    saleNumber,
                    "Initial customer payment"
                ]
            );
        }

        // =====================================
        // Commit Sale Transaction
        // =====================================

        await connection.commit();

        transactionCommitted = true;

        // =====================================
        // Award Loyalty Points
        // =====================================

        let loyaltyResult = null;
        let loyaltyWarning = null;

        if (
            paymentStatus === "Paid"
        ) {
            try {
                loyaltyResult =
                    await customerLoyaltyService
                        .processPaidSale(
                            saleId
                        );
            } catch (
                loyaltyError
            ) {
                console.error(
                    "Automatic loyalty processing failed:",
                    loyaltyError
                );

                loyaltyWarning =
                    "Sale was completed, but loyalty points require reprocessing.";
            }
        }

        return res.status(201).json({
            success: true,

            message:
                paymentStatus === "Paid" &&
                loyaltyResult
                    ? "Sale created and loyalty points awarded successfully."
                    : "Sale created successfully.",

            saleId,
            saleNumber,
            invoiceId,
            invoiceNumber,
            customerId,

            customerName:
                customer.full_name,

            totals: {
                subtotal,
                discount:
                    discountAmount,
                tax:
                    taxAmount,
                grandTotal,
                paidAmount:
                    paymentAmount,
                balanceAmount
            },

            paymentStatus,

            loyalty:
                loyaltyResult,

            loyaltyWarning
        });
    } catch (error) {
        if (!transactionCommitted) {
            await connection.rollback();
        }

        console.error(
            "Create sale error:",
            error
        );

        return res
            .status(
                error.statusCode || 500
            )
            .json({
                success: false,
                message:
                    error.message ||
                    "Unable to create sale."
            });
    } finally {
        connection.release();
    }
};

// =====================================
// Get All Sales
// =====================================

exports.getSales = async (
    req,
    res
) => {
    try {
        const [sales] =
            await db.query(
                `
                SELECT
                    s.id,
                    s.sale_number,
                    s.customer_id,
                    c.full_name,
                    s.sale_date,
                    s.subtotal,
                    s.discount,
                    s.tax,
                   s.grand_total,
s.payment_status,
s.sale_status,
s.payment_method,
s.remarks,
s.cancelled_at,
s.cancellation_reason,
s.cancelled_by,
s.created_by,
s.created_at
                FROM sales s
                JOIN customers c
                    ON c.id =
                        s.customer_id
                ORDER BY
                    s.id DESC
                `
            );

        return res.json({
            success: true,
            count:
                sales.length,
            sales
        });
    } catch (error) {
        console.error(
            "Get sales error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load sales.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

// =====================================
// Get Sale By ID
// =====================================

exports.getSaleById = async (
    req,
    res
) => {
    try {
        const saleId =
            Number(req.params.id);

        if (
            !Number.isInteger(saleId) ||
            saleId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid sale ID is required."
            });
        }

        const [saleRows] =
            await db.query(
                `
                SELECT
                    s.id,
                    s.sale_number,
                    s.customer_id,
                    c.full_name,
                    c.email,
                    c.phone,
                    s.sale_date,
                    s.subtotal,
                    s.discount,
                    s.tax,
                    s.grand_total,
s.payment_status,
s.sale_status,
s.payment_method,
s.remarks,
s.cancelled_at,
s.cancellation_reason,
s.cancelled_by,
s.created_by,
s.created_at
                FROM sales s
                JOIN customers c
                    ON c.id =
                        s.customer_id
                WHERE s.id = ?
                LIMIT 1
                `,
                [saleId]
            );

        if (
            saleRows.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Sale was not found."
            });
        }

        const [items] =
            await db.query(
                `
                SELECT
                    si.id,
                    si.product_id,
                    p.product_name,
                    si.quantity,
                    si.unit_price,
                    si.discount
                        AS product_discount,
                    si.total
                FROM sale_items si
                JOIN products p
                    ON p.id =
                        si.product_id
                WHERE si.sale_id = ?
                ORDER BY
                    si.id ASC
                `,
                [saleId]
            );

        const [invoiceRows] =
            await db.query(
                `
                SELECT
                    id,
                    invoice_number,
                    invoice_date,
                    grand_total,
                    paid_amount,
                    balance_amount,
                    payment_status,
                    payment_method,
                    status
                FROM invoices
                WHERE sale_id = ?
                LIMIT 1
                `,
                [saleId]
            );

        return res.json({
            success: true,

            sale: {
                ...saleRows[0],
                items,

                invoice:
                    invoiceRows.length > 0
                        ? invoiceRows[0]
                        : null
            }
        });
    } catch (error) {
        console.error(
            "Get sale error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load the sale.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};