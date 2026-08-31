"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const COUPONS_API =
    RUKHNAV_ORIGIN + "/api/coupons";

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
    coupons: [],
    currentCoupon: null,
    page: 1,
    limit: 20,
    totalRecords: 0,
    totalPages: 1,
    search: "",
    couponType: "",
    discountType: "",
    status: "",
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
            `${COUPONS_API}${endpoint}`,
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
        $("couponsMessage");

    if (!element) {
        return;
    }

    clearTimeout(
        messageTimer
    );

    element.textContent =
        text;

    element.className =
        `coupons-message show ${type}`;

    if (autoHide) {
        messageTimer =
            setTimeout(
                () => {
                    element.textContent = "";
                    element.className =
                        "coupons-message";
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

    if (state.couponType) {
        query.set(
            "coupon_type",
            state.couponType
        );
    }

    if (state.discountType) {
        query.set(
            "discount_type",
            state.discountType
        );
    }

    if (state.status) {
        query.set(
            "status",
            state.status
        );
    }

    return query.toString();
}

function setListState(mode) {
    $("couponsLoading")
        .classList.toggle(
            "hidden",
            mode !== "loading"
        );

    $("couponsEmptyState")
        .classList.toggle(
            "hidden",
            mode !== "empty"
        );

    $("couponsTableWrapper")
        .classList.toggle(
            "hidden",
            mode !== "table"
        );

    $("couponsPagination")
        .classList.toggle(
            "hidden",
            mode !== "table"
        );
}

function renderTypeBreakdown(
    breakdown
) {
    const target =
        $("couponTypeBreakdown");

    if (
        !Array.isArray(breakdown) ||
        breakdown.length === 0
    ) {
        target.innerHTML = `
            <article class="type-card">
                <span>No coupon type data</span>
                <strong>0 coupons</strong>
                <small>0 uses</small>
            </article>
        `;

        return;
    }

    target.innerHTML =
        breakdown
            .map(item => `
                <article class="type-card">
                    <span>
                        ${escapeHtml(
                            item.couponType ||
                            "Unknown"
                        )}
                    </span>
                    <strong>
                        ${formatNumber(
                            item.couponCount
                        )} coupon(s)
                    </strong>
                    <small>
                        ${formatNumber(
                            item.totalUses
                        )} total use(s)
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

        const dashboard =
            data.dashboard || {};

        $("totalCoupons").textContent =
            formatNumber(
                dashboard.totalCoupons
            );

        $("activeCoupons").textContent =
            formatNumber(
                dashboard.activeCoupons
            );

        $("expiredCoupons").textContent =
            formatNumber(
                dashboard.expiredCoupons
            );

        $("inactiveCoupons").textContent =
            formatNumber(
                dashboard.inactiveCoupons
            );

        $("exhaustedCoupons").textContent =
            formatNumber(
                dashboard.exhaustedCoupons
            );

        $("totalUses").textContent =
            formatNumber(
                dashboard.totalUses
            );

        $("averageDiscountValue").textContent =
            formatNumber(
                dashboard.averageDiscountValue
            );

        renderTypeBreakdown(
            data.typeBreakdown
        );
    } catch (error) {
        console.error(
            "Coupon dashboard error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load coupon dashboard.",
            "error"
        );
    }
}

async function loadCoupons() {
    state.loading = true;

    setListState(
        "loading"
    );

    try {
        const data =
            await request(
                `?${buildQuery()}`
            );

        state.coupons =
            Array.isArray(
                data.coupons
            )
                ? data.coupons
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
            state.coupons.length === 0
        ) {
            setListState(
                "empty"
            );

            $("couponResultsText")
                .textContent =
                "No coupon records were found.";

            return;
        }

        renderCoupons();
        renderPagination();
        setListState(
            "table"
        );
    } catch (error) {
        state.coupons = [];

        setListState(
            "empty"
        );

        showMessage(
            error.message ||
            "Unable to load coupons.",
            "error",
            false
        );
    } finally {
        state.loading = false;
    }
}

function formatDiscount(
    coupon
) {
    if (
        coupon.discount_type ===
        "percentage"
    ) {
        return `${toNumber(
            coupon.discount_value
        )}%`;
    }

    return formatMoney(
        coupon.discount_value
    );
}

function renderCoupons() {
    $("couponsTableBody")
        .innerHTML =
        state.coupons
            .map(coupon => {
                const availability =
                    coupon.availability_status ||
                    (
                        coupon.status ===
                        "active"
                            ? "Active"
                            : "Inactive"
                    );

                return `
                    <tr>
                        <td>
                            <span class="coupon-code">
                                ${escapeHtml(
                                    coupon.code
                                )}
                            </span>
                            <br>
                            <small>
                                #${escapeHtml(
                                    coupon.id
                                )}
                            </small>
                        </td>

                        <td>
                            ${escapeHtml(
                                coupon.coupon_type ||
                                "Promotion"
                            )}
                        </td>

                        <td>
                            <div class="customer-cell">
                                <strong>
                                    ${escapeHtml(
                                        coupon.customer_name ||
                                        "All Customers"
                                    )}
                                </strong>
                                <small>
                                    ${escapeHtml(
                                        coupon.customer_email ||
                                        coupon.customer_phone ||
                                        "General coupon"
                                    )}
                                </small>
                            </div>
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(
                                    formatDiscount(
                                        coupon
                                    )
                                )}
                            </strong>
                            <br>
                            <small>
                                ${escapeHtml(
                                    coupon.discount_type
                                )}
                            </small>
                        </td>

                        <td>
                            ${formatMoney(
                                coupon.minimum_order
                            )}
                        </td>

                        <td>
                            ${formatNumber(
                                coupon.used_count
                            )}
                            /
                            ${
                                coupon.usage_limit ===
                                null
                                    ? "∞"
                                    : formatNumber(
                                        coupon.usage_limit
                                    )
                            }
                        </td>

                        <td>
                            ${formatDate(
                                coupon.expiry_date
                            )}
                        </td>

                        <td>
                            <span class="
                                coupon-status-badge
                                status-${escapeHtml(
                                    slugify(
                                        availability
                                    )
                                )}
                            ">
                                ${escapeHtml(
                                    availability
                                )}
                            </span>
                        </td>

                        <td class="actions-column">
                            <div class="coupon-actions">
                                <button
                                    type="button"
                                    class="action-button"
                                    data-action="view"
                                    data-id="${escapeHtml(
                                        coupon.id
                                    )}"
                                    title="View coupon"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                </button>

                                <button
                                    type="button"
                                    class="action-button"
                                    data-action="edit"
                                    data-id="${escapeHtml(
                                        coupon.id
                                    )}"
                                    title="Edit coupon"
                                >
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>

                                <button
                                    type="button"
                                    class="action-button danger"
                                    data-action="delete"
                                    data-id="${escapeHtml(
                                        coupon.id
                                    )}"
                                    title="Delete coupon"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");

    $("couponResultsText")
        .textContent =
        `${formatNumber(
            state.totalRecords
        )} coupon record${
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

    $("couponPaginationInformation")
        .textContent =
        `Showing ${formatNumber(
            start
        )} to ${formatNumber(
            end
        )} of ${formatNumber(
            state.totalRecords
        )} coupons`;

    const pages =
        $("couponPaginationPages");

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

                await loadCoupons();
            }
        );

        pages.appendChild(
            button
        );
    }

    $("couponFirstPageButton")
        .disabled =
        state.page <= 1;

    $("couponPreviousPageButton")
        .disabled =
        state.page <= 1;

    $("couponNextPageButton")
        .disabled =
        state.page >=
        state.totalPages;

    $("couponLastPageButton")
        .disabled =
        state.page >=
        state.totalPages;
}

function openModal(id) {
    const modal =
        $(id);

    modal.classList.add(
        "open"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";
}

function closeModal(id) {
    const modal =
        typeof id === "string"
            ? $(id)
            : id;

    modal.classList.remove(
        "open"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    if (
        !document.querySelector(
            ".coupon-modal.open"
        )
    ) {
        document.body.style.overflow =
            "";
    }
}

function resetCouponForm() {
    $("couponForm")
        .reset();

    $("couponId").value =
        "";

    $("couponType").value =
        "Promotion";

    $("couponDiscountType").value =
        "percentage";

    $("couponMinimumOrder").value =
        "0";

    $("couponStatus").value =
        "active";

    $("couponFormTitle")
        .textContent =
        "Create Coupon";
}

function populateCouponForm(
    coupon
) {
    $("couponId").value =
        coupon.id ||
        "";

    $("couponCode").value =
        coupon.code ||
        "";

    $("couponType").value =
        coupon.coupon_type ||
        "Promotion";

    $("couponDiscountType").value =
        coupon.discount_type ||
        "percentage";

    $("couponDiscountValue").value =
        coupon.discount_value ||
        "";

    $("couponMinimumOrder").value =
        coupon.minimum_order ||
        0;

    $("couponUsageLimit").value =
        coupon.usage_limit ??
        "";

    $("couponExpiryDate").value =
        coupon.expiry_date
            ? String(
                coupon.expiry_date
            ).slice(0, 10)
            : "";

    $("couponStatus").value =
        coupon.status ||
        "active";

    $("couponCustomerId").value =
        coupon.customer_id ??
        "";

    $("couponFormTitle")
        .textContent =
        "Edit Coupon";
}

function couponPayload() {
    return {
        code:
            $("couponCode")
                .value
                .trim(),

        coupon_type:
            $("couponType")
                .value,

        discount_type:
            $("couponDiscountType")
                .value,

        discount_value:
            Number(
                $("couponDiscountValue")
                    .value
            ),

        minimum_order:
            Number(
                $("couponMinimumOrder")
                    .value ||
                0
            ),

        usage_limit:
            $("couponUsageLimit")
                .value
                .trim()
                ? Number(
                    $("couponUsageLimit")
                        .value
                )
                : null,

        expiry_date:
            $("couponExpiryDate")
                .value,

        status:
            $("couponStatus")
                .value,

        customer_id:
            $("couponCustomerId")
                .value
                .trim()
                ? Number(
                    $("couponCustomerId")
                        .value
                )
                : null
    };
}

async function saveCoupon(
    event
) {
    event.preventDefault();

    const id =
        $("couponId").value;

    const button =
        $("saveCouponButton");

    setButtonLoading(
        button,
        true,
        "Saving"
    );

    try {
        await request(
            id
                ? `/${encodeURIComponent(
                    id
                )}`
                : "",
            {
                method:
                    id
                        ? "PUT"
                        : "POST",
                body:
                    JSON.stringify(
                        couponPayload()
                    )
            }
        );

        closeModal(
            "couponFormModal"
        );

        showMessage(
            id
                ? "Coupon updated successfully."
                : "Coupon created successfully.",
            "success"
        );

        await Promise.all([
            loadDashboard(),
            loadCoupons()
        ]);
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to save coupon.",
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

function populateCouponDetails(
    coupon
) {
    state.currentCoupon =
        coupon;

    setText(
        "detailsCouponCode",
        coupon.code
    );

    setText(
        "detailsCouponType",
        coupon.coupon_type
    );

    setText(
        "detailsCouponCustomer",
        coupon.customer_name
            ? `${coupon.customer_name}${
                coupon.customer_email
                    ? ` · ${coupon.customer_email}`
                    : ""
            }`
            : "Available to all customers"
    );

    const availability =
        coupon.availability_status ||
        (
            coupon.status === "active"
                ? "Active"
                : "Inactive"
        );

    const badge =
        $("detailsCouponAvailability");

    badge.textContent =
        availability;

    badge.className =
        `coupon-status-badge status-${slugify(
            availability
        )}`;

    setText(
        "detailsDiscountType",
        coupon.discount_type
    );

    setText(
        "detailsDiscountValue",
        formatDiscount(
            coupon
        )
    );

    setText(
        "detailsMinimumOrder",
        formatMoney(
            coupon.minimum_order
        )
    );

    setText(
        "detailsUsedCount",
        formatNumber(
            coupon.used_count
        )
    );

    setText(
        "detailsUsageLimit",
        coupon.usage_limit ===
        null
            ? "Unlimited"
            : formatNumber(
                coupon.usage_limit
            )
    );

    setText(
        "detailsUsedAt",
        formatDateTime(
            coupon.used_at
        )
    );

    setText(
        "detailsExpiryDate",
        formatDate(
            coupon.expiry_date
        )
    );

    setText(
        "detailsStatus",
        coupon.status
    );

    setText(
        "detailsCreatedAt",
        formatDateTime(
            coupon.created_at
        )
    );

    $("editCouponFromDetailsButton")
        .dataset.id =
        coupon.id;
}

async function openCouponDetails(
    id
) {
    openModal(
        "couponDetailsModal"
    );

    $("couponDetailsLoading")
        .classList.remove(
            "hidden"
        );

    $("couponDetailsContent")
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

        populateCouponDetails(
            data.coupon
        );

        $("couponDetailsLoading")
            .classList.add(
                "hidden"
            );

        $("couponDetailsContent")
            .classList.remove(
                "hidden"
            );
    } catch (error) {
        closeModal(
            "couponDetailsModal"
        );

        showMessage(
            error.message ||
            "Unable to load coupon details.",
            "error"
        );
    }
}

async function editCoupon(
    id
) {
    try {
        const data =
            await request(
                `/${encodeURIComponent(
                    id
                )}`
            );

        populateCouponForm(
            data.coupon
        );

        openModal(
            "couponFormModal"
        );
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to load coupon.",
            "error"
        );
    }
}

async function deleteCoupon(
    id
) {
    const coupon =
        state.coupons.find(
            item =>
                String(item.id) ===
                String(id)
        );

    const confirmed =
        window.confirm(
            `Delete coupon "${
                coupon?.code ||
                id
            }"? This action cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    try {
        await request(
            `/${encodeURIComponent(
                id
            )}`,
            {
                method: "DELETE"
            }
        );

        showMessage(
            "Coupon deleted successfully.",
            "success"
        );

        await Promise.all([
            loadDashboard(),
            loadCoupons()
        ]);
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to delete coupon.",
            "error",
            false
        );
    }
}

function readFilters() {
    state.search =
        $("couponSearch")
            .value
            .trim();

    state.couponType =
        $("couponTypeFilter")
            .value;

    state.discountType =
        $("discountTypeFilter")
            .value;

    state.status =
        $("couponStatusFilter")
            .value;

    state.limit =
        Math.max(
            1,
            toNumber(
                $("couponLimitFilter")
                    .value ||
                20
            )
        );

    state.page = 1;
}

async function clearFilters() {
    $("couponFiltersForm")
        .reset();

    $("couponLimitFilter")
        .value =
        "20";

    state.search = "";
    state.couponType = "";
    state.discountType = "";
    state.status = "";
    state.limit = 20;
    state.page = 1;

    await loadCoupons();
}

function exportCsv() {
    if (
        state.coupons.length === 0
    ) {
        showMessage(
            "There are no coupons to export.",
            "info"
        );

        return;
    }

    const rows = [
        [
            "Coupon ID",
            "Code",
            "Type",
            "Customer",
            "Discount Type",
            "Discount Value",
            "Minimum Order",
            "Usage Limit",
            "Used Count",
            "Expiry Date",
            "Status",
            "Availability"
        ],
        ...state.coupons.map(
            coupon => [
                coupon.id,
                coupon.code,
                coupon.coupon_type,
                coupon.customer_name,
                coupon.discount_type,
                coupon.discount_value,
                coupon.minimum_order,
                coupon.usage_limit,
                coupon.used_count,
                coupon.expiry_date,
                coupon.status,
                coupon.availability_status
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
        `rukhnav-coupons-${
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
                ".coupon-modal-overlay"
            )
            .forEach(overlay => {
                overlay.addEventListener(
                    "click",
                    () =>
                        closeModal(
                            overlay.closest(
                                ".coupon-modal"
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
                            ".coupon-modal.open"
                        )
                        .forEach(
                            closeModal
                        );
                }
            }
        );

        $("createCouponButton")
            .addEventListener(
                "click",
                () => {
                    resetCouponForm();

                    openModal(
                        "couponFormModal"
                    );
                }
            );

        $("couponForm")
            .addEventListener(
                "submit",
                saveCoupon
            );

        $("couponFiltersForm")
            .addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    readFilters();

                    await loadCoupons();
                }
            );

        $("clearCouponFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("emptyClearCouponFiltersButton")
            .addEventListener(
                "click",
                clearFilters
            );

        $("exportCouponsButton")
            .addEventListener(
                "click",
                exportCsv
            );

        $("refreshCouponsButton")
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
                            loadCoupons()
                        ]);
                    } finally {
                        setButtonLoading(
                            event.currentTarget,
                            false
                        );
                    }
                }
            );

        $("couponsTableBody")
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
                        await openCouponDetails(
                            id
                        );
                    }

                    if (
                        action === "edit"
                    ) {
                        await editCoupon(
                            id
                        );
                    }

                    if (
                        action === "delete"
                    ) {
                        await deleteCoupon(
                            id
                        );
                    }
                }
            );

        $("editCouponFromDetailsButton")
            .addEventListener(
                "click",
                async event => {
                    const id =
                        event.currentTarget
                            .dataset.id;

                    closeModal(
                        "couponDetailsModal"
                    );

                    await editCoupon(
                        id
                    );
                }
            );

        $("couponFirstPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page = 1;
                    await loadCoupons();
                }
            );

        $("couponPreviousPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page =
                        Math.max(
                            1,
                            state.page - 1
                        );

                    await loadCoupons();
                }
            );

        $("couponNextPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page =
                        Math.min(
                            state.totalPages,
                            state.page + 1
                        );

                    await loadCoupons();
                }
            );

        $("couponLastPageButton")
            .addEventListener(
                "click",
                async () => {
                    state.page =
                        state.totalPages;

                    await loadCoupons();
                }
            );

        await Promise.all([
            loadDashboard(),
            loadCoupons()
        ]);
    }
);
