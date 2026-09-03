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
    submitting: false,

    async init() {
        this.bind();

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

            this.prefill();
            this.renderCart();
            this.renderLoyalty();
            this.updatePaymentInstructions();
            this.calculate();

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

    updatePaymentInstructions() {
        const method =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            )?.value || "cash_on_delivery";

        const manual = method !== "cash_on_delivery";
        document
            .getElementById("manualPaymentFields")
            ?.classList.toggle("hidden", !manual);

        const content = {
            cash_on_delivery: [
                "Cash on Delivery selected",
                "Pay the final order amount to the courier when your parcel is delivered."
            ],
            easypaisa: [
                "Easypaisa selected",
                "Manual verification: transfer to the Easypaisa account provided by RUKHNAV, then enter the payment phone and transaction reference. Your order remains pending until the payment is verified."
            ],
            jazzcash: [
                "JazzCash selected",
                "Manual verification: transfer to the JazzCash account provided by RUKHNAV, then enter the payment phone and transaction reference. Your order remains pending until the payment is verified."
            ],
            bank_transfer: [
                "Bank Transfer selected",
                "Use the RUKHNAV bank account details, then enter your transfer reference for verification."
            ]
        }[method] || [
            "Payment selected",
            "Follow the payment instructions supplied by RUKHNAV."
        ];

        const box = document.getElementById("paymentInstructions");
        if (box) {
            box.innerHTML = `
                <i class="fa-solid fa-circle-info"></i>
                <div>
                    <strong>${Components.e(content[0])}</strong>
                    <p>${Components.e(content[1])}</p>
                </div>
            `;
        }
    },

    async submit(event) {
        event.preventDefault();

        if (this.submitting) return;

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

        const manual = paymentMethod !== "cash_on_delivery";
        const paymentPhone = this.get("checkoutPaymentPhone");
        const transactionId = this.get("checkoutTransactionId");

        if (manual && (!paymentPhone || !transactionId)) {
            this.message(
                "Enter the payment phone and transaction reference for the selected payment method.",
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

            sessionStorage.setItem(
                "rukhnav_last_order",
                JSON.stringify({
                    orderId,
                    orderNumber,
                    response: data
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
    () => Checkout.init()
);
