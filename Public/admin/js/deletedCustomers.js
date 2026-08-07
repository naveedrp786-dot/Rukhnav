"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const CUSTOMER_LIFECYCLE_API =
    RUKHNAV_ORIGIN + "/api/admin/customers";

const adminToken =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("token");

if (!adminToken) {
    window.location.href =
        "/admin/login.html";
}

const lifecycleState = {
    deletedCustomers: [],
    requests: [],
    action: null
};

const $ =
    id =>
        document.getElementById(id);

document.addEventListener(
    "DOMContentLoaded",
    () => {
        bindEvents();
        refreshAll();
    }
);

function authHeaders(
    json = false
) {
    const headers = {
        Authorization:
            `Bearer ${adminToken}`
    };

    if (json) {
        headers["Content-Type"] =
            "application/json";
    }

    return headers;
}

async function apiRequest(
    path,
    options = {}
) {
    const response =
        await fetch(
            `${CUSTOMER_LIFECYCLE_API}${path}`,
            {
                cache:
                    "no-store",
                ...options,
                headers: {
                    ...authHeaders(
                        Boolean(options.body)
                    ),
                    ...(options.headers || {})
                }
            }
        );

    let data = {};

    try {
        data =
            await response.json();
    } catch {}

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        localStorage.removeItem(
            "adminToken"
        );

        window.location.href =
            "/admin/login.html";

        throw new Error(
            "Your admin session has expired."
        );
    }

    if (
        !response.ok ||
        data.success === false
    ) {
        throw new Error(
            data.message ||
            "The requested action failed."
        );
    }

    return data;
}

function bindEvents() {
    $("refreshLifecycleButton")
        ?.addEventListener(
            "click",
            refreshAll
        );

    document
        .querySelectorAll(
            "[data-lifecycle-tab]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () =>
                    activateTab(
                        button.dataset
                            .lifecycleTab
                    )
            );
        });

    $("deletedCustomerSearch")
        ?.addEventListener(
            "input",
            renderDeletedCustomers
        );

    $("requestSearch")
        ?.addEventListener(
            "input",
            renderDeletionRequests
        );

    $("requestStatusFilter")
        ?.addEventListener(
            "change",
            renderDeletionRequests
        );

    $("closeLifecycleModal")
        ?.addEventListener(
            "click",
            closeLifecycleModal
        );

    $("cancelLifecycleAction")
        ?.addEventListener(
            "click",
            closeLifecycleModal
        );

    document
        .querySelector(
            "[data-close-lifecycle-modal]"
        )
        ?.addEventListener(
            "click",
            closeLifecycleModal
        );

    $("confirmLifecycleAction")
        ?.addEventListener(
            "click",
            executeLifecycleAction
        );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key === "Escape") {
                closeLifecycleModal();
            }
        }
    );
}

async function refreshAll() {
    showMessage("");

    try {
        const [
            deletedData,
            requestData
        ] =
            await Promise.all([
                apiRequest(
                    "/deleted"
                ),
                apiRequest(
                    "/deletion-requests"
                )
            ]);

        lifecycleState.deletedCustomers =
            deletedData.customers || [];

        lifecycleState.requests =
            requestData.requests || [];

        updateSummary();
        renderDeletedCustomers();
        renderDeletionRequests();
    } catch (error) {
        showMessage(
            error.message,
            "error"
        );
    }
}

function updateSummary() {
    $("deletedCustomerCount")
        .textContent =
        String(
            lifecycleState
                .deletedCustomers
                .length
        );

    $("pendingRequestCount")
        .textContent =
        String(
            lifecycleState.requests
                .filter(
                    request =>
                        request.status ===
                        "Pending"
                )
                .length
        );

    $("completedRequestCount")
        .textContent =
        String(
            lifecycleState.requests
                .filter(
                    request =>
                        request.status ===
                        "Completed"
                )
                .length
        );

    $("closedRequestCount")
        .textContent =
        String(
            lifecycleState.requests
                .filter(
                    request =>
                        [
                            "Rejected",
                            "Cancelled"
                        ].includes(
                            request.status
                        )
                )
                .length
        );
}

function activateTab(tab) {
    document
        .querySelectorAll(
            "[data-lifecycle-tab]"
        )
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset
                    .lifecycleTab ===
                    tab
            );
        });

    $("deletedCustomersView")
        .classList.toggle(
            "hidden",
            tab !== "deleted"
        );

    $("deletionRequestsView")
        .classList.toggle(
            "hidden",
            tab !== "requests"
        );
}

function renderDeletedCustomers() {
    const search =
        String(
            $("deletedCustomerSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const rows =
        lifecycleState
            .deletedCustomers
            .filter(
                customer =>
                    !search ||
                    [
                        customer.id,
                        customer.full_name,
                        customer.email,
                        customer.phone
                    ]
                        .join(" ")
                        .toLowerCase()
                        .includes(search)
            );

    const body =
        $("deletedCustomersBody");

    if (rows.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="lifecycle-empty">
                    No deleted customers found.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        rows.map(
            customer => `
                <tr>
                    <td>
                        <strong>
                            ${escapeHtml(
                                customer.full_name ||
                                "Customer"
                            )}
                        </strong>
                        <small>
                            Customer #${Number(customer.id)}
                        </small>
                    </td>

                    <td>
                        <span>
                            ${escapeHtml(customer.email || "—")}
                        </span>
                        <small>
                            ${escapeHtml(customer.phone || "—")}
                        </small>
                    </td>

                    <td>
                        <span class="lifecycle-badge neutral">
                            ${escapeHtml(customer.status || "Inactive")}
                        </span>
                    </td>

                    <td>
                        ${escapeHtml(formatDate(customer.created_at))}
                    </td>

                    <td>
                        ${escapeHtml(formatDateTime(customer.deleted_at))}
                    </td>

                    <td>
                        <div class="lifecycle-actions">
                            <button
                                type="button"
                                class="lifecycle-action restore"
                                data-restore-customer="${Number(customer.id)}"
                            >
                                <i class="fa-solid fa-rotate-left"></i>
                                Restore
                            </button>

                            <button
                                type="button"
                                class="lifecycle-action delete"
                                data-delete-customer="${Number(customer.id)}"
                            >
                                <i class="fa-solid fa-trash-can"></i>
                                Delete Permanently
                            </button>
                        </div>
                    </td>
                </tr>
            `
        ).join("");

    body.querySelectorAll(
        "[data-restore-customer]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () =>
                openLifecycleModal({
                    type:
                        "restore",
                    customerId:
                        button.dataset
                            .restoreCustomer
                })
        );
    });

    body.querySelectorAll(
        "[data-delete-customer]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () =>
                openLifecycleModal({
                    type:
                        "permanent-delete",
                    customerId:
                        button.dataset
                            .deleteCustomer
                })
        );
    });
}

function renderDeletionRequests() {
    const search =
        String(
            $("requestSearch")
                ?.value || ""
        )
            .trim()
            .toLowerCase();

    const status =
        $("requestStatusFilter")
            ?.value || "";

    const rows =
        lifecycleState.requests
            .filter(
                request => {
                    const searchMatch =
                        !search ||
                        [
                            request.full_name,
                            request.email,
                            request.phone,
                            request.reason,
                            request.additional_details
                        ]
                            .join(" ")
                            .toLowerCase()
                            .includes(search);

                    const statusMatch =
                        !status ||
                        request.status ===
                        status;

                    return (
                        searchMatch &&
                        statusMatch
                    );
                }
            );

    const body =
        $("deletionRequestsBody");

    if (rows.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="lifecycle-empty">
                    No account-deletion requests found.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML =
        rows.map(
            request => {
                const pending =
                    request.status ===
                    "Pending";

                return `
                    <tr>
                        <td>
                            <strong>
                                ${escapeHtml(
                                    request.full_name ||
                                    "Customer"
                                )}
                            </strong>
                            <small>
                                ${escapeHtml(
                                    request.email ||
                                    request.phone ||
                                    `Customer #${request.customer_id}`
                                )}
                            </small>
                        </td>

                        <td>
                            <strong>
                                ${escapeHtml(request.reason || "Other")}
                            </strong>
                            <small class="request-details">
                                ${escapeHtml(
                                    request.additional_details ||
                                    "No additional details."
                                )}
                            </small>
                        </td>

                        <td>
                            ${escapeHtml(formatDateTime(request.requested_at))}
                        </td>

                        <td>
                            ${escapeHtml(formatDateTime(request.scheduled_for))}
                        </td>

                        <td>
                            <span class="lifecycle-badge ${statusClass(request.status)}">
                                ${escapeHtml(request.status)}
                            </span>
                        </td>

                        <td>
                            ${
                                pending
                                    ? `
                                        <div class="request-actions">
                                            <button
                                                type="button"
                                                class="request-action complete"
                                                data-request-action="Completed"
                                                data-request-id="${Number(request.id)}"
                                            >
                                                Complete
                                            </button>

                                            <button
                                                type="button"
                                                class="request-action reject"
                                                data-request-action="Rejected"
                                                data-request-id="${Number(request.id)}"
                                            >
                                                Reject
                                            </button>

                                            <button
                                                type="button"
                                                class="request-action cancel"
                                                data-request-action="Cancelled"
                                                data-request-id="${Number(request.id)}"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    `
                                    : `
                                        <span class="closed-request">
                                            Closed
                                        </span>
                                    `
                            }
                        </td>
                    </tr>
                `;
            }
        ).join("");

    body.querySelectorAll(
        "[data-request-action]"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () =>
                openLifecycleModal({
                    type:
                        "request-status",
                    requestId:
                        button.dataset
                            .requestId,
                    status:
                        button.dataset
                            .requestAction
                })
        );
    });
}

function openLifecycleModal(action) {
    lifecycleState.action =
        action;

    const confirmationGroup =
        $("permanentDeleteConfirmationGroup");

    confirmationGroup
        .classList.toggle(
            "hidden",
            action.type !==
            "permanent-delete"
        );

    $("permanentDeleteConfirmation")
        .value = "";

    let title =
        "Confirm Action";

    let customer =
        "Customer";

    let warning =
        "Confirm this customer lifecycle action.";

    let buttonText =
        "Confirm";

    let danger = false;

    if (action.type === "restore") {
        const record =
            lifecycleState
                .deletedCustomers
                .find(
                    item =>
                        String(item.id) ===
                        String(action.customerId)
                );

        title =
            "Restore Customer";

        customer =
            record?.full_name ||
            `Customer #${action.customerId}`;

        warning =
            "The customer account will be restored. Verified customers become Active; unverified customers return to Pending Verification.";

        buttonText =
            "Restore Customer";
    }

    if (
        action.type ===
        "permanent-delete"
    ) {
        const record =
            lifecycleState
                .deletedCustomers
                .find(
                    item =>
                        String(item.id) ===
                        String(action.customerId)
                );

        title =
            "Permanently Delete Customer";

        customer =
            record?.full_name ||
            `Customer #${action.customerId}`;

        warning =
            "This permanently removes the customer and directly related records. This action cannot be undone.";

        buttonText =
            "Delete Permanently";

        danger = true;
    }

    if (
        action.type ===
        "request-status"
    ) {
        const request =
            lifecycleState.requests
                .find(
                    item =>
                        String(item.id) ===
                        String(action.requestId)
                );

        title =
            `${action.status} Deletion Request`;

        customer =
            request?.full_name ||
            `Request #${action.requestId}`;

        warning =
            action.status ===
            "Completed"
                ? "Completing the request soft-deletes the customer account."
                : "Closing the request restores the customer's normal account status when the account is not already deleted.";

        buttonText =
            action.status;

        danger =
            action.status ===
            "Completed";
    }

    $("lifecycleModalTitle")
        .textContent =
        title;

    $("lifecycleModalCustomer")
        .textContent =
        customer;

    $("lifecycleModalWarning")
        .textContent =
        warning;

    const confirmButton =
        $("confirmLifecycleAction");

    confirmButton.innerHTML = `
        <i class="fa-solid ${
            danger
                ? "fa-triangle-exclamation"
                : "fa-circle-check"
        }"></i>
        ${escapeHtml(buttonText)}
    `;

    confirmButton.classList.toggle(
        "danger",
        danger
    );

    $("lifecycleConfirmModal")
        .classList.remove("hidden");

    $("lifecycleConfirmModal")
        .setAttribute(
            "aria-hidden",
            "false"
        );
}

function closeLifecycleModal() {
    $("lifecycleConfirmModal")
        .classList.add("hidden");

    $("lifecycleConfirmModal")
        .setAttribute(
            "aria-hidden",
            "true"
        );

    lifecycleState.action = null;
}

async function executeLifecycleAction() {
    const action =
        lifecycleState.action;

    if (!action) {
        return;
    }

    const button =
        $("confirmLifecycleAction");

    const original =
        button.innerHTML;

    button.disabled = true;
    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Processing...
    `;

    try {
        if (action.type === "restore") {
            await apiRequest(
                `/${encodeURIComponent(action.customerId)}/restore`,
                {
                    method:
                        "PATCH"
                }
            );
        }

        if (
            action.type ===
            "permanent-delete"
        ) {
            const confirmation =
                $("permanentDeleteConfirmation")
                    .value
                    .trim();

            if (
                confirmation !==
                "PERMANENTLY DELETE CUSTOMER"
            ) {
                throw new Error(
                    "Type PERMANENTLY DELETE CUSTOMER exactly to continue."
                );
            }

            await apiRequest(
                `/${encodeURIComponent(action.customerId)}/permanent`,
                {
                    method:
                        "DELETE",

                    body:
                        JSON.stringify({
                            confirmation
                        })
                }
            );
        }

        if (
            action.type ===
            "request-status"
        ) {
            await apiRequest(
                `/deletion-requests/${encodeURIComponent(action.requestId)}/status`,
                {
                    method:
                        "PATCH",

                    body:
                        JSON.stringify({
                            status:
                                action.status
                        })
                }
            );
        }

        closeLifecycleModal();

        toast(
            "Customer lifecycle action completed.",
            "success"
        );

        await refreshAll();
    } catch (error) {
        toast(
            error.message,
            "error"
        );
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

function showMessage(
    message,
    type = ""
) {
    const element =
        $("lifecycleMessage");

    element.textContent =
        message || "";

    element.className =
        `lifecycle-message ${type}`
            .trim();
}

function toast(
    message,
    type = "success"
) {
    const item =
        document.createElement("div");

    item.className =
        `lifecycle-toast ${type}`;

    item.textContent =
        message;

    $("lifecycleToastContainer")
        .appendChild(item);

    setTimeout(
        () =>
            item.remove(),
        3500
    );
}

function statusClass(status) {
    return String(status || "")
        .trim()
        .toLowerCase();
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? "—"
        : date.toLocaleDateString(
            "en-GB"
        );
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? "—"
        : date.toLocaleString(
            "en-GB"
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
