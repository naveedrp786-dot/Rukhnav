"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =====================================================
// RUKHNAV ERP — Inventory Dashboard
// =====================================================

const INVENTORY_API_BASE =
    RUKHNAV_ORIGIN + "/api";

function getInventoryToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") ||
        sessionStorage.getItem("adminToken") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

function getInventoryHeaders() {
    const token = getInventoryToken();

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    };
}

async function inventoryRequest(endpoint) {
    const response = await fetch(
        `${INVENTORY_API_BASE}${endpoint}`,
        {
            headers: getInventoryHeaders()
        }
    );

    const data =
        await response.json().catch(
            () => ({})
        );

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Inventory request failed (${response.status}).`
        );
    }

    return data;
}

function formatInventoryNumber(value) {
    return Number(value || 0)
        .toLocaleString("en-PK");
}

function formatInventoryDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-PK", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function escapeInventoryHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setInventoryText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

// =====================================================
// Load Complete Inventory Dashboard
// =====================================================

async function loadInventoryDashboard() {
    try {
        const data =
            await inventoryRequest(
                "/inventory/dashboard"
            );

        const dashboard =
            data.dashboard || {};

        setInventoryText(
            "totalProducts",
            formatInventoryNumber(
                dashboard.totalProducts
            )
        );

        setInventoryText(
            "totalStock",
            formatInventoryNumber(
                dashboard.totalStock
            )
        );

        setInventoryText(
            "lowStock",
            formatInventoryNumber(
                dashboard.lowStockProducts
            )
        );

        setInventoryText(
            "outStock",
            formatInventoryNumber(
                dashboard.outOfStockProducts
            )
        );

        renderRecentTransactions(
            data.recentTransactions || []
        );
    } catch (error) {
        console.error(
            "Inventory dashboard error:",
            error
        );

        renderInventoryError(
            "transactionTable",
            6,
            error.message
        );
    }
}

// =====================================================
// Recent Transactions
// =====================================================

function renderRecentTransactions(transactions) {
    const tbody =
        document.getElementById(
            "transactionTable"
        );

    if (!tbody) {
        return;
    }

    if (!transactions.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    No inventory transactions found.
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML =
        transactions.map((transaction) => `
            <tr>
                <td>
                    ${formatInventoryDate(
                        transaction.created_at
                    )}
                </td>

                <td>
                    <strong>
                        ${escapeInventoryHtml(
                            transaction.product_name ||
                            "-"
                        )}
                    </strong>

                    ${
                        transaction.sku
                            ? `
                                <br>
                                <small>
                                    ${escapeInventoryHtml(
                                        transaction.sku
                                    )}
                                </small>
                            `
                            : ""
                    }
                </td>

                <td>
                    ${escapeInventoryHtml(
                        transaction.transaction_type ||
                        "-"
                    )}
                </td>

                <td>
                    ${formatInventoryNumber(
                        transaction.quantity
                    )}
                </td>

                <td>
                    ${formatInventoryNumber(
                        transaction.previous_stock
                    )}
                </td>

                <td>
                    ${formatInventoryNumber(
                        transaction.new_stock
                    )}
                </td>
            </tr>
        `).join("");
}

// =====================================================
// Low Stock Products
// =====================================================

async function loadLowStockProducts() {
    const tbody =
        document.getElementById(
            "lowStockTable"
        );

    if (!tbody) {
        return;
    }

    try {
        const data =
            await inventoryRequest(
                "/inventory/low-stock"
            );

        const products =
            data.products || [];

        if (!products.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        No low-stock products found.
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML =
            products.map((product) => `
                <tr>
                    <td>
                        <strong>
                            ${escapeInventoryHtml(
                                product.product_name ||
                                "-"
                            )}
                        </strong>

                        ${
                            product.sku
                                ? `
                                    <br>
                                    <small>
                                        ${escapeInventoryHtml(
                                            product.sku
                                        )}
                                    </small>
                                `
                                : ""
                        }
                    </td>

                    <td>
                        ${formatInventoryNumber(
                            product.stock_quantity
                        )}
                    </td>

                    <td>
                        ${formatInventoryNumber(
                            product.low_stock_level
                        )}
                    </td>

                    <td>
                        <span class="status-low">
                            ${escapeInventoryHtml(
                                product.stock_status ||
                                "Low Stock"
                            )}
                        </span>
                    </td>
                </tr>
            `).join("");
    } catch (error) {
        console.error(
            "Low-stock loading error:",
            error
        );

        renderInventoryError(
            "lowStockTable",
            4,
            error.message
        );
    }
}

// =====================================================
// Error Row
// =====================================================

function renderInventoryError(
    tableBodyId,
    columns,
    message
) {
    const tbody =
        document.getElementById(
            tableBodyId
        );

    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="${columns}">
                <span class="status-out">
                    ${escapeInventoryHtml(
                        message ||
                        "Unable to load inventory data."
                    )}
                </span>
            </td>
        </tr>
    `;
}

// =====================================================
// Initialize
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        if (!getInventoryToken()) {
            window.location.href =
                "/admin/login.html";

            return;
        }

        await Promise.all([
            loadInventoryDashboard(),
            loadLowStockProducts()
        ]);
    }
);