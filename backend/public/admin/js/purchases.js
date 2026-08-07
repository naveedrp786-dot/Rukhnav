"use strict";

// ============================================================
// RUKHNAV ERP
// Purchase Management
// ============================================================

const authToken =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");

let purchases = [];
let selectedPurchase = null;

// ============================================================
// Helpers
// ============================================================

const byId = (id) => document.getElementById(id);

function formatMoney(value) {

    return "Rs " + Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}

function formatDate(date) {

    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-GB");

}

function getPaidAmount(purchase) {

    return Number(
        purchase.paid_amount ||
        purchase.total_paid ||
        purchase.paid ||
        0
    );

}

function getBalanceAmount(purchase) {

    const grandTotal =
        Number(purchase.grand_total || 0);

    const paidAmount =
        getPaidAmount(purchase);

    const paymentStatus =
        String(purchase.payment_status || "")
            .toLowerCase();

    if (paymentStatus === "paid") {
        return 0;
    }

    return Math.max(
        grandTotal - paidAmount,
        0
    );

}

function getHeaders(json = false) {

    const headers = {};

    if (json)
        headers["Content-Type"] = "application/json";

    if (authToken)
        headers.Authorization = "Bearer " + authToken;

    return headers;

}

async function api(url, options = {}) {

    const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
        ...(options.headers || {}),
        "Cache-Control": "no-cache"
    }
});

    const data = await response.json();

    if (!response.ok || data.success === false) {

        throw new Error(
            data.message || "Request Failed"
        );

    }

    return data;

}

// ============================================================
// Page Load
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    loadPurchases();

    byId("btnNewPurchase")?.addEventListener("click", () => {

        window.location.href =
    "/admin/newPurchase.html";

    });

    byId("searchPurchase")?.addEventListener("keyup", filterPurchases);

    byId("statusFilter")?.addEventListener("change", filterPurchases);

});

// ============================================================
// Dashboard
// ============================================================

function updateDashboard(list) {

    byId("totalPurchases").innerHTML = list.length;

    let totalAmount = 0;

    let received = 0;

    let pending = 0;

    list.forEach(p => {

    totalAmount += Number(
        p.grand_total || 0
    );

    const orderStatus =
        String(
            p.status ||
            p.order_status ||
            ""
        )
            .trim()
            .toLowerCase();

    if (orderStatus === "received") {
        received++;
    }

    const balance =
        getBalanceAmount(p);

    if (
        ![
            "draft",
            "cancelled",
            "canceled"
        ].includes(orderStatus) &&
        balance > 0
    ) {
        pending++;
    }

});

    byId("totalAmount").innerHTML =
        formatMoney(totalAmount);

    byId("receivedOrders").innerHTML =
        received;

    byId("pendingPayments").innerHTML =
        pending;

}

// ============================================================
// Load Purchases
// ============================================================

async function loadPurchases() {

    try {

        byId("purchaseTableBody").innerHTML =
            `<tr><td colspan="10" align="center">Loading...</td></tr>`;

        const result = await api(
    `/api/purchases?_=${Date.now()}`,
    {
        method: "GET",
        headers: getHeaders()
    }
);

        purchases = result.orders || [];

        renderTable(purchases);

        updateDashboard(purchases);

    }

    catch (err) {

        console.error(err);

        byId("purchaseTableBody").innerHTML =
            `<tr>
                <td colspan="10" align="center">
                    ${err.message}
                </td>
            </tr>`;

    }

}

// ============================================================
// Search
// ============================================================

function filterPurchases() {

    const keyword =
        byId("searchPurchase").value
            .toLowerCase();

    const status =
        byId("statusFilter").value
            .toLowerCase();

    const filtered =
        purchases.filter(p => {

            const search =
                (
                    p.po_number +
                    p.supplier_name +
                    p.order_date +
                    p.status
                )
                .toLowerCase();

            const ok1 =
                search.includes(keyword);

            const ok2 =
                status == "" ||
                p.status.toLowerCase() == status;

            return ok1 && ok2;

        });

    renderTable(filtered);

}

// ============================================================
// Render Table
// ============================================================

function renderTable(rows) {

    const tbody =
        byId("purchaseTableBody");

    if (!rows.length) {

        tbody.innerHTML =
            `<tr>
                <td colspan="10" align="center">
                    No Purchase Orders Found
                </td>
            </tr>`;

        return;

    }

    tbody.innerHTML =
        rows.map((p, i) => {

            return `

<tr>

<td>${i + 1}</td>

<td><b>${p.po_number}</b></td>

<td>${p.supplier_name}</td>

<td>${formatDate(p.order_date)}</td>

<td>${formatMoney(p.grand_total)}</td>

<td>${formatMoney(getPaidAmount(p))}</td>

<td>${formatMoney(getBalanceAmount(p))}</td>

<td>${p.payment_status || "Unpaid"}</td>

<td>${p.status}</td>

<td>

<div class="action-buttons">

    <button
        type="button"
        class="btn-action btn-view"
        title="View Purchase"
        onclick="window.viewPurchase(${Number(p.id)})"
    >
        <i class="fas fa-eye"></i>
    </button>

    <button
        type="button"
        class="btn-action btn-edit"
        title="Edit Purchase"
        onclick="window.editPurchase(${Number(p.id)})"
    >
        <i class="fas fa-pen"></i>
    </button>

    <button
        type="button"
        class="btn-action btn-receive"
        title="Receive Goods"
        onclick="window.receivePurchase(${Number(p.id)})"
    >
        <i class="fas fa-box-open"></i>
    </button>

    <button
        type="button"
        class="btn-action btn-payment"
        title="Add Payment"
        onclick="window.addPayment(${Number(p.id)})"
    >
        <i class="fas fa-money-bill-wave"></i>
    </button>

    <button
        type="button"
        class="btn-action btn-print"
        title="Print Purchase"
        onclick="window.printPurchase(${Number(p.id)})"
    >
        <i class="fas fa-print"></i>
    </button>

    <button
        type="button"
        class="btn-action btn-delete"
        title="Delete Purchase"
        onclick="window.deletePurchase(${Number(p.id)})"
    >
        <i class="fas fa-trash"></i>
    </button>

</div>

</td>

</tr>

`;

        }).join("");

}
// ============================================================
// View Purchase Details
// ============================================================

async function viewPurchase(id) {

    try {

        const result = await api(`${PURCHASE_API}/${id}`, {

            headers: getHeaders()

        });

        selectedPurchase = result;

        const purchase = result.purchase;

        const items = result.items || [];

        const payments = result.payments || [];

        // ----------------------------
        // Supplier Information
        // ----------------------------

        byId("supplierInfo").innerHTML = `

        <table class="table table-bordered">

            <tr>
                <td><b>Supplier</b></td>
                <td>${purchase.supplier_name}</td>
            </tr>

            <tr>
                <td><b>Contact Person</b></td>
                <td>${purchase.contact_person || "-"}</td>
            </tr>

            <tr>
                <td><b>Phone</b></td>
                <td>${purchase.phone || "-"}</td>
            </tr>

            <tr>
                <td><b>Email</b></td>
                <td>${purchase.email || "-"}</td>
            </tr>

            <tr>
                <td><b>Address</b></td>
                <td>${purchase.address || "-"}</td>
            </tr>

            <tr>
                <td><b>City</b></td>
                <td>${purchase.city || "-"}</td>
            </tr>

            <tr>
                <td><b>Country</b></td>
                <td>${purchase.country || "-"}</td>
            </tr>

        </table>

        `;

        // ----------------------------
        // Purchase Information
        // ----------------------------

        byId("purchaseInfo").innerHTML = `

        <table class="table table-bordered">

            <tr>
                <td><b>PO Number</b></td>
                <td>${purchase.po_number}</td>
            </tr>

            <tr>
                <td><b>Order Date</b></td>
                <td>${formatDate(purchase.order_date)}</td>
            </tr>

            <tr>
                <td><b>Expected Date</b></td>
                <td>${formatDate(purchase.expected_date)}</td>
            </tr>

            <tr>
                <td><b>Status</b></td>
                <td>${purchase.status}</td>
            </tr>

            <tr>
                <td><b>Payment Status</b></td>
                <td>${purchase.payment_status}</td>
            </tr>

            <tr>
                <td><b>Subtotal</b></td>
                <td>${formatMoney(purchase.subtotal)}</td>
            </tr>

            <tr>
                <td><b>Discount</b></td>
                <td>${formatMoney(purchase.discount)}</td>
            </tr>

            <tr>
                <td><b>Tax</b></td>
                <td>${formatMoney(purchase.tax)}</td>
            </tr>

            <tr>
                <td><b>Shipping</b></td>
                <td>${formatMoney(purchase.shipping)}</td>
            </tr>

            <tr>
                <td><b>Grand Total</b></td>
                <td>${formatMoney(purchase.grand_total)}</td>
            </tr>

            <tr>
                <td><b>Paid Amount</b></td>
                <td>${formatMoney(getPaidAmount(purchase))}</td>
            </tr>

            <tr>
                <td><b>Balance</b></td>
                <td>${formatMoney(getBalanceAmount(purchase))}</td>
            </tr>

            <tr>
                <td><b>Remarks</b></td>
                <td>${purchase.remarks || "-"}</td>
            </tr>

        </table>

        `;

        // ----------------------------
        // Purchase Items
        // ----------------------------

        byId("purchaseItems").innerHTML = "";

        if (items.length === 0) {

            byId("purchaseItems").innerHTML = `

            <tr>

                <td colspan="5" align="center">

                    No Items Found

                </td>

            </tr>

            `;

        }

        else {

            items.forEach((item, index) => {

                byId("purchaseItems").innerHTML += `

                <tr>

                    <td>${index + 1}</td>

                    <td>${item.product_name}</td>

                    <td>${item.quantity}</td>

                    <td>${formatMoney(item.unit_cost)}</td>

                    <td>${formatMoney(item.total_cost)}</td>

                </tr>

                `;

            });

        }

        // ----------------------------
        // Payment History
        // ----------------------------

        byId("paymentHistory").innerHTML = "";

        if (payments.length === 0) {

            byId("paymentHistory").innerHTML = `

            <tr>

                <td colspan="4" align="center">

                    No Payments Found

                </td>

            </tr>

            `;

        }

        else {

            payments.forEach(payment => {

                byId("paymentHistory").innerHTML += `

                <tr>

                    <td>${formatDate(payment.payment_date)}</td>

                    <td>${payment.payment_method}</td>

                    <td>${formatMoney(payment.amount)}</td>

                    <td>${payment.remarks || "-"}</td>

                </tr>

                `;

            });

        }

        // ----------------------------
        // Open Modal
        // ----------------------------

        byId("purchaseModal").style.display = "block";

    }

    catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// ============================================================
// Close Purchase Modal
// ============================================================

function closePurchaseModal() {

    byId("purchaseModal").style.display = "none";

}

// ============================================================
// Edit Purchase
// ============================================================

function editPurchase(id) {

    window.location.href =
    `/admin/editPurchase.html?id=${id}`;

}

// ============================================================
// Receive Purchase Order
// ============================================================

async function receivePurchase(id) {

    const purchase = purchases.find(
        item => Number(item.id) === Number(id)
    );

    if (!purchase) {

        alert("Purchase order not found.");

        return;

    }

    if (
        String(purchase.status || "")
            .toLowerCase() === "received"
    ) {

        alert("This purchase order is already received.");

        return;

    }

    const confirmReceive = confirm(
        "Are you sure you want to receive this purchase order?\n\n" +
        "This action will increase product stock and mark the order as Received."
    );

    if (!confirmReceive) {

        return;

    }

    try {

        const result = await api(
            `${PURCHASE_API}/${id}/receive`,
            {

                method: "POST",

                headers: getHeaders(true),

                body: JSON.stringify({})

            }
        );

        alert(
            result.message ||
            "Goods received successfully."
        );

        await loadPurchases();

    }

    catch (err) {

        console.error(
            "Receive Purchase Error:",
            err
        );

        alert(err.message);

    }

}


// ============================================================
// Add Supplier Payment
// ============================================================

async function addPayment(id) {

    const purchase = purchases.find(
        item => Number(item.id) === Number(id)
    );

    if (!purchase) {

        alert("Purchase order not found.");

        return;

    }

    const balance = getBalanceAmount(purchase);

    if (balance <= 0) {

        alert("This purchase order is already fully paid.");

        return;

    }

    const amountInput = prompt(
        "Enter payment amount.\n\n" +
        "Remaining Balance: " +
        formatMoney(balance),
        balance.toFixed(2)
    );

    if (amountInput === null) {

        return;

    }

    const amount = Number(amountInput);

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert("Please enter a valid payment amount.");

        return;

    }

    if (amount > balance) {

        alert(
            "Payment cannot be greater than the remaining balance.\n\n" +
            "Remaining Balance: " +
            formatMoney(balance)
        );

        return;

    }

    const paymentMethodInput = prompt(
        "Enter payment method:",
        purchase.payment_method || "Cash"
    );

    if (paymentMethodInput === null) {

        return;

    }

    const paymentMethod =
        paymentMethodInput.trim();

    if (!paymentMethod) {

        alert("Payment method is required.");

        return;

    }

    const remarksInput = prompt(
        "Enter payment remarks:",
        ""
    );

    if (remarksInput === null) {

        return;

    }

    try {

        const result = await api(
            `${PURCHASE_API}/${id}/payment`,
            {

                method: "POST",

                headers: getHeaders(true),

                body: JSON.stringify({

                    amount: amount,

                    payment_method: paymentMethod,

                    remarks: remarksInput.trim()

                })

            }
        );

        alert(
            result.message ||
            "Payment recorded successfully."
        );

        await loadPurchases();

    }

    catch (err) {

        console.error(
            "Add Payment Error:",
            err
        );

        alert(err.message);

    }

}


// ============================================================
// Delete Purchase Order
// ============================================================

async function deletePurchase(id) {

    const purchase = purchases.find(
        item => Number(item.id) === Number(id)
    );

    if (!purchase) {

        alert("Purchase order not found.");

        return;

    }

    const poNumber =
        purchase.po_number || id;

    const confirmDelete = confirm(
        `Are you sure you want to delete purchase order ${poNumber}?\n\n` +
        "This action cannot be undone."
    );

    if (!confirmDelete) {

        return;

    }

    try {

        const result = await api(
            `${PURCHASE_API}/${id}`,
            {

                method: "DELETE",

                headers: getHeaders()

            }
        );

        alert(
            result.message ||
            "Purchase deleted successfully."
        );

        await loadPurchases();

    }

    catch (err) {

        console.error(
            "Delete Purchase Error:",
            err
        );

        alert(err.message);

    }

}


// ============================================================
// Close Modal When Clicking Outside
// ============================================================

window.addEventListener("click", event => {

    const modal = byId("purchaseModal");

    if (
        modal &&
        event.target === modal
    ) {

        closePurchaseModal();

    }

});


// ============================================================
// Close Modal With Escape Key
// ============================================================

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        closePurchaseModal();

    }

});

// ============================================================
// Print Purchase Order
// ============================================================

async function printPurchase(id) {

    try {

        const result = await api(
            `${PURCHASE_API}/${id}`,
            {
                method: "GET",
                headers: getHeaders()
            }
        );

        const purchase = result.purchase || {};
        const items = result.items || [];
        const payments = result.payments || [];

        const grandTotal =
            Number(purchase.grand_total || 0);

        const paidAmount =
            getPaidAmount({
                ...purchase,
                payments
            });

        const balanceAmount =
            Math.max(grandTotal - paidAmount, 0);

        const printWindow = window.open(
            "",
            "_blank",
            "width=1000,height=800"
        );

        if (!printWindow) {

            alert(
                "Print window was blocked. Please allow popups for localhost:3000."
            );

            return;

        }

        const itemRows = items.map((item, index) => {

            const quantity =
                Number(item.quantity || 0);

            const unitCost =
                Number(
                    item.unit_cost ||
                    item.cost_price ||
                    item.purchase_price ||
                    0
                );

            const lineTotal =
                Number(
                    item.total_cost ||
                    item.line_total ||
                    quantity * unitCost
                );

            return `
                <tr>
                    <td>${index + 1}</td>

                    <td>
                        ${item.product_name || "Product"}
                    </td>

                    <td class="number">
                        ${quantity}
                    </td>

                    <td class="number">
                        ${formatMoney(unitCost)}
                    </td>

                    <td class="number">
                        ${formatMoney(lineTotal)}
                    </td>
                </tr>
            `;

        }).join("");

        const paymentRows = payments.length
            ? payments.map((payment, index) => `
                <tr>
                    <td>${index + 1}</td>

                    <td>
                        ${formatDate(
                            payment.payment_date ||
                            payment.created_at
                        )}
                    </td>

                    <td>
                        ${payment.payment_method || "-"}
                    </td>

                    <td class="number">
                        ${formatMoney(payment.amount)}
                    </td>

                    <td>
                        ${payment.remarks || "-"}
                    </td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="5" class="empty">
                        No payments recorded
                    </td>
                </tr>
            `;

        const supplierName =
            purchase.supplier_name ||
            purchase.company_name ||
            "Supplier";

        const supplierPhone =
            purchase.supplier_phone ||
            purchase.phone ||
            "-";

        const supplierEmail =
            purchase.supplier_email ||
            purchase.email ||
            "-";

        const supplierAddress =
            purchase.supplier_address ||
            purchase.address ||
            "-";

        const poNumber =
            purchase.po_number ||
            `PO-${purchase.id || id}`;

        const paymentStatus =
            purchase.payment_status ||
            (
                balanceAmount <= 0
                    ? "Paid"
                    : paidAmount > 0
                        ? "Partial"
                        : "Pending"
            );

        const html = `
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <title>
        Purchase Order ${poNumber}
    </title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 30px;
            font-family: Arial, Helvetica, sans-serif;
            color: #222;
            background: #ffffff;
        }

        .document {
            max-width: 900px;
            margin: auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #0d4a36;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }

        .brand h1 {
            margin: 0;
            color: #0d4a36;
            font-size: 30px;
        }

        .brand p {
            margin: 5px 0 0;
            color: #666;
            font-size: 13px;
        }

        .document-title {
            text-align: right;
        }

        .document-title h2 {
            margin: 0;
            color: #0d4a36;
            font-size: 27px;
        }

        .document-title p {
            margin: 6px 0 0;
            font-weight: bold;
        }

        .information-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-bottom: 24px;
        }

        .info-box {
            border: 1px solid #d5d5d5;
            border-radius: 7px;
            padding: 15px;
        }

        .info-box h3 {
            margin: 0 0 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ddd;
            color: #0d4a36;
            font-size: 16px;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin: 7px 0;
            font-size: 13px;
        }

        .info-row span:first-child {
            color: #666;
            font-weight: bold;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
        }

        th {
            padding: 11px 9px;
            background: #0d4a36;
            color: #fff;
            border: 1px solid #0d4a36;
            font-size: 13px;
            text-align: left;
        }

        td {
            padding: 10px 9px;
            border: 1px solid #d8d8d8;
            font-size: 13px;
        }

        .number {
            text-align: right;
        }

        .empty {
            text-align: center;
            color: #777;
        }

        .section-title {
            margin: 22px 0 10px;
            color: #0d4a36;
            font-size: 17px;
        }

        .summary-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 5px;
        }

        .summary-table {
            width: 390px;
        }

        .summary-table td:first-child {
            font-weight: bold;
            color: #555;
        }

        .summary-table .grand-total td {
            background: #0d4a36;
            color: #fff;
            font-size: 15px;
            font-weight: bold;
        }

        .summary-table .balance td {
            background: #f4e2ae;
            font-weight: bold;
        }

        .remarks {
            margin-top: 20px;
            padding: 14px;
            border: 1px solid #ddd;
            border-radius: 6px;
            min-height: 70px;
        }

        .remarks strong {
            color: #0d4a36;
        }

        .signature-area {
            display: flex;
            justify-content: space-between;
            margin-top: 70px;
        }

        .signature {
            width: 220px;
            padding-top: 8px;
            border-top: 1px solid #222;
            text-align: center;
            font-size: 13px;
        }

        .footer {
            margin-top: 35px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #777;
            font-size: 11px;
        }

        .print-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            max-width: 900px;
            margin: 0 auto 20px;
        }

        .print-actions button {
            border: none;
            border-radius: 5px;
            padding: 10px 18px;
            cursor: pointer;
            font-weight: bold;
        }

        .print-button {
            background: #0d4a36;
            color: white;
        }

        .close-button {
            background: #ddd;
            color: #222;
        }

        @media print {

            body {
                padding: 0;
            }

            .print-actions {
                display: none;
            }

            .document {
                max-width: none;
            }

            @page {
                size: A4;
                margin: 14mm;
            }

        }

    </style>

</head>

<body>

    <div class="print-actions">

        <button
            class="close-button"
            onclick="window.close()">

            Close

        </button>

        <button
            class="print-button"
            onclick="window.print()">

            Print Purchase Order

        </button>

    </div>

    <div class="document">

        <div class="header">

            <div class="brand">

                <h1>RUKHNAV ERP</h1>

                <p>
                    Purchase and Inventory Management System
                </p>

            </div>

            <div class="document-title">

                <h2>PURCHASE ORDER</h2>

                <p>${poNumber}</p>

            </div>

        </div>

        <div class="information-grid">

            <div class="info-box">

                <h3>Supplier Information</h3>

                <div class="info-row">
                    <span>Supplier</span>
                    <span>${supplierName}</span>
                </div>

                <div class="info-row">
                    <span>Phone</span>
                    <span>${supplierPhone}</span>
                </div>

                <div class="info-row">
                    <span>Email</span>
                    <span>${supplierEmail}</span>
                </div>

                <div class="info-row">
                    <span>Address</span>
                    <span>${supplierAddress}</span>
                </div>

            </div>

            <div class="info-box">

                <h3>Purchase Information</h3>

                <div class="info-row">
                    <span>Order Date</span>
                    <span>
                        ${formatDate(purchase.order_date)}
                    </span>
                </div>

                <div class="info-row">
                    <span>Expected Date</span>
                    <span>
                        ${formatDate(purchase.expected_date)}
                    </span>
                </div>

                <div class="info-row">
                    <span>Payment Method</span>
                    <span>
                        ${purchase.payment_method || "-"}
                    </span>
                </div>

                <div class="info-row">
                    <span>Payment Status</span>
                    <span>${paymentStatus}</span>
                </div>

                <div class="info-row">
                    <span>Order Status</span>
                    <span>${purchase.status || "Pending"}</span>
                </div>

            </div>

        </div>

        <h3 class="section-title">
            Purchase Items
        </h3>

        <table>

            <thead>

                <tr>
                    <th style="width: 50px;">#</th>
                    <th>Product</th>
                    <th style="width: 90px;">Qty</th>
                    <th style="width: 140px;">Unit Cost</th>
                    <th style="width: 150px;">Total</th>
                </tr>

            </thead>

            <tbody>

                ${
                    itemRows ||
                    `
                    <tr>
                        <td colspan="5" class="empty">
                            No purchase items found
                        </td>
                    </tr>
                    `
                }

            </tbody>

        </table>

        <div class="summary-container">

            <table class="summary-table">

                <tr>
                    <td>Subtotal</td>
                    <td class="number">
                        ${formatMoney(purchase.subtotal)}
                    </td>
                </tr>

                <tr>
                    <td>Discount</td>
                    <td class="number">
                        ${formatMoney(purchase.discount)}
                    </td>
                </tr>

                <tr>
                    <td>Tax</td>
                    <td class="number">
                        ${formatMoney(purchase.tax)}
                    </td>
                </tr>

                <tr>
                    <td>Shipping</td>
                    <td class="number">
                        ${formatMoney(purchase.shipping)}
                    </td>
                </tr>

                <tr class="grand-total">
                    <td>Grand Total</td>
                    <td class="number">
                        ${formatMoney(grandTotal)}
                    </td>
                </tr>

                <tr>
                    <td>Paid Amount</td>
                    <td class="number">
                        ${formatMoney(paidAmount)}
                    </td>
                </tr>

                <tr class="balance">
                    <td>Remaining Balance</td>
                    <td class="number">
                        ${formatMoney(balanceAmount)}
                    </td>
                </tr>

            </table>

        </div>

        <h3 class="section-title">
            Payment History
        </h3>

        <table>

            <thead>

                <tr>
                    <th style="width: 50px;">#</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Remarks</th>
                </tr>

            </thead>

            <tbody>
                ${paymentRows}
            </tbody>

        </table>

        <div class="remarks">

            <strong>Remarks:</strong>

            <div style="margin-top: 8px;">
                ${purchase.remarks || "No remarks"}
            </div>

        </div>

        <div class="signature-area">

            <div class="signature">
                Prepared By
            </div>

            <div class="signature">
                Supplier Signature
            </div>

            <div class="signature">
                Authorized Signature
            </div>

        </div>

        <div class="footer">

            Generated by RUKHNAV ERP on
            ${new Date().toLocaleString()}

        </div>

    </div>

</body>

</html>
        `;

        printWindow.document.open();

        printWindow.document.write(html);

        printWindow.document.close();

        printWindow.focus();

    }

    catch (err) {

        console.error(
            "Print Purchase Error:",
            err
        );

        alert(
            err.message ||
            "Unable to print purchase order."
        );

    }

}

// ============================================================
// Make Functions Available to HTML Buttons
// ============================================================

window.viewPurchase = viewPurchase;
window.editPurchase = editPurchase;
window.receivePurchase = receivePurchase;
window.addPayment = addPayment;
window.printPurchase = printPurchase;
window.deletePurchase = deletePurchase;
window.closePurchaseModal = closePurchaseModal;