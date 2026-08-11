"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

window.API = {
    base:
        window.location.origin ||
        RUKHNAV_ORIGIN,

    settings:
        "/api/website/settings",

    products:
        "/api/products",

    cart:
        "/api/cart",

    product(id) {
        return `/api/products/${encodeURIComponent(id)}`;
    },

    page(key) {
        return `/api/website/pages/${encodeURIComponent(key)}`;
    },

    customer(path = "") {
        return `/api/customers${path}`;
    },

    token() {
        /*
         * Storefront authentication must use customer-specific
         * tokens only. A generic "token" may belong to another
         * part of the ERP/admin application on the same origin.
         */
        return (
            localStorage.getItem("customerToken") ||
            localStorage.getItem("customer_token") ||
            ""
        );
    },

    customerRecord() {
        const candidates = [
            "customer",
            "customerData",
            "customer_data",
            "loggedInCustomer"
        ];

        for (const key of candidates) {
            try {
                const value =
                    JSON.parse(
                        localStorage.getItem(key) ||
                        "null"
                    );

                if (value && typeof value === "object") {
                    return value;
                }
            } catch {
                // Continue to the next compatible key.
            }
        }

        return null;
    },

    isAuthenticated() {
        return Boolean(this.token());
    },

    authHeaders(extra = {}) {
        const headers = {
            Accept: "application/json",
            ...extra
        };

        const token = this.token();

        if (token) {
            headers.Authorization =
                token.startsWith("Bearer ")
                    ? token
                    : `Bearer ${token}`;
        }

        return headers;
    },

    saveCustomerSession(token, customer = null) {
        const cleanToken =
            String(token || "")
                .replace(/^Bearer\s+/i, "")
                .trim();

        if (cleanToken) {
            localStorage.setItem(
                "customerToken",
                cleanToken
            );

            localStorage.setItem(
                "customer_token",
                cleanToken
            );
        }

        if (customer && typeof customer === "object") {
            const payload =
                JSON.stringify(customer);

            localStorage.setItem(
                "customer",
                payload
            );

            localStorage.setItem(
                "customerData",
                payload
            );
        }
    },

    clearCustomerSession() {
        [
            "customerToken",
            "customer_token",
            "token",
            "customer",
            "customerData",
            "customer_data",
            "loggedInCustomer"
        ].forEach(key =>
            localStorage.removeItem(key)
        );
    },

    async request(path, options = {}) {
        const url =
            /^https?:\/\//i.test(path)
                ? path
                : `${this.base}${path}`;

        const headers =
            new Headers(
                options.headers || {}
            );

        if (!headers.has("Accept")) {
            headers.set(
                "Accept",
                "application/json"
            );
        }

        const token =
            this.token();

        if (
            token &&
            !headers.has("Authorization")
        ) {
            headers.set(
                "Authorization",
                token.startsWith("Bearer ")
                    ? token
                    : `Bearer ${token}`
            );
        }

        const body =
            options.body;

        if (
            body !== undefined &&
            body !== null &&
            !(body instanceof FormData) &&
            typeof body !== "string"
        ) {
            headers.set(
                "Content-Type",
                "application/json"
            );
        }

        const response =
            await fetch(url, {
                ...options,
                headers,
                body:
                    body instanceof FormData ||
                    typeof body === "string" ||
                    body == null
                        ? body
                        : JSON.stringify(body)
            });

        let data = {};

        try {
            data =
                await response.json();
        } catch {
            data = {};
        }

        if (
            !response.ok ||
            data.success === false
        ) {
            const error =
                new Error(
                    data.message ||
                    data.error ||
                    `Request failed (${response.status})`
                );

            error.status =
                response.status;

            error.data =
                data;

            throw error;
        }

        return data;
    },

    get(path, options = {}) {
        return this.request(path, {
            ...options,
            method: "GET"
        });
    },

    post(path, body = {}, options = {}) {
        return this.request(path, {
            ...options,
            method: "POST",
            body
        });
    },

    put(path, body = {}, options = {}) {
        return this.request(path, {
            ...options,
            method: "PUT",
            body
        });
    },

    patch(path, body = {}, options = {}) {
        return this.request(path, {
            ...options,
            method: "PATCH",
            body
        });
    },

    delete(path, body = undefined, options = {}) {
        return this.request(path, {
            ...options,
            method: "DELETE",
            body
        });
    },

    upload(path, formData, method = "POST") {
        return this.request(path, {
            method,
            body: formData
        });
    }
};
