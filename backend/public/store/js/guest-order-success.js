"use strict";

const GuestOrderSuccess = {
    order: null,
    token: "",

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

        this.token = token;

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
            this.setupReturnUI();

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

    setupReturnUI() {
        const order = this.order || {};
        const button =
            document.getElementById(
                "guestRequestReturnButton"
            );

        if (
            String(order.order_status || "")
                .toLowerCase() !==
            "delivered"
        ) {
            return;
        }

        button?.classList.remove(
            "hidden"
        );

        button?.addEventListener(
            "click",
            () =>
                this.openReturnPanel()
        );

        document
            .getElementById(
                "closeGuestReturnButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.closeReturnPanel()
            );

        document
            .getElementById(
                "guestReturnForm"
            )
            ?.addEventListener(
                "submit",
                event =>
                    this.submitReturn(
                        event
                    )
            );
    },

    openReturnPanel() {
        const panel =
            document.getElementById(
                "guestReturnPanel"
            );

        const container =
            document.getElementById(
                "guestReturnItems"
            );

        const items =
            Array.isArray(
                this.order?.items
            )
                ? this.order.items
                : [];

        if (container) {
            container.innerHTML =
                items.map(
                    item => `
                        <label class="guest-return-item">
                            <input
                                type="checkbox"
                                class="guest-return-select"
                                data-order-item-id="${Number(item.order_item_id || 0)}"
                            >

                            <span class="guest-return-item-main">
                                <strong>${Components.e(item.product_name || "Product")}</strong>
                                <small>
                                    Purchased:
                                    ${Number(item.quantity || 0)}
                                    ·
                                    ${Store.money(item.price || 0)}
                                </small>
                            </span>

                            <select
                                class="guest-return-quantity"
                                data-order-item-id="${Number(item.order_item_id || 0)}"
                            >
                                ${
                                    Array.from(
                                        {
                                            length:
                                                Number(item.quantity || 0)
                                        },
                                        (_, index) =>
                                            `<option value="${index + 1}">${index + 1}</option>`
                                    ).join("")
                                }
                            </select>
                        </label>
                    `
                ).join("");
        }

        panel?.classList.remove(
            "hidden"
        );

        panel?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    },

    closeReturnPanel() {
        document
            .getElementById(
                "guestReturnPanel"
            )
            ?.classList.add(
                "hidden"
            );
    },

    returnMessage(
        message,
        type = "info"
    ) {
        const box =
            document.getElementById(
                "guestReturnMessage"
            );

        if (!box) return;

        box.textContent =
            message;

        box.className =
            `guest-checkout-message show ${type}`;
    },

    async submitReturn(event) {
        event.preventDefault();

        const selected =
            [
                ...document.querySelectorAll(
                    ".guest-return-select:checked"
                )
            ];

        if (!selected.length) {
            this.returnMessage(
                "Select at least one product to return.",
                "error"
            );
            return;
        }

        const reason =
            document.getElementById(
                "guestReturnReason"
            )?.value || "";

        if (!reason) {
            this.returnMessage(
                "Select a return reason.",
                "error"
            );
            return;
        }

        const items =
            selected.map(
                checkbox => {
                    const orderItemId =
                        Number(
                            checkbox.dataset.orderItemId
                        );

                    const quantity =
                        Number(
                            document.querySelector(
                                `.guest-return-quantity[data-order-item-id="${orderItemId}"]`
                            )?.value || 1
                        );

                    return {
                        order_item_id:
                            orderItemId,
                        quantity
                    };
                }
            );

        const button =
            document.getElementById(
                "submitGuestReturnButton"
            );

        if (button) {
            button.disabled =
                true;

            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        }

        try {
            const response =
                await fetch(
                    `${API.base}/api/returns/guest`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                order_number:
                                    this.order.order_number,

                                guest_token:
                                    this.token,

                                reason,

                                customer_notes:
                                    document
                                        .getElementById(
                                            "guestReturnNotes"
                                        )
                                        ?.value
                                        ?.trim() ||
                                    null,

                                items
                            })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Unable to submit return request."
                );
            }

            this.returnMessage(
                `Return request ${data.return_request?.return_number || ""} submitted successfully.`,
                "info"
            );

            document
                .getElementById(
                    "guestReturnForm"
                )
                ?.querySelectorAll(
                    "input, select, textarea, button"
                )
                .forEach(
                    element =>
                        element.disabled =
                            true
                );

            document
                .getElementById(
                    "guestRequestReturnButton"
                )
                ?.classList.add(
                    "hidden"
                );

        } catch (error) {

            this.returnMessage(
                error.message ||
                "Unable to submit return request.",
                "error"
            );

            if (button) {
                button.disabled =
                    false;

                button.innerHTML =
                    '<i class="fa-solid fa-paper-plane"></i> Submit Return Request';
            }
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
