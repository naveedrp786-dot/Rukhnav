"use strict";


/* RUKHNAV native-app invoice presentation */
if (
    window.ReactNativeWebView &&
    typeof window.ReactNativeWebView.postMessage === "function"
) {
    document.documentElement.classList.add("rukhnav-native-app");
}


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
            .addEventListener(
                "click",
                () => this.printOrder()
            );

        document.getElementById("cancelOrderButton")
            .addEventListener("click", () => this.cancelOrder());

        document.getElementById("copyTrackingButton")
            .addEventListener("click", () => this.copyTracking());

        document.getElementById("reorderButton")
            .addEventListener("click", () => this.reorder());
    },

    printOrder() {
        if (
            window.ReactNativeWebView &&
            typeof window.ReactNativeWebView.postMessage === "function"
        ) {
            const source =
                document.getElementById("orderDetailsContent");

            if (!source) {
                window.print();
                return;
            }

            const printable =
                source.cloneNode(true);

            printable
                .querySelectorAll(
                    "button, .order-detail-backlinks"
                )
                .forEach(element => {
                    element.remove();
                });

            const html = `
                <!doctype html>
                <html>
                <head>
                    <meta charset="utf-8">

                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1"
                    >

                    <style>
                        @page {
                            size: A4 portrait;
                            margin: 9mm;
                        }

                        * {
                            box-sizing: border-box;
                        }

                        html,
                        body {
                            margin: 0;
                            padding: 0;
                            width: 100%;
                            background: #ffffff;
                            color: #26352d;
                            font-family:
                                Arial,
                                Helvetica,
                                sans-serif;
                            font-size: 10px;
                            line-height: 1.4;
                        }

                        #orderDetailsContent {
                            display: block !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        .hidden {
                            display: none !important;
                        }

                        .order-invoice-brand {
                            width: 100%;
                            margin: 0 0 10px;
                            padding: 11px 13px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 14px;
                            border-radius: 8px;
                            background: #173f2b;
                            color: #ffffff;
                            page-break-inside: avoid;
                        }

                        .order-invoice-brand-identity {
                            min-width: 0;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }

                        .order-invoice-logo {
                            display: block;
                            width: auto;
                            height: 38px;
                            max-width: 100px;
                            max-height: 38px;
                            object-fit: contain;
                        }

                        #orderInvoiceBrandName {
                            display: block;
                            color: #ffffff;
                            font-size: 18px;
                            font-weight: 800;
                            line-height: 1.1;
                            letter-spacing: 1px;
                        }

                        #orderInvoiceTagline {
                            display: block;
                            margin-top: 3px;
                            color: #e9dfc7;
                            font-size: 8px;
                        }

                        .order-invoice-document {
                            flex: 0 0 auto;
                            text-align: right;
                        }

                        .order-invoice-document strong {
                            display: block;
                            color: #d7b66d;
                            font-size: 11px;
                            letter-spacing: .8px;
                        }

                        .order-invoice-document span {
                            display: block;
                            margin-top: 2px;
                            color: #f3ecdc;
                            font-size: 8px;
                        }

                        .order-details-header {
                            margin: 0 0 9px;
                            padding: 10px 12px;
                            border: 1px solid #d8ddd8;
                            border-radius: 7px;
                            background: #ffffff;
                            page-break-inside: avoid;
                        }

                        .order-details-header > div:first-child > span {
                            display: block;
                            color: #b8892f;
                            font-size: 8px;
                            font-weight: 800;
                            letter-spacing: 1px;
                            text-transform: uppercase;
                        }

                        .order-details-header h1 {
                            margin: 3px 0;
                            color: #173f2b;
                            font-size: 20px;
                            line-height: 1.15;
                            word-break: normal;
                            overflow-wrap: break-word;
                        }

                        .order-details-header p {
                            margin: 0;
                            color: #687168;
                            font-size: 9px;
                        }

                        .order-details-actions,
                        .order-detail-backlinks {
                            display: none !important;
                        }

                        .order-status-hero {
                            margin: 0 0 9px;
                            padding: 11px 13px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 15px;
                            border-radius: 7px;
                            background: #173f2b;
                            color: #ffffff;
                            page-break-inside: avoid;
                        }

                        .order-status-hero span {
                            color: #d7b66d;
                            font-size: 8px;
                            font-weight: 800;
                            text-transform: uppercase;
                        }

                        .order-status-hero h2 {
                            margin: 3px 0;
                            color: #ffffff;
                            font-size: 20px;
                            line-height: 1.1;
                        }

                        .order-status-hero p {
                            margin: 0;
                            color: #edf1ed;
                            font-size: 8px;
                        }

                        .order-status-badges {
                            display: flex;
                            justify-content: flex-end;
                            gap: 5px;
                            flex-wrap: wrap;
                        }

                        .order-badge {
                            display: inline-block;
                            padding: 4px 7px;
                            border-radius: 999px;
                            background: #ffffff;
                            color: #173f2b !important;
                            font-size: 7px;
                            font-weight: 800;
                            white-space: nowrap;
                        }

                        .order-timeline-card,
                        .tracking-card,
                        .order-items-card,
                        .order-summary-card,
                        .shipping-card {
                            border: 1px solid #d8ddd8;
                            border-radius: 7px;
                            background: #ffffff;
                            page-break-inside: avoid;
                        }

                        .order-timeline-card {
                            margin: 0 0 9px;
                            padding: 10px 12px;
                        }

                        .order-card-heading span {
                            color: #b8892f;
                            font-size: 8px;
                            font-weight: 800;
                            text-transform: uppercase;
                        }

                        .order-card-heading h2 {
                            margin: 2px 0 0;
                            color: #173f2b;
                            font-size: 16px;
                        }

                        .order-timeline {
                            margin-top: 9px;
                            display: grid;
                            grid-template-columns: repeat(4, minmax(0, 1fr));
                            gap: 6px;
                        }

                        .timeline-step {
                            min-width: 0;
                            padding: 7px;
                            border: 1px solid #e4e7e3;
                            border-radius: 5px;
                            text-align: center;
                        }

                        .timeline-dot {
                            display: block;
                            width: 7px;
                            height: 7px;
                            margin: 0 auto 4px;
                            border-radius: 50%;
                            background: #c9cfca;
                        }

                        .timeline-step.complete .timeline-dot,
                        .timeline-step.active .timeline-dot {
                            background: #173f2b;
                        }

                        .timeline-step.cancelled .timeline-dot {
                            background: #a52a23;
                        }

                        .timeline-step strong {
                            display: block;
                            font-size: 8px;
                            word-break: normal;
                        }

                        .timeline-step > span:last-child {
                            display: block;
                            margin-top: 2px;
                            color: #737a73;
                            font-size: 7px;
                        }

                        .tracking-card {
                            margin: 0 0 9px;
                            padding: 9px 12px;
                        }

                        .tracking-card h2 {
                            margin: 2px 0;
                            font-size: 13px;
                        }

                        .tracking-card p {
                            margin: 0;
                            color: #697169;
                            font-size: 8px;
                        }

                        .tracking-actions {
                            display: none !important;
                        }

                        .order-details-grid {
                            width: 100%;
                            margin: 0;
                            padding: 0;
                            display: grid;
                            grid-template-columns:
                                minmax(0, 1.55fr)
                                minmax(210px, .75fr);
                            gap: 9px;
                            align-items: start;
                        }

                        .order-items-card {
                            overflow: hidden;
                        }

                        .order-items-card .order-card-heading {
                            padding: 9px 11px;
                            border-bottom: 1px solid #e3e6e2;
                            background: #f8f7f2;
                        }

                        .order-items-list {
                            display: block;
                        }

                        .order-detail-item {
                            width: 100%;
                            padding: 9px 11px;
                            display: grid;
                            grid-template-columns:
                                52px
                                minmax(0,1fr)
                                78px;
                            gap: 9px;
                            align-items: center;
                            border-bottom: 1px solid #e7e9e6;
                            page-break-inside: avoid;
                        }

                        .order-detail-item:last-child {
                            border-bottom: 0;
                        }

                        .order-detail-item-image {
                            width: 52px;
                            height: 52px;
                            overflow: hidden;
                            border-radius: 5px;
                            background: #f2efe7;
                        }

                        .order-detail-item-image img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                        }

                        .order-detail-placeholder {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }

                        .order-detail-item h3 {
                            margin: 0 0 3px;
                            color: #26352d;
                            font-size: 10px;
                            line-height: 1.25;
                            word-break: normal;
                            overflow-wrap: break-word;
                        }

                        .order-detail-item p {
                            margin: 2px 0;
                            color: #6f766f;
                            font-size: 8px;
                            word-break: normal;
                        }

                        .order-detail-item-total {
                            min-width: 0;
                            text-align: right;
                        }

                        .order-detail-item-total strong {
                            display: block;
                            color: #173f2b;
                            font-size: 10px;
                            white-space: nowrap;
                        }

                        .order-detail-item-total span {
                            display: block;
                            margin-top: 2px;
                            color: #737973;
                            font-size: 7px;
                        }

                        .order-sidebar {
                            min-width: 0;
                            display: grid;
                            gap: 9px;
                        }

                        .order-summary-card,
                        .shipping-card {
                            padding: 10px 11px;
                        }

                        .order-summary-card > span,
                        .shipping-card > span {
                            color: #b8892f;
                            font-size: 8px;
                            font-weight: 800;
                            text-transform: uppercase;
                        }

                        .order-summary-card h2,
                        .shipping-card h2 {
                            margin: 2px 0 8px;
                            color: #173f2b;
                            font-size: 15px;
                        }

                        .order-summary-lines,
                        .order-summary-meta {
                            display: grid;
                            gap: 5px;
                        }

                        .order-summary-lines > div,
                        .order-summary-meta > div,
                        .order-summary-total {
                            min-width: 0;
                            display: flex;
                            align-items: flex-start;
                            justify-content: space-between;
                            gap: 8px;
                        }

                        .order-summary-lines span,
                        .order-summary-meta span {
                            min-width: 0;
                            color: #727972;
                            font-size: 7px;
                            word-break: normal;
                        }

                        .order-summary-lines strong,
                        .order-summary-meta strong {
                            min-width: 65px;
                            max-width: 120px;
                            color: #26352d;
                            font-size: 7px;
                            text-align: right;
                            word-break: normal;
                            overflow-wrap: break-word;
                        }

                        .order-summary-total {
                            margin: 8px 0;
                            padding: 8px 0;
                            border-top: 2px solid #173f2b;
                            border-bottom: 2px solid #173f2b;
                        }

                        .order-summary-total span {
                            font-weight: 800;
                        }

                        .order-summary-total strong {
                            color: #173f2b;
                            font-size: 14px;
                            white-space: nowrap;
                        }

                        .shipping-card p {
                            margin: 3px 0;
                            color: #687068;
                            font-size: 7px;
                            line-height: 1.4;
                            word-break: normal;
                            overflow-wrap: break-word;
                        }

                        .reorder-button {
                            display: none !important;
                        }

                        img {
                            max-width: 100%;
                        }
                    </style>
                </head>

                <body>
                    ${printable.outerHTML}
                </body>
                </html>
            `;

            window.ReactNativeWebView.postMessage(
                JSON.stringify({
                    type: "RUKHNAV_PRINT_ORDER",
                    html
                })
            );

            return;
        }

        window.print();
    },

    renderInvoiceBrand() {
        const branding =
            Store.settings?.branding || {};

        const name =
            branding.brand_name ||
            "RUKHNAV";

        const tagline =
            branding.tagline ||
            "";

        const logoUrl =
            branding.logo_url &&
            typeof Theme !== "undefined" &&
            typeof Theme.asset === "function"
                ? Theme.asset(
                    branding.logo_url
                )
                : branding.logo_url || "";

        const nameElement =
            document.getElementById(
                "orderInvoiceBrandName"
            );

        const taglineElement =
            document.getElementById(
                "orderInvoiceTagline"
            );

        const logoElement =
            document.getElementById(
                "orderInvoiceLogo"
            );

        if (nameElement) {
            nameElement.textContent = name;
        }

        if (taglineElement) {
            taglineElement.textContent =
                tagline;

            taglineElement.classList.toggle(
                "hidden",
                !tagline
            );
        }

        if (logoElement) {
            if (logoUrl) {
                logoElement.src = logoUrl;
                logoElement.alt =
                    `${name} logo`;

                logoElement.classList.remove(
                    "hidden"
                );
            } else {
                logoElement.removeAttribute(
                    "src"
                );

                logoElement.alt = "";

                logoElement.classList.add(
                    "hidden"
                );
            }
        }
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

            this.renderInvoiceBrand();

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

        const loyaltyDiscount =
            Number(
                order.loyalty_discount_amount ||
                0
            );

        const loyaltyPercentage =
            Number(
                order.loyalty_discount_percentage ||
                0
            );

        const membershipLevel =
            order.loyalty_membership_level ||
            "";

        const memberLabel =
            document.getElementById(
                "detailsMemberDiscountLabel"
            );

        if (memberLabel) {
            const membershipText =
                membershipLevel
                    ? `${membershipLevel} `
                    : "";

            const percentageText =
                loyaltyPercentage > 0
                    ? ` (${loyaltyPercentage}%)`
                    : "";

            memberLabel.textContent =
                `${membershipText}member discount${percentageText}`;
        }

        document.getElementById(
            "detailsMemberDiscount"
        ).textContent =
            Store.money(loyaltyDiscount);

        const rewardPoints =
            Number(
                order.reward_points_redeemed ||
                0
            );

        document.getElementById(
            "detailsRewardPoints"
        ).textContent =
            `${rewardPoints.toLocaleString()} point${rewardPoints === 1 ? "" : "s"}`;

        document.getElementById(
            "detailsRewardDiscount"
        ).textContent =
            Store.money(
                order.reward_points_discount_amount ||
                0
            );

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
