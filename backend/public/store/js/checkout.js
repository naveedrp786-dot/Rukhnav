"use strict";

const Checkout = {
    cart: [],
    profile: {},
    loyalty: {},
    subtotal: 0,
    deliveryCharge: 250,
    couponDiscount: 0,
    loyaltyDiscount: 0,
    availableRewardPoints: 0,
    rewardPointsToRedeem: 0,
    rewardPointsDiscount: 0,
    websiteSettings: {},
    paymentSettings: {},
    paymentReceiptFile: null,
    paymentReceiptPreviewUrl: "",
    orderCreated: false,
    paymentProofRetryOrderId: null,
    paymentProofRetryOrderNumber: "",
    submitting: false,

    async init() {
        this.bind();
        this.restorePaymentProofRetry();

        if (!API.isAuthenticated()) {
            this.hide("checkoutLoading");
            this.show("checkoutAuthRequired");
            return;
        }

        try {
            const results = await Promise.allSettled([
                API.get("/api/cart"),
                API.get("/api/customers/profile"),
                API.get("/api/customer-loyalty/me"),
                API.get("/api/website/settings")
            ]);

            if (results[0].status !== "fulfilled") {
                throw results[0].reason;
            }

            const cartData = results[0].value;
            this.cart =
                Array.isArray(cartData.cart)
                    ? cartData.cart
                    : Array.isArray(cartData.items)
                        ? cartData.items
                        : [];

            if (!this.cart.length) {
                this.hide("checkoutLoading");
                this.show("checkoutEmpty");
                return;
            }

            if (results[1].status === "fulfilled") {
                this.profile =
                    results[1].value.customer ||
                    results[1].value.profile ||
                    results[1].value.data ||
                    results[1].value;
            }

            if (results[2].status === "fulfilled") {
                this.loyalty =
                    results[2].value.loyalty ||
                    results[2].value;
            }

            if (results[3].status === "fulfilled") {
                const websiteResponse =
                    results[3].value || {};

                this.websiteSettings =
                    websiteResponse.settings ||
                    websiteResponse;

                this.paymentSettings =
                    this.websiteSettings.payments ||
                    {};
            }

            this.prefill();
            this.renderCart();
            this.renderLoyalty();
            this.applyPaymentSettings();
            this.calculate();
            this.updatePaymentInstructions();

            this.hide("checkoutLoading");
            this.show("checkoutContent");

        } catch (error) {
            this.hide("checkoutLoading");

            if (
                error.status === 401 ||
                error.status === 403
            ) {
                API.clearCustomerSession();
                this.show("checkoutAuthRequired");
            } else {
                this.show("checkoutEmpty");
            }

            this.message(
                error.message ||
                "Unable to load checkout.",
                "error"
            );
        }
    },

    restorePaymentProofRetry() {
        try {
            const raw =
                sessionStorage.getItem(
                    "rukhnav_last_order"
                );

            if (!raw) {
                return;
            }

            const saved =
                JSON.parse(raw);

            if (
                !saved?.paymentProofUploadFailed ||
                !saved?.orderId
            ) {
                return;
            }

            this.orderCreated = true;

            this.paymentProofRetryOrderId =
                saved.orderId;

            this.paymentProofRetryOrderNumber =
                saved.orderNumber ||
                String(saved.orderId);

            const button =
                document.getElementById(
                    "placeOrderButton"
                );

            if (button) {
                button.innerHTML =
                    '<i class="fa-solid fa-cloud-arrow-up"></i> Retry Receipt Upload';
            }
        } catch (error) {
            console.warn(
                "Payment receipt retry state could not be restored:",
                error
            );
        }
    },

    bind() {
        document
            .getElementById("checkoutForm")
            ?.addEventListener("submit", event => this.submit(event));

        document
            .getElementById("checkoutItems")
            ?.addEventListener("click", event => {
                const button =
                    event.target.closest(
                        "[data-checkout-remove]"
                    );

                if (!button) {
                    return;
                }

                this.removeCheckoutItem(
                    button.dataset.checkoutRemove,
                    button
                );
            });

        document
            .querySelectorAll('input[name="deliveryOption"]')
            .forEach(input => {
                input.addEventListener("change", () => {
                    this.deliveryCharge =
    parseFloat(
        input.dataset.charge
    ) || 0;

this.calculate();
                });
            });

        document
            .querySelectorAll('input[name="paymentMethod"]')
            .forEach(input => {
                input.addEventListener("change", () => {
                    this.updatePaymentInstructions();
                });
            });

        document
            .getElementById("applyCouponButton")
            ?.addEventListener("click", () => {
                this.applyCouponPreview();
            });

        document
            .getElementById("checkoutRewardPoints")
            ?.addEventListener("input", event => {
                this.setRewardPoints(
                    event.target.value
                );
            });

        document
            .getElementById("useMaximumRewardPoints")
            ?.addEventListener("click", () => {
                this.useMaximumRewardPoints();
            });

        document
            .getElementById("clearRewardPoints")
            ?.addEventListener("click", () => {
                this.setRewardPoints(0);
            });
    },

    prefill() {
        const customer = this.profile || {};

        this.value("checkoutFullName", customer.full_name || customer.fullName || "");
        this.value("checkoutPhone", customer.phone || "");
        this.value("checkoutEmail", customer.email || "");
        this.value(
            "checkoutAddress",
            customer.address ||
            customer.shipping_address ||
            customer.delivery_address ||
            ""
        );
        this.value("checkoutCity", customer.city || "");
        this.value("checkoutPostalCode", customer.postal_code || customer.postalCode || "");
    },

    renderCart() {
        this.subtotal = this.cart.reduce((sum, item) => {
            const price = Number(
                item.price ??
                item.selling_price ??
                item.product_price ??
                0
            );
            return sum + price * Number(item.quantity || 0);
        }, 0);

        const container = document.getElementById("checkoutItems");

        if (container) {
            container.innerHTML = this.cart.map(item => {
                const price = Number(item.price ?? item.selling_price ?? 0);
                const subtotal = Number(item.subtotal ?? price * Number(item.quantity || 0));
                const image =
                    typeof Store?.img === "function"
                        ? Store.img(item)
                        : this.image(
                            item.image ||
                            item.product_image ||
                            item.image_url
                        );

                const cartId =
                    item.cart_id ??
                    item.cartId ??
                    item.id;

                return `
                    <article
                        class="checkout-item"
                        data-checkout-item="${Components.e(cartId)}"
                    >
                        ${
                            image
                                ? `<img src="${Components.e(image)}" alt="${Components.e(item.product_name || "Product")}">`
                                : `<div class="checkout-item-placeholder"><i class="fa-solid fa-spa"></i></div>`
                        }

                        <div class="checkout-item-copy">
                            <strong>${Components.e(item.product_name || "Product")}</strong>
                            <span>Quantity: ${Number(item.quantity || 0)}</span>

                            <button
                                type="button"
                                class="checkout-remove-item"
                                data-checkout-remove="${Components.e(cartId)}"
                                aria-label="Remove ${Components.e(item.product_name || "product")} from cart"
                            >
                                <i class="fa-solid fa-trash-can"></i>
                                Remove
                            </button>
                        </div>

                        <b>${Store.money(subtotal)}</b>
                    </article>
                `;
            }).join("");
        }
    },

    async removeCheckoutItem(cartId, button) {
        const item =
            this.cart.find(row =>
                String(
                    row.cart_id ??
                    row.cartId ??
                    row.id
                ) === String(cartId)
            );

        if (!item) {
            return;
        }

        if (
            !confirm(
                `Remove ${item.product_name || "this product"} from your cart?`
            )
        ) {
            return;
        }

        if (button) {
            button.disabled = true;
        }

        try {
            await API.delete(
                `${API.cart}/${encodeURIComponent(cartId)}`
            );

            this.cart =
                this.cart.filter(row =>
                    String(
                        row.cart_id ??
                        row.cartId ??
                        row.id
                    ) !== String(cartId)
                );

            /*
             * A changed cart invalidates any checkout
             * discount preview based on the old subtotal.
             */
            this.coupon = null;
            this.couponDiscount = 0;
            this.rewardPointsToRedeem = 0;
            this.rewardPointsDiscount = 0;

            const couponInput =
                document.getElementById(
                    "checkoutCoupon"
                );

            if (couponInput) {
                couponInput.value = "";
            }

            const rewardInput =
                document.getElementById(
                    "checkoutRewardPoints"
                );

            if (rewardInput) {
                rewardInput.value = "0";
            }

            if (!this.cart.length) {
                this.hide("checkoutContent");
                this.show("checkoutEmpty");

                await Store.refreshCartCount();

                Store.toast(
                    "Your cart is now empty."
                );

                return;
            }

            this.renderCart();
            this.renderLoyalty();
            this.calculate();

            await Store.refreshCartCount();

            Store.toast(
                "Product removed from cart."
            );
        } catch (error) {
            if (button) {
                button.disabled = false;
            }

            Store.toast(
                error.message ||
                "Unable to remove this product.",
                "error"
            );
        }
    },

    renderLoyalty() {

    const level =
        this.loyalty.membershipLevel ||
        this.loyalty.membership_level ||
        "Bronze";

    const points = Number(
        this.loyalty.availablePoints ??
        this.loyalty.available_points ??
        0
    );

    this.availableRewardPoints =
        Math.max(
            0,
            Math.floor(
                Number.isFinite(points)
                    ? points
                    : 0
            )
        );

    if (
        this.rewardPointsToRedeem >
        this.availableRewardPoints
    ) {
        this.rewardPointsToRedeem =
            this.availableRewardPoints;
    }

    const percentage = Number(
        this.loyalty.benefits?.discountPercentage ??
        this.loyalty.discountPercentage ??
        this.loyalty.discount_percentage ??
        0
    );

    this.loyaltyDiscount =
        Number(
            (
                this.subtotal *
                percentage /
                100
            ).toFixed(2)
        );

    this.text(
        "checkoutMembership",
        level
    );

    this.text(
        "checkoutPoints",
        new Intl.NumberFormat("en-PK")
            .format(points)
    );

    this.text(
        "checkoutLoyaltyDiscount",
        Store.money(this.loyaltyDiscount)
    );

    this.text(
        "checkoutRewardAvailable",
        `${new Intl.NumberFormat("en-PK")
            .format(this.availableRewardPoints)} points`
    );

    const rewardInput =
        document.getElementById(
            "checkoutRewardPoints"
        );

    if (rewardInput) {
        rewardInput.max =
            String(
                this.availableRewardPoints
            );

        rewardInput.value =
            String(
                this.rewardPointsToRedeem
            );
    }

    // ======================================
    // FREE DELIVERY CHECK
    // ======================================

    const rawFreeDelivery =
        this.loyalty.benefits?.freeDeliveryEnabled ??
        this.loyalty.benefits?.free_delivery_enabled ??
        this.loyalty.freeDeliveryEnabled ??
        this.loyalty.free_delivery_enabled ??
        false;

    const freeDelivery =
        rawFreeDelivery === true ||
        rawFreeDelivery === 1 ||
        rawFreeDelivery === "1";

    const standard =
        document.querySelector(
            'input[name="deliveryOption"][value="standard"]'
        );

    if (freeDelivery) {

        this.deliveryCharge = 0;

        this.show(
            "freeDeliveryNotice"
        );

        if (standard) {

            standard.checked = true;

            standard.dataset.charge = "0";

        }

    } else {

        this.deliveryCharge = 250;

        this.hide(
            "freeDeliveryNotice"
        );

        if (standard) {

            standard.dataset.charge = "250";

        }

    }

    this.calculate();

},

    setRewardPoints(value) {
        let requested =
            Number.parseInt(
                value,
                10
            );

        if (
            !Number.isInteger(requested) ||
            requested < 0
        ) {
            requested = 0;
        }

        requested =
            Math.min(
                requested,
                this.availableRewardPoints
            );

        /*
         * Current RUKHNAV redemption rule:
         * 1 reward point = Rs. 1.
         *
         * Never allow the browser preview to redeem
         * more than the amount remaining after coupon
         * and membership discounts.
         */
        const merchandiseRemaining =
            Math.max(
                0,
                this.subtotal -
                this.couponDiscount -
                this.loyaltyDiscount
            );

        const maximumUsefulPoints =
            Math.max(
                0,
                Math.floor(
                    merchandiseRemaining
                )
            );

        requested =
            Math.min(
                requested,
                maximumUsefulPoints
            );

        this.rewardPointsToRedeem =
            requested;

        this.rewardPointsDiscount =
            Number(
                requested.toFixed(2)
            );

        const input =
            document.getElementById(
                "checkoutRewardPoints"
            );

        if (input) {
            input.value =
                String(requested);
        }

        this.text(
            "checkoutRewardUsing",
            `${new Intl.NumberFormat("en-PK")
                .format(requested)} points`
        );

        this.text(
            "checkoutRewardValue",
            `${Store.money(
                this.rewardPointsDiscount
            )} discount`
        );

        this.calculate();
    },

    useMaximumRewardPoints() {
        const merchandiseRemaining =
            Math.max(
                0,
                this.subtotal -
                this.couponDiscount -
                this.loyaltyDiscount
            );

        const maximumUsefulPoints =
            Math.max(
                0,
                Math.floor(
                    merchandiseRemaining
                )
            );

        this.setRewardPoints(
            Math.min(
                this.availableRewardPoints,
                maximumUsefulPoints
            )
        );
    },

    calculate() {
        /*
         * Revalidate reward preview whenever another
         * checkout value changes.
         */
        const merchandiseRemaining =
            Math.max(
                0,
                this.subtotal -
                this.couponDiscount -
                this.loyaltyDiscount
            );

        const maximumUsefulPoints =
            Math.max(
                0,
                Math.floor(
                    merchandiseRemaining
                )
            );

        if (
            this.rewardPointsToRedeem >
            maximumUsefulPoints
        ) {
            this.rewardPointsToRedeem =
                maximumUsefulPoints;

            this.rewardPointsDiscount =
                maximumUsefulPoints;

            const input =
                document.getElementById(
                    "checkoutRewardPoints"
                );

            if (input) {
                input.value =
                    String(
                        maximumUsefulPoints
                    );
            }
        }

        const total = Math.max(
            0,
            this.subtotal +
            this.deliveryCharge -
            this.couponDiscount -
            this.loyaltyDiscount -
            this.rewardPointsDiscount
        );

        this.grandTotal = total;

        this.text(
            "checkoutRewardUsing",
            `${new Intl.NumberFormat("en-PK")
                .format(
                    this.rewardPointsToRedeem
                )} points`
        );

        this.text(
            "checkoutRewardValue",
            `${Store.money(
                this.rewardPointsDiscount
            )} discount`
        );

        this.text(
            "checkoutRewardDiscount",
            `- ${Store.money(
                this.rewardPointsDiscount
            )}`
        );

        this.text("checkoutSubtotal", Store.money(this.subtotal));

        this.text(
            "checkoutDelivery",
            this.deliveryCharge > 0
                ? Store.money(this.deliveryCharge)
                : "Free"
        );

        this.text(
            "checkoutCouponDiscount",
            `- ${Store.money(this.couponDiscount)}`
        );

        this.text(
            "checkoutSummaryLoyalty",
            `- ${Store.money(this.loyaltyDiscount)}`
        );

        this.text(
            "checkoutGrandTotal",
            Store.money(total)
        );

        const selectedPaymentMethod =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            )?.value;

        if (
            selectedPaymentMethod === "jazzcash" ||
            selectedPaymentMethod === "easypaisa"
        ) {
            this.updatePaymentInstructions();
        }
    },

    async applyCouponPreview() {
        const input =
            document.getElementById(
                "checkoutCoupon"
            );

        const code =
            input
                ?.value
                ?.trim()
                .toUpperCase() ||
            "";

        if (!code) {
            this.couponDiscount = 0;
            this.calculate();

            this.message(
                "Enter a coupon code.",
                "error"
            );

            return;
        }

        if (
            !Number.isFinite(
                Number(this.subtotal)
            ) ||
            Number(this.subtotal) <= 0
        ) {
            this.couponDiscount = 0;
            this.calculate();

            this.message(
                "Your cart does not contain an amount eligible for a coupon.",
                "error"
            );

            return;
        }

        const button =
            document.getElementById(
                "applyCouponButton"
            );

        const originalButtonText =
            button?.innerHTML;

        if (button) {
            button.disabled = true;
            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Applying...';
        }

        /*
         * Always clear the previous preview before validating
         * another code. The order endpoint remains the final
         * authority when the customer places the order.
         */
        this.couponDiscount = 0;
        this.calculate();

        try {
            const customerId =
                this.profile?.id ??
                this.profile?.customer_id ??
                null;

            const data =
                await API.post(
                    "/api/coupons/apply",
                    {
                        code,
                        orderTotal:
                            Number(
                                Number(
                                    this.subtotal
                                ).toFixed(2)
                            ),
                        customerId:
                            customerId
                                ? Number(customerId)
                                : null
                    }
                );

            const discountAmount =
                Number(
                    data?.calculation
                        ?.discountAmount ??
                    0
                );

            if (
                !Number.isFinite(
                    discountAmount
                ) ||
                discountAmount < 0
            ) {
                throw new Error(
                    "The coupon service returned an invalid discount."
                );
            }

            this.couponDiscount =
                Number(
                    Math.min(
                        Number(this.subtotal),
                        discountAmount
                    ).toFixed(2)
                );

            if (input) {
                input.value =
                    data?.coupon?.code ||
                    code;
            }

            /*
             * calculate() also revalidates the maximum useful
             * reward points after the coupon discount changes.
             */
            this.calculate();

            this.message(
                data?.message ||
                `Coupon ${code} applied successfully. You saved ${Store.money(
                    this.couponDiscount
                )}.`,
                "success"
            );

        } catch (error) {
            this.couponDiscount = 0;
            this.calculate();

            this.message(
                error?.message ||
                "Unable to apply this coupon.",
                "error"
            );

        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML =
                    originalButtonText ||
                    "Apply";
            }
        }
    },

    applyPaymentSettings() {
        const settings =
            this.paymentSettings || {};

        const availability = {
            cash_on_delivery:
                settings.cash_on_delivery_enabled !== false,

            easypaisa:
                settings.easypaisa_enabled !== false,

            jazzcash:
                settings.jazzcash_enabled !== false,

            bank_transfer:
                settings.bank_transfer_enabled !== false
        };

        Object.entries(availability)
            .forEach(([method, enabled]) => {
                const input =
                    document.querySelector(
                        `input[name="paymentMethod"][value="${method}"]`
                    );

                if (!input) return;

                const label =
                    input.closest("label");

                input.disabled = !enabled;

                if (label) {
                    label.classList.toggle(
                        "payment-disabled",
                        !enabled
                    );

                    label.hidden = !enabled;
                }
            });

        const selected =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            );

        if (selected && !selected.disabled) {
            return;
        }

        const firstAvailable =
            document.querySelector(
                'input[name="paymentMethod"]:not(:disabled)'
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
            await navigator.clipboard.writeText(number);

            const original =
                button?.innerHTML || "";

            if (button) {
                button.innerHTML =
                    '<i class="fa-solid fa-check"></i> Copied';

                setTimeout(() => {
                    button.innerHTML = original;
                }, 1500);
            }
        } catch (error) {
            this.message(
                `Payment number: ${number}`,
                "info"
            );
        }
    },

    updatePaymentInstructions() {
        const method =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            )?.value || "cash_on_delivery";

        const manual =
            method !== "cash_on_delivery";

        const mobileWallet =
            method === "jazzcash" ||
            method === "easypaisa";

        this.updatePaymentReceiptVisibility(
            method
        );

        document
            .getElementById("manualPaymentFields")
            ?.classList.toggle(
                "hidden",
                !manual
            );

        const phoneField =
            document.getElementById(
                "checkoutPaymentPhoneField"
            );

        if (phoneField) {
            phoneField.classList.toggle(
                "hidden",
                !mobileWallet
            );
        }

        const paymentPhoneInput =
            document.getElementById(
                "checkoutPaymentPhone"
            );

        if (paymentPhoneInput) {
            paymentPhoneInput.required =
                mobileWallet;
        }

        const transactionInput =
            document.getElementById(
                "checkoutTransactionId"
            );

        if (transactionInput) {
            transactionInput.required =
                manual;
        }

        const box =
            document.getElementById(
                "paymentInstructions"
            );

        if (!box) return;

        if (method === "cash_on_delivery") {
            box.innerHTML = `
                <i class="fa-solid fa-circle-info"></i>

                <div>
                    <strong>
                        Cash on Delivery selected
                    </strong>

                    <p>
                        Pay the final order amount to the
                        courier when your parcel is delivered.
                    </p>
                </div>
            `;

            return;
        }

        if (
            method === "jazzcash" ||
            method === "easypaisa"
        ) {
            const details =
                this.paymentAccountDetails(method);

            const brand =
                method === "jazzcash"
                    ? "JazzCash"
                    : "Easypaisa";

            const accountTitle =
                details.title
                    ? `
                        <div class="manual-payment-row">
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
                        <div class="manual-payment-row">
                            <span>Account number</span>

                            <div class="manual-payment-copy">
                                <strong>
                                    ${Components.e(details.number)}
                                </strong>

                                <button
                                    type="button"
                                    class="payment-copy-button"
                                    data-payment-copy="${Components.e(details.number)}"
                                >
                                    <i class="fa-regular fa-copy"></i>
                                    Copy
                                </button>
                            </div>
                        </div>
                    `
                    : `
                        <div class="manual-payment-warning">
                            Payment account number has not
                            been published yet.
                        </div>
                    `;

            const qr =
                details.qr
                    ? `
                        <div class="manual-payment-qr">
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
                <div class="manual-payment-panel">

                    <div class="manual-payment-heading">
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

                    <div class="manual-payment-account">
                        ${accountTitle}
                        ${accountNumber}

                        <div class="manual-payment-row">
                            <span>Amount to pay</span>

                            <strong>
                                ${Components.e(
                                    Store.money(
                                        Number(
                                            this.grandTotal || 0
                                        )
                                    )
                                )}
                            </strong>
                        </div>
                    </div>

                    <p class="manual-payment-note">
                        ${Components.e(details.instructions)}
                    </p>

                    <p class="manual-payment-verification">
                        <i class="fa-solid fa-clock"></i>
                        Your order will remain payment pending
                        until RUKHNAV verifies the transaction.
                    </p>

                </div>
            `;

            box
                .querySelectorAll(
                    "[data-payment-copy]"
                )
                .forEach(button => {
                    button.addEventListener(
                        "click",
                        () => this.copyPaymentNumber(
                            button.dataset.paymentCopy,
                            button
                        )
                    );
                });

            return;
        }

        if (method === "bank_transfer") {
            box.innerHTML = `
                <i class="fa-solid fa-building-columns"></i>

                <div>
                    <strong>
                        Bank Transfer selected
                    </strong>

                    <p>
                        Transfer the order amount using the
                        RUKHNAV bank details, then enter your
                        transaction reference below.
                    </p>
                </div>
            `;

            return;
        }

        box.innerHTML = `
            <i class="fa-solid fa-circle-info"></i>

            <div>
                <strong>Payment selected</strong>
                <p>
                    Follow the payment instructions
                    supplied by RUKHNAV.
                </p>
            </div>
        `;
    },

    paymentReceiptRequired(method) {
        return (
            method === "jazzcash" ||
            method === "easypaisa"
        );
    },

    updatePaymentReceiptVisibility(method) {
        const required =
            this.paymentReceiptRequired(
                method
            );

        const panel =
            document.getElementById(
                "paymentReceiptPanel"
            );

        const input =
            document.getElementById(
                "checkoutPaymentReceipt"
            );

        if (panel) {
            panel.classList.toggle(
                "hidden",
                !required
            );
        }

        if (input) {
            input.required =
                required;
        }
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

        if (
            !allowed.has(
                file.type
            )
        ) {
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

        if (
            this.paymentReceiptPreviewUrl
        ) {
            URL.revokeObjectURL(
                this.paymentReceiptPreviewUrl
            );
        }

        this.paymentReceiptFile =
            file;

        this.paymentReceiptPreviewUrl =
            URL.createObjectURL(
                file
            );

        const preview =
            document.getElementById(
                "paymentReceiptPreview"
            );

        const image =
            document.getElementById(
                "paymentReceiptPreviewImage"
            );

        const name =
            document.getElementById(
                "paymentReceiptFileName"
            );

        const size =
            document.getElementById(
                "paymentReceiptFileSize"
            );

        if (image) {
            image.src =
                this.paymentReceiptPreviewUrl;
        }

        if (name) {
            name.textContent =
                file.name ||
                "Payment receipt";
        }

        if (size) {
            size.textContent =
                `${(
                    file.size /
                    1024 /
                    1024
                ).toFixed(2)} MB`;
        }

        preview?.classList.remove(
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
                "checkoutPaymentReceipt"
            );

        if (input) {
            input.value = "";
        }

        const image =
            document.getElementById(
                "paymentReceiptPreviewImage"
            );

        if (image) {
            image.removeAttribute(
                "src"
            );
        }

        document
            .getElementById(
                "paymentReceiptPreview"
            )
            ?.classList.add(
                "hidden"
            );
    },

    async uploadCustomerPaymentReceipt(
        orderId
    ) {
        if (
            !this.paymentReceiptFile
        ) {
            throw new Error(
                "Payment receipt is missing."
            );
        }

        if (!orderId) {
            throw new Error(
                "Order was created but its ID was not returned for receipt upload."
            );
        }

        const token =
            API.getToken?.() ||
            "";

        if (!token) {
            throw new Error(
                "Your order was created, but your login session is unavailable for receipt upload."
            );
        }

        const form =
            new FormData();

        form.append(
            "payment_receipt",
            this.paymentReceiptFile
        );

        const response =
            await fetch(
                `${API.base}/api/orders/${encodeURIComponent(
                    orderId
                )}/payment-proof`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    },

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

    async submit(event) {
        event.preventDefault();

        if (this.submitting) return;

        /*
         * If an order already exists and only its receipt
         * upload failed, this button retries the receipt.
         * It must never POST /api/orders a second time.
         */
        if (
            this.orderCreated &&
            this.paymentProofRetryOrderId
        ) {
            const button =
                document.getElementById(
                    "placeOrderButton"
                );

            if (!this.paymentReceiptFile) {
                this.message(
                    "Select the payment receipt, then retry the upload. Your order has already been created.",
                    "error"
                );
                return;
            }

            this.submitting = true;
            this.loading(
                button,
                true
            );

            this.message(
                "Retrying payment receipt upload securely...",
                "info"
            );

            try {
                const paymentProof =
                    await this
                        .uploadCustomerPaymentReceipt(
                            this.paymentProofRetryOrderId
                        );

                const orderId =
                    this.paymentProofRetryOrderId;

                const orderNumber =
                    this.paymentProofRetryOrderNumber ||
                    String(orderId);

                sessionStorage.setItem(
                    "rukhnav_last_order",
                    JSON.stringify({
                        orderId,
                        orderNumber,
                        paymentProof
                    })
                );

                this.paymentProofRetryOrderId =
                    null;

                this.paymentProofRetryOrderNumber =
                    "";

                location.href =
                    `order-success.html?id=${encodeURIComponent(orderId)}&order=${encodeURIComponent(orderNumber)}`;

                return;
            } catch (error) {
                this.message(
                    `Your order already exists. The receipt still could not be uploaded. Please check your connection and use Retry Receipt Upload again. ${error.message || ""}`,
                    "error"
                );

                this.submitting =
                    false;

                this.loading(
                    button,
                    false
                );

                if (button) {
                    button.innerHTML =
                        '<i class="fa-solid fa-cloud-arrow-up"></i> Retry Receipt Upload';
                }

                return;
            }
        }

        if (this.orderCreated) {
            this.message(
                "This order has already been created. Please do not place it again.",
                "error"
            );
            return;
        }

        const fullName = this.get("checkoutFullName");
        const phone = this.get("checkoutPhone");
        const email = this.get("checkoutEmail");
        const city = this.get("checkoutCity");
        const address = this.get("checkoutAddress");
        const postalCode = this.get("checkoutPostalCode");
        const notes = this.get("checkoutNotes");
        const paymentMethod =
            document.querySelector('input[name="paymentMethod"]:checked')
                ?.value || "cash_on_delivery";
        const deliveryOption =
            document.querySelector('input[name="deliveryOption"]:checked')
                ?.value || "standard";
        const couponCode =
            document.getElementById("checkoutCoupon")
                ?.value
                ?.trim()
                .toUpperCase() || null;

        if (!fullName || !phone || !city || !address) {
            this.message(
                "Enter your full name, mobile number, city and delivery address.",
                "error"
            );
            return;
        }

        const manual =
            paymentMethod !== "cash_on_delivery";

        const mobileWallet =
            paymentMethod === "jazzcash" ||
            paymentMethod === "easypaisa";

        const paymentPhone =
            this.get("checkoutPaymentPhone");

        const transactionId =
            this.get("checkoutTransactionId");

        if (manual && !transactionId) {
            this.message(
                "Enter the transaction reference for the selected payment method.",
                "error"
            );
            return;
        }

        if (mobileWallet && !paymentPhone) {
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

        const payload = {
            full_name: fullName,
            phone,
            email: email || null,
            shipping_address: address,
            delivery_address: address,
            city,
            postal_code: postalCode || null,
            order_notes: notes || null,
            payment_method: paymentMethod,
            payment_phone: paymentPhone || null,
            transaction_id: transactionId || null,
            coupon_code: couponCode,
            delivery_option: deliveryOption,
            delivery_charges: this.deliveryCharge,

            /*
             * Request only. The server verifies the
             * actual balance and payable amount.
             */
            reward_points_to_redeem:
                this.rewardPointsToRedeem,
        };

        const button = document.getElementById("placeOrderButton");
        this.submitting = true;
        this.loading(button, true);
        this.message("Placing your order securely...", "info");

        try {
            const data = await API.post("/api/orders", payload);
            const order =
                data.order ||
                data.data?.order ||
                data.data ||
                data;

            const orderId =
                order.id ||
                order.orderId ||
                data.orderId;

            const orderNumber =
                order.order_number ||
                order.orderNumber ||
                data.orderNumber ||
                String(orderId || "");

            /*
             * The backend has created the order.
             * From this point onward never POST it again.
             */
            this.orderCreated = true;

            let paymentProof = null;

            if (mobileWallet) {
                this.message(
                    "Order created. Uploading your payment receipt securely...",
                    "info"
                );

                try {
                    paymentProof =
                        await this
                            .uploadCustomerPaymentReceipt(
                                orderId
                            );
                } catch (receiptError) {
                    /*
                     * CRITICAL:
                     * The order already exists.
                     * Never retry POST /api/orders automatically,
                     * otherwise a duplicate order could be created.
                     */
                    this.paymentProofRetryOrderId =
                        orderId;

                    this.paymentProofRetryOrderNumber =
                        orderNumber;

                    sessionStorage.setItem(
                        "rukhnav_last_order",
                        JSON.stringify({
                            orderId,
                            orderNumber,
                            response: data,
                            paymentProofUploadFailed:
                                true
                        })
                    );

                    this.message(
                        `Order ${orderNumber || orderId} was created successfully, but the payment receipt upload failed. Do not place another order. ${receiptError.message || "Please retry the receipt upload from your order."}`,
                        "error"
                    );

                    this.submitting =
                        false;

                    this.loading(
                        button,
                        false
                    );

                    if (button) {
                        button.innerHTML =
                            '<i class="fa-solid fa-cloud-arrow-up"></i> Retry Receipt Upload';
                    }

                    return;
                }
            }

            sessionStorage.setItem(
                "rukhnav_last_order",
                JSON.stringify({
                    orderId,
                    orderNumber,
                    response: data,
                    paymentProof
                })
            );

            location.href =
                `order-success.html?id=${encodeURIComponent(orderId || "")}&order=${encodeURIComponent(orderNumber || "")}`;

        } catch (error) {
            this.message(
                error.message || "Unable to place your order.",
                "error"
            );
            this.submitting = false;
            this.loading(button, false);
        }
    },

    loading(button, active) {
        if (!button) return;

        if (active) {
            button.dataset.original = button.innerHTML;
            button.disabled = true;
            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order';
            return;
        }

        button.disabled = false;
        if (button.dataset.original) {
            button.innerHTML = button.dataset.original;
            delete button.dataset.original;
        }
    },

    image(value) {
        if (!value) return "";
        if (/^https?:\/\//i.test(value)) return value;
        return `${API.base}/${String(value).replace(/^\/+/, "")}`;
    },

    message(text, type = "info") {
        const element = document.getElementById("checkoutMessage");
        if (!element) return;
        element.textContent = text;
        element.className = `checkout-message show ${type}`;
    },

    get(id) {
        return document.getElementById(id)?.value?.trim() || "";
    },

    value(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value || "";
    },

    text(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value ?? "";
    },

    show(id) {
        document.getElementById(id)?.classList.remove("hidden");
    },

    hide(id) {
        document.getElementById(id)?.classList.add("hidden");
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => {
        const receiptInput =
            document.getElementById(
                "checkoutPaymentReceipt"
            );

        receiptInput?.addEventListener(
            "change",
            event =>
                Checkout
                    .handlePaymentReceiptChange(
                        event
                    )
        );

        document
            .getElementById(
                "removePaymentReceiptButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    Checkout
                        .clearPaymentReceipt();

                    Checkout.message(
                        "Payment receipt removed.",
                        "info"
                    );
                }
            );

        Checkout.init();
    }
);
