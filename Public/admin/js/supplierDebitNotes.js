document.addEventListener("DOMContentLoaded", loadRows);
async function loadRows() {
    try {
        const data = await api("/api/supplier-debit-notes");
        const rows = data["supplier_debit_notes"] || [];
        document.querySelector("#rows").innerHTML = rows.map(row => `
            <tr>
                <td>${row.id}</td>
                <td>${row["debit_note_number"] || "-"}</td>
                <td>${row.supplier_name || row.po_number || "-"}</td>
                <td>${row["status"] || "-"}</td>
                <td>${money(row["amount"])}</td>
            </tr>`).join("");
    } catch (error) {
        showError(error);
    }
}
