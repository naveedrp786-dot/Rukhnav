// ============================================
// RUKHNAV ERP - Edit Purchase
// ============================================

const API = "/api";
const token = localStorage.getItem("token") || localStorage.getItem("adminToken");
const purchaseId = new URLSearchParams(window.location.search).get("id");

let suppliers = [];
let products = [];
let currentPurchase = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!token) {
        alert("Please login first.");
        window.location.href = "/admin/login.html";
        return;
    }

    if (!purchaseId) {
        alert("Purchase ID is missing.");
        window.location.href = "/admin/purchases.html";
        return;
    }

    registerEvents();

    try {
        await Promise.all([loadSuppliers(), loadProducts()]);
        await loadPurchase();
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Unable to load purchase.", "error");
    }
});

function registerEvents() {
    document.getElementById("btnAddRow").addEventListener("click", addRow);
    document.getElementById("btnUpdate").addEventListener("click", updatePurchase);
    document.getElementById("supplier").addEventListener("change", showSupplier);

    ["discount", "tax", "shipping"].forEach(id => {
        document.getElementById(id).addEventListener("input", calculateTotals);
    });

    document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            updatePurchase();
        }
    });
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    let data = {};
    try { data = await response.json(); } catch {}

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed (${response.status}).`);
    }

    return data;
}

async function loadSuppliers() {
    const data = await apiFetch(`${API}/suppliers`);
    suppliers = data.suppliers || [];

    const select = document.getElementById("supplier");
    select.innerHTML = `<option value="">Select supplier</option>`;

    suppliers.forEach(supplier => {
        select.insertAdjacentHTML(
            "beforeend",
            `<option value="${supplier.id}">${escapeHtml(supplier.supplier_name)}</option>`
        );
    });
}

async function loadProducts() {
    const data = await apiFetch(`${API}/products`);
    products = data.products || [];
}

async function loadPurchase() {
    const data = await apiFetch(`${API}/purchases/${purchaseId}`);
    currentPurchase = data.purchase;

    document.getElementById("poNumber").value = currentPurchase.po_number || "-";
    document.getElementById("supplier").value = String(currentPurchase.supplier_id || "");
    document.getElementById("purchaseDate").value = toDateInput(currentPurchase.order_date);
    document.getElementById("expectedDate").value = toDateInput(currentPurchase.expected_date);
    document.getElementById("paymentMethod").value = currentPurchase.payment_method || "Cash";
    document.getElementById("discount").value = Number(currentPurchase.discount || 0);
    document.getElementById("tax").value = Number(currentPurchase.tax || 0);
    document.getElementById("shipping").value = Number(currentPurchase.shipping || 0);
    document.getElementById("remarks").value = currentPurchase.remarks || "";

    document.getElementById("paidAmount").textContent = formatCurrency(currentPurchase.paid_amount);
    document.getElementById("balanceAmount").textContent = formatCurrency(currentPurchase.balance_amount);
    document.getElementById("paymentStatus").textContent = currentPurchase.payment_status || "Pending";
    document.getElementById("orderStatus").textContent = currentPurchase.status || "Draft";

    showSupplier();

    const tbody = document.getElementById("productBody");
    tbody.innerHTML = "";

    if (!data.items || data.items.length === 0) {
        addRow();
    } else {
        data.items.forEach(item => addRow(item));
    }

    calculateTotals();
}

function showSupplier() {
    const supplierId = Number(document.getElementById("supplier").value);
    const supplier = suppliers.find(item => Number(item.id) === supplierId);
    const target = document.getElementById("supplierDetails");

    if (!supplier) {
        target.innerHTML = "Select a supplier...";
        return;
    }

    target.innerHTML = `
        <strong>${escapeHtml(supplier.supplier_name)}</strong><br>
        ${escapeHtml(supplier.contact_person || "")}<br>
        ${escapeHtml(supplier.phone || "")}<br>
        ${escapeHtml(supplier.email || "")}<br>
        ${escapeHtml(supplier.address || "")}<br>
        ${escapeHtml([supplier.city, supplier.country].filter(Boolean).join(", "))}
    `;
}

function buildProductOptions(selectedId = "") {
    const initial = `<option value="">Select product</option>`;

    return initial + products.map(product => {
        const selected = Number(product.id) === Number(selectedId) ? "selected" : "";
        const cost = Number(product.cost_price ?? product.unit_cost ?? product.purchase_price ?? 0);

        return `
            <option value="${product.id}" data-cost="${cost}" ${selected}>
                ${escapeHtml(product.product_name)}
            </option>
        `;
    }).join("");
}

function addRow(item = null) {
    const tbody = document.getElementById("productBody");
    const quantity = Number(item?.quantity || 1);
    const unitCost = Number(item?.unit_cost || 0);
    const row = document.createElement("tr");

    row.innerHTML = `
        <td>
            <select class="productSelect">
                ${buildProductOptions(item?.product_id || "")}
            </select>
        </td>
        <td>
            <input type="number" class="qty" value="${quantity}" min="1" step="1">
        </td>
        <td>
            <input type="number" class="cost" value="${unitCost.toFixed(2)}" min="0" step="0.01">
        </td>
        <td>
            <input type="text" class="lineTotal" value="${(quantity * unitCost).toFixed(2)}" readonly>
        </td>
        <td>
            <button type="button" class="removeRow" title="Remove product">
                <i class="fa-solid fa-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
    bindSingleRow(row);

    if (!item) row.querySelector(".productSelect").focus();
    calculateTotals();
}

function bindSingleRow(row) {
    const productSelect = row.querySelector(".productSelect");
    const qtyInput = row.querySelector(".qty");
    const costInput = row.querySelector(".cost");
    const removeButton = row.querySelector(".removeRow");

    productSelect.addEventListener("change", () => {
        const selectedOption = productSelect.options[productSelect.selectedIndex];

        if (selectedOption && selectedOption.value) {
            costInput.value = Number(selectedOption.dataset.cost || 0).toFixed(2);
        }

        calculateTotals();
    });

    [qtyInput, costInput].forEach(input => {
        input.addEventListener("input", () => {
            if (Number(input.value) < 0) input.value = 0;
            calculateTotals();
        });

        input.addEventListener("wheel", event => event.currentTarget.blur());
    });

    removeButton.addEventListener("click", () => {
        const rows = document.querySelectorAll("#productBody tr");

        if (rows.length === 1) {
            alert("At least one product is required.");
            return;
        }

        row.remove();
        calculateTotals();
    });
}

function calculateTotals() {
    let subtotal = 0;

    document.querySelectorAll("#productBody tr").forEach(row => {
        const quantity = Number(row.querySelector(".qty").value || 0);
        const unitCost = Number(row.querySelector(".cost").value || 0);
        const lineTotal = quantity * unitCost;

        row.querySelector(".lineTotal").value = lineTotal.toFixed(2);
        subtotal += lineTotal;
    });

    const discount = Number(document.getElementById("discount").value || 0);
    const tax = Number(document.getElementById("tax").value || 0);
    const shipping = Number(document.getElementById("shipping").value || 0);
    const grandTotal = Math.max(0, subtotal - discount + tax + shipping);

    document.getElementById("subTotal").value = subtotal.toFixed(2);
    document.getElementById("grandTotal").value = grandTotal.toFixed(2);

    const paid = Number(currentPurchase?.paid_amount || 0);
    document.getElementById("balanceAmount").textContent =
        formatCurrency(Math.max(0, grandTotal - paid));
}

function collectFormData() {
    const items = [];

    document.querySelectorAll("#productBody tr").forEach(row => {
        items.push({
            product_id: Number(row.querySelector(".productSelect").value),
            quantity: Number(row.querySelector(".qty").value),
            unit_cost: Number(row.querySelector(".cost").value)
        });
    });

    const supplierId = Number(document.getElementById("supplier").value);

    if (!supplierId) throw new Error("Please select a supplier.");
    if (!document.getElementById("purchaseDate").value) throw new Error("Purchase date is required.");
    if (items.length === 0) throw new Error("Please add at least one product.");

    const productIds = items.map(item => item.product_id);

    if (productIds.some(id => !id)) throw new Error("Please select a product in every row.");
    if (new Set(productIds).size !== productIds.length) throw new Error("Duplicate products are not allowed.");

    for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            throw new Error("Every quantity must be greater than zero.");
        }

        if (!Number.isFinite(item.unit_cost) || item.unit_cost < 0) {
            throw new Error("Every unit cost must be zero or greater.");
        }
    }

    return {
        supplier_id: supplierId,
        order_date: document.getElementById("purchaseDate").value,
        expected_date: document.getElementById("expectedDate").value || null,
        payment_method: document.getElementById("paymentMethod").value,
        discount: Number(document.getElementById("discount").value || 0),
        tax: Number(document.getElementById("tax").value || 0),
        shipping: Number(document.getElementById("shipping").value || 0),
        remarks: document.getElementById("remarks").value.trim(),
        items
    };
}

async function updatePurchase() {
    const button = document.getElementById("btnUpdate");
    if (button.disabled) return;

    try {
        const body = collectFormData();

        button.disabled = true;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating...`;

        const data = await apiFetch(`${API}/purchases/${purchaseId}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        showMessage(data.message || "Purchase updated successfully.", "success");

        setTimeout(() => {
            window.location.href = "/admin/purchases.html";
        }, 700);

    } catch (error) {
        console.error(error);
        showMessage(error.message || "Unable to update purchase.", "error");

    } finally {
        button.disabled = false;
        button.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Update Purchase`;
    }
}

function toDateInput(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
    return `Rs ${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showMessage(message, type = "success") {
    const target = document.getElementById("pageMessage");

    target.textContent = message;
    target.className = `page-message ${type}`;

    window.setTimeout(() => {
        target.classList.add("hidden");
    }, 3500);
}
