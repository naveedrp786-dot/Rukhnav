"use strict";

// ============================================================
// RUKHNAV ERP
// Stock Adjustments Module
// ============================================================

const STOCK_ADJUSTMENT_API = "/api/stock-adjustments";
const PRODUCT_API = "/api/products";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken");

let stockAdjustments = [];
let products = [];
let currentViewedAdjustmentId = null;

// ============================================================
// Basic Helpers
// ============================================================

function byId(id) {
    return document.getElementById(id);
}

function getHeaders(includeJson = false) {

    const headers = {};

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

async function api(url, options = {}) {

    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("The server returned an invalid response.");
    }

    if (response.status === 401) {

        localStorage.removeItem("token");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("authToken");
        localStorage.removeItem("admin");

        window.location.href = "/admin/login.html";

        throw new Error("Your login session has expired.");
    }

    if (!response.ok || data.success === false) {

        throw new Error(
            data.message ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-GB");
}

function formatDateTime(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-GB");
}

function normalizeType(value) {

    return String(value || "")
        .trim()
        .toUpperCase();
}

function showLoadingButton(button, loadingText) {

    if (!button) {
        return;
    }

    button.dataset.originalText = button.innerHTML;
    button.disabled = true;

    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${escapeHtml(loadingText)}
    `;
}

function restoreButton(button) {

    if (!button) {
        return;
    }

    button.disabled = false;

    if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
    }
}

function getAdjustmentId(item) {

    return Number(
        item.id ||
        item.adjustment_id ||
        0
    );
}

function getAdjustmentNumber(item) {

    return (
        item.adjustment_number ||
        item.adjustment_no ||
        `SA-${getAdjustmentId(item)}`
    );
}

function getProductName(item) {

    return (
        item.product_name ||
        item.name ||
        "Product"
    );
}

function getCurrentStock(product) {

    return Number(
        product.stock_quantity ??
        product.stock ??
        product.quantity ??
        product.current_stock ??
        0
    );
}

function getAdjustmentTypeLabel(type) {

    const normalizedType = normalizeType(type);

    if (normalizedType === "IN") {
        return "Stock In";
    }

    if (normalizedType === "OUT") {
        return "Stock Out";
    }

    return type || "-";
}

function getToday() {
    return new Date().toISOString().split("T")[0];
}

// ============================================================
// Page Initialization
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    if (!token) {

        alert("Please log in to continue.");

        window.location.href = "/admin/login.html";

        return;
    }

    registerEvents();

    await Promise.all([
        loadStockAdjustments(),
        loadProducts()
    ]);
});

// ============================================================
// Event Registration
// ============================================================

function registerEvents() {

    byId("btnNewAdjustment")
        ?.addEventListener(
            "click",
            openAdjustmentModal
        );

    byId("closeAdjustmentModal")
        ?.addEventListener(
            "click",
            closeAdjustmentModal
        );

    byId("btnCancelAdjustment")
        ?.addEventListener(
            "click",
            closeAdjustmentModal
        );

    byId("btnSaveAdjustment")
        ?.addEventListener(
            "click",
            saveStockAdjustment
        );

    byId("productId")
        ?.addEventListener(
            "change",
            handleProductSelection
        );

    byId("adjustmentType")
        ?.addEventListener(
            "change",
            updateNewStockPreview
        );

    byId("quantity")
        ?.addEventListener(
            "input",
            updateNewStockPreview
        );

    byId("searchAdjustment")
        ?.addEventListener(
            "input",
            filterStockAdjustments
        );

    byId("typeFilter")
        ?.addEventListener(
            "change",
            filterStockAdjustments
        );

    byId("dateFilter")
        ?.addEventListener(
            "change",
            filterStockAdjustments
        );

    byId("btnResetFilters")
        ?.addEventListener(
            "click",
            resetFilters
        );

    byId("closeViewAdjustmentModal")
        ?.addEventListener(
            "click",
            closeViewAdjustmentModal
        );

    byId("btnCloseViewAdjustment")
        ?.addEventListener(
            "click",
            closeViewAdjustmentModal
        );

    byId("btnPrintAdjustment")
        ?.addEventListener("click", () => {

            if (!currentViewedAdjustmentId) {

                alert("No stock adjustment is selected.");

                return;
            }

            printStockAdjustment(
                currentViewedAdjustmentId
            );
        });

    byId("stockAdjustmentModal")
        ?.addEventListener("click", (event) => {

            if (
                event.target.id ===
                "stockAdjustmentModal"
            ) {
                closeAdjustmentModal();
            }
        });

    byId("viewAdjustmentModal")
        ?.addEventListener("click", (event) => {

            if (
                event.target.id ===
                "viewAdjustmentModal"
            ) {
                closeViewAdjustmentModal();
            }
        });

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {

                closeAdjustmentModal();
                closeViewAdjustmentModal();
            }
        }
    );
}
// ============================================================
// Load Stock Adjustments
// ============================================================

async function loadStockAdjustments() {

    const tbody = byId("stockAdjustmentTableBody");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="empty">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading stock adjustments...
            </td>
        </tr>
    `;

    try {

        const result = await api(
            STOCK_ADJUSTMENT_API,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        stockAdjustments =
            result.adjustments ||
            result.stockAdjustments ||
            result.data ||
            [];

        renderStockAdjustments(stockAdjustments);

        updateDashboard(stockAdjustments);

    }

    catch (error) {

        console.error(
            "Load Stock Adjustments Error:",
            error
        );

        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

    }

}

// ============================================================
// Dashboard
// ============================================================

function updateDashboard(list) {

    byId("totalAdjustments").textContent =
        list.length;

    let stockIn = 0;
    let stockOut = 0;
    let today = 0;

    const todayDate =
        getToday();

    list.forEach(item => {

        if (
            normalizeType(item.adjustment_type) === "IN"
        ) {
            stockIn++;
        }

        if (
            normalizeType(item.adjustment_type) === "OUT"
        ) {
            stockOut++;
        }

        const adjustmentDate =
            String(item.created_at || "")
            .split("T")[0];

        if (
            adjustmentDate === todayDate
        ) {
            today++;
        }

    });

    byId("totalStockIn").textContent =
        stockIn;

    byId("totalStockOut").textContent =
        stockOut;

    byId("todayAdjustments").textContent =
        today;

}

// ============================================================
// Render Table
// ============================================================

function renderStockAdjustments(list) {

    const tbody =
        byId("stockAdjustmentTableBody");

    if (!tbody) {
        return;
    }

    if (!list.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty">
                    No Stock Adjustments Found
                </td>
            </tr>
        `;

        return;

    }

    tbody.innerHTML =
        list.map((item, index) => {

            const id =
                getAdjustmentId(item);

            const badge =
                normalizeType(item.adjustment_type) === "IN"
                    ? "status-completed"
                    : "status-cancelled";

            return `

<tr>

<td>${index + 1}</td>

<td>

<strong>

${escapeHtml(
    getAdjustmentNumber(item)
)}

</strong>

</td>

<td>

${escapeHtml(
    getProductName(item)
)}

</td>

<td>

<span class="status-badge ${badge}">

${escapeHtml(
    getAdjustmentTypeLabel(
        item.adjustment_type
    )
)}

</span>

</td>

<td>

${Number(item.quantity)}

</td>

<td>

${escapeHtml(
    item.reason || "-"
)}

</td>

<td>

${escapeHtml(
    item.adjusted_by_name ||
    item.adjusted_by ||
    "-"
)}

</td>

<td>

${formatDate(
    item.created_at
)}

</td>

<td>

<button
type="button"
class="btn btn-primary btn-sm"
onclick="viewStockAdjustment(${id})"
title="View">

<i class="fa-solid fa-eye"></i>

</button>

<button
type="button"
class="btn btn-secondary btn-sm"
onclick="printStockAdjustment(${id})"
title="Print">

<i class="fa-solid fa-print"></i>

</button>

</td>

</tr>

`;

        }).join("");

}

// ============================================================
// Search & Filters
// ============================================================

function filterStockAdjustments() {

    const keyword =
        byId("searchAdjustment")
            ?.value
            .trim()
            .toLowerCase() || "";

    const type =
        normalizeType(
            byId("typeFilter")?.value
        );

    const date =
        byId("dateFilter")?.value || "";

    const filtered =
        stockAdjustments.filter(item => {

            const searchText = [

                item.adjustment_number,

                item.product_name,

                item.reason,

                item.remarks,

                item.adjusted_by_name

            ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

            const matchesKeyword =
                !keyword ||
                searchText.includes(keyword);

            const matchesType =
                !type ||
                normalizeType(
                    item.adjustment_type
                ) === type;

            const adjustmentDate =
                String(item.created_at || "")
                .split("T")[0];

            const matchesDate =
                !date ||
                adjustmentDate === date;

            return (

                matchesKeyword &&
                matchesType &&
                matchesDate

            );

        });

    renderStockAdjustments(filtered);

    updateDashboard(filtered);

}

// ============================================================
// Reset Filters
// ============================================================

function resetFilters() {

    byId("searchAdjustment").value = "";

    byId("typeFilter").value = "";

    byId("dateFilter").value = "";

    renderStockAdjustments(
        stockAdjustments
    );

    updateDashboard(
        stockAdjustments
    );

}
// ============================================================
// Load Products
// ============================================================

async function loadProducts() {

    const productSelect =
        byId("productId");

    if (!productSelect) {
        return;
    }

    productSelect.disabled = true;

    productSelect.innerHTML = `
        <option value="">
            Loading products...
        </option>
    `;

    try {

        const result = await api(
            PRODUCT_API,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        products =
            result.products ||
            result.data ||
            [];

        productSelect.innerHTML = `
            <option value="">
                Select Product
            </option>
        `;

        products.forEach(product => {

            const productId =
                Number(product.id || 0);

            if (!productId) {
                return;
            }

            const option =
                document.createElement("option");

            option.value =
                productId;

            option.textContent =
                `${product.product_name || product.name || "Product"} ` +
                `— Stock: ${getCurrentStock(product)}`;

            productSelect.appendChild(option);

        });

        if (!products.length) {

            productSelect.innerHTML = `
                <option value="">
                    No products found
                </option>
            `;
        }

    }

    catch (error) {

        console.error(
            "Load Products Error:",
            error
        );

        productSelect.innerHTML = `
            <option value="">
                Unable to load products
            </option>
        `;

    }

    finally {

        productSelect.disabled = false;

    }

}

// ============================================================
// Open Adjustment Modal
// ============================================================

function openAdjustmentModal() {

    resetAdjustmentForm();

    const modal = byId("stockAdjustmentModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.style.overflow = "hidden";

}

// ============================================================
// Close Adjustment Modal
// ============================================================

function closeAdjustmentModal() {

    const modal = byId("stockAdjustmentModal");

    if (!modal) return;

    modal.classList.remove("show");

    document.body.style.overflow = "";

}

// ============================================================
// Reset Adjustment Form
// ============================================================

function resetAdjustmentForm() {

    if (byId("stockAdjustmentForm")) {

        byId("stockAdjustmentForm").reset();

    }

    if (byId("adjustmentId")) {

        byId("adjustmentId").value = "";

    }

    if (byId("currentStock")) {

        byId("currentStock").value = 0;

    }

    if (byId("newStockPreview")) {

        byId("newStockPreview").value = 0;

    }

    if (byId("adjustmentWarning")) {

        byId("adjustmentWarning")
            .style.display = "none";

    }

}

// ============================================================
// Product Selection
// ============================================================

function handleProductSelection() {

    const productId =
        Number(
            byId("productId")?.value || 0
        );

    const selectedProduct =
        products.find(product => {

            return Number(product.id) === productId;

        });

    const currentStock =
        selectedProduct
            ? getCurrentStock(selectedProduct)
            : 0;

    if (byId("currentStock")) {

        byId("currentStock").value =
            currentStock;

    }

    updateNewStockPreview();

}

// ============================================================
// New Stock Preview
// ============================================================

function updateNewStockPreview() {

    const currentStock =
        Number(
            byId("currentStock")?.value || 0
        );

    const quantity =
        Math.max(
            Number(
                byId("quantity")?.value || 0
            ),
            0
        );

    const type =
        normalizeType(
            byId("adjustmentType")?.value
        );

    let newStock =
        currentStock;

    if (type === "IN") {

        newStock =
            currentStock + quantity;

    }

    if (type === "OUT") {

        newStock =
            currentStock - quantity;

    }

    if (byId("newStockPreview")) {

        byId("newStockPreview").value =
            newStock;

    }

    const warning =
        byId("adjustmentWarning");

    if (warning) {

        if (
            type === "OUT" &&
            quantity > currentStock
        ) {

            warning.style.display =
                "block";

        }

        else {

            warning.style.display =
                "none";

        }

    }

}

// ============================================================
// Save Stock Adjustment
// ============================================================

async function saveStockAdjustment() {

    const productId =
        Number(
            byId("productId")?.value || 0
        );

    const adjustmentType =
        normalizeType(
            byId("adjustmentType")?.value
        );

    const quantity =
        Number(
            byId("quantity")?.value || 0
        );

    const reason =
        byId("reason")?.value || "";

    const remarks =
        byId("remarks")
            ?.value
            .trim() || "";

    const currentStock =
        Number(
            byId("currentStock")?.value || 0
        );

    if (!productId) {

        alert("Please select a product.");

        byId("productId")?.focus();

        return;
    }

    if (
        adjustmentType !== "IN" &&
        adjustmentType !== "OUT"
    ) {

        alert(
            "Please select a valid adjustment type."
        );

        byId("adjustmentType")?.focus();

        return;
    }

    if (
        !Number.isFinite(quantity) ||
        quantity <= 0
    ) {

        alert(
            "Please enter a valid quantity greater than zero."
        );

        byId("quantity")?.focus();

        return;
    }

    if (!Number.isInteger(quantity)) {

        alert(
            "Quantity must be a whole number."
        );

        byId("quantity")?.focus();

        return;
    }

    if (!reason) {

        alert(
            "Please select an adjustment reason."
        );

        byId("reason")?.focus();

        return;
    }

    if (
        adjustmentType === "OUT" &&
        quantity > currentStock
    ) {

        alert(
            "Stock-out quantity cannot exceed current stock."
        );

        byId("quantity")?.focus();

        return;
    }

    const selectedProduct =
        products.find(product => {

            return Number(product.id) === productId;

        });

    const productName =
        selectedProduct
            ? (
                selectedProduct.product_name ||
                selectedProduct.name ||
                "Product"
            )
            : "Product";

    const newStock =
        adjustmentType === "IN"
            ? currentStock + quantity
            : currentStock - quantity;

    const confirmed = confirm(

        "Save this stock adjustment?\n\n" +

        `Product: ${productName}\n` +

        `Type: ${getAdjustmentTypeLabel(adjustmentType)}\n` +

        `Quantity: ${quantity}\n` +

        `Current Stock: ${currentStock}\n` +

        `New Stock: ${newStock}\n\n` +

        "Product stock will be updated immediately."

    );

    if (!confirmed) {
        return;
    }

    const saveButton =
        byId("btnSaveAdjustment");

    showLoadingButton(
        saveButton,
        "Saving Adjustment..."
    );

    try {

        const result = await api(
            STOCK_ADJUSTMENT_API,
            {
                method: "POST",

                headers: getHeaders(true),

                body: JSON.stringify({

                    product_id:
                        productId,

                    adjustment_type:
                        adjustmentType,

                    quantity,

                    reason,

                    remarks

                })
            }
        );

        const adjustmentNumber =
            result.adjustmentNumber ||
            result.adjustment_number ||
            result.adjustment
                ?.adjustment_number ||
            "";

        alert(

            (
                result.message ||
                "Stock adjustment saved successfully."
            ) +

            (
                adjustmentNumber
                    ? `\n\nAdjustment Number: ${adjustmentNumber}`
                    : ""
            )

        );

        closeAdjustmentModal();

        await Promise.all([
            loadStockAdjustments(),
            loadProducts()
        ]);

    }

    catch (error) {

        console.error(
            "Save Stock Adjustment Error:",
            error
        );

        alert(error.message);

    }

    finally {

        restoreButton(saveButton);

    }

}
// ============================================================
// Open View Modal
// ============================================================

function openViewAdjustmentModal() {

    const modal = byId("viewAdjustmentModal");

    if (!modal) return;

    modal.classList.add("show");

    document.body.style.overflow = "hidden";

}

// ============================================================
// Close View Modal
// ============================================================

function closeViewAdjustmentModal() {

    const modal = byId("viewAdjustmentModal");

    if (!modal) return;

    modal.classList.remove("show");

    currentViewedAdjustmentId = null;

    document.body.style.overflow = "";

}

// ============================================================
// View Stock Adjustment
// ============================================================

async function viewStockAdjustment(id) {

    const adjustmentId =
        Number(id);

    if (!adjustmentId) {

        alert("Invalid Adjustment ID.");

        return;

    }

    try {

        const result = await api(

            `${STOCK_ADJUSTMENT_API}/${adjustmentId}`,

            {

                method: "GET",

                headers: getHeaders()

            }

        );

        const adjustment =
            result.adjustment ||
            result.stockAdjustment ||
            result.data ||
            {};

        currentViewedAdjustmentId =
            adjustmentId;

        byId("viewAdjustmentNumber").value =
            adjustment.adjustment_number ||
            `SA-${adjustmentId}`;

        byId("viewProductName").value =
            adjustment.product_name ||
            "-";

        byId("viewAdjustmentType").value =
            getAdjustmentTypeLabel(
                adjustment.adjustment_type
            );

        byId("viewQuantity").value =
            adjustment.quantity || 0;

        byId("viewReason").value =
            adjustment.reason || "-";

        byId("viewAdjustedBy").value =
            adjustment.adjusted_by_name ||
            adjustment.adjusted_by ||
            "-";

        byId("viewCreatedAt").value =
            formatDateTime(
                adjustment.created_at
            );

        byId("viewRemarks").value =
            adjustment.remarks || "";

        openViewAdjustmentModal();

    }

    catch (error) {

        console.error(
            "View Adjustment Error:",
            error
        );

        alert(error.message);

    }

}
// ============================================================
// Print Stock Adjustment
// ============================================================

async function printStockAdjustment(id) {

    const adjustmentId =
        Number(id);

    if (!adjustmentId) {

        alert("Invalid Adjustment ID.");

        return;

    }

    try {

        const result = await api(

            `${STOCK_ADJUSTMENT_API}/${adjustmentId}`,

            {

                method: "GET",

                headers: getHeaders()

            }

        );

        const adjustment =
            result.adjustment ||
            result.stockAdjustment ||
            result.data ||
            {};

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=1000,height=800"
            );

        if (!printWindow) {

            alert(
                "Please allow popups for this website."
            );

            return;

        }

        printWindow.document.write(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>

Stock Adjustment Voucher

</title>

<style>

body{

font-family:Arial,sans-serif;

padding:40px;

color:#222;

}

h1{

text-align:center;

margin-bottom:5px;

color:#0d4a36;

}

h3{

text-align:center;

margin-top:0;

margin-bottom:30px;

color:#666;

}

table{

width:100%;

border-collapse:collapse;

margin-top:20px;

}

th{

background:#0d4a36;

color:white;

padding:12px;

border:1px solid #ddd;

text-align:left;

}

td{

padding:12px;

border:1px solid #ddd;

}

.footer{

margin-top:70px;

display:flex;

justify-content:space-between;

}

.signature{

width:220px;

text-align:center;

}

.signature hr{

margin-bottom:10px;

}

</style>

</head>

<body>

<h1>

RUKHNAV ERP

</h1>

<h3>

STOCK ADJUSTMENT VOUCHER

</h3>

<table>

<tr>

<th>Adjustment No.</th>

<td>

${adjustment.adjustment_number}

</td>

</tr>

<tr>

<th>Product</th>

<td>

${adjustment.product_name}

</td>

</tr>

<tr>

<th>Adjustment Type</th>

<td>

${getAdjustmentTypeLabel(
adjustment.adjustment_type
)}

</td>

</tr>

<tr>

<th>Quantity</th>

<td>

${adjustment.quantity}

</td>

</tr>

<tr>

<th>Reason</th>

<td>

${adjustment.reason}

</td>

</tr>

<tr>

<th>Adjusted By</th>

<td>

${adjustment.adjusted_by_name ||
adjustment.adjusted_by ||
"-"}

</td>

</tr>

<tr>

<th>Date</th>

<td>

${formatDateTime(
adjustment.created_at
)}

</td>

</tr>

<tr>

<th>Remarks</th>

<td>

${adjustment.remarks || "-"}

</td>

</tr>

</table>

<div class="footer">

<div class="signature">

<hr>

Prepared By

</div>

<div class="signature">

<hr>

Warehouse In-Charge

</div>

<div class="signature">

<hr>

Approved By

</div>

</div>

<script>

window.onload=function(){

window.print();

setTimeout(function(){

window.close();

},300);

};

</script>

</body>

</html>

`);

        printWindow.document.close();

    }

    catch (error) {

        console.error(
            "Print Error:",
            error
        );

        alert(error.message);

    }

}