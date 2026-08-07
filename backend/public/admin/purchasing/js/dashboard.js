const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
const PURCHASING_API_BASE_URL = RUKHNAV_ORIGIN;

let monthlyPurchasesChart = null;
let monthlyPaymentsChart = null;
let poStatusChart = null;
let paymentStatusChart = null;

document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("refreshDashboardBtn")
        ?.addEventListener("click", loadPurchasingDashboard);

    loadPurchasingDashboard();
});

function getAdminToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") ||
        ""
    );
}

async function fetchPurchasingDashboard() {
    const response = await fetch(
        `${PURCHASING_API_BASE_URL}/api/purchasing-dashboard`,
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getAdminToken()}`
            }
        }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Dashboard request failed (${response.status}).`
        );
    }

    return data;
}

function showDashboardMessage(message, type) {
    const element =
        document.getElementById("dashboardMessage");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className =
        `dashboard-message show ${type}`;
}

function clearDashboardMessage() {
    const element =
        document.getElementById("dashboardMessage");

    if (element) {
        element.textContent = "";
        element.className = "dashboard-message";
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString("en-PK");
}

function statusBadge(status) {
    const value = String(status || "Unknown");

    const green = [
        "Paid",
        "Posted",
        "Received",
        "Completed",
        "Active"
    ];

    const blue = [
        "Approved",
        "Ordered"
    ];

    const orange = [
        "Partial",
        "Unpaid",
        "Draft",
        "Partially Received"
    ];

    const red = [
        "Cancelled",
        "Rejected",
        "Inactive"
    ];

    let className = "status-gray";

    if (green.includes(value)) {
        className = "status-green";
    } else if (blue.includes(value)) {
        className = "status-blue";
    } else if (orange.includes(value)) {
        className = "status-orange";
    } else if (red.includes(value)) {
        className = "status-red";
    }

    return `
        <span class="status-badge ${className}">
            ${value}
        </span>
    `;
}

function emptyRow(columns, message) {
    return `
        <tr>
            <td colspan="${columns}">
                ${message}
            </td>
        </tr>
    `;
}

async function loadPurchasingDashboard() {
    const button =
        document.getElementById("refreshDashboardBtn");

    try {
        clearDashboardMessage();

        if (button) {
            button.disabled = true;
            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Loading';
        }

        const response =
            await fetchPurchasingDashboard();

        const dashboard =
            response.dashboard || {};

        renderSummaryCards(
            dashboard.summary || {}
        );

        renderCharts(dashboard);

        renderTopSuppliers(
            dashboard.top_suppliers || []
        );

        renderTopProducts(
            dashboard.top_products || []
        );

        renderRecentPurchaseOrders(
            dashboard.recent_purchase_orders || []
        );

        renderRecentGRNs(
            dashboard.recent_grns || []
        );

        renderRecentPayments(
            dashboard.recent_payments || []
        );

        renderRecentReturns(
            dashboard.recent_returns || []
        );

        renderRecentDebitNotes(
            dashboard.recent_debit_notes || []
        );

        renderActivity(
            dashboard.recent_activity || []
        );

        showDashboardMessage(
            "Purchasing dashboard loaded successfully.",
            "success"
        );

        setTimeout(clearDashboardMessage, 1800);
    } catch (error) {
        console.error(error);

        showDashboardMessage(
            error.message ||
            "Unable to load purchasing dashboard.",
            "error"
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML =
                '<i class="fa-solid fa-rotate"></i> Refresh';
        }
    }
}

function renderSummaryCards(summary) {
    const openPurchaseOrders =
        Number(summary.open_purchase_orders || 0);

    const cards = [
        ["Total Suppliers", summary.total_suppliers, "fa-building-user"],
        ["Active Suppliers", summary.active_suppliers, "fa-user-check"],
        ["Total Purchase Orders", summary.total_purchase_orders, "fa-cart-shopping"],
        ["Open Purchase Orders", openPurchaseOrders, "fa-hourglass-half"],
        ["Posted GRNs", summary.posted_grns, "fa-truck-ramp-box"],
        ["Accepted Quantity", summary.accepted_quantity, "fa-boxes-stacked"],
        ["Rejected Quantity", summary.rejected_quantity, "fa-box-open"],
        ["Overdue POs", summary.overdue_purchase_orders, "fa-triangle-exclamation"],
        ["Total Purchase Value", formatMoney(summary.total_purchase_value), "fa-chart-column"],
        ["This Month Purchases", formatMoney(summary.month_purchase_value), "fa-calendar-days"],
        ["Total Paid", formatMoney(summary.total_paid_to_suppliers), "fa-money-check-dollar"],
        ["This Month Payments", formatMoney(summary.month_payments), "fa-wallet"],
        ["Outstanding Payables", formatMoney(summary.outstanding_payables), "fa-file-invoice-dollar"],
        ["Purchase Returns", summary.total_purchase_returns, "fa-rotate-left"],
        ["Return Value", formatMoney(summary.return_value), "fa-arrow-rotate-left"],
        ["Posted Debit Notes", summary.posted_debit_notes, "fa-receipt"]
    ];

    document
        .getElementById("summaryCards")
        .innerHTML =
        cards.map(([label, value, icon]) => `
            <article class="purchasing-summary-card">
                <div class="summary-card-top">
                    <div>
                        <div class="summary-label">
                            ${label}
                        </div>

                        <div class="summary-value">
                            ${value ?? 0}
                        </div>
                    </div>

                    <div class="summary-icon">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                </div>
            </article>
        `).join("");
}

function renderCharts(dashboard) {
    monthlyPurchasesChart?.destroy();
    monthlyPaymentsChart?.destroy();
    poStatusChart?.destroy();
    paymentStatusChart?.destroy();

    const purchaseRows =
        dashboard.monthly_purchases || [];

    monthlyPurchasesChart = new Chart(
        document.getElementById("monthlyPurchasesChart"),
        {
            type: "bar",
            data: {
                labels:
                    purchaseRows.map(
                        row => row.month_label
                    ),
                datasets: [
                    {
                        label: "Purchase Value",
                        data:
                            purchaseRows.map(
                                row =>
                                    Number(
                                        row.purchase_total || 0
                                    )
                            ),
                        backgroundColor:
                            "rgba(11,110,79,.78)",
                        borderColor:
                            "#0b6e4f",
                        borderWidth: 1,
                        borderRadius: 7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );

    const paymentRows =
        dashboard.monthly_payments || [];

    monthlyPaymentsChart = new Chart(
        document.getElementById("monthlyPaymentsChart"),
        {
            type: "line",
            data: {
                labels:
                    paymentRows.map(
                        row => row.month_label
                    ),
                datasets: [
                    {
                        label: "Payments",
                        data:
                            paymentRows.map(
                                row =>
                                    Number(
                                        row.payment_total || 0
                                    )
                            ),
                        borderColor: "#d4a84d",
                        backgroundColor:
                            "rgba(212,168,77,.18)",
                        fill: true,
                        tension: 0.32
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );

    const poStatuses =
        dashboard.purchase_order_statuses || [];

    poStatusChart = new Chart(
        document.getElementById("poStatusChart"),
        {
            type: "doughnut",
            data: {
                labels:
                    poStatuses.map(
                        row => row.status
                    ),
                datasets: [
                    {
                        data:
                            poStatuses.map(
                                row =>
                                    Number(
                                        row.total || 0
                                    )
                            )
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );

    const paymentStatuses =
        dashboard.payment_statuses || [];

    paymentStatusChart = new Chart(
        document.getElementById("paymentStatusChart"),
        {
            type: "doughnut",
            data: {
                labels:
                    paymentStatuses.map(
                        row => row.status
                    ),
                datasets: [
                    {
                        data:
                            paymentStatuses.map(
                                row =>
                                    Number(
                                        row.total || 0
                                    )
                            )
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        }
    );
}

function renderTopSuppliers(rows) {
    const body =
        document.getElementById("topSuppliersBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td>
                    <strong>${row.supplier_name || "-"}</strong>
                </td>
                <td>${row.purchase_orders || 0}</td>
                <td>${formatMoney(row.purchase_total)}</td>
                <td>${formatMoney(row.paid_total)}</td>
                <td>${formatMoney(row.outstanding_total)}</td>
            </tr>
        `).join("")
        : emptyRow(5, "No supplier data found.");
}

function renderTopProducts(rows) {
    const body =
        document.getElementById("topProductsBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td>
                    <strong>${row.product_name || "-"}</strong>
                </td>
                <td>${row.ordered_quantity || 0}</td>
                <td>${row.received_quantity || 0}</td>
                <td>${formatMoney(row.purchase_value)}</td>
            </tr>
        `).join("")
        : emptyRow(
            4,
            "No product purchase data found."
        );
}

function renderRecentPurchaseOrders(rows) {
    const body =
        document.getElementById("recentPOsBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td><strong>${row.po_number || "-"}</strong></td>
                <td>${row.supplier_name || "-"}</td>
                <td>${formatDate(row.order_date)}</td>
                <td>${formatDate(row.expected_date)}</td>
                <td>${formatMoney(row.grand_total)}</td>
                <td>${formatMoney(row.paid_amount)}</td>
                <td>${formatMoney(row.balance_amount)}</td>
                <td>${statusBadge(row.status)}</td>
                <td>${statusBadge(row.payment_status)}</td>
            </tr>
        `).join("")
        : emptyRow(
            9,
            "No purchase orders found."
        );
}

function renderRecentGRNs(rows) {
    const body =
        document.getElementById("recentGRNsBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td><strong>${row.grn_number || "-"}</strong></td>
                <td>${row.po_number || "-"}</td>
                <td>${row.supplier_name || "-"}</td>
                <td>${row.total_accepted_quantity || 0}</td>
                <td>${row.total_rejected_quantity || 0}</td>
                <td>${formatMoney(row.total_amount)}</td>
            </tr>
        `).join("")
        : emptyRow(
            6,
            "No GRNs found."
        );
}

function renderRecentPayments(rows) {
    const body =
        document.getElementById("recentPaymentsBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td><strong>${row.payment_number || "-"}</strong></td>
                <td>${row.supplier_name || "-"}</td>
                <td>${row.po_number || "-"}</td>
                <td>${formatDate(row.payment_date)}</td>
                <td>${formatMoney(row.amount)}</td>
                <td>${statusBadge(row.status)}</td>
            </tr>
        `).join("")
        : emptyRow(
            6,
            "No supplier payments found."
        );
}

function renderRecentReturns(rows) {
    const body =
        document.getElementById("recentReturnsBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td><strong>${row.return_number || "-"}</strong></td>
                <td>${row.supplier_name || row.supplier_id || "-"}</td>
                <td>${row.po_number || row.purchase_order_id || "-"}</td>
                <td>${formatDate(row.return_date)}</td>
                <td>${formatMoney(row.total_amount)}</td>
                <td>${statusBadge(row.status)}</td>
            </tr>
        `).join("")
        : emptyRow(
            6,
            "No purchase returns found."
        );
}

function renderRecentDebitNotes(rows) {
    const body =
        document.getElementById("recentDebitNotesBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td><strong>${row.debit_note_number || "-"}</strong></td>
                <td>${row.supplier_name || "-"}</td>
                <td>${row.po_number || "-"}</td>
                <td>${formatDate(row.debit_note_date)}</td>
                <td>${formatMoney(row.amount)}</td>
                <td>${statusBadge(row.status)}</td>
            </tr>
        `).join("")
        : emptyRow(
            6,
            "No supplier debit notes found."
        );
}

function renderActivity(rows) {
    const body =
        document.getElementById("activityBody");

    body.innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td><strong>${row.po_number || "-"}</strong></td>
                <td>${row.activity_type || "-"}</td>
                <td>${row.description || "-"}</td>
                <td>${formatDate(row.created_at)}</td>
            </tr>
        `).join("")
        : emptyRow(
            4,
            "No recent purchasing activity found."
        );
}
