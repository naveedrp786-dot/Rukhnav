"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =========================================
// RUKHNAV ERP - Customer Loyalty
// =========================================

const LOYALTY_API =
    RUKHNAV_ORIGIN + "/api/admin/loyalty";

let loyaltyCategories = [];
let loyaltyCustomers = [];

let currentPage = 1;
let pageSize = 20;
let totalPages = 1;
let totalCustomers = 0;

let selectedCategory = null;
let searchTimer = null;

const $ = (id) =>
    document.getElementById(id);

// =========================================
// Authentication
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
    window.location.href =
        "login.html";
}

// =========================================
// API Helper
// =========================================

async function apiRequest(
    url,
    options = {}
) {
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

    const response =
        await fetch(url, {
            ...options,
            headers
        });

    let data = {};

    try {
        data =
            await response.json();
    } catch (error) {
        data = {};
    }

    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem(
            "adminToken"
        );

               sessionStorage.removeItem(
            "token"
        );

        sessionStorage.removeItem(
            "adminToken"
        );

        window.location.href =
            "login.html";

        throw new Error(
            "Your login session has expired."
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
// Load Complete Page
// =========================================

async function loadPageData() {
    setCategoryLoading(true);
    setCustomerLoading(true);

    try {
        const [
            summaryData,
            categoryData
        ] = await Promise.all([
            apiRequest(
                `${LOYALTY_API}/summary`
            ),

            apiRequest(
                `${LOYALTY_API}/categories`
            )
        ]);

        renderSummary(
            summaryData.summary || {}
        );

        loyaltyCategories =
            Array.isArray(
                categoryData.categories
            )
                ? categoryData.categories
                : [];

        renderCategories();

        await loadCustomers();
    } catch (error) {
        loyaltyCategories = [];
        loyaltyCustomers = [];

        renderCategories();
        renderCustomers();

        showToast(
            error.message,
            "error"
        );
    } finally {
        setCategoryLoading(false);
        setCustomerLoading(false);
    }
}

// =========================================
// Load Summary Only
// =========================================

async function loadSummary() {
    const data =
        await apiRequest(
            `${LOYALTY_API}/summary`
        );

    renderSummary(
        data.summary || {}
    );
}

// =========================================
// Render Summary
// =========================================

function renderSummary(summary) {
    setText(
        "totalCustomers",
        formatNumber(
            summary.totalCustomers
        )
    );

    setText(
        "totalAvailablePoints",
        formatNumber(
            summary.totalAvailablePoints
        )
    );

    setText(
        "goldMembers",
        formatNumber(
            summary.goldMembers
        )
    );

    setText(
        "platinumMembers",
        formatNumber(
            summary.platinumMembers
        )
    );
}

// =========================================
// Render Categories
// =========================================

function renderCategories() {
    const container =
        $("categoryCards");

    if (!container) return;

    if (
        loyaltyCategories.length === 0
    ) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML =
        loyaltyCategories
            .map(
                (category) =>
                    createCategoryCard(
                        category
                    )
            )
            .join("");
}

function createCategoryCard(category) {
    const categoryClass =
        String(
            category.category_name ||
            "Bronze"
        ).toLowerCase();

    const benefits =
        getCategoryBenefits(category);

    return `
        <article class="category-card ${categoryClass}">

            <div class="category-card-header">

                <div class="category-emblem">
                    <i class="${getCategoryIcon(
                        category.category_name
                    )}"></i>
                </div>

                <div class="category-title">

                    <h3>
                        ${escapeHtml(
                            category.category_name
                        )}
                    </h3>

                    <span>
                        From ${formatNumber(
                            category
                                .minimum_lifetime_points
                        )} lifetime points
                    </span>

                </div>

            </div>

            <p class="category-description">
                ${escapeHtml(
                    category.description ||
                    "Customer loyalty membership category."
                )}
            </p>

            <div class="category-metrics">

                <div class="category-metric">
                    <span>
                        Multiplier
                    </span>
                    <strong>
                        ×${formatDecimal(
                            category
                                .points_multiplier
                        )}
                    </strong>
                </div>

                <div class="category-metric">
                    <span>
                        Discount
                    </span>
                    <strong>
                        ${formatDecimal(
                            category
                                .discount_percentage
                        )}%
                    </strong>
                </div>

                <div class="category-metric">
                    <span>
                        Birthday
                    </span>
                    <strong>
                        ${formatNumber(
                            category
                                .birthday_bonus_points
                        )} pts
                    </strong>
                </div>

                <div class="category-metric">
                    <span>
                        Referral
                    </span>
                    <strong>
                        ${formatNumber(
                            category
                                .referral_bonus_points
                        )} pts
                    </strong>
                </div>

            </div>

            <div class="category-benefits">

                ${
                    benefits.length > 0
                        ? benefits
                            .map(
                                (benefit) => `
                                    <span class="benefit-chip enabled">
                                        <i class="${benefit.icon}"></i>
                                        ${escapeHtml(
                                            benefit.label
                                        )}
                                    </span>
                                `
                            )
                            .join("")
                        : `
                            <span class="benefit-chip">
                                Basic Membership
                            </span>
                        `
                }

            </div>

            <div class="category-card-footer">

                <button
                    type="button"
                    class="secondary-btn edit-category-button"
                    data-action="edit-category"
                    data-category-id="${Number(
                        category.id
                    )}"
                >
                    <i class="fa-solid fa-pen"></i>
                    Edit Category
                </button>

            </div>

        </article>
    `;
}

function getCategoryBenefits(category) {
    const benefits = [];

    if (category.event_menu_enabled) {
        benefits.push({
            label: "Event Menu",
            icon:
                "fa-solid fa-calendar-star"
        });
    }

    if (
        category.email_reminders_enabled
    ) {
        benefits.push({
            label: "Email",
            icon:
                "fa-solid fa-envelope"
        });
    }

    if (
        category
            .whatsapp_reminders_enabled
    ) {
        benefits.push({
            label: "WhatsApp",
            icon:
                "fa-brands fa-whatsapp"
        });
    }

    if (
        category.sms_reminders_enabled
    ) {
        benefits.push({
            label: "SMS",
            icon:
                "fa-solid fa-comment-sms"
        });
    }

    if (
        category
            .priority_support_enabled
    ) {
        benefits.push({
            label: "Priority",
            icon:
                "fa-solid fa-headset"
        });
    }

    if (
        category
            .free_delivery_enabled
    ) {
        benefits.push({
            label: "Free Delivery",
            icon:
                "fa-solid fa-truck-fast"
        });
    }

    return benefits;
}

// =========================================
// Load Customers
// =========================================

async function loadCustomers() {
    setCustomerLoading(true);

    try {
        const search =
            $("searchInput")
                ? $("searchInput")
                    .value
                    .trim()
                : "";

        const category =
            $("categoryFilter")
                ? $("categoryFilter")
                    .value
                : "";

        const parameters =
            new URLSearchParams({
                page:
                    String(currentPage),
                limit:
                    String(pageSize)
            });

        if (search) {
            parameters.set(
                "search",
                search
            );
        }

        if (category) {
            parameters.set(
                "category",
                category
            );
        }

        const data =
            await apiRequest(
                `${LOYALTY_API}/customers?${parameters.toString()}`
            );

        loyaltyCustomers =
            Array.isArray(data.customers)
                ? data.customers
                : [];

        const pagination =
            data.pagination || {};

        currentPage =
            Number(
                pagination.page || 1
            );

        totalPages =
            Math.max(
                Number(
                    pagination.totalPages ||
                    1
                ),
                1
            );

        totalCustomers =
            Number(
                pagination.total || 0
            );

        renderCustomers();
        renderPagination();
    } catch (error) {
        loyaltyCustomers = [];
        totalCustomers = 0;
        totalPages = 1;

        renderCustomers();
        renderPagination();

        showToast(
            error.message,
            "error"
        );
    } finally {
        setCustomerLoading(false);
    }
}

// =========================================
// Render Customers
// =========================================

function renderCustomers() {
    const body =
        $("customerTableBody");

    const tableWrap =
        $("customerTableWrap");

    const emptyState =
        $("customerEmpty");

    if (
        !body ||
        !tableWrap ||
        !emptyState
    ) {
        return;
    }

    if (
        loyaltyCustomers.length === 0
    ) {
        body.innerHTML = "";

        tableWrap.classList.add(
            "hidden"
        );

        emptyState.classList.remove(
            "hidden"
        );

        return;
    }

    emptyState.classList.add(
        "hidden"
    );

    tableWrap.classList.remove(
        "hidden"
    );

    body.innerHTML =
        loyaltyCustomers
            .map(
                (customer) =>
                    createCustomerRow(
                        customer
                    )
            )
            .join("");
}

function createCustomerRow(customer) {
    const membership =
        String(
            customer.membership_level ||
            "Bronze"
        );

    const membershipClass =
        membership.toLowerCase();

    const eventEnabled =
        Boolean(
            customer.event_menu_enabled
        );

    const customerContact =
        customer.email ||
        customer.phone ||
        "No contact details";

    return `
        <tr>

            <td>

                <div class="customer-cell">

                    <div class="customer-avatar">
                        ${escapeHtml(
                            getInitials(
                                customer.full_name
                            )
                        )}
                    </div>

                    <div class="customer-details">

                        <strong>
                            ${escapeHtml(
                                customer.full_name ||
                                "Customer"
                            )}
                        </strong>

                        <span title="${escapeHtml(
                            customerContact
                        )}">
                            ${escapeHtml(
                                customerContact
                            )}
                        </span>

                    </div>

                </div>

            </td>

            <td>
                <span class="membership-badge ${membershipClass}">
                    <i class="${getCategoryIcon(
                        membership
                    )}"></i>
                    ${escapeHtml(
                        membership
                    )}
                </span>
            </td>

            <td>
                <span class="points-value">
                    ${formatNumber(
                        customer.reward_points
                    )}
                </span>
            </td>

            <td>
                <strong>
                    ${formatNumber(
                        customer.lifetime_points
                    )}
                </strong>
            </td>

            <td>
                <span class="money-value">
                    ${formatMoney(
                        customer.total_spent
                    )}
                </span>
            </td>

            <td>
                ${formatNumber(
                    customer.total_orders
                )}
            </td>

            <td>
                <span class="access-badge ${
                    eventEnabled
                        ? "enabled"
                        : "locked"
                }">
                    <i class="fa-solid ${
                        eventEnabled
                            ? "fa-unlock"
                            : "fa-lock"
                    }"></i>
                    ${
                        eventEnabled
                            ? "Enabled"
                            : "Locked"
                    }
                </span>
            </td>

            <td>

                <div class="table-actions">

                    <button
                        type="button"
                        class="action-button adjust"
                        data-action="adjust-points"
                        data-customer-id="${Number(
                            customer.id
                        )}"
                        title="Adjust points"
                    >
                        <i class="fa-solid fa-coins"></i>
                    </button>

                    <button
                        type="button"
                        class="action-button"
                        data-action="view-history"
                        data-customer-id="${Number(
                            customer.id
                        )}"
                        title="View points history"
                    >
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>

                </div>

            </td>

        </tr>
    `;
}

// =========================================
// Pagination
// =========================================

function renderPagination() {
    const pagination =
        $("pagination");

    if (!pagination) return;

    if (totalCustomers === 0) {
        pagination.classList.add(
            "hidden"
        );

        return;
    }

    pagination.classList.remove(
        "hidden"
    );

    const firstRecord =
        (currentPage - 1) *
        pageSize +
        1;

    const lastRecord =
        Math.min(
            currentPage * pageSize,
            totalCustomers
        );

    setText(
        "paginationInfo",
        `Showing ${firstRecord} to ${lastRecord} of ${totalCustomers} customers`
    );

    setText(
        "currentPageNumber",
        currentPage
    );

    if ($("previousPageButton")) {
        $("previousPageButton").disabled =
            currentPage <= 1;
    }

    if ($("nextPageButton")) {
        $("nextPageButton").disabled =
            currentPage >= totalPages;
    }
}

// =========================================
// Adjust Points Modal
// =========================================

function openAdjustModal(customerId) {
    const customer =
        loyaltyCustomers.find(
            (item) =>
                Number(item.id) ===
                Number(customerId)
        );

    if (!customer) {
        showToast(
            "Customer record was not found.",
            "error"
        );

        return;
    }

    setValue(
        "adjustCustomerId",
        customer.id
    );

    setText(
        "adjustCustomerName",
        customer.full_name ||
        "Selected customer"
    );

    setText(
        "adjustAvailablePoints",
        formatNumber(
            customer.reward_points
        )
    );

    setText(
        "adjustLifetimePoints",
        formatNumber(
            customer.lifetime_points
        )
    );

    setText(
        "adjustCurrentCategory",
        customer.membership_level ||
        "Bronze"
    );

    setValue(
        "adjustmentPoints",
        ""
    );

    setValue(
        "adjustmentReason",
        ""
    );

    if ($("affectLifetimePoints")) {
        $("affectLifetimePoints").checked =
            true;
    }

    openModal(
        "adjustPointsModal"
    );

    setTimeout(() => {
        $("adjustmentPoints")
            ?.focus();
    }, 50);
}

async function submitPointsAdjustment(
    event
) {
    event.preventDefault();

    const customerId =
        Number(
            $("adjustCustomerId")
                ?.value
        );

    const points =
        Number(
            $("adjustmentPoints")
                ?.value
        );

    const reason =
        $("adjustmentReason")
            ?.value
            .trim() || "";

    const affectLifetimePoints =
        Boolean(
            $("affectLifetimePoints")
                ?.checked
        );

    if (
        !Number.isInteger(points) ||
        points === 0
    ) {
        showToast(
            "Enter a non-zero whole number of points.",
            "error"
        );

        return;
    }

    if (!reason) {
        showToast(
            "Enter a reason for the adjustment.",
            "error"
        );

        return;
    }

    const button =
        $("saveAdjustmentButton");

    setButtonLoading(
        button,
        true,
        "Saving..."
    );

    try {
        const data =
            await apiRequest(
                `${LOYALTY_API}/customers/${customerId}/adjust-points`,
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            points,

                            affect_lifetime_points:
                                affectLifetimePoints,

                            reason
                        })
                }
            );

        closeModal(
            "adjustPointsModal"
        );

        showToast(
            data.message ||
            "Customer points adjusted.",
            "success"
        );

        await Promise.all([
            loadSummary(),
            loadCustomers()
        ]);
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        setButtonLoading(
            button,
            false
        );
    }
}

// =========================================
// Points History Modal
// =========================================

async function openHistoryModal(
    customerId
) {
    openModal("historyModal");

    setHistoryLoading(true);

    $("historySummary").innerHTML = "";
    $("historyTableBody").innerHTML = "";

    try {
        const data =
            await apiRequest(
                `${LOYALTY_API}/customers/${customerId}/history`
            );

        const customer =
            data.customer || {};

        const transactions =
            Array.isArray(
                data.transactions
            )
                ? data.transactions
                : [];

        setText(
            "historyCustomerName",
            customer.full_name ||
            "Customer transaction record"
        );

        renderHistorySummary(
            customer
        );

        renderHistoryTransactions(
            transactions
        );
    } catch (error) {
        $("historyEmpty")
            ?.classList.remove(
                "hidden"
            );

        showToast(
            error.message,
            "error"
        );
    } finally {
        setHistoryLoading(false);
    }
}

function renderHistorySummary(customer) {
    const container =
        $("historySummary");

    if (!container) return;

    container.innerHTML = `
        <div class="history-summary-card">
            <span>Available Points</span>
            <strong>
                ${formatNumber(
                    customer.reward_points
                )}
            </strong>
        </div>

        <div class="history-summary-card">
            <span>Lifetime Points</span>
            <strong>
                ${formatNumber(
                    customer.lifetime_points
                )}
            </strong>
        </div>

        <div class="history-summary-card">
            <span>Membership</span>
            <strong>
                ${escapeHtml(
                    customer.membership_level ||
                    "Bronze"
                )}
            </strong>
        </div>

        <div class="history-summary-card">
            <span>Total Spent</span>
            <strong>
                ${formatMoney(
                    customer.total_spent
                )}
            </strong>
        </div>
    `;
}

function renderHistoryTransactions(
    transactions
) {
    const tableWrap =
        $("historyTableWrap");

    const emptyState =
        $("historyEmpty");

    const body =
        $("historyTableBody");

    if (
        !tableWrap ||
        !emptyState ||
        !body
    ) {
        return;
    }

    if (transactions.length === 0) {
        body.innerHTML = "";

        tableWrap.classList.add(
            "hidden"
        );

        emptyState.classList.remove(
            "hidden"
        );

        return;
    }

    emptyState.classList.add(
        "hidden"
    );

    tableWrap.classList.remove(
        "hidden"
    );

    body.innerHTML =
        transactions
            .map(
                (transaction) => {
                    const points =
                        Number(
                            transaction.points ||
                            0
                        );

                    const direction =
                        points >= 0
                            ? "positive"
                            : "negative";

                    return `
                        <tr>

                            <td>
                                ${formatDateTime(
                                    transaction
                                        .created_at
                                )}
                            </td>

                            <td>
                                <span class="transaction-badge ${direction}">
                                    ${escapeHtml(
                                        transaction
                                            .transaction_type
                                    )}
                                </span>
                            </td>

                            <td>
                                <span class="transaction-points ${direction}">
                                    ${
                                        points > 0
                                            ? "+"
                                            : ""
                                    }${formatNumber(
                                        points
                                    )}
                                </span>
                            </td>

                            <td>
                                ${formatNumber(
                                    transaction
                                        .available_balance_after
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    transaction
                                        .lifetime_points_after
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    transaction
                                        .description ||
                                    "—"
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}

// =========================================
// Category Modal
// =========================================

function openCategoryModal(
    categoryId
) {
    const category =
        loyaltyCategories.find(
            (item) =>
                Number(item.id) ===
                Number(categoryId)
        );

    if (!category) {
        showToast(
            "Loyalty category was not found.",
            "error"
        );

        return;
    }

    selectedCategory = category;

    setValue(
        "categoryId",
        category.id
    );

    setValue(
        "categoryName",
        category.category_name
    );

    setValue(
        "minimumLifetimePoints",
        category
            .minimum_lifetime_points
    );

    setValue(
        "pointsMultiplier",
        category.points_multiplier
    );

    setValue(
        "discountPercentage",
        category
            .discount_percentage
    );

    setValue(
        "birthdayBonusPoints",
        category
            .birthday_bonus_points
    );

    setValue(
        "referralBonusPoints",
        category
            .referral_bonus_points
    );

    setValue(
        "categoryDescription",
        category.description || ""
    );

    setChecked(
        "eventMenuEnabled",
        category.event_menu_enabled
    );

    setChecked(
        "emailRemindersEnabled",
        category
            .email_reminders_enabled
    );

    setChecked(
        "whatsappRemindersEnabled",
        category
            .whatsapp_reminders_enabled
    );

    setChecked(
        "smsRemindersEnabled",
        category
            .sms_reminders_enabled
    );

    setChecked(
        "prioritySupportEnabled",
        category
            .priority_support_enabled
    );

    setChecked(
        "freeDeliveryEnabled",
        category
            .free_delivery_enabled
    );

    setText(
        "categoryModalTitle",
        `Edit ${category.category_name} Category`
    );

    openModal("categoryModal");
}

async function submitCategoryForm(
    event
) {
    event.preventDefault();

    if (!selectedCategory) {
        showToast(
            "No category is selected.",
            "error"
        );

        return;
    }

    const categoryId =
        Number(
            $("categoryId")?.value
        );

    const payload = {
        minimum_lifetime_points:
            Number(
                $("minimumLifetimePoints")
                    ?.value
            ),

        points_multiplier:
            Number(
                $("pointsMultiplier")
                    ?.value
            ),

        discount_percentage:
            Number(
                $("discountPercentage")
                    ?.value
            ),

        birthday_bonus_points:
            Number(
                $("birthdayBonusPoints")
                    ?.value
            ),

        referral_bonus_points:
            Number(
                $("referralBonusPoints")
                    ?.value
            ),

        event_menu_enabled:
            Boolean(
                $("eventMenuEnabled")
                    ?.checked
            ),

        email_reminders_enabled:
            Boolean(
                $("emailRemindersEnabled")
                    ?.checked
            ),

        whatsapp_reminders_enabled:
            Boolean(
                $("whatsappRemindersEnabled")
                    ?.checked
            ),

        sms_reminders_enabled:
            Boolean(
                $("smsRemindersEnabled")
                    ?.checked
            ),

        priority_support_enabled:
            Boolean(
                $("prioritySupportEnabled")
                    ?.checked
            ),

        free_delivery_enabled:
            Boolean(
                $("freeDeliveryEnabled")
                    ?.checked
            ),

        description:
            $("categoryDescription")
                ?.value
                .trim() || "",

        status:
            selectedCategory.status ||
            "Active"
    };

    const button =
        $("saveCategoryButton");

    setButtonLoading(
        button,
        true,
        "Saving..."
    );

    try {
        const data =
            await apiRequest(
                `${LOYALTY_API}/categories/${categoryId}`,
                {
                    method: "PUT",
                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        closeModal(
            "categoryModal"
        );

        selectedCategory = null;

        showToast(
            data.message ||
            "Loyalty category updated.",
            "success"
        );

        await loadPageData();
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        setButtonLoading(
            button,
            false
        );
    }
}

// =========================================
// Run Reminder Cycle
// =========================================

async function runReminderCycle() {
    const button =
        $("runRemindersButton");

    setButtonLoading(
        button,
        true,
        "Running..."
    );

    try {
        const data =
            await apiRequest(
                `${LOYALTY_API}/event-reminders/run`,
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            limit: 100
                        })
                }
            );

        const generated =
            Number(
                data.generation
                    ?.remindersCreated ||
                0
            );

        const sent =
            Number(
                data.delivery?.sent ||
                0
            );

        const failed =
            Number(
                data.delivery?.failed ||
                0
            );

        showToast(
            `Reminder cycle complete: ${generated} created, ${sent} sent, ${failed} failed.`,
            failed > 0
                ? "error"
                : "success"
        );
    } catch (error) {
        showToast(
            error.message,
            "error"
        );
    } finally {
        setButtonLoading(
            button,
            false
        );
    }
}

// =========================================
// Loading States
// =========================================

function setCategoryLoading(show) {
    const loading =
        $("categoryLoading");

    const cards =
        $("categoryCards");

    if (!loading || !cards) return;

    loading.classList.toggle(
        "hidden",
        !show
    );

    cards.classList.toggle(
        "hidden",
        show
    );
}

function setCustomerLoading(show) {
    const loading =
        $("customerLoading");

    if (!loading) return;

    loading.classList.toggle(
        "hidden",
        !show
    );

    if (show) {
        $("customerEmpty")
            ?.classList.add(
                "hidden"
            );

        $("customerTableWrap")
            ?.classList.add(
                "hidden"
            );

        $("pagination")
            ?.classList.add(
                "hidden"
            );
    }
}

function setHistoryLoading(show) {
    $("historyLoading")
        ?.classList.toggle(
            "hidden",
            !show
        );

    if (show) {
        $("historyEmpty")
            ?.classList.add(
                "hidden"
            );

        $("historyTableWrap")
            ?.classList.add(
                "hidden"
            );
    }
}

// =========================================
// Modal Helpers
// =========================================

function openModal(id) {
    const modal = $(id);

    if (!modal) return;

    modal.classList.remove(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}

function closeModal(id) {
    const modal = $(id);

    if (!modal) return;

    modal.classList.add(
        "hidden"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    const anyOpenModal =
        document.querySelector(
            ".loyalty-modal:not(.hidden)"
        );

    if (!anyOpenModal) {
        document.body.classList.remove(
            "modal-open"
        );
    }
}

// =========================================
// Button Loading
// =========================================

function setButtonLoading(
    button,
    loading,
    loadingText = "Please wait..."
) {
    if (!button) return;

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

        if (
            button.dataset.originalHtml
        ) {
            button.innerHTML =
                button.dataset
                    .originalHtml;

            delete button.dataset
                .originalHtml;
        }
    }
}

// =========================================
// Toast
// =========================================

function showToast(
    message,
    type = "success"
) {
    const container =
        $("toastContainer");

    if (!container) return;

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `loyalty-toast ${type}`;

    const icon =
        type === "success"
            ? "fa-circle-check"
            : type === "info"
                ? "fa-circle-info"
                : "fa-circle-exclamation";

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <div>
            ${escapeHtml(message)}
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4500);
}

// =========================================
// Formatting Helpers
// =========================================

function formatNumber(value) {
    return Number(
        value || 0
    ).toLocaleString("en-PK");
}

function formatDecimal(value) {
    return Number(
        value || 0
    ).toLocaleString(
        "en-PK",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    );
}

function formatMoney(value) {
    return `Rs ${Number(
        value || 0
    ).toLocaleString(
        "en-PK",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;
}

function formatDateTime(value) {
    if (!value) return "—";

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleString(
        "en-PK",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}

function getInitials(name) {
    const words =
        String(name || "C")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    return words
        .slice(0, 2)
        .map(
            (word) =>
                word.charAt(0)
                    .toUpperCase()
        )
        .join("") || "C";
}

function getCategoryIcon(category) {
    const icons = {
        Bronze:
            "fa-solid fa-shield",
        Silver:
            "fa-solid fa-award",
        Gold:
            "fa-solid fa-medal",
        Platinum:
            "fa-solid fa-gem"
    };

    return (
        icons[category] ||
        "fa-solid fa-star"
    );
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

function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent =
            String(value ?? "");
    }
}

function setValue(id, value) {
    const element = $(id);

    if (element) {
        element.value =
            value ?? "";
    }
}

function setChecked(id, value) {
    const element = $(id);

    if (element) {
        element.checked =
            Boolean(value);
    }
}

// =========================================
// Event Listeners
// =========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        loadPageData();

        $("refreshButton")
            ?.addEventListener(
                "click",
                loadPageData
            );

        $("runRemindersButton")
            ?.addEventListener(
                "click",
                runReminderCycle
            );

        $("searchInput")
            ?.addEventListener(
                "input",
                () => {
                    clearTimeout(
                        searchTimer
                    );

                    searchTimer =
                        setTimeout(
                            () => {
                                currentPage = 1;
                                loadCustomers();
                            },
                            350
                        );
                }
            );

        $("categoryFilter")
            ?.addEventListener(
                "change",
                () => {
                    currentPage = 1;
                    loadCustomers();
                }
            );

        $("pageSizeSelect")
            ?.addEventListener(
                "change",
                (event) => {
                    pageSize =
                        Number(
                            event.target
                                .value
                        ) || 20;

                    currentPage = 1;

                    loadCustomers();
                }
            );

        $("clearFiltersButton")
            ?.addEventListener(
                "click",
                () => {
                    setValue(
                        "searchInput",
                        ""
                    );

                    setValue(
                        "categoryFilter",
                        ""
                    );

                    currentPage = 1;

                    loadCustomers();
                }
            );

        $("previousPageButton")
            ?.addEventListener(
                "click",
                () => {
                    if (
                        currentPage > 1
                    ) {
                        currentPage -= 1;
                        loadCustomers();
                    }
                }
            );

        $("nextPageButton")
            ?.addEventListener(
                "click",
                () => {
                    if (
                        currentPage <
                        totalPages
                    ) {
                        currentPage += 1;
                        loadCustomers();
                    }
                }
            );

        $("adjustPointsForm")
            ?.addEventListener(
                "submit",
                submitPointsAdjustment
            );

        $("categoryForm")
            ?.addEventListener(
                "submit",
                submitCategoryForm
            );

        document.addEventListener(
            "click",
            (event) => {
                const actionButton =
                    event.target.closest(
                        "[data-action]"
                    );

                if (actionButton) {
                    const action =
                        actionButton.dataset
                            .action;

                    if (
                        action ===
                        "adjust-points"
                    ) {
                        openAdjustModal(
                            actionButton.dataset
                                .customerId
                        );
                    }

                    if (
                        action ===
                        "view-history"
                    ) {
                        openHistoryModal(
                            actionButton.dataset
                                .customerId
                        );
                    }

                    if (
                        action ===
                        "edit-category"
                    ) {
                        openCategoryModal(
                            actionButton.dataset
                                .categoryId
                        );
                    }
                }

                if (
                    event.target.closest(
                        "[data-close-adjust-modal]"
                    ) ||
                    event.target.closest(
                        "#closeAdjustModalButton"
                    )
                ) {
                    closeModal(
                        "adjustPointsModal"
                    );
                }

                if (
                    event.target.closest(
                        "[data-close-history-modal]"
                    ) ||
                    event.target.closest(
                        "#closeHistoryModalButton"
                    )
                ) {
                    closeModal(
                        "historyModal"
                    );
                }

                if (
                    event.target.closest(
                        "[data-close-category-modal]"
                    ) ||
                    event.target.closest(
                        "#closeCategoryModalButton"
                    )
                ) {
                    closeModal(
                        "categoryModal"
                    );
                }
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key !== "Escape"
                ) {
                    return;
                }

                closeModal(
                    "adjustPointsModal"
                );

                closeModal(
                    "historyModal"
                );

                closeModal(
                    "categoryModal"
                );
            }
        );
    }
);