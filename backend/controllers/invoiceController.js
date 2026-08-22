// ======================================================
// RUKHNAV ERP - Invoice Controller
// ======================================================

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const bwipjs = require("bwip-js");
const fs = require("fs");
const path = require("path");

const db = require("../config/db");

// ======================================================
// Company Information
// ======================================================

const COMPANY = {

    name: "RUKHNAV Cosmetics",

    tagline: "Premium Herbal Cosmetics & Hair Care",

    address: "Islamabad, Pakistan",

    phone: "+92-308-1201745",

    email: "naveedrp786@gmail.com",

    website: "www.rukhnav.com",

    ntm: "NTN: XXXXXXXX",

    strn: "STRN: XXXXXXXX"

};

// ======================================================
// Assets
// ======================================================

const logoPath = path.join(
    __dirname,
    "../assets/logo/rukhnav-logo.png"
);

// ======================================================
// Generate Invoice Number
// ======================================================

function generateInvoiceNumber(){

    const now = new Date();

    const year = now.getFullYear();

    const month = String(now.getMonth()+1).padStart(2,"0");

    const day = String(now.getDate()).padStart(2,"0");

    const random = Math.floor(1000 + Math.random()*9000);

    return `INV-${year}${month}${day}-${random}`;

}

// ======================================================
// Helper: Calculate Invoice Items (ADDED)
// ======================================================
async function calculateInvoice(items) {
    let subtotal = 0;
    let productDiscount = 0;
    const invoiceItems = [];

    // Loop through individual array blocks from frontend data payloads
    for (const item of items) {
        // Fallback checks for naming variances
        const price = Number(item.unit_price || item.price || 0);
        const qty = Number(item.quantity || item.qty || 0);
        const discountPerUnit = Number(item.discount || 0);

        const lineSubtotal = price * qty;
        const lineDiscount = discountPerUnit * qty;
        const lineTotal = lineSubtotal - lineDiscount;

        subtotal += lineSubtotal;
        productDiscount += lineDiscount;

        invoiceItems.push({
            product_id: item.product_id || null,
            product_name: item.product_name,
            quantity: qty,
            unit_price: price,
            discount: lineDiscount,
            total: lineTotal
        });
    }

    return {
        subtotal,
        productDiscount,
        invoiceItems
    };
}

// ======================================================
// Helper: Calculate Coupon Value Deductions (ADDED)
// ======================================================
function calculateCouponDiscount(couponCode, subtotal) {
    if (!couponCode) return 0;
    // You can add database lookups here later; currently returns flat fallback mock tracking values
    return 0; 
}

// ======================================================
// Helper: Calculate Reward Points Deductions (ADDED)
// ======================================================
function calculateRewardDiscount(pointsUsed) {
    if (!pointsUsed) return 0;
    // Example rule logic: 1 point = PKR 1 reduction threshold metric
    return Number(pointsUsed) * 1; 
}

// ======================================================
// Helper: Compute Tax Accumulations (ADDED)
// ======================================================
function calculateTax(amountBeforeTax, taxPercentage) {
    if (!taxPercentage || taxPercentage <= 0) return 0;
    return (amountBeforeTax * Number(taxPercentage)) / 100;
}


// ======================================================
// Coupon Calculator
// ======================================================

function calculateCouponDiscount(code, subtotal){

    if(!code)
        return 0;

    switch(code){

        case "WELCOME10":

            return subtotal * 0.10;

        case "SAVE5":

            return subtotal * 0.05;

        default:

            return 0;

    }

}

// ======================================================
// Reward Points
// ======================================================

function calculateRewardDiscount(points){

    return Number(points) || 0;

}

// ======================================================
// Tax Calculator
// ======================================================

function calculateTax(amount, percentage){

    return amount * (percentage/100);

}

// ======================================================
// Invoice Calculator
// ======================================================

async function calculateInvoice(items){

    let subtotal = 0;

    let productDiscount = 0;

    const invoiceItems = [];

    for(const item of items){

        const [[product]] = await db.query(

            `SELECT
                id,
                product_name,
                selling_price,
                stock_quantity
            FROM products
            WHERE id=?`,

            [item.product_id]

        );

        if(!product){

            throw new Error(

                `Product ${item.product_id} not found.`

            );

        }

        if(product.stock_quantity < item.quantity){

            throw new Error(

                `${product.product_name} is out of stock.`

            );

        }

        const qty = Number(item.quantity);

        const unitPrice = Number(product.selling_price);

        const discount = 0;

        const total = (qty * unitPrice) - discount;

        subtotal += qty * unitPrice;

        productDiscount += discount;

        invoiceItems.push({

            product_id:product.id,

            product_name:product.product_name,

            quantity:qty,

            unit_price:unitPrice,

            discount,

            total

        });

    }

    return{

        subtotal,

        productDiscount,

        invoiceItems

    };

}
// ======================================================
// Get All Invoices
// ======================================================

exports.getInvoices = async (req, res) => {

    try {

        const [invoices] = await db.query(

            `
            SELECT

                i.id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,

                i.subtotal,
                i.product_discount,
                i.coupon_discount,
                i.reward_discount,
                i.shipping_charges,
                i.packaging_charges,
                i.tax,
                i.grand_total,
                i.paid_amount,
                i.balance_amount,

                i.payment_method,
                i.payment_status,
                i.status,

                s.order_id,
                o.order_number,

                c.full_name customer_name,
                c.phone,
                c.email

            FROM invoices i

            LEFT JOIN sales s
                ON s.id = i.sale_id

            LEFT JOIN orders o
                ON o.id = s.order_id

            LEFT JOIN customers c
                ON c.id=i.customer_id

            ORDER BY i.id DESC

            `

        );

        res.json({

            success:true,

            count:invoices.length,

            invoices

        });

    }

    catch(error){

        console.error(error);

        res.status(500).json({

            success:false,

            message:error.message

        });

    }

};



// ======================================================
// Get Invoice By ID
// ======================================================

exports.getInvoiceById = async(req,res)=>{

    try{

        const {id}=req.params;

        const [[invoice]] = await db.query(

            `

            SELECT

                i.*,

                s.order_id,
                o.order_number,

                c.full_name,

                c.phone,

                c.email,

                c.address

            FROM invoices i

            LEFT JOIN sales s
                ON s.id = i.sale_id

            LEFT JOIN orders o
                ON o.id = s.order_id

            LEFT JOIN customers c

                ON c.id=i.customer_id

            WHERE i.id=?

            `,

            [id]

        );

        if(!invoice){

            return res.status(404).json({

                success:false,

                message:"Invoice not found."

            });

        }

        const [items] = await db.query(

            `

            SELECT

                id,

                product_id,

                product_name,

                quantity,

                unit_price,

                discount,

                total

            FROM invoice_items

            WHERE invoice_id=?

            ORDER BY id

            `,

            [id]

        );

        let returnRequests = [];
        let returnItems = [];
        let paymentRefunds = [];
        let loyaltyAdjustments = [];

        if (invoice.order_id) {

            const [returnRows] = await db.query(
                `
                    SELECT
                        rr.id,
                        rr.return_number,
                        rr.order_id,
                        rr.status,
                        rr.reason,
                        rr.requested_amount,
                        rr.approved_amount,
                        rr.refund_amount,
                        rr.inspected_at,
                        rr.completed_at,
                        rr.refunded_at,
                        rr.created_at

                    FROM customer_return_requests rr

                    WHERE rr.order_id = ?

                    ORDER BY rr.id DESC
                `,
                [invoice.order_id]
            );

            returnRequests = returnRows;

            const [returnItemRows] = await db.query(
                `
                    SELECT
                        ri.id,
                        ri.return_request_id,
                        rr.return_number,
                        rr.status AS return_status,

                        ri.product_id,
                        p.product_name,

                        ri.requested_quantity,
                        ri.approved_quantity,
                        ri.received_quantity,
                        ri.accepted_quantity,

                        ri.unit_price,
                        ri.gross_return_amount,

                        ri.coupon_discount_share,
                        ri.loyalty_discount_share,
                        ri.reward_discount_share,

                        ri.effective_refund_amount,
                        ri.approved_amount,

                        ri.item_status,
                        ri.condition_status,
                        ri.inspection_result

                    FROM customer_return_items ri

                    JOIN customer_return_requests rr
                        ON rr.id = ri.return_request_id

                    LEFT JOIN products p
                        ON p.id = ri.product_id

                    WHERE rr.order_id = ?

                    ORDER BY
                        rr.id DESC,
                        ri.id
                `,
                [invoice.order_id]
            );

            returnItems = returnItemRows;

            const [refundRows] = await db.query(
                `
                    SELECT
                        pr.id,
                        pr.refund_number,
                        pr.order_id,
                        pr.amount,
                        pr.reason,
                        pr.transaction_reference,
                        pr.status,
                        pr.completed_at,
                        pr.created_at

                    FROM payment_refunds pr

                    WHERE pr.order_id = ?

                    ORDER BY pr.id DESC
                `,
                [invoice.order_id]
            );

            paymentRefunds = refundRows;

            const returnIds =
                returnRequests.map(
                    row => Number(row.id)
                );

            if (
                invoice.customer_id &&
                (
                    invoice.sale_id ||
                    returnIds.length
                )
            ) {
                const clauses = [];
                const params = [
                    invoice.customer_id
                ];

                if (invoice.sale_id) {
                    clauses.push(
                        "idempotency_key = ?"
                    );

                    params.push(
                        `refund-reversal:sale:${invoice.sale_id}`
                    );
                }

                for (const returnId of returnIds) {
                    clauses.push(
                        "idempotency_key = ?"
                    );

                    params.push(
                        `reward-restoration:return:${returnId}`
                    );
                }

                if (clauses.length) {
                    const [ledgerRows] =
                        await db.query(
                            `
                                SELECT
                                    id,
                                    transaction_type,
                                    points_change,
                                    lifetime_points_change,
                                    source_type,
                                    source_id,
                                    reference_number,
                                    description,
                                    idempotency_key,
                                    created_at

                                FROM customer_loyalty_transactions

                                WHERE
                                    customer_id = ?
                                    AND (
                                        ${clauses.join(" OR ")}
                                    )

                                ORDER BY id DESC
                            `,
                            params
                        );

                    loyaltyAdjustments =
                        ledgerRows;
                }
            }
        }

        res.json({
            success:true,
            invoice,
            items,

            returns:
                returnRequests,

            return_items:
                returnItems,

            payment_refunds:
                paymentRefunds,

            loyalty_adjustments:
                loyaltyAdjustments
        });


    }

    catch(error){

        console.error(error);

        res.status(500).json({

            success:false,

            message:error.message

        });

    }

};
// ======================================================
// Create Invoice
// ======================================================

exports.createInvoice = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const {

            customer_id,
            payment_method = "Cash",
            paid_amount = 0,
            payment_status = "Pending",

            coupon_code = null,
            reward_points_used = 0,

            shipping_charges = 0,
            packaging_charges = 0,

            tax_percentage = 0,

            due_date = null,

            remarks = "",

            items

        } = req.body;

        // =====================================
        // Validate Customer
        // =====================================

        if (!customer_id) {

            return res.status(400).json({

                success: false,
                message: "Customer is required."

            });

        }

        if (!items || items.length === 0) {

            return res.status(400).json({

                success: false,
                message: "Invoice items are required."

            });

        }

        const [[customer]] = await connection.query(

            `SELECT
                id,
                full_name
             FROM customers
             WHERE id=?`,

            [customer_id]

        );

        if (!customer) {

            return res.status(404).json({

                success: false,
                message: "Customer not found."

            });

        }

        // =====================================
        // Start Transaction
        // =====================================

        await connection.beginTransaction();

        // =====================================
        // Calculate Products
        // =====================================

        const calculated = await calculateInvoice(items);

        const subtotal = calculated.subtotal;

        const product_discount = calculated.productDiscount;

        const invoiceItems = calculated.invoiceItems;

        // =====================================
        // Coupon
        // =====================================

        const coupon_discount = calculateCouponDiscount(

            coupon_code,

            subtotal

        );

        // =====================================
        // Reward
        // =====================================

        const reward_discount = calculateRewardDiscount(

            reward_points_used

        );

        // =====================================
        // Before Tax
        // =====================================

        const beforeTax =

            subtotal

            - product_discount

            - coupon_discount

            - reward_discount

            + Number(shipping_charges)

            + Number(packaging_charges);

        // =====================================
        // Tax
        // =====================================

        const tax = calculateTax(

            beforeTax,

            Number(tax_percentage)

        );

        // =====================================
        // Grand Total
        // =====================================

        const grand_total =

            beforeTax + tax;

        // =====================================
        // Balance
        // =====================================

        const balance_amount =

            grand_total -

            Number(paid_amount);

        // =====================================
        // Invoice Number
        // =====================================

        const invoice_number =

            generateInvoiceNumber();
                    // =====================================
        // Insert Invoice
        // =====================================

        const [invoiceResult] = await connection.query(

            `
            INSERT INTO invoices(

                invoice_number,
                customer_id,
                invoice_date,
                due_date,

                subtotal,

                product_discount,

                coupon_code,
                coupon_discount,

                reward_points_used,
                reward_discount,

                shipping_charges,
                packaging_charges,

                tax_percentage,
                tax,

                grand_total,

                paid_amount,
                balance_amount,

                payment_method,
                payment_status,

                status,
                remarks

            )

            VALUES(

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

                invoice_number,

                customer_id,

                due_date,

                subtotal,

                product_discount,

                coupon_code,

                coupon_discount,

                reward_points_used,

                reward_discount,

                shipping_charges,

                packaging_charges,

                tax_percentage,

                tax,

                grand_total,

                paid_amount,

                balance_amount,

                payment_method,

                payment_status,

                remarks

            ]

        );

        const invoiceId = invoiceResult.insertId;

        // =====================================
        // Insert Invoice Items
        // =====================================

        for(const item of invoiceItems){

            await connection.query(

                `

                INSERT INTO invoice_items(

                    invoice_id,

                    product_id,

                    product_name,

                    quantity,

                    unit_price,

                    discount,

                    total

                )

                VALUES(

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

                    invoiceId,

                    item.product_id,

                    item.product_name,

                    item.quantity,

                    item.unit_price,

                    item.discount,

                    item.total

                ]

            );

            // ================================
            // Deduct Product Stock
            // ================================

            await connection.query(

                `

                UPDATE products

                SET stock_quantity = stock_quantity - ?

                WHERE id = ?

                `,

                [

                    item.quantity,

                    item.product_id

                ]

            );

        }

        // =====================================
        // Commit Transaction
        // =====================================

        await connection.commit();

        return res.status(201).json({

            success:true,

            message:"Invoice created successfully.",

            invoice:{

                id:invoiceId,

                invoice_number,

                subtotal,

                product_discount,

                coupon_discount,

                reward_discount,

                shipping_charges,

                packaging_charges,

                tax,

                grand_total,

                paid_amount,

                balance_amount,

                payment_status

            }

        });

    }

    catch(error){

        await connection.rollback();

        console.error(error);

        res.status(500).json({

            success:false,

            message:error.message

        });

    }

    finally{

        connection.release();

    }

};
// ======================================================
// Update Invoice
// ======================================================

exports.updateInvoice = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;

        const {

            customer_id,
            payment_method,
            payment_status,

            coupon_code = null,
            reward_points_used = 0,

            shipping_charges = 0,
            packaging_charges = 0,

            tax_percentage = 0,

            due_date = null,

            remarks = "",

            paid_amount = 0,

            items

        } = req.body;

        // =====================================
        // Validate
        // =====================================

        if (!items || items.length === 0) {

            return res.status(400).json({

                success: false,

                message: "Invoice items are required."

            });

        }

        // =====================================
        // Check Invoice
        // =====================================

        const [[invoice]] = await connection.query(

            `

            SELECT *

            FROM invoices

            WHERE id=?

            `,

            [id]

        );

        if (!invoice) {

            return res.status(404).json({

                success: false,

                message: "Invoice not found."

            });

        }

        // =====================================
        // Begin Transaction
        // =====================================

        await connection.beginTransaction();
                // =====================================
        // Restore Previous Stock
        // =====================================

        const [oldItems] = await connection.query(

            `

            SELECT

                product_id,

                quantity

            FROM invoice_items

            WHERE invoice_id=?

            `,

            [id]

        );

        for (const item of oldItems) {

            await connection.query(

                `

                UPDATE products

                SET stock_quantity = stock_quantity + ?

                WHERE id=?

                `,

                [

                    item.quantity,

                    item.product_id

                ]

            );

        }
                // =====================================
        // Delete Old Items
        // =====================================

        await connection.query(

            `

            DELETE FROM invoice_items

            WHERE invoice_id=?

            `,

            [id]

        );
                // =====================================
        // Calculate Again
        // =====================================

        const calculated = await calculateInvoice(items);

        const subtotal = calculated.subtotal;

        const product_discount = calculated.productDiscount;

        const invoiceItems = calculated.invoiceItems;

        const coupon_discount = calculateCouponDiscount(

            coupon_code,

            subtotal

        );

        const reward_discount = calculateRewardDiscount(

            reward_points_used

        );

        const beforeTax =

            subtotal

            - product_discount

            - coupon_discount

            - reward_discount

            + Number(shipping_charges)

            + Number(packaging_charges);

        const tax = calculateTax(

            beforeTax,

            tax_percentage

        );

        const grand_total =

            beforeTax + tax;

        const balance_amount =

            grand_total - Number(paid_amount);

    grand_total - Number(paid_amount);
            // =====================================
        // Update Invoice
        // =====================================

        await connection.query(

            `

            UPDATE invoices

            SET

                customer_id=?,

                due_date=?,

                subtotal=?,

                product_discount=?,

                coupon_code=?,

                coupon_discount=?,

                reward_points_used=?,

                reward_discount=?,

                shipping_charges=?,

                packaging_charges=?,

                tax_percentage=?,

                tax=?,

                grand_total=?,

                paid_amount=?,

                balance_amount=?,

                payment_method=?,

                payment_status=?,

                remarks=?

            WHERE id=?

            `,

            [

                customer_id,

                due_date,

                subtotal,

                product_discount,

                coupon_code,

                coupon_discount,

                reward_points_used,

                reward_discount,

                shipping_charges,

                packaging_charges,

                tax_percentage,

                tax,

                grand_total,

                paid_amount,

                balance_amount,

                payment_method,

                payment_status,

                remarks,

                id

            ]

        );
                // =====================================
        // Save New Invoice Items
        // =====================================

        for(const item of invoiceItems){

            await connection.query(

                `

                INSERT INTO invoice_items(

                    invoice_id,

                    product_id,

                    product_name,

                    quantity,

                    unit_price,

                    discount,

                    total

                )

                VALUES(

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

                    id,

                    item.product_id,

                    item.product_name,

                    item.quantity,

                    item.unit_price,

                    item.discount,

                    item.total

                ]

            );
                        // ===============================
            // Deduct Stock Again
            // ===============================

            await connection.query(

                `

                UPDATE products

                SET stock_quantity = stock_quantity - ?

                WHERE id=?

                `,

                [

                    item.quantity,

                    item.product_id

                ]

            );

        }
                // =====================================
        // Commit Transaction
        // =====================================

        await connection.commit();
                return res.json({

            success:true,

            message:"Invoice updated successfully.",

            invoice:{

                id,

                subtotal,

                product_discount,

                coupon_discount,

                reward_discount,

                shipping_charges,

                packaging_charges,

                tax,

                grand_total,

                paid_amount,

                balance_amount,

                payment_status

            }

        });
            }

    catch(error){

        await connection.rollback();

        console.error(error);

        res.status(500).json({

            success:false,

            message:error.message

        });

    }
        finally{

        connection.release();

    }

};
// ======================================================
// Delete Invoice
// ======================================================

exports.deleteInvoice = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { id } = req.params;

        // =====================================
        // Check Invoice
        // =====================================

        const [[invoice]] = await connection.query(

            `

            SELECT

                id,
                invoice_number

            FROM invoices

            WHERE id=?

            `,

            [id]

        );

        if (!invoice) {

            return res.status(404).json({

                success:false,

                message:"Invoice not found."

            });

        }

        await connection.beginTransaction();
                // =====================================
        // Get All Invoice Items
        // =====================================

        const [items] = await connection.query(

            `

            SELECT

                product_id,

                quantity,

                product_name

            FROM invoice_items

            WHERE invoice_id=?

            `,

            [id]

        );
                // =====================================
        // Restore Product Stock
        // =====================================

        for(const item of items){

            await connection.query(

                `

                UPDATE products

                SET stock_quantity = stock_quantity + ?

                WHERE id=?

                `,

                [

                    item.quantity,

                    item.product_id

                ]

            );

        }
                // =====================================
        // Delete Invoice Items
        // =====================================

        await connection.query(

            `

            DELETE FROM invoice_items

            WHERE invoice_id=?

            `,

            [id]

        );
                // =====================================
        // Delete Invoice
        // =====================================

        await connection.query(

            `

            DELETE FROM invoices

            WHERE id=?

            `,

            [id]

        );
      // =====================================
        // Commit
        // =====================================
        await connection.commit();

        return res.json({
            success: true,
            message: `Invoice ${invoice.invoice_number} deleted successfully.`,
            deletedInvoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error("Delete Invoice Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error: " + error.message
        });
    } finally {
        if (connection) connection.release();
    }
};
// =====================================
// Generate Professional Invoice PDF
// =====================================

exports.generateInvoice = async (req, res) => {

    try {

        const { id } = req.params;

        // =====================================
        // Get Invoice
        // =====================================

        const [[invoice]] = await db.query(

            `
            SELECT

                i.*,

                s.order_id,
                s.sale_number,
                o.order_number,

                c.full_name,
                c.email,
                c.phone,
                c.address

            FROM invoices i

            LEFT JOIN customers c
                ON i.customer_id=c.id

            LEFT JOIN sales s
                ON s.id=i.sale_id

            LEFT JOIN orders o
                ON o.id=s.order_id

            WHERE i.id=?

            `,
            [id]

        );

        if(!invoice){

            return res.status(404).json({

                success:false,

                message:"Invoice not found."

            });

        }

        // =====================================
        // Get Products
        // =====================================

        const [items] = await db.query(

            `
            SELECT

                product_name,

                quantity,

                unit_price,

                discount,

                total

            FROM invoice_items

            WHERE invoice_id=?

            `,
            [id]

        );


        // =====================================
        // Return / Refund Details
        // =====================================

        let pdfReturns = [];
        let pdfReturnItems = [];
        let pdfRefunds = [];
        let pdfLoyaltyAdjustments = [];

        if (invoice.order_id) {

            const [returnRows] = await db.query(
                `
                    SELECT
                        id,
                        return_number,
                        status,
                        reason,
                        requested_amount,
                        approved_amount,
                        refund_amount,
                        completed_at,
                        refunded_at,
                        created_at

                    FROM customer_return_requests

                    WHERE order_id = ?

                    ORDER BY id DESC
                `,
                [invoice.order_id]
            );

            pdfReturns = returnRows;

            const [returnItemRows] =
                await db.query(
                    `
                        SELECT
                            ri.id,
                            ri.return_request_id,
                            rr.return_number,
                            p.product_name,

                            ri.accepted_quantity,
                            ri.unit_price,
                            ri.gross_return_amount,

                            ri.coupon_discount_share,
                            ri.loyalty_discount_share,
                            ri.reward_discount_share,

                            ri.effective_refund_amount,
                            ri.item_status

                        FROM customer_return_items ri

                        JOIN customer_return_requests rr
                            ON rr.id =
                               ri.return_request_id

                        LEFT JOIN products p
                            ON p.id =
                               ri.product_id

                        WHERE rr.order_id = ?

                        ORDER BY
                            rr.id DESC,
                            ri.id
                    `,
                    [invoice.order_id]
                );

            pdfReturnItems =
                returnItemRows;

            const [refundRows] =
                await db.query(
                    `
                        SELECT
                            refund_number,
                            amount,
                            status,
                            completed_at,
                            created_at

                        FROM payment_refunds

                        WHERE order_id = ?

                        ORDER BY id DESC
                    `,
                    [invoice.order_id]
                );

            pdfRefunds =
                refundRows;

            const returnIds =
                pdfReturns.map(
                    row => Number(row.id)
                );

            const clauses = [];
            const params = [
                invoice.customer_id
            ];

            if (invoice.sale_id) {
                clauses.push(
                    "idempotency_key = ?"
                );

                params.push(
                    `refund-reversal:sale:${invoice.sale_id}`
                );
            }

            for (const returnId of returnIds) {
                clauses.push(
                    "idempotency_key = ?"
                );

                params.push(
                    `reward-restoration:return:${returnId}`
                );
            }

            if (
                invoice.customer_id &&
                clauses.length
            ) {
                const [ledgerRows] =
                    await db.query(
                        `
                            SELECT
                                transaction_type,
                                points_change,
                                lifetime_points_change,
                                idempotency_key,
                                created_at

                            FROM customer_loyalty_transactions

                            WHERE
                                customer_id = ?
                                AND (
                                    ${clauses.join(" OR ")}
                                )

                            ORDER BY id DESC
                        `,
                        params
                    );

                pdfLoyaltyAdjustments =
                    ledgerRows;
            }
        }

        // =====================================
        // Calculations
        // =====================================

        const subtotal          = Number(invoice.subtotal || 0);
        const productDiscount  = Number(invoice.product_discount || invoice.discount || 0);
        const couponDiscount   = Number(invoice.coupon_discount || 0);
        const loyaltyDiscount  = Number(invoice.loyalty_discount || 0);
        const rewardDiscount   = Number(invoice.reward_discount || 0);
        const shipping         = Number(invoice.shipping_charges || 0);
        const packaging        = Number(invoice.packaging_charges || 0);
        const tax              = Number(invoice.tax || 0);

        const grandTotal       = Number(invoice.grand_total || 0);
        const paid             = Number(invoice.paid_amount || 0);
        const refunded         = Number(invoice.refunded_amount || 0);
        const netPaid          = Number(
            invoice.net_paid_amount ??
            Math.max(paid - refunded, 0)
        );
        const balance          = Number(invoice.balance_amount || 0);
        const refundStatus     = invoice.refund_status || "None";

        // =====================================
        // PDF
        // =====================================

        const doc = new PDFDocument({

            size:"A4",

            layout:"portrait",

            margin:25,

            compress:true

        });

        res.setHeader("Content-Type","application/pdf");

        res.setHeader(

            "Content-Disposition",

            `inline; filename=${invoice.invoice_number}.pdf`

        );

        doc.pipe(res);

        // =====================================
        // Page Background
        // =====================================

        doc.rect(0,0,595,842).fill("#FFFFFF");

        // =====================================
        // Top Header
        // =====================================

        doc.rect(0,0,595,72).fill("#0B6E4F");

        if(fs.existsSync(logoPath)){

            doc.image(

                logoPath,

                22,

                12,

                {

                    width:48

                }

            );

        }

        doc

        .fillColor("white")

        .font("Helvetica-Bold")

        .fontSize(22)

        .text(

            COMPANY.name,

            82,

            15

        );

        doc

        .font("Helvetica")

        .fontSize(9)

        .text(

            COMPANY.tagline,

            82,

            43

        );

        doc

        .fillColor("#0B6E4F")

        .font("Helvetica-Bold")

        .fontSize(24)

        .text(

            "TAX INVOICE",

            25,

            92

        );

        doc

        .moveTo(

            25,

            126

        )

        .lineTo(

            570,

            126

        )

        .lineWidth(2)

        .strokeColor("#C9A227")

        .stroke();

        // =====================================
        // Main Grid
        // =====================================

        const leftX = 25;
        const rightX = 305;

        const topY = 145;

        const boxWidth = 265;

        const boxHeight = 110;

        // =====================================
// Customer Information
// =====================================

doc
.roundedRect(
    leftX,
    topY,
    boxWidth,
    boxHeight,
    5
)
.stroke("#0B6E4F");

doc
.fillColor("#0B6E4F")
.font("Helvetica-Bold")
.fontSize(12)
.text(
    "BILL TO",
    leftX + 12,
    topY + 10
);

doc
.fillColor("black")
.font("Helvetica")
.fontSize(9);

doc.text(
    `Customer : ${invoice.full_name || "-"}`,
    leftX + 12,
    topY + 32
);

doc.text(
    `Email : ${invoice.email || "-"}`,
    leftX + 12,
    topY + 48,
    {
        width:230
    }
);

doc.text(
    `Phone : ${invoice.phone || "-"}`,
    leftX + 12,
    topY + 64
);

doc.text(
    "Address:",
    leftX + 12,
    topY + 82
);

doc.text(
    invoice.address || "-",
    leftX + 70,
    topY + 82,
    {
        width:180,
        height:30
    }
);

// =====================================
// Invoice Information
// =====================================

doc
.roundedRect(
    rightX,
    topY,
    boxWidth,
    boxHeight,
    5
)
.stroke("#0B6E4F");

doc
.fillColor("#0B6E4F")
.font("Helvetica-Bold")
.fontSize(12)
.text(
    "INVOICE DETAILS",
    rightX + 12,
    topY + 10
);

doc
.fillColor("black")
.font("Helvetica")
.fontSize(9);

let infoY = topY + 32;

function infoRow(label,value){

    doc.font("Helvetica-Bold");
    doc.text(
        label,
        rightX + 12,
        infoY
    );

    doc.font("Helvetica");

    doc.text(
        value,
        rightX + 110,
        infoY,
        {
            width:140
        }
    );

    infoY += 16;

}

infoRow(
    "Invoice No",
    invoice.invoice_number
);

infoRow(
    "Invoice Date",
    new Date(invoice.invoice_date).toLocaleDateString()
);

infoRow(
    "Due Date",
    invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString()
        : "-"
);

infoRow(
    "Payment",
    invoice.payment_method || "-"
);

infoRow(
    "Status",
    invoice.payment_status
);

infoRow(
    "Coupon",
    invoice.coupon_code || "-"
);

// =====================================
// Watermark
// =====================================

doc.save();

doc.rotate(
    -35,
    {
        origin:[300,390]
    }
);

doc.opacity(0.04);

doc.fillColor("#0B6E4F");

doc.font("Helvetica-Bold");

doc.fontSize(48);

doc.text(
    "RUKHNAV",
    120,
    360
);

doc.restore();

// =====================================
// Products Table Starts
// =====================================

let tableY = 285;

doc
.roundedRect(
    25,
    tableY,
    545,
    22,
    4
)
.fill("#0B6E4F");

doc
.fillColor("white")
.font("Helvetica-Bold")
.fontSize(9);

doc.text("#",35,tableY+7);

doc.text("Product",60,tableY+7);

doc.text("Qty",285,tableY+7);

doc.text("Price",340,tableY+7);

doc.text("Discount",415,tableY+7);

doc.text("Total",505,tableY+7);

tableY += 26;
// =====================================
// Products List
// =====================================

doc
.font("Helvetica")
.fontSize(8);

items.forEach((item, index) => {

    // ---------------------------------
    // Auto Page Break
    // ---------------------------------

    if (tableY > 690) {

        doc.addPage();

        // Page Background
        doc.rect(0,0,595,842).fill("#FFFFFF");

        // Products Header Again
        tableY = 35;

        doc
        .roundedRect(
            25,
            tableY,
            545,
            22,
            4
        )
        .fill("#0B6E4F");

        doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(9);

        doc.text("#",35,tableY+7);
        doc.text("Product",60,tableY+7);
        doc.text("Qty",285,tableY+7);
        doc.text("Price",340,tableY+7);
        doc.text("Discount",415,tableY+7);
        doc.text("Total",505,tableY+7);

        tableY += 26;

    }

    // ---------------------------------
    // Alternate Row Background
    // ---------------------------------

    if(index % 2 === 0){

        doc
        .rect(
            25,
            tableY - 2,
            545,
            18
        )
        .fill("#F8FFF8");

    }

    doc
    .fillColor("black")
    .font("Helvetica")
    .fontSize(8);

    // Serial No
    doc.text(
        index + 1,
        35,
        tableY
    );

    // Product Name
    doc.text(
        item.product_name || "-",
        60,
        tableY,
        {
            width:190
        }
    );

    // Quantity
    doc.text(
        String(item.quantity),
        285,
        tableY
    );

    // Unit Price
    doc.text(
        `Rs ${Number(item.unit_price).toFixed(2)}`,
        340,
        tableY
    );

    // Discount
    doc.text(
        `Rs ${Number(item.discount || 0).toFixed(2)}`,
        415,
        tableY
    );

    // Total
    doc.text(
        `Rs ${Number(item.total).toFixed(2)}`,
        500,
        tableY,
        {
            width:55,
            align:"right"
        }
    );

    tableY += 18;

});

// =====================================
// Space Before Summary
// =====================================

tableY += 15;

// =====================================
// Payment Summary Box
// =====================================

doc
.roundedRect(
    300,
    tableY,
    270,
    150,
    5
)
.stroke("#0B6E4F");

doc
.fillColor("#0B6E4F")
.font("Helvetica-Bold")
.fontSize(11)
.text(
    "PAYMENT SUMMARY",
    312,
    tableY + 10
);

let summaryY = tableY + 32;
// =====================================
// Payment Summary Details
// =====================================

doc
.fillColor("black")
.font("Helvetica")
.fontSize(8);

function summaryRow(label, amount){

    doc.text(
        label,
        312,
        summaryY
    );

    doc.text(
        `Rs ${Number(amount).toFixed(2)}`,
        470,
        summaryY,
        {
            width:80,
            align:"right"
        }
    );

    summaryY += 14;

}

summaryRow("Subtotal", subtotal);

summaryRow("Product Discount", productDiscount);

summaryRow("Coupon Discount", couponDiscount);

summaryRow("Loyalty Discount", loyaltyDiscount);

summaryRow("Reward Discount", rewardDiscount);

summaryRow("Shipping Charges", shipping);

summaryRow("Packaging Charges", packaging);

summaryRow("Tax", tax);

// -------------------------------------

doc
.moveTo(
    312,
    summaryY + 2
)
.lineTo(
    550,
    summaryY + 2
)
.strokeColor("#C9A227")
.stroke();

summaryY += 10;

doc
.font("Helvetica-Bold")
.fontSize(10);

doc.text(
    "Grand Total",
    312,
    summaryY
);

doc.text(
    `Rs ${grandTotal.toFixed(2)}`,
    470,
    summaryY,
    {
        width:80,
        align:"right"
    }
);

summaryY += 18;

doc
.font("Helvetica")
.fontSize(8);

doc.text(
    "Paid Amount",
    312,
    summaryY
);

doc.text(
    `Rs ${paid.toFixed(2)}`,
    470,
    summaryY,
    {
        width:80,
        align:"right"
    }
);

summaryY += 14;

doc.text(
    "Refunded",
    312,
    summaryY
);

doc.text(
    `Rs ${refunded.toFixed(2)}`,
    470,
    summaryY,
    {
        width:80,
        align:"right"
    }
);

summaryY += 14;

doc.text(
    "Net Paid",
    312,
    summaryY
);

doc.text(
    `Rs ${netPaid.toFixed(2)}`,
    470,
    summaryY,
    {
        width:80,
        align:"right"
    }
);

summaryY += 14;

doc.text(
    "Balance",
    312,
    summaryY
);

doc.text(
    `Rs ${balance.toFixed(2)}`,
    470,
    summaryY,
    {
        width:80,
        align:"right"
    }
);

// =====================================

summaryY += 14;

doc
.font("Helvetica-Bold")
.text(
    "Refund Status",
    312,
    summaryY
);

doc
.font("Helvetica")
.text(
    String(refundStatus),
    430,
    summaryY,
    {
        width:120,
        align:"right"
    }
);

// Customer Note
// =====================================

doc
.roundedRect(
    25,
    tableY,
    255,
    150,
    5
)
.stroke("#0B6E4F");

doc
.fillColor("#0B6E4F")
.font("Helvetica-Bold")
.fontSize(11)
.text(
    "CUSTOMER NOTE",
    37,
    tableY + 10
);

doc
.fillColor("black")
.font("Helvetica")
.fontSize(8)
.text(

    invoice.notes ||

    "Thank you for choosing RUKHNAV Cosmetics. We sincerely appreciate your trust and look forward to serving you again.",

    37,

    tableY + 34,

    {

        width:225,

        align:"left"

    }

);

// =====================================
// Footer Area
// =====================================

const footerY = 560;

// =====================================
// QR Code
// =====================================

const qrData = JSON.stringify({
    invoice: invoice.invoice_number,
    customer: invoice.full_name,
    amount: grandTotal,
    date: invoice.invoice_date,
    website: COMPANY.website
});

const qrImage = await QRCode.toDataURL(qrData);

const qrBuffer = Buffer.from(
    qrImage.replace(/^data:image\/png;base64,/, ""),
    "base64"
);

doc.image(qrBuffer, 25, footerY, {
    width: 60
});

doc
.font("Helvetica")
.fontSize(7)
.fillColor("gray")
.text(
    "Scan to verify invoice",
    18,
    footerY + 64,
    {
        width: 75,
        align: "center"
    }
);

// =====================================
// Barcode
// =====================================

const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: invoice.invoice_number,
    scale: 2,
    height: 8,
    includetext: true,
    textxalign: "center"
});

doc.image(barcode, 105, footerY + 5, {
    width: 150
});

// =====================================
// Signature
// =====================================

doc
.moveTo(420, footerY + 35)
.lineTo(560, footerY + 35)
.strokeColor("#999999")
.stroke();

doc
.font("Helvetica")
.fontSize(8)
.fillColor("gray")
.text(
    "Authorized Signature",
    425,
    footerY + 40
);

// =====================================
// Thank You
// =====================================

doc
.font("Helvetica-Bold")
.fontSize(12)
.fillColor("#0B6E4F")
.text(
    "Thank You For Shopping With RUKHNAV ",
    20,
    footerY + 90,
    {
        width: 555,
        align: "center"
    }
);

doc
.font("Helvetica")
.fontSize(8)
.fillColor("black")
.text(
    "We sincerely appreciate your trust in RUKHNAV Cosmetics. We look forward to serving you again.",
    70,
    footerY + 108,
    {
        width: 455,
        align: "center"
    }
);

// =====================================
// Footer Line
// =====================================

doc
.moveTo(20, 748)
.lineTo(575, 748)
.strokeColor("#C9A227")
.stroke();

// =====================================
// Company Footer
// =====================================

doc
.font("Helvetica")
.fontSize(8)
.fillColor("#555555");

doc.text(
    COMPANY.name,
    20,
    758,
    {
        width: 555,
        align: "center"
    }
);

doc.text(
    COMPANY.address,
    20,
    770,
    {
        width: 555,
        align: "center"
    }
);

doc.text(
    `Phone: ${COMPANY.phone} | Email: ${COMPANY.email}`,
    20,
    782,
    {
        width: 555,
        align: "center"
    }
);

doc.text(
    COMPANY.website,
    20,
    794,
    {
        width: 555,
        align: "center"
    }
);


// =====================================
// Return / Refund Detail Page
// =====================================

if (
    pdfReturns.length ||
    pdfRefunds.length
) {

    doc.addPage();

    doc
    .rect(0,0,595,842)
    .fill("#FFFFFF");

    doc
    .fillColor("#0B6E4F")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(
        "RETURN / REFUND DETAILS",
        25,
        35
    );

    doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#333333")
    .text(
        `Invoice: ${invoice.invoice_number}`,
        25,
        65
    )
    .text(
        `Order: ${invoice.order_number || "-"}`,
        25,
        80
    )
    .text(
        `Sale: ${invoice.sale_number || "-"}`,
        25,
        95
    );

    let returnY = 125;

    const returnNumbers =
        pdfReturns
            .map(r => r.return_number)
            .filter(Boolean)
            .join(", ");

    const refundNumbers =
        pdfRefunds
            .map(r => r.refund_number)
            .filter(Boolean)
            .join(", ");

    const grossReturned =
        pdfReturnItems.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.gross_return_amount ||
                    0
                ),
            0
        );

    const couponShare =
        pdfReturnItems.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.coupon_discount_share ||
                    0
                ),
            0
        );

    const loyaltyShare =
        pdfReturnItems.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.loyalty_discount_share ||
                    0
                ),
            0
        );

    const rewardShare =
        pdfReturnItems.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.reward_discount_share ||
                    0
                ),
            0
        );

    const effectiveRefund =
        pdfRefunds.reduce(
            (sum, row) =>
                sum + Number(row.amount || 0),
            0
        );

    const restoredPoints =
        pdfLoyaltyAdjustments
            .filter(row =>
                String(
                    row.idempotency_key || ""
                ).startsWith(
                    "reward-restoration:return:"
                )
            )
            .reduce(
                (sum, row) =>
                    sum +
                    Math.max(
                        0,
                        Number(
                            row.points_change || 0
                        )
                    ),
                0
            );

    const reversedEarnedPoints =
        pdfLoyaltyAdjustments
            .filter(row =>
                String(
                    row.idempotency_key || ""
                ).startsWith(
                    "refund-reversal:sale:"
                )
            )
            .reduce(
                (sum, row) =>
                    sum +
                    Math.abs(
                        Number(
                            row.points_change || 0
                        )
                    ),
                0
            );

    const detailRow = (
        label,
        value
    ) => {

        doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#333333")
        .text(
            label,
            25,
            returnY,
            {
                width:200
            }
        );

        doc
        .font("Helvetica")
        .text(
            value,
            240,
            returnY,
            {
                width:320,
                align:"right"
            }
        );

        returnY += 17;
    };

    detailRow(
        "Return Number(s)",
        returnNumbers || "-"
    );

    detailRow(
        "Refund Number(s)",
        refundNumbers || "-"
    );

    detailRow(
        "Gross Returned",
        `Rs ${grossReturned.toFixed(2)}`
    );

    detailRow(
        "Coupon Discount Share",
        `Rs ${couponShare.toFixed(2)}`
    );

    detailRow(
        "Loyalty Discount Share",
        `Rs ${loyaltyShare.toFixed(2)}`
    );

    detailRow(
        "Reward Discount Share",
        `Rs ${rewardShare.toFixed(2)}`
    );

    detailRow(
        "Cash Refunded",
        `Rs ${effectiveRefund.toFixed(2)}`
    );

    detailRow(
        "Reward Points Restored",
        String(restoredPoints)
    );

    detailRow(
        "Earned Points Reversed",
        String(reversedEarnedPoints)
    );

    returnY += 18;

    doc
    .fillColor("#0B6E4F")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(
        "RETURNED ITEMS",
        25,
        returnY
    );

    returnY += 24;

    doc
    .fontSize(8)
    .fillColor("#FFFFFF");

    doc
    .rect(
        25,
        returnY,
        545,
        22
    )
    .fill("#0B6E4F");

    doc
    .fillColor("#FFFFFF")
    .text("Product",35,returnY+7)
    .text("Qty",270,returnY+7)
    .text("Gross",335,returnY+7)
    .text("Refund",465,returnY+7);

    returnY += 28;

    for (
        const item of pdfReturnItems
    ) {

        if (returnY > 760) {
            doc.addPage();

            doc
            .rect(0,0,595,842)
            .fill("#FFFFFF");

            returnY = 40;
        }

        doc
        .fillColor("#222222")
        .font("Helvetica")
        .fontSize(8)
        .text(
            item.product_name ||
            "Product",
            35,
            returnY,
            {
                width:220
            }
        )
        .text(
            String(
                item.accepted_quantity ||
                0
            ),
            270,
            returnY
        )
        .text(
            `Rs ${Number(
                item.gross_return_amount ||
                0
            ).toFixed(2)}`,
            335,
            returnY
        )
        .text(
            `Rs ${Number(
                item.effective_refund_amount ||
                0
            ).toFixed(2)}`,
            465,
            returnY,
            {
                width:90,
                align:"right"
            }
        );

        returnY += 19;
    }
}

// =====================================
// Finish PDF
// =====================================

doc.end();

} catch (err) {

    console.error("Generate Invoice Error:", err);

    if (!res.headersSent) {

        return res.status(500).json({

            success: false,

            message: "Failed to generate invoice.",

            error: err.message

        });

    }

}

};