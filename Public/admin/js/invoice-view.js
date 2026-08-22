"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =========================================
// RUKHNAV ERP - Invoice Details
// =========================================

const INVOICE_API =
    RUKHNAV_ORIGIN + "/api/invoices";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken") ||
    "";

if (!token) {
    window.location.href =
        "login.html";
}

const parameters =
    new URLSearchParams(
        window.location.search
    );

const invoiceId =
    Number(
        parameters.get("id")
    );

if (
    !Number.isInteger(invoiceId) ||
    invoiceId <= 0
) {
    alert(
        "A valid invoice ID is required."
    );

    window.location.href =
        "invoices.html";
}

let currentInvoice = null;

const $ = (id) =>
    document.getElementById(id);

// =========================================
// Authorization Header
// =========================================

function getAuthorizationHeader() {
    return token.startsWith(
        "Bearer "
    )
        ? token
        : `Bearer ${token}`;
}

// =========================================
// Load Invoice
// =========================================

async function loadInvoiceDetails() {
    setLoading(true);
    hideAlert();

    try {
        const response =
            await fetch(
                `${INVOICE_API}/${invoiceId}`,
                {
                    method: "GET",

                    headers: {
                        Accept:
                            "application/json",

                        Authorization:
                            getAuthorizationHeader()
                    }
                }
            );

        if (response.status === 401) {
            clearAdminSession();

            window.location.href =
                "login.html";

            return;
        }

        let data = {};

        try {
            data =
                await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load the invoice."
            );
        }

        if (
            !data.success ||
            !data.invoice
        ) {
            throw new Error(
                data.message ||
                "Invoice data was not returned."
            );
        }

        currentInvoice =
            data.invoice;

        renderInvoice(
            data.invoice,
            Array.isArray(data.items)
                ? data.items
                : [],
            Array.isArray(data.returns)
                ? data.returns
                : [],
            Array.isArray(data.return_items)
                ? data.return_items
                : [],
            Array.isArray(data.payment_refunds)
                ? data.payment_refunds
                : [],
            Array.isArray(data.loyalty_adjustments)
                ? data.loyalty_adjustments
                : []
        );

        $("invoiceContent")
            ?.classList.remove(
                "d-none"
            );
    } catch (error) {
        console.error(
            "Load invoice error:",
            error
        );

        showAlert(
            error.message,
            "danger"
        );
    } finally {
        setLoading(false);
    }
}

// =========================================
// Render Invoice
// =========================================

function renderInvoice(
    invoice,
    items,
    returns = [],
    returnItems = [],
    paymentRefunds = [],
    loyaltyAdjustments = []
) {
    setText(
        "invoiceNumber",
        invoice.invoice_number ||
        "N/A"
    );

    setText(
        "invoiceDate",
        formatDateTime(
            invoice.invoice_date
        )
    );

    setText(
        "invoiceDueDate",
        formatDate(
            invoice.due_date
        )
    );

    setText(
        "saleNumber",
        invoice.sale_number ||
        (
            invoice.sale_id
                ? `Sale #${invoice.sale_id}`
                : "N/A"
        )
    );

    setText(
        "paymentMethod",
        invoice.payment_method ||
        "Not specified"
    );

    setText(
        "invoiceStatus",
        invoice.status ||
        "Issued"
    );

    setText(
        "customerName",
        invoice.full_name ||
        invoice.customer_name ||
        "N/A"
    );

    setText(
        "customerEmail",
        invoice.email ||
        "N/A"
    );

    setText(
        "customerPhone",
        invoice.phone ||
        "N/A"
    );

    setText(
        "customerAddress",
        invoice.address ||
        invoice.shipping_address ||
        "N/A"
    );

    setText(
        "invoiceRemarks",
        invoice.remarks ||
        "No remarks"
    );

    setText(
        "subtotal",
        formatMoney(
            invoice.subtotal
        )
    );

    setText(
        "productDiscountAmount",
        formatMoney(
            invoice.product_discount || 0
        )
    );

    setText(
        "couponDiscountAmount",
        formatMoney(
            invoice.coupon_discount || 0
        )
    );

    setText(
        "loyaltyDiscountAmount",
        formatMoney(
            invoice.loyalty_discount || 0
        )
    );

    setText(
        "rewardDiscountAmount",
        formatMoney(
            invoice.reward_discount || 0
        )
    );

    setText(
        "taxAmount",
        formatMoney(
            invoice.tax
        )
    );

    setText(
        "grandTotal",
        formatMoney(
            invoice.grand_total
        )
    );

    setText(
        "paidAmount",
        formatMoney(
            invoice.paid_amount
        )
    );

    setText(
        "refundedAmount",
        formatMoney(
            invoice.refunded_amount || 0
        )
    );

    setText(
        "netPaidAmount",
        formatMoney(
            invoice.net_paid_amount ?? invoice.paid_amount ?? 0
        )
    );

    setText(
        "balanceAmount",
        formatMoney(
            invoice.balance_amount
        )
    );

    setText(
        "refundStatus",
        invoice.refund_status || "None"
    );

    renderPaymentStatus(
        invoice.payment_status
    );

    renderReturnRefund(
        returns,
        returnItems,
        paymentRefunds,
        loyaltyAdjustments
    );

    renderItems(items);

    document.title =
        `${invoice.invoice_number || "Invoice"} | RUKHNAV ERP`;
}

// =========================================
// Render Payment Status
// =========================================

function renderPaymentStatus(status) {
    const element =
        $("paymentStatus");

    if (!element) return;

    const finalStatus =
        status || "Pending";

    let className =
        "bg-danger text-white";

    if (finalStatus === "Paid") {
        className =
            "bg-success text-white";
    } else if (
        finalStatus === "Partial"
    ) {
        className =
            "bg-warning text-dark";
    }

    element.innerHTML = `
        <span
            class="badge ${className} px-3 py-2 rounded-pill"
        >
            ${escapeHtml(
                finalStatus
            )}
        </span>
    `;
}


// =========================================
// Render Return / Refund
// =========================================

function renderReturnRefund(
    returns = [],
    returnItems = [],
    paymentRefunds = [],
    loyaltyAdjustments = []
) {
    const section =
        $("returnRefundSection");

    if (!section) return;

    if (
        !returns.length &&
        !paymentRefunds.length
    ) {
        section.classList.add(
            "d-none"
        );

        return;
    }

    section.classList.remove(
        "d-none"
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
        "returnNumber",
        returnNumbers || "-"
    );

    setText(
        "refundNumber",
        refundNumbers || "-"
    );

    setText(
        "returnStatus",
        latestReturn?.status ||
        "Refunded"
    );

    const refundDate =
        latestRefund?.completed_at ||
        latestReturn?.refunded_at ||
        latestReturn?.completed_at ||
        null;

    setText(
        "refundDate",
        refundDate
            ? formatDateTime(
                refundDate
            )
            : "-"
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
        "grossReturnValue",
        formatMoney(
            totals.gross
        )
    );

    setText(
        "returnCouponShare",
        formatMoney(
            totals.coupon
        )
    );

    setText(
        "returnLoyaltyShare",
        formatMoney(
            totals.loyalty
        )
    );

    setText(
        "returnRewardShare",
        formatMoney(
            totals.reward
        )
    );

    setText(
        "effectiveRefundValue",
        formatMoney(refunded)
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
        "rewardPointsRestored",
        String(restoredPoints)
    );

    setText(
        "earnedPointsReversed",
        String(reversedPoints)
    );

    const tbody =
        $("returnItemsBody");

    if (!tbody) return;

    if (!returnItems.length) {
        tbody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="text-center text-muted"
                >
                    No returned item details.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        returnItems
            .map(
                item => `
                    <tr>
                        <td>
                            ${escapeHtml(
                                item.product_name ||
                                `Product #${item.product_id}`
                            )}
                        </td>

                        <td class="text-center">
                            ${Number(
                                item.accepted_quantity ||
                                0
                            )}
                        </td>

                        <td class="text-end">
                            ${formatMoney(
                                item.gross_return_amount ||
                                0
                            )}
                        </td>

                        <td class="text-end fw-bold">
                            ${formatMoney(
                                item.effective_refund_amount ||
                                0
                            )}
                        </td>
                    </tr>
                `
            )
            .join("");
}

// =========================================
// Render Products
// =========================================

function renderItems(items) {
    const tableBody =
        $("itemsTable");

    if (!tableBody) return;

    if (items.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="text-center text-muted"
                >
                    No products were found for this invoice.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML =
        items
            .map(
                (item, index) => `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${escapeHtml(
                                item.product_name ||
                                "Product"
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                item.quantity
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.unit_price
                            )}
                        </td>

                        <td>
                            ${formatMoney(
                                item.discount
                            )}
                        </td>

                        <td>
                            <strong>
                                ${formatMoney(
                                    item.total
                                )}
                            </strong>
                        </td>

                    </tr>
                `
            )
            .join("");
}

// =========================================
// Open or Download PDF Securely
// =========================================

async function getInvoicePdf(
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
            pdfWindow.document.write(`
                <p
                    style="
                        padding: 20px;
                        font-family: Arial, sans-serif;
                    "
                >
                    Loading invoice PDF...
                </p>
            `);
        }
    }

    setPdfButtonsDisabled(true);

    try {
        const response =
            await fetch(
                `${INVOICE_API}/${invoiceId}/pdf`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            getAuthorizationHeader()
                    }
                }
            );

        if (response.status === 401) {
            if (pdfWindow) {
                pdfWindow.close();
            }

            clearAdminSession();

            window.location.href =
                "login.html";

            return;
        }

        if (!response.ok) {
            let message =
                "Unable to generate invoice PDF.";

            try {
                const errorData =
                    await response.json();

                message =
                    errorData.message ||
                    message;
            } catch (error) {
                // Keep the default message.
            }

            throw new Error(message);
        }

        const blob =
            await response.blob();

        if (
            !blob.type.includes(
                "pdf"
            )
        ) {
            throw new Error(
                "The server did not return a valid PDF."
            );
        }

        const pdfUrl =
            URL.createObjectURL(
                blob
            );

        if (download) {
            const link =
                document.createElement(
                    "a"
                );

            link.href =
                pdfUrl;

            link.download =
                `${
                    currentInvoice
                        ?.invoice_number ||
                    `invoice-${invoiceId}`
                }.pdf`;

            document.body.appendChild(
                link
            );

            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(
                    pdfUrl
                );
            }, 2000);
        } else if (pdfWindow) {
            pdfWindow.location.href =
                pdfUrl;

            setTimeout(() => {
                URL.revokeObjectURL(
                    pdfUrl
                );
            }, 60000);
        } else {
            throw new Error(
                "The browser blocked the PDF window. Please allow pop-ups."
            );
        }
    } catch (error) {
        console.error(
            "Invoice PDF error:",
            error
        );

        if (
            pdfWindow &&
            !pdfWindow.closed
        ) {
            pdfWindow.close();
        }

        showAlert(
            error.message,
            "danger"
        );
    } finally {
        setPdfButtonsDisabled(false);
    }
}

// =========================================
// Loading and Alerts
// =========================================

function setLoading(show) {
    $("invoiceLoading")
        ?.classList.toggle(
            "d-none",
            !show
        );
}

function showAlert(
    message,
    type = "danger"
) {
    const alert =
        $("invoiceAlert");

    if (!alert) return;

    alert.className =
        `alert alert-${type}`;

    alert.textContent =
        message;

    alert.classList.remove(
        "d-none"
    );
}

function hideAlert() {
    const alert =
        $("invoiceAlert");

    if (!alert) return;

    alert.classList.add(
        "d-none"
    );

    alert.textContent = "";
}

function setPdfButtonsDisabled(
    disabled
) {
    if ($("printBtn")) {
        $("printBtn").disabled =
            disabled;
    }

    if ($("downloadBtn")) {
        $("downloadBtn").disabled =
            disabled;
    }
}

// =========================================
// Formatting
// =========================================

function formatMoney(value) {
    return `PKR ${Number(
        value || 0
    ).toLocaleString(
        "en-PK",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;
}

function formatNumber(value) {
    return Number(
        value || 0
    ).toLocaleString("en-PK");
}

function formatDate(value) {
    if (!value) return "N/A";

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleDateString(
        "en-PK"
    );
}

function formatDateTime(value) {
    if (!value) return "N/A";

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleString(
        "en-PK",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}

function setText(id, value) {
    const element =
        $(id);

    if (element) {
        element.textContent =
            String(value ?? "");
    }
}

function escapeHtml(value) {
    const element =
        document.createElement(
            "div"
        );

    element.textContent =
        String(value ?? "");

    return element.innerHTML;
}

function clearAdminSession() {
    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "adminToken"
    );

    localStorage.removeItem(
        "admin"
    );

    sessionStorage.removeItem(
        "token"
    );

    sessionStorage.removeItem(
        "adminToken"
    );
}

// =========================================
// Events
// =========================================

$("printBtn")
    ?.addEventListener(
        "click",
        () => {
            getInvoicePdf(false);
        }
    );

$("downloadBtn")
    ?.addEventListener(
        "click",
        () => {
            getInvoicePdf(true);
        }
    );

document.addEventListener(
    "DOMContentLoaded",
    loadInvoiceDetails
);