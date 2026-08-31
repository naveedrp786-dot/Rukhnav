"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =========================================
// RUKHNAV ERP - Supplier Management
// =========================================

const SUPPLIER_API =
    RUKHNAV_ORIGIN + "/api/suppliers";

let suppliers = [];
let inactiveSupplierList = [];
let filteredSuppliers = [];

let currentPage = 1;
let pageSize = 10;
let supplierPendingDeactivate = null;

// =========================================
// Element helper
// =========================================

const $ = (id) => document.getElementById(id);

// =========================================
// Authentication token
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
// API helper
// =========================================

async function apiRequest(url, options = {}) {
    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`;
    }

    if (options.body) {
        headers["Content-Type"] = "application/json";
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

    if (response.status === 401 || response.status === 403) {
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
// Load suppliers
// =========================================

async function loadSuppliers() {
    showLoading(true);

    try {
        const [activeData, inactiveData] =
            await Promise.all([
                apiRequest(SUPPLIER_API),

                apiRequest(
                    `${SUPPLIER_API}/inactive/all`
                )
            ]);

        suppliers = Array.isArray(activeData.suppliers)
            ? activeData.suppliers
            : [];

        inactiveSupplierList =
            Array.isArray(inactiveData.suppliers)
                ? inactiveData.suppliers
                : [];

        applySupplierFilter();
        updateSupplierStats();

    } catch (error) {
        suppliers = [];
        inactiveSupplierList = [];
        filteredSuppliers = [];

        renderSuppliers();
        updateSupplierStats();

        showToast(error.message, "error");

    } finally {
        showLoading(false);
    }
}

// =========================================
// Search/filter
// =========================================

function applySupplierFilter() {
    const keyword =
        $("searchInput").value
            .trim()
            .toLowerCase();

    filteredSuppliers = suppliers.filter(
        (supplier) => {
            const searchableText = [
                supplier.id,
                supplier.supplier_name,
                supplier.contact_person,
                supplier.phone,
                supplier.email,
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

            return searchableText.includes(keyword);
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
// Statistics
// =========================================

function updateSupplierStats() {
    const totalSuppliers =
        suppliers.length +
        inactiveSupplierList.length;

    const totalBalance = suppliers.reduce(
        (sum, supplier) =>
            sum +
            Number(
                supplier.current_balance || 0
            ),
        0
    );

    $("totalSuppliers").textContent =
        totalSuppliers.toLocaleString();

    $("activeSuppliers").textContent =
        suppliers.length.toLocaleString();

    $("inactiveSuppliers").textContent =
        inactiveSupplierList.length.toLocaleString();

    $("totalBalance").textContent =
        formatMoney(totalBalance);
}

// =========================================
// Pagination
// =========================================

function getTotalPages() {
    return Math.max(
        1,
        Math.ceil(
            filteredSuppliers.length / pageSize
        )
    );
}

// =========================================
// Render suppliers
// =========================================

function renderSuppliers() {
    const hasSuppliers =
        filteredSuppliers.length > 0;

    $("emptyState").classList.toggle(
        "hidden",
        hasSuppliers
    );

    $("tableWrap").classList.toggle(
        "hidden",
        !hasSuppliers
    );

    $("pagination").classList.toggle(
        "hidden",
        !hasSuppliers
    );

    $("supplierTableBody").innerHTML = "";

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

    pageSuppliers.forEach((supplier, index) => {
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
                    Supplier ID: ${Number(supplier.id)}
                </div>
            </td>

            <td>
                ${safeHtml(
                    supplier.contact_person || "—"
                )}
            </td>

            <td>
                ${supplier.phone
                    ? `
                        <a href="tel:${safeAttribute(
                            supplier.phone
                        )}">
                            ${safeHtml(supplier.phone)}
                        </a>
                    `
                    : "—"
                }
            </td>

            <td>
                ${supplier.email
                    ? `
                        <a href="mailto:${safeAttribute(
                            supplier.email
                        )}">
                            ${safeHtml(supplier.email)}
                        </a>
                    `
                    : "—"
                }
            </td>

            <td>
                ${safeHtml(supplier.city || "—")}
            </td>

            <td>
                <span class="${
                    balance > 0
                        ? "balance-positive"
                        : "balance-zero"
                }">
                    ${formatMoney(balance)}
                </span>
            </td>

            <td>
                <span class="status-badge">
                    Active
                </span>
            </td>

            <td>
                <div class="row-actions">

                    <button
                        type="button"
                        class="action-btn edit-btn"
                        title="Edit Supplier"
                        data-action="edit"
                        data-id="${Number(supplier.id)}"
                    >
                        <i class="fa-solid fa-pen"></i>
                    </button>

                    <button
                        type="button"
                        class="action-btn deactivate-btn"
                        title="Deactivate Supplier"
                        data-action="deactivate"
                        data-id="${Number(supplier.id)}"
                    >
                        <i class="fa-solid fa-box-archive"></i>
                    </button>

                </div>
            </td>
        `;

        $("supplierTableBody").appendChild(row);
    });

    const endIndex = Math.min(
        startIndex + pageSize,
        filteredSuppliers.length
    );

    $("paginationInfo").textContent =
        `Showing ${startIndex + 1} to ` +
        `${endIndex} of ` +
        `${filteredSuppliers.length} entries`;

    $("pageNumber").textContent =
        currentPage;

    $("prevButton").disabled =
        currentPage <= 1;

    $("nextButton").disabled =
        currentPage >= getTotalPages();
}

// =========================================
// Open Add Supplier modal
// =========================================

function openAddSupplierModal() {
    resetSupplierForm();

    $("supplierModalTitle").textContent =
        "Add Supplier";

    $("saveSupplierButton").innerHTML = `
        <i class="fa-solid fa-floppy-disk"></i>
        Save Supplier
    `;

    $("currentBalanceGroup")
        .classList
        .add("hidden");

    $("supplierModal")
        .classList
        .remove("hidden");

    $("supplierModal").setAttribute(
        "aria-hidden",
        "false"
    );

    setTimeout(() => {
        $("supplierName").focus();
    }, 50);
}

// =========================================
// Open Edit Supplier modal
// =========================================

async function openEditSupplierModal(id) {
    try {
        const data = await apiRequest(
            `${SUPPLIER_API}/${id}`
        );

        const supplier = data.supplier;

        if (!supplier) {
            throw new Error(
                "Supplier record was not found."
            );
        }

        $("supplierId").value =
            supplier.id;

        $("supplierName").value =
            supplier.supplier_name || "";

        $("contactPerson").value =
            supplier.contact_person || "";

        $("supplierPhone").value =
            supplier.phone || "";

        $("supplierEmail").value =
            supplier.email || "";

        $("supplierAddress").value =
            supplier.address || "";

        $("supplierCity").value =
            supplier.city || "";

        $("supplierCountry").value =
            supplier.country || "Pakistan";

        $("taxNumber").value =
            supplier.tax_number || "";

        $("openingBalance").value =
            Number(
                supplier.opening_balance || 0
            );

        $("currentBalance").value =
            Number(
                supplier.current_balance || 0
            );

        $("supplierNotes").value =
            supplier.notes || "";

        $("supplierModalTitle").textContent =
            "Edit Supplier";

        $("saveSupplierButton").innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            Update Supplier
        `;

        $("currentBalanceGroup")
            .classList
            .remove("hidden");

        $("supplierModal")
            .classList
            .remove("hidden");

        $("supplierModal").setAttribute(
            "aria-hidden",
            "false"
        );

    } catch (error) {
        showToast(error.message, "error");
    }
}

// =========================================
// Close supplier modal
// =========================================

function closeSupplierModal() {
    $("supplierModal")
        .classList
        .add("hidden");

    $("supplierModal").setAttribute(
        "aria-hidden",
        "true"
    );

    resetSupplierForm();
}

// =========================================
// Reset supplier form
// =========================================

function resetSupplierForm() {
    $("supplierForm").reset();

    $("supplierId").value = "";
    $("supplierCountry").value = "Pakistan";
    $("openingBalance").value = "0";
    $("currentBalance").value = "0";

    $("currentBalanceGroup")
        .classList
        .add("hidden");

    $("saveSupplierButton").disabled = false;
}

// =========================================
// Save supplier
// =========================================

async function saveSupplier(event) {
    event.preventDefault();

    const supplierId =
        $("supplierId").value.trim();

    const supplierName =
        $("supplierName").value.trim();

    if (!supplierName) {
        showToast(
            "Supplier name is required.",
            "error"
        );

        $("supplierName").focus();
        return;
    }

    const payload = {
        supplier_name: supplierName,

        contact_person:
            $("contactPerson").value.trim(),

        phone:
            $("supplierPhone").value.trim(),

        email:
            $("supplierEmail").value.trim(),

        address:
            $("supplierAddress").value.trim(),

        city:
            $("supplierCity").value.trim(),

        country:
            $("supplierCountry").value.trim() ||
            "Pakistan",

        tax_number:
            $("taxNumber").value.trim(),

        opening_balance:
            Number(
                $("openingBalance").value || 0
            ),

        notes:
            $("supplierNotes").value.trim()
    };

    if (supplierId) {
        payload.current_balance =
            Number(
                $("currentBalance").value || 0
            );
    }

    const saveButton =
        $("saveSupplierButton");

    const originalContent =
        saveButton.innerHTML;

    saveButton.disabled = true;

    saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        ${supplierId ? "Updating..." : "Saving..."}
    `;

    try {
        const data = await apiRequest(
            supplierId
                ? `${SUPPLIER_API}/${supplierId}`
                : SUPPLIER_API,
            {
                method: supplierId
                    ? "PUT"
                    : "POST",

                body: JSON.stringify(payload)
            }
        );

        closeSupplierModal();

        showToast(
            data.message ||
            (
                supplierId
                    ? "Supplier updated successfully."
                    : "Supplier created successfully."
            ),
            "success"
        );

        await loadSuppliers();

    } catch (error) {
        showToast(error.message, "error");

    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalContent;
    }
}

// =========================================
// Open deactivate confirmation
// =========================================

function openDeactivateModal(supplier) {
    supplierPendingDeactivate = supplier;

    $("confirmSupplierName").textContent =
        supplier.supplier_name ||
        "this supplier";

    $("deactivateModal")
        .classList
        .remove("hidden");

    $("deactivateModal").setAttribute(
        "aria-hidden",
        "false"
    );
}

// =========================================
// Close deactivate confirmation
// =========================================

function closeDeactivateModal() {
    $("deactivateModal")
        .classList
        .add("hidden");

    $("deactivateModal").setAttribute(
        "aria-hidden",
        "true"
    );

    supplierPendingDeactivate = null;
}

// =========================================
// Deactivate supplier
// =========================================

async function deactivateSupplier() {
    if (!supplierPendingDeactivate) {
        return;
    }

    const supplier =
        supplierPendingDeactivate;

    const button =
        $("confirmDeactivateButton");

    const originalContent =
        button.innerHTML;

    button.disabled = true;

    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Deactivating...
    `;

    try {
        const data = await apiRequest(
            `${SUPPLIER_API}/${supplier.id}/deactivate`,
            {
                method: "PATCH"
            }
        );

        closeDeactivateModal();

        showToast(
            data.message ||
            "Supplier deactivated successfully.",
            "success"
        );

        await loadSuppliers();

    } catch (error) {
        showToast(error.message, "error");

    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}

// =========================================
// Loading state
// =========================================

function showLoading(show) {
    $("loadingState").classList.toggle(
        "hidden",
        !show
    );

    if (show) {
        $("emptyState")
            .classList
            .add("hidden");

        $("tableWrap")
            .classList
            .add("hidden");

        $("pagination")
            .classList
            .add("hidden");
    }

    $("refreshButton").disabled = show;
}

// =========================================
// Toast
// =========================================

function showToast(message, type = "success") {
    const container =
        $("toastContainer");

    const toast =
        document.createElement("div");

    toast.className =
        `page-toast ${type}`;

    toast.innerHTML = `
        <strong>
            ${type === "success"
                ? "Success"
                : "Error"
            }
        </strong>

        <div>
            ${safeHtml(message)}
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4500);
}

// =========================================
// Formatting and security helpers
// =========================================

function formatMoney(value) {
    return new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 2
        }
    ).format(Number(value || 0));
}

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
// Event listeners
// =========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        $("addSupplierBtn").addEventListener(
            "click",
            openAddSupplierModal
        );

        $("closeSupplierModal").addEventListener(
            "click",
            closeSupplierModal
        );

        $("cancelSupplierButton").addEventListener(
            "click",
            closeSupplierModal
        );

        $("supplierModal").addEventListener(
            "click",
            (event) => {
                if (
                    event.target.hasAttribute(
                        "data-close-supplier-modal"
                    )
                ) {
                    closeSupplierModal();
                }
            }
        );

        $("supplierForm").addEventListener(
            "submit",
            saveSupplier
        );

        $("searchInput").addEventListener(
            "input",
            () => {
                currentPage = 1;
                applySupplierFilter();
            }
        );

        $("pageSizeSelect").addEventListener(
            "change",
            (event) => {
                pageSize =
                    Number(event.target.value) ||
                    10;

                currentPage = 1;

                renderSuppliers();
            }
        );

        $("refreshButton").addEventListener(
            "click",
            loadSuppliers
        );

        $("prevButton").addEventListener(
            "click",
            () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderSuppliers();
                }
            }
        );

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

        $("supplierTableBody").addEventListener(
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
                    Number(button.dataset.id);

                const supplier =
                    suppliers.find(
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

                if (
                    button.dataset.action ===
                    "edit"
                ) {
                    openEditSupplierModal(
                        supplierId
                    );
                }

                if (
                    button.dataset.action ===
                    "deactivate"
                ) {
                    openDeactivateModal(
                        supplier
                    );
                }
            }
        );

        $("closeConfirmModal").addEventListener(
            "click",
            closeDeactivateModal
        );

        $("cancelDeactivateButton").addEventListener(
            "click",
            closeDeactivateModal
        );

        $("confirmDeactivateButton").addEventListener(
            "click",
            deactivateSupplier
        );

        $("deactivateModal").addEventListener(
            "click",
            (event) => {
                if (
                    event.target.hasAttribute(
                        "data-close-confirm-modal"
                    )
                ) {
                    closeDeactivateModal();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                if (event.key !== "Escape") {
                    return;
                }

                if (
                    !$("deactivateModal")
                        .classList
                        .contains("hidden")
                ) {
                    closeDeactivateModal();
                    return;
                }

                if (
                    !$("supplierModal")
                        .classList
                        .contains("hidden")
                ) {
                    closeSupplierModal();
                }
            }
        );

        loadSuppliers();
    }
);