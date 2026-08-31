const db = require("../config/db");

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

async function tableExists(tableName) {
    const [[row]] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = ?
        `,
        [tableName]
    );

    return toNumber(row?.total) > 0;
}

async function columnExists(tableName, columnName) {
    const [[row]] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        `,
        [tableName, columnName]
    );

    return toNumber(row?.total) > 0;
}

async function safeScalar(sql, params = []) {
    try {
        const [[row]] = await db.query(sql, params);
        return toNumber(Object.values(row || {})[0]);
    } catch (error) {
        console.warn("[Purchasing Dashboard] scalar query skipped:", error.message);
        return 0;
    }
}

async function safeRows(sql, params = []) {
    try {
        const [rows] = await db.query(sql, params);
        return rows;
    } catch (error) {
        console.warn("[Purchasing Dashboard] row query skipped:", error.message);
        return [];
    }
}

async function buildSummary() {
    const summary = {
        total_suppliers: 0,
        active_suppliers: 0,
        total_purchase_orders: 0,
        open_purchase_orders: 0,
        approved_purchase_orders: 0,
        ordered_purchase_orders: 0,
        partially_received_purchase_orders: 0,
        received_purchase_orders: 0,
        overdue_purchase_orders: 0,
        total_grns: 0,
        posted_grns: 0,
        accepted_quantity: 0,
        rejected_quantity: 0,
        total_purchase_value: 0,
        month_purchase_value: 0,
        total_paid_to_suppliers: 0,
        month_payments: 0,
        outstanding_payables: 0,
        total_purchase_returns: 0,
        return_value: 0,
        posted_debit_notes: 0,
        debit_note_value: 0
    };

    if (await tableExists("suppliers")) {
        summary.total_suppliers = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM suppliers
        `);

        if (await columnExists("suppliers", "status")) {
            summary.active_suppliers = await safeScalar(`
                SELECT COUNT(*) AS total
                FROM suppliers
                WHERE LOWER(COALESCE(status, '')) = 'active'
            `);
        }
    }

    if (await tableExists("purchase_orders")) {
        summary.total_purchase_orders = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_orders
        `);

        summary.open_purchase_orders = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_orders
            WHERE status IN (
                'Draft',
                'Approved',
                'Ordered',
                'Partially Received'
            )
        `);

        summary.approved_purchase_orders = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_orders
            WHERE status = 'Approved'
        `);

        summary.ordered_purchase_orders = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_orders
            WHERE status = 'Ordered'
        `);

        summary.partially_received_purchase_orders = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_orders
            WHERE status = 'Partially Received'
        `);

        summary.received_purchase_orders = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_orders
            WHERE status = 'Received'
        `);

        if (await columnExists("purchase_orders", "expected_date")) {
            summary.overdue_purchase_orders = await safeScalar(`
                SELECT COUNT(*) AS total
                FROM purchase_orders
                WHERE expected_date < CURDATE()
                  AND status IN (
                      'Approved',
                      'Ordered',
                      'Partially Received'
                  )
            `);
        }

        if (await columnExists("purchase_orders", "grand_total")) {
            summary.total_purchase_value = await safeScalar(`
                SELECT COALESCE(SUM(grand_total), 0) AS total
                FROM purchase_orders
                WHERE COALESCE(status, '') <> 'Cancelled'
            `);

            summary.month_purchase_value = await safeScalar(`
                SELECT COALESCE(SUM(grand_total), 0) AS total
                FROM purchase_orders
                WHERE COALESCE(status, '') <> 'Cancelled'
                  AND YEAR(order_date) = YEAR(CURDATE())
                  AND MONTH(order_date) = MONTH(CURDATE())
            `);
        }

        if (await columnExists("purchase_orders", "balance_amount")) {
            summary.outstanding_payables = await safeScalar(`
                SELECT COALESCE(SUM(balance_amount), 0) AS total
                FROM purchase_orders
                WHERE COALESCE(status, '') <> 'Cancelled'
                  AND COALESCE(balance_amount, 0) > 0
            `);
        }
    }

    if (await tableExists("goods_receipts")) {
        summary.total_grns = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM goods_receipts
        `);

        summary.posted_grns = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM goods_receipts
            WHERE status = 'Posted'
        `);

        if (await columnExists("goods_receipts", "total_accepted_quantity")) {
            summary.accepted_quantity = await safeScalar(`
                SELECT COALESCE(SUM(total_accepted_quantity), 0) AS total
                FROM goods_receipts
                WHERE status = 'Posted'
            `);
        }

        if (await columnExists("goods_receipts", "total_rejected_quantity")) {
            summary.rejected_quantity = await safeScalar(`
                SELECT COALESCE(SUM(total_rejected_quantity), 0) AS total
                FROM goods_receipts
                WHERE status = 'Posted'
            `);
        }
    }

    if (await tableExists("supplier_payments")) {
        summary.total_paid_to_suppliers = await safeScalar(`
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM supplier_payments
            WHERE status = 'Posted'
        `);

        summary.month_payments = await safeScalar(`
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM supplier_payments
            WHERE status = 'Posted'
              AND YEAR(payment_date) = YEAR(CURDATE())
              AND MONTH(payment_date) = MONTH(CURDATE())
        `);
    }

    if (await tableExists("purchase_returns")) {
        summary.total_purchase_returns = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM purchase_returns
            WHERE COALESCE(status, '') <> 'Cancelled'
        `);

        if (await columnExists("purchase_returns", "total_amount")) {
            summary.return_value = await safeScalar(`
                SELECT COALESCE(SUM(total_amount), 0) AS total
                FROM purchase_returns
                WHERE COALESCE(status, '') <> 'Cancelled'
            `);
        }
    }

    if (await tableExists("supplier_debit_notes")) {
        summary.posted_debit_notes = await safeScalar(`
            SELECT COUNT(*) AS total
            FROM supplier_debit_notes
            WHERE status = 'Posted'
        `);

        if (await columnExists("supplier_debit_notes", "amount")) {
            summary.debit_note_value = await safeScalar(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM supplier_debit_notes
                WHERE status = 'Posted'
            `);
        }
    }

    return summary;
}

async function getMonthlyPurchases() {
    if (!(await tableExists("purchase_orders"))) return [];

    return safeRows(`
        SELECT
            DATE_FORMAT(order_date, '%Y-%m') AS month_key,
            DATE_FORMAT(order_date, '%b %Y') AS month_label,
            COUNT(*) AS order_count,
            COALESCE(SUM(grand_total), 0) AS purchase_total
        FROM purchase_orders
        WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
          AND COALESCE(status, '') <> 'Cancelled'
        GROUP BY
            DATE_FORMAT(order_date, '%Y-%m'),
            DATE_FORMAT(order_date, '%b %Y')
        ORDER BY month_key
    `);
}

async function getMonthlyPayments() {
    if (!(await tableExists("supplier_payments"))) return [];

    return safeRows(`
        SELECT
            DATE_FORMAT(payment_date, '%Y-%m') AS month_key,
            DATE_FORMAT(payment_date, '%b %Y') AS month_label,
            COUNT(*) AS payment_count,
            COALESCE(SUM(amount), 0) AS payment_total
        FROM supplier_payments
        WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
          AND status = 'Posted'
        GROUP BY
            DATE_FORMAT(payment_date, '%Y-%m'),
            DATE_FORMAT(payment_date, '%b %Y')
        ORDER BY month_key
    `);
}

async function getPurchaseOrderStatuses() {
    if (!(await tableExists("purchase_orders"))) return [];

    return safeRows(`
        SELECT
            COALESCE(status, 'Unknown') AS status,
            COUNT(*) AS total
        FROM purchase_orders
        GROUP BY COALESCE(status, 'Unknown')
        ORDER BY total DESC
    `);
}

async function getPaymentStatuses() {
    if (!(await tableExists("purchase_orders"))) return [];

    return safeRows(`
        SELECT
            COALESCE(payment_status, 'Unknown') AS status,
            COUNT(*) AS total,
            COALESCE(SUM(balance_amount), 0) AS balance
        FROM purchase_orders
        GROUP BY COALESCE(payment_status, 'Unknown')
        ORDER BY total DESC
    `);
}

async function getTopSuppliers() {
    if (!(await tableExists("suppliers")) || !(await tableExists("purchase_orders"))) {
        return [];
    }

    return safeRows(`
        SELECT
            s.id,
            s.supplier_name,
            COUNT(po.id) AS purchase_orders,
            COALESCE(SUM(po.grand_total), 0) AS purchase_total,
            COALESCE(SUM(po.paid_amount), 0) AS paid_total,
            COALESCE(SUM(po.balance_amount), 0) AS outstanding_total
        FROM suppliers s
        LEFT JOIN purchase_orders po
            ON po.supplier_id = s.id
           AND COALESCE(po.status, '') <> 'Cancelled'
        GROUP BY s.id, s.supplier_name
        ORDER BY purchase_total DESC
        LIMIT 10
    `);
}

async function getTopProducts() {
    if (!(await tableExists("products")) || !(await tableExists("purchase_order_items"))) {
        return [];
    }

    return safeRows(`
        SELECT
            p.id,
            p.product_name,
            COALESCE(SUM(poi.quantity), 0) AS ordered_quantity,
            COALESCE(SUM(poi.received_quantity), 0) AS received_quantity,
            COALESCE(SUM(poi.total_cost), 0) AS purchase_value
        FROM products p
        LEFT JOIN purchase_order_items poi
            ON poi.product_id = p.id
        GROUP BY p.id, p.product_name
        ORDER BY ordered_quantity DESC
        LIMIT 10
    `);
}

async function getRecentPurchaseOrders() {
    if (!(await tableExists("purchase_orders")) || !(await tableExists("suppliers"))) {
        return [];
    }

    return safeRows(`
        SELECT
            po.id,
            po.po_number,
            po.order_date,
            po.expected_date,
            po.status,
            po.payment_status,
            po.grand_total,
            po.paid_amount,
            po.balance_amount,
            s.supplier_name
        FROM purchase_orders po
        INNER JOIN suppliers s
            ON s.id = po.supplier_id
        ORDER BY po.id DESC
        LIMIT 10
    `);
}

async function getRecentGRNs() {
    if (
        !(await tableExists("goods_receipts")) ||
        !(await tableExists("purchase_orders")) ||
        !(await tableExists("suppliers"))
    ) {
        return [];
    }

    return safeRows(`
        SELECT
            gr.id,
            gr.grn_number,
            gr.receipt_date,
            gr.status,
            gr.total_received_quantity,
            gr.total_accepted_quantity,
            gr.total_rejected_quantity,
            gr.total_amount,
            po.po_number,
            s.supplier_name
        FROM goods_receipts gr
        INNER JOIN purchase_orders po
            ON po.id = gr.purchase_order_id
        INNER JOIN suppliers s
            ON s.id = gr.supplier_id
        ORDER BY gr.id DESC
        LIMIT 10
    `);
}

async function getRecentPayments() {
    if (!(await tableExists("supplier_payments")) || !(await tableExists("suppliers"))) {
        return [];
    }

    const hasPurchaseOrderId = await columnExists(
        "supplier_payments",
        "purchase_order_id"
    );

    if (hasPurchaseOrderId && await tableExists("purchase_orders")) {
        return safeRows(`
            SELECT
                sp.id,
                sp.payment_number,
                sp.payment_date,
                sp.payment_method,
                sp.amount,
                sp.status,
                po.po_number,
                s.supplier_name
            FROM supplier_payments sp
            INNER JOIN suppliers s
                ON s.id = sp.supplier_id
            LEFT JOIN purchase_orders po
                ON po.id = sp.purchase_order_id
            ORDER BY sp.id DESC
            LIMIT 10
        `);
    }

    return safeRows(`
        SELECT
            sp.id,
            sp.payment_number,
            sp.payment_date,
            sp.payment_method,
            sp.amount,
            sp.status,
            NULL AS po_number,
            s.supplier_name
        FROM supplier_payments sp
        INNER JOIN suppliers s
            ON s.id = sp.supplier_id
        ORDER BY sp.id DESC
        LIMIT 10
    `);
}

async function getRecentReturns() {
    if (!(await tableExists("purchase_returns"))) return [];

    return safeRows(`
        SELECT
            pr.id,
            pr.return_number,
            pr.return_date,
            pr.status,
            pr.total_amount,
            pr.purchase_order_id,
            pr.supplier_id,
            po.po_number,
            s.supplier_name
        FROM purchase_returns pr
        LEFT JOIN purchase_orders po
            ON po.id = pr.purchase_order_id
        LEFT JOIN suppliers s
            ON s.id = pr.supplier_id
        ORDER BY pr.id DESC
        LIMIT 10
    `);
}

async function getRecentDebitNotes() {
    if (!(await tableExists("supplier_debit_notes"))) return [];

    return safeRows(`
        SELECT
            sdn.id,
            sdn.debit_note_number,
            sdn.debit_note_date,
            sdn.amount,
            sdn.status,
            sdn.purchase_order_id,
            sdn.purchase_return_id,
            po.po_number,
            s.supplier_name
        FROM supplier_debit_notes sdn
        LEFT JOIN purchase_orders po
            ON po.id = sdn.purchase_order_id
        LEFT JOIN suppliers s
            ON s.id = sdn.supplier_id
        ORDER BY sdn.id DESC
        LIMIT 10
    `);
}

async function getRecentActivity() {
    if (!(await tableExists("purchase_order_activity_logs"))) return [];

    return safeRows(`
        SELECT
            poal.id,
            poal.activity_type,
            poal.description,
            poal.created_at,
            po.po_number
        FROM purchase_order_activity_logs poal
        LEFT JOIN purchase_orders po
            ON po.id = poal.purchase_order_id
        ORDER BY poal.id DESC
        LIMIT 20
    `);
}

async function getPurchasingDashboard() {
    const [
        summary,
        monthlyPurchases,
        monthlyPayments,
        purchaseOrderStatuses,
        paymentStatuses,
        topSuppliers,
        topProducts,
        recentPurchaseOrders,
        recentGRNs,
        recentPayments,
        recentReturns,
        recentDebitNotes,
        recentActivity
    ] = await Promise.all([
        buildSummary(),
        getMonthlyPurchases(),
        getMonthlyPayments(),
        getPurchaseOrderStatuses(),
        getPaymentStatuses(),
        getTopSuppliers(),
        getTopProducts(),
        getRecentPurchaseOrders(),
        getRecentGRNs(),
        getRecentPayments(),
        getRecentReturns(),
        getRecentDebitNotes(),
        getRecentActivity()
    ]);

    return {
        summary,
        monthly_purchases: monthlyPurchases,
        monthly_payments: monthlyPayments,
        purchase_order_statuses: purchaseOrderStatuses,
        payment_statuses: paymentStatuses,
        top_suppliers: topSuppliers,
        top_products: topProducts,
        recent_purchase_orders: recentPurchaseOrders,
        recent_grns: recentGRNs,
        recent_payments: recentPayments,
        recent_returns: recentReturns,
        recent_debit_notes: recentDebitNotes,
        recent_activity: recentActivity,
        generated_at: new Date().toISOString()
    };
}

module.exports = {
    getPurchasingDashboard
};
