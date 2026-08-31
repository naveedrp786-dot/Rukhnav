"use strict";

const FINANCE_API =
    "/api/admin/finance";

const state = {
    accounts: [],
    categories: [],
    page: 1,
    limit: 20,
    totalPages: 1
};

function token() {
    return (
        localStorage.getItem(
            "adminToken"
        ) ||
        localStorage.getItem(
            "admin_token"
        ) ||
        localStorage.getItem(
            "token"
        ) ||
        sessionStorage.getItem(
            "adminToken"
        ) ||
        ""
    );
}

function money(
    value
) {
    return (
        `PKR ${Number(value || 0)
            .toLocaleString(
                "en-PK",
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }
            )}`
    );
}

function escapeHtml(
    value
) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function api(
    path,
    options = {}
) {
    const headers =
        new Headers(
            options.headers || {}
        );

    if (
        options.body &&
        !(options.body instanceof FormData)
    ) {
        headers.set(
            "Content-Type",
            "application/json"
        );
    }

    const authToken =
        token();

    if (authToken) {
        headers.set(
            "Authorization",
            `Bearer ${authToken}`
        );
    }

    const response =
        await fetch(
            `${FINANCE_API}${path}`,
            {
                ...options,
                headers
            }
        );

    const data =
        await response
            .json()
            .catch(
                () => ({})
            );

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

function message(
    text,
    type = ""
) {
    const element =
        document.getElementById(
            "financeMessage"
        );

    element.textContent =
        text || "";

    element.className =
        `finance-message ${type}`
            .trim();

    if (text) {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
}

function setLoading(
    button,
    loading,
    label = "Saving"
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
            ${escapeHtml(label)}
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

function openModal(
    id
) {
    const modal =
        document.getElementById(id);

    modal?.classList.remove(
        "hidden"
    );

    modal?.setAttribute(
        "aria-hidden",
        "false"
    );
}

function closeModal(
    id
) {
    const modal =
        document.getElementById(id);

    modal?.classList.add(
        "hidden"
    );

    modal?.setAttribute(
        "aria-hidden",
        "true"
    );
}

async function loadSetup() {
    const data =
        await api("/setup");

    state.accounts =
        Array.isArray(data.accounts)
            ? data.accounts
            : [];

    state.categories =
        Array.isArray(data.categories)
            ? data.categories
            : [];

    renderSetupOptions();
}

function renderSetupOptions() {
    const activeAccounts =
        state.accounts.filter(
            account =>
                account.status ===
                "Active"
        );

    const accountOptions =
        activeAccounts.map(
            account => `
                <option value="${escapeHtml(account.id)}">
                    ${escapeHtml(account.account_name)}
                    · ${escapeHtml(account.account_type)}
                </option>
            `
        ).join("");

    document
        .getElementById(
            "financeTransactionAccount"
        )
        .innerHTML =
        accountOptions ||
        `<option value="">No active accounts</option>`;

    document
        .getElementById(
            "financeAccountFilter"
        )
        .innerHTML =
        `<option value="">All accounts</option>` +
        accountOptions;

    document
        .getElementById(
            "financeExpenseCategory"
        )
        .innerHTML =
        state.categories
            .filter(
                category =>
                    category.status ===
                    "Active"
            )
            .map(
                category => `
                    <option value="${escapeHtml(category.id)}">
                        ${escapeHtml(category.category_name)}
                    </option>
                `
            )
            .join("");
}

async function loadDashboard() {
    const data =
        await api("/dashboard");

    const summary =
        data.summary || {};

    const values = {
        currentBalance:
            summary.currentBalance,
        totalIncome:
            summary.totalIncome,
        totalOutflow:
            summary.totalOutflow,
        monthNet:
            summary.monthNet,
        customerCollections:
            summary.customerCollections,
        supplierPayments:
            summary.supplierPayments,
        todayIncome:
            summary.todayIncome,
        todayOutflow:
            summary.todayOutflow
    };

    Object.entries(values)
        .forEach(
            ([id, value]) => {
                const element =
                    document.getElementById(id);

                if (element) {
                    element.textContent =
                        money(value);
                }
            }
        );

    document
        .getElementById(
            "monthBreakdown"
        )
        .textContent =
        `Income ${money(summary.monthIncome)} · Outflow ${money(summary.monthOutflow)}`;

    renderAccounts(
        data.accounts || []
    );
}

function renderAccounts(
    accounts
) {
    const container =
        document.getElementById(
            "financeAccountsGrid"
        );

    if (!accounts.length) {
        container.innerHTML = `
            <div class="finance-empty">
                No finance accounts found.
            </div>
        `;

        return;
    }

    container.innerHTML =
        accounts.map(
            account => `
                <article class="finance-account-card">
                    <div class="finance-account-icon">
                        <i class="fa-solid ${
                            account.account_type === "Bank"
                                ? "fa-building-columns"
                                : account.account_type === "Mobile Wallet"
                                    ? "fa-mobile-screen-button"
                                    : "fa-wallet"
                        }"></i>
                    </div>

                    <div>
                        <span>
                            ${escapeHtml(account.account_type)}
                        </span>

                        <h3>
                            ${escapeHtml(account.account_name)}
                        </h3>

                        <p>
                            ${escapeHtml(
                                account.institution_name ||
                                account.account_number ||
                                "RUKHNAV finance account"
                            )}
                        </p>
                    </div>

                    <strong>
                        ${money(account.current_balance)}
                    </strong>

                    <small class="${
                        account.status === "Active"
                            ? "active"
                            : "inactive"
                    }">
                        ${escapeHtml(account.status)}
                    </small>
                </article>
            `
        ).join("");
}

function transactionQuery() {
    const query =
        new URLSearchParams({
            page:
                String(state.page),
            limit:
                String(state.limit)
        });

    const search =
        document.getElementById(
            "financeSearch"
        ).value.trim();

    const type =
        document.getElementById(
            "financeTypeFilter"
        ).value;

    const accountId =
        document.getElementById(
            "financeAccountFilter"
        ).value;

    if (search) {
        query.set(
            "search",
            search
        );
    }

    if (type) {
        query.set(
            "type",
            type
        );
    }

    if (accountId) {
        query.set(
            "account_id",
            accountId
        );
    }

    return query.toString();
}

async function loadTransactions() {
    const body =
        document.getElementById(
            "financeTransactionsBody"
        );

    body.innerHTML = `
        <tr>
            <td colspan="8">
                Loading finance transactions...
            </td>
        </tr>
    `;

    try {
        const data =
            await api(
                `/transactions?${transactionQuery()}`
            );

        const rows =
            data.transactions || [];

        const pagination =
            data.pagination || {};

        state.totalPages =
            Number(
                pagination.totalPages ||
                1
            );

        document
            .getElementById(
                "financePageNumber"
            )
            .textContent =
            `${state.page} / ${state.totalPages}`;

        document
            .getElementById(
                "financeResultsText"
            )
            .textContent =
            `${Number(pagination.total || 0).toLocaleString()} transaction(s)`;

        document
            .getElementById(
                "financePreviousButton"
            )
            .disabled =
            state.page <= 1;

        document
            .getElementById(
                "financeNextButton"
            )
            .disabled =
            state.page >=
            state.totalPages;

        if (!rows.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="8">
                        No finance transactions found.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML =
            rows.map(
                row => {
                    const outflow =
                        [
                            "Expense",
                            "Transfer Out"
                        ].includes(
                            row.transaction_type
                        );

                    return `
                        <tr>
                            <td>
                                ${escapeHtml(row.transaction_date)}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(row.transaction_number || `#${row.id}`)}
                                </strong>

                                <small>
                                    ${escapeHtml(row.transaction_type)}
                                </small>
                            </td>

                            <td>
                                ${escapeHtml(row.account_name)}
                                <small>
                                    ${escapeHtml(row.account_type)}
                                </small>
                            </td>

                            <td>
                                ${escapeHtml(row.category_name || "—")}
                            </td>

                            <td>
                                ${escapeHtml(row.description)}
                                <small>
                                    ${escapeHtml(row.reference_number || "")}
                                </small>
                            </td>

                            <td class="${
                                outflow
                                    ? "amount-out"
                                    : "amount-in"
                            }">
                                ${outflow ? "−" : "+"}
                                ${money(row.amount)}
                            </td>

                            <td>
                                <span class="finance-status ${
                                    row.status.toLowerCase()
                                }">
                                    ${escapeHtml(row.status)}
                                </span>
                            </td>

                            <td>
                                ${
                                    row.status === "Posted"
                                        ? `
                                            <button
                                                type="button"
                                                class="finance-icon-btn cancel"
                                                data-cancel-transaction="${escapeHtml(row.id)}"
                                                title="Cancel transaction"
                                            >
                                                <i class="fa-solid fa-ban"></i>
                                            </button>
                                        `
                                        : "—"
                                }
                            </td>
                        </tr>
                    `;
                }
            ).join("");
    } catch (error) {
        body.innerHTML = `
            <tr>
                <td colspan="8">
                    ${escapeHtml(error.message)}
                </td>
            </tr>
        `;

        message(
            error.message,
            "error"
        );
    }
}

function toggleExpenseCategory() {
    const expense =
        document.getElementById(
            "financeTransactionType"
        ).value ===
        "Expense";

    const field =
        document.getElementById(
            "financeExpenseCategoryField"
        );

    field.classList.toggle(
        "hidden",
        !expense
    );

    document
        .getElementById(
            "financeExpenseCategory"
        )
        .required =
        expense;
}

async function saveTransaction(
    event
) {
    event.preventDefault();

    const button =
        document.getElementById(
            "saveFinanceTransactionButton"
        );

    setLoading(
        button,
        true,
        "Posting"
    );

    try {
        const data =
            await api(
                "/transactions",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            transaction_type:
                                document.getElementById(
                                    "financeTransactionType"
                                ).value,

                            transaction_date:
                                document.getElementById(
                                    "financeTransactionDate"
                                ).value,

                            account_id:
                                document.getElementById(
                                    "financeTransactionAccount"
                                ).value,

                            category_id:
                                document.getElementById(
                                    "financeExpenseCategory"
                                ).value ||
                                null,

                            amount:
                                document.getElementById(
                                    "financeTransactionAmount"
                                ).value,

                            reference_number:
                                document.getElementById(
                                    "financeTransactionReference"
                                ).value.trim() ||
                                null,

                            description:
                                document.getElementById(
                                    "financeTransactionDescription"
                                ).value.trim()
                        })
                }
            );

        closeModal(
            "financeTransactionModal"
        );

        document
            .getElementById(
                "financeTransactionForm"
            )
            .reset();

        document
            .getElementById(
                "financeTransactionDate"
            ).value =
            new Date()
                .toISOString()
                .slice(0, 10);

        toggleExpenseCategory();

        message(
            data.message,
            "success"
        );

        await Promise.all([
            loadDashboard(),
            loadTransactions()
        ]);
    } catch (error) {
        message(
            error.message,
            "error"
        );
    } finally {
        setLoading(
            button,
            false
        );
    }
}

async function saveAccount(
    event
) {
    event.preventDefault();

    const button =
        document.getElementById(
            "saveFinanceAccountButton"
        );

    setLoading(
        button,
        true,
        "Creating"
    );

    try {
        const data =
            await api(
                "/accounts",
                {
                    method:
                        "POST",

                    body:
                        JSON.stringify({
                            account_name:
                                document.getElementById(
                                    "financeAccountName"
                                ).value.trim(),

                            account_type:
                                document.getElementById(
                                    "financeAccountType"
                                ).value,

                            opening_balance:
                                document.getElementById(
                                    "financeOpeningBalance"
                                ).value,

                            institution_name:
                                document.getElementById(
                                    "financeInstitutionName"
                                ).value.trim() ||
                                null,

                            account_number:
                                document.getElementById(
                                    "financeAccountNumber"
                                ).value.trim() ||
                                null,

                            notes:
                                document.getElementById(
                                    "financeAccountNotes"
                                ).value.trim() ||
                                null
                        })
                }
            );

        closeModal(
            "financeAccountModal"
        );

        document
            .getElementById(
                "financeAccountForm"
            )
            .reset();

        message(
            data.message,
            "success"
        );

        await Promise.all([
            loadSetup(),
            loadDashboard()
        ]);
    } catch (error) {
        message(
            error.message,
            "error"
        );
    } finally {
        setLoading(
            button,
            false
        );
    }
}

async function cancelTransaction(
    id
) {
    const reason =
        prompt(
            "Enter the reason for cancelling this transaction:"
        );

    if (!reason?.trim()) {
        return;
    }

    try {
        const data =
            await api(
                `/transactions/${encodeURIComponent(id)}/cancel`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            reason:
                                reason.trim()
                        })
                }
            );

        message(
            data.message,
            "success"
        );

        await Promise.all([
            loadDashboard(),
            loadTransactions()
        ]);
    } catch (error) {
        message(
            error.message,
            "error"
        );
    }
}

function bind() {
    document
        .getElementById(
            "newTransactionButton"
        )
        .addEventListener(
            "click",
            () => {
                document
                    .getElementById(
                        "financeTransactionDate"
                    ).value =
                    new Date()
                        .toISOString()
                        .slice(0, 10);

                toggleExpenseCategory();

                openModal(
                    "financeTransactionModal"
                );
            }
        );

    document
        .getElementById(
            "newAccountButton"
        )
        .addEventListener(
            "click",
            () =>
                openModal(
                    "financeAccountModal"
                )
        );

    document
        .querySelectorAll(
            "[data-close-finance-modal]"
        )
        .forEach(
            element =>
                element.addEventListener(
                    "click",
                    () =>
                        closeModal(
                            "financeTransactionModal"
                        )
                )
        );

    document
        .querySelectorAll(
            "[data-close-account-modal]"
        )
        .forEach(
            element =>
                element.addEventListener(
                    "click",
                    () =>
                        closeModal(
                            "financeAccountModal"
                        )
                )
        );

    document
        .getElementById(
            "financeTransactionType"
        )
        .addEventListener(
            "change",
            toggleExpenseCategory
        );

    document
        .getElementById(
            "financeTransactionForm"
        )
        .addEventListener(
            "submit",
            saveTransaction
        );

    document
        .getElementById(
            "financeAccountForm"
        )
        .addEventListener(
            "submit",
            saveAccount
        );

    document
        .getElementById(
            "financeFiltersForm"
        )
        .addEventListener(
            "submit",
            event => {
                event.preventDefault();

                state.page = 1;

                loadTransactions();
            }
        );

    document
        .getElementById(
            "refreshFinanceButton"
        )
        .addEventListener(
            "click",
            async () => {
                await Promise.all([
                    loadSetup(),
                    loadDashboard(),
                    loadTransactions()
                ]);
            }
        );

    document
        .getElementById(
            "financePreviousButton"
        )
        .addEventListener(
            "click",
            () => {
                if (state.page > 1) {
                    state.page -= 1;
                    loadTransactions();
                }
            }
        );

    document
        .getElementById(
            "financeNextButton"
        )
        .addEventListener(
            "click",
            () => {
                if (
                    state.page <
                    state.totalPages
                ) {
                    state.page += 1;
                    loadTransactions();
                }
            }
        );

    document
        .getElementById(
            "financeTransactionsBody"
        )
        .addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-cancel-transaction]"
                    );

                if (button) {
                    cancelTransaction(
                        button.dataset
                            .cancelTransaction
                    );
                }
            }
        );
}

async function initialize() {
    bind();

    document
        .getElementById(
            "financeTransactionDate"
        ).value =
        new Date()
            .toISOString()
            .slice(0, 10);

    toggleExpenseCategory();

    try {
        await loadSetup();

        await Promise.all([
            loadDashboard(),
            loadTransactions()
        ]);
    } catch (error) {
        message(
            error.message,
            "error"
        );
    }
}

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initialize,
        {
            once: true
        }
    );
} else {
    initialize();
}
