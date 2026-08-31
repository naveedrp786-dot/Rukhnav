"use strict";

// ==========================================
// RUKHNAV ERP Product Management
// ==========================================

const API_URL = "/api/products";
const CATEGORY_API = "/api/categories";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token") ||
    "";

if (!token) {
    window.location.href =
    "/admin/login.html";
}

const tableBody =
    document.getElementById(
        "productTableBody"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const addProductBtn =
    document.getElementById(
        "addProductBtn"
    );

const modal =
    document.getElementById(
        "productModal"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );

const productForm =
    document.getElementById(
        "productForm"
    );

const imageInput =
    document.getElementById(
        "productImages"
    );

const preview =
    document.getElementById(
        "imagePreview"
    );

const existingImages =
    document.getElementById(
        "existingImages"
    );

const categoryFilter =
    document.getElementById(
        "categoryFilter"
    );

const statusFilter =
    document.getElementById(
        "statusFilter"
    );

const clearProductFilters =
    document.getElementById(
        "clearProductFilters"
    );

const refreshProductsBtn =
    document.getElementById(
        "refreshProductsBtn"
    );

const cancelProductButton =
    document.getElementById(
        "cancelProductButton"
    );

let loadedProducts = [];

// ==========================================
// API Request
// ==========================================
async function adminRequest(
    url,
    options = {}
) {
    const headers = {
        Authorization:
            `Bearer ${token}`,
        ...(options.headers || {})
    };

    const response =
        await fetch(url, {
            ...options,
            headers
        });

    let data;

    try {
        data = await response.json();
    } catch (error) {
        data = {
            success: false,
            message:
                "Invalid server response."
        };
    }

    if (response.status === 401) {
        localStorage.removeItem(
            "token"
        );

        window.location.href =
            "/admin/login.html";

        throw new Error(
            "Your session has expired."
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Request failed."
        );
    }

    return data;
}

// ==========================================
// Helpers
// ==========================================
function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function productImageUrl(
    imageName
) {
    if (!imageName) {
        return "/admin/images/no-image.png";
    }

    const image =
        String(imageName);

    if (
        image.startsWith("http://") ||
        image.startsWith("https://")
    ) {
        return image;
    }

    if (
        image.startsWith("/uploads/")
    ) {
        return image;
    }

    return `/uploads/products/${
        image.split("/").pop()
    }`;
}

function normalizeStatus(status) {
    return String(
        status || "active"
    ).toLowerCase();
}

function resetImageAreas() {
    imageInput.value = "";
    preview.innerHTML = "";
    existingImages.innerHTML = "";
}

// ==========================================
// Preview Newly Selected Images
// ==========================================
imageInput.addEventListener(
    "change",
    () => {
        preview.innerHTML = "";

        const files =
            [...imageInput.files];

        if (files.length > 20) {
            alert(
                "You can upload a maximum of 20 images."
            );

            imageInput.value = "";
            return;
        }

        for (const file of files) {
            if (
                file.size >
                5 * 1024 * 1024
            ) {
                alert(
                    `${file.name} is larger than 5 MB.`
                );

                imageInput.value = "";
                preview.innerHTML = "";
                return;
            }

            const reader =
                new FileReader();

            reader.onload = event => {
                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "preview-item new-image";

                item.innerHTML = `
                    <img
                        src="${
                            event.target.result
                        }"
                        alt="${
                            escapeHTML(
                                file.name
                            )
                        }"
                    >

                    <span class="image-label">
                        New
                    </span>
                `;

                preview.appendChild(
                    item
                );
            };

            reader.readAsDataURL(file);
        }
    }
);

// ==========================================
// Load Categories
// ==========================================
async function loadCategories() {
    const categorySelect =
        document.getElementById(
            "category"
        );

    try {
        const data =
            await adminRequest(
                CATEGORY_API
            );

        const categories =
            Array.isArray(
                data.categories
            )
                ? data.categories
                : [];

        categorySelect.innerHTML = `
            <option value="">
                Select Category
            </option>

            ${categories
                .filter(category =>
                    normalizeStatus(
                        category.status
                    ) !== "inactive"
                )
                .map(category => `
                    <option value="${
                        escapeHTML(
                            category.category_name
                        )
                    }">
                        ${
                            escapeHTML(
                                category.category_name
                            )
                        }
                    </option>
                `)
                .join("")}
        `;
    } catch (error) {
        console.error(error);

        categorySelect.innerHTML = `
            <option value="">
                Unable to load categories
            </option>
        `;
    }
}

// ==========================================
// Load Products
// ==========================================
async function loadProducts() {
    try {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    Loading Products...
                </td>
            </tr>
        `;

        const data =
            await adminRequest(
                `${API_URL}?limit=100`
            );

        loadedProducts =
            Array.isArray(
                data.products
            )
                ? data.products
                : [];

        populateProductFilters();
        applyProductFilters();
    } catch (error) {
        console.error(error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    ${escapeHTML(
                        error.message
                    )}
                </td>
            </tr>
        `;
    }
}

// ==========================================
// Render Products
// ==========================================
function renderProducts(products) {
    const visibleProducts =
        document.getElementById(
            "visibleProducts"
        );

    if (visibleProducts) {
        visibleProducts.textContent =
            products.length;
    }

    document.getElementById(
        "totalProducts"
    ).textContent = loadedProducts.length;

    const activeCount =
        loadedProducts.filter(
            product =>
                normalizeStatus(
                    product.status
                ) === "active"
        ).length;

    document.getElementById(
        "activeProducts"
    ).textContent = activeCount;

    const lowStockCount =
        loadedProducts.filter(
            product =>
                Number(
                    product.stock_quantity ||
                    0
                ) <= 10
        ).length;

    document.getElementById(
        "lowStockProducts"
    ).textContent = lowStockCount;

    if (products.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8">
                    No products found.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML =
        products.map(product => {
            const stock =
                Number(
                    product.stock_quantity ||
                    0
                );

            let statusClass =
                "inactive";

            let statusText =
                product.status ||
                "Inactive";

            if (stock <= 0) {
                statusText =
                    "Out of Stock";
            } else if (stock <= 10) {
                statusText =
                    "Low Stock";
            } else if (
                normalizeStatus(
                    product.status
                ) === "active"
            ) {
                statusClass =
                    "active";

                statusText =
                    "Active";
            }

            return `
                <tr>
                    <td>
                        ${product.id}
                    </td>

                    <td>
                        <img
                            class="product-image"
                            src="${
                                productImageUrl(
                                    product.image
                                )
                            }"
                            alt="${
                                escapeHTML(
                                    product.product_name
                                )
                            }"
                            onerror="
                                this.onerror=null;
                                this.src='/admin/images/no-image.png';
                            "
                        >
                    </td>

                    <td>
                        <strong>
                            ${
                                escapeHTML(
                                    product.product_name
                                )
                            }
                        </strong>

                        <small class="product-sku">
                            ${
                                escapeHTML(
                                    product.sku ||
                                    "No SKU"
                                )
                            }
                        </small>
                    </td>

                    <td>
                        ${
                            escapeHTML(
                                product.category ||
                                "-"
                            )
                        }
                    </td>

                    <td>
                        Rs. ${
                            Number(
                                product.selling_price ||
                                0
                            ).toLocaleString(
                                "en-PK"
                            )
                        }
                    </td>

                    <td>
                        <span class="${
                            stock <= 0
                                ? "stock-out"
                                : stock <= 10
                                    ? "stock-low"
                                    : "stock-good"
                        }">
                            ${stock}
                        </span>
                    </td>

                    <td>
                        <span class="status ${
                            statusClass
                        }">
                            ${
                                escapeHTML(
                                    statusText
                                )
                            }
                        </span>
                    </td>

                    <td>
                        <button
                            class="edit-btn"
                            title="Edit product and images"
                            onclick="editProduct(${
                                product.id
                            })"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            class="delete-btn"
                            title="Deactivate product"
                            onclick="deleteProduct(${
                                product.id
                            })"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
}

// ==========================================
// Filters
// ==========================================
function populateProductFilters() {
    if (!categoryFilter) {
        return;
    }

    const current =
        categoryFilter.value;

    const categories =
        [...new Set(
            loadedProducts
                .map(product =>
                    String(
                        product.category ||
                        ""
                    ).trim()
                )
                .filter(Boolean)
        )].sort(
            (a, b) =>
                a.localeCompare(b)
        );

    categoryFilter.innerHTML = `
        <option value="">
            All categories
        </option>

        ${categories.map(category => `
            <option value="${escapeHTML(category)}">
                ${escapeHTML(category)}
            </option>
        `).join("")}
    `;

    categoryFilter.value =
        categories.includes(current)
            ? current
            : "";
}

function applyProductFilters() {
    const keyword =
        String(
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const category =
        String(
            categoryFilter?.value ||
            ""
        );

    const status =
        String(
            statusFilter?.value ||
            ""
        );

    const filtered =
        loadedProducts.filter(product => {
            const stock =
                Number(
                    product.stock_quantity ||
                    0
                );

            const matchesSearch =
                !keyword ||
                [
                    product.product_name,
                    product.sku,
                    product.category
                ]
                    .filter(Boolean)
                    .some(value =>
                        String(value)
                            .toLowerCase()
                            .includes(keyword)
                    );

            const matchesCategory =
                !category ||
                String(
                    product.category ||
                    ""
                ) === category;

            let matchesStatus = true;

            if (status === "active") {
                matchesStatus =
                    normalizeStatus(
                        product.status
                    ) === "active" &&
                    stock > 0;
            } else if (status === "inactive") {
                matchesStatus =
                    normalizeStatus(
                        product.status
                    ) === "inactive";
            } else if (status === "low-stock") {
                matchesStatus =
                    stock > 0 &&
                    stock <= 10;
            } else if (status === "out-of-stock") {
                matchesStatus =
                    stock <= 0;
            }

            return (
                matchesSearch &&
                matchesCategory &&
                matchesStatus
            );
        });

    renderProducts(filtered);
}

searchInput?.addEventListener(
    "input",
    applyProductFilters
);

categoryFilter?.addEventListener(
    "change",
    applyProductFilters
);

statusFilter?.addEventListener(
    "change",
    applyProductFilters
);

clearProductFilters?.addEventListener(
    "click",
    () => {
        searchInput.value = "";
        categoryFilter.value = "";
        statusFilter.value = "";
        applyProductFilters();
    }
);

refreshProductsBtn?.addEventListener(
    "click",
    loadProducts
);

// ==========================================
// Open Add Product Modal
// ==========================================
addProductBtn.addEventListener(
    "click",
    () => {
        document.getElementById(
            "modalTitle"
        ).textContent =
            "Add Product";

        productForm.reset();

        delete productForm.dataset.editId;

        resetImageAreas();

        document.getElementById(
            "status"
        ).value = "active";

        modal.classList.remove(
            "hidden"
        );
    }
);

// ==========================================
// Close Modal
// ==========================================
function closeProductModal() {
    modal.classList.add(
        "hidden"
    );

    productForm.reset();

    delete productForm.dataset.editId;

    resetImageAreas();
}

closeModal.addEventListener(
    "click",
    closeProductModal
);

cancelProductButton?.addEventListener(
    "click",
    closeProductModal
);

modal.addEventListener(
    "click",
    event => {
        if (event.target === modal) {
            closeProductModal();
        }
    }
);

// ==========================================
// Edit Product
// ==========================================
async function editProduct(id) {
    try {
        const data =
            await adminRequest(
                `${API_URL}/${id}`
            );

        const product =
            data.product;

        document.getElementById(
            "modalTitle"
        ).textContent =
            "Edit Product";

        document.getElementById(
            "productName"
        ).value =
            product.product_name || "";

        document.getElementById(
            "sku"
        ).value =
            product.sku || "";

        document.getElementById(
            "category"
        ).value =
            product.category || "";

        document.getElementById(
            "price"
        ).value =
            product.selling_price || "";

        document.getElementById(
            "stock"
        ).value =
            product.stock_quantity ?? 0;

        document.getElementById(
            "status"
        ).value =
            normalizeStatus(
                product.status
            );

        document.getElementById(
            "description"
        ).value =
            product.description || "";

        document.getElementById(
            "ingredients"
        ).value =
            product.ingredients || "";

        document.getElementById(
            "directions"
        ).value =
            product.directions || "";

        document.getElementById(
            "warnings"
        ).value =
            product.warnings || "";

        productForm.dataset.editId =
            product.id;

        imageInput.value = "";
        preview.innerHTML = "";

        renderExistingImages(
            product.images || [],
            product.id
        );

        modal.classList.remove(
            "hidden"
        );
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ==========================================
// Render Existing Gallery
// ==========================================
function renderExistingImages(
    images,
    productId
) {
    if (!images.length) {
        existingImages.innerHTML = `
            <p class="no-images-message">
                No saved product images.
            </p>
        `;

        return;
    }

    existingImages.innerHTML = `
        <div class="gallery-heading">
            Saved Images
            <small>
                Select “Main” to change the
                storefront image.
            </small>
        </div>

        ${images.map(image => `
            <div class="preview-item existing-image ${
                image.is_main
                    ? "main-image"
                    : ""
            }">
                <img
                    src="${
                        productImageUrl(
                            image.image_name
                        )
                    }"
                    alt="Product image"
                    onerror="
                        this.onerror=null;
                        this.src='/admin/images/no-image.png';
                    "
                >

                ${
                    image.is_main
                        ? `
                            <span class="main-image-badge">
                                Main
                            </span>
                        `
                        : ""
                }

                <div class="image-actions">
                    ${
                        !image.is_main
                            ? `
                                <button
                                    type="button"
                                    class="set-main-image-btn"
                                    onclick="setMainImage(
                                        ${productId},
                                        ${image.id}
                                    )"
                                >
                                    Main
                                </button>
                            `
                            : ""
                    }

                    <button
                        type="button"
                        class="delete-image-btn"
                        onclick="deleteProductImage(
                            ${productId},
                            ${image.id}
                        )"
                    >
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join("")}
    `;
}

// ==========================================
// Set Main Image
// ==========================================
async function setMainImage(
    productId,
    imageId
) {
    try {
        const confirmed =
            confirm(
                "Set this as the main product image?"
            );

        if (!confirmed) {
            return;
        }

        const data =
            await adminRequest(
                `${API_URL}/${productId}/images/${imageId}/main`,
                {
                    method: "PATCH"
                }
            );

        alert(data.message);

        await refreshEditingGallery(
            productId
        );

        await loadProducts();
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ==========================================
// Delete One Product Image
// ==========================================
async function deleteProductImage(
    productId,
    imageId
) {
    try {
        const confirmed =
            confirm(
                "Delete this product image? This cannot be undone."
            );

        if (!confirmed) {
            return;
        }

        const data =
            await adminRequest(
                `${API_URL}/${productId}/images/${imageId}`,
                {
                    method: "DELETE"
                }
            );

        alert(data.message);

        await refreshEditingGallery(
            productId
        );

        await loadProducts();
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ==========================================
// Refresh Open Gallery
// ==========================================
async function refreshEditingGallery(
    productId
) {
    const data =
        await adminRequest(
            `${API_URL}/${productId}`
        );

    renderExistingImages(
        data.product.images || [],
        productId
    );
}

// ==========================================
// Deactivate Product
// ==========================================
async function deleteProduct(id) {
    const confirmed =
        confirm(
            "Move this product to Inactive Products?"
        );

    if (!confirmed) {
        return;
    }

    try {
        const data =
            await adminRequest(
                `${API_URL}/${id}`,
                {
                    method: "DELETE"
                }
            );

        alert(data.message);

        await loadProducts();
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// ==========================================
// Save Product
// ==========================================
productForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const submitButton =
            productForm.querySelector(
                'button[type="submit"]'
            );

        const originalContent =
            submitButton.innerHTML;

        submitButton.disabled = true;

        submitButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Saving...
        `;

        try {
            const formData =
                new FormData();

            formData.append(
                "product_name",
                document.getElementById(
                    "productName"
                ).value.trim()
            );

            formData.append(
                "sku",
                document.getElementById(
                    "sku"
                ).value.trim()
            );

            formData.append(
                "category",
                document.getElementById(
                    "category"
                ).value
            );

            formData.append(
                "selling_price",
                document.getElementById(
                    "price"
                ).value
            );

            formData.append(
                "stock_quantity",
                document.getElementById(
                    "stock"
                ).value
            );

            formData.append(
                "status",
                document.getElementById(
                    "status"
                ).value
            );

            formData.append(
                "description",
                document.getElementById(
                    "description"
                ).value.trim()
            );

            formData.append(
                "ingredients",
                document.getElementById(
                    "ingredients"
                ).value.trim()
            );

            formData.append(
                "directions",
                document.getElementById(
                    "directions"
                ).value.trim()
            );

            formData.append(
                "warnings",
                document.getElementById(
                    "warnings"
                ).value.trim()
            );

            for (
                const file of imageInput.files
            ) {
                formData.append(
                    "images",
                    file
                );
            }

            const editId =
                productForm.dataset.editId;

            const url =
                editId
                    ? `${API_URL}/${editId}`
                    : API_URL;

            const method =
                editId
                    ? "PUT"
                    : "POST";

            const data =
                await adminRequest(
                    url,
                    {
                        method,
                        body: formData
                    }
                );

            alert(data.message);

            closeProductModal();

            await loadProducts();
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML =
                originalContent;
        }
    }
);

// ==========================================
// Initial Load
// ==========================================
Promise.all([
    loadCategories(),
    loadProducts()
]);