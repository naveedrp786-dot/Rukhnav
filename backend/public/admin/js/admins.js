"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// ==========================================
// RUKHNAV ERP - Admin Management v2
// ==========================================

const API_BASE = RUKHNAV_ORIGIN + "/api/admins";

let admins = [];
let filteredAdmins = [];
let currentPage = 1;
let pageSize = 10;
let deleteAdminId = null;

const $ = (id) => document.getElementById(id);

// ==========================================
// Authentication token
// ==========================================

function getToken() {
    return (
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("adminToken") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

// ==========================================
// API request helper
// ==========================================

async function apiRequest(url, options = {}) {
    const token = getToken();

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`;
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
            data.message ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}

// ==========================================
// Load administrators
// ==========================================

async function loadAdmins() {
    showLoading(true);

    try {
        const data = await apiRequest(
            API_BASE
        );

        admins = Array.isArray(data.admins)
            ? data.admins
            : [];

        applyFilters();
        updateStatistics();

        $("lastUpdated").textContent =
            new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });

    } catch (error) {
        admins = [];
        filteredAdmins = [];

        renderAdmins();
        updateStatistics();

        showToast(error.message, "error");

    } finally {
        showLoading(false);
    }
}

// ==========================================
// Apply search and filters
// ==========================================

function applyFilters() {
    const searchValue =
        $("searchInput").value
            .trim()
            .toLowerCase();

    const roleValue =
        $("roleFilter").value
            .trim()
            .toLowerCase();

    const statusValue =
        $("statusFilter").value
            .trim()
            .toLowerCase();

    filteredAdmins = admins.filter((admin) => {
        const name = `${admin.first_name || ""} ${admin.last_name || ""}`
            .trim();

        const searchableText = [
            name,
            admin.email,
            admin.phone,
            admin.role,
            admin.status
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesSearch =
            searchableText.includes(searchValue);

        const matchesRole =
            !roleValue ||
            String(admin.role || "")
                .toLowerCase() === roleValue;

        const matchesStatus =
            !statusValue ||
            String(admin.status || "Active")
                .toLowerCase() === statusValue;

        return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
        );
    });

    currentPage = 1;

    renderAdmins();
}

// ==========================================
// Statistics
// ==========================================

function updateStatistics() {
    const activeCount = admins.filter(
        (admin) =>
            String(admin.status || "Active")
                .toLowerCase() === "active"
    ).length;

    const superAdminCount = admins.filter(
        (admin) =>
            String(admin.role || "")
                .toLowerCase() === "superadmin"
    ).length;

    $("totalAdmins").textContent =
        admins.length.toLocaleString();

    $("activeAdmins").textContent =
        activeCount.toLocaleString();

    $("superAdmins").textContent =
        superAdminCount.toLocaleString();
}

// ==========================================
// Pagination helpers
// ==========================================

function getTotalPages() {
    return Math.max(
        1,
        Math.ceil(filteredAdmins.length / pageSize)
    );
}

// ==========================================
// Render administrator table
// ==========================================

function renderAdmins() {
    const hasAdmins =
        filteredAdmins.length > 0;

    $("emptyState").classList.toggle(
        "hidden",
        hasAdmins
    );

    $("tableWrap").classList.toggle(
        "hidden",
        !hasAdmins
    );

    $("pagination").classList.toggle(
        "hidden",
        !hasAdmins
    );

    $("adminTableBody").innerHTML = "";

    if (!hasAdmins) {
        return;
    }

    const totalPages = getTotalPages();

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex =
        (currentPage - 1) * pageSize;

    const pageAdmins =
        filteredAdmins.slice(
            startIndex,
            startIndex + pageSize
        );

    pageAdmins.forEach((admin) => {
        const row =
            document.createElement("tr");

        const fullName =
            `${admin.first_name || ""} ${admin.last_name || ""}`
                .trim() || "Unnamed Admin";

        const imageUrl = admin.profile_image
            ? `${RUKHNAV_ORIGIN}/uploads/admins/${encodeURIComponent(admin.profile_image)}`
            : "images/default-user.png";

        const role =
            String(admin.role || "admin")
                .toLowerCase();

        const status =
            String(admin.status || "Active")
                .toLowerCase();

        row.innerHTML = `
            <td>
                <div class="admin-profile-cell">

                    <img
                        src="${safeAttribute(imageUrl)}"
                        alt="${safeAttribute(fullName)}"
                        class="admin-avatar"
                        onerror="this.src='images/default-user.png'">

                    <div>
                        <div class="admin-name">
                            ${safeHtml(fullName)}
                        </div>

                        <div class="admin-id">
                            Admin ID: ${Number(admin.id)}
                        </div>
                    </div>

                </div>
            </td>

            <td>
                ${safeHtml(admin.email || "—")}
            </td>

            <td>
                ${safeHtml(admin.phone || "—")}
            </td>

            <td>
                <span class="role-badge ${safeAttribute(role)}">
                    ${safeHtml(formatRole(role))}
                </span>
            </td>

            <td>
                <span class="status-badge ${safeAttribute(status)}">
                    ${safeHtml(admin.status || "Active")}
                </span>
            </td>

            <td>
                ${safeHtml(formatDate(admin.created_at))}
            </td>

            <td>
                <div class="admin-actions">

                    <button
                        type="button"
                        class="admin-action-button edit"
                        title="Edit administrator"
                        data-action="edit"
                        data-id="${Number(admin.id)}">

                        <i class="fa-solid fa-pen"></i>

                    </button>

                    <button
                        type="button"
                        class="admin-action-button delete"
                        title="Delete administrator"
                        data-action="delete"
                        data-id="${Number(admin.id)}">

                        <i class="fa-solid fa-trash-can"></i>

                    </button>

                </div>
            </td>
        `;

        $("adminTableBody").appendChild(row);
    });

    const endIndex = Math.min(
        startIndex + pageSize,
        filteredAdmins.length
    );

    $("paginationInfo").textContent =
        `Showing ${startIndex + 1} to ${endIndex} ` +
        `of ${filteredAdmins.length} administrators`;

    $("pageNumber").textContent =
        currentPage;

    $("prevButton").disabled =
        currentPage <= 1;

    $("nextButton").disabled =
        currentPage >= totalPages;
}

// ==========================================
// Open add modal
// ==========================================

function openAddAdminModal() {
    $("adminForm").reset();

    delete $("adminForm").dataset.editId;

    $("modalTitle").textContent =
        "Add New Admin";

    $("modalSubtitle").textContent =
        "Create a new administrator account.";

    $("saveAdminButton").innerHTML = `
        <i class="fa-solid fa-floppy-disk"></i>
        Save Admin
    `;

    $("password").required = true;
    $("passwordRequiredMark").style.display =
        "inline";

    $("passwordHelp").textContent =
        "Password is required when creating an administrator.";

    $("imagePreview").src =
        "images/default-user.png";

    showAdminModal();
}

// ==========================================
// Open edit modal
// ==========================================

async function openEditAdminModal(id) {
    try {
        const data = await apiRequest(
            `${API_BASE}/${id}`
        );

        const admin = data.admin;

        if (!admin) {
            throw new Error(
                "Administrator was not found."
            );
        }

        $("adminForm").reset();

        $("adminForm").dataset.editId =
            admin.id;

        $("firstName").value =
            admin.first_name || "";

        $("lastName").value =
            admin.last_name || "";

        $("email").value =
            admin.email || "";

        $("phone").value =
            admin.phone || "";

        $("role").value =
            admin.role || "admin";

        $("password").value = "";
        $("password").required = false;

        $("passwordRequiredMark").style.display =
            "none";

        $("passwordHelp").textContent =
            "Leave blank to keep the existing password.";

        $("modalTitle").textContent =
            "Edit Administrator";

        $("modalSubtitle").textContent =
            "Update administrator account information.";

        $("saveAdminButton").innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            Update Admin
        `;

        $("imagePreview").src =
            admin.profile_image
                ? `${RUKHNAV_ORIGIN}/uploads/admins/${encodeURIComponent(admin.profile_image)}`
                : "images/default-user.png";

        showAdminModal();

    } catch (error) {
        showToast(error.message, "error");
    }
}

// ==========================================
// Save administrator
// ==========================================

async function saveAdmin(event) {
    event.preventDefault();

    const saveButton =
        $("saveAdminButton");

    const editId =
        $("adminForm").dataset.editId;

    const originalText =
        saveButton.innerHTML;

    saveButton.disabled = true;

    saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Saving...
    `;

    try {
        const formData =
            new FormData();

        formData.append(
            "first_name",
            $("firstName").value.trim()
        );

        formData.append(
            "last_name",
            $("lastName").value.trim()
        );

        formData.append(
            "email",
            $("email").value.trim()
        );

        formData.append(
            "phone",
            $("phone").value.trim()
        );

        formData.append(
            "role",
            $("role").value
        );

        const password =
            $("password").value.trim();

        if (password) {
            formData.append(
                "password",
                password
            );
        }

        const profileImage =
            $("profileImage").files[0];

        if (profileImage) {
            formData.append(
                "profile_image",
                profileImage
            );
        }

        const url = editId
            ? `${API_BASE}/${editId}`
            : API_BASE;

        const method = editId
            ? "PUT"
            : "POST";

        const result = await apiRequest(
            url,
            {
                method,
                body: formData
            }
        );

        closeAdminModal();

        showToast(
            result.message ||
            (
                editId
                    ? "Administrator updated successfully."
                    : "Administrator created successfully."
            ),
            "success"
        );

        await loadAdmins();

    } catch (error) {
        showToast(error.message, "error");

    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalText;
    }
}

// ==========================================
// Admin modal controls
// ==========================================

function showAdminModal() {
    $("adminModal").classList.remove(
        "hidden"
    );

    $("adminModal").setAttribute(
        "aria-hidden",
        "false"
    );

    setTimeout(() => {
        $("firstName").focus();
    }, 100);
}

function closeAdminModal() {
    $("adminModal").classList.add(
        "hidden"
    );

    $("adminModal").setAttribute(
        "aria-hidden",
        "true"
    );

    $("adminForm").reset();

    delete $("adminForm").dataset.editId;

    $("imagePreview").src =
        "images/default-user.png";
}

// ==========================================
// Delete modal
// ==========================================

function openDeleteModal(id) {
    const admin = admins.find(
        (item) =>
            Number(item.id) === Number(id)
    );

    if (!admin) {
        showToast(
            "Administrator was not found.",
            "error"
        );

        return;
    }

    deleteAdminId = Number(id);

    const fullName =
        `${admin.first_name || ""} ${admin.last_name || ""}`
            .trim() || "this administrator";

    $("deleteAdminName").textContent =
        `Are you sure you want to delete ${fullName}?`;

    $("deleteModal").classList.remove(
        "hidden"
    );

    $("deleteModal").setAttribute(
        "aria-hidden",
        "false"
    );
}

function closeDeleteModal() {
    deleteAdminId = null;

    $("deleteModal").classList.add(
        "hidden"
    );

    $("deleteModal").setAttribute(
        "aria-hidden",
        "true"
    );
}

async function confirmDeleteAdmin() {
    if (!deleteAdminId) {
        return;
    }

    const button =
        $("confirmDeleteButton");

    const originalText =
        button.innerHTML;

    button.disabled = true;

    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Deleting...
    `;

    try {
        const result = await apiRequest(
            `${API_BASE}/${deleteAdminId}`,
            {
                method: "DELETE"
            }
        );

        closeDeleteModal();

        showToast(
            result.message ||
            "Administrator deleted successfully.",
            "success"
        );

        await loadAdmins();

    } catch (error) {
        closeDeleteModal();

        showToast(
            error.message,
            "error"
        );

    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// ==========================================
// Loading state
// ==========================================

function showLoading(show) {
    $("loadingState").classList.toggle(
        "hidden",
        !show
    );

    if (show) {
        $("emptyState").classList.add(
            "hidden"
        );

        $("tableWrap").classList.add(
            "hidden"
        );

        $("pagination").classList.add(
            "hidden"
        );
    }

    $("refreshButton").disabled = show;
}

// ==========================================
// Profile image preview
// ==========================================

function previewSelectedImage(event) {
    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        showToast(
            "Only JPG, PNG and WEBP images are allowed.",
            "error"
        );

        event.target.value = "";

        return;
    }

    $("imagePreview").src =
        URL.createObjectURL(file);
}

// ==========================================
// Formatting helpers
// ==========================================

function formatRole(role) {
    if (role === "superadmin") {
        return "Super Admin";
    }

    return role
        ? role.charAt(0).toUpperCase() +
          role.slice(1)
        : "Admin";
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-PK",
        {
            year: "numeric",
            month: "short",
            day: "2-digit"
        }
    );
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

// ==========================================
// Toast
// ==========================================

function showToast(message, type = "success") {
    const toast =
        document.createElement("div");

    toast.className =
        `admin-toast ${type}`;

    toast.innerHTML = `
        <strong>
            ${type === "success" ? "Success" : "Error"}
        </strong>

        <div>
            ${safeHtml(message)}
        </div>
    `;

    $("toastContainer").appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4500);
}

// ==========================================
// Event listeners
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        if (!getToken()) {
            window.location.href =
                "login.html";

            return;
        }

        $("addAdminBtn").addEventListener(
            "click",
            openAddAdminModal
        );

        $("emptyAddAdminBtn").addEventListener(
            "click",
            openAddAdminModal
        );

        $("closeModal").addEventListener(
            "click",
            closeAdminModal
        );

        $("cancelAdminButton").addEventListener(
            "click",
            closeAdminModal
        );

        $("adminForm").addEventListener(
            "submit",
            saveAdmin
        );

        $("profileImage").addEventListener(
            "change",
            previewSelectedImage
        );

        $("searchInput").addEventListener(
            "input",
            applyFilters
        );

        $("roleFilter").addEventListener(
            "change",
            applyFilters
        );

        $("statusFilter").addEventListener(
            "change",
            applyFilters
        );

        $("refreshButton").addEventListener(
            "click",
            loadAdmins
        );

        $("pageSizeSelect").addEventListener(
            "change",
            (event) => {
                pageSize =
                    Number(event.target.value) || 10;

                currentPage = 1;

                renderAdmins();
            }
        );

        $("prevButton").addEventListener(
            "click",
            () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderAdmins();
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
                    renderAdmins();
                }
            }
        );

        $("adminTableBody").addEventListener(
            "click",
            (event) => {
                const button =
                    event.target.closest(
                        "[data-action]"
                    );

                if (!button) {
                    return;
                }

                const id =
                    Number(button.dataset.id);

                if (
                    button.dataset.action ===
                    "edit"
                ) {
                    openEditAdminModal(id);
                }

                if (
                    button.dataset.action ===
                    "delete"
                ) {
                    openDeleteModal(id);
                }
            }
        );

        $("cancelDeleteButton").addEventListener(
            "click",
            closeDeleteModal
        );

        $("confirmDeleteButton").addEventListener(
            "click",
            confirmDeleteAdmin
        );

        $("adminModal").addEventListener(
            "click",
            (event) => {
                if (
                    event.target.hasAttribute(
                        "data-close-admin-modal"
                    )
                ) {
                    closeAdminModal();
                }
            }
        );

        $("deleteModal").addEventListener(
            "click",
            (event) => {
                if (
                    event.target.hasAttribute(
                        "data-close-delete-modal"
                    )
                ) {
                    closeDeleteModal();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                if (event.key !== "Escape") {
                    return;
                }

                closeAdminModal();
                closeDeleteModal();
            }
        );

        loadAdmins();
    }
);