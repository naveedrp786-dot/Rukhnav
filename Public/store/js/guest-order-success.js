"use strict";

const GuestOrderSuccess = {
    order: null,

    async init() {
        const params =
            new URLSearchParams(
                location.search
            );

        const orderNumber =
            params.get("order") ||
            "";

        const token =
            params.get("token") ||
            sessionStorage.getItem(
                `rukhnav_guest_order_${orderNumber}`
            ) ||
            "";

        if (
            !orderNumber ||
            !token
        ) {
            this.fail(
                "Order confirmation credentials are missing."
            );
            return;
        }

        try {
            const data =
                await API.get(
                    `/api/orders/guest/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`
                );

            this.order =
                data.order;

            this.render();

            document
                .getElementById(
                    "guestSuccessLoading"
                )
                ?.classList.add(
                    "hidden"
                );

            document
                .getElementById(
                    "guestSuccessContent"
                )
                ?.classList.remove(
                    "hidden"
                );

            document
                .getElementById(
                    "copyGuestOrderNumber"
                )
                ?.addEventListener(
                    "click",
                    () =>
                        this.copy()
                );

        } catch (error) {
            this.fail(
                error.message ||
                "Unable to load order confirmation."
            );
        }
    },

    render() {
        const order =
            this.order || {};

        this.text(
            "guestSuccessOrderNumber",
            order.order_number ||
            "—"
        );

        this.text(
            "guestSuccessStatus",
            order.order_status ||
            "Pending"
        );

        this.text(
            "guestSuccessPayment",
            order.payment_status ||
            "Pending"
        );

        this.text(
            "guestSuccessTotal",
            Store.money(
                order.grand_total ||
                0
            )
        );

        this.text(
            "guestSuccessCity",
            order.city ||
            "—"
        );

        const items =
            Array.isArray(order.items)
                ? order.items
                : [];

        const container =
            document.getElementById(
                "guestSuccessItems"
            );

        if (container) {
            container.innerHTML =
                items.map(item => {
                    const image =
                        item.image
                            ? (
                                /^https?:\/\//i.test(item.image)
                                    ? item.image
                                    : `${API.base}/${String(item.image).replace(/^\/+/, "")}`
                            )
                            : "";

                    return `
                        <article>
                            ${
                                image
                                    ? `<img src="${Components.e(image)}" alt="${Components.e(item.product_name || "Product")}">`
                                    : `<div><i class="fa-solid fa-spa"></i></div>`
                            }

                            <span>
                                <strong>${Components.e(item.product_name || "Product")}</strong>
                                <small>Quantity: ${Number(item.quantity || 0)}</small>
                            </span>

                            <b>${Store.money(item.subtotal || 0)}</b>
                        </article>
                    `;
                }).join("");
        }
    },

    async copy() {
        const value =
            this.order
                ?.order_number;

        if (!value) {
            return;
        }

        try {
            await navigator
                .clipboard
                .writeText(value);

            Store.toast(
                "Order number copied."
            );
        } catch {
            Store.toast(
                `Order number: ${value}`
            );
        }
    },

    fail(message) {
        document
            .getElementById(
                "guestSuccessLoading"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "guestSuccessError"
            )
            ?.classList.remove(
                "hidden"
            );

        this.text(
            "guestSuccessErrorText",
            message
        );
    },

    text(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value;
        }
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () =>
        GuestOrderSuccess.init()
);
