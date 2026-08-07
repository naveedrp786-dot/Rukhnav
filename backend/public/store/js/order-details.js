"use strict";

const OrderDetailsPage = {
    order: null,
    items: [],

    async init() {
        await this.waitForStore();
        this.bind();

        const id = new URLSearchParams(location.search).get("id");

        if (!id) {
            Store.toast("Order ID is required.", "error");
            location.href = "orders.html";
            return;
        }

        if (!API.isAuthenticated()) {
            this.showAuth(id);
            return;
        }

        await this.loadOrder(id);
    },

    waitForStore() {
        if (
            Store.settings &&
            Object.keys(
                Store.settings
            ).length
        ) {
            return Promise.resolve();
        }

        return Promise.race([
            new Promise(resolve => {
                document.addEventListener(
                    "rukhnav:store-ready",
                    resolve,
                    {
                        once: true
                    }
                );
            }),

            new Promise(resolve => {
                setTimeout(
                    resolve,
                    1800
                );
            })
        ]);
    },

    bind() {
        document.getElementById("printOrderButton")
            .addEventListener("click", () => window.print());

        document.getElementById("cancelOrderButton")
            .addEventListener("click", () => this.cancelOrder());

        document.getElementById("copyTrackingButton")
            .addEventListener("click", () => this.copyTracking());

        document.getElementById("reorderButton")
            .addEventListener("click", () => this.reorder());
    },

    showAuth(id) {
        document.getElementById("orderDetailsLoading").classList.add("hidden");
        document.getElementById("orderDetailsAuthState").classList.remove("hidden");
        document.getElementById("orderDetailsLoginLink").href =
            `account.html?return=${encodeURIComponent(`order-details.html?id=${id}`)}`;
    },

    async loadOrder(id) {
        try {
            const data = await API.get(`/api/orders/${encodeURIComponent(id)}`);

            this.order =
                data.order ||
                data.data?.order ||
                data.data ||
                {};

            this.items =
                Array.isArray(data.items)
                    ? data.items
                    : Array.isArray(
                        this.order.items
                    )
                        ? this.order.items
                        : Array.isArray(
                            data.data?.items
                        )
                            ? data.data.items
                            : [];

            this.render({
                ...data,
                totalQuantity:
                    data.totalQuantity ??
                    data.total_quantity ??
                    this.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.quantity ||
                                0
                            ),
                        0
                    )
            });
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                this.showAuth(id);
                return;
            }

            Store.toast(error.message, "error");
            setTimeout(() => location.href = "orders.html", 1200);
        }
    },

    render(data) {
        const order = this.order;
        const status = String(order.order_status || "Pending");
        const payment = String(order.payment_status || "Pending");

        document.title = `${order.order_number || "Order"} | RUKHNAV`;

        document.getElementById("orderDetailsNumber").textContent =
            order.order_number || `Order #${order.id}`;

        document.getElementById("orderPlacedDate").textContent =
            `Placed on ${this.dateTime(order.created_at)}`;

        document.getElementById("currentOrderStatus").textContent = status;
        document.getElementById("currentOrderStatusMessage").textContent =
            this.statusMessage(status);

        const paymentBadge = document.getElementById("orderPaymentBadge");
        paymentBadge.textContent = `Payment ${payment}`;
        paymentBadge.className = `order-badge status-${this.slug(payment)}`;

        document.getElementById("orderMethodBadge").textContent =
            this.pretty(order.payment_method);

        const canCancel =
            status.toLowerCase() === "pending" &&
            payment.toLowerCase() !== "paid";

        document.getElementById("cancelOrderButton")
            .classList.toggle("hidden", !canCancel);

        this.renderTimeline();
        this.renderTracking();

        document.getElementById("orderItemsHeading").textContent =
            `${data.totalQuantity || 0} item(s)`;

        document.getElementById("orderItemsList").innerHTML =
            this.items.map(item => this.itemMarkup(item)).join("");

        document.getElementById("detailsSubtotal").textContent =
            Store.money(order.subtotalAmount || 0);

        document.getElementById("detailsDiscount").textContent =
            Store.money(order.discount_amount || 0);

        document.getElementById("detailsDelivery").textContent =
            Store.money(order.delivery_charges || 0);

        document.getElementById("detailsGrandTotal").textContent =
            Store.money(order.grand_total || 0);

        document.getElementById("detailsPaymentMethod").textContent =
            this.pretty(order.payment_method);

        document.getElementById("detailsPaymentStatus").textContent =
            payment;

        if (order.transaction_id) {
            document.getElementById("transactionRow").classList.remove("hidden");
            document.getElementById("detailsTransactionId").textContent =
                order.transaction_id;
        }

        if (order.coupon_code) {
            document.getElementById("couponRow").classList.remove("hidden");
            document.getElementById("detailsCouponCode").textContent =
                order.coupon_code;
        }

        document.getElementById("shippingName").textContent =
            order.full_name || "Customer";

        const addressParts = [
            order.shipping_address,
            order.city,
            order.postal_code
        ].filter(Boolean);

        document.getElementById("shippingAddressText").textContent =
            addressParts.join(", ");

        document.getElementById("shippingContactText").textContent =
            [order.phone, order.email].filter(Boolean).join(" · ");

        document.getElementById("orderDetailsLoading").classList.add("hidden");
        document.getElementById("orderDetailsContent").classList.remove("hidden");
    },

    renderTimeline() {
        const order = this.order;
        const status = String(order.order_status || "Pending").toLowerCase();

        const steps = [
            { key: "pending", label: "Order placed", date: order.created_at },
            { key: "confirmed", label: "Confirmed", date: order.confirmed_at },
            { key: "shipped", label: "Shipped", date: order.shipped_at },
            { key: "delivered", label: "Delivered", date: order.delivered_at }
        ];

        const orderIndex = {
            pending: 0,
            confirmed: 1,
            processing: 1,
            shipped: 2,
            delivered: 3
        }[status] ?? 0;

        const cancelled = status === "cancelled";

        document.getElementById("orderTimeline").innerHTML =
            steps.map((step, index) => {
                const complete = !cancelled && index < orderIndex;
                const active = !cancelled && index === orderIndex;
                const classes = [
                    "timeline-step",
                    complete ? "complete" : "",
                    active ? "active" : "",
                    cancelled && index === 0 ? "cancelled" : ""
                ].filter(Boolean).join(" ");

                return `
                    <article class="${classes}">
                        <span class="timeline-dot"></span>
                        <strong>${cancelled && index === 0 ? "Cancelled" : step.label}</strong>
                        <span>${
                            cancelled && index === 0
                                ? this.date(order.cancelled_at)
                                : this.date(step.date)
                        }</span>
                    </article>
                `;
            }).join("");
    },

    renderTracking() {
        const order = this.order;

        if (!order.tracking_number && !order.tracking_url && !order.estimated_delivery_date) {
            return;
        }

        document.getElementById("trackingCard").classList.remove("hidden");
        document.getElementById("trackingNumberText").textContent =
            order.tracking_number || "Tracking will be updated soon";

        document.getElementById("estimatedDeliveryText").textContent =
            order.estimated_delivery_date
                ? `Estimated delivery: ${this.date(order.estimated_delivery_date)}`
                : "";

        if (order.tracking_url) {
            const link = document.getElementById("trackShipmentLink");
            link.href = order.tracking_url;
            link.classList.remove("hidden");
        }
    },

    itemMarkup(item) {
        const image = Store.img(item);

        return `
            <article class="order-detail-item">
                <a class="order-detail-item-image" href="product.html?id=${encodeURIComponent(item.product_id)}">
                    ${
                        image
                            ? `<img src="${Components.e(image)}" alt="${Components.e(item.product_name || "Product")}">`
                            : `<div class="order-detail-placeholder"><i class="fa-solid fa-spa"></i></div>`
                    }
                </a>

                <div>
                    <h3>${Components.e(item.product_name || "Product")}</h3>
                    <p>Price: ${Store.money(item.price)}</p>
                    <p>Quantity: ${Number(item.quantity || 0)}</p>
                </div>

                <div class="order-detail-item-total">
                    <strong>${Store.money(item.subtotal)}</strong>
                    <span>Item subtotal</span>
                </div>
            </article>
        `;
    },

    async cancelOrder() {
        if (!this.order) return;

        if (!confirm("Cancel this pending order? Product stock will be restored.")) {
            return;
        }

        const button = document.getElementById("cancelOrderButton");
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling';

        try {
            await API.put(`/api/orders/${encodeURIComponent(this.order.id)}/cancel`, {});
            Store.toast("Order cancelled successfully.");
            await this.loadOrder(this.order.id);
        } catch (error) {
            Store.toast(error.message, "error");
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    async copyTracking() {
        const value = this.order?.tracking_number;

        if (!value) {
            Store.toast("Tracking number is not available.", "error");
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            Store.toast("Tracking number copied.");
        } catch {
            Store.toast(`Tracking number: ${value}`);
        }
    },

    async reorder() {
        if (!this.items.length) return;

        const button = document.getElementById("reorderButton");
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding items';

        let added = 0;
        let failed = 0;

        for (const item of this.items) {
            try {
                await Store.addCart(
                    item.product_id,
                    Number(item.quantity || 1)
                );
                added += 1;
            } catch {
                failed += 1;
            }
        }

        button.disabled = false;
        button.innerHTML = original;

        if (added) {
            Store.toast(`${added} product line(s) added to cart.`);
        }

        if (failed) {
            Store.toast(`${failed} product line(s) could not be added.`, "error");
        }
    },

    statusMessage(status) {
        const map = {
            pending: "Your order has been received and is awaiting confirmation.",
            confirmed: "Your order has been confirmed.",
            processing: "Your products are being prepared for shipment.",
            shipped: "Your order is on the way.",
            delivered: "Your order has been delivered.",
            cancelled: "This order has been cancelled."
        };

        return map[String(status || "").toLowerCase()] || "Order status updated.";
    },

    pretty(value) {
        return String(value || "—")
            .replaceAll("_", " ")
            .replace(/\b\w/g, character => character.toUpperCase());
    },

    date(value) {
        if (!value) return "—";
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
    },

    dateTime(value) {
        if (!value) return "—";
        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
    },

    slug(value) {
        return String(value || "pending")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
    }
};

document.addEventListener("DOMContentLoaded", () => OrderDetailsPage.init());
