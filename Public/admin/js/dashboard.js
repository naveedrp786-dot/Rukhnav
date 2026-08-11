"use strict";

const REPORTS_API = "/api/reports";

const TOKEN_KEYS = [
    "adminToken",
    "admin_token",
    "token"
];

const charts = {};

const $ = id =>
    document.getElementById(id);

function getToken() {
    for (const key of TOKEN_KEYS) {
        const value =
            localStorage.getItem(key) ||
            sessionStorage.getItem(key);

        if (value) {
            return value;
        }
    }

    return null;
}

const token = getToken();

if (!token) {
    window.location.href =
        "/admin/login.html";
}

async function request(endpoint) {
    const response =
        await fetch(
            `${REPORTS_API}${endpoint}`,
            {
                headers: {
                    Accept:
                        "application/json",
                    Authorization:
                        token.startsWith(
                            "Bearer "
                        )
                            ? token
                            : `Bearer ${token}`
                }
            }
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch (_) {
        data = {};
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        TOKEN_KEYS.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });

        window.location.href =
            "/admin/login.html";

        throw new Error(
            "Your admin session has expired."
        );
    }

    if (
        !response.ok ||
        data.success === false
    ) {
        throw new Error(
            data.message ||
            `Dashboard request failed with status ${response.status}.`
        );
    }

    return data;
}

const number = value =>
    Number.isFinite(Number(value))
        ? Number(value)
        : 0;

const money = value =>
    new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 0
        }
    ).format(number(value));

const count = value =>
    new Intl.NumberFormat("en-PK")
        .format(number(value));

const date = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    return Number.isNaN(
        parsed.getTime()
    )
        ? "—"
        : parsed.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
};

const escapeHtml = value => {
    const div =
        document.createElement("div");

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;
};

const slug = value =>
    String(value || "pending")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent =
            value;
    }
}

function showMessage(message, type = "error") {
    const element =
        $("dashboardMessage");

    element.textContent =
        message;

    element.className =
        `dashboard-message show ${type}`;
}

function clearMessage() {
    const element =
        $("dashboardMessage");

    element.textContent = "";
    element.className =
        "dashboard-message";
}

function showLoading(show) {
    $("dashboardLoading")
        .classList.toggle(
            "hidden",
            !show
        );

    $("dashboardContent")
        .classList.toggle(
            "hidden",
            show
        );
}

function renderSummary(data) {
    const dashboard =
        data.dashboard || {};

    const sales =
        dashboard.sales || {};

    const purchases =
        dashboard.purchases ||
        dashboard.purchase ||
        {};

    const inventory =
        dashboard.inventory || {};

    const customers =
        dashboard.customers || {};

    const suppliers =
        dashboard.suppliers || {};

    setText(
        "totalRevenue",
        money(
            sales.totalRevenue
        )
    );

    setText(
        "todaySales",
        money(
            sales.todaySalesValue
        )
    );

    setText(
        "todaySalesCount",
        `${count(
            sales.todaySalesCount
        )} transaction(s)`
    );

    setText(
        "totalSales",
        count(
            sales.totalSales
        )
    );

    setText(
        "totalCustomers",
        count(
            customers.totalCustomers
        )
    );

    setText(
        "activeCustomers",
        `${count(
            customers.activeCustomers
        )} active`
    );

    setText(
        "totalProducts",
        count(
            inventory.totalProducts
        )
    );

    setText(
        "totalStockQuantity",
        `${count(
            inventory.totalStockQuantity
        )} units in stock`
    );

    setText(
        "lowStockProducts",
        count(
            inventory.lowStockProducts
        )
    );

    setText(
        "outOfStockProducts",
        `${count(
            inventory.outOfStockProducts
        )} out of stock`
    );

    setText(
        "totalPurchases",
        money(
            purchases.totalPurchases ||
            purchases.totalPurchaseValue
        )
    );

    setText(
        "purchaseOrdersCount",
        `${count(
            purchases.totalPurchaseOrders
        )} purchase order(s)`
    );

    setText(
        "totalSuppliers",
        count(
            suppliers.totalSuppliers
        )
    );

    setText(
        "supplierBalance",
        `${money(
            suppliers.supplierCurrentBalance
        )} balance`
    );

    setText(
        "paidSalesValue",
        money(
            sales.paidSalesValue
        )
    );

    setText(
        "paidSalesCount",
        `${count(
            sales.paidSalesCount
        )} sale(s)`
    );

    setText(
        "partialSalesValue",
        money(
            sales.partialSalesValue
        )
    );

    setText(
        "partialSalesCount",
        `${count(
            sales.partialSalesCount
        )} sale(s)`
    );

    setText(
        "pendingSalesValue",
        money(
            sales.pendingSalesValue
        )
    );

    setText(
        "pendingSalesCount",
        `${count(
            sales.pendingSalesCount
        )} sale(s)`
    );

    setText(
        "purchaseOutstanding",
        money(
            purchases.totalOutstanding ||
            purchases.totalPurchaseOutstanding
        )
    );

    renderRecentSales(
        data.recentSales || []
    );
}

function renderRecentSales(rows) {
    const body =
        $("recentSalesBody");

    if (!rows.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center">
                    No recent sales found.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML =
        rows.map(row => `
            <tr>
                <td><strong>${escapeHtml(
                    row.sale_number ||
                    `Sale #${row.id}`
                )}</strong></td>
                <td>${escapeHtml(
                    row.customer_name ||
                    "Walk-in Customer"
                )}</td>
                <td>${date(
                    row.sale_date
                )}</td>
                <td><strong>${money(
                    row.grand_total
                )}</strong></td>
                <td>
                    <span class="status-badge status-${slug(
                        row.payment_status
                    )}">
                        ${escapeHtml(
                            row.payment_status ||
                            "Pending"
                        )}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${slug(
                        row.sale_status
                    )}">
                        ${escapeHtml(
                            row.sale_status ||
                            "Unknown"
                        )}
                    </span>
                </td>
            </tr>
        `).join("");
}

function renderLowStock(data) {
    const rows =
        data.products ||
        data.lowStockProducts ||
        data.rows ||
        data.data ||
        [];

    const body =
        $("lowStockBody");

    if (!Array.isArray(rows) || !rows.length) {
        body.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center">
                    No low-stock products found.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML =
        rows.slice(0, 8)
            .map(row => `
                <tr>
                    <td><strong>${escapeHtml(
                        row.product_name ||
                        row.productName ||
                        "Product"
                    )}</strong></td>
                    <td>${count(
                        row.stock_quantity ||
                        row.stockQuantity
                    )}</td>
                    <td>${count(
                        row.low_stock_level ||
                        row.lowStockLevel
                    )}</td>
                </tr>
            `)
            .join("");
}

function destroyChart(name) {
    if (charts[name]) {
        charts[name].destroy();
    }
}

function createChart(name, canvasId, config) {
    const canvas =
        $(canvasId);

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    destroyChart(name);

    charts[name] =
        new Chart(
            canvas,
            config
        );
}

function chartRows(data) {
    if (Array.isArray(data)) {
        return data;
    }

    // Reports API response shape:
    // { success: true, chart: { data: [...] } }
    if (
        data?.chart &&
        typeof data.chart === "object" &&
        Array.isArray(data.chart.data)
    ) {
        return data.chart.data;
    }

    for (const key of [
        "data",
        "rows",
        "trend",
        "chart",
        "monthlyRevenue",
        "dailySales",
        "categories",
        "categorySales",
        "categoryPerformance",
        "salesByCategory",
        "paymentMethods",
        "paymentMethodBreakdown",
        "paymentsByMethod",
        "methods"
    ]) {
        if (Array.isArray(data?.[key])) {
            return data[key];
        }
    }

    return [];
}

function renderMonthlyRevenue(data) {
    const rows =
        chartRows(data);

    createChart(
        "monthlyRevenue",
        "monthlyRevenueChart",
        {
            type: "line",
            data: {
                labels:
                    rows.map(
                        row =>
                            row.shortMonth ||
                            row.monthName ||
                            row.month ||
                            ""
                    ),
                datasets: [{
                    label: "Revenue",
                    data:
                        rows.map(
                            row =>
                                number(
                                    row.totalRevenue ||
                                    row.revenue
                                )
                        ),
                    borderWidth: 3,
                    tension: .35,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );
}

function renderDailySales(data) {
    const rows =
        chartRows(data);

    createChart(
        "dailySales",
        "dailySalesChart",
        {
            type: "bar",
            data: {
                labels:
                    rows.map(
                        row =>
                            row.dayLabel ||
                            row.saleDate ||
                            row.date ||
                            ""
                    ),
                datasets: [{
                    label: "Sales",
                    data:
                        rows.map(
                            row =>
                                number(
                                    row.totalRevenue ||
                                    row.salesValue ||
                                    row.totalSalesValue ||
                                    row.revenue
                                )
                        ),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );
}

function setChartEmptyState(canvasId, message) {
    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    const wrapper = canvas.parentElement;
    let emptyState = wrapper.querySelector(
        ".chart-empty-state"
    );

    if (!emptyState) {
        emptyState = document.createElement(
            "div"
        );

        emptyState.className =
            "chart-empty-state";

        wrapper.appendChild(emptyState);
    }

    emptyState.textContent = message;
    emptyState.classList.remove("hidden");
    canvas.classList.add("hidden");
}

function clearChartEmptyState(canvasId) {
    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    canvas.classList.remove("hidden");

    canvas.parentElement
        .querySelector(
            ".chart-empty-state"
        )
        ?.classList.add("hidden");
}

function renderCategorySales(data) {
    const rows =
        chartRows(data);

    if (!rows.length) {
        destroyChart("categorySales");
        setChartEmptyState(
            "categorySalesChart",
            "No category sales data found. Complete sales must contain product/category lines before this chart can be calculated."
        );
        return;
    }

    clearChartEmptyState(
        "categorySalesChart"
    );

    createChart(
        "categorySales",
        "categorySalesChart",
        {
            type: "doughnut",
            data: {
                labels:
                    rows.map(
                        row =>
                            row.categoryName ||
                            row.category ||
                            "Uncategorised"
                    ),
                datasets: [{
                    data:
                        rows.map(
                            row =>
                                number(
                                    row.totalRevenue ||
                                    row.salesValue ||
                                    row.totalSalesValue ||
                                    row.totalAmount ||
                                    row.salesAmount ||
                                    row.revenue ||
                                    row.salesCount ||
                                    row.totalSales ||
                                    row.count
                                )
                        )
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );
}

function renderPaymentMethods(data) {
    const rows =
        chartRows(data);

    if (!rows.length) {
        destroyChart("paymentMethods");
        setChartEmptyState(
            "paymentMethodChart",
            "No payment-method transactions were returned by the reports API."
        );
        return;
    }

    clearChartEmptyState(
        "paymentMethodChart"
    );

    createChart(
        "paymentMethods",
        "paymentMethodChart",
        {
            type: "pie",
            data: {
                labels:
                    rows.map(
                        row =>
                            row.paymentMethod ||
                            row.payment_method ||
                            row.method ||
                            row.methodName ||
                            row.name ||
                            "Unknown"
                    ),
                datasets: [{
                    data:
                        rows.map(
                            row =>
                                number(
                                    row.totalAmount ||
                                    row.total_amount ||
                                    row.collectedAmount ||
                                    row.totalCollected ||
                                    row.totalRevenue ||
                                    row.amount ||
                                    row.paymentCount ||
                                    row.count
                                )
                        )
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );
}

async function loadDashboard() {
    clearMessage();
    showLoading(true);

    const refreshButton =
        $("refreshDashboardBtn");

    refreshButton.disabled = true;
    refreshButton.innerHTML =
        `<i class="fa-solid fa-rotate fa-spin"></i> Refreshing`;

    try {
        const results =
            await Promise.allSettled([
                request("/dashboard"),
                request("/inventory/low-stock?limit=8"),
                request("/charts/monthly-revenue"),
                request("/charts/daily-sales"),
                request("/charts/category-sales?limit=8"),
                request("/charts/payment-methods")
            ]);

        const [
            summaryResult,
            lowStockResult,
            monthlyResult,
            dailyResult,
            categoryResult,
            paymentResult
        ] = results;

        if (
            summaryResult.status ===
            "rejected"
        ) {
            throw summaryResult.reason;
        }

        renderSummary(
            summaryResult.value
        );

        if (
            lowStockResult.status ===
            "fulfilled"
        ) {
            renderLowStock(
                lowStockResult.value
            );
        } else {
            renderLowStock({});
        }

        if (
            monthlyResult.status ===
            "fulfilled"
        ) {
            renderMonthlyRevenue(
                monthlyResult.value
            );
        }

        if (
            dailyResult.status ===
            "fulfilled"
        ) {
            renderDailySales(
                dailyResult.value
            );
        }

        if (
            categoryResult.status ===
            "fulfilled"
        ) {
            renderCategorySales(
                categoryResult.value
            );
        } else {
            setChartEmptyState(
                "categorySalesChart",
                categoryResult.reason?.message ||
                "Category report could not be loaded."
            );
        }

        if (
            paymentResult.status ===
            "fulfilled"
        ) {
            renderPaymentMethods(
                paymentResult.value
            );
        } else {
            setChartEmptyState(
                "paymentMethodChart",
                paymentResult.reason?.message ||
                "Payment-method report could not be loaded."
            );
        }

        setText(
            "dashboardLastUpdated",
            new Date().toLocaleString(
                "en-PK"
            )
        );

        showLoading(false);
    } catch (error) {
        showLoading(false);

        showMessage(
            error.message ||
            "Unable to load the dashboard."
        );
    } finally {
        refreshButton.disabled = false;
        refreshButton.innerHTML =
            `<i class="fa-solid fa-rotate"></i> Refresh`;
    }
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        $("refreshDashboardBtn")
            .addEventListener(
                "click",
                loadDashboard
            );

        loadDashboard();
    }
);
