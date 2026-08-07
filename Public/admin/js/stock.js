"use strict";

const STOCK_API = "/api/stock";

function stockToken() {
    return (
        localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("adminToken") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function stockRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = stockToken();

    if (options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (token) {
        headers.set(
            "Authorization",
            token.startsWith("Bearer ") ? token : `Bearer ${token}`
        );
    }

    const response = await fetch(`${STOCK_API}${path}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        window.location.href = "/admin/login.html";
        throw new Error("Your admin session has expired.");
    }

    if (!response.ok) {
        throw new Error(data.message || data.error || "Stock request failed.");
    }

    return data;
}

function showStockMessage(message, type = "") {
    const element = document.getElementById("stockMessage");
    element.textContent = message || "";
    element.className = `stock-message ${type}`.trim();
}

function collection(data, likelyKeys) {
    for (const key of likelyKeys) {
        if (Array.isArray(data?.[key])) return data[key];
    }
    return Array.isArray(data) ? data : [];
}

async function loadStockSetup() {
    const [productsData, suppliersData] = await Promise.all([
        stockRequest("/products"),
        stockRequest("/suppliers")
    ]);

    const products = collection(productsData, ["products", "data", "rows"]);
    const suppliers = collection(suppliersData, ["suppliers", "data", "rows"]);

    document.getElementById("stockProduct").innerHTML =
        `<option value="">Select product</option>` +
        products.map(product => `
            <option value="${escapeHtml(product.id)}">
                ${escapeHtml(product.product_name || product.name || `Product #${product.id}`)}
                ${product.sku ? ` · ${escapeHtml(product.sku)}` : ""}
            </option>
        `).join("");

    document.getElementById("stockSupplier").innerHTML =
        `<option value="">Select supplier</option>` +
        suppliers.map(supplier => `
            <option value="${escapeHtml(supplier.id)}">
                ${escapeHtml(supplier.supplier_name || supplier.company_name || supplier.name || `Supplier #${supplier.id}`)}
            </option>
        `).join("");
}

async function submitStock(event) {
    event.preventDefault();

    const button = document.getElementById("saveStockButton");
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';

    const payload = {
        product_id: Number(document.getElementById("stockProduct").value),
        supplier_id: Number(document.getElementById("stockSupplier").value),
        quantity: Number(document.getElementById("stockQuantity").value),
        cost_price: Number(document.getElementById("stockUnitCost").value),
        reference: document.getElementById("stockReference").value.trim() || null,
        remarks: [
            document.getElementById("stockNotes").value.trim(),
            document.getElementById("stockDate").value
                ? `Received date: ${document.getElementById("stockDate").value}`
                : ""
        ].filter(Boolean).join(" | ") || null
    };

    try {
        const data = await stockRequest("/in", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showStockMessage(data.message || "Stock received successfully.", "success");
        document.getElementById("stockInForm").reset();
        document.getElementById("stockDate").value = new Date().toISOString().slice(0, 10);
    } catch (error) {
        showStockMessage(error.message, "error");
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

async function initializeStockPage() {
    if (!stockToken()) {
        window.location.href = "/admin/login.html";
        return;
    }

    document.getElementById("stockDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("stockInForm").addEventListener("submit", submitStock);

    try {
        await loadStockSetup();
    } catch (error) {
        showStockMessage(error.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", initializeStockPage, {once: true});
