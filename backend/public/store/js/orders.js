"use strict";

const OrdersPage = {
    orders: [],
    reviewOrderId: null,
    eligibleProducts: [],

    async init() {
        await this.waitForStore();
        this.bind();

        if (!API.isAuthenticated()) {
            this.showAuth();
            return;
        }

        await this.loadOrders();
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
        document.getElementById("ordersSearch")
            .addEventListener("input", () => this.render());

        document.getElementById("ordersStatusFilter")
            .addEventListener("change", () => this.render());

        document.getElementById("ordersDateFilter")
            .addEventListener("change", () => this.render());

        document.getElementById("refreshOrdersButton")
            .addEventListener("click", event => this.refresh(event.currentTarget));

        document.getElementById("ordersList")
            .addEventListener("click", event => this.handleClick(event));

        document.getElementById("closeDeliveredReviewModal")
            ?.addEventListener("click", () => this.closeDeliveredReview());

        document.querySelector("[data-close-review-modal]")
            ?.addEventListener("click", () => this.closeDeliveredReview());

        document.getElementById("eligibleReviewProducts")
            ?.addEventListener("click", event => this.selectReviewProduct(event));

        document.getElementById("deliveredReviewImages")
            ?.addEventListener("change", event => this.previewReviewImages(event));

        document.getElementById("deliveredProductReviewForm")
            ?.addEventListener("submit", event => this.submitDeliveredReview(event));
    },

    showAuth() {
        this.hideStates();
        document.getElementById("ordersAuthState").classList.remove("hidden");
    },

    hideStates() {
        ["ordersAuthState","ordersLoading","ordersEmptyState","ordersWorkspace"]
            .forEach(id => document.getElementById(id)?.classList.add("hidden"));
    },

    async loadOrders() {
        this.hideStates();
        document.getElementById("ordersLoading").classList.remove("hidden");

        try {
            const data = await API.get("/api/orders");
            this.orders =
                Array.isArray(data.orders)
                    ? data.orders
                    : Array.isArray(
                        data.data?.orders
                    )
                        ? data.data.orders
                        : Array.isArray(
                            data.data
                        )
                            ? data.data
                            : [];

            if (!this.orders.length) {
                this.hideStates();
                document.getElementById("ordersEmptyState").classList.remove("hidden");
                return;
            }

            this.hideStates();
            document.getElementById("ordersWorkspace").classList.remove("hidden");
            this.render();

            // =============================================
            // Review Reminder Deep Link
            // Example:
            // /store/orders.html?review_order=19
            // =============================================

            const reviewOrderId =
                new URLSearchParams(
                    window.location.search
                ).get("review_order");

            if (reviewOrderId) {
                const reviewOrder =
                    this.orders.find(
                        order =>
                            String(order.id) ===
                            String(reviewOrderId)
                    );

                if (
                    reviewOrder &&
                    String(
                        reviewOrder.order_status || ""
                    ).toLowerCase() === "delivered"
                ) {
                    await this.openDeliveredReview(
                        reviewOrder.id,
                        reviewOrder.order_number ||
                            `#${reviewOrder.id}`
                    );
                }
            }
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                API.clearCustomerSession?.();
                this.showAuth();
                return;
            }

            Store.toast(error.message, "error");
            this.hideStates();
            document.getElementById("ordersEmptyState").classList.remove("hidden");
        }
    },

    async refresh(button) {
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing';

        try {
            await this.loadOrders();
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    filteredOrders() {
        const search = document.getElementById("ordersSearch").value.trim().toLowerCase();
        const status = document.getElementById("ordersStatusFilter").value;
        const days = Number(document.getElementById("ordersDateFilter").value || 0);

        return this.orders.filter(order => {
            const haystack = [
                order.order_number,
                order.city,
                order.tracking_number,
                order.payment_method,
                order.payment_status
            ].filter(Boolean).join(" ").toLowerCase();

            if (search && !haystack.includes(search)) return false;

            if (
                status &&
                String(order.order_status || "").toLowerCase() !== status
            ) return false;

            if (days) {
                const created = new Date(order.created_at).getTime();
                const cutoff = Date.now() - days * 86400000;
                if (!created || created < cutoff) return false;
            }

            return true;
        });
    },

    render() {
        const rows = this.filteredOrders();
        const list = document.getElementById("ordersList");

        const activeCount = this.orders.filter(order =>
            !["delivered","cancelled"].includes(
                String(order.order_status || "").toLowerCase()
            )
        ).length;

        const deliveredCount = this.orders.filter(order =>
            String(order.order_status || "").toLowerCase() === "delivered"
        ).length;

        const cancelledCount = this.orders.filter(order =>
            String(order.order_status || "").toLowerCase() === "cancelled"
        ).length;

        document.getElementById("ordersTotalCount").textContent = this.orders.length;
        document.getElementById("ordersActiveCount").textContent = activeCount;
        document.getElementById("ordersDeliveredCount").textContent = deliveredCount;
        document.getElementById("ordersCancelledCount").textContent = cancelledCount;

        document.getElementById("ordersResultsText").textContent =
            `${rows.length} order${rows.length === 1 ? "" : "s"} found`;

        if (!rows.length) {
            list.innerHTML = `
                <div class="orders-state">
                    <div class="orders-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
                    <h2>No matching orders</h2>
                    <p>Try changing your search or filters.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = rows.map(order => this.orderMarkup(order)).join("");
    },

    orderMarkup(order) {
        const status = String(order.order_status || "Pending");
        const payment = String(order.payment_status || "Pending");
        const canCancel =
            status.toLowerCase() === "pending" &&
            payment.toLowerCase() !== "paid";

        return `
            <article class="order-card" data-order-id="${Components.e(order.id)}">
                <div class="order-card-header">
                    <div class="order-card-meta">
                        <div>
                            <span>Order placed</span>
                            <strong>${this.date(order.created_at)}</strong>
                        </div>
                        <div>
                            <span>Total</span>
                            <strong>${Store.money(order.grand_total)}</strong>
                        </div>
                        <div>
                            <span>Order number</span>
                            <strong>${Components.e(order.order_number || `#${order.id}`)}</strong>
                        </div>
                    </div>

                    <div class="order-card-status">
                        <span class="order-badge status-${this.slug(status)}">${Components.e(status)}</span>
                        <span class="order-badge status-${this.slug(payment)}">${Components.e(payment)}</span>
                    </div>
                </div>

                <div class="order-card-body">
                    <div class="order-card-main">
                        <h3>${this.statusTitle(status)}</h3>
                        <p>${Number(order.total_quantity || 0)} item(s) in ${Number(order.item_count || 0)} product line(s)</p>
                        <p>${Components.e(order.shipping_address || "")}${order.city ? `, ${Components.e(order.city)}` : ""}</p>
                        ${order.tracking_number ? `<p><strong>Tracking:</strong> ${Components.e(order.tracking_number)}</p>` : ""}
                        ${order.estimated_delivery_date ? `<p><strong>Estimated delivery:</strong> ${this.date(order.estimated_delivery_date)}</p>` : ""}
                    </div>

                    <div>
                        <div class="order-card-total">${Store.money(order.grand_total)}</div>
                        <div class="order-card-actions">
                            <a class="btn primary" href="order-details.html?id=${encodeURIComponent(order.id)}">
                                View details
                            </a>

                            ${order.tracking_url ? `
                                <a class="btn secondary" href="${Components.e(order.tracking_url)}" target="_blank" rel="noopener">
                                    Track shipment
                                </a>
                            ` : ""}

                            ${status.toLowerCase() === "delivered" ? `
                                <button
                                    type="button"
                                    class="btn secondary delivered-review-button"
                                    data-review-order="${Components.e(order.id)}"
                                    data-review-order-number="${Components.e(order.order_number || `#${order.id}`)}"
                                >
                                    <i class="fa-solid fa-star"></i>
                                    Review products
                                </button>
                            ` : ""}

                            ${canCancel ? `
                                <button type="button" class="btn order-danger-button" data-cancel-order="${Components.e(order.id)}">
                                    Cancel
                                </button>
                            ` : ""}
                        </div>
                    </div>
                </div>
            </article>
        `;
    },

    async handleClick(event) {
        const reviewButton =
            event.target.closest(
                "[data-review-order]"
            );

        if (reviewButton) {
            await this.openDeliveredReview(
                reviewButton.dataset.reviewOrder,
                reviewButton.dataset.reviewOrderNumber
            );

            return;
        }

        const button =
            event.target.closest(
                "[data-cancel-order]"
            );

        if (!button) return;

        const id = button.dataset.cancelOrder;

        if (!confirm("Cancel this pending order? Product stock will be restored.")) {
            return;
        }

        button.disabled = true;

        try {
            await API.put(`/api/orders/${encodeURIComponent(id)}/cancel`, {});
            Store.toast("Order cancelled successfully.");
            await this.loadOrders();
        } catch (error) {
            Store.toast(error.message, "error");
            button.disabled = false;
        }
    },


    async openDeliveredReview(
        orderId,
        orderNumber
    ) {
        this.reviewOrderId =
            Number(orderId);

        document.getElementById(
            "deliveredReviewOrderLabel"
        ).textContent =
            `${orderNumber || `Order #${orderId}`} · Delivered products`;

        document.getElementById(
            "eligibleReviewProducts"
        ).innerHTML = `
            <div class="delivered-review-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                Loading delivered products...
            </div>
        `;

        document.getElementById(
            "deliveredProductReviewForm"
        ).classList.add("hidden");

        const modal =
            document.getElementById(
                "deliveredReviewModal"
            );

        modal.classList.remove(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        try {
            const data =
                await API.get(
                    `/api/reviews/eligible-products?order_id=${encodeURIComponent(orderId)}`
                );

            this.eligibleProducts =
                Array.isArray(data.products)
                    ? data.products
                    : [];

            this.renderEligibleProducts();
        } catch (error) {
            document.getElementById(
                "eligibleReviewProducts"
            ).innerHTML = `
                <div class="delivered-review-empty error">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <strong>Unable to load delivered products</strong>
                    <p>${Components.e(error.message)}</p>
                </div>
            `;
        }
    },

    closeDeliveredReview() {
        const modal =
            document.getElementById(
                "deliveredReviewModal"
            );

        modal.classList.add(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        this.reviewOrderId = null;
        this.eligibleProducts = [];

        document.getElementById(
            "deliveredProductReviewForm"
        )?.reset();

        document.getElementById(
            "deliveredReviewPreview"
        ).innerHTML = "";
    },

    renderEligibleProducts() {
        const container =
            document.getElementById(
                "eligibleReviewProducts"
            );

        if (!this.eligibleProducts.length) {
            container.innerHTML = `
                <div class="delivered-review-empty">
                    <i class="fa-regular fa-star"></i>
                    <strong>No delivered products found</strong>
                    <p>This order has no products currently eligible for a review.</p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            this.eligibleProducts.map(
                product => {
                    const productId =
                        Number(product.product_id);

                    const safeProductId =
                        encodeURIComponent(productId);

                    const productName =
                        Components.e(
                            product.product_name ||
                            `Product #${productId}`
                        );

                    const orderNumber =
                        product.latest_order_number
                            ? Components.e(
                                product.latest_order_number
                            )
                            : "Delivered order";

                    const reviewAction =
                        product.can_review
                            ? `
                                <button
                                    type="button"
                                    class="btn secondary eligible-review-action"
                                    data-select-review-product="${Components.e(productId)}"
                                >
                                    <i class="fa-regular fa-star"></i>
                                    Write review
                                </button>
                            `
                            : `
                                <span class="eligible-reviewed-status">
                                    <i class="fa-solid fa-circle-check"></i>
                                    Reviewed · ${Components.e(
                                        product.review_status ||
                                        "Submitted"
                                    )}
                                </span>
                            `;

                    return `
                        <article
                            class="eligible-product-card ${
                                product.can_review
                                    ? ""
                                    : "reviewed"
                            }"
                        >
                            <div class="eligible-product-main">

                                <span class="eligible-product-icon">
                                    <i class="fa-solid ${
                                        product.can_review
                                            ? "fa-box-open"
                                            : "fa-circle-check"
                                    }"></i>
                                </span>

                                <span class="eligible-product-copy">
                                    <strong>
                                        ${productName}
                                    </strong>

                                    <small>
                                        Qty ${Number(
                                            product.delivered_quantity ||
                                            0
                                        )}
                                        · ${orderNumber}
                                    </small>
                                </span>

                            </div>

                            <div class="eligible-product-actions">

                                <a
                                    class="btn primary eligible-view-product"
                                    href="product.html?id=${safeProductId}"
                                >
                                    <i class="fa-solid fa-eye"></i>
                                    View product
                                </a>

                                ${reviewAction}

                            </div>
                        </article>
                    `;
                }
            ).join("");
    },

    selectReviewProduct(event) {
        const button =
            event.target.closest(
                "[data-select-review-product]"
            );

        if (!button) return;

        const productId =
            Number(
                button.dataset
                    .selectReviewProduct
            );

        const product =
            this.eligibleProducts.find(
                item =>
                    Number(item.product_id) ===
                    productId
            );

        if (
            !product ||
            !product.can_review
        ) {
            return;
        }

        document.getElementById(
            "deliveredReviewProductId"
        ).value =
            String(productId);

        document.getElementById(
            "deliveredReviewProductName"
        ).textContent =
            product.product_name ||
            `Product #${productId}`;

        document.getElementById(
            "deliveredProductReviewForm"
        ).classList.remove(
            "hidden"
        );

        document.getElementById(
            "deliveredReviewComment"
        ).focus();
    },

    previewReviewImages(event) {
        const files =
            Array.from(
                event.target.files || []
            );

        const preview =
            document.getElementById(
                "deliveredReviewPreview"
            );

        preview.innerHTML = "";

        if (files.length > 5) {
            event.target.value = "";

            this.reviewMessage(
                "Upload no more than five pictures.",
                "error"
            );

            return;
        }

        const invalid =
            files.find(
                file =>
                    ![
                        "image/jpeg",
                        "image/png",
                        "image/webp"
                    ].includes(file.type) ||
                    file.size >
                        5 * 1024 * 1024
            );

        if (invalid) {
            event.target.value = "";

            this.reviewMessage(
                "Each picture must be JPG, PNG or WEBP and no larger than 5 MB.",
                "error"
            );

            return;
        }

        files.forEach(file => {
            const image =
                document.createElement(
                    "img"
                );

            image.src =
                URL.createObjectURL(
                    file
                );

            image.alt =
                file.name;

            image.onload =
                () =>
                    URL.revokeObjectURL(
                        image.src
                    );

            preview.appendChild(
                image
            );
        });
    },

    reviewMessage(
        message,
        type = ""
    ) {
        const element =
            document.getElementById(
                "deliveredReviewMessage"
            );

        element.textContent =
            message || "";

        element.className =
            `delivered-review-message ${type}`
                .trim();
    },

    async submitDeliveredReview(
        event
    ) {
        event.preventDefault();

        const productId =
            Number(
                document.getElementById(
                    "deliveredReviewProductId"
                ).value
            );

        const rating =
            Number(
                document.getElementById(
                    "deliveredReviewRating"
                ).value
            );

        const comment =
            document.getElementById(
                "deliveredReviewComment"
            )
                .value
                .trim();

        const files =
            Array.from(
                document.getElementById(
                    "deliveredReviewImages"
                ).files || []
            );

        if (!productId) {
            this.reviewMessage(
                "Select a delivered product.",
                "error"
            );

            return;
        }

        if (
            rating < 1 ||
            rating > 5
        ) {
            this.reviewMessage(
                "Choose a rating from 1 to 5.",
                "error"
            );

            return;
        }

        if (comment.length < 5) {
            this.reviewMessage(
                "Write at least five characters about the product.",
                "error"
            );

            return;
        }

        const formData =
            new FormData();

        formData.append(
            "product_id",
            String(productId)
        );

        formData.append(
            "rating",
            String(rating)
        );

        formData.append(
            "comment",
            comment
        );

        files.forEach(file => {
            formData.append(
                "review_images",
                file
            );
        });

        const button =
            document.getElementById(
                "submitDeliveredReviewButton"
            );

        const original =
            button.innerHTML;

        button.disabled = true;
        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Submitting...
        `;

        this.reviewMessage("");

        try {
            const data =
                await API.upload(
                    "/api/reviews",
                    formData
                );

            this.reviewMessage(
                data.message ||
                "Review submitted successfully.",
                "success"
            );

            Store.toast(
                data.message ||
                "Review submitted successfully."
            );

            document.getElementById(
                "deliveredProductReviewForm"
            ).reset();

            document.getElementById(
                "deliveredProductReviewForm"
            ).classList.add(
                "hidden"
            );

            document.getElementById(
                "deliveredReviewPreview"
            ).innerHTML = "";

            const refreshed =
                await API.get(
                    `/api/reviews/eligible-products?order_id=${encodeURIComponent(this.reviewOrderId)}`
                );

            this.eligibleProducts =
                refreshed.products || [];

            this.renderEligibleProducts();
        } catch (error) {
            this.reviewMessage(
                error.message ||
                "Unable to submit review.",
                "error"
            );
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    statusTitle(status) {
        const key = String(status || "").toLowerCase();

        const map = {
            pending: "Order received",
            confirmed: "Order confirmed",
            processing: "Preparing your order",
            packed: "Your order is packed",
            "ready for pickup": "Ready for courier pickup",
            "handed to courier": "Handed to courier",
            "in transit": "Your order is in transit",
            "out for delivery": "Out for delivery",
            delivered: "Order delivered",
            cancelled: "Order cancelled"
        };

        return map[key] || status;
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

    slug(value) {
        return String(value || "pending")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-");
    }
};

document.addEventListener("DOMContentLoaded", () => OrdersPage.init());
