"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

/* =====================================================
   RUKHNAV ERP — Customers Module
===================================================== */

const CUSTOMERS_API =
    RUKHNAV_ORIGIN + "/api/admin/customers";

const REFERRALS_API =
    RUKHNAV_ORIGIN + "/api/admin/referrals";

const adminToken =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken");

/* =====================================================
   Authentication Check
===================================================== */

if (!adminToken) {
    window.location.href = "/admin/login.html";
}

/* =====================================================
   Application State
===================================================== */

const customerState = {
    customers: [],
    currentCustomer: null,
    page: 1,
    limit: 20,
    totalRecords: 0,
    totalPages: 1,
    search: "",
    status: "",
    membership: "",
    verification: "",
    loading: false
};

/* =====================================================
   DOM References
===================================================== */

const elements = {
    totalCustomers:
        document.getElementById("totalCustomers"),

    activeCustomers:
        document.getElementById("activeCustomers"),

    pendingVerification:
        document.getElementById("pendingVerification"),

    suspendedCustomers:
        document.getElementById("suspendedCustomers"),

    inactiveCustomers:
        document.getElementById("inactiveCustomers"),

    newThisMonth:
        document.getElementById("newThisMonth"),

    customersMessage:
        document.getElementById("customersMessage"),

    customerFiltersForm:
        document.getElementById("customerFiltersForm"),

    customerSearch:
        document.getElementById("customerSearch"),

    statusFilter:
        document.getElementById("statusFilter"),

    membershipFilter:
        document.getElementById("membershipFilter"),

    verificationFilter:
        document.getElementById("verificationFilter"),

    limitFilter:
        document.getElementById("limitFilter"),

    clearFiltersButton:
        document.getElementById("clearFiltersButton"),

    emptyClearFiltersButton:
        document.getElementById(
            "emptyClearFiltersButton"
        ),

    refreshCustomersButton:
        document.getElementById(
            "refreshCustomersButton"
        ),

    exportCustomersButton:
        document.getElementById(
            "exportCustomersButton"
        ),

    customersLoading:
        document.getElementById("customersLoading"),

    customersEmptyState:
        document.getElementById(
            "customersEmptyState"
        ),

    customersTableWrapper:
        document.getElementById(
            "customersTableWrapper"
        ),

    customersTableBody:
        document.getElementById(
            "customersTableBody"
        ),

    customerResultsText:
        document.getElementById(
            "customerResultsText"
        ),

    customersPagination:
        document.getElementById(
            "customersPagination"
        ),

    paginationInformation:
        document.getElementById(
            "paginationInformation"
        ),

    paginationPages:
        document.getElementById(
            "paginationPages"
        ),

    firstPageButton:
        document.getElementById("firstPageButton"),

    previousPageButton:
        document.getElementById(
            "previousPageButton"
        ),

    nextPageButton:
        document.getElementById("nextPageButton"),

    lastPageButton:
        document.getElementById("lastPageButton"),

    customerDetailsModal:
        document.getElementById(
            "customerDetailsModal"
        ),

    customerDetailsLoading:
        document.getElementById(
            "customerDetailsLoading"
        ),

    customerDetailsContent:
        document.getElementById(
            "customerDetailsContent"
        ),

    editCustomerModal:
        document.getElementById(
            "editCustomerModal"
        ),

    editCustomerForm:
        document.getElementById(
            "editCustomerForm"
        ),

    customerStatusModal:
        document.getElementById(
            "customerStatusModal"
        ),

    customerStatusForm:
        document.getElementById(
            "customerStatusForm"
        ),

    deleteCustomerModal:
        document.getElementById(
            "deleteCustomerModal"
        ),

    confirmDeleteCustomerButton:
        document.getElementById(
            "confirmDeleteCustomerButton"
        ),

    customerAnalyticsModal:
        document.getElementById(
            "customerAnalyticsModal"
        ),

    customerAnalyticsButton:
        document.getElementById(
            "customerAnalyticsButton"
        ),

    customerActivityModal:
        document.getElementById(
            "customerActivityModal"
        ),

    customerActivityButton:
        document.getElementById(
            "customerActivityButton"
        ),

    customerVerificationModal:
        document.getElementById(
            "customerVerificationModal"
        ),

    customerVerificationForm:
        document.getElementById(
            "customerVerificationForm"
        ),

    customerVerificationButton:
        document.getElementById(
            "customerVerificationButton"
        ),

    resetCustomerPasswordModal:
        document.getElementById(
            "resetCustomerPasswordModal"
        ),

    resetCustomerPasswordForm:
        document.getElementById(
            "resetCustomerPasswordForm"
        ),

    resetCustomerPasswordButton:
        document.getElementById(
            "resetCustomerPasswordButton"
        )
};

/* =====================================================
   API Request Helper
===================================================== */

async function apiRequest(
    endpoint = "",
    options = {}
) {
    const response = await fetch(
        `${CUSTOMERS_API}${endpoint}`,
        {
            ...options,

            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminToken}`,
                ...(options.headers || {})
            }
        }
    );

    let data = {};

    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        localStorage.removeItem("token");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");

        sessionStorage.removeItem("token");
        sessionStorage.removeItem("adminToken");

        window.location.href = "/admin/login.html";

        throw new Error(
            data.message ||
            "Your admin session has expired."
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

/* =====================================================
   General Helpers
===================================================== */

function escapeHtml(value) {
    const element =
        document.createElement("div");

    element.textContent =
        value === null || value === undefined
            ? ""
            : String(value);

    return element.innerHTML;
}

function getInitials(name) {
    const cleanName =
        String(name || "Customer").trim();

    const words =
        cleanName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2);

    return (
        words
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase() || "CU"
    );
}

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-PK").format(
        toNumber(value)
    );
}

function formatCurrency(value) {
    return new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 2
        }
    ).format(toNumber(value));
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "en-PK",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(date);
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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
    ).format(date);
}

function booleanText(value) {
    return (
        value === true ||
        value === 1 ||
        value === "1"
    )
        ? "Enabled"
        : "Disabled";
}

function verificationText(value) {
    return value
        ? `Verified ${formatDate(value)}`
        : "Not verified";
}

function slugifyClass(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/* =====================================================
   Response Normalisation
===================================================== */

function getCustomerArray(data) {
    if (Array.isArray(data.customers)) {
        return data.customers;
    }

    if (
        data.data &&
        Array.isArray(data.data.customers)
    ) {
        return data.data.customers;
    }

    if (Array.isArray(data.data)) {
        return data.data;
    }

    if (Array.isArray(data.rows)) {
        return data.rows;
    }

    return [];
}

function getPaginationData(data) {
    const pagination =
        data.pagination ||
        data.data?.pagination ||
        data.meta?.pagination ||
        {};

    const totalRecords =
        pagination.totalRecords ??
        pagination.total ??
        pagination.totalItems ??
        data.totalRecords ??
        data.total ??
        0;

    const currentPage =
        pagination.currentPage ??
        pagination.page ??
        data.page ??
        customerState.page;

    const limit =
        pagination.limit ??
        pagination.perPage ??
        data.limit ??
        customerState.limit;

    const calculatedPages =
        Math.max(
            1,
            Math.ceil(
                toNumber(totalRecords) /
                Math.max(1, toNumber(limit))
            )
        );

    const totalPages =
        pagination.totalPages ??
        pagination.pages ??
        data.totalPages ??
        calculatedPages;

    return {
        totalRecords: toNumber(totalRecords),
        currentPage:
            Math.max(1, toNumber(currentPage)),
        limit:
            Math.max(1, toNumber(limit)),
        totalPages:
            Math.max(1, toNumber(totalPages))
    };
}

function getSingleCustomer(data) {
    return (
        data.customer ||
        data.data?.customer ||
        data.data ||
        null
    );
}

/* =====================================================
   Message Management
===================================================== */

let messageTimeout = null;

function showMessage(
    message,
    type = "info",
    autoHide = true
) {
    if (!elements.customersMessage) {
        return;
    }

    clearTimeout(messageTimeout);

    elements.customersMessage.textContent =
        message;

    elements.customersMessage.className =
        `customers-message show ${type}`;

    if (autoHide) {
        messageTimeout = setTimeout(() => {
            hideMessage();
        }, 4500);
    }
}

function hideMessage() {
    if (!elements.customersMessage) {
        return;
    }

    elements.customersMessage.textContent = "";
    elements.customersMessage.className =
        "customers-message";
}

/* =====================================================
   Button Loading Helper
===================================================== */

function setButtonLoading(
    button,
    loading,
    loadingText = "Please wait"
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
            ${escapeHtml(loadingText)}
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

/* =====================================================
   Loading States
===================================================== */

function showCustomerLoading() {
    customerState.loading = true;

    elements.customersLoading
        ?.classList.remove("hidden");

    elements.customersEmptyState
        ?.classList.add("hidden");

    elements.customersTableWrapper
        ?.classList.add("hidden");

    elements.customersPagination
        ?.classList.add("hidden");
}

function showCustomerEmptyState() {
    customerState.loading = false;

    elements.customersLoading
        ?.classList.add("hidden");

    elements.customersTableWrapper
        ?.classList.add("hidden");

    elements.customersPagination
        ?.classList.add("hidden");

    elements.customersEmptyState
        ?.classList.remove("hidden");
}

function showCustomerTable() {
    customerState.loading = false;

    elements.customersLoading
        ?.classList.add("hidden");

    elements.customersEmptyState
        ?.classList.add("hidden");

    elements.customersTableWrapper
        ?.classList.remove("hidden");

    elements.customersPagination
        ?.classList.remove("hidden");
}

/* =====================================================
   Load Dashboard Summary
===================================================== */

async function loadCustomerDashboard() {
    try {
        const data =
            await apiRequest("/dashboard");

        const dashboard =
            data.dashboard ||
            data.data?.dashboard ||
            {};

        if (elements.totalCustomers) {
            elements.totalCustomers.textContent =
                formatNumber(
                    dashboard.totalCustomers
                );
        }

        if (elements.activeCustomers) {
            elements.activeCustomers.textContent =
                formatNumber(
                    dashboard.activeCustomers
                );
        }

        if (elements.pendingVerification) {
            elements.pendingVerification.textContent =
                formatNumber(
                    dashboard.pendingVerification
                );
        }

        if (elements.suspendedCustomers) {
            elements.suspendedCustomers.textContent =
                formatNumber(
                    dashboard.suspendedCustomers
                );
        }

        if (elements.inactiveCustomers) {
            elements.inactiveCustomers.textContent =
                formatNumber(
                    dashboard.inactiveCustomers
                );
        }

        if (elements.newThisMonth) {
            elements.newThisMonth.textContent =
                formatNumber(
                    dashboard.newThisMonth
                );
        }
    } catch (error) {
        console.error(
            "Customer dashboard error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load customer summary.",
            "error"
        );
    }
}

/* =====================================================
   Build Customer Query
===================================================== */

function buildCustomerQuery() {
    const parameters =
        new URLSearchParams();

    parameters.set(
        "page",
        String(customerState.page)
    );

    parameters.set(
        "limit",
        String(customerState.limit)
    );

    if (customerState.search) {
        parameters.set(
            "search",
            customerState.search
        );
    }

    if (customerState.status) {
        parameters.set(
            "status",
            customerState.status
        );
    }

    if (customerState.membership) {
        parameters.set(
            "membership",
            customerState.membership
        );

        parameters.set(
            "membership_level",
            customerState.membership
        );
    }

    if (customerState.verification) {
        parameters.set(
            "verification",
            customerState.verification
        );
    }

    return parameters.toString();
}

/* =====================================================
   Load Customers
===================================================== */

async function loadCustomers() {
    showCustomerLoading();
    hideMessage();

    try {
        const query = buildCustomerQuery();

        const data =
            await apiRequest(`?${query}`);

        customerState.customers =
            getCustomerArray(data);

        const pagination =
            getPaginationData(data);

        customerState.totalRecords =
            pagination.totalRecords;

        customerState.page =
            pagination.currentPage;

        customerState.limit =
            pagination.limit;

        customerState.totalPages =
            pagination.totalPages;

        if (
            customerState.customers.length === 0
        ) {
            showCustomerEmptyState();

            if (elements.customerResultsText) {
                elements.customerResultsText
                    .textContent =
                    "No customer records were found.";
            }

            return;
        }

        showCustomerTable();
        renderCustomers();
        renderPagination();
    } catch (error) {
        console.error(
            "Load customers error:",
            error
        );

        customerState.customers = [];

        showCustomerEmptyState();

        showMessage(
            error.message ||
            "Unable to load customers.",
            "error",
            false
        );

        if (elements.customerResultsText) {
            elements.customerResultsText.textContent =
                "Customer records could not be loaded.";
        }
    }
}
/* =====================================================
   Customer Field Helpers
===================================================== */

function getCustomerName(customer) {
    return (
        customer.full_name ||
        customer.customer_name ||
        customer.name ||
        "Unnamed Customer"
    );
}

function getCustomerMembership(customer) {
    return (
        customer.membership_level ||
        customer.membershipLevel ||
        customer.membership ||
        "Bronze"
    );
}

function getCustomerStatus(customer) {
    return customer.status || "Inactive";
}

function getCustomerRewardPoints(customer) {
    return (
        customer.reward_points ??
        customer.available_points ??
        customer.rewardPoints ??
        0
    );
}

function getCustomerOrderCount(customer) {
    return (
        customer.total_orders ??
        customer.order_count ??
        customer.totalOrders ??
        0
    );
}

function getCustomerTotalSpent(customer) {
    return (
        customer.total_spent ??
        customer.lifetime_spend ??
        customer.totalSpent ??
        0
    );
}

/* =====================================================
   Render Customers Table
===================================================== */

function renderCustomers() {
    if (!elements.customersTableBody) {
        return;
    }

    elements.customersTableBody.innerHTML = "";

    customerState.customers.forEach(customer => {
        const customerId =
            customer.id ||
            customer.customer_id;

        const name =
            getCustomerName(customer);

        const status =
            getCustomerStatus(customer);

        const membership =
            getCustomerMembership(customer);

        const email =
            customer.email || "No email";

        const phone =
            customer.phone || "No phone";

        const rewardPoints =
            getCustomerRewardPoints(customer);

        const totalOrders =
            getCustomerOrderCount(customer);

        const totalSpent =
            getCustomerTotalSpent(customer);

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>
                <div class="customer-cell">

                    <div class="customer-avatar-small">
                        ${escapeHtml(getInitials(name))}
                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <small>
                            Customer #${escapeHtml(customerId)}
                        </small>

                    </div>

                </div>
            </td>

            <td>
                <div class="contact-cell">

                    <span>
                        ${escapeHtml(email)}
                    </span>

                    <small>
                        ${escapeHtml(phone)}
                    </small>

                </div>
            </td>

            <td>
                <span class="
                    status-badge
                    status-${escapeHtml(
                        slugifyClass(status)
                    )}
                ">
                    ${escapeHtml(status)}
                </span>
            </td>

            <td>
                <span class="
                    membership-badge
                    membership-${escapeHtml(
                        slugifyClass(membership)
                    )}
                ">
                    ${escapeHtml(membership)}
                </span>
            </td>

            <td>
                <strong>
                    ${formatNumber(rewardPoints)}
                </strong>
            </td>

            <td>
                ${formatNumber(totalOrders)}
            </td>

            <td class="amount-cell">
                ${formatCurrency(totalSpent)}
            </td>

            <td>
                ${formatDate(customer.created_at)}
            </td>

            <td class="actions-column">

                <div class="customer-actions">

                    <button
                        type="button"
                        class="action-button"
                        data-customer-action="view"
                        data-customer-id="${escapeHtml(customerId)}"
                        title="View customer"
                        aria-label="View customer"
                    >
                        <i class="fa-solid fa-eye"></i>
                    </button>

                    <button
                        type="button"
                        class="action-button"
                        data-customer-action="edit"
                        data-customer-id="${escapeHtml(customerId)}"
                        title="Edit customer"
                        aria-label="Edit customer"
                    >
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>

                    <button
                        type="button"
                        class="action-button"
                        data-customer-action="status"
                        data-customer-id="${escapeHtml(customerId)}"
                        title="Update status"
                        aria-label="Update customer status"
                    >
                        <i class="fa-solid fa-user-gear"></i>
                    </button>

                    <button
                        type="button"
                        class="action-button danger"
                        data-customer-action="delete"
                        data-customer-id="${escapeHtml(customerId)}"
                        data-customer-name="${escapeHtml(name)}"
                        title="Delete customer"
                        aria-label="Delete customer"
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>

                </div>

            </td>
        `;

        elements.customersTableBody
            .appendChild(row);
    });

    updateResultsInformation();
}

/* =====================================================
   Results Information
===================================================== */

function updateResultsInformation() {
    const start =
        customerState.totalRecords === 0
            ? 0
            : (
                customerState.page - 1
            ) * customerState.limit + 1;

    const end =
        Math.min(
            customerState.page *
            customerState.limit,
            customerState.totalRecords
        );

    if (elements.customerResultsText) {
        elements.customerResultsText.textContent =
            `${formatNumber(
                customerState.totalRecords
            )} customer record${
                customerState.totalRecords === 1
                    ? ""
                    : "s"
            } found.`;
    }

    if (elements.paginationInformation) {
        elements.paginationInformation.textContent =
            `Showing ${formatNumber(start)} to ` +
            `${formatNumber(end)} of ` +
            `${formatNumber(
                customerState.totalRecords
            )} customers`;
    }
}

/* =====================================================
   Pagination Rendering
===================================================== */

function createPageButton(pageNumber) {
    const button =
        document.createElement("button");

    button.type = "button";

    button.className =
        "pagination-page-button";

    button.textContent =
        String(pageNumber);

    button.dataset.page =
        String(pageNumber);

    if (
        pageNumber ===
        customerState.page
    ) {
        button.classList.add("active");

        button.setAttribute(
            "aria-current",
            "page"
        );
    }

    return button;
}

function renderPagination() {
    if (!elements.paginationPages) {
        return;
    }

    elements.paginationPages.innerHTML = "";

    const currentPage =
        customerState.page;

    const totalPages =
        customerState.totalPages;

    let startPage =
        Math.max(1, currentPage - 2);

    let endPage =
        Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) {
        endPage =
            Math.min(5, totalPages);
    }

    if (
        currentPage >=
        totalPages - 2
    ) {
        startPage =
            Math.max(1, totalPages - 4);
    }

    for (
        let pageNumber = startPage;
        pageNumber <= endPage;
        pageNumber += 1
    ) {
        elements.paginationPages.appendChild(
            createPageButton(pageNumber)
        );
    }

    if (elements.firstPageButton) {
        elements.firstPageButton.disabled =
            currentPage <= 1;
    }

    if (elements.previousPageButton) {
        elements.previousPageButton.disabled =
            currentPage <= 1;
    }

    if (elements.nextPageButton) {
        elements.nextPageButton.disabled =
            currentPage >= totalPages;
    }

    if (elements.lastPageButton) {
        elements.lastPageButton.disabled =
            currentPage >= totalPages;
    }

    updateResultsInformation();
}

/* =====================================================
   Pagination Navigation
===================================================== */

async function goToPage(pageNumber) {
    const targetPage =
        Math.max(
            1,
            Math.min(
                toNumber(pageNumber),
                customerState.totalPages
            )
        );

    if (
        targetPage === customerState.page ||
        customerState.loading
    ) {
        return;
    }

    customerState.page =
        targetPage;

    await loadCustomers();

    window.scrollTo({
        top:
            elements.customersTableWrapper
                ?.offsetTop || 0,
        behavior: "smooth"
    });
}

/* =====================================================
   Filter Management
===================================================== */

function readFilters() {
    customerState.search =
        elements.customerSearch
            ?.value.trim() || "";

    customerState.status =
        elements.statusFilter
            ?.value || "";

    customerState.membership =
        elements.membershipFilter
            ?.value || "";

    customerState.verification =
        elements.verificationFilter
            ?.value || "";

    customerState.limit =
        Math.max(
            1,
            toNumber(
                elements.limitFilter
                    ?.value || 20
            )
        );

    customerState.page = 1;
}

async function applyFilters(event) {
    event?.preventDefault();

    readFilters();

    await loadCustomers();
}

async function clearFilters() {
    if (elements.customerFiltersForm) {
        elements.customerFiltersForm.reset();
    }

    if (elements.limitFilter) {
        elements.limitFilter.value = "20";
    }

    customerState.search = "";
    customerState.status = "";
    customerState.membership = "";
    customerState.verification = "";
    customerState.limit = 20;
    customerState.page = 1;

    await loadCustomers();
}

/* =====================================================
   Search Debounce
===================================================== */

let searchTimer = null;

function handleSearchInput() {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(async () => {
        customerState.search =
            elements.customerSearch
                ?.value.trim() || "";

        customerState.page = 1;

        await loadCustomers();
    }, 500);
}

/* =====================================================
   CSV Export
===================================================== */

function csvEscape(value) {
    const text =
        value === null ||
        value === undefined
            ? ""
            : String(value);

    return `"${text.replace(/"/g, '""')}"`;
}

function exportCustomersToCsv() {
    if (
        !Array.isArray(
            customerState.customers
        ) ||
        customerState.customers.length === 0
    ) {
        showMessage(
            "There are no customer records to export.",
            "info"
        );

        return;
    }

    const headers = [
        "Customer ID",
        "Full Name",
        "Email",
        "Phone",
        "Status",
        "Membership",
        "Reward Points",
        "Total Orders",
        "Total Spent",
        "Referral Code",
        "Registered At"
    ];

    const rows =
        customerState.customers.map(customer => [
            customer.id ||
                customer.customer_id ||
                "",

            getCustomerName(customer),

            customer.email || "",

            customer.phone || "",

            getCustomerStatus(customer),

            getCustomerMembership(customer),

            getCustomerRewardPoints(customer),

            getCustomerOrderCount(customer),

            getCustomerTotalSpent(customer),

            customer.referral_code || "",

            customer.created_at || ""
        ]);

    const csvContent =
        [
            headers,
            ...rows
        ]
            .map(row =>
                row
                    .map(csvEscape)
                    .join(",")
            )
            .join("\n");

    const blob =
        new Blob(
            [
                "\uFEFF",
                csvContent
            ],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    const date =
        new Date()
            .toISOString()
            .slice(0, 10);

    link.href = url;

    link.download =
        `rukhnav-customers-${date}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showMessage(
        "Customer CSV exported successfully.",
        "success"
    );
}

/* =====================================================
   Table Action Handling
===================================================== */

async function handleCustomerTableAction(event) {
    const button =
        event.target.closest(
            "[data-customer-action]"
        );

    if (!button) {
        return;
    }

    const customerId =
        button.dataset.customerId;

    const action =
        button.dataset.customerAction;

    if (!customerId) {
        return;
    }

    switch (action) {
        case "view":
            await openCustomerDetails(
                customerId
            );
            break;

        case "edit":
            await openEditCustomer(
                customerId
            );
            break;

        case "status":
            await openStatusModal(
                customerId
            );
            break;

        case "delete":
            openDeleteModal(
                customerId,
                button.dataset.customerName
            );
            break;

        default:
            break;
    }
}

/* =====================================================
   Register Filter and Pagination Events
===================================================== */

function bindCustomerListEvents() {
    elements.customerFiltersForm
        ?.addEventListener(
            "submit",
            applyFilters
        );

    elements.customerSearch
        ?.addEventListener(
            "input",
            handleSearchInput
        );

    elements.statusFilter
        ?.addEventListener(
            "change",
            applyFilters
        );

    elements.membershipFilter
        ?.addEventListener(
            "change",
            applyFilters
        );

    elements.verificationFilter
        ?.addEventListener(
            "change",
            applyFilters
        );

    elements.limitFilter
        ?.addEventListener(
            "change",
            applyFilters
        );

    elements.clearFiltersButton
        ?.addEventListener(
            "click",
            clearFilters
        );

    elements.emptyClearFiltersButton
        ?.addEventListener(
            "click",
            clearFilters
        );

    elements.refreshCustomersButton
        ?.addEventListener(
            "click",
            async () => {
                setButtonLoading(
                    elements
                        .refreshCustomersButton,
                    true,
                    "Refreshing"
                );

                try {
                    await Promise.all([
                        loadCustomerDashboard(),
                        loadCustomers()
                    ]);
                } finally {
                    setButtonLoading(
                        elements
                            .refreshCustomersButton,
                        false
                    );
                }
            }
        );

    elements.exportCustomersButton
        ?.addEventListener(
            "click",
            exportCustomersToCsv
        );

    elements.customersTableBody
        ?.addEventListener(
            "click",
            handleCustomerTableAction
        );

    elements.paginationPages
        ?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-page]"
                    );

                if (!button) {
                    return;
                }

                goToPage(
                    Number(
                        button.dataset.page
                    )
                );
            }
        );

    elements.firstPageButton
        ?.addEventListener(
            "click",
            () => goToPage(1)
        );

    elements.previousPageButton
        ?.addEventListener(
            "click",
            () =>
                goToPage(
                    customerState.page - 1
                )
        );

    elements.nextPageButton
        ?.addEventListener(
            "click",
            () =>
                goToPage(
                    customerState.page + 1
                )
        );

    elements.lastPageButton
        ?.addEventListener(
            "click",
            () =>
                goToPage(
                    customerState.totalPages
                )
        );
}
/* =====================================================
   Modal Management
===================================================== */

function openModal(modal) {
    if (!modal) {
        return;
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";
}

function closeModal(modal) {
    if (!modal) {
        return;
    }

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");

    const anyOpenModal =
        document.querySelector(
            ".customer-modal.open"
        );

    if (!anyOpenModal) {
        document.body.style.overflow = "";
    }
}

function closeAllCustomerModals() {
    document
        .querySelectorAll(".customer-modal.open")
        .forEach(modal => {
            closeModal(modal);
        });
}

/* =====================================================
   Customer Details Helpers
===================================================== */

function getOutstandingBalance(customer) {
    return (
        customer.outstanding_balance ??
        customer.balance_amount ??
        customer.total_balance ??
        customer.outstandingBalance ??
        0
    );
}

function getLifetimePoints(customer) {
    return (
        customer.lifetime_points ??
        customer.lifetimePoints ??
        0
    );
}

function getCustomerAddress(customer) {
    return (
        customer.address ||
        customer.delivery_address ||
        "—"
    );
}

function getCustomerCity(customer) {
    return customer.city || "—";
}

function setTextContent(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "—"
                : String(value);
    }
}

function updateStatusBadge(
    element,
    status
) {
    if (!element) {
        return;
    }

    element.textContent = status;

    element.className =
        `status-badge status-${slugifyClass(status)}`;
}

function updateMembershipBadge(
    element,
    membership
) {
    if (!element) {
        return;
    }

    element.textContent = membership;

    element.className =
        `membership-badge membership-${slugifyClass(
            membership
        )}`;
}


/* =====================================================
   Customer Referral Network
===================================================== */

async function referralApiRequest(
    endpoint = "",
    options = {}
) {
    const response =
        await fetch(
            `${REFERRALS_API}${endpoint}`,
            {
                ...options,

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${adminToken}`,

                    ...(options.headers || {})
                }
            }
        );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Referral request failed (${response.status}).`
        );
    }

    return data;
}

function escapeReferralHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function openCustomerReferrals(
    customerId,
    customerName = "Customer"
) {
    const modal =
        document.getElementById(
            "customerReferralsModal"
        );

    const loading =
        document.getElementById(
            "customerReferralsLoading"
        );

    const content =
        document.getElementById(
            "customerReferralsContent"
        );

    const empty =
        document.getElementById(
            "customerReferralsEmpty"
        );

    const tableBody =
        document.getElementById(
            "customerReferralsTableBody"
        );

    const subtitle =
        document.getElementById(
            "customerReferralsSubtitle"
        );

    openModal(modal);

    loading?.classList.remove("hidden");
    content?.classList.add("hidden");
    empty?.classList.add("hidden");

    if (tableBody) {
        tableBody.innerHTML = "";
    }

    if (subtitle) {
        subtitle.textContent =
            `Customers referred by ${customerName}.`;
    }

    try {
        const data =
            await referralApiRequest(
                `?referrer_customer_id=${
                    encodeURIComponent(customerId)
                }&limit=100`
            );

        const referrals =
            Array.isArray(data.referrals)
                ? data.referrals
                : [];

        const summary =
            customerState.currentCustomer
                ?.referralSummary || {};

        setTextContent(
            "referralModalTotal",
            formatNumber(
                summary.totalReferrals ||
                referrals.length
            )
        );

        setTextContent(
            "referralModalQualified",
            formatNumber(
                summary.qualifiedReferrals ||
                referrals.filter(
                    item =>
                        item.status ===
                        "Qualified"
                ).length
            )
        );

        setTextContent(
            "referralModalRewarded",
            formatNumber(
                summary.rewardedReferrals ||
                referrals.filter(
                    item =>
                        item.status ===
                        "Rewarded"
                ).length
            )
        );

        setTextContent(
            "referralModalPoints",
            formatNumber(
                summary.referralPoints || 0
            )
        );

        loading?.classList.add("hidden");

        if (!referrals.length) {
            empty?.classList.remove("hidden");
            return;
        }

        if (tableBody) {
            tableBody.innerHTML =
                referrals.map(
                    referral => {
                        const referredId =
                            referral
                                .referred_customer_id;

                        const name =
                            referral.referred_name ||
                            `Customer #${referredId}`;

                        const reward =
                            Number(
                                referral
                                    .referrer_reward_points ||
                                0
                            );

                        return `
                            <tr>
                                <td>
                                    <strong>
                                        ${escapeReferralHtml(name)}
                                    </strong>

                                    <small>
                                        #${escapeReferralHtml(referredId)}
                                    </small>
                                </td>

                                <td>
                                    <div>
                                        ${escapeReferralHtml(
                                            referral.referred_email ||
                                            "—"
                                        )}
                                    </div>

                                    <small>
                                        ${escapeReferralHtml(
                                            referral.referred_phone ||
                                            "—"
                                        )}
                                    </small>
                                </td>

                                <td>
                                    <span class="
                                        referral-status
                                        referral-status-${
                                            escapeReferralHtml(
                                                String(
                                                    referral.status ||
                                                    "Registered"
                                                ).toLowerCase()
                                            )
                                        }
                                    ">
                                        ${escapeReferralHtml(
                                            referral.status ||
                                            "Registered"
                                        )}
                                    </span>
                                </td>

                                <td>
                                    ${escapeReferralHtml(
                                        referral
                                            .referred_account_status ||
                                        "—"
                                    )}
                                </td>

                                <td>
                                    ${formatNumber(reward)} pts
                                </td>

                                <td>
                                    ${escapeReferralHtml(
                                        formatDateTime(
                                            referral.created_at
                                        )
                                    )}
                                </td>
                            </tr>
                        `;
                    }
                ).join("");
        }

        content?.classList.remove("hidden");

    } catch (error) {
        loading?.classList.add("hidden");

        showMessage(
            error.message ||
            "Unable to load customer referrals.",
            "error"
        );

        closeModal(modal);
    }
}

document.addEventListener(
    "click",
    async event => {
        const button =
            event.target.closest(
                "#viewCustomerReferralsButton"
            );

        if (!button) {
            return;
        }

        const customerId =
            button.dataset.customerId;

        if (!customerId) {
            return;
        }

        await openCustomerReferrals(
            customerId,
            button.dataset.customerName ||
            "Customer"
        );
    }
);


/* =====================================================
   Load Single Customer
===================================================== */

async function fetchCustomerById(customerId) {
    const data =
        await apiRequest(
            `/${encodeURIComponent(customerId)}`
        );

    const customer =
        getSingleCustomer(data);

    if (!customer) {
        throw new Error(
            "Customer details were not returned."
        );
    }

    /*
     * The customer-details API returns additional
     * summaries beside the main customer object.
     * Preserve them on the customer object so the
     * details modal can render the full 360° view.
     */
    const payload =
        data?.data &&
        typeof data.data === "object"
            ? data.data
            : data;

    customer.referralSummary =
        payload?.referralSummary || {
            totalReferrals: 0,
            qualifiedReferrals: 0,
            rewardedReferrals: 0,
            referralPoints: 0
        };

    customer.orderSummary =
        payload?.orderSummary || null;

    customer.eventSummary =
        payload?.eventSummary || null;

    customer.recentOrders =
        payload?.recentOrders || [];

    customerState.currentCustomer =
        customer;

    return customer;
}

/* =====================================================
   Populate Customer Details
===================================================== */

function populateCustomerDetails(customer) {
    const customerId =
        customer.id ||
        customer.customer_id;

    const name =
        getCustomerName(customer);

    const status =
        getCustomerStatus(customer);

    const membership =
        getCustomerMembership(customer);

    setTextContent(
        "detailsCustomerName",
        name
    );

    setTextContent(
        "detailsCustomerReference",
        `Customer #${customerId}`
    );

    setTextContent(
        "customerAvatar",
        getInitials(name)
    );

    updateStatusBadge(
        document.getElementById(
            "detailsCustomerStatus"
        ),
        status
    );

    updateMembershipBadge(
        document.getElementById(
            "detailsMembership"
        ),
        membership
    );

    setTextContent(
        "detailsEmail",
        customer.email || "—"
    );

    setTextContent(
        "detailsPhone",
        customer.phone || "—"
    );

    setTextContent(
        "detailsCity",
        getCustomerCity(customer)
    );

    setTextContent(
        "detailsAddress",
        getCustomerAddress(customer)
    );

    setTextContent(
        "detailsEmailVerification",
        verificationText(
            customer.email_verified_at
        )
    );

    setTextContent(
        "detailsPhoneVerification",
        verificationText(
            customer.phone_verified_at
        )
    );

    setTextContent(
        "detailsLastLogin",
        formatDateTime(
            customer.last_login_at ||
            customer.last_login
        )
    );

    setTextContent(
        "detailsFailedAttempts",
        formatNumber(
            customer.failed_login_attempts ??
            customer.login_attempts ??
            0
        )
    );

    setTextContent(
        "detailsMembershipLevel",
        membership
    );

    setTextContent(
        "detailsRewardPoints",
        formatNumber(
            getCustomerRewardPoints(customer)
        )
    );

    setTextContent(
        "detailsLifetimePoints",
        formatNumber(
            getLifetimePoints(customer)
        )
    );

    setTextContent(
        "detailsReferralCode",
        customer.referral_code || "—"
    );

    const referralSummary =
        customer.referralSummary || {};

    const referredByText =
        customer.referred_by_customer_id
            ? `${
                customer.referred_by_name ||
                `Customer #${customer.referred_by_customer_id}`
            } (#${customer.referred_by_customer_id})`
            : "Direct Registration";

    setTextContent(
        "detailsReferredBy",
        referredByText
    );

    setTextContent(
        "detailsTotalReferrals",
        formatNumber(
            referralSummary.totalReferrals || 0
        )
    );

    setTextContent(
        "detailsQualifiedReferrals",
        formatNumber(
            referralSummary.qualifiedReferrals || 0
        )
    );

    setTextContent(
        "detailsRewardedReferrals",
        formatNumber(
            referralSummary.rewardedReferrals || 0
        )
    );

    setTextContent(
        "detailsReferralPoints",
        formatNumber(
            referralSummary.referralPoints || 0
        )
    );

    const referralsButton =
        document.getElementById(
            "viewCustomerReferralsButton"
        );

    if (referralsButton) {
        referralsButton.dataset.customerId =
            String(customerId);

        referralsButton.dataset.customerName =
            name;

        referralsButton.disabled =
            Number(
                referralSummary.totalReferrals || 0
            ) < 1;
    }

    setTextContent(
        "detailsTotalOrders",
        formatNumber(
            getCustomerOrderCount(customer)
        )
    );

    setTextContent(
        "detailsTotalSpent",
        formatCurrency(
            getCustomerTotalSpent(customer)
        )
    );

    setTextContent(
        "detailsOutstandingBalance",
        formatCurrency(
            getOutstandingBalance(customer)
        )
    );

    setTextContent(
        "detailsCreatedAt",
        formatDateTime(
            customer.created_at
        )
    );

    setTextContent(
        "detailsEmailReminders",
        booleanText(
            customer.email_reminders_enabled
        )
    );

    setTextContent(
        "detailsWhatsappReminders",
        booleanText(
            customer.whatsapp_reminders_enabled
        )
    );

    setTextContent(
        "detailsSmsReminders",
        booleanText(
            customer.sms_reminders_enabled
        )
    );

    const editButton =
        document.getElementById(
            "editCustomerFromDetailsButton"
        );

    if (editButton) {
        editButton.dataset.customerId =
            String(customerId);
    }

    const verificationButton =
        document.getElementById(
            "customerVerificationButton"
        );

    const resetPasswordButton =
        document.getElementById(
            "resetCustomerPasswordButton"
        );

    const analyticsButton =
        document.getElementById(
            "customerAnalyticsButton"
        );

    if (analyticsButton) {
        analyticsButton.dataset.customerId =
            String(customerId);
    }

    const activityButton =
        document.getElementById(
            "customerActivityButton"
        );

    if (activityButton) {
        activityButton.dataset.customerId =
            String(customerId);
    }

    if (verificationButton) {
        verificationButton.dataset.customerId =
            String(customerId);
    }

    if (resetPasswordButton) {
        resetPasswordButton.dataset.customerId =
            String(customerId);
    }
}

/* =====================================================
   Open Customer Details
===================================================== */

async function openCustomerDetails(customerId) {
    openModal(
        elements.customerDetailsModal
    );

    elements.customerDetailsLoading
        ?.classList.remove("hidden");

    elements.customerDetailsContent
        ?.classList.add("hidden");

    try {
        const customer =
            await fetchCustomerById(customerId);

        populateCustomerDetails(customer);

        elements.customerDetailsLoading
            ?.classList.add("hidden");

        elements.customerDetailsContent
            ?.classList.remove("hidden");
    } catch (error) {
        console.error(
            "Customer details error:",
            error
        );

        closeModal(
            elements.customerDetailsModal
        );

        showMessage(
            error.message ||
            "Unable to load customer details.",
            "error"
        );
    }
}

/* =====================================================
   Populate Edit Form
===================================================== */

function populateEditForm(customer) {
    const customerId =
        customer.id ||
        customer.customer_id;

    const fields = {
        editCustomerId:
            customerId,

        editFullName:
            getCustomerName(customer),

        editEmail:
            customer.email || "",

        editPhone:
            customer.phone || "",

        editCity:
            customer.city || "",

        editPostalCode:
            customer.postal_code || "",

        editAddress:
            customer.address || "",

        editStatus:
            getCustomerStatus(customer),

        editMembership:
            getCustomerMembership(customer)
    };

    Object.entries(fields)
        .forEach(([id, value]) => {
            const element =
                document.getElementById(id);

            if (element) {
                element.value =
                    value ?? "";
            }
        });
}

/* =====================================================
   Open Edit Customer Modal
===================================================== */

async function openEditCustomer(customerId) {
    try {
        let customer =
            customerState.currentCustomer;

        const currentId =
            customer?.id ||
            customer?.customer_id;

        if (
            !customer ||
            String(currentId) !==
            String(customerId)
        ) {
            customer =
                await fetchCustomerById(
                    customerId
                );
        }

        populateEditForm(customer);

        closeModal(
            elements.customerDetailsModal
        );

        openModal(
            elements.editCustomerModal
        );
    } catch (error) {
        console.error(
            "Open edit customer error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to open the customer form.",
            "error"
        );
    }
}

/* =====================================================
   Save Customer Changes
===================================================== */

async function saveCustomerChanges(event) {
    event.preventDefault();

    const customerId =
        document.getElementById(
            "editCustomerId"
        )?.value;

    const saveButton =
        document.getElementById(
            "saveCustomerButton"
        );

    if (!customerId) {
        showMessage(
            "Customer ID is missing.",
            "error"
        );

        return;
    }

    const fullName =
        document.getElementById(
            "editFullName"
        )?.value.trim();

    const email =
        document.getElementById(
            "editEmail"
        )?.value.trim();

    const phone =
        document.getElementById(
            "editPhone"
        )?.value.trim();

    if (!fullName) {
        showMessage(
            "Customer full name is required.",
            "error"
        );

        return;
    }

    if (!email && !phone) {
        showMessage(
            "Enter at least an email address or phone number.",
            "error"
        );

        return;
    }

    const payload = {
        full_name: fullName,
        email: email || null,
        phone: phone || null,
        city:
            document.getElementById(
                "editCity"
            )?.value.trim() || null,

        postal_code:
            document.getElementById(
                "editPostalCode"
            )?.value.trim() || null,

        address:
            document.getElementById(
                "editAddress"
            )?.value.trim() || null,

        status:
            document.getElementById(
                "editStatus"
            )?.value || "Active",

        membership_level:
            document.getElementById(
                "editMembership"
            )?.value || "Bronze"
    };

    setButtonLoading(
        saveButton,
        true,
        "Saving"
    );

    try {
        await apiRequest(
            `/${encodeURIComponent(customerId)}`,
            {
                method: "PUT",
                body: JSON.stringify(payload)
            }
        );

        closeModal(
            elements.editCustomerModal
        );

        customerState.currentCustomer =
            null;

        showMessage(
            "Customer updated successfully.",
            "success"
        );

        await Promise.all([
            loadCustomerDashboard(),
            loadCustomers()
        ]);
    } catch (error) {
        console.error(
            "Update customer error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to update the customer.",
            "error",
            false
        );
    } finally {
        setButtonLoading(
            saveButton,
            false
        );
    }
}

/* =====================================================
   Status Modal
===================================================== */

async function openStatusModal(customerId) {
    try {
        let customer =
            customerState.customers.find(
                item =>
                    String(
                        item.id ||
                        item.customer_id
                    ) === String(customerId)
            );

        if (!customer) {
            customer =
                await fetchCustomerById(
                    customerId
                );
        }

        const statusCustomerId =
            document.getElementById(
                "statusCustomerId"
            );

        const newCustomerStatus =
            document.getElementById(
                "newCustomerStatus"
            );

        const statusReason =
            document.getElementById(
                "statusReason"
            );

        if (statusCustomerId) {
            statusCustomerId.value =
                customerId;
        }

        if (newCustomerStatus) {
            newCustomerStatus.value =
                getCustomerStatus(customer);
        }

        if (statusReason) {
            statusReason.value = "";
        }

        openModal(
            elements.customerStatusModal
        );
    } catch (error) {
        console.error(
            "Open status modal error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to open the status form.",
            "error"
        );
    }
}

/* =====================================================
   Update Customer Status
===================================================== */

async function updateCustomerStatus(event) {
    event.preventDefault();

    const customerId =
        document.getElementById(
            "statusCustomerId"
        )?.value;

    const status =
        document.getElementById(
            "newCustomerStatus"
        )?.value;

    const reason =
        document.getElementById(
            "statusReason"
        )?.value.trim();

    const updateButton =
        document.getElementById(
            "updateStatusButton"
        );

    if (!customerId || !status) {
        showMessage(
            "Customer and status are required.",
            "error"
        );

        return;
    }

    setButtonLoading(
        updateButton,
        true,
        "Updating"
    );

    try {
        await apiRequest(
            `/${encodeURIComponent(
                customerId
            )}/status`,
            {
                method: "PATCH",

                body: JSON.stringify({
                    status,
                    reason: reason || null
                })
            }
        );

        closeModal(
            elements.customerStatusModal
        );

        showMessage(
            "Customer status updated successfully.",
            "success"
        );

        await Promise.all([
            loadCustomerDashboard(),
            loadCustomers()
        ]);
    } catch (error) {
        console.error(
            "Update status error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to update customer status.",
            "error",
            false
        );
    } finally {
        setButtonLoading(
            updateButton,
            false
        );
    }
}

/* =====================================================
   Delete Customer Modal
===================================================== */

function openDeleteModal(
    customerId,
    customerName
) {
    const deleteCustomerId =
        document.getElementById(
            "deleteCustomerId"
        );

    const deleteCustomerName =
        document.getElementById(
            "deleteCustomerName"
        );

    if (deleteCustomerId) {
        deleteCustomerId.value =
            customerId;
    }

    if (deleteCustomerName) {
        deleteCustomerName.textContent =
            customerName ||
            "this customer";
    }

    openModal(
        elements.deleteCustomerModal
    );
}

/* =====================================================
   Confirm Customer Deletion
===================================================== */

async function deleteCustomer() {
    const customerId =
        document.getElementById(
            "deleteCustomerId"
        )?.value;

    if (!customerId) {
        showMessage(
            "Customer ID is missing.",
            "error"
        );

        return;
    }

    setButtonLoading(
        elements.confirmDeleteCustomerButton,
        true,
        "Deleting"
    );

    try {
        await apiRequest(
            `/${encodeURIComponent(customerId)}`,
            {
                method: "DELETE"
            }
        );

        closeModal(
            elements.deleteCustomerModal
        );

        showMessage(
            "Customer deleted successfully.",
            "success"
        );

        if (
            customerState.customers.length === 1 &&
            customerState.page > 1
        ) {
            customerState.page -= 1;
        }

        await Promise.all([
            loadCustomerDashboard(),
            loadCustomers()
        ]);
    } catch (error) {
        console.error(
            "Delete customer error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete the customer.",
            "error",
            false
        );
    } finally {
        setButtonLoading(
            elements.confirmDeleteCustomerButton,
            false
        );
    }
}




/* =====================================================
   Customer Analytics
===================================================== */

async function openCustomerAnalytics(
    customerId
) {
    closeModal(
        elements.customerDetailsModal
    );

    openModal(
        elements.customerAnalyticsModal
    );

    document
        .getElementById(
            "customerAnalyticsLoading"
        )
        ?.classList.remove("hidden");

    document
        .getElementById(
            "customerAnalyticsContent"
        )
        ?.classList.add("hidden");

    try {
        const data =
            await apiRequest(
                `/${encodeURIComponent(customerId)}/analytics`
            );

        renderCustomerAnalytics(
            data
        );
    } catch (error) {
        const loading =
            document.getElementById(
                "customerAnalyticsLoading"
            );

        loading?.classList.add(
            "hidden"
        );

        const content =
            document.getElementById(
                "customerAnalyticsContent"
            );

        if (content) {
            content.classList.remove(
                "hidden"
            );

            content.innerHTML = `
                <div class="activity-empty activity-error">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <h3>Unable to load analytics</h3>
                    <p>${escapeHtml(error.message)}</p>
                </div>
            `;
        }
    }
}

function renderCustomerAnalytics(
    data
) {
    const customer =
        data.customer || {};

    const metrics =
        data.metrics || {};

    setTextContent(
        "customerAnalyticsTitle",
        `${getCustomerName(customer)} · Analytics`
    );

    setTextContent(
        "customerAnalyticsSubtitle",
        [
            customer.email,
            customer.phone,
            `Customer #${customer.id}`
        ]
            .filter(Boolean)
            .join(" · ")
    );

    const metricCards = [
        [
            "Lifetime Value",
            formatCurrency(
                metrics.lifetimeValue
            ),
            "fa-sack-dollar"
        ],
        [
            "Average Order",
            formatCurrency(
                metrics.averageOrderValue
            ),
            "fa-chart-line"
        ],
        [
            "Total Orders",
            Number(
                metrics.totalOrders || 0
            ),
            "fa-cart-shopping"
        ],
        [
            "Delivered",
            Number(
                metrics.deliveredOrders || 0
            ),
            "fa-circle-check"
        ],
        [
            "Cancelled",
            Number(
                metrics.cancelledOrders || 0
            ),
            "fa-circle-xmark"
        ],
        [
            "Order Frequency",
            metrics.orderFrequencyDays
                ? `${metrics.orderFrequencyDays} days`
                : "Not enough data",
            "fa-clock-rotate-left"
        ],
        [
            "Membership",
            metrics.membershipLevel ||
            "Bronze",
            "fa-medal"
        ],
        [
            "Available Points",
            Number(
                metrics.availablePoints || 0
            ).toLocaleString(),
            "fa-coins"
        ]
    ];

    document
        .getElementById(
            "customerAnalyticsMetrics"
        )
        .innerHTML =
        metricCards.map(
            card => `
                <article>
                    <i class="fa-solid ${card[2]}"></i>
                    <span>${escapeHtml(card[0])}</span>
                    <strong>${escapeHtml(card[1])}</strong>
                </article>
            `
        ).join("");

    renderSpendingBars(
        data.monthlySpending || []
    );

    renderStatusBreakdown(
        data.statusBreakdown || []
    );

    renderEngagementSignals(
        metrics
    );

    document
        .getElementById(
            "customerAnalyticsLoading"
        )
        ?.classList.add("hidden");

    document
        .getElementById(
            "customerAnalyticsContent"
        )
        ?.classList.remove("hidden");
}

function renderSpendingBars(
    monthly
) {
    const container =
        document.getElementById(
            "customerSpendingChart"
        );

    if (!monthly.length) {
        container.innerHTML =
            emptyActivityState(
                "No monthly spending data."
            );

        return;
    }

    const max =
        Math.max(
            ...monthly.map(
                item =>
                    Number(
                        item.amount || 0
                    )
            ),
            1
        );

    container.innerHTML =
        monthly.map(
            item => {
                const amount =
                    Number(
                        item.amount || 0
                    );

                const height =
                    Math.max(
                        6,
                        Math.round(
                            (
                                amount /
                                max
                            ) *
                            100
                        )
                    );

                return `
                    <div class="spending-bar-item">
                        <div class="spending-bar-track">
                            <span
                                style="height:${height}%"
                                title="${formatCurrency(amount)}"
                            ></span>
                        </div>
                        <strong>
                            ${escapeHtml(item.month)}
                        </strong>
                        <small>
                            ${Number(item.orders || 0)} orders
                        </small>
                    </div>
                `;
            }
        ).join("");
}

function renderStatusBreakdown(
    rows
) {
    const container =
        document.getElementById(
            "customerStatusBreakdown"
        );

    if (!rows.length) {
        container.innerHTML =
            emptyActivityState(
                "No order-status data."
            );

        return;
    }

    const total =
        rows.reduce(
            (
                sum,
                row
            ) =>
                sum +
                Number(
                    row.total || 0
                ),
            0
        ) || 1;

    container.innerHTML =
        rows.map(
            row => {
                const count =
                    Number(
                        row.total || 0
                    );

                const percentage =
                    Math.round(
                        (
                            count /
                            total
                        ) *
                        100
                    );

                return `
                    <div>
                        <span>
                            ${escapeHtml(row.status)}
                        </span>
                        <div>
                            <i style="width:${percentage}%"></i>
                        </div>
                        <strong>
                            ${count}
                        </strong>
                    </div>
                `;
            }
        ).join("");
}

function renderEngagementSignals(
    metrics
) {
    const signals = [
        [
            "Reviews",
            metrics.reviews || 0
        ],
        [
            "Events",
            metrics.events || 0
        ],
        [
            "Wishlist Items",
            metrics.wishlistItems || 0
        ],
        [
            "Cart Items",
            metrics.cartItems || 0
        ],
        [
            "Loyalty Entries",
            metrics.loyaltyEntries || 0
        ],
        [
            "Account Age",
            `${Number(
                metrics.accountAgeDays || 0
            )} days`
        ]
    ];

    document
        .getElementById(
            "customerEngagementSignals"
        )
        .innerHTML =
        signals.map(
            signal => `
                <div>
                    <span>${escapeHtml(signal[0])}</span>
                    <strong>${escapeHtml(signal[1])}</strong>
                </div>
            `
        ).join("");
}

/* =====================================================
   Customer 360 Activity
===================================================== */

const customerActivityState = {
    data: null,
    activeTab: "orders"
};

async function openCustomerActivity(
    customerId
) {
    closeModal(
        elements.customerDetailsModal
    );

    openModal(
        elements.customerActivityModal
    );

    document
        .getElementById(
            "customerActivityLoading"
        )
        ?.classList.remove("hidden");

    document
        .getElementById(
            "customerActivityContent"
        )
        ?.classList.add("hidden");

    try {
        const data =
            await apiRequest(
                `/${encodeURIComponent(customerId)}/activity`
            );

        customerActivityState.data =
            data;

        customerActivityState.activeTab =
            "orders";

        renderCustomerActivity();
    } catch (error) {
        document
            .getElementById(
                "customerActivityLoading"
            )
            ?.classList.add("hidden");

        const content =
            document.getElementById(
                "customerActivityContent"
            );

        if (content) {
            content.classList.remove(
                "hidden"
            );

            content.innerHTML = `
                <div class="activity-empty activity-error">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <h3>Unable to load activity</h3>
                    <p>
                        ${escapeHtml(
                            error.message ||
                            "Unable to load customer activity."
                        )}
                    </p>
                    <button
                        type="button"
                        class="erp-v5-btn erp-v5-btn--gold"
                        onclick="
                            openCustomerActivity(
                                '${String(customerId).replace(/'/g, "")}'
                            )
                        "
                    >
                        <i class="fa-solid fa-rotate"></i>
                        Try Again
                    </button>
                </div>
            `;
        }

        showMessage(
            error.message ||
            "Unable to load customer activity.",
            "error",
            false
        );
    }
}

function renderCustomerActivity() {
    const data =
        customerActivityState.data;

    if (!data?.customer) {
        return;
    }

    const customer =
        data.customer;

    const name =
        getCustomerName(customer);

    setTextContent(
        "customerActivityTitle",
        `${name} · 360° Activity`
    );

    setTextContent(
        "customerActivitySubtitle",
        [
            customer.email,
            customer.phone,
            `Customer #${customer.id}`
        ]
            .filter(Boolean)
            .join(" · ")
    );

    setTextContent(
        "activityCustomerName",
        name
    );

    setTextContent(
        "activityCustomerContact",
        [
            customer.email,
            customer.phone,
            customer.city
        ]
            .filter(Boolean)
            .join(" · ") ||
            "No contact details"
    );

    setTextContent(
        "activityMembershipBadge",
        customer.membership_level ||
        "Bronze"
    );

    setTextContent(
        "activityStatusBadge",
        customer.status ||
        "Unknown"
    );

    setTextContent(
        "activityAvailablePoints",
        Number(
            customer.available_points || 0
        ).toLocaleString()
    );

    setTextContent(
        "activityLifetimePoints",
        `${Number(
            customer.lifetime_points || 0
        ).toLocaleString()} lifetime points`
    );

    const avatar =
        document.getElementById(
            "activityProfileAvatar"
        );

    if (avatar) {
        const picture =
            customer.profile_picture || "";

        if (picture) {
            const url =
                /^https?:\/\//i.test(
                    picture
                ) ||
                picture.startsWith("/")
                    ? picture
                    : `/uploads/profiles/${encodeURIComponent(picture)}`;

            avatar.innerHTML = `
                <img
                    src="${escapeHtml(url)}"
                    alt="${escapeHtml(name)}"
                    onerror="
                        this.remove();
                        this.parentElement.textContent='${escapeHtml(getInitials(name))}';
                    "
                >
            `;
        } else {
            avatar.textContent =
                getInitials(name);
        }
    }

    const summary =
        data.summary || {};

    const cards = [
        [
            "Orders",
            summary.orders || 0,
            "fa-cart-shopping"
        ],
        [
            "Addresses",
            summary.addresses || 0,
            "fa-location-dot"
        ],
        [
            "Wishlist",
            summary.wishlist || 0,
            "fa-heart"
        ],
        [
            "Cart Items",
            summary.cart || 0,
            "fa-basket-shopping"
        ],
        [
            "Reviews",
            summary.reviews || 0,
            "fa-star"
        ],
        [
            "Events",
            summary.events || 0,
            "fa-calendar-days"
        ],
        [
            "Loyalty Entries",
            summary.loyaltyTransactions || 0,
            "fa-coins"
        ]
    ];

    document
        .getElementById(
            "activitySummaryGrid"
        )
        .innerHTML =
        cards.map(
            card => `
                <article>
                    <i class="fa-solid ${card[2]}"></i>
                    <span>${card[0]}</span>
                    <strong>${Number(card[1])}</strong>
                </article>
            `
        ).join("");

    document
        .getElementById(
            "customerActivityLoading"
        )
        ?.classList.add("hidden");

    document
        .getElementById(
            "customerActivityContent"
        )
        ?.classList.remove("hidden");

    activateCustomerActivityTab(
        "orders"
    );
}

function activateCustomerActivityTab(
    tab
) {
    customerActivityState.activeTab =
        tab;

    document
        .querySelectorAll(
            "[data-activity-tab]"
        )
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset
                    .activityTab ===
                    tab
            );
        });

    const data =
        customerActivityState.data;

    if (!data) {
        return;
    }

    const renderers = {
        orders:
            renderActivityOrders,
        addresses:
            renderActivityAddresses,
        wishlist:
            renderActivityWishlist,
        cart:
            renderActivityCart,
        reviews:
            renderActivityReviews,
        events:
            renderActivityEvents,
        loyalty:
            renderActivityLoyalty
    };

    document
        .getElementById(
            "activityTabContent"
        )
        .innerHTML =
        renderers[tab]?.(data) ||
        emptyActivityState(
            "No activity available."
        );
}

function activityTable(
    headings,
    rows,
    emptyMessage
) {
    if (!rows.length) {
        return emptyActivityState(
            emptyMessage
        );
    }

    return `
        <div class="activity-table-wrap">
            <table class="activity-table">
                <thead>
                    <tr>
                        ${headings.map(
                            heading =>
                                `<th>${escapeHtml(heading)}</th>`
                        ).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${rows.join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderActivityOrders(data) {
    return activityTable(
        [
            "Order",
            "Status",
            "Payment",
            "Total",
            "Created"
        ],
        (data.orders || []).map(
            order => `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(
                                order.order_number ||
                                `#${order.id}`
                            )}
                        </strong>
                    </td>
                    <td>
                        ${escapeHtml(
                            order.order_status ||
                            "—"
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            order.payment_status ||
                            order.payment_method ||
                            "—"
                        )}
                    </td>
                    <td>
                        ${formatCurrency(
                            order.grand_total
                        )}
                    </td>
                    <td>
                        ${formatDateTime(
                            order.created_at
                        )}
                    </td>
                </tr>
            `
        ),
        "This customer has no orders."
    );
}

function renderActivityAddresses(data) {
    return activityTable(
        [
            "Type",
            "Recipient",
            "Address",
            "Default"
        ],
        (data.addresses || []).map(
            address => `
                <tr>
                    <td>
                        ${escapeHtml(
                            address.address_type ||
                            "Address"
                        )}
                    </td>
                    <td>
                        <strong>
                            ${escapeHtml(
                                address.full_name ||
                                "—"
                            )}
                        </strong>
                        <small>
                            ${escapeHtml(
                                address.phone ||
                                "—"
                            )}
                        </small>
                    </td>
                    <td>
                        ${escapeHtml(
                            [
                                address.address_line1,
                                address.address_line2,
                                address.city,
                                address.province,
                                address.postal_code,
                                address.country
                            ]
                                .filter(Boolean)
                                .join(", ")
                        )}
                    </td>
                    <td>
                        ${address.is_default
                            ? "Yes"
                            : "No"}
                    </td>
                </tr>
            `
        ),
        "No saved addresses."
    );
}

function renderActivityWishlist(data) {
    return activityTable(
        [
            "Product",
            "Price",
            "Stock",
            "Added"
        ],
        (data.wishlist || []).map(
            item => `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(
                                item.product_name ||
                                `Product #${item.product_id}`
                            )}
                        </strong>
                    </td>
                    <td>
                        ${formatCurrency(
                            item.price
                        )}
                    </td>
                    <td>
                        ${Number(
                            item.stock || 0
                        )}
                    </td>
                    <td>
                        ${formatDateTime(
                            item.created_at
                        )}
                    </td>
                </tr>
            `
        ),
        "No wishlist items."
    );
}

function renderActivityCart(data) {
    return activityTable(
        [
            "Product",
            "Price",
            "Qty",
            "Subtotal"
        ],
        (data.cart || []).map(
            item => `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(
                                item.product_name ||
                                `Product #${item.product_id}`
                            )}
                        </strong>
                    </td>
                    <td>
                        ${formatCurrency(
                            item.price
                        )}
                    </td>
                    <td>
                        ${Number(
                            item.quantity || 0
                        )}
                    </td>
                    <td>
                        ${formatCurrency(
                            item.subtotal
                        )}
                    </td>
                </tr>
            `
        ),
        "The customer cart is empty."
    );
}

function renderActivityReviews(data) {
    return activityTable(
        [
            "Product",
            "Rating",
            "Comment",
            "Status"
        ],
        (data.reviews || []).map(
            review => `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(
                                review.product_name ||
                                `Product #${review.product_id}`
                            )}
                        </strong>
                    </td>
                    <td>
                        ${Number(
                            review.rating || 0
                        )}/5
                    </td>
                    <td>
                        ${escapeHtml(
                            review.comment ||
                            "—"
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            review.status ||
                            "—"
                        )}
                    </td>
                </tr>
            `
        ),
        "No customer reviews."
    );
}

function renderActivityEvents(data) {
    return activityTable(
        [
            "Event",
            "Type",
            "Date",
            "Channels",
            "Status"
        ],
        (data.events || []).map(
            event => `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(
                                event.event_name ||
                                "Customer Event"
                            )}
                        </strong>
                    </td>
                    <td>
                        ${escapeHtml(
                            event.event_type ||
                            "—"
                        )}
                    </td>
                    <td>
                        ${formatDateTime(
                            event.event_date
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            [
                                event.remind_by_email
                                    ? "Email"
                                    : "",
                                event.remind_by_whatsapp
                                    ? "WhatsApp"
                                    : "",
                                event.remind_by_sms
                                    ? "SMS"
                                    : ""
                            ]
                                .filter(Boolean)
                                .join(", ") ||
                                "None"
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            event.status ||
                            "—"
                        )}
                    </td>
                </tr>
            `
        ),
        "No customer events."
    );
}

function renderActivityLoyalty(data) {
    return activityTable(
        [
            "Type",
            "Points",
            "Balance",
            "Membership",
            "Description",
            "Date"
        ],
        (data.loyaltyTransactions || []).map(
            transaction => `
                <tr>
                    <td>
                        ${escapeHtml(
                            transaction.transaction_type ||
                            "Adjustment"
                        )}
                    </td>
                    <td>
                        ${Number(
                            transaction.points_change || 0
                        ) >= 0 ? "+" : ""}
                        ${Number(
                            transaction.points_change || 0
                        )}
                    </td>
                    <td>
                        ${Number(
                            transaction.balance_after || 0
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            transaction.membership_after ||
                            transaction.membership_before ||
                            "—"
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            transaction.description ||
                            transaction.reference_number ||
                            "—"
                        )}
                    </td>
                    <td>
                        ${formatDateTime(
                            transaction.created_at
                        )}
                    </td>
                </tr>
            `
        ),
        "No loyalty transactions."
    );
}

function emptyActivityState(
    message
) {
    return `
        <div class="activity-empty">
            <i class="fa-regular fa-folder-open"></i>
            <h3>No records</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

/* =====================================================
   Customer Security & Verification
===================================================== */

function currentCustomerForSecurity(
    customerId
) {
    const current =
        customerState.currentCustomer;

    const currentId =
        current?.id ||
        current?.customer_id;

    if (
        current &&
        String(currentId) ===
        String(customerId)
    ) {
        return current;
    }

    return customerState.customers.find(
        customer =>
            String(
                customer.id ||
                customer.customer_id
            ) ===
            String(customerId)
    ) || null;
}

async function ensureSecurityCustomer(
    customerId
) {
    const existing =
        currentCustomerForSecurity(
            customerId
        );

    if (existing) {
        return existing;
    }

    return fetchCustomerById(
        customerId
    );
}

function updateVerificationPreview() {
    const emailChecked =
        document.getElementById(
            "emailVerifiedToggle"
        )?.checked;

    const phoneChecked =
        document.getElementById(
            "phoneVerifiedToggle"
        )?.checked;

    setTextContent(
        "verificationEmailPreview",
        emailChecked
            ? "Verified"
            : "Unverified"
    );

    setTextContent(
        "verificationPhonePreview",
        phoneChecked
            ? "Verified"
            : "Unverified"
    );

    document
        .getElementById(
            "verificationEmailPreview"
        )
        ?.classList.toggle(
            "verified",
            Boolean(emailChecked)
        );

    document
        .getElementById(
            "verificationPhonePreview"
        )
        ?.classList.toggle(
            "verified",
            Boolean(phoneChecked)
        );
}

async function openCustomerVerification(
    customerId
) {
    try {
        const customer =
            await ensureSecurityCustomer(
                customerId
            );

        const id =
            customer.id ||
            customer.customer_id;

        const name =
            getCustomerName(customer);

        const verificationCustomerIdInput =
            document.getElementById(
                "verificationCustomerId"
            );

        if (verificationCustomerIdInput) {
            verificationCustomerIdInput.value =
                String(id);
        }

        setTextContent(
            "verificationCustomerName",
            `${name} · Customer #${id}`
        );

        setTextContent(
            "verificationEmailAddress",
            customer.email ||
            "No email address"
        );

        setTextContent(
            "verificationPhoneNumber",
            customer.phone ||
            "No phone number"
        );

        const emailToggle =
            document.getElementById(
                "emailVerifiedToggle"
            );

        const phoneToggle =
            document.getElementById(
                "phoneVerifiedToggle"
            );

        if (emailToggle) {
            emailToggle.checked =
                Boolean(
                    customer.email_verified_at
                );

            emailToggle.disabled =
                !customer.email;
        }

        if (phoneToggle) {
            phoneToggle.checked =
                Boolean(
                    customer.phone_verified_at
                );

            phoneToggle.disabled =
                !customer.phone;
        }

        updateVerificationPreview();

        closeModal(
            elements.customerDetailsModal
        );

        openModal(
            elements.customerVerificationModal
        );
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to open verification controls.",
            "error",
            false
        );
    }
}

async function saveCustomerVerification(
    event
) {
    event.preventDefault();

    const customerId =
        document.getElementById(
            "verificationCustomerId"
        )?.value;

    const button =
        document.getElementById(
            "saveCustomerVerificationButton"
        );

    if (!customerId) {
        showMessage(
            "Customer ID is missing.",
            "error",
            false
        );

        return;
    }

    const payload = {
        email_verified:
            Boolean(
                document.getElementById(
                    "emailVerifiedToggle"
                )?.checked
            ),

        phone_verified:
            Boolean(
                document.getElementById(
                    "phoneVerifiedToggle"
                )?.checked
            )
    };

    setButtonLoading(
        button,
        true,
        "Saving"
    );

    try {
        const data =
            await apiRequest(
                `/${encodeURIComponent(customerId)}/verification`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        closeModal(
            elements.customerVerificationModal
        );

        customerState.currentCustomer =
            null;

        showMessage(
            data.message ||
            "Customer verification updated successfully.",
            "success"
        );

        await Promise.all([
            loadCustomerDashboard(),
            loadCustomers()
        ]);

        await openCustomerDetails(
            customerId
        );
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to update customer verification.",
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

function passwordStrengthLevel(
    password
) {
    let score = 0;

    if (password.length >= 8) {
        score += 1;
    }

    if (password.length >= 12) {
        score += 1;
    }

    if (/[A-Z]/.test(password)) {
        score += 1;
    }

    if (/[a-z]/.test(password)) {
        score += 1;
    }

    if (/\d/.test(password)) {
        score += 1;
    }

    if (/[^A-Za-z0-9]/.test(password)) {
        score += 1;
    }

    return Math.min(
        4,
        Math.floor(score / 1.5)
    );
}

function updatePasswordStrength() {
    const password =
        document.getElementById(
            "newCustomerPassword"
        )?.value || "";

    const strength =
        document.getElementById(
            "passwordStrength"
        );

    if (!strength) {
        return;
    }

    const level =
        passwordStrengthLevel(
            password
        );

    const labels = [
        "Enter at least 8 characters.",
        "Weak password",
        "Fair password",
        "Good password",
        "Strong password"
    ];

    strength.dataset.level =
        String(level);

    const description =
        strength.querySelector(
            "small"
        );

    if (description) {
        description.textContent =
            labels[level];
    }
}

async function openResetCustomerPassword(
    customerId
) {
    try {
        const customer =
            await ensureSecurityCustomer(
                customerId
            );

        const id =
            customer.id ||
            customer.customer_id;

        const resetPasswordCustomerIdInput =
            document.getElementById(
                "resetPasswordCustomerId"
            );

        if (resetPasswordCustomerIdInput) {
            resetPasswordCustomerIdInput.value =
                String(id);
        }

        setTextContent(
            "resetPasswordCustomerName",
            `${getCustomerName(customer)} · Customer #${id}`
        );

        const form =
            elements.resetCustomerPasswordForm;

        form?.reset();

        updatePasswordStrength();

        closeModal(
            elements.customerDetailsModal
        );

        openModal(
            elements.resetCustomerPasswordModal
        );

        setTimeout(
            () =>
                document.getElementById(
                    "newCustomerPassword"
                )?.focus(),
            50
        );
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to open password reset.",
            "error",
            false
        );
    }
}

async function resetCustomerPassword(
    event
) {
    event.preventDefault();

    const customerId =
        document.getElementById(
            "resetPasswordCustomerId"
        )?.value;

    const newPassword =
        document.getElementById(
            "newCustomerPassword"
        )?.value || "";

    const confirmPassword =
        document.getElementById(
            "confirmCustomerPassword"
        )?.value || "";

    const button =
        document.getElementById(
            "confirmResetCustomerPasswordButton"
        );

    if (!customerId) {
        showMessage(
            "Customer ID is missing.",
            "error",
            false
        );

        return;
    }

    if (newPassword.length < 8) {
        showMessage(
            "New password must contain at least 8 characters.",
            "error",
            false
        );

        return;
    }

    if (
        newPassword !==
        confirmPassword
    ) {
        showMessage(
            "Password confirmation does not match.",
            "error",
            false
        );

        return;
    }

    setButtonLoading(
        button,
        true,
        "Resetting"
    );

    try {
        const data =
            await apiRequest(
                `/${encodeURIComponent(customerId)}/reset-password`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            new_password:
                                newPassword,

                            confirm_password:
                                confirmPassword
                        })
                }
            );

        closeModal(
            elements.resetCustomerPasswordModal
        );

        elements.resetCustomerPasswordForm
            ?.reset();

        showMessage(
            data.message ||
            "Customer password reset successfully. The customer has been logged out from all devices.",
            "success",
            false
        );
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to reset customer password.",
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

function togglePasswordVisibility(
    button
) {
    const targetId =
        button.dataset
            .passwordTarget;

    const input =
        document.getElementById(
            targetId
        );

    if (!input) {
        return;
    }

    const visible =
        input.type ===
        "text";

    input.type =
        visible
            ? "password"
            : "text";

    const icon =
        button.querySelector("i");

    if (icon) {
        icon.className =
            visible
                ? "fa-regular fa-eye"
                : "fa-regular fa-eye-slash";
    }

    button.setAttribute(
        "aria-label",
        visible
            ? "Show password"
            : "Hide password"
    );
}

/* =====================================================
   Modal Event Binding
===================================================== */

function bindModalEvents() {
    document
        .querySelectorAll(
            "[data-close-modal]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const modalId =
                        button.dataset.closeModal;

                    const modal =
                        document.getElementById(
                            modalId
                        );

                    closeModal(modal);
                }
            );
        });

    document
        .querySelectorAll(
            ".customer-modal-overlay"
        )
        .forEach(overlay => {
            overlay.addEventListener(
                "click",
                () => {
                    const modal =
                        overlay.closest(
                            ".customer-modal"
                        );

                    closeModal(modal);
                }
            );
        });

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape"
            ) {
                closeAllCustomerModals();
            }
        }
    );

    document
        .getElementById(
            "editCustomerFromDetailsButton"
        )
        ?.addEventListener(
            "click",
            event => {
                const customerId =
                    event.currentTarget
                        .dataset.customerId;

                if (customerId) {
                    openEditCustomer(
                        customerId
                    );
                }
            }
        );

    elements.editCustomerForm
        ?.addEventListener(
            "submit",
            saveCustomerChanges
        );

    elements.customerStatusForm
        ?.addEventListener(
            "submit",
            updateCustomerStatus
        );

    elements.confirmDeleteCustomerButton
        ?.addEventListener(
            "click",
            deleteCustomer
        );

    elements.customerAnalyticsButton
        ?.addEventListener(
            "click",
            event => {
                const customerId =
                    event.currentTarget
                        .dataset.customerId;

                if (customerId) {
                    openCustomerAnalytics(
                        customerId
                    );
                }
            }
        );

    elements.customerActivityButton
        ?.addEventListener(
            "click",
            event => {
                const customerId =
                    event.currentTarget
                        .dataset.customerId;

                if (customerId) {
                    openCustomerActivity(
                        customerId
                    );
                }
            }
        );

    document
        .querySelectorAll(
            "[data-activity-tab]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () =>
                    activateCustomerActivityTab(
                        button.dataset
                            .activityTab
                    )
            );
        });

    elements.customerVerificationButton
        ?.addEventListener(
            "click",
            event => {
                const customerId =
                    event.currentTarget
                        .dataset.customerId;

                if (customerId) {
                    openCustomerVerification(
                        customerId
                    );
                }
            }
        );

    elements.resetCustomerPasswordButton
        ?.addEventListener(
            "click",
            event => {
                const customerId =
                    event.currentTarget
                        .dataset.customerId;

                if (customerId) {
                    openResetCustomerPassword(
                        customerId
                    );
                }
            }
        );

    elements.customerVerificationForm
        ?.addEventListener(
            "submit",
            saveCustomerVerification
        );

    elements.resetCustomerPasswordForm
        ?.addEventListener(
            "submit",
            resetCustomerPassword
        );

    document
        .getElementById(
            "emailVerifiedToggle"
        )
        ?.addEventListener(
            "change",
            updateVerificationPreview
        );

    document
        .getElementById(
            "phoneVerifiedToggle"
        )
        ?.addEventListener(
            "change",
            updateVerificationPreview
        );

    document
        .getElementById(
            "newCustomerPassword"
        )
        ?.addEventListener(
            "input",
            updatePasswordStrength
        );

    document
        .querySelectorAll(
            "[data-password-target]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () =>
                    togglePasswordVisibility(
                        button
                    )
            );
        });
}

/* =====================================================
   Page Initialisation
===================================================== */

async function initialiseCustomersPage() {
    bindCustomerListEvents();
    bindModalEvents();

    if (elements.limitFilter) {
        elements.limitFilter.value =
            String(customerState.limit);
    }

    try {
        await Promise.all([
            loadCustomerDashboard(),
            loadCustomers()
        ]);
    } catch (error) {
        console.error(
            "Customers page initialisation error:",
            error
        );

        showMessage(
            "The Customers page could not be fully loaded.",
            "error",
            false
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    initialiseCustomersPage
);