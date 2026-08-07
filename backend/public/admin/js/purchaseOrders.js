document.addEventListener("DOMContentLoaded", loadRows);
async function loadRows() {
    try {
        const data = await api("/api/purchases");
        const rows = data["orders"] || [];
        document.querySelector("#rows").innerHTML = rows.map(row => `
            <tr>
                <td>${row.id}</td>
                <td>${row["po_number"] || "-"}</td>
                <td>${row.supplier_name || row.po_number || "-"}</td>
                <td>${row["status"] || "-"}</td>
                <td>${money(row["grand_total"])}</td>
            </tr>`).join("");
    } catch (error) {
        showError(error);
    }
}
