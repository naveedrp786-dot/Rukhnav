"use strict";

const RUKHNAV_ORIGIN =
    window.RUKHNAV_API_ORIGIN ||
    window.location.origin;

const RETURNS_API =
    RUKHNAV_ORIGIN +
    "/api/admin/returns";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken");

if (!token) {
    window.location.href =
        "/admin/login.html";
}

const $ = id =>
    document.getElementById(id);

const state = {
    returns: [],
    currentReturn: null,
    paymentSettlement: null
};


function authHeader() {

    return token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

}


async function api(
    endpoint = "",
    options = {}
) {

    const response =
        await fetch(
            `${RETURNS_API}${endpoint}`,
            {
                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        authHeader(),

                    ...(options.headers || {})
                }
            }
        );

    let data = {};

    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {

        window.location.href =
            "/admin/login.html";

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


function escapeHtml(value = "") {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function money(value) {

    return (
        "PKR " +
        Number(value || 0)
            .toLocaleString(
                "en-PK",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )
    );

}


function dateTime(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return escapeHtml(value);
    }

    return date.toLocaleString(
        "en-PK"
    );

}


function normalizeArray(data) {

    if (Array.isArray(data)) {
        return data;
    }

    const candidates = [
        data?.returns,
        data?.return_requests,
        data?.requests,
        data?.rows,
        data?.data
    ];

    return (
        candidates.find(
            Array.isArray
        ) || []
    );

}


function valueOf(
    object,
    ...keys
) {

    for (const key of keys) {

        if (
            object &&
            object[key] !== undefined &&
            object[key] !== null
        ) {
            return object[key];
        }

    }

    return null;
}


function showMessage(
    message,
    type = "error"
) {

    const element =
        $("returnsMessage");

    element.textContent =
        message;

    element.className =
        `returns-message show ${type}`;

}


function clearMessage() {

    $("returnsMessage")
        .className =
        "returns-message";

}


function statusClass(status) {

    return String(status || "")
        .toLowerCase()
        .replaceAll(" ", "-");

}


function renderSummary(
    summary = {},
    rows = []
) {

    const count =
        status =>
            rows.filter(
                row =>
                    String(
                        valueOf(
                            row,
                            "status",
                            "return_status"
                        ) || ""
                    ).toLowerCase() ===
                    status.toLowerCase()
            ).length;

    const set =
        (id, keys, fallback) => {

            let value = null;

            for (
                const key of keys
            ) {

                if (
                    summary[key] !== undefined &&
                    summary[key] !== null
                ) {
                    value =
                        summary[key];

                    break;
                }

            }

            $(id).textContent =
                value ?? fallback;

        };

    set(
        "totalReturns",
        [
            "total",
            "total_returns",
            "totalReturns"
        ],
        rows.length
    );

    set(
        "requestedReturns",
        [
            "requested",
            "requested_returns"
        ],
        count("Requested")
    );

    set(
        "approvedReturns",
        [
            "approved",
            "approved_returns"
        ],
        count("Approved")
    );

    set(
        "receivedReturns",
        [
            "received",
            "received_returns"
        ],
        count("Received")
    );

    set(
        "inspectedReturns",
        [
            "inspected",
            "inspected_returns"
        ],
        count("Inspected")
    );

    set(
        "refundedReturns",
        [
            "refunded",
            "refunded_returns"
        ],
        count("Refunded")
    );

}


function filteredRows() {

    const search =
        $("returnSearch")
            .value
            .trim()
            .toLowerCase();

    const status =
        $("returnStatusFilter")
            .value
            .trim()
            .toLowerCase();

    return state.returns.filter(
        row => {

            const rowStatus =
                String(
                    valueOf(
                        row,
                        "status",
                        "return_status"
                    ) || ""
                ).toLowerCase();

            if (
                status &&
                rowStatus !== status
            ) {
                return false;
            }

            if (!search) {
                return true;
            }

            const haystack =
                [
                    valueOf(
                        row,
                        "return_number",
                        "returnNumber"
                    ),

                    valueOf(
                        row,
                        "order_number",
                        "orderNumber"
                    ),

                    valueOf(
                        row,
                        "customer_name",
                        "full_name",
                        "customerName"
                    ),

                    valueOf(
                        row,
                        "email",
                        "customer_email"
                    ),

                    valueOf(
                        row,
                        "phone",
                        "customer_phone"
                    )
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

            return haystack
                .includes(search);

        }
    );

}


function renderTable() {

    const rows =
        filteredRows();

    const limit =
        Number(
            $("returnLimitFilter")
                .value || 20
        );

    const visible =
        rows.slice(0, limit);

    $("returnsLoading")
        .classList.add("hidden");

    if (!visible.length) {

        $("returnsTableWrapper")
            .classList.add("hidden");

        $("returnsEmptyState")
            .classList.remove("hidden");

        $("returnsResultText")
            .textContent =
            "No matching return records.";

        return;
    }

    $("returnsEmptyState")
        .classList.add("hidden");

    $("returnsTableWrapper")
        .classList.remove("hidden");

    $("returnsResultText")
        .textContent =
        `Showing ${visible.length} of ${rows.length} return records.`;

    $("returnsTableBody")
        .innerHTML =
        visible.map(
            row => {

                const id =
                    valueOf(
                        row,
                        "id",
                        "return_id",
                        "returnRequestId"
                    );

                const returnNumber =
                    valueOf(
                        row,
                        "return_number",
                        "returnNumber"
                    ) ||
                    `RETURN-${id}`;

                const orderNumber =
                    valueOf(
                        row,
                        "order_number",
                        "orderNumber"
                    ) || "—";

                const customer =
                    valueOf(
                        row,
                        "customer_name",
                        "full_name",
                        "customerName"
                    ) ||
                    "Guest Customer";

                const items =
                    valueOf(
                        row,
                        "item_count",
                        "items_count",
                        "total_items"
                    ) || 0;

                const requested =
                    valueOf(
                        row,
                        "requested_amount",
                        "total_requested_amount"
                    );

                const approved =
                    valueOf(
                        row,
                        "approved_amount"
                    );

                const status =
                    valueOf(
                        row,
                        "status",
                        "return_status"
                    ) || "Requested";

                const created =
                    valueOf(
                        row,
                        "created_at",
                        "requested_at"
                    );

                return `
                    <tr>

                        <td>
                            <span class="return-number">
                                ${escapeHtml(returnNumber)}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(orderNumber)}
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(customer)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHtml(items)}
                        </td>

                        <td>
                            ${money(requested)}
                        </td>

                        <td>
                            ${money(approved)}
                        </td>

                        <td>
                            <span class="return-status ${statusClass(status)}">
                                ${escapeHtml(status)}
                            </span>
                        </td>

                        <td>
                            ${dateTime(created)}
                        </td>

                        <td>
                            <button
                                class="return-view-button"
                                data-return-id="${escapeHtml(id)}"
                            >
                                <i class="fa-solid fa-eye"></i>
                                View
                            </button>
                        </td>

                    </tr>
                `;

            }
        )
        .join("");

}


function itemArray(data) {

    const request =
        data?.return_request ||
        data?.return ||
        data?.request ||
        data?.data ||
        {};

    const items =
        data?.items ||
        request?.items ||
        data?.return_items ||
        [];

    return {
        request,
        items:
            Array.isArray(items)
                ? items
                : []
    };

}


function mediaArray(data) {

    const request =
        data?.return_request ||
        data?.return ||
        data?.request ||
        {};

    const media =
        data?.media ||
        request?.media ||
        data?.evidence ||
        [];

    return Array.isArray(media)
        ? media
        : [];

}


function mediaUrl(media) {

    const value =
        valueOf(
            media,
            "file_url",
            "url",
            "file_path",
            "media_url"
        );

    if (!value) {
        return "";
    }

    if (
        String(value)
            .startsWith("http")
    ) {
        return value;
    }

    return (
        RUKHNAV_ORIGIN +
        (
            String(value)
                .startsWith("/")
                ? value
                : "/" + value
        )
    );

}


function renderEvidence(media) {

    if (!media.length) {

        return `
            <p>
                No customer evidence was uploaded.
            </p>
        `;

    }

    return `
        <div class="return-evidence">

            ${media.map(
                file => {

                    const url =
                        mediaUrl(file);

                    const type =
                        String(
                            valueOf(
                                file,
                                "mime_type",
                                "file_type",
                                "type"
                            ) || ""
                        ).toLowerCase();

                    if (
                        type.includes("video") ||
                        /\.(mp4|webm|mov)$/i
                            .test(url)
                    ) {

                        return `
                            <video
                                controls
                                src="${escapeHtml(url)}"
                            ></video>
                        `;

                    }

                    return `
                        <a
                            href="${escapeHtml(url)}"
                            target="_blank"
                            rel="noopener"
                        >
                            <img
                                src="${escapeHtml(url)}"
                                alt="Return evidence"
                            >
                        </a>
                    `;

                }
            ).join("")}

        </div>
    `;

}


function renderDetails(data) {

    const {
        request,
        items
    } = itemArray(data);

    const media =
        mediaArray(data);

    state.currentReturn =
        request;

    state.paymentSettlement =
        data?.payment_settlement ||
        null;

    const status =
        valueOf(
            request,
            "status",
            "return_status"
        ) || "Requested";

    const returnNumber =
        valueOf(
            request,
            "return_number",
            "returnNumber"
        ) ||
        `RETURN-${request.id || ""}`;

    $("returnModalTitle")
        .textContent =
        returnNumber;

    const itemHtml =
        items.map(
            item => {

                const itemId =
                    valueOf(
                        item,
                        "id",
                        "return_item_id"
                    );

                const product =
                    valueOf(
                        item,
                        "product_name",
                        "name"
                    ) ||
                    `Product #${item.product_id || ""}`;

                return `
                    <div
                        class="return-item-card"
                        data-inspection-item="${escapeHtml(itemId)}"
                    >

                        <div class="return-item-grid">

                            <div>
                                <small>Product</small>
                                <strong>
                                    ${escapeHtml(product)}
                                </strong>
                            </div>

                            <div>
                                <small>Requested</small>
                                <strong>
                                    ${escapeHtml(
                                        valueOf(
                                            item,
                                            "requested_quantity"
                                        ) || 0
                                    )}
                                </strong>
                            </div>

                            <div>
                                <small>Approved</small>
                                <strong>
                                    ${escapeHtml(
                                        valueOf(
                                            item,
                                            "approved_quantity"
                                        ) || 0
                                    )}
                                </strong>
                            </div>

                            <div>
                                <small>Received</small>
                                <strong>
                                    ${escapeHtml(
                                        valueOf(
                                            item,
                                            "received_quantity"
                                        ) || 0
                                    )}
                                </strong>
                            </div>

                            <div>
                                <small>Unit Price</small>
                                <strong>
                                    ${money(
                                        valueOf(
                                            item,
                                            "unit_price"
                                        )
                                    )}
                                </strong>
                            </div>

                        </div>

                        ${
                            status === "Received"
                                ? `
                                <div class="inspection-fields">

                                    <label>
                                        Accepted Quantity

                                        <input
                                            type="number"
                                            min="0"
                                            max="${escapeHtml(
                                                valueOf(
                                                    item,
                                                    "received_quantity",
                                                    "approved_quantity"
                                                ) || 0
                                            )}"
                                            value="${escapeHtml(
                                                valueOf(
                                                    item,
                                                    "received_quantity",
                                                    "approved_quantity"
                                                ) || 0
                                            )}"
                                            data-accepted-quantity
                                        >
                                    </label>

                                    <label>
                                        Condition

                                        <select data-condition-status>
                                            <option>Good</option>
                                            <option>Opened</option>
                                            <option>Damaged</option>
                                            <option>Expired</option>
                                            <option>Not Resellable</option>
                                        </select>
                                    </label>

                                    <label>
                                        Inspection Notes

                                        <input
                                            type="text"
                                            data-inspection-notes
                                            placeholder="Optional notes"
                                        >
                                    </label>

                                </div>
                                `
                                : ""
                        }

                    </div>
                `;

            }
        )
        .join("");

    let actions = "";

    if (status === "Requested") {

        actions = `
            <button
                class="return-action-btn primary"
                data-action="approve"
            >
                <i class="fa-solid fa-check"></i>
                Approve Return
            </button>

            <button
                class="return-action-btn danger"
                data-action="reject"
            >
                <i class="fa-solid fa-xmark"></i>
                Reject Return
            </button>
        `;

    } else if (status === "Approved") {

        actions = `
            <button
                class="return-action-btn primary"
                data-action="receive"
            >
                <i class="fa-solid fa-box"></i>
                Mark Goods Received
            </button>
        `;

    } else if (status === "Received") {

        actions = `
            <button
                class="return-action-btn gold"
                data-action="inspect"
            >
                <i class="fa-solid fa-magnifying-glass"></i>
                Save Inspection
            </button>
        `;

    } else if (status === "Inspected") {

        actions = `
            <button
                class="return-action-btn primary"
                data-action="complete"
            >
                <i class="fa-solid fa-money-bill-transfer"></i>
                Complete Return / Refund
            </button>
        `;

    }

    $("returnModalBody")
        .innerHTML =
        `
            <div class="return-detail-grid">

                <div class="return-detail-card">
                    <span>Status</span>
                    <strong>
                        ${escapeHtml(status)}
                    </strong>
                </div>

                <div class="return-detail-card">
                    <span>Order</span>
                    <strong>
                        ${escapeHtml(
                            valueOf(
                                request,
                                "order_number"
                            ) || "—"
                        )}
                    </strong>
                </div>

                <div class="return-detail-card">
                    <span>Customer</span>
                    <strong>
                        ${escapeHtml(
                            valueOf(
                                request,
                                "customer_name",
                                "full_name"
                            ) ||
                            "Guest Customer"
                        )}
                    </strong>
                </div>

                <div class="return-detail-card">
                    <span>Approved Refund</span>
                    <strong>
                        ${money(
                            valueOf(
                                request,
                                "approved_amount"
                            )
                        )}
                    </strong>
                </div>

            </div>


            <section class="return-section">

                <h3>Returned Products</h3>

                ${
                    itemHtml ||
                    "<p>No return items found.</p>"
                }

            </section>


            <section class="return-section">

                <h3>Customer Evidence</h3>

                ${renderEvidence(media)}

            </section>


            ${
                status === "Inspected"
                    ? renderSettlementPanel(
                        data?.payment_settlement ||
                        {}
                    )
                    : ""
            }

            <div class="return-actions">
                ${actions}
            </div>
        `;

}


async function openReturn(id) {

    $("returnDetailsModal")
        .classList.add("open");

    $("returnDetailsModal")
        .setAttribute(
            "aria-hidden",
            "false"
        );

    $("returnModalBody")
        .innerHTML =
        `
            <div class="returns-state">
                <div class="returns-spinner"></div>
                <h3>Loading return</h3>
            </div>
        `;

    try {

        const data =
            await api(
                `/${id}`
            );

        renderDetails(data);

    } catch (error) {

        $("returnModalBody")
            .innerHTML =
            `
                <div class="returns-state">
                    <h3>Unable to load return</h3>
                    <p>
                        ${escapeHtml(error.message)}
                    </p>
                </div>
            `;

    }

}


function closeModal() {

    $("returnDetailsModal")
        .classList.remove("open");

    $("returnDetailsModal")
        .setAttribute(
            "aria-hidden",
            "true"
        );

    state.currentReturn =
        null;

    state.paymentSettlement =
        null;

}


async function reloadCurrentReturn() {

    const id =
        valueOf(
            state.currentReturn,
            "id",
            "return_id"
        );

    if (id) {
        await openReturn(id);
    }

    await loadReturns();

}


async function reviewReturn(
    decision
) {

    const id =
        valueOf(
            state.currentReturn,
            "id",
            "return_id"
        );

    const notes =
        window.prompt(
            decision === "approve"
                ? "Optional approval notes:"
                : "Reason / administrative notes:"
        );

    if (notes === null) {
        return;
    }

    await api(
        `/${id}/review`,
        {
            method: "PUT",

            body:
                JSON.stringify({
                    decision,
                    admin_notes: notes
                })
        }
    );

    showMessage(
        `Return ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : decision} successfully.`,
        "success"
    );

    await reloadCurrentReturn();

}


async function receiveReturn() {

    const id =
        valueOf(
            state.currentReturn,
            "id",
            "return_id"
        );

    const notes =
        window.prompt(
            "Receiving notes (optional):"
        );

    if (notes === null) {
        return;
    }

    await api(
        `/${id}/receive`,
        {
            method: "PUT",

            body:
                JSON.stringify({
                    notes
                })
        }
    );

    showMessage(
        "Returned goods marked as received.",
        "success"
    );

    await reloadCurrentReturn();

}


async function inspectReturn() {

    const id =
        valueOf(
            state.currentReturn,
            "id",
            "return_id"
        );

    const cards =
        [
            ...document.querySelectorAll(
                "[data-inspection-item]"
            )
        ];

    const items =
        cards.map(
            card => ({
                return_item_id:
                    Number(
                        card.dataset
                            .inspectionItem
                    ),

                accepted_quantity:
                    Number(
                        card.querySelector(
                            "[data-accepted-quantity]"
                        ).value
                    ),

                condition_status:
                    card.querySelector(
                        "[data-condition-status]"
                    ).value,

                inspection_notes:
                    card.querySelector(
                        "[data-inspection-notes]"
                    ).value.trim()
            })
        );

    await api(
        `/${id}/inspect`,
        {
            method: "PUT",

            body:
                JSON.stringify({
                    items,
                    inspection_notes:
                        "Inspection completed from ERP."
                })
        }
    );

    showMessage(
        "Return inspection saved.",
        "success"
    );

    await reloadCurrentReturn();

}



function renderSettlementPanel(
    settlement = {}
) {

    const approved =
        Number(
            settlement
                .approved_return_amount || 0
        );

    const grossPaid =
        Number(
            settlement
                .gross_paid_amount || 0
        );

    const alreadyRefunded =
        Number(
            settlement
                .already_refunded_amount || 0
        );

    const refundable =
        Number(
            settlement
                .refundable_amount || 0
        );

    const maximumRefund =
        Number(
            settlement
                .maximum_return_refund || 0
        );

    const unpaidCod =
        settlement.unpaid_cod === true;

    const monetaryAvailable =
        settlement
            .monetary_refund_available === true;

    return `
        <section class="return-section return-settlement">

            <div class="settlement-heading">
                <div>
                    <span class="section-label">
                        Return Settlement
                    </span>

                    <h3>
                        Financial Settlement
                    </h3>
                </div>

                <span class="return-status ${
                    monetaryAvailable
                        ? "approved"
                        : "completed"
                }">
                    ${
                        monetaryAvailable
                            ? "Refund Available"
                            : "No Monetary Refund"
                    }
                </span>
            </div>


            <div class="settlement-grid">

                <div class="settlement-card">
                    <span>Inspected Return Value</span>
                    <strong>
                        ${money(approved)}
                    </strong>
                </div>

                <div class="settlement-card">
                    <span>Recorded Gross Payment</span>
                    <strong>
                        ${money(grossPaid)}
                    </strong>
                </div>

                <div class="settlement-card">
                    <span>Already Refunded</span>
                    <strong>
                        ${money(alreadyRefunded)}
                    </strong>
                </div>

                <div class="settlement-card">
                    <span>Available to Refund</span>
                    <strong>
                        ${money(refundable)}
                    </strong>
                </div>

                <div class="settlement-card highlight">
                    <span>Maximum Return Refund</span>
                    <strong>
                        ${money(maximumRefund)}
                    </strong>
                </div>

                <div class="settlement-card">
                    <span>Payment Status</span>
                    <strong>
                        ${escapeHtml(
                            settlement
                                .payment_status ||
                            "Pending"
                        )}
                    </strong>
                </div>

            </div>


            ${
                unpaidCod
                    ? `
                    <div class="settlement-note warning">

                        <i class="fa-solid fa-triangle-exclamation"></i>

                        <div>
                            <strong>
                                No monetary refund required
                            </strong>

                            <p>
                                This Cash on Delivery order has no recorded paid transaction.
                                Complete the merchandise return without issuing a cash refund.
                            </p>
                        </div>

                    </div>
                    `
                    : monetaryAvailable
                        ? `
                        <div class="settlement-note success">

                            <i class="fa-solid fa-circle-check"></i>

                            <div>
                                <strong>
                                    Monetary refund is available
                                </strong>

                                <p>
                                    Up to ${money(maximumRefund)} may be refunded against recorded paid transactions.
                                </p>
                            </div>

                        </div>
                        `
                        : `
                        <div class="settlement-note">

                            <i class="fa-solid fa-circle-info"></i>

                            <div>
                                <strong>
                                    No refundable payment balance
                                </strong>

                                <p>
                                    The return can be completed without issuing a monetary refund.
                                </p>
                            </div>

                        </div>
                        `
            }

        </section>
    `;

}


async function completeReturn() {

    const id =
        valueOf(
            state.currentReturn,
            "id",
            "return_id"
        );

    const settlement =
        state.paymentSettlement ||
        {};

    const maximumRefund =
        Math.max(
            0,
            Number(
                settlement
                    .maximum_return_refund || 0
            )
        );

    const monetaryAvailable =
        settlement
            .monetary_refund_available === true &&
        maximumRefund > 0;

    const unpaidCod =
        settlement.unpaid_cod === true;

    const restock =
        window.confirm(
            "Restock eligible Good/Opened items into inventory?"
        );

    let issueRefund =
        monetaryAvailable;

    let refundAmount =
        monetaryAvailable
            ? maximumRefund
            : 0;

    if (monetaryAvailable) {

        const refundInput =
            window.prompt(
                `Refund amount (maximum ${money(maximumRefund)}):`,
                maximumRefund.toFixed(2)
            );

        if (refundInput === null) {
            return;
        }

        refundAmount =
            Number(refundInput);

        if (
            !Number.isFinite(refundAmount) ||
            refundAmount < 0 ||
            refundAmount > maximumRefund
        ) {

            throw new Error(
                `Refund amount must be between PKR 0.00 and ${money(maximumRefund)}.`
            );
        }

        issueRefund =
            refundAmount > 0;
    }

    const confirmationMessage =
        issueRefund
            ? `Complete this return and issue ${money(refundAmount)} refund?`
            : unpaidCod
                ? "This COD order has no recorded payment. Complete the merchandise return without issuing a monetary refund?"
                : "Complete this return without issuing a monetary refund?";

    const confirmed =
        window.confirm(
            confirmationMessage
        );

    if (!confirmed) {
        return;
    }

    await api(
        `/${id}/complete`,
        {
            method: "PUT",

            body:
                JSON.stringify({
                    issue_refund:
                        issueRefund,

                    restock,

                    refund_amount:
                        refundAmount,

                    notes:
                        unpaidCod &&
                        !issueRefund
                            ? "Return completed without monetary refund because no paid COD transaction was recorded."
                            : null
                })
        }
    );

    showMessage(
        issueRefund
            ? `Return completed and ${money(refundAmount)} refund recorded successfully.`
            : "Return completed successfully without a monetary refund.",
        "success"
    );

    await reloadCurrentReturn();
}


async function handleAction(action) {

    try {

        clearMessage();

        if (action === "approve") {
            await reviewReturn("approve");
        }

        if (action === "reject") {
            await reviewReturn("reject");
        }

        if (action === "receive") {
            await receiveReturn();
        }

        if (action === "inspect") {
            await inspectReturn();
        }

        if (action === "complete") {
            await completeReturn();
        }

    } catch (error) {

        showMessage(
            error.message ||
            "Return operation failed."
        );

    }

}


async function loadReturns() {

    clearMessage();

    $("returnsLoading")
        .classList.remove("hidden");

    $("returnsTableWrapper")
        .classList.add("hidden");

    $("returnsEmptyState")
        .classList.add("hidden");

    try {

        const [
            listData,
            summaryData
        ] =
            await Promise.all([
                api(""),
                api("/summary")
            ]);

        state.returns =
            normalizeArray(listData);

        renderSummary(
            summaryData?.summary ||
            summaryData ||
            {},
            state.returns
        );

        renderTable();

    } catch (error) {

        $("returnsLoading")
            .classList.add("hidden");

        showMessage(
            error.message ||
            "Unable to load customer returns."
        );

    }

}


$("returnFiltersForm")
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();

            renderTable();

        }
    );


$("clearReturnFiltersButton")
    .addEventListener(
        "click",
        () => {

            $("returnSearch").value = "";
            $("returnStatusFilter").value = "";
            $("returnLimitFilter").value = "20";

            renderTable();

        }
    );


$("refreshReturnsButton")
    .addEventListener(
        "click",
        loadReturns
    );


document.addEventListener(
    "click",
    event => {

        const view =
            event.target.closest(
                "[data-return-id]"
            );

        if (view) {

            openReturn(
                view.dataset.returnId
            );

            return;
        }


        if (
            event.target.closest(
                "[data-close-return-modal]"
            )
        ) {

            closeModal();

            return;
        }


        const action =
            event.target.closest(
                "[data-action]"
            );

        if (action) {

            handleAction(
                action.dataset.action
            );

        }

    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            $("returnDetailsModal")
                .classList.contains("open")
        ) {
            closeModal();
        }

    }
);


loadReturns();
