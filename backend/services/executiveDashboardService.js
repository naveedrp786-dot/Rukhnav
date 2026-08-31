const db = require("../config/db");

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

async function tableExists(name) {
    const [[row]] = await db.query(
        `SELECT COUNT(*) total FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [name]
    );
    return n(row?.total) > 0;
}

async function columnExists(table, column) {
    const [[row]] = await db.query(
        `SELECT COUNT(*) total FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = ?
           AND column_name = ?`,
        [table, column]
    );
    return n(row?.total) > 0;
}

async function scalar(sql, params = []) {
    try {
        const [[row]] = await db.query(sql, params);
        return n(Object.values(row || {})[0]);
    } catch (error) {
        console.warn("[Executive Dashboard]", error.message);
        return 0;
    }
}

async function rows(sql, params = []) {
    try {
        const [result] = await db.query(sql, params);
        return result;
    } catch (error) {
        console.warn("[Executive Dashboard]", error.message);
        return [];
    }
}

async function getKpis() {
    const k = {
        total_sales: 0, month_sales: 0,
        total_purchases: 0, month_purchases: 0,
        total_customers: 0, active_customers: 0,
        total_suppliers: 0, active_suppliers: 0,
        total_products: 0, inventory_units: 0,
        inventory_value: 0, low_stock_products: 0,
        out_of_stock_products: 0, open_customer_orders: 0,
        open_purchase_orders: 0, outstanding_receivables: 0,
        outstanding_payables: 0, customer_returns: 0,
        purchase_returns: 0
    };

    if (await tableExists("sales")) {
        const amount = await columnExists("sales","grand_total")
            ? "grand_total"
            : (await columnExists("sales","total_amount") ? "total_amount" : null);
        const date = await columnExists("sales","sale_date") ? "sale_date" : "created_at";
        if (amount) {
            k.total_sales = await scalar(
                `SELECT COALESCE(SUM(${amount}),0) FROM sales
                 WHERE COALESCE(status,'') <> 'Cancelled'`
            );
            k.month_sales = await scalar(
                `SELECT COALESCE(SUM(${amount}),0) FROM sales
                 WHERE COALESCE(status,'') <> 'Cancelled'
                   AND YEAR(${date})=YEAR(CURDATE())
                   AND MONTH(${date})=MONTH(CURDATE())`
            );
        }
    }

    if (await tableExists("purchase_orders")) {
        k.total_purchases = await scalar(
            `SELECT COALESCE(SUM(grand_total),0) FROM purchase_orders
             WHERE COALESCE(status,'') <> 'Cancelled'`
        );
        k.month_purchases = await scalar(
            `SELECT COALESCE(SUM(grand_total),0) FROM purchase_orders
             WHERE COALESCE(status,'') <> 'Cancelled'
               AND YEAR(order_date)=YEAR(CURDATE())
               AND MONTH(order_date)=MONTH(CURDATE())`
        );
        k.open_purchase_orders = await scalar(
            `SELECT COUNT(*) FROM purchase_orders
             WHERE status IN ('Draft','Approved','Ordered','Partially Received')`
        );
        if (await columnExists("purchase_orders","balance_amount")) {
            k.outstanding_payables = await scalar(
                `SELECT COALESCE(SUM(balance_amount),0) FROM purchase_orders
                 WHERE COALESCE(status,'') <> 'Cancelled'
                   AND COALESCE(balance_amount,0) > 0`
            );
        }
    }

    if (await tableExists("customers")) {
        k.total_customers = await scalar(`SELECT COUNT(*) FROM customers`);
        if (await columnExists("customers","status")) {
            k.active_customers = await scalar(
                `SELECT COUNT(*) FROM customers
                 WHERE LOWER(COALESCE(status,''))='active'`
            );
        }
    }

    if (await tableExists("suppliers")) {
        k.total_suppliers = await scalar(`SELECT COUNT(*) FROM suppliers`);
        if (await columnExists("suppliers","status")) {
            k.active_suppliers = await scalar(
                `SELECT COUNT(*) FROM suppliers
                 WHERE LOWER(COALESCE(status,''))='active'`
            );
        }
    }

    if (await tableExists("products")) {
        k.total_products = await scalar(`SELECT COUNT(*) FROM products`);
        if (await columnExists("products","stock")) {
            k.inventory_units = await scalar(
                `SELECT COALESCE(SUM(stock),0) FROM products`
            );
            k.low_stock_products = await scalar(
                `SELECT COUNT(*) FROM products WHERE stock > 0 AND stock <= 10`
            );
            k.out_of_stock_products = await scalar(
                `SELECT COUNT(*) FROM products WHERE stock <= 0`
            );
            const cost = await columnExists("products","cost_price")
                ? "cost_price"
                : (await columnExists("products","price") ? "price" : null);
            if (cost) {
                k.inventory_value = await scalar(
                    `SELECT COALESCE(SUM(stock * ${cost}),0) FROM products`
                );
            }
        }
    }

    if (await tableExists("orders")) {
        k.open_customer_orders = await scalar(
            `SELECT COUNT(*) FROM orders
             WHERE order_status IN ('pending','confirmed','processing','shipped')`
        );
        if (await columnExists("orders","balance_amount")) {
            k.outstanding_receivables = await scalar(
                `SELECT COALESCE(SUM(balance_amount),0) FROM orders
                 WHERE COALESCE(order_status,'') <> 'cancelled'
                   AND COALESCE(balance_amount,0) > 0`
            );
        }
    }

    if (await tableExists("purchase_returns")) {
        k.purchase_returns = await scalar(
            `SELECT COUNT(*) FROM purchase_returns
             WHERE COALESCE(status,'') <> 'Cancelled'`
        );
    }

    if (await tableExists("customer_returns")) {
        k.customer_returns = await scalar(
            `SELECT COUNT(*) FROM customer_returns
             WHERE COALESCE(status,'') <> 'Cancelled'`
        );
    }

    return k;
}

async function monthly(table, dateColumn, amountColumn, statusColumn = "status") {
    if (!(await tableExists(table))) return [];
    return rows(
        `SELECT DATE_FORMAT(${dateColumn},'%Y-%m') month_key,
                DATE_FORMAT(${dateColumn},'%b %Y') month_label,
                COALESCE(SUM(${amountColumn}),0) total
         FROM ${table}
         WHERE ${dateColumn} >= DATE_SUB(CURDATE(),INTERVAL 11 MONTH)
           AND COALESCE(${statusColumn},'') <> 'Cancelled'
         GROUP BY DATE_FORMAT(${dateColumn},'%Y-%m'),
                  DATE_FORMAT(${dateColumn},'%b %Y')
         ORDER BY month_key`
    );
}

async function getExecutiveDashboard() {
    const kpis = await getKpis();

    let monthlySales = [];
    if (await tableExists("sales")) {
        const amount = await columnExists("sales","grand_total")
            ? "grand_total"
            : (await columnExists("sales","total_amount") ? "total_amount" : null);
        const date = await columnExists("sales","sale_date") ? "sale_date" : "created_at";
        if (amount) monthlySales = await monthly("sales",date,amount);
    }

    const monthlyPurchases = await monthly(
        "purchase_orders","order_date","grand_total"
    );

    const orderStatuses = await tableExists("orders")
        ? await rows(
            `SELECT COALESCE(order_status,'unknown') status, COUNT(*) total
             FROM orders GROUP BY COALESCE(order_status,'unknown')
             ORDER BY total DESC`
        ) : [];

    const purchaseOrderStatuses = await tableExists("purchase_orders")
        ? await rows(
            `SELECT COALESCE(status,'Unknown') status, COUNT(*) total
             FROM purchase_orders GROUP BY COALESCE(status,'Unknown')
             ORDER BY total DESC`
        ) : [];

    const lowStockProducts =
        await tableExists("products") && await columnExists("products","stock")
        ? await rows(
            `SELECT id, product_name, stock, status
             FROM products WHERE stock <= 10
             ORDER BY stock ASC, product_name ASC LIMIT 10`
        ) : [];

    const recentOrders = await tableExists("orders")
        ? await rows(
            `SELECT id, order_number, full_name, city, grand_total,
                    payment_status, order_status, created_at
             FROM orders ORDER BY id DESC LIMIT 10`
        ) : [];

    const recentPurchaseOrders =
        await tableExists("purchase_orders") && await tableExists("suppliers")
        ? await rows(
            `SELECT po.id, po.po_number, po.order_date, po.grand_total,
                    po.payment_status, po.status, s.supplier_name
             FROM purchase_orders po
             INNER JOIN suppliers s ON s.id=po.supplier_id
             ORDER BY po.id DESC LIMIT 10`
        ) : [];

    const recentCustomers = await tableExists("customers")
        ? await rows(
            `SELECT id, full_name, email, phone, status, created_at
             FROM customers ORDER BY id DESC LIMIT 8`
        ) : [];

    const recentSuppliers = await tableExists("suppliers")
        ? await rows(
            `SELECT id, supplier_name, contact_person, phone, status, created_at
             FROM suppliers ORDER BY id DESC LIMIT 8`
        ) : [];

    return {
        kpis,
        monthly_sales: monthlySales,
        monthly_purchases: monthlyPurchases,
        order_statuses: orderStatuses,
        purchase_order_statuses: purchaseOrderStatuses,
        low_stock_products: lowStockProducts,
        recent_orders: recentOrders,
        recent_purchase_orders: recentPurchaseOrders,
        recent_customers: recentCustomers,
        recent_suppliers: recentSuppliers,
        generated_at: new Date().toISOString()
    };
}

module.exports = { getExecutiveDashboard };
