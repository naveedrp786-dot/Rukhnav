document.addEventListener("DOMContentLoaded", loadRows);
async function loadRows() {
    try {
        const data = await api("/api/grn");
        const rows = data["goods_receipts"] || [];
        document.querySelector("#rows").innerHTML = rows.map(row => `
            <tr>
                <td>${row.id}</td>
                <td>${row["grn_number"] || "-"}</td>
                <td>${row.supplier_name || row.po_number || "-"}</td>
                <td>${row["status"] || "-"}</td>
                <td>${money(row["total_amount"])}</td>
            </tr>`).join("");
    } catch (error) {
        showError(error);
    }
}
