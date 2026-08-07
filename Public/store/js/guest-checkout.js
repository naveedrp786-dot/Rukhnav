"use strict";

const GuestCheckout = {
    product: null,
    quantity: 1,
    attribution: {},

    async init() {
        this.captureAttribution();
        this.bind();

        const params =
            new URLSearchParams(
                location.search
            );

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
                this.stock();

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

            this.render();

            document
                .getElementById(
                    "guestCheckoutLoading"
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

        } catch (error) {
            this.showLoadError(
                error.message ||
                "Unable to load the selected product."
            );
        }
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

    stock() {
        return Number(
            this.product?.stock_quantity ??
            this.product?.stock ??
            0
        );
    },

    price() {
        return Number(
            this.product?.selling_price ??
            this.product?.price ??
            0
        );
    },

    image() {
        const value =
            this.product?.image ||
            this.product?.image_url ||
            "";

        if (!value) {
            return "";
        }

        return /^https?:\/\//i.test(value)
            ? value
            : `${API.base}/${String(value).replace(/^\/+/, "")}`;
    },

    delivery(subtotal) {
        return subtotal >= 2500
            ? 0
            : 250;
    },

    render() {
        const subtotal =
            this.price() *
            this.quantity;

        const delivery =
            this.delivery(
                subtotal
            );

        const total =
            subtotal +
            delivery;

        const image =
            this.image();

        const container =
            document.getElementById(
                "guestOrderItems"
            );

        if (container) {
            container.innerHTML = `
                <article class="guest-order-item">
                    ${
                        image
                            ? `<img src="${Components.e(image)}" alt="${Components.e(this.product.product_name || "Product")}">`
                            : `<div class="guest-order-placeholder"><i class="fa-solid fa-spa"></i></div>`
                    }

                    <div>
                        <strong>${Components.e(this.product.product_name || "Product")}</strong>
                        <span>Quantity: ${this.quantity}</span>
                        <small>${this.stock()} available</small>
                    </div>

                    <b>${Store.money(subtotal)}</b>
                </article>
            `;
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

        if (!this.product) {
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

        const acceptTerms =
            document.getElementById(
                "guestAcceptTerms"
            )?.checked;

        const acceptPrivacy =
            document.getElementById(
                "guestAcceptPrivacy"
            )?.checked;

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

        if (
            !acceptTerms ||
            !acceptPrivacy
        ) {
            this.message(
                "Accept the Terms & Conditions and Privacy Policy before placing your order.",
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

                        items: [
                            {
                                product_id:
                                    this.product.id,

                                quantity:
                                    this.quantity
                            }
                        ],

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
