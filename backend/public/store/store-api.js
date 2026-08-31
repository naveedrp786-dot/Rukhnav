"use strict";

const RukhnavAPI = (() => {
    const API_BASE = "/api";

    const TOKEN_KEY =
        "rukhnav_customer_token";

    const CUSTOMER_KEY =
        "rukhnav_customer";

    // ======================================
    // Customer Session
    // ======================================
    function getToken() {
        return localStorage.getItem(
            TOKEN_KEY
        );
    }

    function getCustomer() {
        try {
            const customer =
                localStorage.getItem(
                    CUSTOMER_KEY
                );

            return customer
                ? JSON.parse(customer)
                : null;
        } catch (error) {
            return null;
        }
    }

    function saveSession(
        token,
        customer
    ) {
        if (token) {
            localStorage.setItem(
                TOKEN_KEY,
                token
            );
        }

        if (customer) {
            localStorage.setItem(
                CUSTOMER_KEY,
                JSON.stringify(customer)
            );
        }
    }

    function clearSession() {
        localStorage.removeItem(
            TOKEN_KEY
        );

        localStorage.removeItem(
            CUSTOMER_KEY
        );
    }

    function isLoggedIn() {
        return Boolean(getToken());
    }

    // ======================================
    // General API Request
    // ======================================
    async function request(
        endpoint,
        options = {}
    ) {
        const headers = {
            Accept: "application/json",
            ...(options.headers || {})
        };

        const token = getToken();

        if (token) {
            headers.Authorization =
                `Bearer ${token}`;
        }

        if (
            options.body &&
            !(options.body instanceof FormData)
        ) {
            headers["Content-Type"] =
                "application/json";
        }

        let response;

        try {
            response = await fetch(
                `${API_BASE}${endpoint}`,
                {
                    ...options,
                    headers
                }
            );
        } catch (error) {
            throw new Error(
                "Unable to connect to the ERP server."
            );
        }

        let data;

        try {
            data = await response.json();
        } catch (error) {
            data = {
                success: false,
                message:
                    "The server returned an invalid response."
            };
        }

        if (response.status === 401) {
            clearSession();

            throw new Error(
                data.message ||
                "Your session has expired. Please log in again."
            );
        }

        if (!response.ok) {
    const requestError =
        new Error(
            data.message ||
            data.error ||
            "Request failed."
        );

    requestError.status =
        response.status;

    requestError.data =
        data;

    throw requestError;
}

        return data;
    }

    // ======================================
    // Helpers
    // ======================================
    function formatMoney(value) {
        return new Intl.NumberFormat(
            "en-PK",
            {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        ).format(Number(value || 0));
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getImageUrl(image) {
        if (!image) {
            return "product-1.jpg";
        }

        const value =
            String(image).trim();

        if (
            value.startsWith("http://") ||
            value.startsWith("https://") ||
            value.startsWith("data:")
        ) {
            return value;
        }

        if (value.startsWith("/uploads/")) {
            return value;
        }

        if (value.startsWith("uploads/")) {
            return `/${value}`;
        }

        if (value.includes("/")) {
            return `/uploads/${value}`;
        }

        // Product images are normally saved here
        return `/uploads/products/${value}`;
    }

    function getFallbackImageUrl(image) {
        if (!image) {
            return "product-1.jpg";
        }

        const filename =
            String(image)
                .split("/")
                .pop();

        return `/uploads/${filename}`;
    }

    function normalizeProduct(product) {
        return {
            ...product,

            id: Number(product.id),

            name:
                product.product_name ||
                product.name ||
                "Unnamed Product",

            price:
                Number(
                    product.discount_price ||
                    product.selling_price ||
                    product.price ||
                    0
                ),

            regularPrice:
                Number(
                    product.selling_price ||
                    product.price ||
                    0
                ),

            stock:
                Number(
                    product.stock_quantity ??
                    product.stock ??
                    0
                ),

            rating:
                Number(
                    product.averageRating ||
                    product.average_rating ||
                    product.rating ||
                    0
                ),

            totalReviews:
                Number(
                    product.totalReviews ||
                    product.total_reviews ||
                    0
                ),

            imageUrl:
                getImageUrl(
                    product.image
                )
        };
    }

    // ======================================
    // Products and Categories
    // ======================================
    async function getProducts(
        filters = {}
    ) {
        const parameters =
            new URLSearchParams();

        Object.entries(filters)
            .forEach(([key, value]) => {
                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {
                    parameters.set(
                        key,
                        value
                    );
                }
            });

        const query =
            parameters.toString();

        const data = await request(
            `/products${query ? `?${query}` : ""}`
        );

        return {
            ...data,
            products:
                Array.isArray(data.products)
                    ? data.products.map(
                        normalizeProduct
                    )
                    : []
        };
    }

    async function getProduct(id) {
        const data = await request(
            `/products/${id}`
        );

        return {
            ...data,
            product:
                data.product
                    ? normalizeProduct(
                        data.product
                    )
                    : null
        };
    }

    async function getCategories() {
        return request("/categories");
    }

    async function getFeaturedProducts() {
        const data = await request(
            "/products/featured"
        );

        return {
            ...data,
            products:
                Array.isArray(data.products)
                    ? data.products.map(
                        normalizeProduct
                    )
                    : []
        };
    }

    async function getLatestProducts() {
        const data = await request(
            "/products/latest"
        );

        return {
            ...data,
            products:
                Array.isArray(data.products)
                    ? data.products.map(
                        normalizeProduct
                    )
                    : []
        };
    }

    // ======================================
    // Customer Authentication
    // ======================================
    async function login(payload) {
        return request(
            "/customers/login",
            {
                method: "POST",
                body:
                    JSON.stringify(payload)
            }
        );
    }

    async function register(payload) {
        return request(
            "/customers/register",
            {
                method: "POST",
                body:
                    JSON.stringify(payload)
            }
        );
    }

    async function requestVerification(
    identifier
) {
    return request(
        "/customers/verification/request",
        {
            method: "POST",
            body: JSON.stringify({
                identifier
            })
        }
    );
}

async function confirmVerification(
    identifier,
    code
) {
    return request(
        "/customers/verification/confirm",
        {
            method: "POST",
            body: JSON.stringify({
                identifier,
                code
            })
        }
    );
}

async function requestPasswordReset(
    identifier
) {
    return request(
        "/customers/password/forgot",
        {
            method: "POST",
            body: JSON.stringify({
                identifier
            })
        }
    );
}

async function resetPassword(
    identifier,
    code,
    newPassword
) {
    return request(
        "/customers/password/reset",
        {
            method: "POST",
            body: JSON.stringify({
                identifier,
                code,
                new_password:
                    newPassword
            })
        }
    );
}

    async function getProfile() {
        return request(
            "/customers/profile"
        );
    }

    // ======================================
    // Customer Cart
    // ======================================
    async function getCart() {
        return request("/cart");
    }

    async function addToCart(
        productId,
        quantity = 1
    ) {
        return request(
            "/cart",
            {
                method: "POST",
                body: JSON.stringify({
                    product_id:
                        Number(productId),
                    quantity:
                        Number(quantity)
                })
            }
        );
    }

    async function updateCart(
        cartItemId,
        quantity
    ) {
        return request(
            `/cart/${cartItemId}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    quantity:
                        Number(quantity)
                })
            }
        );
    }

    async function removeFromCart(
        cartItemId
    ) {
        return request(
            `/cart/${cartItemId}`,
            {
                method: "DELETE"
            }
        );
    }

    // ======================================
    // Customer Orders
    // ======================================
    async function placeOrder(payload) {
        return request(
            "/orders",
            {
                method: "POST",
                body:
                    JSON.stringify(payload)
            }
        );
    }

    async function getOrders() {
        return request("/orders");
    }

    async function getOrder(id) {
        return request(
            `/orders/${id}`
        );
    }

    async function cancelOrder(id) {
        return request(
            `/orders/${id}/cancel`,
            {
                method: "PUT"
            }
        );
    }

    return {
        getToken,
        getCustomer,
        saveSession,
        clearSession,
        isLoggedIn,

        request,
        formatMoney,
        escapeHTML,
        getImageUrl,
        getFallbackImageUrl,
        normalizeProduct,

        getProducts,
        getProduct,
        getCategories,
        getFeaturedProducts,
        getLatestProducts,

        login,
        register,
        getProfile,

        getCart,
        addToCart,
        updateCart,
        removeFromCart,

        placeOrder,
        getOrders,
        getOrder,
        cancelOrder
    };
})();