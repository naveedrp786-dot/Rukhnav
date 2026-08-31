"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const INVOICE_API =
    RUKHNAV_ORIGIN + "/api/invoices";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken");

if (!token) {
    window.location.href = "login.html";
}

const state = {
    allInvoices: [],
    invoices: [],
    currentInvoice: null,
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    search: "",
    status: "",
    dateFrom: "",
    dateTo: ""
};

const $ = id =>
    document.getElementById(id);

async function request(
    endpoint = "",
    options = {}
) {
    const response =
        await fetch(
            `${INVOICE_API}${endpoint}`,
            {
                ...options,
                headers: {
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

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to complete the invoice request."
        );
    }

    return data;
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

    const date =
        new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? "—"
        : new Intl.DateTimeFormat(
            "en-PK",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        ).format(date);
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

let messageTimer;

function showMessage(
    text,
    type = "info",
    autoHide = true
) {
    const element =
        $("invoicesMessage");

    if (!element) {
        return;
    }

    clearTimeout(
        messageTimer
    );

    element.textContent =
        text;

    element.className =
        `invoices-message show ${type}`;

    if (autoHide) {
        messageTimer =
            setTimeout(
                () => {
                    element.textContent = "";
                    element.className =
                        "invoices-message";
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

function getDisplayStatus(
    invoice
) {
    if (
        invoice.status ===
        "Cancelled"
    ) {
        return "Cancelled";
    }

    return (
        invoice.payment_status ||
        invoice.status ||
        "Pending"
    );
}

function openModal() {
    const modal =
        $("invoiceDetailsModal");

    modal.classList.add("open");
    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";
}

function closeModal() {
    const modal =
        $("invoiceDetailsModal");

    modal.classList.remove("open");
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow =
        "";
}

function updateSummary() {
    const invoices =
        state.allInvoices;

    const paid =
        invoices.filter(
            invoice =>
                getDisplayStatus(
                    invoice
                ) === "Paid"
        ).length;

    const cancelled =
        invoices.filter(
            invoice =>
                getDisplayStatus(
                    invoice
                ) === "Cancelled"
        ).length;

    const partial =
        invoices.filter(
            invoice =>
                [
                    "Partial",
                    "Partially Paid"
                ].includes(
                    getDisplayStatus(
                        invoice
                    )
                )
        ).length;

    const pending =
        invoices.filter(
            invoice =>
                ![
                    "Paid",
                    "Cancelled",
                    "Partial",
                    "Partially Paid"
                ].includes(
                    getDisplayStatus(
                        invoice
                    )
                )
        ).length;

    const billed =
        invoices.reduce(
            (
                total,
                invoice
            ) =>
                total +
                toNumber(
                    invoice.grand_total
                ),
            0
        );

    const collected =
        invoices.reduce(
            (
                total,
                invoice
            ) =>
                total +
                toNumber(
                    invoice.paid_amount
                ),
            0
        );

    const balance =
        invoices.reduce(
            (
                total,
                invoice
            ) =>
                total +
                toNumber(
                    invoice.balance_amount
                ),
            0
        );

    $("totalInvoices").textContent =
        formatNumber(
            invoices.length
        );

    $("paidInvoices").textContent =
        formatNumber(paid);

    $("pendingInvoices").textContent =
        formatNumber(pending);

    $("partialInvoices").textContent =
        formatNumber(partial);

    $("cancelledInvoices").textContent =
        formatNumber(cancelled);

    $("totalBilled").textContent =
        formatMoney(billed);

    $("totalCollected").textContent =
        formatMoney(collected);

    $("totalBalance").textContent =
        formatMoney(balance);
}

function applyFilters() {
    let filtered =
        [...state.allInvoices];

    if (state.search) {
        const keyword =
            state.search
                .toLowerCase();

        filtered =
            filtered.filter(
                invoice =>
                    [
                        invoice.invoice_number,
                        invoice.order_number,
                        invoice.customer_name,
                        invoice.full_name,
                        invoice.phone,
                        invoice.email
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                        .includes(keyword)
            );
    }

    if (state.status) {
        filtered =
            filtered.filter(
                invoice =>
                    getDisplayStatus(
                        invoice
                    ) ===
                    state.status
            );
    }

    if (state.dateFrom) {
        filtered =
            filtered.filter(
                invoice => {
                    const value =
                        invoice.invoice_date ||
                        invoice.created_at;

                    if (!value) {
                        return false;
                    }

                    return value
                        .slice(0, 10) >=
                        state.dateFrom;
                }
            );
    }

    if (state.dateTo) {
        filtered =
            filtered.filter(
                invoice => {
                    const value =
                        invoice.invoice_date ||
                        invoice.created_at;

                    if (!value) {
                        return false;
                    }

                    return value
                        .slice(0, 10) <=
                        state.dateTo;
                }
            );
    }

    state.total =
        filtered.length;

    state.totalPages =
        Math.max(
            1,
            Math.ceil(
                state.total /
                state.limit
            )
        );

    if (
        state.page >
        state.totalPages
    ) {
        state.page =
            state.totalPages;
    }

    const start =
        (
            state.page - 1
        ) * state.limit;

    state.invoices =
        filtered.slice(
            start,
            start + state.limit
        );

    renderInvoices();
    renderPagination();
}

async function loadInvoices() {
    $("invoicesLoading")
        .classList.remove("hidden");

    $("invoicesTableWrapper")
        .classList.add("hidden");

    $("invoicesEmptyState")
        .classList.add("hidden");

    $("invoicesPagination")
        .classList.add("hidden");

    try {
        const data =
            await request("");

        state.allInvoices =
            Array.isArray(
                data.invoices
            )
                ? data.invoices
                : [];

        updateSummary();

        state.page = 1;

        applyFilters();
    } catch (error) {
        state.allInvoices = [];
        state.invoices = [];

        $("invoicesLoading")
            .classList.add("hidden");

        $("invoicesEmptyState")
            .classList.remove("hidden");

        showMessage(
            error.message ||
            "Unable to load invoices.",
            "error",
            false
        );
    }
}

function renderInvoices() {
    $("invoicesLoading")
        .classList.add("hidden");

    if (
        state.invoices.length === 0
    ) {
        $("invoicesTableWrapper")
            .classList.add("hidden");

        $("invoicesPagination")
            .classList.add("hidden");

        $("invoicesEmptyState")
            .classList.remove("hidden");

        $("invoiceResultsText")
            .textContent =
            "No invoice records were found.";

        return;
    }

    $("invoicesEmptyState")
        .classList.add("hidden");

    $("invoicesTableWrapper")
        .classList.remove("hidden");

    $("invoicesPagination")
        .classList.remove("hidden");

    $("invoicesTableBody")
        .innerHTML =
        state.invoices
            .map(invoice => {
                const status =
                    getDisplayStatus(
                        invoice
                    );

                return `
                    <tr>
                        <td>
                            <span class="invoice-number">
                                ${escapeHtml(
                                    invoice.invoice_number ||
                                    `Invoice #${invoice.id}`
                                )}
                            </span>
                            <br>
                            <small>
                                #${escapeHtml(
                                    invoice.id
                                )}
                            </small>
                        </td>

                        <td>
                            <div class="customer-cell">
                                <strong>
                                    ${escapeHtml(
                                        invoice.customer_name ||
                                        invoice.full_name ||
                                        "Unknown Customer"
                                    )}
                                </strong>
                                <small>
                                    ${escapeHtml(
                                        invoice.email ||
                                        invoice.phone ||
                                        "No contact"
                                    )}
                                </small>
                            </div>
                        </td>

                        <td>
                            ${formatDate(
                                invoice.invoice_date ||
                                invoice.created_at
                            )}
                        </td>

                        <td>
                            <strong>
                                ${formatMoney(
                                    invoice.grand_total
                                )}
                            </strong>
                        </td>

                        <td>
                            ${formatMoney(
                                invoice.paid_amount
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                invoice.balance_amount
                            )}
                        </td>

                        <td>
                            <span class="
                                invoice-status-badge
                                status-${escapeHtml(
                                    slugify(status)
                                )}
                            ">
                                ${escapeHtml(status)}
                            </span>
                        </td>

                        <td class="actions-column">
                            <div class="invoice-actions">
                                <button
                                    type="button"
                                    class="action-button"
                                    data-action="view"
                                    data-id="${escapeHtml(
                                        invoice.id
                                    )}"
                                    title="View invoice"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                </button>

                                <button
                                    type="button"
                                    class="action-button"
                                    data-action="print"
                                    data-id="${escapeHtml(
                                        invoice.id
                                    )}"
                                    title="Open PDF"
                                >
                                    <i class="fa-solid fa-print"></i>
                                </button>

                                <button
                                    type="button"
                                    class="action-button"
                                    data-action="download"
                                    data-id="${escapeHtml(
                                        invoice.id
                                    )}"
                                    title="Download PDF"
                                >
                                    <i class="fa-solid fa-download"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");

    $("invoiceResultsText")
        .textContent =
        `${formatNumber(
            state.total
        )} invoice record${
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

    $("invoicePaginationInformation")
        .textContent =
        `Showing ${formatNumber(
            start
        )} to ${formatNumber(
            end
        )} of ${formatNumber(
            state.total
        )} invoices`;

    const pages =
        $("invoicePaginationPages");

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
            () => {
                state.page =
                    page;

                applyFilters();
            }
        );

        pages.appendChild(
            button
        );
    }

    $("invoiceFirstPageButton")
        .disabled =
        state.page <= 1;

    $("invoicePreviousPageButton")
        .disabled =
        state.page <= 1;

    $("invoiceNextPageButton")
        .disabled =
        state.page >=
        state.totalPages;

    $("invoiceLastPageButton")
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

    if (element) {
        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "—"
                : String(value);
    }
}

function populateDetails(
    data
) {
    const invoice =
        data.invoice ||
        data;

    const items =
        data.items ||
        invoice.items ||
        [];

    const returns =
        Array.isArray(data.returns)
            ? data.returns
            : [];

    const returnItems =
        Array.isArray(data.return_items)
            ? data.return_items
            : [];

    const paymentRefunds =
        Array.isArray(data.payment_refunds)
            ? data.payment_refunds
            : [];

    const loyaltyAdjustments =
        Array.isArray(data.loyalty_adjustments)
            ? data.loyalty_adjustments
            : [];

    state.currentInvoice =
        invoice;

    setText(
        "detailsInvoiceNumber",
        invoice.invoice_number ||
        `Invoice #${invoice.id}`
    );

    setText(
        "detailsInvoiceDate",
        formatDate(
            invoice.invoice_date ||
            invoice.created_at
        )
    );

    setText(
        "detailsCustomerName",
        invoice.customer_name ||
        invoice.full_name
    );

    setText(
        "detailsCustomerEmail",
        invoice.email
    );

    setText(
        "detailsCustomerPhone",
        invoice.phone
    );

    setText(
        "detailsCustomerAddress",
        invoice.address ||
        invoice.delivery_address ||
        invoice.shipping_address
    );

    setText(
        "detailsInvoiceId",
        invoice.id
    );

    setText(
        "detailsOrderNumber",
        invoice.order_number ||
        (
            invoice.order_id
                ? `Order #${invoice.order_id}`
                : "—"
        )
    );

    setText(
        "detailsInvoiceStatus",
        invoice.status ||
        "Active"
    );

    setText(
        "detailsPaymentStatus",
        invoice.payment_status ||
        "Pending"
    );

    setText(
        "detailsSubtotal",
        formatMoney(
            invoice.subtotal
        )
    );

    setText(
        "detailsProductDiscount",
        formatMoney(
            invoice.product_discount || 0
        )
    );

    setText(
        "detailsCouponDiscount",
        formatMoney(
            invoice.coupon_discount || 0
        )
    );

    setText(
        "detailsLoyaltyDiscount",
        formatMoney(
            invoice.loyalty_discount || 0
        )
    );

    setText(
        "detailsRewardDiscount",
        formatMoney(
            invoice.reward_discount || 0
        )
    );

    setText(
        "detailsTax",
        formatMoney(
            invoice.tax_amount ||
            invoice.tax ||
            0
        )
    );

    setText(
        "detailsDelivery",
        formatMoney(
            invoice.shipping_charges ??
            invoice.delivery_charges ??
            0
        )
    );

    setText(
        "detailsGrandTotal",
        formatMoney(
            invoice.grand_total
        )
    );

    setText(
        "detailsPaidAmount",
        formatMoney(
            invoice.paid_amount
        )
    );

    setText(
        "detailsRefundedAmount",
        formatMoney(
            invoice.refunded_amount || 0
        )
    );

    const netPaid =
        invoice.net_paid_amount !== undefined &&
        invoice.net_paid_amount !== null
            ? Number(
                invoice.net_paid_amount
            )
            : Math.max(
                Number(
                    invoice.paid_amount || 0
                ) -
                Number(
                    invoice.refunded_amount || 0
                ),
                0
            );

    setText(
        "detailsNetPaidAmount",
        formatMoney(
            netPaid
        )
    );

    setText(
        "detailsBalanceAmount",
        formatMoney(
            invoice.balance_amount
        )
    );

    setText(
        "detailsRefundStatus",
        invoice.refund_status ||
        "None"
    );

    $("printInvoiceButton")
        .dataset.id =
        invoice.id;

    $("downloadInvoiceButton")
        .dataset.id =
        invoice.id;

    $("invoiceItemsTableBody")
        .innerHTML =
        items.length
            ? items
                .map(item => `
                    <tr>
                        <td>
                            ${escapeHtml(
                                item.product_name ||
                                item.item_name ||
                                `Product #${item.product_id || ""}`
                            )}
                        </td>
                        <td>
                            ${formatMoney(
                                item.price ||
                                item.unit_price
                            )}
                        </td>
                        <td>
                            ${formatNumber(
                                item.quantity
                            )}
                        </td>
                        <td>
                            ${formatMoney(
                                item.subtotal ||
                                item.line_total ||
                                item.total
                            )}
                        </td>
                    </tr>
                `)
                .join("")
            : `
                <tr>
                    <td
                        colspan="4"
                        style="text-align:center"
                    >
                        No invoice items found.
                    </td>
                </tr>
            `;

    const returnSection =
        $("invoiceReturnRefundSection");

    if (
        returnSection &&
        (
            returns.length ||
            paymentRefunds.length
        )
    ) {
        returnSection.classList.remove(
            "hidden"
        );

        const returnNumbers =
            returns
                .map(
                    row =>
                        row.return_number
                )
                .filter(Boolean)
                .join(", ");

        const refundNumbers =
            paymentRefunds
                .map(
                    row =>
                        row.refund_number
                )
                .filter(Boolean)
                .join(", ");

        const latestReturn =
            returns[0] || null;

        const latestRefund =
            paymentRefunds[0] || null;

        setText(
            "detailsReturnNumber",
            returnNumbers || "—"
        );

        setText(
            "detailsReturnStatus",
            latestReturn?.status || "—"
        );

        setText(
            "detailsRefundNumber",
            refundNumbers || "—"
        );

        setText(
            "detailsRefundDate",
            latestRefund?.completed_at
                ? formatDate(
                    latestRefund.completed_at
                )
                : latestReturn?.refunded_at
                    ? formatDate(
                        latestReturn.refunded_at
                    )
                    : "—"
        );

        const totals =
            returnItems.reduce(
                (sum, item) => {

                    sum.gross +=
                        Number(
                            item.gross_return_amount ||
                            0
                        );

                    sum.coupon +=
                        Number(
                            item.coupon_discount_share ||
                            0
                        );

                    sum.loyalty +=
                        Number(
                            item.loyalty_discount_share ||
                            0
                        );

                    sum.reward +=
                        Number(
                            item.reward_discount_share ||
                            0
                        );

                    return sum;
                },
                {
                    gross:0,
                    coupon:0,
                    loyalty:0,
                    reward:0
                }
            );

        const refunded =
            paymentRefunds.reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.amount || 0
                    ),
                0
            );

        setText(
            "detailsGrossReturn",
            formatMoney(
                totals.gross
            )
        );

        setText(
            "detailsReturnCouponShare",
            formatMoney(
                totals.coupon
            )
        );

        setText(
            "detailsReturnLoyaltyShare",
            formatMoney(
                totals.loyalty
            )
        );

        setText(
            "detailsReturnRewardShare",
            formatMoney(
                totals.reward
            )
        );

        setText(
            "detailsCashRefunded",
            formatMoney(
                refunded
            )
        );

        const restoredPoints =
            loyaltyAdjustments
                .filter(
                    row =>
                        String(
                            row.idempotency_key ||
                            ""
                        ).startsWith(
                            "reward-restoration:return:"
                        )
                )
                .reduce(
                    (sum, row) =>
                        sum +
                        Math.max(
                            0,
                            Number(
                                row.points_change ||
                                0
                            )
                        ),
                    0
                );

        const reversedPoints =
            loyaltyAdjustments
                .filter(
                    row =>
                        String(
                            row.idempotency_key ||
                            ""
                        ).startsWith(
                            "refund-reversal:sale:"
                        )
                )
                .reduce(
                    (sum, row) =>
                        sum +
                        Math.abs(
                            Number(
                                row.points_change ||
                                0
                            )
                        ),
                    0
                );

        setText(
            "detailsRewardPointsRestored",
            formatNumber(
                restoredPoints
            )
        );

        setText(
            "detailsEarnedPointsReversed",
            formatNumber(
                reversedPoints
            )
        );

        const returnBody =
            $("invoiceReturnItemsTableBody");

        if (returnBody) {
            returnBody.innerHTML =
                returnItems.length
                    ? returnItems
                        .map(
                            item => `
                                <tr>
                                    <td>
                                        ${escapeHtml(
                                            item.product_name ||
                                            `Product #${item.product_id || ""}`
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            item.accepted_quantity || 0
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            item.gross_return_amount || 0
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            item.effective_refund_amount || 0
                                        )}
                                    </td>
                                </tr>
                            `
                        )
                        .join("")
                    : `
                        <tr>
                            <td
                                colspan="4"
                                style="text-align:center"
                            >
                                No returned item details.
                            </td>
                        </tr>
                    `;
        }
    } else if (returnSection) {

        returnSection.classList.add(
            "hidden"
        );
    }

}

async function openDetails(
    id
) {
    openModal();

    $("invoiceDetailsLoading")
        .classList.remove(
            "hidden"
        );

    $("invoiceDetailsContent")
        .classList.add(
            "hidden"
        );

    try {
        const data =
            await request(
                `/${encodeURIComponent(
                    id
                )}`
            );

        populateDetails(data);

        $("invoiceDetailsLoading")
            .classList.add(
                "hidden"
            );

        $("invoiceDetailsContent")
            .classList.remove(
                "hidden"
            );
    } catch (error) {
        closeModal();

        showMessage(
            error.message ||
            "Unable to load invoice details.",
            "error"
        );
    }
}

async function getInvoicePdf(
    id,
    download = false
) {
    let pdfWindow = null;

    if (!download) {
        pdfWindow =
            window.open(
                "",
                "_blank"
            );

        if (pdfWindow) {
            pdfWindow.document.write(
                "<p style='font-family:Arial;padding:20px'>Loading invoice PDF...</p>"
            );
        }
    }

    try {
        const response =
            await fetch(
                `${INVOICE_API}/${encodeURIComponent(
                    id
                )}/pdf`,
                {
                    headers: {
                        Authorization:
                            token.startsWith(
                                "Bearer "
                            )
                                ? token
                                : `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {
            let errorMessage =
                "Unable to generate invoice PDF.";

            try {
                const data =
                    await response.json();

                errorMessage =
                    data.message ||
                    errorMessage;
            } catch (_) {
                // Keep default message.
            }

            throw new Error(
                errorMessage
            );
        }

        const blob =
            await response.blob();

        const url =
            URL.createObjectURL(
                blob
            );

        if (download) {
            const link =
                document.createElement(
                    "a"
                );

            link.href =
                url;

            link.download =
                `invoice-${id}.pdf`;

            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

            setTimeout(
                () =>
                    URL.revokeObjectURL(
                        url
                    ),
                2000
            );
        } else if (
            pdfWindow
        ) {
            pdfWindow.location.href =
                url;

            setTimeout(
                () =>
                    URL.revokeObjectURL(
                        url
                    ),
                60000
            );
        }
    } catch (error) {
        if (
            pdfWindow &&
            !pdfWindow.closed
        ) {
            pdfWindow.close();
        }

        showMessage(
            error.message,
            "error"
        );
    }
}

function readFilters() {
    state.search =
        $("invoiceSearch")
            .value
            .trim();

    state.status =
        $("invoiceStatusFilter")
            .value;

    state.dateFrom =
        $("invoiceDateFrom")
            .value;

    state.dateTo =
        $("invoiceDateTo")
            .value;

    state.limit =
        Math.max(
            1,
            toNumber(
                $("invoiceLimitFilter")
                    .value ||
                20
            )
        );

    state.page = 1;
}

function clearFilters() {
    $("invoiceFiltersForm")
        .reset();

    $("invoiceLimitFilter")
        .value =
        "20";

    state.search = "";
    state.status = "";
    state.dateFrom = "";
    state.dateTo = "";
    state.limit = 20;
    state.page = 1;

    applyFilters();
}

function exportCsv() {
    if (
        state.invoices.length === 0
    ) {
        showMessage(
            "There are no invoices to export.",
            "info"
        );

        return;
    }

    const rows = [
        [
            "Invoice ID",
            "Invoice Number",
            "Customer",
            "Email",
            "Phone",
            "Date",
            "Grand Total",
            "Paid",
            "Balance",
            "Status"
        ],
        ...state.invoices.map(
            invoice => [
                invoice.id,
                invoice.invoice_number,
                invoice.customer_name ||
                invoice.full_name,
                invoice.email,
                invoice.phone,
                invoice.invoice_date ||
                invoice.created_at,
                invoice.grand_total,
                invoice.paid_amount,
                invoice.balance_amount,
                getDisplayStatus(
                    invoice
                )
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
        `rukhnav-invoices-${
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

        $("invoiceDetailsModal")
            .querySelector(
                ".invoice-modal-overlay"
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

        $("invoiceFiltersForm")
            .addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    readFilters();

                    applyFilters();
                }
            );

        $("clearInvoiceFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("emptyClearInvoiceFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("exportInvoicesButton")
            .addEventListener(
                "click",
                exportCsv
            );

        $("refreshInvoicesButton")
            .addEventListener(
                "click",
                async event => {
                    setButtonLoading(
                        event.currentTarget,
                        true,
                        "Refreshing"
                    );

                    try {
                        await loadInvoices();
                    } finally {
                        setButtonLoading(
                            event.currentTarget,
                            false
                        );
                    }
                }
            );

        $("invoicesTableBody")
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
                        action ===
                        "view"
                    ) {
                        await openDetails(
                            id
                        );
                    }

                    if (
                        action ===
                        "print"
                    ) {
                        await getInvoicePdf(
                            id,
                            false
                        );
                    }

                    if (
                        action ===
                        "download"
                    ) {
                        await getInvoicePdf(
                            id,
                            true
                        );
                    }
                }
            );

        $("printInvoiceButton")
            .addEventListener(
                "click",
                event =>
                    getInvoicePdf(
                        event.currentTarget
                            .dataset.id,
                        false
                    )
            );

        $("downloadInvoiceButton")
            .addEventListener(
                "click",
                event =>
                    getInvoicePdf(
                        event.currentTarget
                            .dataset.id,
                        true
                    )
            );

        $("invoiceFirstPageButton")
            .addEventListener(
                "click",
                () => {
                    state.page = 1;
                    applyFilters();
                }
            );

        $("invoicePreviousPageButton")
            .addEventListener(
                "click",
                () => {
                    state.page =
                        Math.max(
                            1,
                            state.page - 1
                        );

                    applyFilters();
                }
            );

        $("invoiceNextPageButton")
            .addEventListener(
                "click",
                () => {
                    state.page =
                        Math.min(
                            state.totalPages,
                            state.page + 1
                        );

                    applyFilters();
                }
            );

        $("invoiceLastPageButton")
            .addEventListener(
                "click",
                () => {
                    state.page =
                        state.totalPages;

                    applyFilters();
                }
            );

        await loadInvoices();
    }
);
