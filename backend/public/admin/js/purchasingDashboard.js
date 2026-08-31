document.addEventListener("DOMContentLoaded", loadDashboard);

async function loadDashboard() {
    try {
        const { dashboard } = await api("/api/purchasing-dashboard");
        const s = dashboard.summary || {};
        const cards = [
            ["Total Suppliers", s.total_suppliers],
            ["Open Purchase Orders", s.open_purchase_orders],
            ["Posted GRNs", s.posted_grns],
            ["Purchase Returns", s.purchase_returns],
            ["Outstanding Payables", money(s.outstanding_payables)],
            ["This Month Purchases", money(s.month_purchases)]
        ];

        document.querySelector("#cards").innerHTML = cards.map(
            ([label, value]) => `
                <div class="card">
                    <span class="muted">${label}</span>
                    <strong>${value ?? 0}</strong>
                </div>`
        ).join("");

        document.querySelector("#suppliers").innerHTML =
            dashboard.top_suppliers.map(row => `
                <tr>
                    <td>${row.supplier_name}</td>
                    <td>${row.purchase_orders}</td>
                    <td>${money(row.purchase_total)}</td>
                </tr>`).join("");

        document.querySelector("#activity").innerHTML =
            dashboard.recent_activity.map(row => `
                <tr>
                    <td>${row.po_number || "-"}</td>
                    <td>${row.activity_type}</td>
                    <td>${row.description || "-"}</td>
                </tr>`).join("");
    } catch (error) {
        showError(error);
    }
}
