"use strict";

// ============================================================
// RUKHNAV ERP - Purchase Returns
// ============================================================

const PURCHASE_RETURN_API = "/api/purchase-returns";
const PURCHASE_API = "/api/purchases";

const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");

let purchaseReturns = [];
let filteredReturns = [];

// ============================================================
// Helpers
// ============================================================

function byId(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatMoney(value) {
    return `Rs ${Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("en-GB");
}

function normalizeStatus(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function getHeaders(json = false) {
    const headers = {};

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

async function api(url, options = {}) {
    const response = await fetch(url, options);

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

function showError(message) {
    console.error(message);

    const tableBody = byId("returnTableBody");

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}

// ============================================================
// Page Initialization
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    if (!token) {
        alert("Please log in to continue.");

        window.location.href =
            "/admin/login.html";

        return;
    }

    registerEvents();

    await loadPurchaseReturns();
});

// ============================================================
// Register Events
// ============================================================

function registerEvents() {
    byId("searchInput")
        ?.addEventListener(
            "input",
            filterPurchaseReturns
        );

    byId("statusFilter")
        ?.addEventListener(
            "change",
            filterPurchaseReturns
        );

    byId("fromDate")
        ?.addEventListener(
            "change",
            filterPurchaseReturns
        );

    byId("toDate")
        ?.addEventListener(
            "change",
            filterPurchaseReturns
        );

    byId("btnNewReturn")
        ?.addEventListener(
            "click",
            openNewReturn
        );

    byId("closeModal")
        ?.addEventListener(
            "click",
            closeReturnModal
        );

    byId("btnCancel")
        ?.addEventListener(
            "click",
            closeReturnModal
        );

    byId("returnModal")
        ?.addEventListener(
            "click",
            event => {
                if (
                    event.target.id ===
                    "returnModal"
                ) {
                    closeReturnModal();
                }
            }
        );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key === "Escape") {
                closeReturnModal();
                closeViewModal();
            }
        }
    );
}

// ============================================================
// Load Purchase Returns
// ============================================================

async function loadPurchaseReturns() {
    const tableBody =
        byId("returnTableBody");

    if (!tableBody) {
        console.error(
            "returnTableBody was not found."
        );

        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="empty">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading purchase returns...
            </td>
        </tr>
    `;

    try {
        const result = await api(
            PURCHASE_RETURN_API,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        purchaseReturns =
            result.purchaseReturns ||
            result.returns ||
            result.data ||
            [];

        filteredReturns =
            [...purchaseReturns];

        renderPurchaseReturns(
            filteredReturns
        );
    } catch (error) {
        showError(
            error.message ||
            "Unable to load purchase returns."
        );
    }
}

// ============================================================
// Render Purchase Returns
// ============================================================

function renderPurchaseReturns(list) {
    const tableBody =
        byId("returnTableBody");

    if (!tableBody) {
        return;
    }

    if (
        !Array.isArray(list) ||
        list.length === 0
    ) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty">
                    No purchase returns found.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML =
        list.map((item, index) => {
            const status =
                String(
                    item.status ||
                    "Draft"
                );

            const normalizedStatus =
                normalizeStatus(status);

            let statusClass =
                "status-draft";

            if (
                normalizedStatus ===
                "completed" ||
                normalizedStatus ===
                "approved"
            ) {
                statusClass =
                    "status-completed";
            }

            if (
                normalizedStatus ===
                "cancelled" ||
                normalizedStatus ===
                "canceled"
            ) {
                statusClass =
                    "status-cancelled";
            }

            const purchaseOrder =
                item.po_number ||
                item.purchase_number ||
                (
                    item.purchase_order_id
                        ? `PO ID: ${item.purchase_order_id}`
                        : "-"
                );

            const supplierProducts =
                item.supplier_name ||
                "-";

            return `
                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                item.return_number ||
                                `PR-${item.id}`
                            )}
                        </strong>
                    </td>

                    <td>
                        ${escapeHtml(
                            purchaseOrder
                        )}
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(
                                supplierProducts
                            )}
                        </strong>

                        <small
                            style="
                                display:block;
                                margin-top:4px;
                                color:#6b7280;
                            "
                        >
                            ${Number(
                                item.item_count || 0
                            )} item(s),
                            ${Number(
                                item.total_quantity || 0
                            )} unit(s)
                        </small>
                    </td>

                    <td>
                        ${formatDate(
                            item.return_date
                        )}
                    </td>

                    <td>
                        <strong>
                            ${formatMoney(
                                item.total_amount
                            )}
                        </strong>
                    </td>

                    <td>
                        <span
                            class="
                                status-badge
                                ${statusClass}
                            "
                        >
                            ${escapeHtml(status)}
                        </span>
                    </td>

                    <td>
                        <div class="action-buttons">

                            <button
                                type="button"
                                class="
                                    btn-action
                                    btn-view
                                "
                                title="View Return"
                                onclick="
                                    window.viewPurchaseReturn(
                                        ${Number(item.id)}
                                    )
                                "
                            >
                                <i class="fa-solid fa-eye"></i>
                            </button>

                            <button
                                type="button"
                                class="
                                    btn-action
                                    btn-print
                                "
                                title="Print Return"
                                onclick="
                                    window.printPurchaseReturn(
                                        ${Number(item.id)}
                                    )
                                "
                            >
                                <i class="fa-solid fa-print"></i>
                            </button>

                        </div>
                    </td>

                </tr>
            `;
        }).join("");
}

// ============================================================
// Filtering
// ============================================================

function filterPurchaseReturns() {
    const keyword =
        String(
            byId("searchInput")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const status =
        String(
            byId("statusFilter")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const fromDate =
        byId("fromDate")
            ?.value || "";

    const toDate =
        byId("toDate")
            ?.value || "";

    filteredReturns =
        purchaseReturns.filter(item => {
            const searchableText = [
                item.return_number,
                item.po_number,
                item.purchase_order_id,
                item.supplier_name,
                item.reason,
                item.remarks,
                item.status
            ]
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !keyword ||
                searchableText.includes(
                    keyword
                );

            const matchesStatus =
                !status ||
                normalizeStatus(
                    item.status
                ) === status;

            const itemDate =
                item.return_date
                    ? String(
                        item.return_date
                    ).slice(0, 10)
                    : "";

            const matchesFrom =
                !fromDate ||
                (
                    itemDate &&
                    itemDate >= fromDate
                );

            const matchesTo =
                !toDate ||
                (
                    itemDate &&
                    itemDate <= toDate
                );

            return (
                matchesSearch &&
                matchesStatus &&
                matchesFrom &&
                matchesTo
            );
        });

    renderPurchaseReturns(
        filteredReturns
    );
}

// ============================================================
// View Purchase Return
// ============================================================

async function viewPurchaseReturn(id) {
    try {
        const result = await api(
            `${PURCHASE_RETURN_API}/${id}`,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        const purchaseReturn =
            result.purchaseReturn ||
            result.return ||
            result.data?.purchaseReturn ||
            result.data ||
            {};

        const items =
            result.items ||
            result.data?.items ||
            [];

        const modal =
            byId("viewReturnModal");

        if (!modal) {
            throw new Error(
                "Purchase Return details modal is unavailable."
            );
        }

        const setText = (id, value) => {
            const element = byId(id);

            if (element) {
                element.textContent =
                    value ?? "-";
            }
        };

        setText(
            "viewReturnNumber",
            purchaseReturn.return_number ||
            `PR-${id}`
        );

        setText(
            "viewPONumber",
            purchaseReturn.po_number ||
            purchaseReturn.purchase_order_number ||
            (
                purchaseReturn.purchase_order_id
                    ? `PO ID: ${purchaseReturn.purchase_order_id}`
                    : "-"
            )
        );

        setText(
            "viewSupplier",
            purchaseReturn.supplier_name ||
            "-"
        );

        setText(
            "viewReturnDate",
            formatDate(
                purchaseReturn.return_date
            )
        );

        setText(
            "viewGrandTotal",
            formatMoney(
                purchaseReturn.total_amount
            )
        );

        setText(
            "viewReason",
            purchaseReturn.reason ||
            "-"
        );

        setText(
            "viewRemarks",
            purchaseReturn.remarks ||
            "-"
        );

        const status =
            String(
                purchaseReturn.status ||
                "Draft"
            );

        const statusElement =
            byId("viewStatus");

        if (statusElement) {
            const normalizedStatus =
                normalizeStatus(status);

            let statusClass =
                "status-draft";

            if (
                normalizedStatus === "completed"
            ) {
                statusClass =
                    "status-completed";
            }

            if (
                normalizedStatus === "cancelled" ||
                normalizedStatus === "canceled"
            ) {
                statusClass =
                    "status-cancelled";
            }

            statusElement.innerHTML = `
                <span class="status-badge ${statusClass}">
                    ${escapeHtml(status)}
                </span>
            `;
        }

        const itemsBody =
            byId("viewItemsBody");

        if (itemsBody) {

            if (!items.length) {

                itemsBody.innerHTML = `
                    <tr>
                        <td
                            colspan="5"
                            class="empty"
                        >
                            No returned products found.
                        </td>
                    </tr>
                `;

            } else {

                itemsBody.innerHTML =
                    items
                        .map(
                            (
                                item,
                                index
                            ) => `
                                <tr>

                                    <td>
                                        ${index + 1}
                                    </td>

                                    <td>
                                        <strong>
                                            ${escapeHtml(
                                                item.product_name ||
                                                "Product"
                                            )}
                                        </strong>

                                        ${
                                            item.sku
                                                ? `
                                                <small
                                                    style="
                                                        display:block;
                                                        margin-top:3px;
                                                        color:#6b7280;
                                                    "
                                                >
                                                    SKU:
                                                    ${escapeHtml(
                                                        item.sku
                                                    )}
                                                </small>
                                                `
                                                : ""
                                        }
                                    </td>

                                    <td>
                                        ${Number(
                                            item.quantity ||
                                            0
                                        )}
                                        ${
                                            item.unit
                                                ? escapeHtml(
                                                    ` ${item.unit}`
                                                )
                                                : ""
                                        }
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            item.unit_cost ||
                                            0
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            item.total_cost ||
                                            item.total_amount ||
                                            0
                                        )}
                                    </td>

                                </tr>
                            `
                        )
                        .join("");
            }
        }

        modal.style.display =
            "flex";

        modal.classList.add(
            "show"
        );

        modal.dataset.returnId =
            String(id);

        const printButton =
            byId("printFromView");

        if (printButton) {
            printButton.onclick =
                () =>
                    printPurchaseReturn(
                        id
                    );
        }

    } catch (error) {
        alert(
            error.message ||
            "Unable to load purchase return."
        );
    }
}

// ============================================================
// Print Purchase Return
// ============================================================

async function printPurchaseReturn(id) {
    try {
        const result = await api(
            `${PURCHASE_RETURN_API}/${id}`,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        const purchaseReturn =
            result.purchaseReturn ||
            result.return ||
            result.data?.purchaseReturn ||
            result.data ||
            {};

        const items =
            result.items ||
            result.data?.items ||
            [];

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=1000,height=800"
            );

        if (!printWindow) {
            alert(
                "Please allow popups for localhost:3000."
            );

            return;
        }

        const itemRows =
            items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        ${escapeHtml(
                            item.product_name ||
                            "Product"
                        )}
                    </td>
                    <td>
                        ${Number(
                            item.quantity ||
                            item.return_quantity ||
                            0
                        )}
                    </td>
                    <td>
                        ${formatMoney(
                            item.unit_cost ||
                            item.cost_price
                        )}
                    </td>
                    <td>
                        ${formatMoney(
                            item.total_amount ||
                            item.total_cost
                        )}
                    </td>
                </tr>
            `).join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">

            <head>
                <meta charset="UTF-8">

                <title>
                    Purchase Return
                    ${
                        purchaseReturn.return_number ||
                        id
                    }
                </title>

                <style>
                    body {
                        padding: 30px;
                        font-family:
                            Arial,
                            sans-serif;
                        color: #1f2937;
                    }

                    h1 {
                        color: #0b6e4f;
                    }

                    .header {
                        display: flex;
                        justify-content:
                            space-between;
                        border-bottom:
                            3px solid #0b6e4f;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }

                    table {
                        width: 100%;
                        border-collapse:
                            collapse;
                        margin-top: 20px;
                    }

                    th,
                    td {
                        padding: 10px;
                        border:
                            1px solid #d1d5db;
                        text-align: left;
                    }

                    th {
                        background: #0b6e4f;
                        color: #fff;
                    }

                    .summary {
                        margin-top: 20px;
                        text-align: right;
                        font-size: 18px;
                        font-weight: bold;
                    }
.signature-area {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 28px;
    margin-top: 80px;
}

.signature-box {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
}

.signature-line {
    width: 100%;
    height: 45px;
    border-bottom: 1px solid #111827;
    margin-bottom: 8px;
}

@media max-width: 800px {
    .signature-area {
        grid-template-columns: repeat(2, 1fr);
    }
}
                    @media print {
                        .print-actions {
                            display: none;
                        }
                    }
                </style>
            </head>

            <body>

                <div class="print-actions">
                    <button
                        onclick="window.print()"
                    >
                        Print
                    </button>

                    <button
                        onclick="window.close()"
                    >
                        Close
                    </button>
                </div>

                <div class="header">
                    <div>
                        <h1>RUKHNAV ERP</h1>
                        <p>Purchase Return Note</p>
                    </div>

                    <div>
                        <strong>
                            ${escapeHtml(
                                purchaseReturn.return_number ||
                                `PR-${id}`
                            )}
                        </strong>

                        <p>
                            ${formatDate(
                                purchaseReturn.return_date
                            )}
                        </p>
                    </div>
                </div>

                <p>
                    <strong>Supplier:</strong>
                    ${escapeHtml(
                        purchaseReturn.supplier_name ||
                        "-"
                    )}
                </p>

                <p>
                    <strong>Reason:</strong>
                    ${escapeHtml(
                        purchaseReturn.reason ||
                        "-"
                    )}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(
                        purchaseReturn.status ||
                        "-"
                    )}
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Unit Cost</th>
                            <th>Total</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${
                            itemRows ||
                            `
                                <tr>
                                    <td
                                        colspan="5"
                                        style="
                                            text-align:center;
                                        "
                                    >
                                        No items found.
                                    </td>
                                </tr>
                            `
                        }
                    </tbody>
                </table>

                <div class="summary">
    Total Return:
    ${formatMoney(
        purchaseReturn.total_amount
    )}
</div>

<div class="signature-area">

    <div class="signature-box">
        <div class="signature-line"></div>
        <span>Prepared By</span>
    </div>

    <div class="signature-box">
        <div class="signature-line"></div>
        <span>Store / Inventory</span>
    </div>

    <div class="signature-box">
        <div class="signature-line"></div>
        <span>Supplier Representative</span>
    </div>

    <div class="signature-box">
        <div class="signature-line"></div>
        <span>Authorized By</span>
    </div>

</div>

            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
    } catch (error) {
        alert(
            error.message ||
            "Unable to print purchase return."
        );
    }
}

// ============================================================
// New Return Modal
// ============================================================

async function openNewReturn() {
    const modal =
        byId("returnModal");

    if (!modal) {
        alert(
            "The New Return form is not available on this page."
        );

        return;
    }

    modal.style.display = "flex";

    const purchaseSelect =
        byId("purchaseSelect");

    if (!purchaseSelect) {
        return;
    }

    purchaseSelect.innerHTML =
        `<option value="">Loading purchases...</option>`;

    try {
        const result = await api(
            PURCHASE_API,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        const purchases =
            result.orders ||
            result.purchases ||
            [];

        purchaseSelect.innerHTML =
            `<option value="">Select Purchase Order</option>`;

        purchases.forEach(purchase => {
            purchaseSelect
                .insertAdjacentHTML(
                    "beforeend",
                    `
                        <option value="${Number(
                            purchase.id
                        )}">
                            ${escapeHtml(
                                purchase.po_number ||
                                `PO-${purchase.id}`
                            )}
                            -
                            ${escapeHtml(
                                purchase.supplier_name ||
                                ""
                            )}
                        </option>
                    `
                );
        });
    } catch (error) {
        purchaseSelect.innerHTML =
            `<option value="">Unable to load purchases</option>`;
    }
}

function closeReturnModal() {
    const modal =
        byId("returnModal");

    if (modal) {
        modal.style.display = "none";
    }
}

function closeViewModal() {
    const modal =
        byId("viewReturnModal");

    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("show");
        delete modal.dataset.returnId;
    }
}

// ============================================================
// Global Functions
// ============================================================

window.viewPurchaseReturn =
    viewPurchaseReturn;

window.printPurchaseReturn =
    printPurchaseReturn;

window.openNewReturn =
    openNewReturn;

window.closeReturnModal =
    closeReturnModal;

window.closeViewModal =
    closeViewModal;

// ============================================================
// Purchase Return View Modal Controls
// ============================================================

document
    .getElementById("closeViewModal")
    ?.addEventListener(
        "click",
        closeViewModal
    );

document
    .getElementById("closeViewBtn")
    ?.addEventListener(
        "click",
        closeViewModal
    );

document
    .getElementById("viewReturnModal")
    ?.addEventListener(
        "click",
        event => {
            if (
                event.target?.id ===
                "viewReturnModal"
            ) {
                closeViewModal();
            }
        }
    );
