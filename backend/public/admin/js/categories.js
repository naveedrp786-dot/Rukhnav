"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const CATEGORY_API =
    "/api/categories";

const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token");

if (!token) {
    window.location.href =
        "/admin/login.html";
}

const categoryState = {
    all: [],
    visible: [],
    deleteId: null
};

const elements = {};

document.addEventListener(
    "DOMContentLoaded",
    () => {
        cacheElements();
        bindEvents();
        loadCategories();
    }
);

function cacheElements() {
    [
        "categoryTableBody",
        "categoryTableWrapper",
        "categoryLoadingState",
        "categoryEmptyState",
        "categoryResultText",
        "categoryMessage",
        "searchInput",
        "categoryStatusFilter",
        "totalCategories",
        "activeCategories",
        "inactiveCategories",
        "visibleCategories",
        "categoryModal",
        "categoryForm",
        "modalTitle",
        "categoryName",
        "description",
        "status",
        "categoryImage",
        "imagePreview",
        "categoryIconKey",
        "categoryIconColor",
        "categoryIconPreview",
        "categoryIconPicker",
        "categoryColourPicker",
        "saveCategoryButton",
        "deleteCategoryModal",
        "deleteCategoryName",
        "confirmDeleteCategoryButton",
        "categoryToastContainer"
    ].forEach(
        id => {
            elements[id] =
                document.getElementById(id);
        }
    );
}

function bindEvents() {
    document
        .getElementById("addCategoryBtn")
        ?.addEventListener(
            "click",
            () => openCategoryModal()
        );

    document
        .getElementById("emptyAddCategoryButton")
        ?.addEventListener(
            "click",
            () => openCategoryModal()
        );

    document
        .getElementById("refreshCategoriesButton")
        ?.addEventListener(
            "click",
            loadCategories
        );

    document
        .getElementById("clearCategoryFiltersButton")
        ?.addEventListener(
            "click",
            clearFilters
        );

    elements.searchInput
        ?.addEventListener(
            "input",
            applyFilters
        );

    elements.categoryStatusFilter
        ?.addEventListener(
            "change",
            applyFilters
        );

    elements.categoryImage
        ?.addEventListener(
            "change",
            previewSelectedImage
        );

    elements.categoryIconPicker
        ?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-icon-key]"
                    );

                if (!button) {
                    return;
                }

                selectCategoryIcon(
                    button.dataset.iconKey
                );
            }
        );

    elements.categoryColourPicker
        ?.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-icon-color]"
                    );

                if (!button) {
                    return;
                }

                selectCategoryIconColor(
                    button.dataset.iconColor
                );
            }
        );


    elements.categoryForm
        ?.addEventListener(
            "submit",
            saveCategory
        );

    [
        "closeModal",
        "cancelCategoryButton"
    ].forEach(
        id => {
            document
                .getElementById(id)
                ?.addEventListener(
                    "click",
                    closeCategoryModal
                );
        }
    );

    document
        .querySelector(
            "[data-close-category-modal]"
        )
        ?.addEventListener(
            "click",
            closeCategoryModal
        );

    [
        "closeDeleteCategoryModal",
        "cancelDeleteCategoryButton"
    ].forEach(
        id => {
            document
                .getElementById(id)
                ?.addEventListener(
                    "click",
                    closeDeleteModal
                );
        }
    );

    document
        .querySelector(
            "[data-close-delete-modal]"
        )
        ?.addEventListener(
            "click",
            closeDeleteModal
        );

    elements.confirmDeleteCategoryButton
        ?.addEventListener(
            "click",
            deleteSelectedCategory
        );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key !== "Escape") {
                return;
            }

            closeCategoryModal();
            closeDeleteModal();
        }
    );
}

function requestHeaders() {
    return {
        Authorization:
            `Bearer ${token}`
    };
}

async function loadCategories() {
    setLoading(true);
    showMessage("");

    try {
        const response =
            await fetch(
                CATEGORY_API,
                {
                    headers:
                        requestHeaders(),
                    cache:
                        "no-store"
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            data.success === false
        ) {
            throw new Error(
                data.message ||
                "Unable to load categories."
            );
        }

        categoryState.all =
            Array.isArray(data.categories)
                ? data.categories
                : [];

        updateSummary();
        applyFilters();
    } catch (error) {
        categoryState.all = [];
        categoryState.visible = [];

        renderCategories();

        showMessage(
            error.message ||
            "Unable to load categories.",
            "error"
        );
    } finally {
        setLoading(false);
    }
}

function updateSummary() {
    const categories =
        categoryState.all;

    elements.totalCategories.textContent =
        String(categories.length);

    elements.activeCategories.textContent =
        String(
            categories.filter(
                category =>
                    normalizedStatus(
                        category.status
                    ) === "active"
            ).length
        );

    elements.inactiveCategories.textContent =
        String(
            categories.filter(
                category =>
                    normalizedStatus(
                        category.status
                    ) === "inactive"
            ).length
        );
}

function applyFilters() {
    const search =
        String(
            elements.searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const status =
        normalizedStatus(
            elements.categoryStatusFilter?.value
        );

    categoryState.visible =
        categoryState.all.filter(
            category => {
                const searchable = [
                    category.category_name,
                    category.description
                ]
                    .map(
                        value =>
                            String(value || "")
                                .toLowerCase()
                    )
                    .join(" ");

                const searchMatches =
                    !search ||
                    searchable.includes(search);

                const statusMatches =
                    !status ||
                    normalizedStatus(
                        category.status
                    ) === status;

                return (
                    searchMatches &&
                    statusMatches
                );
            }
        );

    elements.visibleCategories.textContent =
        String(
            categoryState.visible.length
        );

    elements.categoryResultText.textContent =
        `${categoryState.visible.length} of ${categoryState.all.length} categories displayed.`;

    renderCategories();
}

function clearFilters() {
    elements.searchInput.value = "";
    elements.categoryStatusFilter.value = "";
    applyFilters();
}

function renderCategories() {
    const categories =
        categoryState.visible;

    const hasRows =
        categories.length > 0;

    elements.categoryTableWrapper
        .classList.toggle(
            "hidden",
            !hasRows
        );

    elements.categoryEmptyState
        .classList.toggle(
            "hidden",
            hasRows
        );

    if (!hasRows) {
        elements.categoryTableBody.innerHTML =
            "";
        return;
    }

    elements.categoryTableBody.innerHTML =
        categories
            .map(categoryRow)
            .join("");

    elements.categoryTableBody
        .querySelectorAll(
            "[data-edit-category]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () =>
                    editCategory(
                        button.dataset
                            .editCategory
                    )
            );
        });

    elements.categoryTableBody
        .querySelectorAll(
            "[data-delete-category]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () =>
                    openDeleteModal(
                        button.dataset
                            .deleteCategory
                    )
            );
        });
}

function categoryRow(category) {
    const image =
        categoryImageUrl(
            category.image
        );

    const name =
        escapeHtml(
            category.category_name ||
            "Unnamed Category"
        );

    const description =
        escapeHtml(
            category.description ||
            "No description provided."
        );

    const status =
        normalizedStatus(
            category.status
        ) || "inactive";

    const date =
        formatDate(
            category.updated_at ||
            category.created_at
        );

    return `
        <tr>
            <td>
                ${
                    image
                        ? `
                            <img
                                class="category-table-image"
                                src="${escapeHtml(image)}"
                                alt="${name}"
                                loading="lazy"
                                onerror="
                                    this.classList.add('hidden');
                                    this.nextElementSibling.classList.remove('hidden');
                                "
                            >
                            <div class="category-image-fallback hidden">
                                <i class="fa-regular fa-image"></i>
                            </div>
                        `
                        : `
                            <div class="category-image-fallback">
                                <i class="fa-regular fa-image"></i>
                            </div>
                        `
                }
            </td>

            <td>
                <strong class="category-name">
                    ${name}
                </strong>

                <small>
                    Category #${Number(category.id)}
                </small>
            </td>

            <td>
                <p class="category-description">
                    ${description}
                </p>
            </td>

            <td>
                <span class="category-status ${status}">
                    ${escapeHtml(capitalize(status))}
                </span>
            </td>

            <td>
                <span class="category-date">
                    ${escapeHtml(date)}
                </span>
            </td>

            <td>
                <div class="category-row-actions">
                    <button
                        type="button"
                        class="category-action-button edit"
                        data-edit-category="${Number(category.id)}"
                        title="Edit category"
                    >
                        <i class="fa-solid fa-pen"></i>
                        <span>Edit</span>
                    </button>

                    <button
                        type="button"
                        class="category-action-button delete"
                        data-delete-category="${Number(category.id)}"
                        title="Delete category"
                    >
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `;
}


const CATEGORY_ICON_CLASSES = {
    leaf: "fa-leaf",
    droplet: "fa-droplet",
    sparkles: "fa-sparkles",
    flower: "fa-fan",
    heart: "fa-heart",
    sun: "fa-sun",
    bottle: "fa-bottle-droplet",
    seedling: "fa-seedling",
    spa: "fa-spa",
    hair: "fa-wand-magic-sparkles",
    gift: "fa-gift",
    star: "fa-star",
    beauty: "fa-wand-sparkles",
    cleanser: "fa-pump-soap",
    shopping: "fa-bag-shopping",
    shirt: "fa-shirt"
};

function selectCategoryIcon(
    iconKey = "sparkles"
) {
    const safeKey =
        CATEGORY_ICON_CLASSES[iconKey]
            ? iconKey
            : "sparkles";

    elements.categoryIconKey.value =
        safeKey;

    elements.categoryIconPicker
        ?.querySelectorAll(
            "[data-icon-key]"
        )
        .forEach(button => {
            button.classList.toggle(
                "selected",
                button.dataset.iconKey ===
                    safeKey
            );
        });

    renderCategoryIconPreview();
}

function selectCategoryIconColor(
    color = "#D4A72C"
) {
    const safeColor =
        /^#[0-9a-fA-F]{6}$/.test(
            String(color)
        )
            ? String(color)
            : "#D4A72C";

    elements.categoryIconColor.value =
        safeColor;

    elements.categoryColourPicker
        ?.querySelectorAll(
            "[data-icon-color]"
        )
        .forEach(button => {
            button.classList.toggle(
                "selected",
                String(
                    button.dataset.iconColor
                ).toLowerCase() ===
                    safeColor.toLowerCase()
            );
        });

    renderCategoryIconPreview();
}

function renderCategoryIconPreview() {
    if (!elements.categoryIconPreview) {
        return;
    }

    const key =
        elements.categoryIconKey?.value ||
        "sparkles";

    const color =
        elements.categoryIconColor?.value ||
        "#D4A72C";

    const iconClass =
        CATEGORY_ICON_CLASSES[key] ||
        CATEGORY_ICON_CLASSES.sparkles;

    elements.categoryIconPreview.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
    `;

    elements.categoryIconPreview.style.color =
        color;

    elements.categoryIconPreview.style.setProperty(
        "--category-preview-color",
        color
    );
}

function openCategoryModal(
    category = null
) {
    elements.categoryForm.reset();

    delete elements.categoryForm
        .dataset.editId;

    elements.modalTitle.textContent =
        category
            ? "Edit Category"
            : "Add Category";

    elements.saveCategoryButton.innerHTML =
        category
            ? `
                <i class="fa-solid fa-floppy-disk"></i>
                Update Category
            `
            : `
                <i class="fa-solid fa-floppy-disk"></i>
                Save Category
            `;

    if (category) {
        elements.categoryForm
            .dataset.editId =
            String(category.id);

        elements.categoryName.value =
            category.category_name || "";

        elements.description.value =
            category.description || "";

        elements.status.value =
            normalizedStatus(
                category.status
            ) || "active";

        selectCategoryIcon(
            category.icon_key ||
            "sparkles"
        );

        selectCategoryIconColor(
            category.icon_color ||
            "#D4A72C"
        );

        renderImagePreview(
            categoryImageUrl(
                category.image
            )
        );
    } else {
        elements.status.value =
            "active";

        selectCategoryIcon(
            "sparkles"
        );

        selectCategoryIconColor(
            "#D4A72C"
        );

        renderImagePreview("");
    }

    elements.categoryModal
        .classList.remove("hidden");

    elements.categoryModal
        .setAttribute(
            "aria-hidden",
            "false"
        );

    document.body
        .classList.add(
            "category-modal-open"
        );

    setTimeout(
        () =>
            elements.categoryName
                .focus(),
        50
    );
}

function closeCategoryModal() {
    if (
        elements.categoryModal
            ?.classList.contains(
                "hidden"
            )
    ) {
        return;
    }

    elements.categoryModal
        .classList.add("hidden");

    elements.categoryModal
        .setAttribute(
            "aria-hidden",
            "true"
        );

    elements.categoryForm.reset();

    delete elements.categoryForm
        .dataset.editId;

    document.body
        .classList.remove(
            "category-modal-open"
        );
}

async function editCategory(id) {
    const category =
        categoryState.all.find(
            item =>
                Number(item.id) ===
                Number(id)
        );

    if (category) {
        openCategoryModal(category);
        return;
    }

    try {
        const response =
            await fetch(
                `${CATEGORY_API}/${encodeURIComponent(id)}`,
                {
                    headers:
                        requestHeaders()
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            data.success === false
        ) {
            throw new Error(
                data.message ||
                "Unable to load category."
            );
        }

        openCategoryModal(
            data.category
        );
    } catch (error) {
        toast(
            error.message,
            "error"
        );
    }
}

function previewSelectedImage(event) {
    const file =
        event.target.files?.[0];

    if (!file) {
        renderImagePreview("");
        return;
    }

    const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowed.includes(file.type)) {
        event.target.value = "";

        toast(
            "Select a JPG, PNG or WEBP image.",
            "error"
        );

        renderImagePreview("");
        return;
    }

    if (
        file.size >
        5 * 1024 * 1024
    ) {
        event.target.value = "";

        toast(
            "Category image must not exceed 5 MB.",
            "error"
        );

        renderImagePreview("");
        return;
    }

    renderImagePreview(
        URL.createObjectURL(file)
    );
}

function renderImagePreview(url) {
    if (!url) {
        elements.imagePreview.innerHTML = `
            <div class="category-preview-placeholder">
                <i class="fa-regular fa-image"></i>
                <span>No image selected</span>
            </div>
        `;

        return;
    }

    elements.imagePreview.innerHTML = `
        <img
            src="${escapeHtml(url)}"
            alt="Category image preview"
        >
    `;
}

async function saveCategory(event) {
    event.preventDefault();

    const name =
        elements.categoryName
            .value
            .trim();

    if (!name) {
        toast(
            "Category name is required.",
            "error"
        );

        elements.categoryName.focus();
        return;
    }

    const button =
        elements.saveCategoryButton;

    const original =
        button.innerHTML;

    button.disabled = true;
    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Saving...
    `;

    try {
        const formData =
            new FormData();

        formData.append(
            "category_name",
            name
        );

        formData.append(
            "description",
            elements.description
                .value
                .trim()
        );

        formData.append(
            "status",
            elements.status.value
        );

        formData.append(
            "icon_key",
            elements.categoryIconKey
                ?.value ||
                "sparkles"
        );

        formData.append(
            "icon_color",
            elements.categoryIconColor
                ?.value ||
                "#D4A72C"
        );

        const image =
            elements.categoryImage
                .files?.[0];

        if (image) {
            formData.append(
                "image",
                image
            );
        }

        const editId =
            elements.categoryForm
                .dataset.editId;

        const response =
            await fetch(
                editId
                    ? `${CATEGORY_API}/${encodeURIComponent(editId)}`
                    : CATEGORY_API,
                {
                    method:
                        editId
                            ? "PUT"
                            : "POST",

                    headers:
                        requestHeaders(),

                    body:
                        formData
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            data.success === false
        ) {
            throw new Error(
                data.message ||
                "Unable to save category."
            );
        }

        closeCategoryModal();

        toast(
            data.message ||
            "Category saved successfully.",
            "success"
        );

        await loadCategories();
    } catch (error) {
        toast(
            error.message ||
            "Unable to save category.",
            "error"
        );
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function openDeleteModal(id) {
    const category =
        categoryState.all.find(
            item =>
                Number(item.id) ===
                Number(id)
        );

    categoryState.deleteId =
        Number(id);

    elements.deleteCategoryName
        .textContent =
        category?.category_name ||
        `Category #${id}`;

    elements.deleteCategoryModal
        .classList.remove("hidden");

    elements.deleteCategoryModal
        .setAttribute(
            "aria-hidden",
            "false"
        );

    document.body
        .classList.add(
            "category-modal-open"
        );
}

function closeDeleteModal() {
    if (
        elements.deleteCategoryModal
            ?.classList.contains(
                "hidden"
            )
    ) {
        return;
    }

    elements.deleteCategoryModal
        .classList.add("hidden");

    elements.deleteCategoryModal
        .setAttribute(
            "aria-hidden",
            "true"
        );

    categoryState.deleteId = null;

    document.body
        .classList.remove(
            "category-modal-open"
        );
}

async function deleteSelectedCategory() {
    const id =
        categoryState.deleteId;

    if (!id) {
        return;
    }

    const button =
        elements.confirmDeleteCategoryButton;

    const original =
        button.innerHTML;

    button.disabled = true;
    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Deleting...
    `;

    try {
        const response =
            await fetch(
                `${CATEGORY_API}/${encodeURIComponent(id)}`,
                {
                    method:
                        "DELETE",

                    headers:
                        requestHeaders()
                }
            );

        const data =
            await response.json();

        if (
            !response.ok ||
            data.success === false
        ) {
            throw new Error(
                data.message ||
                "Unable to delete category."
            );
        }

        closeDeleteModal();

        toast(
            data.message ||
            "Category deleted successfully.",
            "success"
        );

        await loadCategories();
    } catch (error) {
        toast(
            error.message ||
            "Unable to delete category.",
            "error"
        );
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function setLoading(loading) {
    elements.categoryLoadingState
        .classList.toggle(
            "hidden",
            !loading
        );

    if (loading) {
        elements.categoryTableWrapper
            .classList.add("hidden");

        elements.categoryEmptyState
            .classList.add("hidden");
    }
}

function showMessage(
    message,
    type = ""
) {
    elements.categoryMessage
        .textContent =
        message || "";

    elements.categoryMessage
        .className =
        `category-message ${type}`
            .trim();
}

function toast(
    message,
    type = "success"
) {
    const item =
        document.createElement("div");

    item.className =
        `category-toast ${type}`;

    item.innerHTML = `
        <i class="fa-solid ${
            type === "success"
                ? "fa-circle-check"
                : "fa-circle-exclamation"
        }"></i>

        <span>${escapeHtml(message)}</span>
    `;

    elements.categoryToastContainer
        .appendChild(item);

    setTimeout(
        () =>
            item.remove(),
        3500
    );
}

function categoryImageUrl(value) {
    const image =
        String(value || "")
            .trim();

    if (!image) {
        return "";
    }

    if (
        /^https?:\/\//i.test(image) ||
        image.startsWith("data:")
    ) {
        return image;
    }

    if (image.startsWith("/")) {
        return image;
    }

    if (image.startsWith("uploads/")) {
        return `/${image}`;
    }

    return (
        RUKHNAV_ORIGIN + "/uploads/categories/" +
        encodeURIComponent(image)
    );
}

function normalizedStatus(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function capitalize(value) {
    const text =
        String(value || "");

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day:
                "2-digit",
            month:
                "short",
            year:
                "numeric"
        }
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
