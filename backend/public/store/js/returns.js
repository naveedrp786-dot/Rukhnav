"use strict";

const ReturnsPage = {

    order: null,
    items: [],
    mode: null,
    guestToken: "",
    returnAccessToken: "",
    selectedFiles: [],


    async init() {

        await this.waitForStore();

        this.bind();

        const params =
            new URLSearchParams(
                location.search
            );

        const orderNumber =
            String(
                params.get("order") || ""
            ).trim();

        if (orderNumber) {

            document
                .getElementById(
                    "returnOrderNumber"
                )
                .value =
                    orderNumber;

            await this.findOrder(
                orderNumber,
                ""
            );
        }
    },


    waitForStore() {

        if (
            window.Store &&
            window.API
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

        document
            .getElementById(
                "returnLookupForm"
            )
            ?.addEventListener(
                "submit",
                event =>
                    this.lookup(
                        event
                    )
            );


        document
            .getElementById(
                "returnRequestForm"
            )
            ?.addEventListener(
                "submit",
                event =>
                    this.submitReturn(
                        event
                    )
            );


        document
            .getElementById(
                "returnItemsList"
            )
            ?.addEventListener(
                "change",
                event =>
                    this.handleItemChange(
                        event
                    )
            );


        document
            .getElementById(
                "returnMedia"
            )
            ?.addEventListener(
                "change",
                event =>
                    this.handleMedia(
                        event
                    )
            );


        document
            .getElementById(
                "newReturnButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.reset()
            );


        const dropzone =
            document.getElementById(
                "returnMediaDropzone"
            );

        dropzone
            ?.addEventListener(
                "dragover",
                event => {
                    event.preventDefault();
                    dropzone.classList.add(
                        "dragging"
                    );
                }
            );

        dropzone
            ?.addEventListener(
                "dragleave",
                () =>
                    dropzone.classList.remove(
                        "dragging"
                    )
            );

        dropzone
            ?.addEventListener(
                "drop",
                event => {
                    event.preventDefault();

                    dropzone.classList.remove(
                        "dragging"
                    );

                    if (
                        event.dataTransfer?.files
                    ) {
                        this.setFiles(
                            [
                                ...event
                                    .dataTransfer
                                    .files
                            ]
                        );
                    }
                }
            );
    },


    async lookup(event) {

        event.preventDefault();

        const orderNumber =
            String(
                document
                    .getElementById(
                        "returnOrderNumber"
                    )
                    ?.value || ""
            )
                .trim();

        if (!orderNumber) {
            this.lookupMessage(
                "Enter your order number.",
                "error"
            );
            return;
        }

        const identifier =
            String(
                document
                    .getElementById(
                        "returnIdentifier"
                    )
                    ?.value || ""
            )
                .trim();

        await this.findOrder(
            orderNumber,
            identifier
        );
    },


    async findOrder(
        orderNumber,
        identifier = ""
    ) {

        this.lookupMessage(
            "",
            "info",
            true
        );

        this.hideWorkspace();

        document
            .getElementById(
                "returnLoading"
            )
            ?.classList.remove(
                "hidden"
            );

        try {

            if (
                API.isAuthenticated?.() ||
                API.isLoggedIn?.()
            ) {

                const data =
                    await API.get(
                        "/api/orders"
                    );

                const orders =
                    Array.isArray(
                        data.orders
                    )
                        ? data.orders
                        : [];

                const orderSummary =
                    orders.find(
                        order =>
                            String(
                                order.order_number ||
                                ""
                            ).toLowerCase() ===
                            String(
                                orderNumber
                            ).toLowerCase()
                    );

                if (orderSummary) {

                    const details =
                        await API.get(
                            `/api/orders/${encodeURIComponent(
                                orderSummary.id
                            )}`
                        );

                    this.mode =
                        "customer";

                    this.guestToken =
                        "";

                    this.returnAccessToken =
                        "";

                    this.setOrderData(
                        details
                    );

                    return;
                }
            }


            const token =
                sessionStorage.getItem(
                    `rukhnav_guest_order_${orderNumber}`
                ) ||
                "";

            if (token) {

                const response =
                    await fetch(
                        `${API.base}/api/orders/guest/${encodeURIComponent(
                            orderNumber
                        )}?token=${encodeURIComponent(
                            token
                        )}`,
                        {
                            headers: {
                                "Accept":
                                    "application/json"
                            }
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        "Order could not be verified."
                    );
                }

                this.mode =
                    "guest";

                this.guestToken =
                    token;

                this.returnAccessToken =
                    "";

                this.setOrderData(
                    data
                );

                return;
            }

            if (!identifier) {
                throw new Error(
                    "Enter the email or mobile number used at checkout to verify this guest order."
                );
            }

            const response =
                await fetch(
                    `${API.base}/api/orders/guest/return-lookup`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                order_number:
                                    orderNumber,

                                identifier
                            })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "We could not verify this order."
                );
            }

            this.mode =
                "guest";

            this.guestToken =
                "";

            this.returnAccessToken =
                data.return_access_token ||
                "";

            if (!this.returnAccessToken) {
                throw new Error(
                    "Return verification could not be established."
                );
            }

            this.setOrderData(
                data
            );

        } catch (error) {

            this.lookupMessage(
                error.message ||
                "Unable to find this order.",
                "error"
            );

        } finally {

            document
                .getElementById(
                    "returnLoading"
                )
                ?.classList.add(
                    "hidden"
                );
        }
    },


    setOrderData(data) {

        this.order =
            data.order ||
            data.data?.order ||
            data.data ||
            {};

        this.items =
            Array.isArray(
                data.items
            )
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

        if (
            !this.order ||
            !this.order.order_number
        ) {
            throw new Error(
                "Order details could not be loaded."
            );
        }

        if (
            String(
                this.order.order_status ||
                ""
            ).toLowerCase() !==
            "delivered"
        ) {
            throw new Error(
                "Only delivered orders are eligible for a return request."
            );
        }

        this.renderOrder();
        this.renderItems();

        document
            .getElementById(
                "returnWorkspace"
            )
            ?.classList.remove(
                "hidden"
            );

        this.lookupMessage(
            "Order verified successfully.",
            "success"
        );

        document
            .getElementById(
                "returnWorkspace"
            )
            ?.scrollIntoView({
                behavior:
                    "smooth",
                block:
                    "start"
            });
    },


    renderOrder() {

        const order =
            this.order;

        this.text(
            "returnOrderHeading",
            order.order_number ||
            "Order"
        );

        this.text(
            "returnOrderDate",
            `Placed ${this.dateTime(
                order.created_at
            )}`
        );

        this.text(
            "returnOrderStatus",
            order.order_status ||
            "—"
        );

        this.text(
            "returnPaymentStatus",
            `Payment ${
                order.payment_status ||
                "—"
            }`
        );

        this.text(
            "returnCustomerName",
            order.full_name ||
            "Customer"
        );

        this.text(
            "returnOrderTotal",
            Store.money(
                order.grand_total ||
                0
            )
        );

        this.text(
            "returnDeliveryStatus",
            order.order_status ||
            "—"
        );

        this.text(
            "returnDeliveredDate",
            this.dateTime(
                order.delivered_at
            )
        );
    },


    renderItems() {

        const list =
            document.getElementById(
                "returnItemsList"
            );

        if (!list) return;

        list.innerHTML =
            this.items
                .map(
                    (item, index) =>
                        this.itemMarkup(
                            item,
                            index
                        )
                )
                .join("");
    },


    itemMarkup(item, index) {

        const orderItemId =
            Number(
                item.order_item_id ??
                item.id ??
                0
            );

        const quantity =
            Math.max(
                0,
                Number(
                    item.quantity ||
                    0
                )
            );

        const image =
            Store.img?.(
                item
            ) ||
            item.image ||
            item.image_url ||
            "";

        const quantityOptions =
            Array.from(
                {
                    length:
                        quantity
                },
                (_, offset) =>
                    `<option value="${offset + 1}">
                        ${offset + 1}
                    </option>`
            ).join("");

        return `
            <article
                class="return-item"
                data-return-row="${orderItemId}"
            >

                <input
                    class="return-item-check"
                    type="checkbox"
                    data-return-item="${orderItemId}"
                    aria-label="Select ${Components.e(
                        item.product_name ||
                        `Product ${index + 1}`
                    )}"
                >

                <div class="return-item-image">

                    ${
                        image
                            ? `
                                <img
                                    src="${Components.e(image)}"
                                    alt="${Components.e(
                                        item.product_name ||
                                        "Product"
                                    )}"
                                >
                            `
                            : `
                                <i class="fa-solid fa-spa"></i>
                            `
                    }

                </div>


                <div class="return-item-main">

                    <strong>
                        ${Components.e(
                            item.product_name ||
                            "Product"
                        )}
                    </strong>

                    <small>
                        Purchased:
                        ${quantity}
                        ·
                        ${Store.money(
                            item.price ||
                            0
                        )}
                    </small>

                </div>


                <div class="return-item-control">

                    <label>
                        Return quantity
                    </label>

                    <select
                        data-return-quantity="${orderItemId}"
                        disabled
                    >
                        ${quantityOptions}
                    </select>

                </div>


                <div class="return-item-control">

                    <label>
                        Item reason
                    </label>

                    <select
                        data-return-item-reason="${orderItemId}"
                        disabled
                    >
                        <option value="">
                            Same as main reason
                        </option>

                        <option value="Damaged">
                            Damaged
                        </option>

                        <option value="Defective">
                            Defective
                        </option>

                        <option value="Wrong Item">
                            Wrong item
                        </option>

                        <option value="Quality Issue">
                            Quality issue
                        </option>

                        <option value="Other">
                            Other
                        </option>
                    </select>

                </div>

            </article>
        `;
    },


    handleItemChange(event) {

        const checkbox =
            event.target.closest(
                "[data-return-item]"
            );

        if (!checkbox) return;

        const id =
            checkbox.dataset
                .returnItem;

        const row =
            document.querySelector(
                `[data-return-row="${id}"]`
            );

        row
            ?.classList.toggle(
                "selected",
                checkbox.checked
            );

        document
            .querySelector(
                `[data-return-quantity="${id}"]`
            )
            ?.toggleAttribute(
                "disabled",
                !checkbox.checked
            );

        document
            .querySelector(
                `[data-return-item-reason="${id}"]`
            )
            ?.toggleAttribute(
                "disabled",
                !checkbox.checked
            );
    },


    handleMedia(event) {

        this.setFiles(
            [
                ...(
                    event.target.files ||
                    []
                )
            ]
        );
    },


    setFiles(files) {

        const allowed =
            new Set([
                "image/jpeg",
                "image/png",
                "image/webp",
                "video/mp4",
                "video/quicktime",
                "video/webm"
            ]);

        const valid =
            files.filter(
                file =>
                    allowed.has(
                        file.type
                    )
            );

        const images =
            valid.filter(
                file =>
                    file.type.startsWith(
                        "image/"
                    )
            );

        const videos =
            valid.filter(
                file =>
                    file.type.startsWith(
                        "video/"
                    )
            );

        if (valid.length > 6) {
            Store.toast(
                "Upload no more than six evidence files.",
                "error"
            );
            return;
        }

        if (images.length > 5) {
            Store.toast(
                "Upload no more than five images.",
                "error"
            );
            return;
        }

        if (videos.length > 1) {
            Store.toast(
                "Upload no more than one video.",
                "error"
            );
            return;
        }

        const tooLarge =
            valid.find(
                file =>
                    Number(file.size || 0) >
                    25 * 1024 * 1024
            );

        if (tooLarge) {
            Store.toast(
                "Each evidence file must be 25 MB or smaller.",
                "error"
            );
            return;
        }

        this.selectedFiles =
            valid;

        this.renderMedia();
    },


    renderMedia() {

        const container =
            document.getElementById(
                "returnMediaPreview"
            );

        if (!container) return;

        container.innerHTML =
            this.selectedFiles
                .map(
                    file => `
                        <article class="return-media-file">

                            <div class="return-media-file-icon">
                                <i class="fa-solid ${
                                    file.type.startsWith(
                                        "video/"
                                    )
                                        ? "fa-video"
                                        : "fa-image"
                                }"></i>
                            </div>

                            <div class="return-media-file-info">

                                <strong>
                                    ${Components.e(
                                        file.name ||
                                        "Evidence file"
                                    )}
                                </strong>

                                <small>
                                    ${this.fileSize(
                                        file.size
                                    )}
                                </small>

                            </div>

                        </article>
                    `
                )
                .join("");
    },


    async submitReturn(event) {

        event.preventDefault();

        if (
            !this.order ||
            !this.order.order_number
        ) {
            this.submitMessage(
                "Find and verify your order first.",
                "error"
            );
            return;
        }

        const selected =
            [
                ...document.querySelectorAll(
                    "[data-return-item]:checked"
                )
            ];

        if (!selected.length) {
            this.submitMessage(
                "Select at least one product to return.",
                "error"
            );
            return;
        }

        const reason =
            String(
                document
                    .getElementById(
                        "returnReason"
                    )
                    ?.value || ""
            ).trim();

        if (!reason) {
            this.submitMessage(
                "Select the main reason for your return.",
                "error"
            );
            return;
        }

        const items =
            selected.map(
                checkbox => {

                    const orderItemId =
                        Number(
                            checkbox.dataset
                                .returnItem
                        );

                    const quantity =
                        Number(
                            document
                                .querySelector(
                                    `[data-return-quantity="${orderItemId}"]`
                                )
                                ?.value ||
                            1
                        );

                    return {
                        order_item_id:
                            orderItemId,

                        quantity
                    };
                }
            );

        const payload = {
            order_id:
                this.order.id,

            order_number:
                this.order.order_number,

            reason,

            customer_notes:
                String(
                    document
                        .getElementById(
                            "returnNotes"
                        )
                        ?.value || ""
                )
                    .trim() ||
                null,

            items
        };

        const button =
            document.getElementById(
                "submitReturnButton"
            );

        const original =
            button?.innerHTML;

        if (button) {
            button.disabled =
                true;

            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        }

        try {

            let createResponse;

            if (
                this.mode ===
                "guest"
            ) {

                createResponse =
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
                                    ...payload,

                                    guest_token:
                                        this.guestToken ||
                                        undefined,

                                    return_access_token:
                                        this.returnAccessToken ||
                                        undefined
                                })
                        }
                    );

            } else {

                createResponse =
                    await fetch(
                        `${API.base}/api/returns`,
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${API.getToken?.() || ""}`
                            },

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );
            }

            const createData =
                await createResponse.json();

            if (!createResponse.ok) {
                throw new Error(
                    createData.message ||
                    "Unable to submit return request."
                );
            }

            const returnRequest =
                createData.return_request ||
                {};

            const returnId =
                Number(
                    returnRequest.id
                );

            if (
                this.selectedFiles.length &&
                returnId
            ) {
                await this.uploadEvidence(
                    returnId
                );
            }

            this.showSuccess(
                returnRequest
            );

        } catch (error) {

            this.submitMessage(
                error.message ||
                "Unable to submit return request.",
                "error"
            );

        } finally {

            if (button) {
                button.disabled =
                    false;

                button.innerHTML =
                    original;
            }
        }
    },


    async uploadEvidence(returnId) {

        const formData =
            new FormData();

        for (
            const file of
            this.selectedFiles
        ) {
            formData.append(
                "return_media",
                file,
                file.name
            );
        }

        let url;
        const headers = {};

        if (
            this.mode ===
            "guest"
        ) {

            if (this.guestToken) {
                formData.append(
                    "guest_token",
                    this.guestToken
                );
            }

            if (this.returnAccessToken) {
                formData.append(
                    "return_access_token",
                    this.returnAccessToken
                );
            }

            url =
                `${API.base}/api/returns/guest/${encodeURIComponent(
                    returnId
                )}/media`;

        } else {

            url =
                `${API.base}/api/returns/${encodeURIComponent(
                    returnId
                )}/media`;

            headers.Authorization =
                `Bearer ${API.getToken?.() || ""}`;
        }

        const response =
            await fetch(
                url,
                {
                    method:
                        "POST",

                    headers,

                    body:
                        formData
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Return request was created, but evidence upload failed."
            );
        }

        return data;
    },


    showSuccess(returnRequest) {

        document
            .getElementById(
                "returnLookupSection"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "returnWorkspace"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "returnSuccess"
            )
            ?.classList.remove(
                "hidden"
            );

        this.text(
            "returnSuccessNumber",
            returnRequest
                .return_number ||
            `RET-${returnRequest.id || ""}`
        );

        document
            .getElementById(
                "returnSuccess"
            )
            ?.scrollIntoView({
                behavior:
                    "smooth",
                block:
                    "start"
            });
    },


    reset() {

        this.order =
            null;

        this.items =
            [];

        this.mode =
            null;

        this.guestToken =
            "";

        this.returnAccessToken =
            "";

        this.selectedFiles =
            [];

        document
            .getElementById(
                "returnRequestForm"
            )
            ?.reset();

        document
            .getElementById(
                "returnLookupForm"
            )
            ?.reset();

        this.renderMedia();

        this.hideWorkspace();

        document
            .getElementById(
                "returnSuccess"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "returnLookupSection"
            )
            ?.classList.remove(
                "hidden"
            );

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    },


    hideWorkspace() {

        document
            .getElementById(
                "returnWorkspace"
            )
            ?.classList.add(
                "hidden"
            );
    },


    lookupMessage(
        message,
        type = "info",
        hide = false
    ) {

        this.message(
            "returnLookupMessage",
            message,
            type,
            hide
        );
    },


    submitMessage(
        message,
        type = "info",
        hide = false
    ) {

        this.message(
            "returnSubmitMessage",
            message,
            type,
            hide
        );
    },


    message(
        id,
        message,
        type,
        hide
    ) {

        const box =
            document.getElementById(
                id
            );

        if (!box) return;

        if (
            hide ||
            !message
        ) {
            box.className =
                "return-message hidden";

            box.textContent =
                "";

            return;
        }

        box.className =
            `return-message ${type}`;

        box.textContent =
            message;
    },


    text(id, value) {

        const node =
            document.getElementById(
                id
            );

        if (node) {
            node.textContent =
                value ??
                "—";
        }
    },


    dateTime(value) {

        if (!value) {
            return "—";
        }

        const date =
            new Date(
                value
            );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "—";
        }

        return date
            .toLocaleString();
    },


    fileSize(bytes) {

        const size =
            Number(
                bytes || 0
            );

        if (size < 1024) {
            return `${size} B`;
        }

        if (
            size <
            1024 * 1024
        ) {
            return `${(
                size /
                1024
            ).toFixed(1)} KB`;
        }

        return `${(
            size /
            1024 /
            1024
        ).toFixed(1)} MB`;
    }
};


document.addEventListener(
    "DOMContentLoaded",
    () =>
        ReturnsPage.init()
);
