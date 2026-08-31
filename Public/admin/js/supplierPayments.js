"use strict";

// ============================================================
// RUKHNAV ERP - Supplier Payments
// ============================================================

const SUPPLIER_PAYMENT_API = "/api/supplier-payments";

const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token");

let supplierPayments = [];
let filteredPayments = [];

let currentPage = 1;
let pageSize = 10;

// ============================================================
// Helpers
// ============================================================

const byId = id =>
    document.getElementById(id);

function formatMoney(value) {
    return `Rs ${Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("en-GB");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getHeaders(json = false) {
    const headers = {
        Accept: "application/json"
    };

    if (json) {
        headers["Content-Type"] =
            "application/json";
    }

    if (token) {
        headers.Authorization =
            token.startsWith("Bearer ")
                ? token
                : `Bearer ${token}`;
    }

    return headers;
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...getHeaders(Boolean(options.body)),
            ...(options.headers || {})
        }
    });

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

function showLoading(show) {
    byId("loadingState")
        ?.classList.toggle(
            "hidden",
            !show
        );
}

function showError(message) {
    showLoading(false);

    byId("tableWrap")
        ?.classList.add("hidden");

    byId("pagination")
        ?.classList.add("hidden");

    const emptyState =
        byId("emptyState");

    if (emptyState) {
        emptyState.classList.remove("hidden");

        const heading =
            emptyState.querySelector("h3");

        const paragraph =
            emptyState.querySelector("p");

        if (heading) {
            heading.textContent =
                "Unable to load supplier payments";
        }

        if (paragraph) {
            paragraph.textContent =
                message ||
                "Please try again.";
        }
    }

    console.error(message);
}

// ============================================================
// Initialization
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        if (!token) {
            alert(
                "Please log in to continue."
            );

            window.location.href =
                "/admin/login.html";

            return;
        }

        registerEvents();

        await loadSupplierPayments();
    }
);

// ============================================================
// Events
// ============================================================

function registerEvents() {
    byId("refreshButton")
        ?.addEventListener(
            "click",
            loadSupplierPayments
        );

    byId("btnNewPayment")
        ?.addEventListener(
            "click",
            openNewPayment
        );

    byId("emptyAddPaymentButton")
        ?.addEventListener(
            "click",
            openNewPayment
        );

    byId("searchInput")
        ?.addEventListener(
            "input",
            applyFilters
        );

    byId("paymentMethodFilter")
        ?.addEventListener(
            "change",
            applyFilters
        );

    byId("dateFrom")
        ?.addEventListener(
            "change",
            applyFilters
        );

    byId("dateTo")
        ?.addEventListener(
            "change",
            applyFilters
        );

    byId("clearFiltersButton")
        ?.addEventListener(
            "click",
            clearFilters
        );

    byId("pageSizeSelect")
        ?.addEventListener(
            "change",
            event => {

                pageSize =
                    Number(event.target.value) ||
                    10;

                currentPage = 1;

                renderPayments();
            }
        );

    byId("prevButton")
        ?.addEventListener(
            "click",
            () => {

                if (currentPage > 1) {
                    currentPage--;
                    renderPayments();
                }
            }
        );

    byId("nextButton")
        ?.addEventListener(
            "click",
            () => {

                if (
                    currentPage <
                    getTotalPages()
                ) {
                    currentPage++;
                    renderPayments();
                }
            }
        );

        byId("purchaseId")
    ?.addEventListener(
        "change",
        handlePurchaseOrderSelection
    );

byId("paymentForm")
    ?.addEventListener(
        "submit",
        saveSupplierPayment
    );

byId("closePaymentModal")
    ?.addEventListener(
        "click",
        closePaymentModal
    );

byId("cancelPaymentButton")
    ?.addEventListener(
        "click",
        closePaymentModal
    );

document
    .querySelectorAll(
        "[data-close-payment-modal]"
    )
    .forEach(element => {
        element.addEventListener(
            "click",
            closePaymentModal
        );
    });

document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Escape") {
            closePaymentModal();
        }
    }
);
}

// ============================================================
// Load Supplier Payments
// ============================================================

async function loadSupplierPayments() {
    showLoading(true);

    byId("emptyState")
        ?.classList.add("hidden");

    byId("tableWrap")
        ?.classList.add("hidden");

    byId("pagination")
        ?.classList.add("hidden");

    try {
        const result = await api(
            SUPPLIER_PAYMENT_API,
            {
                method: "GET"
            }
        );

        supplierPayments =
            result.supplier_payments ||
            result.supplierPayments ||
            result.payments ||
            result.data ||
            [];

        if (
            !Array.isArray(
                supplierPayments
            )
        ) {
            supplierPayments = [];
        }

        filteredPayments =
            [...supplierPayments];

        currentPage = 1;

        updateSummary();
        renderPayments();

    } catch (error) {
        showError(error.message);

    } finally {
        showLoading(false);
    }
}

// ============================================================
// Summary Cards
// ============================================================

function updateSummary() {
    const totalPayments =
        supplierPayments.length;

    const totalPaid =
        supplierPayments.reduce(
            (sum, payment) =>
                sum +
                Number(
                    payment.amount || 0
                ),
            0
        );

    const now =
        new Date();

    const paidThisMonth =
        supplierPayments.reduce(
            (sum, payment) => {

                if (!payment.payment_date) {
                    return sum;
                }

                const date =
                    new Date(
                        payment.payment_date
                    );

                if (
                    date.getMonth() ===
                        now.getMonth() &&
                    date.getFullYear() ===
                        now.getFullYear()
                ) {
                    return (
                        sum +
                        Number(
                            payment.amount || 0
                        )
                    );
                }

                return sum;
            },
            0
        );

    byId("totalPayments").textContent =
        totalPayments.toLocaleString();

    byId("totalPaid").textContent =
        formatMoney(totalPaid);

    byId("paidThisMonth").textContent =
        formatMoney(paidThisMonth);

    /*
     * The current GET /api/supplier-payments response
     * does not include outstanding purchase balances.
     * Keep these at zero until we connect the
     * /summary or /outstanding endpoint.
     */
    byId("outstandingBalance").textContent =
        formatMoney(0);

    if (byId("unpaidOrdersText")) {
        byId("unpaidOrdersText").textContent =
            "0 unpaid purchase orders";
    }
}

// ============================================================
// Filters
// ============================================================

function applyFilters() {
    const keyword =
        String(
            byId("searchInput")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const method =
        String(
            byId("paymentMethodFilter")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const dateFrom =
        byId("dateFrom")
            ?.value || "";

    const dateTo =
        byId("dateTo")
            ?.value || "";

    filteredPayments =
        supplierPayments.filter(
            payment => {

                const searchableText = [
                    payment.payment_number,
                    payment.supplier_name,
                    payment.po_number,
                    payment.payment_method,
                    payment.reference_no,
                    payment.remarks,
                    payment.status,
                    payment.created_by_name
                ]
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !keyword ||
                    searchableText.includes(
                        keyword
                    );

                const matchesMethod =
                    !method ||
                    String(
                        payment.payment_method ||
                        ""
                    )
                        .toLowerCase() ===
                    method;

                const paymentDate =
                    payment.payment_date
                        ? String(
                            payment.payment_date
                        ).slice(0, 10)
                        : "";

                const matchesFrom =
                    !dateFrom ||
                    (
                        paymentDate &&
                        paymentDate >=
                            dateFrom
                    );

                const matchesTo =
                    !dateTo ||
                    (
                        paymentDate &&
                        paymentDate <=
                            dateTo
                    );

                return (
                    matchesSearch &&
                    matchesMethod &&
                    matchesFrom &&
                    matchesTo
                );
            }
        );

    currentPage = 1;

    renderPayments();
}

function clearFilters() {
    if (byId("searchInput")) {
        byId("searchInput").value =
            "";
    }

    if (byId("paymentMethodFilter")) {
        byId(
            "paymentMethodFilter"
        ).value = "";
    }

    if (byId("dateFrom")) {
        byId("dateFrom").value =
            "";
    }

    if (byId("dateTo")) {
        byId("dateTo").value =
            "";
    }

    applyFilters();
}

// ============================================================
// Pagination
// ============================================================

function getTotalPages() {
    return Math.max(
        1,
        Math.ceil(
            filteredPayments.length /
            pageSize
        )
    );
}

// ============================================================
// Render Table
// ============================================================

function renderPayments() {
    const tableBody =
        byId("paymentTableBody");

    if (!tableBody) {
        console.error(
            "paymentTableBody was not found."
        );

        return;
    }

    const hasPayments =
        filteredPayments.length > 0;

    byId("emptyState")
        ?.classList.toggle(
            "hidden",
            hasPayments
        );

    byId("tableWrap")
        ?.classList.toggle(
            "hidden",
            !hasPayments
        );

    byId("pagination")
        ?.classList.toggle(
            "hidden",
            !hasPayments
        );

    tableBody.innerHTML = "";

    if (!hasPayments) {
        return;
    }

    const totalPages =
        getTotalPages();

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex =
        (currentPage - 1) *
        pageSize;

    const pagePayments =
        filteredPayments.slice(
            startIndex,
            startIndex + pageSize
        );

    pagePayments.forEach(
        (payment, index) => {

            const row =
                document.createElement(
                    "tr"
                );

            const status =
                payment.status ||
                "Posted";

            row.innerHTML = `
                <td>
                    ${startIndex + index + 1}
                </td>

                <td>
                    ${formatDate(
                        payment.payment_date
                    )}
                </td>

                <td>
                    <div class="payment-supplier-name">
                        ${escapeHtml(
                            payment.supplier_name ||
                            "Unknown Supplier"
                        )}
                    </div>

                    <div class="payment-supplier-sub">
                        ${escapeHtml(
                            payment.payment_number ||
                            ""
                        )}
                    </div>
                </td>

                <td>
                    <div class="po-number">
                        ${escapeHtml(
                            payment.po_number ||
                            `PO #${
                                payment.purchase_order_id ||
                                "-"
                            }`
                        )}
                    </div>
                </td>

                <td>
                    <span class="method-badge">
                        ${escapeHtml(
                            payment.payment_method ||
                            "Cash"
                        )}
                    </span>
                </td>

                <td>
                    <strong class="payment-amount">
                        ${formatMoney(
                            payment.amount
                        )}
                    </strong>
                </td>

                <td>
                    ${formatMoney(
                        payment.balance_amount ||
                        0
                    )}
                </td>

                <td>
                    <span class="status-badge status-posted">
                        ${escapeHtml(status)}
                    </span>
                </td>

                <td>
                    <div class="action-buttons">

                        <button
                            type="button"
                            class="action-btn view-btn"
                            title="View Payment"
                            onclick="
                                window.viewSupplierPayment(
                                    ${Number(payment.id)}
                                )
                            "
                        >
                            <i class="fa-solid fa-eye"></i>
                        </button>

                        <button
                            type="button"
                            class="action-btn print-btn"
                            title="Print Payment Voucher"
                            onclick="
                                window.printSupplierPayment(
                                    ${Number(payment.id)}
                                )
                            "
                        >
                            <i class="fa-solid fa-print"></i>
                        </button>

                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        }
    );

    updatePagination();
}

function updatePagination() {
    const totalEntries =
        filteredPayments.length;

    const start =
        totalEntries === 0
            ? 0
            : (
                (currentPage - 1) *
                pageSize
            ) + 1;

    const end =
        Math.min(
            currentPage *
                pageSize,
            totalEntries
        );

    if (byId("paginationInfo")) {
        byId(
            "paginationInfo"
        ).textContent =
            `Showing ${start} to ${end} of ${totalEntries} entries`;
    }

    if (byId("pageNumber")) {
        byId("pageNumber").textContent =
            currentPage;
    }

    if (byId("prevButton")) {
        byId("prevButton").disabled =
            currentPage <= 1;
    }

    if (byId("nextButton")) {
        byId("nextButton").disabled =
            currentPage >=
            getTotalPages();
    }
}

// ============================================================
// Actions
// ============================================================

// ============================================================
// Outstanding Purchase Orders
// ============================================================

let outstandingPurchases = [];
let selectedPurchaseOrder = null;

async function loadOutstandingPurchases() {
    const result = await api(
        "/api/purchases",
        {
            method: "GET"
        }
    );

    const purchases =
        result.orders ||
        result.purchases ||
        result.data ||
        [];

    outstandingPurchases =
        Array.isArray(purchases)
            ? purchases.filter(order => {
                const status =
                    String(
                        order.status ||
                        order.order_status ||
                        ""
                    ).trim();

                const balance =
                    Number(
                        order.balance_amount ??
                        (
                            Number(
                                order.grand_total || 0
                            ) -
                            Number(
                                order.paid_amount || 0
                            )
                        )
                    );

                return (
                    ![
                        "Draft",
                        "Cancelled"
                    ].includes(status) &&
                    balance > 0
                );
            })
            : [];

    populateOutstandingPurchaseOrders();
}

function populateOutstandingPurchaseOrders() {
    const select =
        byId("purchaseId");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Select purchase order
        </option>
    `;

    outstandingPurchases.forEach(order => {
        const total =
            Number(
                order.grand_total || 0
            );

        const paid =
            Number(
                order.paid_amount || 0
            );

        const balance =
            Number(
                order.balance_amount ??
                Math.max(total - paid, 0)
            );

        const option =
            document.createElement(
                "option"
            );

        option.value =
            String(order.id);

        option.textContent =
            `${
                order.po_number ||
                `PO-${order.id}`
            } — ${
                order.supplier_name ||
                "Unknown Supplier"
            } — Balance ${
                formatMoney(balance)
            }`;

        select.appendChild(option);
    });
}

// ============================================================
// Open New Payment Modal
// ============================================================

async function openNewPayment() {
    const modal =
        byId("paymentModal");

    if (!modal) {
        alert(
            "The Supplier Payment modal was not found."
        );

        return;
    }

    resetPaymentForm();

    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );

    try {
        const select =
            byId("purchaseId");

        if (select) {
            select.innerHTML = `
                <option value="">
                    Loading outstanding purchase orders...
                </option>
            `;
        }

        await loadOutstandingPurchases();

        if (
            outstandingPurchases.length === 0
        ) {
            if (select) {
                select.innerHTML = `
                    <option value="">
                        No outstanding purchase orders found
                    </option>
                `;
            }
        }
    } catch (error) {
        console.error(
            "Load outstanding purchases error:",
            error
        );

        const select =
            byId("purchaseId");

        if (select) {
            select.innerHTML = `
                <option value="">
                    Unable to load purchase orders
                </option>
            `;
        }

        alert(error.message);
    }
}

// ============================================================
// Close Payment Modal
// ============================================================

function closePaymentModal() {
    const modal =
        byId("paymentModal");

    if (!modal) {
        return;
    }

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

    resetPaymentForm();
}

// ============================================================
// Reset Payment Form
// ============================================================

function resetPaymentForm() {
    byId("paymentForm")
        ?.reset();

    selectedPurchaseOrder =
        null;

    if (byId("supplierName")) {
        byId("supplierName").value =
            "";
    }

    if (byId("poNumber")) {
        byId("poNumber").value =
            "";
    }

    if (byId("purchaseTotal")) {
        byId("purchaseTotal").value =
            formatMoney(0);
    }

    if (byId("alreadyPaid")) {
        byId("alreadyPaid").value =
            formatMoney(0);
    }

    if (byId("remainingBalance")) {
        byId("remainingBalance").value =
            formatMoney(0);
    }

    if (byId("paymentAmount")) {
        byId("paymentAmount").value =
            "";

        byId("paymentAmount")
            .removeAttribute("max");
    }

    if (byId("paymentDate")) {
        byId("paymentDate").value =
            new Date()
                .toISOString()
                .slice(0, 10);
    }

    if (byId("paymentMethod")) {
        byId("paymentMethod").value =
            "Cash";
    }
}

// ============================================================
// Select Purchase Order
// ============================================================

function handlePurchaseOrderSelection() {
    const purchaseOrderId =
        Number(
            byId("purchaseId")
                ?.value || 0
        );

    selectedPurchaseOrder =
        outstandingPurchases.find(
            order =>
                Number(order.id) ===
                purchaseOrderId
        ) || null;

    if (!selectedPurchaseOrder) {
        if (byId("supplierName")) {
            byId("supplierName").value =
                "";
        }

        if (byId("poNumber")) {
            byId("poNumber").value =
                "";
        }

        if (byId("purchaseTotal")) {
            byId("purchaseTotal").value =
                formatMoney(0);
        }

        if (byId("alreadyPaid")) {
            byId("alreadyPaid").value =
                formatMoney(0);
        }

        if (byId("remainingBalance")) {
            byId("remainingBalance").value =
                formatMoney(0);
        }

        if (byId("paymentAmount")) {
            byId("paymentAmount").value =
                "";

            byId("paymentAmount")
                .removeAttribute("max");
        }

        return;
    }

    const total =
        Number(
            selectedPurchaseOrder
                .grand_total || 0
        );

    const paid =
        Number(
            selectedPurchaseOrder
                .paid_amount || 0
        );

    const balance =
        Number(
            selectedPurchaseOrder
                .balance_amount ??
            Math.max(total - paid, 0)
        );

    if (byId("supplierName")) {
        byId("supplierName").value =
            selectedPurchaseOrder
                .supplier_name || "";
    }

    if (byId("poNumber")) {
        byId("poNumber").value =
            selectedPurchaseOrder
                .po_number ||
            `PO-${selectedPurchaseOrder.id}`;
    }

    if (byId("purchaseTotal")) {
        byId("purchaseTotal").value =
            formatMoney(total);
    }

    if (byId("alreadyPaid")) {
        byId("alreadyPaid").value =
            formatMoney(paid);
    }

    if (byId("remainingBalance")) {
        byId("remainingBalance").value =
            formatMoney(balance);
    }

    if (byId("paymentAmount")) {
        byId("paymentAmount").value =
            balance.toFixed(2);

        byId("paymentAmount").max =
            String(balance);
    }
}

// ============================================================
// Save Supplier Payment
// ============================================================

async function saveSupplierPayment(event) {
    event.preventDefault();

    if (!selectedPurchaseOrder) {
        alert(
            "Please select an outstanding purchase order."
        );

        return;
    }

    const purchaseOrderId =
        Number(
            selectedPurchaseOrder.id
        );

    const supplierId =
        Number(
            selectedPurchaseOrder
                .supplier_id
        );

    const paymentDate =
        byId("paymentDate")
            ?.value;

    const paymentMethod =
        byId("paymentMethod")
            ?.value;

    const amount =
        Number(
            byId("paymentAmount")
                ?.value || 0
        );

    const remarks =
        byId("paymentRemarks")
            ?.value
            ?.trim() || null;

    const total =
        Number(
            selectedPurchaseOrder
                .grand_total || 0
        );

    const paid =
        Number(
            selectedPurchaseOrder
                .paid_amount || 0
        );

    const outstandingBalance =
        Number(
            selectedPurchaseOrder
                .balance_amount ??
            Math.max(total - paid, 0)
        );

    if (!paymentDate) {
        alert(
            "Payment date is required."
        );

        return;
    }

    if (!paymentMethod) {
        alert(
            "Payment method is required."
        );

        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        alert(
            "Payment amount must be greater than zero."
        );

        return;
    }

    if (amount > outstandingBalance) {
        alert(
            `Payment amount cannot exceed ${formatMoney(
                outstandingBalance
            )}.`
        );

        return;
    }

    let referenceNo = null;
    let chequeNumber = null;
    let chequeDate = null;

    if (
        paymentMethod ===
        "Bank Transfer"
    ) {
        referenceNo =
            prompt(
                "Enter bank-transfer reference number:"
            )?.trim() || null;

        if (!referenceNo) {
            alert(
                "Reference number is required for a bank transfer."
            );

            return;
        }
    }

    if (
        paymentMethod ===
        "Cheque"
    ) {
        chequeNumber =
            prompt(
                "Enter cheque number:"
            )?.trim() || null;

        if (!chequeNumber) {
            alert(
                "Cheque number is required."
            );

            return;
        }

        chequeDate =
            prompt(
                "Enter cheque date in YYYY-MM-DD format:"
            )?.trim() || null;

        if (!chequeDate) {
            alert(
                "Cheque date is required."
            );

            return;
        }
    }

    const saveButton =
        byId("savePaymentButton");

    const originalHtml =
        saveButton?.innerHTML;

    if (saveButton) {
        saveButton.disabled =
            true;

        saveButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Posting Payment...
        `;
    }

    try {
        const result = await api(
            SUPPLIER_PAYMENT_API,
            {
                method: "POST",

                body: JSON.stringify({
                    purchase_order_id:
                        purchaseOrderId,

                    supplier_id:
                        supplierId,

                    payment_date:
                        paymentDate,

                    payment_method:
                        paymentMethod,

                    amount,

                    reference_no:
                        referenceNo,

                    cheque_number:
                        chequeNumber,

                    cheque_date:
                        chequeDate,

                    remarks
                })
            }
        );

        alert(
            result.message ||
            "Supplier payment posted successfully."
        );

        closePaymentModal();

        await loadSupplierPayments();

    } catch (error) {
        console.error(
            "Save supplier payment error:",
            error
        );

        alert(error.message);

    } finally {
        if (saveButton) {
            saveButton.disabled =
                false;

            saveButton.innerHTML =
                originalHtml;
        }
    }
}

function viewSupplierPayment(id) {
    const payment =
        supplierPayments.find(
            item =>
                Number(item.id) ===
                Number(id)
        );

    if (!payment) {
        alert(
            "Supplier payment was not found."
        );

        return;
    }

    alert(
        [
            `Payment: ${
                payment.payment_number ||
                id
            }`,
            `Supplier: ${
                payment.supplier_name ||
                "-"
            }`,
            `Purchase Order: ${
                payment.po_number ||
                "-"
            }`,
            `Date: ${
                formatDate(
                    payment.payment_date
                )
            }`,
            `Method: ${
                payment.payment_method ||
                "-"
            }`,
            `Amount: ${
                formatMoney(
                    payment.amount
                )
            }`,
            `Status: ${
                payment.status ||
                "-"
            }`,
            `Reference: ${
                payment.reference_no ||
                "-"
            }`,
            `Remarks: ${
                payment.remarks ||
                "-"
            }`
        ].join("\n")
    );
}

function printSupplierPayment(id) {
    const payment =
        supplierPayments.find(
            item =>
                Number(item.id) ===
                Number(id)
        );

    if (!payment) {
        alert(
            "Supplier payment was not found."
        );

        return;
    }

    const printWindow =
        window.open(
            "",
            "_blank",
            "width=900,height=750"
        );

    if (!printWindow) {
        alert(
            "Please allow popups for localhost:3000."
        );

        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">

        <head>
            <meta charset="UTF-8">

            <title>
                Payment Voucher
                ${escapeHtml(
                    payment.payment_number ||
                    id
                )}
            </title>

            <style>
                body {
                    padding: 35px;
                    font-family:
                        Arial,
                        sans-serif;
                    color: #1f2937;
                }

                .header {
                    display: flex;
                    justify-content:
                        space-between;
                    border-bottom:
                        3px solid #0b6e4f;
                    padding-bottom: 18px;
                    margin-bottom: 25px;
                }

                h1 {
                    margin: 0;
                    color: #0b6e4f;
                }

                .voucher {
                    margin-top: 20px;
                    border:
                        1px solid #d1d5db;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .row {
                    display: grid;
                    grid-template-columns:
                        220px 1fr;
                    border-bottom:
                        1px solid #e5e7eb;
                }

                .row:last-child {
                    border-bottom: 0;
                }

                .label,
                .value {
                    padding: 13px 15px;
                }

                .label {
                    background: #f3f4f6;
                    font-weight: bold;
                }

                .amount {
                    color: #0b6e4f;
                    font-size: 22px;
                    font-weight: bold;
                }

                .signature-area {
                    display: grid;
                    grid-template-columns:
                        repeat(3, 1fr);
                    gap: 35px;
                    margin-top: 80px;
                }

                .signature {
                    padding-top: 8px;
                    border-top:
                        1px solid #111827;
                    text-align: center;
                    font-size: 12px;
                    font-weight: bold;
                }

                .print-actions {
                    margin-bottom: 20px;
                    text-align: right;
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
                <button onclick="window.print()">
                    Print
                </button>

                <button onclick="window.close()">
                    Close
                </button>
            </div>

            <div class="header">
                <div>
                    <h1>RUKHNAV ERP</h1>
                    <p>Supplier Payment Voucher</p>
                </div>

                <div>
                    <strong>
                        ${escapeHtml(
                            payment.payment_number ||
                            `PAY-${id}`
                        )}
                    </strong>

                    <p>
                        ${formatDate(
                            payment.payment_date
                        )}
                    </p>
                </div>
            </div>

            <div class="voucher">

                <div class="row">
                    <div class="label">
                        Supplier
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.supplier_name ||
                            "-"
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Purchase Order
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.po_number ||
                            "-"
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Payment Method
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.payment_method ||
                            "-"
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Amount
                    </div>

                    <div class="value amount">
                        ${formatMoney(
                            payment.amount
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Reference Number
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.reference_no ||
                            "-"
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Status
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.status ||
                            "-"
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Remarks
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.remarks ||
                            "-"
                        )}
                    </div>
                </div>

                <div class="row">
                    <div class="label">
                        Created By
                    </div>

                    <div class="value">
                        ${escapeHtml(
                            payment.created_by_name ||
                            "-"
                        )}
                    </div>
                </div>

            </div>

            <div class="signature-area">
                <div class="signature">
                    Prepared By
                </div>

                <div class="signature">
                    Supplier Representative
                </div>

                <div class="signature">
                    Authorized By
                </div>
            </div>

        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
}

// ============================================================
// Global Functions
// ============================================================

window.viewSupplierPayment =
    viewSupplierPayment;

window.printSupplierPayment =
    printSupplierPayment;

window.openNewPayment =
    openNewPayment;

window.closePaymentModal =
    closePaymentModal;