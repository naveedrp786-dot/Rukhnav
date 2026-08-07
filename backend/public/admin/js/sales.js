"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const API = {
    sales: RUKHNAV_ORIGIN + "/api/sales",
    products: RUKHNAV_ORIGIN + "/api/products",
    customers: RUKHNAV_ORIGIN + "/api/admin/customers"
};

const TOKEN_KEYS = [
    "adminToken",
    "admin_token",
    "token"
];

const state = {
    products: [],
    customers: [],
    sales: [],
    cart: [],
    selectedCustomer: null,
    currentSale: null
};

const $ = id =>
    document.getElementById(id);

function getToken() {
    for (const key of TOKEN_KEYS) {
        const value =
            localStorage.getItem(key) ||
            sessionStorage.getItem(key);

        if (value) {
            return value;
        }
    }

    return null;
}

const token = getToken();

if (!token) {
    window.location.href =
        "login.html";
}

async function fetchJson(
    url,
    options = {}
) {
    const response =
        await fetch(
            url,
            {
                ...options,
                headers: {
                    "Content-Type":
                        "application/json",
                    Accept:
                        "application/json",
                    Authorization:
                        token.startsWith(
                            "Bearer "
                        )
                            ? token
                            : `Bearer ${token}`,
                    ...(options.headers || {})
                }
            }
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch (_) {
        data = {};
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        TOKEN_KEYS.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });

        window.location.href =
            "login.html";

        throw new Error(
            "Your admin session has expired."
        );
    }

    if (
        !response.ok ||
        data.success === false
    ) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

const toNumber = value =>
    Number.isFinite(Number(value))
        ? Number(value)
        : 0;

const money = value =>
    new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 2
        }
    ).format(toNumber(value));

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    return Number.isNaN(
        parsed.getTime()
    )
        ? "—"
        : parsed.toLocaleDateString(
            "en-GB",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );
};

const escapeHtml = value => {
    const div =
        document.createElement("div");

    div.textContent =
        value == null
            ? ""
            : String(value);

    return div.innerHTML;
};

const slug = value =>
    String(value || "pending")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

let messageTimer;

function showMessage(
    text,
    type = "info",
    autoHide = true
) {
    const element =
        $("salesMessage");

    clearTimeout(
        messageTimer
    );

    element.textContent =
        text;

    element.className =
        `sales-message show ${type}`;

    if (autoHide) {
        messageTimer =
            setTimeout(
                () => {
                    element.textContent = "";
                    element.className =
                        "sales-message";
                },
                4500
            );
    }
}


function setButtonLoading(
    button,
    loading,
    text = "Please wait"
) {
    if (!button) {
        return;
    }

    if (loading) {
        button.dataset.originalHtml =
            button.innerHTML;

        button.disabled = true;
        button.innerHTML =
            `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(text)}`;
    } else {
        button.disabled = false;

        if (
            button.dataset.originalHtml
        ) {
            button.innerHTML =
                button.dataset.originalHtml;

            delete button.dataset
                .originalHtml;
        }
    }
}

function extractArray(
    data,
    keys
) {
    if (Array.isArray(data)) {
        return data;
    }

    for (const key of keys) {
        if (
            Array.isArray(
                data?.[key]
            )
        ) {
            return data[key];
        }
    }

    return [];
}

async function loadProducts() {
    const data =
        await fetchJson(
            API.products
        );

    state.products =
        extractArray(
            data,
            [
                "products",
                "data",
                "rows"
            ]
        );
}

async function loadCustomers() {
    const data =
        await fetchJson(
            `${API.customers}?page=1&limit=500`
        );

    state.customers =
        extractArray(
            data,
            [
                "customers",
                "data",
                "rows"
            ]
        );
}

async function loadSales() {
    $("salesLoading")
        .classList.remove(
            "hidden"
        );

    $("salesTableWrapper")
        .classList.add(
            "hidden"
        );

    $("salesEmptyState")
        .classList.add(
            "hidden"
        );

    try {
        const data =
            await fetchJson(
                API.sales
            );

        state.sales =
            extractArray(
                data,
                ["sales"]
            );

        renderSales();
    } catch (error) {
        $("salesLoading")
            .classList.add(
                "hidden"
            );

        $("salesEmptyState")
            .classList.remove(
                "hidden"
            );

        showMessage(
            error.message,
            "error",
            false
        );
    }
}

function renderSales() {
    const keyword =
        $("salesSearch")
            .value
            .trim()
            .toLowerCase();

    const rows =
        state.sales.filter(
            sale =>
                [
                    sale.sale_number,
                    sale.full_name,
                    sale.payment_status,
                    sale.sale_status
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(keyword)
        );

    $("salesLoading")
        .classList.add(
            "hidden"
        );

    if (!rows.length) {
        $("salesTableWrapper")
            .classList.add(
                "hidden"
            );

        $("salesEmptyState")
            .classList.remove(
                "hidden"
            );

        $("salesResultText")
            .textContent =
            "No sales found.";

        return;
    }

    $("salesEmptyState")
        .classList.add(
            "hidden"
        );

    $("salesTableWrapper")
        .classList.remove(
            "hidden"
        );

    $("salesResultText")
        .textContent =
        `${rows.length} sale record(s) found.`;

    $("salesTableBody")
        .innerHTML =
        rows.map(sale => `
            <tr>
                <td>
                    <strong>${escapeHtml(
                        sale.sale_number ||
                        `Sale #${sale.id}`
                    )}</strong>
                </td>
                <td>${escapeHtml(
                    sale.full_name ||
                    "Unknown Customer"
                )}</td>
                <td>${formatDate(
                    sale.sale_date ||
                    sale.created_at
                )}</td>
                <td><strong>${money(
                    sale.grand_total
                )}</strong></td>
                <td>
                    <span class="status-badge status-${slug(
                        sale.payment_status
                    )}">
                        ${escapeHtml(
                            sale.payment_status ||
                            "Pending"
                        )}
                    </span>
                </td>
                <td>
                    <span class="status-badge status-${slug(
                        sale.sale_status
                    )}">
                        ${escapeHtml(
                            sale.sale_status ||
                            "Unknown"
                        )}
                    </span>
                </td>
                <td class="actions-column">
                    <div class="sales-actions">
                        <button
                            type="button"
                            class="action-button"
                            data-action="view"
                            data-id="${escapeHtml(
                                sale.id
                            )}"
                            title="View sale"
                        >
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join("");
}

function renderCustomerResults(
    keyword
) {
    const target =
        $("customerResults");

    const query =
        keyword
            .trim()
            .toLowerCase();

    if (!query) {
        target.classList.add(
            "hidden"
        );
        return;
    }

    const rows =
        state.customers
            .filter(customer =>
                [
                    customer.full_name,
                    customer.email,
                    customer.phone
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query)
            )
            .slice(0, 12);

    target.innerHTML =
        rows.length
            ? rows.map(customer => `
                <div
                    class="search-result-item"
                    data-customer-id="${escapeHtml(
                        customer.id
                    )}"
                >
                    <strong>${escapeHtml(
                        customer.full_name
                    )}</strong>
                    <small>${escapeHtml(
                        customer.email ||
                        customer.phone ||
                        "No contact"
                    )}</small>
                </div>
            `).join("")
            : `
                <div class="search-result-item">
                    <small>No customers found.</small>
                </div>
            `;

    target.classList.remove(
        "hidden"
    );
}

function selectCustomer(id) {
    const customer =
        state.customers.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!customer) {
        return;
    }

    state.selectedCustomer =
        customer;

    $("customerSearch").value =
        customer.full_name;

    $("customerResults")
        .classList.add(
            "hidden"
        );

    $("selectedCustomer")
        .innerHTML = `
            <strong>${escapeHtml(
                customer.full_name
            )}</strong>
            <small>${escapeHtml(
                customer.email ||
                customer.phone ||
                "No contact"
            )}</small>
        `;

    $("selectedCustomer")
        .classList.remove(
            "hidden"
        );
}

function renderProductResults(
    keyword
) {
    const target =
        $("productResults");

    const query =
        keyword
            .trim()
            .toLowerCase();

    if (!query) {
        target.classList.add(
            "hidden"
        );
        return;
    }

    const rows =
        state.products
            .filter(product =>
                [
                    product.product_name,
                    product.category
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(query)
            )
            .slice(0, 15);

    target.innerHTML =
        rows.length
            ? rows.map(product => `
                <div
                    class="search-result-item"
                    data-product-id="${escapeHtml(
                        product.id
                    )}"
                >
                    <strong>${escapeHtml(
                        product.product_name
                    )}</strong>
                    <small>
                        ${money(
                            product.selling_price
                        )}
                        · Stock:
                        ${escapeHtml(
                            product.stock_quantity
                        )}
                    </small>
                </div>
            `).join("")
            : `
                <div class="search-result-item">
                    <small>No products found.</small>
                </div>
            `;

    target.classList.remove(
        "hidden"
    );
}

function addProduct(id) {
    const product =
        state.products.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!product) {
        return;
    }

    const stock =
        toNumber(
            product.stock_quantity
        );

    if (stock < 1) {
        showMessage(
            "This product is out of stock.",
            "error"
        );
        return;
    }

    const existing =
        state.cart.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (existing) {
        if (
            existing.quantity >=
            stock
        ) {
            showMessage(
                "You cannot add more than the available stock.",
                "error"
            );
            return;
        }

        existing.quantity += 1;
    } else {
        state.cart.push({
            id:
                product.id,
            product_name:
                product.product_name,
            selling_price:
                toNumber(
                    product.selling_price
                ),
            stock_quantity:
                stock,
            quantity:
                1
        });
    }

    $("productSearch").value =
        "";

    $("productResults")
        .classList.add(
            "hidden"
        );

    renderCart();
}

function renderCart() {
    const body =
        $("saleCartBody");

    const empty =
        $("saleCartEmpty");

    if (!state.cart.length) {
        body.innerHTML = "";
        empty.classList.remove(
            "hidden"
        );
        calculateTotals();
        return;
    }

    empty.classList.add(
        "hidden"
    );

    body.innerHTML =
        state.cart.map(item => `
            <tr>
                <td>
                    <strong>${escapeHtml(
                        item.product_name
                    )}</strong>
                </td>
                <td>${money(
                    item.selling_price
                )}</td>
                <td>${item.stock_quantity}</td>
                <td>
                    <input
                        type="number"
                        class="qty-input"
                        min="1"
                        max="${item.stock_quantity}"
                        value="${item.quantity}"
                        data-qty-id="${item.id}"
                    >
                </td>
                <td><strong>${money(
                    item.selling_price *
                    item.quantity
                )}</strong></td>
                <td>
                    <button
                        type="button"
                        class="remove-item-btn"
                        data-remove-id="${item.id}"
                        title="Remove"
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join("");

    calculateTotals();
}

function calculateTotals() {
    const subtotal =
        state.cart.reduce(
            (
                total,
                item
            ) =>
                total +
                item.selling_price *
                item.quantity,
            0
        );

    const discount =
        Math.max(
            0,
            toNumber(
                $("saleDiscount").value
            )
        );

    const tax =
        Math.max(
            0,
            toNumber(
                $("saleTax").value
            )
        );

    const total =
        Math.max(
            0,
            subtotal -
            discount +
            tax
        );

    const paid =
        Math.max(
            0,
            Math.min(
                total,
                toNumber(
                    $("paymentAmount").value
                )
            )
        );

    const balance =
        Math.max(
            0,
            total -
            paid
        );

    $("subtotalValue")
        .textContent =
        money(subtotal);

    $("discountValue")
        .textContent =
        money(discount);

    $("taxValue")
        .textContent =
        money(tax);

    $("grandTotalValue")
        .textContent =
        money(total);

    $("paidValue")
        .textContent =
        money(paid);

    $("balanceValue")
        .textContent =
        money(balance);

    return {
        subtotal,
        discount,
        tax,
        total,
        paid,
        balance
    };
}

async function completeSale() {
    if (!state.selectedCustomer) {
        showMessage(
            "Please select a customer.",
            "error"
        );
        return;
    }

    if (!state.cart.length) {
        showMessage(
            "Please add at least one product.",
            "error"
        );
        return;
    }

    const totals =
        calculateTotals();

    if (
        totals.discount >
        totals.subtotal +
        totals.tax
    ) {
        showMessage(
            "Discount cannot exceed subtotal plus tax.",
            "error"
        );
        return;
    }

    const button =
        $("completeSaleBtn");

    setButtonLoading(
        button,
        true,
        "Completing Sale"
    );

    try {
        const data =
            await fetchJson(
                API.sales,
                {
                    method: "POST",
                    body:
                        JSON.stringify({
                            customer_id:
                                state.selectedCustomer.id,
                            items:
                                state.cart.map(
                                    item => ({
                                        product_id:
                                            item.id,
                                        quantity:
                                            item.quantity
                                    })
                                ),
                            discount:
                                totals.discount,
                            tax:
                                totals.tax,
                            payment_method:
                                $("paymentMethod").value,
                            payment_amount:
                                totals.paid,
                            remarks:
                                $("saleRemarks")
                                    .value
                                    .trim()
                        })
                }
            );

        showMessage(
            data.message ||
            "Sale completed successfully.",
            "success"
        );

        resetSaleForm();

        await Promise.all([
            loadProducts(),
            loadSales()
        ]);
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to complete sale.",
            "error",
            false
        );
    } finally {
        setButtonLoading(
            button,
            false
        );
    }
}

function resetSaleForm() {
    state.cart = [];
    state.selectedCustomer =
        null;

    $("customerSearch").value =
        "";

    $("selectedCustomer")
        .classList.add(
            "hidden"
        );

    $("saleDiscount").value =
        "0";

    $("saleTax").value =
        "0";

    $("paymentMethod").value =
        "Cash";

    $("paymentAmount").value =
        "0";

    $("saleRemarks").value =
        "";

    renderCart();
}

function openModal() {
    $("saleDetailsModal")
        .classList.add(
            "open"
        );

    $("saleDetailsModal")
        .setAttribute(
            "aria-hidden",
            "false"
        );

    document.body.style.overflow =
        "hidden";
}

function closeModal() {
    $("saleDetailsModal")
        .classList.remove(
            "open"
        );

    $("saleDetailsModal")
        .setAttribute(
            "aria-hidden",
            "true"
        );

    document.body.style.overflow =
        "";
}

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent =
            value == null ||
            value === ""
                ? "—"
                : String(value);
    }
}

async function openSaleDetails(id) {
    openModal();

    $("saleDetailsLoading")
        .classList.remove(
            "hidden"
        );

    $("saleDetailsContent")
        .classList.add(
            "hidden"
        );

    try {
        const data =
            await fetchJson(
                `${API.sales}/${encodeURIComponent(
                    id
                )}`
            );

        const sale =
            data.sale || {};

        state.currentSale =
            sale;

        setText(
            "detailsSaleNumber",
            sale.sale_number ||
            `Sale #${sale.id}`
        );

        setText(
            "detailsCustomerName",
            sale.full_name
        );

        setText(
            "detailsCustomerContact",
            sale.email ||
            sale.phone
        );

        setText(
            "detailsSaleDate",
            formatDate(
                sale.sale_date ||
                sale.created_at
            )
        );

        setText(
            "detailsPaymentMethod",
            sale.payment_method
        );

        setText(
            "detailsPaymentStatus",
            sale.payment_status
        );

        setText(
            "detailsRemarks",
            sale.remarks
        );

        const badge =
            $("detailsSaleStatus");

        badge.textContent =
            sale.sale_status ||
            "Unknown";

        badge.className =
            `status-badge status-${slug(
                sale.sale_status
            )}`;

        const invoice =
            sale.invoice ||
            {};

        setText(
            "detailsInvoiceNumber",
            invoice.invoice_number
        );

        setText(
            "detailsInvoiceStatus",
            invoice.status
        );

        setText(
            "detailsPaidAmount",
            money(
                invoice.paid_amount
            )
        );

        setText(
            "detailsBalanceAmount",
            money(
                invoice.balance_amount
            )
        );

        setText(
            "detailsSubtotal",
            money(
                sale.subtotal
            )
        );

        setText(
            "detailsDiscount",
            money(
                sale.discount
            )
        );

        setText(
            "detailsTax",
            money(
                sale.tax
            )
        );

        setText(
            "detailsGrandTotal",
            money(
                sale.grand_total
            )
        );

        const items =
            sale.items || [];

        $("saleItemsBody")
            .innerHTML =
            items.length
                ? items.map(item => `
                    <tr>
                        <td>${escapeHtml(
                            item.product_name
                        )}</td>
                        <td>${money(
                            item.unit_price
                        )}</td>
                        <td>${item.quantity}</td>
                        <td>${money(
                            item.total
                        )}</td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="4" style="text-align:center">
                            No sale items found.
                        </td>
                    </tr>
                `;

        $("cancelSaleBtn")
            .dataset.id =
            sale.id;

        $("cancelSaleBtn")
            .disabled =
            String(
                sale.sale_status
            ).toLowerCase() ===
            "cancelled";

        $("saleDetailsLoading")
            .classList.add(
                "hidden"
            );

        $("saleDetailsContent")
            .classList.remove(
                "hidden"
            );
    } catch (error) {
        closeModal();

        showMessage(
            error.message ||
            "Unable to load sale details.",
            "error"
        );
    }
}

async function cancelSale(id) {
    const reason =
        window.prompt(
            "Enter the cancellation reason:"
        );

    if (
        reason === null
    ) {
        return;
    }

    if (!reason.trim()) {
        showMessage(
            "Cancellation reason is required.",
            "error"
        );
        return;
    }

    const confirmed =
        window.confirm(
            "Cancel this sale and restore stock?"
        );

    if (!confirmed) {
        return;
    }

    try {
        await fetchJson(
            `${API.sales}/${encodeURIComponent(
                id
            )}/cancel`,
            {
                method: "POST",
                body:
                    JSON.stringify({
                        reason:
                            reason.trim()
                    })
            }
        );

        closeModal();

        showMessage(
            "Sale cancelled successfully.",
            "success"
        );

        await Promise.all([
            loadProducts(),
            loadSales()
        ]);
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to cancel sale.",
            "error",
            false
        );
    }
}

function exportSales() {
    if (!state.sales.length) {
        showMessage(
            "There are no sales to export.",
            "info"
        );
        return;
    }

    const rows = [
        [
            "Sale ID",
            "Sale Number",
            "Customer",
            "Date",
            "Subtotal",
            "Discount",
            "Tax",
            "Grand Total",
            "Payment Status",
            "Sale Status",
            "Payment Method"
        ],
        ...state.sales.map(
            sale => [
                sale.id,
                sale.sale_number,
                sale.full_name,
                sale.sale_date ||
                sale.created_at,
                sale.subtotal,
                sale.discount,
                sale.tax,
                sale.grand_total,
                sale.payment_status,
                sale.sale_status,
                sale.payment_method
            ]
        )
    ];

    const csv =
        rows.map(
            row =>
                row.map(
                    value =>
                        `"${String(
                            value ?? ""
                        ).replace(
                            /"/g,
                            '""'
                        )}"`
                ).join(",")
        ).join("\n");

    const blob =
        new Blob(
            [
                "\uFEFF",
                csv
            ],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        `rukhnav-sales-${
            new Date()
                .toISOString()
                .slice(0, 10)
        }.csv`;

    document.body.appendChild(
        link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
        url
    );
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        $("customerSearch")
            .addEventListener(
                "input",
                event =>
                    renderCustomerResults(
                        event.target.value
                    )
            );

        $("customerResults")
            .addEventListener(
                "click",
                event => {
                    const item =
                        event.target.closest(
                            "[data-customer-id]"
                        );

                    if (item) {
                        selectCustomer(
                            item.dataset
                                .customerId
                        );
                    }
                }
            );

        $("productSearch")
            .addEventListener(
                "input",
                event =>
                    renderProductResults(
                        event.target.value
                    )
            );

        $("productResults")
            .addEventListener(
                "click",
                event => {
                    const item =
                        event.target.closest(
                            "[data-product-id]"
                        );

                    if (item) {
                        addProduct(
                            item.dataset
                                .productId
                        );
                    }
                }
            );

        $("saleCartBody")
            .addEventListener(
                "input",
                event => {
                    const input =
                        event.target.closest(
                            "[data-qty-id]"
                        );

                    if (!input) {
                        return;
                    }

                    const item =
                        state.cart.find(
                            row =>
                                String(row.id) ===
                                String(
                                    input.dataset.qtyId
                                )
                        );

                    if (!item) {
                        return;
                    }

                    item.quantity =
                        Math.max(
                            1,
                            Math.min(
                                item.stock_quantity,
                                Math.floor(
                                    toNumber(
                                        input.value
                                    )
                                )
                            )
                        );

                    renderCart();
                }
            );

        $("saleCartBody")
            .addEventListener(
                "click",
                event => {
                    const button =
                        event.target.closest(
                            "[data-remove-id]"
                        );

                    if (!button) {
                        return;
                    }

                    state.cart =
                        state.cart.filter(
                            item =>
                                String(item.id) !==
                                String(
                                    button.dataset
                                        .removeId
                                )
                        );

                    renderCart();
                }
            );

        [
            "saleDiscount",
            "saleTax",
            "paymentAmount"
        ].forEach(id => {
            $(id).addEventListener(
                "input",
                calculateTotals
            );
        });

        $("completeSaleBtn")
            .addEventListener(
                "click",
                completeSale
            );

        $("salesSearch")
            .addEventListener(
                "input",
                renderSales
            );

        $("exportSalesBtn")
            .addEventListener(
                "click",
                exportSales
            );

        $("refreshSalesBtn")
            .addEventListener(
                "click",
                async event => {
                    setButtonLoading(
                        event.currentTarget,
                        true,
                        "Refreshing"
                    );

                    try {
                        await Promise.all([
                            loadProducts(),
                            loadCustomers(),
                            loadSales()
                        ]);
                    } finally {
                        setButtonLoading(
                            event.currentTarget,
                            false
                        );
                    }
                }
            );

        $("salesTableBody")
            .addEventListener(
                "click",
                async event => {
                    const button =
                        event.target.closest(
                            "[data-action='view']"
                        );

                    if (button) {
                        await openSaleDetails(
                            button.dataset.id
                        );
                    }
                }
            );

        document
            .querySelectorAll(
                "[data-close-modal]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    closeModal
                );
            });

        $("saleDetailsModal")
            .querySelector(
                ".sale-modal-overlay"
            )
            .addEventListener(
                "click",
                closeModal
            );

        $("cancelSaleBtn")
            .addEventListener(
                "click",
                event =>
                    cancelSale(
                        event.currentTarget
                            .dataset.id
                    )
            );

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeModal();
                }
            }
        );

        renderCart();

        try {
            await Promise.all([
                loadProducts(),
                loadCustomers(),
                loadSales()
            ]);
        } catch (error) {
            showMessage(
                error.message ||
                "Unable to load Sales POS data.",
                "error",
                false
            );
        }
    }
);
