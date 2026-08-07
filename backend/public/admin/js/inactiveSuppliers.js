"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =========================================
// RUKHNAV ERP - Inactive Suppliers
// =========================================

const SUPPLIER_API =
    RUKHNAV_ORIGIN + "/api/suppliers";

let inactiveSuppliers = [];
let filteredSuppliers = [];

let currentPage = 1;
let pageSize = 10;
let pendingAction = null;

const $ = (id) => document.getElementById(id);

// =========================================
// Authentication Token
// =========================================

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("adminToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("adminToken") ||
        ""
    );
}

const token = getToken();

if (!token) {
    window.location.href = "login.html";
}

// =========================================
// API Helper
// =========================================

async function apiRequest(url, options = {}) {

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization =
            token.startsWith("Bearer ")
                ? token
                : `Bearer ${token}`;
    }

    if (options.body) {
        headers["Content-Type"] =
            "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

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
        throw new Error(
            data.message ||
            "Your login session has expired. Please log in again."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

// =========================================
// Load Inactive Suppliers
// =========================================

async function loadInactiveSuppliers() {

    showLoading(true);

    try {

        const data = await apiRequest(
            `${SUPPLIER_API}/inactive/all`
        );

        inactiveSuppliers =
            Array.isArray(data.suppliers)
                ? data.suppliers
                : [];

        applySupplierFilter();
        updateSupplierStats();

        if ($("lastUpdated")) {

            $("lastUpdated").textContent =
                new Date().toLocaleTimeString(
                    [],
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );

        }

    } catch (error) {

        inactiveSuppliers = [];
        filteredSuppliers = [];

        renderSuppliers();
        updateSupplierStats();

        showToast(
            error.message,
            "error"
        );

    } finally {

        showLoading(false);

    }

}

// =========================================
// Search Suppliers
// =========================================

function applySupplierFilter() {

    const keyword =
        $("searchInput")
            ? $("searchInput")
                .value
                .trim()
                .toLowerCase()
            : "";

    filteredSuppliers =
        inactiveSuppliers.filter(
            (supplier) => {

                const searchableText = [
                    supplier.id,
                    supplier.supplier_name,
                    supplier.contact_person,
                    supplier.phone,
                    supplier.email,
                    supplier.address,
                    supplier.city,
                    supplier.country,
                    supplier.tax_number
                ]
                    .filter(
                        (value) =>
                            value !== null &&
                            value !== undefined
                    )
                    .join(" ")
                    .toLowerCase();

                return searchableText.includes(
                    keyword
                );

            }
        );

    currentPage = Math.min(
        currentPage,
        getTotalPages()
    );

    if (currentPage < 1) {
        currentPage = 1;
    }

    renderSuppliers();

}

// =========================================
// Update Summary Cards
// =========================================

function updateSupplierStats() {

    const totalBalance =
        inactiveSuppliers.reduce(
            (total, supplier) =>
                total +
                Number(
                    supplier.current_balance || 0
                ),
            0
        );

    const suppliersWithBalance =
        inactiveSuppliers.filter(
            (supplier) =>
                Number(
                    supplier.current_balance || 0
                ) !== 0
        ).length;

    const suppliersWithEmail =
        inactiveSuppliers.filter(
            (supplier) =>
                Boolean(supplier.email)
        ).length;

    setElementText(
        [
            "inactiveCount",
            "inactiveSuppliers",
            "totalInactiveSuppliers"
        ],
        inactiveSuppliers.length.toLocaleString()
    );

    setElementText(
        [
            "inactiveBalance",
            "totalBalance",
            "inactiveTotalBalance"
        ],
        formatMoney(totalBalance)
    );

    setElementText(
        [
            "balanceCount",
            "suppliersWithBalance"
        ],
        suppliersWithBalance.toLocaleString()
    );

    setElementText(
        [
            "emailCount",
            "suppliersWithEmail"
        ],
        suppliersWithEmail.toLocaleString()
    );

}

// =========================================
// Set Text Using Available ID
// =========================================

function setElementText(ids, value) {

    for (const id of ids) {

        const element = $(id);

        if (element) {
            element.textContent = value;
            return;
        }

    }

}

// =========================================
// Pagination
// =========================================

function getTotalPages() {

    return Math.max(
        1,
        Math.ceil(
            filteredSuppliers.length /
            pageSize
        )
    );

}

// =========================================
// Render Inactive Suppliers
// =========================================

function renderSuppliers() {

    const tableBody =
        $("supplierTableBody") ||
        $("tableBody");

    if (!tableBody) {
        return;
    }

    const hasSuppliers =
        filteredSuppliers.length > 0;

    if ($("emptyState")) {

        $("emptyState").classList.toggle(
            "hidden",
            hasSuppliers
        );

    }

    if ($("tableWrap")) {

        $("tableWrap").classList.toggle(
            "hidden",
            !hasSuppliers
        );

    }

    if ($("pagination")) {

        $("pagination").classList.toggle(
            "hidden",
            !hasSuppliers
        );

    }

    tableBody.innerHTML = "";

    if (!hasSuppliers) {
        return;
    }

    const startIndex =
        (currentPage - 1) * pageSize;

    const pageSuppliers =
        filteredSuppliers.slice(
            startIndex,
            startIndex + pageSize
        );

    pageSuppliers.forEach(
        (supplier, index) => {

            const row =
                document.createElement("tr");

            const balance =
                Number(
                    supplier.current_balance || 0
                );

            row.innerHTML = `

                <td>
                    ${startIndex + index + 1}
                </td>

                <td>

                    <div class="supplier-name">

                        ${safeHtml(
                            supplier.supplier_name ||
                            "Unnamed Supplier"
                        )}

                    </div>

                    <div class="supplier-sub">

                        Supplier ID:
                        ${Number(supplier.id)}

                    </div>

                </td>

                <td>

                    ${safeHtml(
                        supplier.contact_person ||
                        "—"
                    )}

                </td>

                <td>

                    ${
                        supplier.phone
                            ? `
                                <a
                                    href="tel:${safeAttribute(
                                        supplier.phone
                                    )}"
                                >
                                    ${safeHtml(
                                        supplier.phone
                                    )}
                                </a>
                            `
                            : "—"
                    }

                </td>

                <td>

                    ${
                        supplier.email
                            ? `
                                <a
                                    href="mailto:${safeAttribute(
                                        supplier.email
                                    )}"
                                >
                                    ${safeHtml(
                                        supplier.email
                                    )}
                                </a>
                            `
                            : "—"
                    }

                </td>

                <td>

                    ${safeHtml(
                        supplier.city || "—"
                    )}

                </td>

                <td>

                    <span
                        class="${
                            balance !== 0
                                ? "balance-positive"
                                : "balance-zero"
                        }"
                    >

                        ${formatMoney(balance)}

                    </span>

                </td>

                <td>

                    <span class="status-badge">
                        Inactive
                    </span>

                </td>

                <td>

                    <div class="row-actions">

                        <button
                            type="button"
                            class="action-btn restore-btn"
                            title="Restore Supplier"
                            data-action="restore"
                            data-id="${Number(
                                supplier.id
                            )}"
                        >

                            <i
                                class="fa-solid fa-rotate-left"
                            ></i>

                        </button>

                        <button
                            type="button"
                            class="action-btn delete-btn"
                            title="Permanently Delete Supplier"
                            data-action="delete"
                            data-id="${Number(
                                supplier.id
                            )}"
                        >

                            <i
                                class="fa-solid fa-trash"
                            ></i>

                        </button>

                    </div>

                </td>

            `;

            tableBody.appendChild(row);

        }
    );

    const endIndex =
        Math.min(
            startIndex + pageSize,
            filteredSuppliers.length
        );

    if ($("paginationInfo")) {

        $("paginationInfo").textContent =
            `Showing ${startIndex + 1} to ` +
            `${endIndex} of ` +
            `${filteredSuppliers.length} entries`;

    }

    if ($("pageNumber")) {
        $("pageNumber").textContent =
            currentPage;
    }

    if ($("prevButton")) {
        $("prevButton").disabled =
            currentPage <= 1;
    }

    if ($("nextButton")) {
        $("nextButton").disabled =
            currentPage >= getTotalPages();
    }

}

// =========================================
// Open Confirmation Modal
// =========================================

function openConfirmModal(
    supplier,
    action
) {

    pendingAction = {
        supplier,
        action
    };

    const restoring =
        action === "restore";

    if ($("confirmModalTitle")) {

        $("confirmModalTitle").textContent =
            restoring
                ? "Restore Supplier"
                : "Permanently Delete Supplier";

    }

    if ($("confirmModalSubtitle")) {

        $("confirmModalSubtitle").textContent =
            restoring
                ? "Return this supplier to the active supplier list."
                : "This action cannot be undone.";

    }

    if ($("confirmSupplierName")) {

        $("confirmSupplierName").textContent =
            supplier.supplier_name ||
            "Unnamed Supplier";

    }

    if ($("confirmWarning")) {

        $("confirmWarning").textContent =
            restoring
                ? "The supplier will become active and can be used for new purchases."
                : "Suppliers with purchase or transaction history cannot be permanently deleted.";

        $("confirmWarning").classList.toggle(
            "restore",
            restoring
        );

        $("confirmWarning").classList.toggle(
            "delete",
            !restoring
        );

    }

    if ($("confirmMessage")) {

        $("confirmMessage").textContent =
            restoring
                ? "Are you sure you want to restore this supplier?"
                : "Are you sure you want to permanently delete this supplier?";

    }

    if ($("confirmIcon")) {

        $("confirmIcon").classList.toggle(
            "restore",
            restoring
        );

        $("confirmIcon").classList.toggle(
            "delete",
            !restoring
        );

        $("confirmIcon").innerHTML =
            restoring
                ? `
                    <i
                        class="fa-solid fa-rotate-left"
                    ></i>
                `
                : `
                    <i
                        class="fa-solid fa-trash"
                    ></i>
                `;

    }

    if ($("confirmActionButton")) {

        $("confirmActionButton").disabled =
            false;

        $("confirmActionButton")
            .classList
            .toggle(
                "confirm-action-danger",
                !restoring
            );

        $("confirmActionButton").innerHTML =
            restoring
                ? `
                    <i
                        class="fa-solid fa-rotate-left"
                    ></i>
                    Restore Supplier
                `
                : `
                    <i
                        class="fa-solid fa-trash"
                    ></i>
                    Delete Permanently
                `;

    }

    if ($("confirmModal")) {

        $("confirmModal")
            .classList
            .remove("hidden");

        $("confirmModal").setAttribute(
            "aria-hidden",
            "false"
        );

    }

}

// =========================================
// Close Confirmation Modal
// =========================================

function closeConfirmModal() {

    if ($("confirmModal")) {

        $("confirmModal")
            .classList
            .add("hidden");

        $("confirmModal").setAttribute(
            "aria-hidden",
            "true"
        );

    }

    pendingAction = null;

}

// =========================================
// Restore or Delete Supplier
// =========================================

async function executePendingAction() {

    if (!pendingAction) {
        return;
    }

    const supplier =
        pendingAction.supplier;

    const action =
        pendingAction.action;

    const restoring =
        action === "restore";

    const confirmButton =
        $("confirmActionButton");

    const originalContent =
        confirmButton
            ? confirmButton.innerHTML
            : "";

    if (confirmButton) {

        confirmButton.disabled = true;

        confirmButton.innerHTML = `

            <i
                class="fa-solid fa-spinner fa-spin"
            ></i>

            ${
                restoring
                    ? "Restoring..."
                    : "Deleting..."
            }

        `;

    }

    try {

        const url =
            restoring
                ? `${SUPPLIER_API}/${supplier.id}/restore`
                : `${SUPPLIER_API}/${supplier.id}/permanent`;

        const method =
            restoring
                ? "PATCH"
                : "DELETE";

        const data =
            await apiRequest(
                url,
                {
                    method
                }
            );

        closeConfirmModal();

        showToast(
            data.message ||
            (
                restoring
                    ? "Supplier restored successfully."
                    : "Supplier permanently deleted."
            ),
            "success"
        );

        await loadInactiveSuppliers();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    } finally {

        if (confirmButton) {

            confirmButton.disabled =
                false;

            confirmButton.innerHTML =
                originalContent;

        }

    }

}

// =========================================
// Loading State
// =========================================

function showLoading(show) {

    if ($("loadingState")) {

        $("loadingState")
            .classList
            .toggle(
                "hidden",
                !show
            );

    }

    if (show) {

        if ($("emptyState")) {
            $("emptyState")
                .classList
                .add("hidden");
        }

        if ($("tableWrap")) {
            $("tableWrap")
                .classList
                .add("hidden");
        }

        if ($("pagination")) {
            $("pagination")
                .classList
                .add("hidden");
        }

    }

    if ($("refreshButton")) {

        $("refreshButton").disabled =
            show;

    }

}

// =========================================
// Toast Notification
// =========================================

function showToast(
    message,
    type = "success"
) {

    if (
        window.RukhnavLayout &&
        typeof window.RukhnavLayout.toast ===
        "function"
    ) {

        window.RukhnavLayout.toast(
            message,
            type
        );

        return;

    }

    let container =
        $("toastContainer");

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "toastContainer";

        container.className =
            "toast-container";

        document.body.appendChild(
            container
        );

    }

    const toast =
        document.createElement("div");

    toast.className =
        `page-toast ${type}`;

    toast.innerHTML = `

        <strong>

            ${
                type === "success"
                    ? "Success"
                    : "Error"
            }

        </strong>

        <div>
            ${safeHtml(message)}
        </div>

    `;

    container.appendChild(toast);

    setTimeout(
        () => {
            toast.remove();
        },
        4500
    );

}

// =========================================
// Formatting Helpers
// =========================================

function formatMoney(value) {

    return new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 2
        }
    ).format(
        Number(value || 0)
    );

}

// =========================================
// HTML Security Helpers
// =========================================

function safeHtml(value) {

    const element =
        document.createElement("div");

    element.textContent =
        String(value ?? "");

    return element.innerHTML;

}

function safeAttribute(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

}

// =========================================
// Event Listeners
// =========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if ($("searchInput")) {

            $("searchInput").addEventListener(
                "input",
                () => {

                    currentPage = 1;

                    applySupplierFilter();

                }
            );

        }

        if ($("pageSizeSelect")) {

            $("pageSizeSelect").addEventListener(
                "change",
                (event) => {

                    pageSize =
                        Number(
                            event.target.value
                        ) || 10;

                    currentPage = 1;

                    renderSuppliers();

                }
            );

        }

        if ($("refreshButton")) {

            $("refreshButton").addEventListener(
                "click",
                loadInactiveSuppliers
            );

        }

        if ($("prevButton")) {

            $("prevButton").addEventListener(
                "click",
                () => {

                    if (currentPage > 1) {

                        currentPage--;

                        renderSuppliers();

                    }

                }
            );

        }

        if ($("nextButton")) {

            $("nextButton").addEventListener(
                "click",
                () => {

                    if (
                        currentPage <
                        getTotalPages()
                    ) {

                        currentPage++;

                        renderSuppliers();

                    }

                }
            );

        }

        const tableBody =
            $("supplierTableBody") ||
            $("tableBody");

        if (tableBody) {

            tableBody.addEventListener(
                "click",
                (event) => {

                    const button =
                        event.target.closest(
                            "[data-action]"
                        );

                    if (!button) {
                        return;
                    }

                    const supplierId =
                        Number(
                            button.dataset.id
                        );

                    const supplier =
                        inactiveSuppliers.find(
                            (item) =>
                                Number(item.id) ===
                                supplierId
                        );

                    if (!supplier) {

                        showToast(
                            "Supplier was not found.",
                            "error"
                        );

                        return;

                    }

                    const action =
                        button.dataset.action;

                    if (
                        action === "restore" ||
                        action === "delete"
                    ) {

                        openConfirmModal(
                            supplier,
                            action
                        );

                    }

                }
            );

        }

        if ($("closeConfirmModal")) {

            $("closeConfirmModal")
                .addEventListener(
                    "click",
                    closeConfirmModal
                );

        }

        if ($("cancelConfirmButton")) {

            $("cancelConfirmButton")
                .addEventListener(
                    "click",
                    closeConfirmModal
                );

        }

        if ($("confirmActionButton")) {

            $("confirmActionButton")
                .addEventListener(
                    "click",
                    executePendingAction
                );

        }

        if ($("confirmModal")) {

            $("confirmModal").addEventListener(
                "click",
                (event) => {

                    if (
                        event.target.hasAttribute(
                            "data-close-confirm-modal"
                        )
                    ) {

                        closeConfirmModal();

                    }

                }
            );

        }

        document.addEventListener(
            "keydown",
            (event) => {

                if (event.key !== "Escape") {
                    return;
                }

                if (
                    $("confirmModal") &&
                    !$("confirmModal")
                        .classList
                        .contains("hidden")
                ) {

                    closeConfirmModal();

                }

            }
        );

        loadInactiveSuppliers();

    }
);