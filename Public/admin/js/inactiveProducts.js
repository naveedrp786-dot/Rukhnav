"use strict";

const API_BASE = "/api/products";
const IMAGE_BASE = "/uploads/products/";

let products = [];
let filteredProducts = [];
let currentPage = 1;
let pageSize = 10;
let pendingAction = null;

const $ = (id) => document.getElementById(id);

// =====================================
// Get admin authentication token
// =====================================
function getToken() {
    return (
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("adminToken") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

// =====================================
// API request helper
// =====================================
async function apiRequest(url, options = {}) {
    const authToken = getToken();

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization = authToken.startsWith("Bearer ")
            ? authToken
            : `Bearer ${authToken}`;
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

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed with status ${response.status}`
        );
    }

    return data;
}

// =====================================
// Load inactive products
// =====================================
async function loadProducts() {
    showLoading(true);

    try {
        const data = await apiRequest(
            `${API_BASE}/inactive/all`
        );

        products = Array.isArray(data.products)
            ? data.products
            : [];

        applyFilter();
        updateStats();

        $("lastUpdated").textContent =
            new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

    } catch (error) {
        products = [];
        filteredProducts = [];

        renderProducts();
        updateStats();

        showToast(error.message, "error");

    } finally {
        showLoading(false);
    }
}

// =====================================
// Search products
// =====================================
function applyFilter() {
    const searchValue =
        $("searchInput").value.trim().toLowerCase();

    filteredProducts = products.filter((product) => {
        const searchableText = [
            product.product_name,
            product.sku,
            product.category,
            product.category_name
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchableText.includes(searchValue);
    });

    currentPage = Math.min(currentPage, getTotalPages());

    if (currentPage < 1) {
        currentPage = 1;
    }

    renderProducts();
}

// =====================================
// Total pages
// =====================================
function getTotalPages() {
    return Math.max(
        1,
        Math.ceil(filteredProducts.length / pageSize)
    );
}

// =====================================
// Update summary cards
// =====================================
function updateStats() {
    const totalStock = products.reduce(
        (sum, product) =>
            sum + Number(product.stock_quantity || 0),
        0
    );

    const inventoryValue = products.reduce(
        (sum, product) => {
            const stock =
                Number(product.stock_quantity || 0);

            const price =
                Number(
                    product.selling_price ||
                    product.price ||
                    0
                );

            return sum + stock * price;
        },
        0
    );

    $("inactiveCount").textContent =
        products.length.toLocaleString();

    $("totalStock").textContent =
        totalStock.toLocaleString();

    $("inventoryValue").textContent =
        new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            maximumFractionDigits: 0
        }).format(inventoryValue);
}

// =====================================
// Render table
// =====================================
function renderProducts() {
    const hasProducts =
        filteredProducts.length > 0;

    $("emptyState").classList.toggle(
        "hidden",
        hasProducts
    );

    $("tableWrap").classList.toggle(
        "hidden",
        !hasProducts
    );

    $("pagination").classList.toggle(
        "hidden",
        !hasProducts
    );

    $("tableBody").innerHTML = "";

    if (!hasProducts) {
        return;
    }

    const startIndex =
        (currentPage - 1) * pageSize;

    const pageProducts =
        filteredProducts.slice(
            startIndex,
            startIndex + pageSize
        );

    pageProducts.forEach((product) => {
        const row = document.createElement("tr");

        const imageName =
            product.image ||
            product.primary_image ||
            "";

        const imageHtml = imageName
            ? `
                <img
                    class="product-image"
                    src="${safeAttribute(
                        /^https?:\/\//i.test(imageName)
                            ? imageName
                            : imageName.startsWith("/")
                                ? imageName
                                : imageName.startsWith("uploads/")
                                    ? `/${imageName}`
                                    : IMAGE_BASE +
                                      encodeURIComponent(imageName)
                    )}"
                    alt="${safeAttribute(
                        product.product_name || "Product"
                    )}"
                    onerror="this.style.display='none';
                    this.nextElementSibling.style.display='grid';"
                >

                <div
                    class="product-placeholder"
                    style="display:none;"
                    aria-label="No product image"
                >
                    <i class="fa-regular fa-image"></i>
                    <span>No image</span>
                </div>
            `
            : `
                <div
                    class="product-placeholder"
                    aria-label="No product image"
                >
                    <i class="fa-regular fa-image"></i>
                    <span>No image</span>
                </div>
            `;

        const category =
            product.category_name ||
            product.category ||
            "Uncategorised";

        const price =
            product.selling_price ||
            product.price ||
            0;

        row.innerHTML = `
            <td>
                ${imageHtml}
            </td>

            <td>
                <div class="product-name">
                    ${safeHtml(
                        product.product_name ||
                        "Unnamed Product"
                    )}
                </div>

                <div class="product-sub">
                    ID: ${Number(product.id)}
                </div>
            </td>

            <td>
                ${safeHtml(product.sku || "—")}
            </td>

            <td>
                <span class="category-badge">
                    ${safeHtml(category)}
                </span>
            </td>

            <td>
                <strong>
                    ${formatMoney(price)}
                </strong>
            </td>

            <td>
                <strong>
                    ${Number(
                        product.stock_quantity || 0
                    ).toLocaleString()}
                </strong>
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
                        data-action="restore"
                        data-id="${Number(product.id)}"
                    >
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>Restore Product</span>
                    </button>

                    <button
                        type="button"
                        class="action-btn delete-btn"
                        data-action="delete"
                        data-id="${Number(product.id)}"
                    >
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete Permanently</span>
                    </button>

                </div>
            </td>
        `;

        $("tableBody").appendChild(row);
    });

    const endIndex = Math.min(
        startIndex + pageSize,
        filteredProducts.length
    );

    $("paginationInfo").textContent =
        `Showing ${startIndex + 1} to ${endIndex} ` +
        `of ${filteredProducts.length} entries`;

    $("pageNumber").textContent = currentPage;

    $("prevButton").disabled =
        currentPage <= 1;

    $("nextButton").disabled =
        currentPage >= getTotalPages();
}

// =====================================
// Open confirmation modal
// =====================================
function openConfirmModal(product, actionType) {
    pendingAction = {
        product,
        type: actionType
    };

    const isRestore =
        actionType === "restore";

    $("modalTitle").textContent = isRestore
        ? "Restore Product"
        : "Permanently Delete Product";

    $("modalProduct").textContent =
        product.product_name || "";

    $("modalWarning").textContent = isRestore
        ? "This product will return to the active Products page."
        : "This action cannot be undone. Products with transaction history cannot be permanently deleted.";

    $("modalMessage").textContent = isRestore
        ? "Are you sure you want to restore this product?"
        : "Are you sure you want to permanently delete this product?";

    $("modalConfirm").innerHTML = isRestore
        ? `
            <i class="fa-solid fa-rotate-left"></i>
            <span>Restore Product</span>
        `
        : `
            <i class="fa-solid fa-trash-can"></i>
            <span>Delete Permanently</span>
        `;

    $("modalConfirm").className = isRestore
        ? "primary-btn erp-v5-btn erp-v5-btn--gold"
        : "primary-btn erp-v5-btn danger-confirm";

    // Important fix
    $("confirmModal").classList.remove("hidden");

    $("confirmModal").setAttribute(
        "aria-hidden",
        "false"
    );
}

// =====================================
// Close confirmation modal
// =====================================
function closeConfirmModal() {
    $("confirmModal").classList.add("hidden");

    $("confirmModal").setAttribute(
        "aria-hidden",
        "true"
    );

    pendingAction = null;
}

// =====================================
// Execute Restore or Permanent Delete
// =====================================
async function executeAction() {
    if (!pendingAction) {
        return;
    }

    const { product, type } = pendingAction;

    const confirmButton =
        $("modalConfirm");

    confirmButton.disabled = true;

    const originalButtonHtml =
        confirmButton.innerHTML;

    confirmButton.innerHTML =
        type === "restore"
            ? `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Restoring...</span>
            `
            : `
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Deleting...</span>
            `;

    try {
        let result;

        if (type === "restore") {
            result = await apiRequest(
                `${API_BASE}/${product.id}/restore`,
                {
                    method: "PATCH"
                }
            );
        } else {
            result = await apiRequest(
                `${API_BASE}/${product.id}/permanent`,
                {
                    method: "DELETE"
                }
            );
        }

        closeConfirmModal();

        showToast(
            result.message ||
            "Action completed successfully.",
            "success"
        );

        await loadProducts();

    } catch (error) {
        closeConfirmModal();

        showToast(
            error.message,
            "error"
        );

    } finally {
        confirmButton.disabled = false;
        confirmButton.innerHTML =
            originalButtonHtml;
    }
}

// =====================================
// Loading state
// =====================================
function showLoading(show) {
    $("loadingState").classList.toggle(
        "hidden",
        !show
    );

    if (show) {
        $("emptyState").classList.add("hidden");
        $("tableWrap").classList.add("hidden");
        $("pagination").classList.add("hidden");
    }

    $("refreshButton").disabled = show;
}

// =====================================
// Toast message
// =====================================
function showToast(message, type = "success") {
    const container =
        $("toastContainer");

    if (!container) {
        return;
    }

    const toast =
        document.createElement("div");

    toast.className =
        `page-toast ${type}`;

    toast.innerHTML = `
        <strong>
            ${type === "success" ? "Success" : "Error"}
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

// =====================================
// Security helpers
// =====================================
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

function formatMoney(value) {
    return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
}

// =====================================
// Event listeners
// =====================================
document.addEventListener(
    "DOMContentLoaded",
    () => {

        $("searchInput").addEventListener(
            "input",
            () => {
                currentPage = 1;
                applyFilter();
            }
        );

        $("refreshButton").addEventListener(
            "click",
            loadProducts
        );

        $("pageSizeSelect").addEventListener(
            "change",
            (event) => {
                pageSize =
                    Number(event.target.value) || 10;

                currentPage = 1;

                renderProducts();
            }
        );

        $("prevButton").addEventListener(
            "click",
            () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderProducts();
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
                    renderProducts();
                }
            }
        );

        // Restore and Delete button listener
        $("tableBody").addEventListener(
            "click",
            (event) => {
                const button =
                    event.target.closest(
                        "[data-action]"
                    );

                if (!button) {
                    return;
                }

                const productId =
                    Number(button.dataset.id);

                const product =
                    products.find(
                        (item) =>
                            Number(item.id) ===
                            productId
                    );

                if (!product) {
                    showToast(
                        "Product was not found.",
                        "error"
                    );

                    return;
                }

                openConfirmModal(
                    product,
                    button.dataset.action
                );
            }
        );

        $("modalClose").addEventListener(
            "click",
            closeConfirmModal
        );

        $("modalCancel").addEventListener(
            "click",
            closeConfirmModal
        );

        $("modalConfirm").addEventListener(
            "click",
            executeAction
        );

        $("confirmModal").addEventListener(
            "click",
            (event) => {
                if (
                    event.target.hasAttribute(
                        "data-close-modal"
                    )
                ) {
                    closeConfirmModal();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Escape" &&
                    !$("confirmModal")
                        .classList
                        .contains("hidden")
                ) {
                    closeConfirmModal();
                }
            }
        );

        loadProducts();
    }
);