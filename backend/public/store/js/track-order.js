"use strict";

document.addEventListener("DOMContentLoaded", () => {

    const form =
        document.getElementById("trackingForm");

    const message =
        document.getElementById("trackingMessage");

    const result =
        document.getElementById("trackingResult");

    const submit =
        document.getElementById("trackingSubmit");


    const escapeHtml = value =>
        String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");


    const money = value =>
        `Rs. ${Number(value || 0).toLocaleString(
            "en-PK",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        )}`;


    const date = value => {
        if (!value) return "—";

        const parsed =
            new Date(value);

        if (Number.isNaN(parsed.getTime())) {
            return "—";
        }

        return parsed.toLocaleDateString(
            "en-PK",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
    };


    const imageUrl = value => {
        if (!value) return "";

        const clean =
            String(value).trim();

        if (/^https?:\/\//i.test(clean)) {
            return clean;
        }

        if (clean.startsWith("/")) {
            return `${API.base}${clean}`;
        }

        return `${API.base}/uploads/products/${clean}`;
    };


    const statusIndex = status => {
        const clean =
            String(status || "")
                .toLowerCase();

        if (clean.includes("deliver")) return 4;
        if (clean.includes("ship")) return 3;
        if (
            clean.includes("process") ||
            clean.includes("pack")
        ) return 2;

        if (
            clean.includes("confirm") ||
            clean.includes("accept")
        ) return 1;

        return 0;
    };


    const timeline = order => {

        const cancelled =
            String(order.order_status || "")
                .toLowerCase()
                .includes("cancel");

        if (cancelled) {
            return `
                <div class="tracking-cancelled">
                    <i class="fa-solid fa-circle-xmark"></i>
                    <div>
                        <strong>Order cancelled</strong>
                        <span>
                            ${order.cancelled_at
                                ? `Cancelled ${date(order.cancelled_at)}`
                                : "This order has been cancelled."}
                        </span>
                    </div>
                </div>
            `;
        }

        const current =
            statusIndex(order.order_status);

        const stages = [
            ["Order Placed", "fa-bag-shopping"],
            ["Confirmed", "fa-circle-check"],
            ["Processing", "fa-box"],
            ["Shipped", "fa-truck-fast"],
            ["Delivered", "fa-house-circle-check"]
        ];

        return `
            <div class="tracking-timeline">
                ${stages.map((stage, index) => `
                    <div class="tracking-step ${
                        index <= current ? "complete" : ""
                    }">
                        <span>
                            <i class="fa-solid ${stage[1]}"></i>
                        </span>

                        <strong>${stage[0]}</strong>
                    </div>
                `).join("")}
            </div>
        `;
    };


    const render = payload => {

        const order =
            payload.order || {};

        const items =
            Array.isArray(payload.items)
                ? payload.items
                : [];

        const trackingLink =
            order.tracking_url
                ? `
                    <a
                        class="courier-link"
                        href="${escapeHtml(order.tracking_url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Track with courier
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                `
                : "";


        result.innerHTML = `
            <div class="tracking-result-header">

                <div>
                    <span>ORDER VERIFIED</span>
                    <h2>
                        ${escapeHtml(order.order_number)}
                    </h2>

                    <p>
                        Placed ${date(order.created_at)}
                    </p>
                </div>

                <div class="tracking-status-badge">
                    ${escapeHtml(
                        order.order_status ||
                        "Order Placed"
                    )}
                </div>

            </div>


            ${timeline(order)}


            <div class="tracking-information-grid">

                <article>
                    <span>Payment</span>

                    <strong>
                        ${escapeHtml(
                            order.payment_status ||
                            "Pending"
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            String(
                                order.payment_method ||
                                ""
                            )
                            .replaceAll("_", " ")
                        )}
                    </small>
                </article>


                <article>
                    <span>Order Total</span>

                    <strong>
                        ${money(order.grand_total)}
                    </strong>

                    <small>
                        Delivery:
                        ${money(order.delivery_charges)}
                    </small>
                </article>


                <article>
                    <span>Estimated Delivery</span>

                    <strong>
                        ${date(
                            order.estimated_delivery_date
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(order.city || "")}
                    </small>
                </article>


                <article>
                    <span>Tracking Number</span>

                    <strong>
                        ${escapeHtml(
                            order.tracking_number ||
                            "Not assigned yet"
                        )}
                    </strong>

                    ${trackingLink}
                </article>

            </div>


            <div class="tracking-products">

                <div class="tracking-products-heading">
                    <span>ORDER SUMMARY</span>
                    <h3>Products</h3>
                </div>

                ${
                    items.length
                        ? items.map(item => {

                            const src =
                                imageUrl(item.image);

                            return `
                                <article class="tracking-product">

                                    ${
                                        src
                                            ? `
                                                <img
                                                    src="${escapeHtml(src)}"
                                                    alt="${escapeHtml(item.product_name || "Product")}"
                                                >
                                            `
                                            : `
                                                <div class="tracking-product-placeholder">
                                                    <i class="fa-solid fa-leaf"></i>
                                                </div>
                                            `
                                    }

                                    <div>
                                        <strong>
                                            ${escapeHtml(
                                                item.product_name ||
                                                "RUKHNAV Product"
                                            )}
                                        </strong>

                                        <span>
                                            Qty ${Number(item.quantity || 0)}
                                        </span>
                                    </div>

                                    <b>
                                        ${money(item.subtotal)}
                                    </b>

                                </article>
                            `;
                        }).join("")
                        : `
                            <p class="tracking-no-items">
                                Order item details are unavailable.
                            </p>
                        `
                }

            </div>


            <div class="tracking-result-actions">

                <a href="products.html">
                    <i class="fa-solid fa-arrow-left"></i>
                    Continue Shopping
                </a>

                <a href="contact.html">
                    Need help?
                </a>

            </div>
        `;

        result.classList.remove("hidden");
    };


    form.addEventListener("submit", async event => {

        event.preventDefault();

        const orderNumber =
            document
                .getElementById("trackingOrderNumber")
                .value
                .trim();

        const identifier =
            document
                .getElementById("trackingIdentifier")
                .value
                .trim();

        message.classList.add("hidden");
        result.classList.add("hidden");

        submit.disabled = true;
        submit.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Checking order';

        try {

            const payload =
                await API.request(
                    "/api/orders/public-track",
                    {
                        method: "POST",
                        body: {
                            order_number:
                                orderNumber,

                            identifier
                        }
                    }
                );

            render(payload);

        } catch (error) {

            message.textContent =
                error.message ||
                "Unable to verify this order.";

            message.classList.remove("hidden");

        } finally {

            submit.disabled = false;

            submit.innerHTML =
                '<i class="fa-solid fa-magnifying-glass"></i> Track Order';
        }
    });

});
