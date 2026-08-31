"use strict";

const OrderSuccess = {
    order: null,

    async init() {
        const params = new URLSearchParams(location.search);
        const orderId = params.get("id");
        const orderNumber = params.get("order");

        const saved =
            JSON.parse(
                sessionStorage.getItem("rukhnav_last_order") ||
                "{}"
            );

        if (orderId && API.isAuthenticated()) {
            try {
                const data = await API.get(
                    `/api/orders/${encodeURIComponent(orderId)}`
                );

                this.order =
                    data.order ||
                    data.data?.order ||
                    data.data ||
                    data;
            } catch {}
        }

        if (!this.order) {
            this.order =
                saved.response?.order ||
                saved.response?.data?.order ||
                {
                    id: saved.orderId || orderId,
                    order_number:
                        saved.orderNumber ||
                        orderNumber ||
                        "Pending assignment"
                };
        }

        this.render();

        document
            .getElementById("orderSuccessLoading")
            ?.classList.add("hidden");

        document
            .getElementById("orderSuccessContent")
            ?.classList.remove("hidden");

        document
            .getElementById("copyOrderNumber")
            ?.addEventListener("click", () => this.copy());
    },

    render() {
        const order = this.order || {};

        this.text(
            "successOrderNumber",
            order.order_number ||
            order.orderNumber ||
            order.id ||
            "—"
        );

        this.text(
            "successOrderStatus",
            order.order_status ||
            order.orderStatus ||
            order.status ||
            "Pending"
        );

        this.text(
            "successPaymentStatus",
            order.payment_status ||
            order.paymentStatus ||
            "Pending"
        );

        this.text(
            "successPaymentMethod",
            this.label(
                order.payment_method ||
                order.paymentMethod ||
                "—"
            )
        );

        const total =
            order.grand_total ??
            order.total_amount ??
            order.total ??
            null;

        this.text(
            "successGrandTotal",
            total !== null
                ? Store.money(total)
                : "See order details"
        );

        const items =
            Array.isArray(order.items)
                ? order.items
                : Array.isArray(order.order_items)
                    ? order.order_items
                    : [];

        const container =
            document.getElementById("successItems");

        if (container && items.length) {
            container.innerHTML =
                items.map(item => `
                    <article>
                        <span>
                            <strong>${Components.e(item.product_name || "Product")}</strong>
                            <small>Quantity: ${Number(item.quantity || 0)}</small>
                        </span>
                        <b>${Store.money(item.subtotal || 0)}</b>
                    </article>
                `).join("");
        }

        const view = document.getElementById("viewOrderButton");
        if (view && order.id) {
            view.href =
                `order-details.html?id=${encodeURIComponent(order.id)}`;
        }
    },

    async copy() {
        const value =
            this.order?.order_number ||
            this.order?.orderNumber ||
            this.order?.id;

        if (!value) return;

        try {
            await navigator.clipboard.writeText(String(value));
            Store.toast("Order number copied.");
        } catch {
            Store.toast(`Order number: ${value}`);
        }
    },

    label(value) {
        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, character => character.toUpperCase());
    },

    text(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value ?? "";
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => OrderSuccess.init()
);
