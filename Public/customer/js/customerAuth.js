"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

// =========================================
// RUKHNAV Customer Authentication
// =========================================

const CUSTOMER_AUTH_API =
    RUKHNAV_ORIGIN + "/api/customers";

const $ = (id) =>
    document.getElementById(id);

// =========================================
// Existing Customer Session
// =========================================

function getCustomerToken() {
    return (
        localStorage.getItem(
            "customerToken"
        ) ||
        sessionStorage.getItem(
            "customerToken"
        ) ||
        ""
    );
}

function isTokenUsable(token) {
    if (!token) return false;

    try {
        const parts =
            token.split(".");

        if (parts.length !== 3) {
            return false;
        }

        const payload =
            JSON.parse(
                atob(
                    parts[1]
                        .replace(/-/g, "+")
                        .replace(/_/g, "/")
                )
            );

        if (!payload.exp) {
            return true;
        }

        return (
            payload.exp * 1000 >
            Date.now()
        );
    } catch (error) {
        return false;
    }
}

const existingToken =
    getCustomerToken();

if (
    isTokenUsable(existingToken)
) {
    window.location.replace(
        getSafeRedirect()
    );
} else if (existingToken) {
    clearCustomerSession();
}

// =========================================
// Login Form
// =========================================

async function submitCustomerLogin(
    event
) {
    event.preventDefault();

    clearFormErrors();
    hideAlert();

    const identifier =
        $("loginIdentifier")
            ?.value
            .trim() || "";

    const password =
        $("loginPassword")
            ?.value || "";

    const rememberCustomer =
        Boolean(
            $("rememberCustomer")
                ?.checked
        );

    let valid = true;

    if (!identifier) {
        showFieldError(
            "loginIdentifier",
            "identifierError",
            "Enter your email address or mobile number."
        );

        valid = false;
    }

    if (!password) {
        showFieldError(
            "loginPassword",
            "passwordError",
            "Enter your password."
        );

        valid = false;
    } else if (password.length < 8) {
        showFieldError(
            "loginPassword",
            "passwordError",
            "Password must contain at least 8 characters."
        );

        valid = false;
    }

    if (!valid) return;

    const loginButton =
        $("loginButton");

    setButtonLoading(
        loginButton,
        true
    );

    try {
        const response =
            await fetch(
                `${CUSTOMER_AUTH_API}/login`,
                {
                    method: "POST",

                    headers: {
                        Accept:
                            "application/json",

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            identifier,
                            password
                        })
                }
            );

        let data = {};

        try {
            data =
                await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to sign in. Please check your details."
            );
        }

        const token =
            data.token ||
            data.accessToken ||
            data.access_token ||
            "";

        if (!token) {
            throw new Error(
                "Login succeeded but no customer token was returned."
            );
        }

        saveCustomerSession(
            token,
            data.customer || null,
            rememberCustomer
        );

        showAlert(
            data.message ||
            "Login successful. Redirecting...",
            "success"
        );

        showToast(
            "Welcome back to RUKHNAV.",
            "success"
        );

        setTimeout(() => {
            window.location.replace(
                getSafeRedirect()
            );
        }, 700);
    } catch (error) {
        showAlert(
            error.message,
            "error"
        );

        showToast(
            error.message,
            "error"
        );
    } finally {
        setButtonLoading(
            loginButton,
            false
        );
    }
}

// =========================================
// Save and Clear Session
// =========================================

function saveCustomerSession(
    token,
    customer,
    remember
) {
    clearCustomerSession();

    const storage =
        remember
            ? localStorage
            : sessionStorage;

    storage.setItem(
        "customerToken",
        token
    );

    if (customer) {
        storage.setItem(
            "customerAccount",
            JSON.stringify(customer)
        );
    }
}

function clearCustomerSession() {
    localStorage.removeItem(
        "customerToken"
    );

    localStorage.removeItem(
        "customerAccount"
    );

    sessionStorage.removeItem(
        "customerToken"
    );

    sessionStorage.removeItem(
        "customerAccount"
    );
}

// =========================================
// Password Visibility
// =========================================

function togglePasswordVisibility() {
    const passwordInput =
        $("loginPassword");

    const button =
        $("togglePasswordButton");

    if (
        !passwordInput ||
        !button
    ) {
        return;
    }

    const showing =
        passwordInput.type ===
        "text";

    passwordInput.type =
        showing
            ? "password"
            : "text";

    button.innerHTML = `
        <i class="fa-solid ${
            showing
                ? "fa-eye"
                : "fa-eye-slash"
        }"></i>
    `;

    button.setAttribute(
        "aria-label",
        showing
            ? "Show password"
            : "Hide password"
    );
}

// =========================================
// Validation Helpers
// =========================================

function showFieldError(
    inputId,
    errorId,
    message
) {
    $(inputId)
        ?.classList.add(
            "invalid"
        );

    const error =
        $(errorId);

    if (error) {
        error.textContent =
            message;
    }
}

function clearFormErrors() {
    document
        .querySelectorAll(
            ".customer-input-wrap input"
        )
        .forEach(
            (input) =>
                input.classList.remove(
                    "invalid"
                )
        );

    document
        .querySelectorAll(
            ".field-error"
        )
        .forEach(
            (error) =>
                error.textContent = ""
        );
}

// =========================================
// Alert
// =========================================

function showAlert(
    message,
    type = "error"
) {
    const alert =
        $("authAlert");

    if (!alert) return;

    alert.className =
        `auth-alert ${type}`;

    alert.textContent =
        message;

    alert.classList.remove(
        "hidden"
    );
}

function hideAlert() {
    const alert =
        $("authAlert");

    if (!alert) return;

    alert.classList.add(
        "hidden"
    );

    alert.textContent = "";
}

// =========================================
// Button Loading
// =========================================

function setButtonLoading(
    button,
    loading
) {
    if (!button) return;

    if (loading) {
        button.dataset.originalHtml =
            button.innerHTML;

        button.disabled = true;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Signing In...</span>
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
        $("customerToastContainer");

    if (!container) return;

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `customer-toast ${type}`;

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
// Safe Redirect
// =========================================

function getSafeRedirect() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const requestedPage =
        parameters.get("redirect") ||
        "dashboard.html";

    const safePagePattern =
        /^[a-zA-Z0-9_-]+\.html$/;

    return safePagePattern.test(
        requestedPage
    )
        ? requestedPage
        : "dashboard.html";
}

// =========================================
// Security Helper
// =========================================

function escapeHtml(value) {
    const element =
        document.createElement(
            "div"
        );

    element.textContent =
        String(value ?? "");

    return element.innerHTML;
}

// =========================================
// Events
// =========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        $("customerLoginForm")
            ?.addEventListener(
                "submit",
                submitCustomerLogin
            );

        $("togglePasswordButton")
            ?.addEventListener(
                "click",
                togglePasswordVisibility
            );

        $("loginIdentifier")
            ?.addEventListener(
                "input",
                () => {
                    $("loginIdentifier")
                        ?.classList.remove(
                            "invalid"
                        );

                    if (
                        $("identifierError")
                    ) {
                        $("identifierError")
                            .textContent = "";
                    }
                }
            );

        $("loginPassword")
            ?.addEventListener(
                "input",
                () => {
                    $("loginPassword")
                        ?.classList.remove(
                            "invalid"
                        );

                    if (
                        $("passwordError")
                    ) {
                        $("passwordError")
                            .textContent = "";
                    }
                }
            );
    }
);