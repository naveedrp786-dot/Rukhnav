"use strict";

const GuestCheckout = {
    paymentReceiptFile: null,
    paymentReceiptPreviewUrl: "",
    websiteSettings: {},
    paymentSettings: {},
    orderCreated: false,
    paymentProofRetryOrderNumber: "",
    paymentProofRetryToken: "",
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

        await this.loadPaymentSettings();

        this.restorePaymentProofRetry();

        this.toggleManualPayment();

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

    async loadPaymentSettings() {
        try {
            const response =
                await fetch(
                    "/api/website/settings",
                    {
                        headers: {
                            Accept: "application/json"
                        }
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Website payment settings could not be loaded."
                );
            }

            const data =
                await response.json();

            this.websiteSettings =
                data?.settings ||
                data?.data ||
                data ||
                {};

            this.paymentSettings =
                this.websiteSettings.payments ||
                {};

            this.applyPaymentSettings();

        } catch (error) {
            console.error(
                "Guest payment settings:",
                error
            );

            this.websiteSettings = {};
            this.paymentSettings = {};
        }
    },

    applyPaymentSettings() {
        const settings =
            this.paymentSettings || {};

        const availability = {
            cash_on_delivery:
                settings.cash_on_delivery_enabled !== false,

            bank_transfer:
                settings.bank_transfer_enabled !== false,

            easypaisa:
                settings.easypaisa_enabled !== false,

            jazzcash:
                settings.jazzcash_enabled !== false
        };

        Object.entries(availability)
            .forEach(([method, enabled]) => {
                const input =
                    document.querySelector(
                        `input[name="guestPaymentMethod"][value="${method}"]`
                    );

                if (!input) return;

                input.disabled =
                    !enabled;

                const label =
                    input.closest("label");

                if (label) {
                    label.hidden =
                        !enabled;

                    label.classList.toggle(
                        "payment-disabled",
                        !enabled
                    );
                }
            });

        const selected =
            document.querySelector(
                'input[name="guestPaymentMethod"]:checked'
            );

        if (
            selected &&
            !selected.disabled
        ) {
            return;
        }

        const firstAvailable =
            document.querySelector(
                'input[name="guestPaymentMethod"]:not(:disabled)'
            );

        if (firstAvailable) {
            firstAvailable.checked = true;
        }
    },

    paymentAccountDetails(method) {
        const settings =
            this.paymentSettings || {};

        if (method === "jazzcash") {
            return {
                title:
                    settings.jazzcash_account_title || "",
                number:
                    settings.jazzcash_account_number || "",
                qr:
                    settings.jazzcash_qr_url || "",
                instructions:
                    settings.jazzcash_instructions ||
                    "Pay using JazzCash, then enter your transaction reference."
            };
        }

        if (method === "easypaisa") {
            return {
                title:
                    settings.easypaisa_account_title || "",
                number:
                    settings.easypaisa_account_number || "",
                qr:
                    settings.easypaisa_qr_url || "",
                instructions:
                    settings.easypaisa_instructions ||
                    "Pay using Easypaisa, then enter your transaction reference."
            };
        }

        return {
            title: "",
            number: "",
            qr: "",
            instructions: ""
        };
    },

    async copyPaymentNumber(number, button) {
        if (!number) return;

        try {
            await navigator.clipboard.writeText(
                number
            );

            const original =
                button?.innerHTML || "";

            if (button) {
                button.innerHTML =
                    '<i class="fa-solid fa-check"></i> Copied';

                setTimeout(() => {
                    button.innerHTML =
                        original;
                }, 1500);
            }

        } catch (_) {
            window.prompt(
                "Copy payment number:",
                number
            );
        }
    },

    renderPaymentAccountDetails(method) {
        let box =
            document.getElementById(
                "guestPaymentInstructions"
            );

        if (!box) {
            const manualFields =
                document.getElementById(
                    "manualPaymentFields"
                );

            if (!manualFields) return;

            box =
                document.createElement(
                    "div"
                );

            box.id =
                "guestPaymentInstructions";

            box.className =
                "guest-wallet-details";

            manualFields.parentNode.insertBefore(
                box,
                manualFields
            );
        }

        if (method === "cash_on_delivery") {
            box.innerHTML = `
                <div class="guest-wallet-simple">
                    <i class="fa-solid fa-circle-info"></i>

                    <div>
                        <strong>
                            Cash on Delivery selected
                        </strong>

                        <p>
                            Pay the final order amount when
                            your parcel is delivered.
                        </p>
                    </div>
                </div>
            `;

            return;
        }

        if (
            method === "jazzcash" ||
            method === "easypaisa"
        ) {
            const details =
                this.paymentAccountDetails(
                    method
                );

            const brand =
                method === "jazzcash"
                    ? "JazzCash"
                    : "Easypaisa";

            const displayedTotal =
                document.getElementById(
                    "guestGrandTotal"
                )?.textContent?.trim() ||
                "Rs. 0.00";

            const accountTitle =
                details.title
                    ? `
                        <div class="guest-wallet-row">
                            <span>Account title</span>

                            <strong>
                                ${Components.e(details.title)}
                            </strong>
                        </div>
                    `
                    : "";

            const accountNumber =
                details.number
                    ? `
                        <div class="guest-wallet-row">
                            <span>Account number</span>

                            <div class="guest-wallet-copy">
                                <strong>
                                    ${Components.e(details.number)}
                                </strong>

                                <button
                                    type="button"
                                    data-guest-payment-copy="${Components.e(details.number)}"
                                >
                                    <i class="fa-regular fa-copy"></i>
                                    Copy
                                </button>
                            </div>
                        </div>
                    `
                    : `
                        <div class="guest-wallet-warning">
                            Payment account number has not
                            been published yet.
                        </div>
                    `;

            const qr =
                details.qr
                    ? `
                        <div class="guest-wallet-qr">
                            <img
                                src="${Components.e(details.qr)}"
                                alt="${Components.e(brand)} payment QR code"
                            >

                            <small>
                                Scan to pay with ${Components.e(brand)}
                            </small>
                        </div>
                    `
                    : "";

            box.innerHTML = `
                <div class="guest-wallet-panel">

                    <div class="guest-wallet-heading">
                        <i class="fa-solid fa-shield-halved"></i>

                        <div>
                            <strong>
                                Pay with ${Components.e(brand)}
                            </strong>

                            <p>
                                Complete the transfer before
                                placing your order.
                            </p>
                        </div>
                    </div>

                    ${qr}

                    <div class="guest-wallet-account">
                        ${accountTitle}
                        ${accountNumber}

                        <div class="guest-wallet-row">
                            <span>Amount to pay</span>

                            <strong>
                                ${Components.e(displayedTotal)}
                            </strong>
                        </div>
                    </div>

                    <p class="guest-wallet-note">
                        ${Components.e(details.instructions)}
                    </p>

                    <p class="guest-wallet-pending">
                        <i class="fa-solid fa-clock"></i>

                        Your order will remain payment pending
                        until RUKHNAV verifies the transaction.
                    </p>

                </div>
            `;

            box
                .querySelectorAll(
                    "[data-guest-payment-copy]"
                )
                .forEach(button => {
                    button.addEventListener(
                        "click",
                        () =>
                            this.copyPaymentNumber(
                                button.dataset.guestPaymentCopy,
                                button
                            )
                    );
                });

            return;
        }

        if (method === "bank_transfer") {
            box.innerHTML = `
                <div class="guest-wallet-simple">
                    <i class="fa-solid fa-building-columns"></i>

                    <div>
                        <strong>
                            Bank Transfer selected
                        </strong>

                        <p>
                            Transfer the order amount using the
                            RUKHNAV bank details, then enter your
                            transaction reference.
                        </p>
                    </div>
                </div>
            `;

            return;
        }

        box.innerHTML = "";
    },

    paymentProofRetryStorageKey() {
        return "rukhnav_guest_payment_proof_retry";
    },

    restorePaymentProofRetry() {
        let stored = null;

        try {
            stored =
                JSON.parse(
                    sessionStorage.getItem(
                        this.paymentProofRetryStorageKey()
                    ) ||
                    "null"
                );
        } catch (_) {
            stored = null;
        }

        if (
            !stored ||
            !stored.paymentProofUploadFailed ||
            !stored.orderNumber ||
            !stored.token
        ) {
            return;
        }

        this.orderCreated = true;

        this.paymentProofRetryOrderNumber =
            String(
                stored.orderNumber
            );

        this.paymentProofRetryToken =
            String(
                stored.token
            );

        const button =
            document.getElementById(
                "placeGuestOrderButton"
            );

        if (button) {
            button.innerHTML =
                '<i class="fa-solid fa-upload"></i> Retry Receipt Upload';

            button.disabled =
                false;
        }

        this.message(
            `Order ${this.paymentProofRetryOrderNumber} already exists. Please select the receipt again if necessary, then tap Retry Receipt Upload.`,
            "info"
        );
    },

    savePaymentProofRetry(
        orderNumber,
        token
    ) {
        this.paymentProofRetryOrderNumber =
            String(
                orderNumber ||
                ""
            );

        this.paymentProofRetryToken =
            String(
                token ||
                ""
            );

        sessionStorage.setItem(
            this.paymentProofRetryStorageKey(),
            JSON.stringify({
                paymentProofUploadFailed:
                    true,

                orderNumber:
                    this.paymentProofRetryOrderNumber,

                token:
                    this.paymentProofRetryToken
            })
        );
    },

    clearPaymentProofRetry() {
        sessionStorage.removeItem(
            this.paymentProofRetryStorageKey()
        );

        this.paymentProofRetryOrderNumber =
            "";

        this.paymentProofRetryToken =
            "";
    },

    async retryPaymentProofUpload(
        button
    ) {
        const orderNumber =
            this.paymentProofRetryOrderNumber;

        const token =
            this.paymentProofRetryToken;

        if (
            !orderNumber ||
            !token
        ) {
            this.message(
                "The existing guest order could not be restored for receipt upload.",
                "error"
            );

            return;
        }

        if (!this.paymentReceiptFile) {
            this.message(
                "Select your payment receipt, then tap Retry Receipt Upload.",
                "error"
            );

            return;
        }

        this.loading(
            button,
            true
        );

        this.message(
            `Uploading the payment receipt for order ${orderNumber}...`,
            "info"
        );

        try {
            await this.uploadPaymentReceipt(
                orderNumber,
                token
            );

            this.clearPaymentProofRetry();

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
                orderNumber
            );

            successUrl.searchParams.set(
                "token",
                token
            );

            location.href =
                successUrl.toString();

        } catch (error) {
            this.message(
                `Order ${orderNumber} already exists. Receipt upload failed again. No new order was created. ${error.message || ""}`,
                "error"
            );

            this.loading(
                button,
                false
            );

            if (button) {
                button.innerHTML =
                    '<i class="fa-solid fa-upload"></i> Retry Receipt Upload';
            }
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

        document
            .getElementById(
                "guestPaymentReceipt"
            )
            ?.addEventListener(
                "change",
                event =>
                    this.handlePaymentReceiptChange(
                        event
                    )
            );

        document
            .getElementById(
                "removeGuestPaymentReceiptButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    this.clearPaymentReceipt();

                    this.message(
                        "Payment receipt removed.",
                        "info"
                    );
                }
            );
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

    bindSummaryRemoval() {
        const container =
            document.getElementById(
                "guestOrderItems"
            );

        if (
            !container ||
            container.dataset.removeBound === "1"
        ) {
            return;
        }

        container.dataset.removeBound = "1";

        container.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-guest-checkout-remove]"
                    );

                if (!button) {
                    return;
                }

                this.removeCheckoutItem(
                    button.dataset.guestCheckoutRemove
                );
            }
        );
    },

    async removeCheckoutItem(productId) {
        if (!this.cartMode) {
            return;
        }

        const item =
            this.items.find(row =>
                String(row.product?.id) ===
                String(productId)
            );

        if (!item) {
            return;
        }

        if (
            !confirm(
                `Remove ${item.product?.product_name || "this product"} from your cart?`
            )
        ) {
            return;
        }

        const next =
            Store.read(
                Store.cartKey
            ).filter(row =>
                String(row.productId) !==
                String(productId)
            );

        Store.write(
            Store.cartKey,
            next
        );

        this.items =
            this.items.filter(row =>
                String(row.product?.id) !==
                String(productId)
            );

        await Store.refreshCartCount();

        if (!this.items.length) {
            location.href =
                "cart.html";
            return;
        }

        this.render();

        Store.toast(
            "Product removed from cart."
        );
    },

    render() {
        this.bindSummaryRemoval();

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
                    typeof Store?.img === "function"
                        ? Store.img(product)
                        : this.productImage(
                            product
                        );

                const removeAction =
                    this.cartMode
                        ? `
                            <button
                                type="button"
                                class="checkout-remove-item"
                                data-guest-checkout-remove="${Components.e(product.id)}"
                                aria-label="Remove ${Components.e(product.product_name || "product")} from cart"
                            >
                                <i class="fa-solid fa-trash-can"></i>
                                Remove
                            </button>
                        `
                        : "";

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

                        <div class="checkout-item-copy">
                            <strong>${Components.e(product.product_name || "Product")}</strong>
                            <span>Quantity: ${quantity}</span>
                            <small>${stock} available</small>
                            ${removeAction}
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

        /*
         * Refresh the selected wallet panel after the
         * final checkout total has been rendered.
         */
        const selectedPaymentMethod =
            document.querySelector(
                'input[name="guestPaymentMethod"]:checked'
            )?.value ||
            "cash_on_delivery";

        this.renderPaymentAccountDetails(
            selectedPaymentMethod
        );
    },

    paymentReceiptRequired(method) {
        return (
            method === "jazzcash" ||
            method === "easypaisa"
        );
    },

    handlePaymentReceiptChange(event) {
        const file =
            event?.target?.files?.[0] ||
            null;

        if (!file) {
            this.clearPaymentReceipt();
            return;
        }

        const allowed =
            new Set([
                "image/jpeg",
                "image/png",
                "image/webp"
            ]);

        if (!allowed.has(file.type)) {
            event.target.value = "";

            this.clearPaymentReceipt();

            this.message(
                "Payment receipt must be a JPG, PNG or WEBP image.",
                "error"
            );

            return;
        }

        const maximum =
            5 * 1024 * 1024;

        if (file.size > maximum) {
            event.target.value = "";

            this.clearPaymentReceipt();

            this.message(
                "Payment receipt must be 5 MB or smaller.",
                "error"
            );

            return;
        }

        if (this.paymentReceiptPreviewUrl) {
            URL.revokeObjectURL(
                this.paymentReceiptPreviewUrl
            );
        }

        this.paymentReceiptFile =
            file;

        this.paymentReceiptPreviewUrl =
            URL.createObjectURL(file);

        const image =
            document.getElementById(
                "guestPaymentReceiptPreviewImage"
            );

        if (image) {
            image.src =
                this.paymentReceiptPreviewUrl;
        }

        this.text(
            "guestPaymentReceiptFileName",
            file.name ||
                "Payment receipt"
        );

        this.text(
            "guestPaymentReceiptFileSize",
            `${(
                file.size /
                1024 /
                1024
            ).toFixed(2)} MB`
        );

        document
            .getElementById(
                "guestPaymentReceiptPreview"
            )
            ?.classList.remove(
                "hidden"
            );

        this.message(
            "Payment receipt selected. It will be submitted securely with your order.",
            "success"
        );
    },

    clearPaymentReceipt() {
        if (
            this.paymentReceiptPreviewUrl
        ) {
            URL.revokeObjectURL(
                this.paymentReceiptPreviewUrl
            );
        }

        this.paymentReceiptFile =
            null;

        this.paymentReceiptPreviewUrl =
            "";

        const input =
            document.getElementById(
                "guestPaymentReceipt"
            );

        if (input) {
            input.value = "";
        }

        const image =
            document.getElementById(
                "guestPaymentReceiptPreviewImage"
            );

        if (image) {
            image.removeAttribute(
                "src"
            );
        }

        document
            .getElementById(
                "guestPaymentReceiptPreview"
            )
            ?.classList.add(
                "hidden"
            );
    },

    async uploadPaymentReceipt(
        orderNumber,
        guestToken
    ) {
        if (!this.paymentReceiptFile) {
            throw new Error(
                "Payment receipt is missing."
            );
        }

        if (
            !orderNumber ||
            !guestToken
        ) {
            throw new Error(
                "Guest order authorization was not returned."
            );
        }

        const form =
            new FormData();

        form.append(
            "payment_receipt",
            this.paymentReceiptFile
        );

        const url =
            `${API.base}/api/orders/guest/${encodeURIComponent(
                orderNumber
            )}/payment-proof?token=${encodeURIComponent(
                guestToken
            )}`;

        const response =
            await fetch(
                url,
                {
                    method: "POST",
                    body: form
                }
            );

        let data = {};

        try {
            data =
                await response.json();
        } catch (_) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.message ||
                "The order was created, but the payment receipt could not be uploaded."
            );
        }

        return data;
    },

    toggleManualPayment() {
        const method =
            document.querySelector(
                'input[name="guestPaymentMethod"]:checked'
            )?.value ||
            "cash_on_delivery";

        this.renderPaymentAccountDetails(
            method
        );

        const manual =
            method !==
            "cash_on_delivery";

        const mobileWallet =
            this.paymentReceiptRequired(
                method
            );

        document
            .getElementById(
                "manualPaymentFields"
            )
            ?.classList.toggle(
                "hidden",
                !manual
            );

        document
            .getElementById(
                "guestPaymentReceiptPanel"
            )
            ?.classList.toggle(
                "hidden",
                !mobileWallet
            );

        const receiptInput =
            document.getElementById(
                "guestPaymentReceipt"
            );

        if (receiptInput) {
            receiptInput.required =
                mobileWallet;
        }
    },

    async submit(event) {
        event.preventDefault();

        if (this.orderCreated) {
            if (
                this.paymentProofRetryOrderNumber &&
                this.paymentProofRetryToken
            ) {
                const retryButton =
                    document.getElementById(
                        "placeGuestOrderButton"
                    );

                await this.retryPaymentProofUpload(
                    retryButton
                );

                return;
            }

            this.message(
                "Your order has already been created. Please do not place it again.",
                "error"
            );

            return;
        }

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

        const manual =
            method !==
            "cash_on_delivery";

        const mobileWallet =
            this.paymentReceiptRequired(
                method
            );

        const paymentPhone =
            this.value(
                "guestPaymentPhone"
            );

        const transactionId =
            this.value(
                "guestTransactionId"
            );

        if (
            manual &&
            !transactionId
        ) {
            this.message(
                "Enter the payment transaction/reference ID.",
                "error"
            );

            return;
        }

        if (
            mobileWallet &&
            !paymentPhone
        ) {
            this.message(
                "Enter the mobile number used to send the payment.",
                "error"
            );

            return;
        }

        if (
            mobileWallet &&
            !this.paymentReceiptFile
        ) {
            this.message(
                "Upload your JazzCash or Easypaisa payment receipt before placing the order.",
                "error"
            );

            return;
        }

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
                            paymentPhone ||
                            null,

                        transaction_id:
                            transactionId ||
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
             * Order now exists. Never create it again
             * if receipt upload subsequently fails.
             */
            this.orderCreated = true;

            if (mobileWallet) {
                this.message(
                    "Order created. Uploading your payment receipt securely...",
                    "info"
                );

                try {
                    await this.uploadPaymentReceipt(
                        order.order_number,
                        token
                    );

                    this.clearPaymentProofRetry();
                } catch (receiptError) {
                    /*
                     * The order already exists.
                     * Persist only the existing order authorization
                     * in sessionStorage so a reload can retry the
                     * receipt upload without creating another order.
                     */
                    this.savePaymentProofRetry(
                        order.order_number,
                        token
                    );

                    if (button) {
                        button.innerHTML =
                            '<i class="fa-solid fa-upload"></i> Retry Receipt Upload';
                    }

                    this.message(
                        `Order ${order.order_number} was created successfully, but the payment receipt upload failed. Do not place another order. ${receiptError.message || "Please retry the receipt upload from your order."}`,
                        "error"
                    );

                    this.loading(
                        button,
                        false
                    );

                    return;
                }
            }

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
