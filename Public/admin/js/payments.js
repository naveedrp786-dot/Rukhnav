"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const PAYMENTS_API =
    RUKHNAV_ORIGIN + "/api/admin/payments";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken");

if (!token) {
    window.location.href =
        "login.html";
}

const state = {
    payments: [],
    currentPayment: null,
    page: 1,
    limit: 20,
    totalRecords: 0,
    totalPages: 1,
    search: "",
    status: "",
    method: "",
    dateFrom: "",
    dateTo: "",
    loading: false
};

const $ = id =>
    document.getElementById(id);

async function request(
    endpoint = "",
    options = {}
) {
    const response =
        await fetch(
            `${PAYMENTS_API}${endpoint}`,
            {
                ...options,
                headers: {
                    "Content-Type":
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
        localStorage.removeItem("token");
        localStorage.removeItem("adminToken");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("adminToken");

        window.location.href =
            "login.html";

        throw new Error(
            data.message ||
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

const formatNumber = value =>
    new Intl.NumberFormat("en-PK")
        .format(toNumber(value));

const formatMoney = value =>
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

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "en-PK",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(parsed);
};

const formatDateTime = value => {
    if (!value) {
        return "—";
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "en-PK",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(parsed);
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

const slugify = value =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

let messageTimer = null;

function showMessage(
    text,
    type = "info",
    autoHide = true
) {
    const element =
        $("paymentsMessage");

    if (!element) {
        return;
    }

    clearTimeout(
        messageTimer
    );

    element.textContent =
        text;

    element.className =
        `payments-message show ${type}`;

    if (autoHide) {
        messageTimer =
            setTimeout(
                () => {
                    element.textContent = "";
                    element.className =
                        "payments-message";
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

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            ${escapeHtml(text)}
        `;
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

function buildQuery() {
    const query =
        new URLSearchParams();

    query.set(
        "page",
        String(state.page)
    );

    query.set(
        "limit",
        String(state.limit)
    );

    if (state.search) {
        query.set(
            "search",
            state.search
        );
    }

    if (state.status) {
        query.set(
            "status",
            state.status
        );
    }

    if (state.method) {
        query.set(
            "method",
            state.method
        );
    }

    if (state.dateFrom) {
        query.set(
            "date_from",
            state.dateFrom
        );
    }

    if (state.dateTo) {
        query.set(
            "date_to",
            state.dateTo
        );
    }

    return query.toString();
}

function setListState(mode) {
    $("paymentsLoading")
        .classList.toggle(
            "hidden",
            mode !== "loading"
        );

    $("paymentsEmptyState")
        .classList.toggle(
            "hidden",
            mode !== "empty"
        );

    $("paymentsTableWrapper")
        .classList.toggle(
            "hidden",
            mode !== "table"
        );

    $("paymentsPagination")
        .classList.toggle(
            "hidden",
            mode !== "table"
        );
}

function renderMethodBreakdown(
    breakdown
) {
    const target =
        $("paymentMethodBreakdown");

    if (
        !Array.isArray(breakdown) ||
        breakdown.length === 0
    ) {
        target.innerHTML = `
            <div class="method-card">
                <span>No method data</span>
                <strong>0 payments</strong>
                <small>${formatMoney(0)}</small>
            </div>
        `;

        return;
    }

    target.innerHTML =
        breakdown
            .map(item => `
                <article class="method-card">
                    <span>
                        ${escapeHtml(
                            item.paymentMethod ||
                            "Unknown Method"
                        )}
                    </span>
                    <strong>
                        ${formatNumber(
                            item.paymentCount
                        )} payment(s)
                    </strong>
                    <small>
                        ${formatMoney(
                            item.collectedAmount
                        )} collected
                    </small>
                </article>
            `)
            .join("");
}

async function loadDashboard() {
    try {
        const data =
            await request(
                "/dashboard"
            );

        const summary =
            data.dashboard || {};

        $("totalPayments").textContent =
            formatNumber(
                summary.totalPayments
            );

        $("totalCollected").textContent =
            formatMoney(
                summary.totalCollected
            );

        $("todayCollections").textContent =
            formatMoney(
                summary.todayCollections
            );

        $("monthlyCollections").textContent =
            formatMoney(
                summary.monthlyCollections
            );

        $("successfulPayments").textContent =
            formatNumber(
                summary.successfulPayments
            );

        $("pendingPayments").textContent =
            formatNumber(
                summary.pendingPayments
            );

        if ($("outstandingPaymentAmount")) {
            $("outstandingPaymentAmount").textContent =
                formatMoney(
                    summary.outstandingAmount
                );
        }

        if ($("outstandingOrderCount")) {
            $("outstandingOrderCount").textContent =
                `${formatNumber(
                    summary.outstandingOrders
                )} unpaid order(s)`;
        }

        $("refundedPayments").textContent =
            formatNumber(
                summary.refundedPayments
            );

        $("refundedAmount").textContent =
            formatMoney(
                summary.refundedAmount
            );

        renderMethodBreakdown(
            data.methodBreakdown
        );
    } catch (error) {
        console.error(
            "Payment dashboard error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load payment dashboard.",
            "error"
        );
    }
}

async function loadPayments() {
    state.loading = true;

    setListState("loading");

    try {
        const data =
            await request(
                `?${buildQuery()}`
            );

        state.payments =
            Array.isArray(
                data.payments
            )
                ? data.payments
                : [];

        const pagination =
            data.pagination || {};

        state.page =
            toNumber(
                pagination.currentPage ||
                1
            );

        state.limit =
            toNumber(
                pagination.limit ||
                20
            );

        state.totalRecords =
            toNumber(
                pagination.totalRecords ||
                0
            );

        state.totalPages =
            Math.max(
                1,
                toNumber(
                    pagination.totalPages ||
                    1
                )
            );

        if (
            state.payments.length === 0
        ) {
            setListState("empty");

            $("paymentResultsText")
                .textContent =
                "No payment records were found.";

            return;
        }

        renderPayments();
        renderPagination();
        setListState("table");
    } catch (error) {
        state.payments = [];

        setListState("empty");

        showMessage(
            error.message ||
            "Unable to load payments.",
            "error",
            false
        );
    } finally {
        state.loading = false;
    }
}


async function loadOutstandingPayments() {
    const body =
        $("outstandingPaymentsBody");

    if (!body) {
        return;
    }

    body.innerHTML = `
        <tr>
            <td colspan="8">
                Loading remaining customer payments...
            </td>
        </tr>
    `;

    try {
        const data =
            await request(
                "/outstanding"
            );

        const orders =
            Array.isArray(data.orders)
                ? data.orders
                : [];

        if (!orders.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        No remaining customer payments found.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML =
            orders.map(
                order => `
                    <tr>
                        <td>
                            <strong>
                                ${escapeHtml(
                                    order.order_number ||
                                    `Order #${order.id}`
                                )}
                            </strong>
                            <small>
                                ${escapeHtml(
                                    order.order_status ||
                                    "—"
                                )}
                            </small>
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    order.customer_name ||
                                    "Customer"
                                )}
                            </strong>
                            <small>
                                ${escapeHtml(
                                    order.customer_email ||
                                    order.customer_phone ||
                                    ""
                                )}
                            </small>
                        </td>

                        <td>
                            ${escapeHtml(
                                order.payment_method ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                order.grand_total
                            )}
                        </td>

                        <td class="amount-paid">
                            ${formatMoney(
                                order.paid_amount
                            )}
                        </td>

                        <td class="amount-outstanding">
                            ${formatMoney(
                                order.balance_amount
                            )}
                        </td>

                        <td>
                            <span class="
                                payment-status-badge
                                status-${escapeHtml(
                                    slugify(
                                        order.payment_status
                                    )
                                )}
                            ">
                                ${escapeHtml(
                                    order.payment_status ||
                                    "Pending"
                                )}
                            </span>
                        </td>

                        <td>
                            <button
                                type="button"
                                class="action-button"
                                onclick="window.location.href='/admin/orders.html?order_id=${escapeHtml(order.id)}'"
                                title="Open order"
                            >
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </button>
                        </td>
                    </tr>
                `
            ).join("");
    } catch (error) {
        body.innerHTML = `
            <tr>
                <td colspan="8">
                    ${escapeHtml(
                        error.message ||
                        "Unable to load remaining payments."
                    )}
                </td>
            </tr>
        `;
    }
}

function renderPayments() {
    $("paymentsTableBody")
        .innerHTML =
        state.payments
            .map(payment => `
                <tr>
                    <td>
                        <span class="payment-number">
                            ${escapeHtml(
                                payment.payment_number ||
                                `Payment #${payment.id}`
                            )}
                        </span>
                    </td>

                    <td>
                        <div class="customer-cell">
                            <strong>
                                ${escapeHtml(
                                    payment.customer_name ||
                                    "Unknown Customer"
                                )}
                            </strong>
                            <small>
                                ${escapeHtml(
                                    payment.customer_email ||
                                    payment.customer_phone ||
                                    "No contact"
                                )}
                            </small>
                        </div>
                    </td>

                    <td>
                        <div class="order-cell">
                            <strong>
                                ${escapeHtml(
                                    payment.order_number ||
                                    `Order #${payment.order_id}`
                                )}
                            </strong>
                            <small>
                                ${escapeHtml(
                                    payment.order_status ||
                                    "Unknown"
                                )}
                            </small>
                        </div>
                    </td>

                    <td>
                        ${escapeHtml(
                            payment.payment_method ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            payment.transaction_reference ||
                            "—"
                        )}
                    </td>

                    <td>
                        <strong>
                            ${formatMoney(
                                payment.amount
                            )}
                        </strong>
                    </td>

                    <td>
                        <span class="
                            payment-status-badge
                            status-${escapeHtml(
                                slugify(
                                    payment.payment_status
                                )
                            )}
                        ">
                            ${escapeHtml(
                                payment.payment_status ||
                                "Pending"
                            )}
                        </span>
                    </td>

                    <td>
                        ${formatDate(
                            payment.paid_at ||
                            payment.created_at
                        )}
                    </td>

                    <td class="actions-column">
                        <div class="payment-actions">
                            <button
                                type="button"
                                class="action-button"
                                data-action="view"
                                data-id="${escapeHtml(
                                    payment.id
                                )}"
                                title="View payment"
                            >
                                <i class="fa-solid fa-eye"></i>
                            </button>

                            <button
                                type="button"
                                class="action-button"
                                data-action="order"
                                data-order-id="${escapeHtml(
                                    payment.order_id
                                )}"
                                title="Open order"
                            >
                                <i class="fa-solid fa-cart-shopping"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `)
            .join("");

    $("paymentResultsText")
        .textContent =
        `${formatNumber(
            state.totalRecords
        )} payment record${
            state.totalRecords === 1
                ? ""
                : "s"
        } found.`;
}

function renderPagination() {
    const start =
        state.totalRecords
            ? (
                state.page - 1
            ) * state.limit + 1
            : 0;

    const end =
        Math.min(
            state.page *
            state.limit,
            state.totalRecords
        );

    $("paymentPaginationInformation")
        .textContent =
        `Showing ${formatNumber(
            start
        )} to ${formatNumber(
            end
        )} of ${formatNumber(
            state.totalRecords
        )} payments`;

    const pages =
        $("paymentPaginationPages");

    pages.innerHTML = "";

    const from =
        Math.max(
            1,
            state.page - 2
        );

    const to =
        Math.min(
            state.totalPages,
            state.page + 2
        );

    for (
        let page = from;
        page <= to;
        page += 1
    ) {
        const button =
            document.createElement(
                "button"
            );

        button.type =
            "button";

        button.className =
            "pagination-page-button";

        if (
            page === state.page
        ) {
            button.classList.add(
                "active"
            );
        }

        button.textContent =
            String(page);

        button.addEventListener(
            "click",
            async () => {
                if (
                    page === state.page ||
                    state.loading
                ) {
                    return;
                }

                state.page =
                    page;

                await loadPayments();
            }
        );

        pages.appendChild(
            button
        );
    }

    $("paymentFirstPageButton")
        .disabled =
        state.page <= 1;

    $("paymentPreviousPageButton")
        .disabled =
        state.page <= 1;

    $("paymentNextPageButton")
        .disabled =
        state.page >=
        state.totalPages;

    $("paymentLastPageButton")
        .disabled =
        state.page >=
        state.totalPages;
}

function setText(
    id,
    value
) {
    const element =
        $(id);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "—"
            : String(value);
}

function openModal() {
    $("paymentDetailsModal")
        .classList.add("open");

    $("paymentDetailsModal")
        .setAttribute(
            "aria-hidden",
            "false"
        );

    document.body.style.overflow =
        "hidden";
}

function closeModal() {
    $("paymentDetailsModal")
        .classList.remove("open");

    $("paymentDetailsModal")
        .setAttribute(
            "aria-hidden",
            "true"
        );

    document.body.style.overflow =
        "";
}

function populateDetails(
    payment
) {
    state.currentPayment =
        payment;

    setText(
        "detailsPaymentReference",
        payment.transaction_reference ||
        `Payment #${payment.id}`
    );

    setText(
        "detailsCustomerName",
        payment.customer_name ||
        "Unknown Customer"
    );

    setText(
        "detailsCustomerContact",
        payment.customer_email ||
        payment.customer_phone ||
        "No contact"
    );

    const statusBadge =
        $("detailsPaymentStatus");

    statusBadge.textContent =
        payment.payment_status ||
        "Pending";

    statusBadge.className =
        `payment-status-badge status-${slugify(
            payment.payment_status ||
            "Pending"
        )}`;

    setText(
        "detailsCustomerNameValue",
        payment.customer_name
    );

    setText(
        "detailsCustomerEmail",
        payment.customer_email
    );

    setText(
        "detailsCustomerPhone",
        payment.customer_phone
    );

    setText(
        "detailsCustomerCity",
        payment.customer_city
    );

    setText(
        "detailsCustomerAddress",
        payment.customer_address
    );

    setText(
        "detailsOrderNumber",
        payment.order_number ||
        (
            payment.order_id
                ? `Order #${payment.order_id}`
                : "—"
        )
    );

    setText(
        "detailsOrderStatus",
        payment.order_status
    );

    setText(
        "detailsOrderPaymentStatus",
        payment.order_payment_status
    );

    setText(
        "detailsOrderTotal",
        formatMoney(
            payment.order_total
        )
    );

    setText(
        "detailsPaymentId",
        payment.id
    );

    setText(
        "detailsPaymentMethod",
        payment.payment_method
    );

    setText(
        "detailsTransactionReference",
        payment.transaction_reference
    );

    setText(
        "detailsPaymentAmount",
        formatMoney(
            payment.amount
        )
    );

    setText(
        "detailsPaidAt",
        formatDateTime(
            payment.paid_at
        )
    );

    setText(
        "detailsCreatedAt",
        formatDateTime(
            payment.created_at
        )
    );

    $("openOrderButton")
        .dataset.orderId =
        payment.order_id ||
        "";
}

async function openDetails(
    id
) {
    openModal();

    $("paymentDetailsLoading")
        .classList.remove("hidden");

    $("paymentDetailsContent")
        .classList.add("hidden");

    try {
        const data =
            await request(
                `/${encodeURIComponent(
                    id
                )}`
            );

        populateDetails(
            data.payment
        );

        $("paymentDetailsLoading")
            .classList.add("hidden");

        $("paymentDetailsContent")
            .classList.remove("hidden");
    } catch (error) {
        closeModal();

        showMessage(
            error.message ||
            "Unable to load payment details.",
            "error"
        );
    }
}

function readFilters() {
    state.search =
        $("paymentSearch")
            .value
            .trim();

    state.status =
        $("paymentStatusFilter")
            .value;

    state.method =
        $("paymentMethodFilter")
            .value;

    state.dateFrom =
        $("paymentDateFrom")
            .value;

    state.dateTo =
        $("paymentDateTo")
            .value;

    state.limit =
        Math.max(
            1,
            toNumber(
                $("paymentLimitFilter")
                    .value ||
                20
            )
        );

    state.page = 1;
}

async function clearFilters() {
    $("paymentFiltersForm")
        .reset();

    $("paymentLimitFilter")
        .value =
        "20";

    state.search = "";
    state.status = "";
    state.method = "";
    state.dateFrom = "";
    state.dateTo = "";
    state.limit = 20;
    state.page = 1;

    await loadPayments();
}

function exportCsv() {
    if (
        state.payments.length === 0
    ) {
        showMessage(
            "There are no payments to export.",
            "info"
        );

        return;
    }

    const rows = [
        [
            "Payment ID",
            "Order Number",
            "Customer",
            "Email",
            "Phone",
            "Method",
            "Reference",
            "Amount",
            "Status",
            "Paid At",
            "Created At"
        ],
        ...state.payments.map(
            payment => [
                payment.id,
                payment.order_number,
                payment.customer_name,
                payment.customer_email,
                payment.customer_phone,
                payment.payment_method,
                payment.transaction_reference,
                payment.amount,
                payment.payment_status,
                payment.paid_at,
                payment.created_at
            ]
        )
    ];

    const csv =
        rows
            .map(row =>
                row
                    .map(value =>
                        `"${String(
                            value ?? ""
                        ).replace(
                            /"/g,
                            '""'
                        )}"`
                    )
                    .join(",")
            )
            .join("\n");

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
        `rukhnav-payments-${
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

        $("paymentDetailsModal")
            .querySelector(
                ".payment-modal-overlay"
            )
            .addEventListener(
                "click",
                closeModal
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

        $("paymentFiltersForm")
            .addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    readFilters();

                    await loadPayments();
                }
            );

        $("clearPaymentFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("emptyClearPaymentFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("exportPaymentsButton")
            .addEventListener(
                "click",
                exportCsv
            );

        $("refreshPaymentsButton")
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
                            loadDashboard(),
                            loadPayments()
                        ]);
                    } finally {
                        setButtonLoading(
                            event.currentTarget,
                            false
                        );
                    }
                }
            );

        $("paymentsTableBody")
            .addEventListener(
                "click",
                async event => {
                    const button =
                        event.target.closest(
                            "[data-action]"
                        );

                    if (!button) {
                        return;
                    }

                    if (
                        button.dataset.action ===
                        "view"
                    ) {
                        await openDetails(
                            button.dataset.id
                        );
                    }

                    if (
                        button.dataset.action ===
                        "order"
                    ) {
                        window.location.href =
                            `orders.html?orderId=${encodeURIComponent(
                                button.dataset.orderId
                            )}`;
                    }
                }
            );

        $("openOrderButton")
            .addEventListener(
                "click",
                event => {
                    const orderId =
                        event.currentTarget
                            .dataset.orderId;

                    if (orderId) {
                        window.location.href =
                            `orders.html?orderId=${encodeURIComponent(
                                orderId
                            )}`;
                    }
                }
            );

        $("paymentFirstPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page = 1;
                    await loadPayments();
                }
            );

        $("paymentPreviousPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page =
                        Math.max(
                            1,
                            state.page - 1
                        );

                    await loadPayments();
                }
            );

        $("paymentNextPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page =
                        Math.min(
                            state.totalPages,
                            state.page + 1
                        );

                    await loadPayments();
                }
            );

        $("paymentLastPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page =
                        state.totalPages;

                    await loadPayments();
                }
            );

        await Promise.all([
            loadDashboard(),
            loadPayments(),
            loadOutstandingPayments()
        ]);
    }
);


document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadOutstandingPayments();

        $("refreshOutstandingPaymentsButton")
            ?.addEventListener(
                "click",
                loadOutstandingPayments
            );
    },
    {
        once: true
    }
);
