"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const ORDERS_API = RUKHNAV_ORIGIN + "/api/admin/orders";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken");

if (!token) {
    window.location.href = "/admin/login.html";
}

const state = {
    orders: [],
    currentOrder: null,
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    search: "",
    status: "",
    paymentStatus: "",
    dateFrom: "",
    dateTo: "",
    loading: false,
    statusOrder: null
};

const $ = id => document.getElementById(id);

async function api(endpoint = "", options = {}) {
    const response = await fetch(`${ORDERS_API}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: token.startsWith("Bearer ")
                ? token
                : `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin_token");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("adminToken");
        sessionStorage.removeItem("admin_token");

        window.location.href = "/admin/login.html";

        throw new Error(
            data.message ||
            "Your admin session has expired."
        );
    }

    if (response.status === 403) {
        throw new Error(
            data.message ||
            "You do not have permission to perform this action."
        );
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}


const ORDER_WORKFLOW = Object.freeze({
    "Pending": [
        "Confirmed",
        "Cancelled"
    ],

    "Confirmed": [
        "Processing",
        "Cancelled"
    ],

    "Processing": [
        "Packed",
        "Cancelled"
    ],

    "Packed": [
        "Ready For Pickup",
        "Cancelled"
    ],

    "Ready For Pickup": [
        "Handed To Courier",
        "Cancelled"
    ],

    "Handed To Courier": [
        "In Transit",
        "Returned"
    ],

    "In Transit": [
        "Out For Delivery",
        "Returned"
    ],

    "Out For Delivery": [
        "Delivered",
        "Returned"
    ],

    "Delivered": [
        "Returned"
    ],

    "Cancelled": [
        "Refunded"
    ],

    "Returned": [
        "Refunded"
    ],

    "Refunded": []
});

const ORDER_WORKFLOW_STEPS = Object.freeze([
    "Pending",
    "Confirmed",
    "Processing",
    "Packed",
    "Ready For Pickup",
    "Handed To Courier",
    "In Transit",
    "Out For Delivery",
    "Delivered"
]);

function normalizedOrderStatus(
    value
) {
    const input =
        String(value || "")
            .trim()
            .toLowerCase();

    return (
        ORDER_WORKFLOW_STEPS.find(
            status =>
                status.toLowerCase() ===
                input
        ) ||
        (
            input === "canceled"
                ? "Cancelled"
                : String(value || "Pending")
        )
    );
}

function allowedNextStatuses(
    currentStatus
) {
    const normalized =
        normalizedOrderStatus(
            currentStatus
        );

    return [
        ...(
            ORDER_WORKFLOW[
                normalized
            ] || []
        )
    ];
}

function workflowMessage(
    currentStatus
) {
    const allowed =
        allowedNextStatuses(
            currentStatus
        );

    if (!allowed.length) {
        const current =
            normalizedOrderStatus(
                currentStatus
            );

        if (current === "Refunded") {
            return "This order has completed the refund workflow.";
        }

        return "This order is closed and cannot move to another status.";
    }

    return (
        `Allowed next status${
            allowed.length > 1
                ? "es"
                : ""
        }: ${allowed.join(", ")}.`
    );
}

function renderWorkflowTimeline(
    currentStatus
) {
    const container =
        $("orderWorkflowTimeline");

    if (!container) {
        return;
    }

    const normalized =
        normalizedOrderStatus(
            currentStatus
        );

    const exceptionalStatus =
        [
            "Cancelled",
            "Returned",
            "Refunded"
        ].includes(
            normalized
        );

    const currentIndex =
        ORDER_WORKFLOW_STEPS
            .indexOf(normalized);

    container.innerHTML =
        ORDER_WORKFLOW_STEPS
            .map(
                (
                    step,
                    index
                ) => {
                    const complete =
                        !exceptionalStatus &&
                        currentIndex >=
                        index;

                    const current =
                        !exceptionalStatus &&
                        currentIndex ===
                        index;

                    return `
                        <div class="workflow-step ${
                            complete
                                ? "complete"
                                : ""
                        } ${
                            current
                                ? "current"
                                : ""
                        }">
                            <span class="workflow-step-marker">
                                <i class="fa-solid ${
                                    complete
                                        ? "fa-check"
                                        : "fa-circle"
                                }"></i>
                            </span>

                            <strong>
                                ${escapeHtml(step)}
                            </strong>
                        </div>
                    `;
                }
            )
            .join("") +
        (
            exceptionalStatus
                ? `
                    <div class="workflow-cancelled ${escapeHtml(
                        normalized
                            .toLowerCase()
                            .replaceAll(" ", "-")
                    )}">
                        <i class="fa-solid ${
                            normalized === "Refunded"
                                ? "fa-money-bill-transfer"
                                : normalized === "Returned"
                                    ? "fa-rotate-left"
                                    : "fa-circle-xmark"
                        }"></i>
                        Order ${escapeHtml(normalized)}
                    </div>
                `
                : ""
        );
}

function renderStatusTransitionPreview(
    currentStatus,
    selectedStatus = ""
) {
    const preview =
        $("statusTransitionPreview");

    if (!preview) {
        return;
    }

    const current =
        normalizedOrderStatus(
            currentStatus
        );

    if (!selectedStatus) {
        preview.innerHTML = `
            <span class="transition-status current">
                ${escapeHtml(current)}
            </span>

            <i class="fa-solid fa-arrow-right"></i>

            <span class="transition-status empty">
                Select next status
            </span>
        `;

        return;
    }

    preview.innerHTML = `
        <span class="transition-status current">
            ${escapeHtml(current)}
        </span>

        <i class="fa-solid fa-arrow-right"></i>

        <span class="transition-status next">
            ${escapeHtml(selectedStatus)}
        </span>
    `;
}

function prepareStatusModal(
    order
) {
    if (!order) {
        showMessage(
            "Order information could not be loaded.",
            "error",
            false
        );

        return false;
    }

    const current =
        normalizedOrderStatus(
            order.order_status ||
            "Pending"
        );

    const allowed =
        allowedNextStatuses(
            current
        );

    state.statusOrder =
        order;

    $("statusOrderId").value =
        order.id || "";

    $("currentOrderStatusLabel")
        .textContent =
        current;

    $("workflowGuidance")
        .textContent =
        workflowMessage(
            current
        );

    $("allowedStatusHelp")
        .textContent =
        workflowMessage(
            current
        );

    const select =
        $("newOrderStatus");

    select.innerHTML = `
        <option value="">
            Select next status
        </option>
        ${allowed.map(
            status => `
                <option value="${escapeHtml(status)}">
                    ${escapeHtml(status)}
                </option>
            `
        ).join("")}
    `;

    select.disabled =
        allowed.length === 0;

    $("saveOrderStatusButton")
        .disabled =
        allowed.length === 0;

    $("orderStatusNotes").value =
        "";

    const notify =
        $("notifyCustomerOnStatus");

    if (notify) {
        notify.checked = true;
    }

    renderStatusTransitionPreview(
        current
    );

    $("shipmentRequirementNotice")
        ?.classList.add("hidden");

    return true;
}

const toNumber = value =>
    Number.isFinite(Number(value))
        ? Number(value)
        : 0;

const formatMoney = value =>
    new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 2
        }
    ).format(toNumber(value));

const formatNumber = value =>
    new Intl.NumberFormat("en-PK")
        .format(toNumber(value));

const formatDate = value => {
    if (!value) {
        return "—";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
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

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
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
    const div = document.createElement("div");

    div.textContent =
        value === null ||
        value === undefined
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
    const element = $("ordersMessage");

    if (!element) {
        return;
    }

    clearTimeout(messageTimer);

    element.textContent = text;
    element.className =
        `orders-message show ${type}`;

    if (autoHide) {
        messageTimer = setTimeout(() => {
            element.textContent = "";
            element.className =
                "orders-message";
        }, 4500);
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

        if (button.dataset.originalHtml) {
            button.innerHTML =
                button.dataset.originalHtml;

            delete button.dataset.originalHtml;
        }
    }
}

function openModal(id) {
    const modal = $(id);

    if (!modal) {
        return;
    }

    modal.classList.add("open");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";
}

function closeModal(target) {
    const modal =
        typeof target === "string"
            ? $(target)
            : target;

    if (!modal) {
        return;
    }

    modal.classList.remove("open");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (
        !document.querySelector(
            ".order-modal.open"
        )
    ) {
        document.body.style.overflow =
            "";
    }
}

async function loadSummary() {
    try {
        const data =
            await api("/summary");

        const summary =
            data.summary || {};

        $("totalOrders").textContent =
            formatNumber(
                summary.totalOrders
            );

        $("pendingOrders").textContent =
            formatNumber(
                summary.pendingOrders
            );

        $("deliveredOrders").textContent =
            formatNumber(
                summary.deliveredOrders
            );

        $("cancelledOrders").textContent =
            formatNumber(
                summary.cancelledOrders
            );

        $("todayOrders").textContent =
            formatNumber(
                summary.todayOrders
            );

        $("paidRevenue").textContent =
            formatMoney(
                summary.paidRevenue
            );

        $("pendingPaymentValue").textContent =
            formatMoney(
                summary.pendingPaymentValue
            );

        $("averageOrderValue").textContent =
            formatMoney(
                summary.averageOrderValue
            );
    } catch (error) {
        console.error(
            "Order summary error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load order summary.",
            "error"
        );
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

    if (state.paymentStatus) {
        query.set(
            "payment_status",
            state.paymentStatus
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
    $("ordersLoading")
        ?.classList.toggle(
            "hidden",
            mode !== "loading"
        );

    $("ordersEmptyState")
        ?.classList.toggle(
            "hidden",
            mode !== "empty"
        );

    $("ordersTableWrapper")
        ?.classList.toggle(
            "hidden",
            mode !== "table"
        );

    $("ordersPagination")
        ?.classList.toggle(
            "hidden",
            mode !== "table"
        );
}

async function loadOrders() {
    state.loading = true;
    setListState("loading");

    try {
        const data =
            await api(
                `?${buildQuery()}`
            );

        state.orders =
            Array.isArray(data.orders)
                ? data.orders
                : [];

        const pagination =
            data.pagination || {};

        state.page =
            toNumber(
                pagination.page || 1
            );

        state.limit =
            toNumber(
                pagination.limit || 20
            );

        state.total =
            toNumber(
                pagination.total || 0
            );

        state.totalPages =
            Math.max(
                1,
                toNumber(
                    pagination.totalPages || 1
                )
            );

        if (
            state.orders.length === 0
        ) {
            setListState("empty");

            $("ordersResultText")
                .textContent =
                "No order records were found.";

            return;
        }

        renderOrders();
        renderPagination();
        setListState("table");
    } catch (error) {
        state.orders = [];

        setListState("empty");

        showMessage(
            error.message ||
            "Unable to load orders.",
            "error",
            false
        );
    } finally {
        state.loading = false;
    }
}

function renderOrders() {
    const body =
        $("ordersTableBody");

    body.innerHTML =
        state.orders
            .map(order => `
                <tr>
                    <td>
                        <span class="order-number">
                            ${escapeHtml(
                                order.order_number ||
                                `Order #${order.id}`
                            )}
                        </span>
                        <br>
                        <small>
                            #${escapeHtml(order.id)}
                        </small>
                    </td>

                    <td>
                        <div class="customer-cell">
                            <strong>
                                ${escapeHtml(
                                    order.full_name ||
                                    "Unknown Customer"
                                )}
                            </strong>
                            <small>
                                ${escapeHtml(
                                    order.email ||
                                    order.phone ||
                                    "No contact"
                                )}
                            </small>
                        </div>
                    </td>

                    <td>
                        ${formatNumber(
                            order.item_count
                        )} item(s)
                        <br>
                        <small>
                            ${formatNumber(
                                order.total_quantity
                            )} unit(s)
                        </small>
                    </td>

                    <td>
                        <strong>
                            ${formatMoney(
                                order.grand_total
                            )}
                        </strong>
                    </td>

                    <td>
                        <span class="
                            payment-status-badge
                            payment-${escapeHtml(
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
                        <br>
                        <small>
                            ${escapeHtml(
                                order.payment_method ||
                                "—"
                            )}
                        </small>
                    </td>

                    <td>
                        <span class="
                            order-status-badge
                            status-${escapeHtml(
                                slugify(
                                    order.order_status
                                )
                            )}
                        ">
                            ${escapeHtml(
                                order.order_status ||
                                "Pending"
                            )}
                        </span>
                    </td>

                    <td>
                        ${escapeHtml(
                            order.tracking_number ||
                            "—"
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            order.created_at
                        )}
                    </td>

                    <td class="actions-column">
                        <div class="order-actions">
                            <button
                                type="button"
                                class="action-button"
                                data-action="view"
                                data-id="${escapeHtml(order.id)}"
                                title="View order"
                            >
                                <i class="fa-solid fa-eye"></i>
                            </button>

                            <button
                                type="button"
                                class="action-button"
                                data-action="status"
                                data-id="${escapeHtml(order.id)}"
                                title="Update status"
                            >
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>

                            <button
                                type="button"
                                class="action-button"
                                data-action="payments"
                                data-id="${escapeHtml(order.id)}"
                                title="Payment history"
                            >
                                <i class="fa-solid fa-credit-card"></i>
                            </button>

                            <button
                                type="button"
                                class="action-button"
                                data-action="shipment"
                                data-id="${escapeHtml(order.id)}"
                                title="Shipment details"
                            >
                                <i class="fa-solid fa-truck"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `)
            .join("");

    $("ordersResultText").textContent =
        `${formatNumber(
            state.total
        )} order record${
            state.total === 1
                ? ""
                : "s"
        } found.`;
}

function renderPagination() {
    const start =
        state.total
            ? (
                state.page - 1
            ) * state.limit + 1
            : 0;

    const end =
        Math.min(
            state.page *
            state.limit,
            state.total
        );

    $("orderPaginationInformation")
        .textContent =
        `Showing ${formatNumber(
            start
        )} to ${formatNumber(
            end
        )} of ${formatNumber(
            state.total
        )} orders`;

    const pages =
        $("orderPaginationPages");

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

        button.type = "button";

        button.className =
            "pagination-page-button";

        if (page === state.page) {
            button.classList.add(
                "active"
            );
        }

        button.textContent =
            String(page);

        button.addEventListener(
            "click",
            () => goToPage(page)
        );

        pages.appendChild(button);
    }

    $("orderFirstPageButton").disabled =
        state.page <= 1;

    $("orderPreviousPageButton").disabled =
        state.page <= 1;

    $("orderNextPageButton").disabled =
        state.page >= state.totalPages;

    $("orderLastPageButton").disabled =
        state.page >= state.totalPages;
}

async function goToPage(page) {
    if (
        state.loading ||
        page === state.page
    ) {
        return;
    }

    state.page =
        Math.max(
            1,
            Math.min(
                page,
                state.totalPages
            )
        );

    await loadOrders();
}

async function fetchOrder(id) {
    const data =
        await api(
            `/${encodeURIComponent(id)}`
        );

    state.currentOrder = data;

    return data;
}

function setText(id, value) {
    const element = $(id);

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

function populateOrderDetails(data) {
    const order =
        data.order || {};

    state.currentOrder =
        order;

    setText(
        "detailsOrderNumber",
        order.order_number ||
        `Order #${order.id}`
    );

    setText(
        "detailsCustomerName",
        order.full_name ||
        "Unknown Customer"
    );

    setText(
        "detailsCustomerContact",
        order.email ||
        order.phone ||
        "No contact"
    );

    setText(
        "detailsEmail",
        order.email
    );

    setText(
        "detailsPhone",
        order.phone
    );

    setText(
        "detailsCity",
        order.city
    );

    setText(
        "detailsAddress",
        order.delivery_address ||
        order.shipping_address ||
        order.address
    );

    setText(
        "detailsPaymentMethod",
        order.payment_method
    );

    setText(
        "detailsPaymentStatusValue",
        order.payment_status
    );

    setText(
        "detailsPaidAmount",
        formatMoney(
            order.paid_amount
        )
    );

    setText(
        "detailsBalanceAmount",
        formatMoney(
            isPaidOrder(
                order.payment_status
            )
                ? 0
                : outstandingOrderBalance(
                    order
                )
        )
    );

    setText(
        "detailsTrackingNumber",
        order.tracking_number
    );

    setText(
        "detailsTrackingUrl",
        order.tracking_url
    );

    setText(
        "detailsEstimatedDelivery",
        formatDate(
            order.estimated_delivery_date
        )
    );

    setText(
        "detailsCreatedAt",
        formatDateTime(
            order.created_at
        )
    );

    setText(
        "detailsDiscount",
        formatMoney(
            order.discount_amount
        )
    );

    const loyaltyDiscount =
        Number(
            order.loyalty_discount_amount ||
            0
        );

    const loyaltyPercentage =
        Number(
            order.loyalty_discount_percentage ||
            0
        );

    const membershipLevel =
        order.loyalty_membership_level ||
        "";

    const memberDiscountLabel =
        $("detailsMemberDiscountLabel");

    if (memberDiscountLabel) {
        const membershipText =
            membershipLevel
                ? `${membershipLevel} `
                : "";

        const percentageText =
            loyaltyPercentage > 0
                ? ` (${loyaltyPercentage}%)`
                : "";

        memberDiscountLabel.textContent =
            `${membershipText}Member Discount${percentageText}`;
    }

    setText(
        "detailsMemberDiscount",
        formatMoney(
            loyaltyDiscount
        )
    );

    const rewardPoints =
        Number(
            order.reward_points_redeemed ||
            0
        );

    setText(
        "detailsRewardPoints",
        `${rewardPoints.toLocaleString()} point${rewardPoints === 1 ? "" : "s"}`
    );

    setText(
        "detailsRewardDiscount",
        formatMoney(
            order.reward_points_discount_amount ||
            0
        )
    );

    setText(
        "detailsDeliveryCharges",
        formatMoney(
            order.delivery_charges
        )
    );

    setText(
        "detailsGrandTotal",
        formatMoney(
            order.grand_total
        )
    );

    const orderStatusBadge =
        $("detailsOrderStatus");

    orderStatusBadge.textContent =
        order.order_status ||
        "Pending";

    orderStatusBadge.className =
        `order-status-badge status-${slugify(
            order.order_status ||
            "Pending"
        )}`;

    const paymentStatusBadge =
        $("detailsPaymentStatus");

    paymentStatusBadge.textContent =
        order.payment_status ||
        "Pending";

    paymentStatusBadge.className =
        `payment-status-badge payment-${slugify(
            order.payment_status ||
            "Pending"
        )}`;

    state.statusOrder =
        order;

    $("openStatusFromDetailsButton")
        .dataset.id =
        order.id || "";

    $("loadOrderPaymentsButton")
        .dataset.id =
        order.id || "";

    $("loadOrderShipmentButton")
        .dataset.id =
        order.id || "";

    updateCodPaymentButton(
        order
    );

    $("orderItemsTableBody").innerHTML =
        (data.items || [])
            .map(item => `
                <tr>
                    <td>
                        ${escapeHtml(
                            item.product_name ||
                            `Product #${item.product_id}`
                        )}
                    </td>
                    <td>
                        ${formatMoney(
                            item.price
                        )}
                    </td>
                    <td>
                        ${formatNumber(
                            item.quantity
                        )}
                    </td>
                    <td>
                        ${formatMoney(
                            item.subtotal
                        )}
                    </td>
                </tr>
            `)
            .join("") ||
        `
            <tr>
                <td
                    colspan="4"
                    style="text-align:center"
                >
                    No order items found.
                </td>
            </tr>
        `;

    renderWorkflowTimeline(
        order.order_status ||
        "Pending"
    );

    $("orderHistoryTimeline").innerHTML =
        (data.history || [])
            .map(item => `
                <div class="history-item">
                    <span class="history-dot"></span>

                    <div class="history-content">
                        <strong>
                            ${escapeHtml(
                                item.old_status ||
                                "Created"
                            )}
                            →
                            ${escapeHtml(
                                item.new_status ||
                                "Created"
                            )}
                        </strong>

                        <small>
                            ${escapeHtml(
                                item.changed_by_name ||
                                item.changed_by_type ||
                                "System"
                            )}
                            ·
                            ${formatDateTime(
                                item.created_at
                            )}
                        </small>

                        ${
                            item.notes
                                ? `<p>${escapeHtml(
                                    item.notes
                                )}</p>`
                                : ""
                        }
                    </div>
                </div>
            `)
            .join("") ||
        `
            <div class="embedded-state">
                No status history available.
            </div>
        `;
}

async function openOrderDetails(id) {
    openModal(
        "orderDetailsModal"
    );

    $("orderDetailsLoading")
        .classList.remove("hidden");

    $("orderDetailsContent")
        .classList.add("hidden");

    try {
        const data =
            await fetchOrder(id);

        populateOrderDetails(data);

        $("orderDetailsLoading")
            .classList.add("hidden");

        $("orderDetailsContent")
            .classList.remove("hidden");
    } catch (error) {
        closeModal(
            "orderDetailsModal"
        );

        showMessage(
            error.message ||
            "Unable to load order details.",
            "error"
        );
    }
}


/* =====================================================
   Receive Cash on Delivery Payment
===================================================== */

function isCashOnDelivery(
    method
) {
    const value =
        String(method || "")
            .trim()
            .toLowerCase()
            .replaceAll("_", " ")
            .replaceAll("-", " ")
            .replace(/\s+/g, " ");

    return [
        "cash",
        "cash on delivery",
        "cash delivery",
        "cash at delivery",
        "cod"
    ].includes(value);
}

function outstandingOrderBalance(
    order
) {
    if (!order) {
        return 0;
    }

    const grandTotal =
        Math.max(
            0,
            Number(
                order.grand_total ??
                order.total_amount ??
                order.total ??
                0
            ) || 0
        );

    const paidAmount =
        Math.max(
            0,
            Number(
                order.paid_amount ??
                order.amount_paid ??
                0
            ) || 0
        );

    const storedBalance =
        Number(
            order.balance_amount ??
            order.amount_due ??
            NaN
        );

    const calculatedBalance =
        Math.max(
            0,
            grandTotal -
            paidAmount
        );

    /*
     * Older orders may contain balance_amount = 0.00 even
     * though payment_status is still Pending. In that case
     * use the financially correct derived balance.
     */
    if (
        !isPaidOrder(
            order.payment_status
        ) &&
        calculatedBalance > 0 &&
        (
            !Number.isFinite(
                storedBalance
            ) ||
            storedBalance <= 0
        )
    ) {
        return calculatedBalance;
    }

    if (
        Number.isFinite(
            storedBalance
        )
    ) {
        return Math.max(
            0,
            storedBalance
        );
    }

    return calculatedBalance;
}

function isPaidOrder(
    status
) {
    return String(status || "")
        .trim()
        .toLowerCase() ===
        "paid";
}

function canReceiveCodPayment(
    order
) {
    if (!order) {
        return false;
    }

    const delivered =
        String(
            order.order_status || ""
        )
            .trim()
            .toLowerCase() ===
        "delivered";

    const balance =
        outstandingOrderBalance(
            order
        );

    return (
        delivered &&
        isCashOnDelivery(
            order.payment_method
        ) &&
        !isPaidOrder(
            order.payment_status
        ) &&
        balance > 0
    );
}

function updateCodPaymentButton(
    order
) {
    const button =
        $("receiveCodPaymentButton");

    if (!button) {
        return;
    }

    const visible =
        canReceiveCodPayment(
            order
        );

    button.classList.toggle(
        "hidden",
        !visible
    );

    button.disabled =
        !visible;

    if (visible) {
        button.dataset.id =
            String(order.id);

        button.title =
            `Receive ${formatMoney(
                outstandingOrderBalance(
                    order
                )
            )} Cash on Delivery`;
    } else {
        delete button.dataset.id;

        const reasons = [];

        if (
            String(
                order.order_status || ""
            )
                .trim()
                .toLowerCase() !==
            "delivered"
        ) {
            reasons.push(
                "order is not Delivered"
            );
        }

        if (
            !isCashOnDelivery(
                order.payment_method
            )
        ) {
            reasons.push(
                `payment method is ${order.payment_method || "missing"}`
            );
        }

        if (
            isPaidOrder(
                order.payment_status
            )
        ) {
            reasons.push(
                "payment is already Paid"
            );
        }

        if (
            outstandingOrderBalance(
                order
            ) <= 0
        ) {
            reasons.push(
                "no outstanding balance"
            );
        }

        button.title =
            reasons.length
                ? `COD collection unavailable: ${reasons.join(", ")}.`
                : "COD collection unavailable.";
    }
}

function openCodPaymentModal(
    order
) {
    if (
        !canReceiveCodPayment(
            order
        )
    ) {
        showMessage(
            "COD payment can be received only for a delivered Cash on Delivery order with an outstanding balance.",
            "error",
            false
        );

        return;
    }

    const outstanding =
        outstandingOrderBalance(
            order
        );

    const paid =
        Number(
            order.paid_amount || 0
        );

    const today =
        new Date()
            .toISOString()
            .slice(0, 10);

    $("codPaymentOrderId").value =
        String(order.id);

    $("codPaymentOrderLabel").textContent =
        `${order.order_number || `Order #${order.id}`} · ${order.full_name || "Customer"}`;

    $("codOrderTotal").textContent =
        formatMoney(
            order.grand_total
        );

    $("codAlreadyPaid").textContent =
        formatMoney(
            paid
        );

    $("codOutstandingAmount").textContent =
        formatMoney(
            outstanding
        );

    $("codReceivedAmount").value =
        outstanding.toFixed(2);

    $("codReceivedAmount").max =
        outstanding.toFixed(2);

    $("codReceivedDate").value =
        today;

    $("codTransactionReference").value =
        `COD-${String(
            order.order_number ||
            order.id
        )
            .replace(/[^A-Za-z0-9-]/g, "")
        }-${today.replaceAll("-", "")}`;

    $("codPaymentNotes").value =
        "Cash received from courier after successful delivery.";

    openModal(
        "receiveCodPaymentModal"
    );
}

async function recordCodPayment(
    event
) {
    event.preventDefault();

    const order =
        state.currentOrder ||
        state.statusOrder;

    if (
        !canReceiveCodPayment(
            order
        )
    ) {
        showMessage(
            "This order is not eligible for COD collection.",
            "error",
            false
        );

        return;
    }

    const orderId =
        Number(
            $("codPaymentOrderId").value
        );

    const amount =
        Number(
            $("codReceivedAmount").value
        );

    const reference =
        $("codTransactionReference")
            .value
            .trim();

    const receivedDate =
        $("codReceivedDate")
            .value;

    const notes =
        $("codPaymentNotes")
            .value
            .trim();

    const outstanding =
        outstandingOrderBalance(
            order
        );

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        showMessage(
            "Enter a valid cash amount received.",
            "error",
            false
        );

        return;
    }

    if (
        amount >
        outstanding
    ) {
        showMessage(
            `The received amount cannot exceed the outstanding balance of ${formatMoney(outstanding)}.`,
            "error",
            false
        );

        return;
    }

    if (!reference) {
        showMessage(
            "A collection reference is required.",
            "error",
            false
        );

        return;
    }

    const button =
        $("saveCodPaymentButton");

    setButtonLoading(
        button,
        true,
        "Recording"
    );

    try {
        const response =
            await api(
                `/${encodeURIComponent(orderId)}/payments`,
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            payment_method:
                                "Cash on Delivery",

                            status:
                                "Paid",

                            amount,

                            currency:
                                "PKR",

                            transaction_reference:
                                reference,

                            notes:
                                [
                                    notes,
                                    receivedDate
                                        ? `Cash received date: ${receivedDate}`
                                        : ""
                                ]
                                    .filter(Boolean)
                                    .join(" | ")
                        })
                }
            );

        closeModal(
            "receiveCodPaymentModal"
        );

        showMessage(
            response.message ||
            "COD payment recorded successfully.",
            "success",
            false
        );

        await Promise.all([
            loadOrderSummary(),
            loadOrders()
        ]);

        await openOrderDetails(
            orderId
        );

        await loadOrderPayments(
            orderId
        );
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to record COD payment.",
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

async function loadOrderPayments(id) {
    const target =
        $("orderPaymentsContent");

    target.textContent =
        "Loading payment history...";

    try {
        const data =
            await api(
                `/${encodeURIComponent(
                    id
                )}/payments`
            );

        const payments =
            data.payments || [];

        target.innerHTML =
            payments.length
                ? payments
                    .map(payment => `
                        <div class="embedded-state">
                            <strong>
                                ${escapeHtml(
                                    payment.payment_number ||
                                    `Payment #${payment.id}`
                                )}
                            </strong>
                            <br>
                            ${escapeHtml(
                                payment.payment_method ||
                                "—"
                            )}
                            ·
                            ${escapeHtml(
                                payment.status ||
                                "—"
                            )}
                            ·
                            ${formatMoney(
                                payment.amount
                            )}
                        </div>
                    `)
                    .join("")
                : "No payment transactions found.";
    } catch (error) {
        target.textContent =
            error.message;
    }
}

async function loadOrderShipment(id) {
    const target =
        $("orderShipmentContent");

    target.textContent =
        "Loading shipment details...";

    try {
        const data =
            await api(
                `/${encodeURIComponent(
                    id
                )}/shipment`
            );

        const shipment =
            data.shipment || {};

        target.innerHTML = `
            <div class="embedded-state">
                <strong>
                    ${escapeHtml(
                        shipment.shipment_number ||
                        "Shipment"
                    )}
                </strong>
                <br>
                ${escapeHtml(
                    shipment.courier_name ||
                    "Courier not assigned"
                )}
                ·
                ${escapeHtml(
                    shipment.status ||
                    "—"
                )}
                <br>
                Tracking:
                ${escapeHtml(
                    shipment.tracking_number ||
                    "—"
                )}
            </div>
        `;
    } catch (error) {
        target.innerHTML = `
            <div class="shipment-empty-state">
                <i class="fa-solid fa-truck"></i>
                <strong>No shipment record available</strong>
                <p>
                    ${escapeHtml(
                        error.message ||
                        "Shipment details are not available for this order."
                    )}
                </p>
            </div>
        `;
    }
}

async function updateOrderStatus(
    event
) {
    event.preventDefault();

    const id =
        $("statusOrderId").value;

    const selectedStatus =
        $("newOrderStatus").value;

    const currentStatus =
        normalizedOrderStatus(
            state.statusOrder
                ?.order_status ||
            "Pending"
        );

    const allowed =
        allowedNextStatuses(
            currentStatus
        );

    if (
        !selectedStatus ||
        !allowed.includes(
            selectedStatus
        )
    ) {
        showMessage(
            workflowMessage(
                currentStatus
            ),
            "error",
            false
        );

        return;
    }

    const button =
        $("saveOrderStatusButton");

    setButtonLoading(
        button,
        true,
        "Saving"
    );

    try {
        await api(
            `/${encodeURIComponent(
                id
            )}/status`,
            {
                method: "PUT",

                body: JSON.stringify({
                    status:
                        selectedStatus,

                    notes:
                        $("orderStatusNotes")
                            .value
                            .trim() ||
                        null,

                    notify_customer:
                        Boolean(
                            $("notifyCustomerOnStatus")
                                ?.checked
                        )
                })
            }
        );

        closeModal(
            "orderStatusModal"
        );

        closeModal(
            "orderDetailsModal"
        );

        showMessage(
            `Order moved from ${currentStatus} to ${selectedStatus} successfully. Customer notification was ${
                $("notifyCustomerOnStatus")?.checked
                    ? "requested"
                    : "not requested"
            }.`,
            "success"
        );

        await Promise.all([
            loadSummary(),
            loadOrders()
        ]);
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to update order status.",
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

function applyUrlFilters() {
    const params =
        new URLSearchParams(
            window.location.search
        );

    const status =
        params.get("status");

    const paymentStatus =
        params.get("payment_status");

    if (status) {
        const statusFilter =
            $("orderStatusFilter");

        if (statusFilter) {
            statusFilter.value =
                status;

            state.status =
                status;
        }
    }

    if (paymentStatus) {
        const paymentFilter =
            $("paymentStatusFilter");

        if (paymentFilter) {
            paymentFilter.value =
                paymentStatus;

            state.paymentStatus =
                paymentStatus;
        }
    }
}

function readFilters() {
    state.search =
        $("orderSearch")
            .value
            .trim();

    state.status =
        $("orderStatusFilter")
            .value;

    state.paymentStatus =
        $("paymentStatusFilter")
            .value;

    state.dateFrom =
        $("orderDateFrom")
            .value;

    state.dateTo =
        $("orderDateTo")
            .value;

    state.limit =
        Math.max(
            1,
            toNumber(
                $("orderLimitFilter")
                    .value ||
                20
            )
        );

    state.page = 1;
}

async function clearFilters() {
    $("orderFiltersForm")
        .reset();

    $("orderLimitFilter").value =
        "20";

    state.search = "";
    state.status = "";
    state.paymentStatus = "";
    state.dateFrom = "";
    state.dateTo = "";
    state.limit = 20;
    state.page = 1;

    await loadOrders();
}

function exportCsv() {
    if (
        state.orders.length === 0
    ) {
        showMessage(
            "There are no orders to export.",
            "info"
        );

        return;
    }

    const rows = [
        [
            "Order ID",
            "Order Number",
            "Customer",
            "Email",
            "Phone",
            "Items",
            "Total",
            "Payment Status",
            "Order Status",
            "Created"
        ],

        ...state.orders.map(order => [
            order.id,
            order.order_number,
            order.full_name,
            order.email,
            order.phone,
            order.item_count,
            order.grand_total,
            order.payment_status,
            order.order_status,
            order.created_at
        ])
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
        document.createElement("a");

    link.href = url;

    link.download =
        `rukhnav-orders-${
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
                    () =>
                        closeModal(
                            button.dataset
                                .closeModal
                        )
                );
            });

        document
            .querySelectorAll(
                ".order-modal-overlay"
            )
            .forEach(overlay => {
                overlay.addEventListener(
                    "click",
                    () =>
                        closeModal(
                            overlay.closest(
                                ".order-modal"
                            )
                        )
                );
            });

        document.addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    document
                        .querySelectorAll(
                            ".order-modal.open"
                        )
                        .forEach(
                            closeModal
                        );
                }
            }
        );

        $("orderFiltersForm")
            .addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    readFilters();

                    await loadOrders();
                }
            );

        $("clearOrderFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("emptyClearOrderFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("exportOrdersButton")
            .addEventListener(
                "click",
                exportCsv
            );

        $("refreshOrdersButton")
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
                            loadSummary(),
                            loadOrders()
                        ]);
                    } finally {
                        setButtonLoading(
                            event.currentTarget,
                            false
                        );
                    }
                }
            );

        $("ordersTableBody")
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

                    const id =
                        button.dataset.id;

                    const action =
                        button.dataset.action;

                    if (
                        action === "view"
                    ) {
                        await openOrderDetails(
                            id
                        );
                    }

                    if (
                        action === "status"
                    ) {
                        const order =
                            state.orders.find(
                                item =>
                                    String(item.id) ===
                                    String(id)
                            );

                        if (
                            prepareStatusModal(
                                order
                            )
                        ) {
                            openModal(
                                "orderStatusModal"
                            );
                        }
                    }

                    if (
                        action === "payments"
                    ) {
                        await openOrderDetails(
                            id
                        );

                        await loadOrderPayments(
                            id
                        );
                    }

                    if (
                        action === "shipment"
                    ) {
                        await openOrderDetails(
                            id
                        );

                        await loadOrderShipment(
                            id
                        );
                    }
                }
            );

        $("openStatusFromDetailsButton")
            .addEventListener(
                "click",
                () => {
                    if (
                        !prepareStatusModal(
                            state.currentOrder ||
                            state.statusOrder
                        )
                    ) {
                        return;
                    }

                    closeModal(
                        "orderDetailsModal"
                    );

                    openModal(
                        "orderStatusModal"
                    );
                }
            );

        $("receiveCodPaymentButton")
            ?.addEventListener(
                "click",
                () =>
                    openCodPaymentModal(
                        state.currentOrder ||
                        state.statusOrder
                    )
            );

        $("receiveCodPaymentForm")
            ?.addEventListener(
                "submit",
                recordCodPayment
            );

        $("loadOrderPaymentsButton")
            .addEventListener(
                "click",
                event =>
                    loadOrderPayments(
                        event.currentTarget
                            .dataset.id
                    )
            );

        $("loadOrderShipmentButton")
            .addEventListener(
                "click",
                event =>
                    loadOrderShipment(
                        event.currentTarget
                            .dataset.id
                    )
            );

        $("newOrderStatus")
            .addEventListener(
                "change",
                event => {
                    const selected =
                        event.currentTarget
                            .value;

                    const current =
                        normalizedOrderStatus(
                            state.statusOrder
                                ?.order_status ||
                            "Pending"
                        );

                    renderStatusTransitionPreview(
                        current,
                        selected
                    );

                    $("shipmentRequirementNotice")
                        ?.classList.toggle(
                            "hidden",
                            selected !==
                            "Handed To Courier"
                        );
                }
            );

        $("orderStatusForm")
            .addEventListener(
                "submit",
                updateOrderStatus
            );

        $("orderFirstPageButton")
            .addEventListener(
                "click",
                () => goToPage(1)
            );

        $("orderPreviousPageButton")
            .addEventListener(
                "click",
                () =>
                    goToPage(
                        state.page - 1
                    )
            );

        $("orderNextPageButton")
            .addEventListener(
                "click",
                () =>
                    goToPage(
                        state.page + 1
                    )
            );

        $("orderLastPageButton")
            .addEventListener(
                "click",
                () =>
                    goToPage(
                        state.totalPages
                    )
            );

        applyUrlFilters();

        await Promise.all([
            loadSummary(),
            loadOrders()
        ]);
    }
);
