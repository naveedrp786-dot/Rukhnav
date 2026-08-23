"use strict";

const GuestCheckout = {
    product: null,
    quantity: 1,

    // Multiple products used when checkout starts
    // from the browser guest cart.
    items: [],
    cartMode: false,

    attribution: {},

    async init() {
        this.captureAttribution();
        this.bind();

        const params =
            new URLSearchParams(
                location.search
            );

        /*
         * -------------------------------------------------
         * Guest cart checkout
         * -------------------------------------------------
         * cart.html sends:
         *
         * guest-checkout.html?source=cart
         *
         * The browser cart contains:
         * [
         *   { productId: 6, quantity: 2 },
         *   { productId: 18, quantity: 1 }
         * ]
         */
        if (
            params.get("source") ===
            "cart"
        ) {
            this.cartMode = true;

            try {
                await this.loadCartCheckout();
                this.showCheckout();
            } catch (error) {
                this.showLoadError(
                    error.message ||
                    "Unable to load your guest cart."
                );
            }

            return;
        }

        /*
         * -------------------------------------------------
         * Existing Buy Now checkout
         * -------------------------------------------------
         */
        const productId =
            Number.parseInt(
                params.get("product_id") ||
                params.get("id"),
                10
            );

        const quantity =
            Number.parseInt(
                params.get("quantity") ||
                params.get("qty") ||
                "1",
                10
            );

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            this.showLoadError(
                "A valid product was not selected."
            );
            return;
        }

        this.quantity =
            Number.isInteger(quantity)
                ? Math.min(
                    Math.max(quantity, 1),
                    50
                )
                : 1;

        try {
            const data =
                await API.get(
                    API.product(productId)
                );

            this.product =
                data.product ||
                data.data ||
                data;

            if (
                !this.product ||
                !this.product.id
            ) {
                throw new Error(
                    "Product details were not returned."
                );
            }

            const stock =
                this.productStock(
                    this.product
                );

            if (stock < 1) {
                throw new Error(
                    "This product is currently out of stock."
                );
            }

            this.quantity =
                Math.min(
                    this.quantity,
                    stock
                );

            this.items = [
                {
                    product:
                        this.product,
                    quantity:
                        this.quantity
                }
            ];

            this.render();
            this.showCheckout();

        } catch (error) {
            this.showLoadError(
                error.message ||
                "Unable to load the selected product."
            );
        }
    },

    async loadCartCheckout() {
        /*
         * Store is loaded before guest-checkout.js
         * by the storefront HTML.
         */
        if (
            typeof Store === "undefined" ||
            typeof Store.read !== "function"
        ) {
            throw new Error(
                "The guest cart could not be loaded."
            );
        }

        const guestItems =
            Store.read(
                Store.cartKey
            );

        if (
            !Array.isArray(guestItems) ||
            !guestItems.length
        ) {
            throw new Error(
                "Your guest cart is empty."
            );
        }

        const data =
            await API.get(
                API.products
            );

        const products =
            Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data)
                        ? data
                        : [];

        if (!products.length) {
            throw new Error(
                "Product details could not be loaded."
            );
        }

        const items = [];

        for (const cartItem of guestItems) {
            const productId =
                Number(
                    cartItem.productId
                );

            const requestedQuantity =
                Math.min(
                    Math.max(
                        Number(
                            cartItem.quantity ||
                            1
                        ),
                        1
                    ),
                    50
                );

            const product =
                products.find(
                    row =>
                        Number(row.id) ===
                        productId
                );

            /*
             * Do not silently drop a product from
             * checkout. If a cart item no longer
             * exists, ask the customer to review
             * the cart first.
             */
            if (!product) {
                throw new Error(
                    `A product in your cart is no longer available. Please return to your cart and review it.`
                );
            }

            const stock =
                this.productStock(
                    product
                );

            if (stock < 1) {
                throw new Error(
                    `${product.product_name || "A product"} is currently out of stock.`
                );
            }

            if (
                requestedQuantity >
                stock
            ) {
                throw new Error(
                    `Only ${stock} unit${stock === 1 ? "" : "s"} of ${product.product_name || "this product"} are currently available. Please update your cart quantity.`
                );
            }

            items.push({
                product,
                quantity:
                    requestedQuantity
            });
        }

        if (!items.length) {
            throw new Error(
                "Your guest cart is empty."
            );
        }

        this.items =
            items;

        this.product =
            items[0].product;

        this.quantity =
            items[0].quantity;

        this.render();
    },

    showCheckout() {
        document
            .getElementById(
                "guestCheckoutLoading"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "guestCheckoutError"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "guestCheckoutContent"
            )
            ?.classList.remove(
                "hidden"
            );
    },

    bind() {
        document
            .getElementById(
                "guestCheckoutForm"
            )
            ?.addEventListener(
                "submit",
                event =>
                    this.submit(event)
            );

        document
            .querySelectorAll(
                'input[name="guestPaymentMethod"]'
            )
            .forEach(input => {
                input.addEventListener(
                    "change",
                    () =>
                        this.toggleManualPayment()
                );
            });
    },

    captureAttribution() {
        const params =
            new URLSearchParams(
                location.search
            );

        const stored =
            JSON.parse(
                sessionStorage.getItem(
                    "rukhnav_ad_attribution"
                ) ||
                "{}"
            );

        const read =
            key =>
                params.get(key) ||
                stored[key] ||
                "";

        const utmSource =
            read("utm_source");

        this.attribution = {
            order_source:
                utmSource
                    ? (
                        utmSource
                            .toLowerCase()
                            .includes("facebook")
                            ? "facebook_ads"
                            : utmSource
                    )
                    : (
                        params.get("fbclid")
                            ? "facebook_ads"
                            : "direct"
                    ),

            landing_page:
                location.href,

            referrer_url:
                document.referrer ||
                stored.referrer_url ||
                "",

            utm_source:
                utmSource,

            utm_medium:
                read("utm_medium"),

            utm_campaign:
                read("utm_campaign"),

            utm_content:
                read("utm_content"),

            utm_term:
                read("utm_term"),

            fbclid:
                read("fbclid")
        };

        sessionStorage.setItem(
            "rukhnav_ad_attribution",
            JSON.stringify(
                this.attribution
            )
        );
    },

    productStock(product) {
        return Number(
            product?.stock_quantity ??
            product?.stock ??
            0
        );
    },

    productPrice(product) {
        return Number(
            product?.selling_price ??
            product?.price ??
            0
        );
    },

    productImage(product) {
        const value =
            product?.image ||
            product?.image_url ||
            "";

        if (!value) {
            return "";
        }

        return /^https?:\/\//i.test(value)
            ? value
            : `${API.base}/${String(value).replace(/^\/+/, "")}`;
    },

    // Existing helpers retained for Buy Now
    // compatibility and any future callers.
    stock() {
        return this.productStock(
            this.product
        );
    },

    price() {
        return this.productPrice(
            this.product
        );
    },

    image() {
        return this.productImage(
            this.product
        );
    },

    delivery(subtotal) {
        return subtotal >= 2500
            ? 0
            : 250;
    },

    render() {
        const checkoutItems =
            Array.isArray(this.items) &&
            this.items.length
                ? this.items
                : (
                    this.product
                        ? [
                            {
                                product:
                                    this.product,
                                quantity:
                                    this.quantity
                            }
                        ]
                        : []
                );

        let subtotal = 0;

        const rows =
            checkoutItems.map(item => {
                const product =
                    item.product;

                const quantity =
                    Number(
                        item.quantity ||
                        1
                    );

                const price =
                    this.productPrice(
                        product
                    );

                const lineTotal =
                    price *
                    quantity;

                subtotal +=
                    lineTotal;

                const image =
                    this.productImage(
                        product
                    );

                const stock =
                    this.productStock(
                        product
                    );

                return `
                    <article class="guest-order-item">
                        ${
                            image
                                ? `<img src="${Components.e(image)}" alt="${Components.e(product.product_name || "Product")}">`
                                : `<div class="guest-order-placeholder"><i class="fa-solid fa-spa"></i></div>`
                        }

                        <div>
                            <strong>${Components.e(product.product_name || "Product")}</strong>
                            <span>Quantity: ${quantity}</span>
                            <small>${stock} available</small>
                        </div>

                        <b>${Store.money(lineTotal)}</b>
                    </article>
                `;
            });

        const delivery =
            this.delivery(
                subtotal
            );

        const total =
            subtotal +
            delivery;

        const container =
            document.getElementById(
                "guestOrderItems"
            );

        if (container) {
            container.innerHTML =
                rows.join("");
        }

        this.text(
            "guestSubtotal",
            Store.money(subtotal)
        );

        this.text(
            "guestDelivery",
            delivery
                ? Store.money(delivery)
                : "Free"
        );

        this.text(
            "guestGrandTotal",
            Store.money(total)
        );
    },

    toggleManualPayment() {
        const method =
            document.querySelector(
                'input[name="guestPaymentMethod"]:checked'
            )?.value ||
            "cash_on_delivery";

        const manual =
            method !==
            "cash_on_delivery";

        document
            .getElementById(
                "manualPaymentFields"
            )
            ?.classList.toggle(
                "hidden",
                !manual
            );
    },

    async submit(event) {
        event.preventDefault();

        if (
            !Array.isArray(this.items) ||
            !this.items.length
        ) {
            this.message(
                "There are no products available to order.",
                "error"
            );
            return;
        }

        const fullName =
            this.value(
                "guestFullName"
            );

        const phone =
            this.value(
                "guestPhone"
            );

        const email =
            this.value(
                "guestEmail"
            );

        const address =
            this.value(
                "guestAddress"
            );

        const city =
            this.value(
                "guestCity"
            );


        if (
            !fullName ||
            !phone ||
            !address ||
            !city
        ) {
            this.message(
                "Enter your full name, mobile number, delivery address and city.",
                "error"
            );
            return;
        }


        const method =
            document.querySelector(
                'input[name="guestPaymentMethod"]:checked'
            )?.value ||
            "cash_on_delivery";

        const button =
            document.getElementById(
                "placeGuestOrderButton"
            );

        this.loading(
            button,
            true
        );

        this.message(
            "Placing your order securely...",
            "info"
        );

        try {
            const data =
                await API.post(
                    "/api/orders/guest",
                    {
                        full_name:
                            fullName,

                        phone,

                        email:
                            email ||
                            null,

                        shipping_address:
                            address,

                        city,

                        postal_code:
                            this.value(
                                "guestPostalCode"
                            ) ||
                            null,

                        order_notes:
                            this.value(
                                "guestOrderNotes"
                            ) ||
                            null,

                        payment_method:
                            method,

                        payment_phone:
                            this.value(
                                "guestPaymentPhone"
                            ) ||
                            null,

                        transaction_id:
                            this.value(
                                "guestTransactionId"
                            ) ||
                            null,

                        accept_terms:
                            true,

                        accept_privacy:
                            true,

                        items:
                            this.items.map(
                                item => ({
                                    product_id:
                                        Number(
                                            item.product.id
                                        ),

                                    quantity:
                                        Number(
                                            item.quantity
                                        )
                                })
                            ),

                        attribution:
                            this.attribution
                    }
                );

            const order =
                data.order || {};

            const token =
                data.guestAccessToken;

            if (
                !order.order_number ||
                !token
            ) {
                throw new Error(
                    "Order confirmation details were not returned."
                );
            }

            sessionStorage.setItem(
                `rukhnav_guest_order_${order.order_number}`,
                token
            );

            /*
             * The backend has now confirmed the order.
             * Only now is it safe to clear a cart-based
             * guest checkout.
             */
            if (this.cartMode) {
                localStorage.removeItem(
                    Store.cartKey
                );

                localStorage.setItem(
                    Store.cartSyncKey,
                    String(Date.now())
                );

                try {
                    await Store.refreshCartCount();
                } catch (error) {
                    console.warn(
                        "Cart counter could not be refreshed:",
                        error
                    );
                }
            }

            const successUrl =
                new URL(
                    "guest-order-success.html",
                    location.href
                );

            successUrl.searchParams.set(
                "order",
                order.order_number
            );

            successUrl.searchParams.set(
                "token",
                token
            );

            location.href =
                successUrl.toString();

        } catch (error) {
            this.message(
                error.message ||
                "Unable to place your order.",
                "error"
            );

            this.loading(
                button,
                false
            );
        }
    },

    loading(button, active) {
        if (!button) {
            return;
        }

        if (active) {
            button.dataset.original =
                button.innerHTML;

            button.disabled =
                true;

            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order';

            return;
        }

        button.disabled =
            false;

        if (
            button.dataset.original
        ) {
            button.innerHTML =
                button.dataset.original;

            delete button.dataset.original;
        }
    },

    message(text, type) {
        const element =
            document.getElementById(
                "guestCheckoutMessage"
            );

        if (!element) {
            return;
        }

        element.textContent =
            text;

        element.className =
            `guest-checkout-message show ${type}`;
    },

    showLoadError(message) {
        document
            .getElementById(
                "guestCheckoutLoading"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "guestCheckoutError"
            )
            ?.classList.remove(
                "hidden"
            );

        this.text(
            "guestCheckoutErrorText",
            message
        );
    },

    value(id) {
        return document
            .getElementById(id)
            ?.value
            ?.trim() ||
            "";
    },

    text(id, value) {
        const element =
            document.getElementById(
                id
            );

        if (element) {
            element.textContent =
                value;
        }
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () =>
        GuestCheckout.init()
);
