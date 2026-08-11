"use strict";

const CartPage = {
    authenticated: false,
    guestMode: false,
    items: [],
    products: [],
    total: 0,

    async init() {
        await this.waitForStore();

        this.authenticated =
            API.isAuthenticated();

        this.bind();

        if (this.authenticated) {
            /*
             * A customer may already be signed in while products still
             * exist in the browser guest cart. Merge them before loading
             * the backend cart so the page does not incorrectly appear empty.
             */
            if (
                typeof Store.mergeGuestCart ===
                "function"
            ) {
                try {
                    await Store.mergeGuestCart();
                } catch (error) {
                    console.warn(
                        "Guest cart merge could not be completed:",
                        error
                    );
                }
            }

            await this.loadBackendCart();
        } else {
            this.showSignInState();
        }

        await this.loadRecommendations();
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
        document
            .getElementById(
                "continueAsGuestButton"
            )
            ?.addEventListener(
                "click",
                async () => {
                    this.guestMode = true;
                    await this.loadGuestCart();
                }
            );

        document
            .getElementById(
                "proceedCheckoutButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    if (
                    API.isAuthenticated()
                ) {
                    location.href =
                        "checkout.html";
                    return;
                }

                /*
                 * Guest customers who selected
                 * "Continue as guest" should proceed
                 * directly to guest checkout.
                 */
                if (this.guestMode) {
                    location.href =
                        "guest-checkout.html?source=cart";
                    return;
                }

                location.href =
                    "account.html?return=checkout.html";
                }
            );

        document
            .getElementById(
                "clearGuestCartButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    if (
                        !confirm(
                            "Remove all products from your guest cart?"
                        )
                    ) {
                        return;
                    }

                    localStorage.removeItem(
                        Store.cartKey
                    );

                    this.items = [];
                    this.render();
                    Store.refreshCartCount();
                }
            );

        document
            .getElementById(
                "cartItems"
            )
            ?.addEventListener(
                "click",
                event =>
                    this.handleCartClick(
                        event
                    )
            );

        document
            .getElementById(
                "cartItems"
            )
            ?.addEventListener(
                "change",
                event =>
                    this.handleQuantityChange(
                        event
                    )
            );

        document.addEventListener(
            "rukhnav:cart-merged",
            () => {
                if (
                    API.isAuthenticated()
                ) {
                    this.loadBackendCart();
                }
            }
        );
    },

    showSignInState() {
        this.hideAllStates();

        document
            .getElementById(
                "cartSignInState"
            )
            .classList
            .remove("hidden");
    },

    hideAllStates() {
        [
            "cartLoading",
            "cartSignInState",
            "cartEmptyState",
            "cartWorkspace"
        ].forEach(id => {
            document
                .getElementById(id)
                ?.classList
                .add("hidden");
        });
    },

    async loadBackendCart() {
        this.showLoading();

        try {
            const data =
                await API.get(
                    API.cart
                );

            this.items =
                Array.isArray(
                    data.cart
                )
                    ? data.cart
                    : Array.isArray(
                        data.items
                    )
                        ? data.items
                        : Array.isArray(
                            data.data?.cart
                        )
                            ? data.data.cart
                            : Array.isArray(
                                data.data?.items
                            )
                                ? data.data.items
                                : [];

            this.total =
                Number(
                    data.grandTotal ??
                    data.grand_total ??
                    data.total ??
                    data.data?.grandTotal ??
                    data.data?.grand_total ??
                    data.data?.total ??
                    this.items.reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.subtotal ??
                                (
                                    Number(
                                        item.price ??
                                        item.selling_price ??
                                        0
                                    ) *
                                    Number(
                                        item.quantity ??
                                        0
                                    )
                                )
                            ),
                        0
                    )
                );

            this.render();
        } catch (error) {
            this.hideAllStates();

            if (
                error.status === 401 ||
                error.status === 403
            ) {
                this.authenticated = false;
                this.showSignInState();
                return;
            }

            Store.toast(
                error.message,
                "error"
            );

            document
                .getElementById(
                    "cartEmptyState"
                )
                .classList
                .remove("hidden");
        }
    },

    async loadGuestCart() {
        this.showLoading();

        const guestItems =
            Store.read(
                Store.cartKey
            );

        if (!guestItems.length) {
            this.items = [];
            this.total = 0;
            this.render();
            return;
        }

        try {
            const data =
                await API.get(
                    API.products
                );

            this.products =
                Array.isArray(
                    data.products
                )
                    ? data.products
                    : Array.isArray(
                        data.data
                    )
                        ? data.data
                        : Array.isArray(data)
                            ? data
                            : [];

            this.items =
                guestItems
                    .map(item => {
                        const product =
                            this.products.find(
                                row =>
                                    String(
                                        row.id
                                    ) ===
                                    String(
                                        item.productId
                                    )
                            );

                        if (!product) {
                            return null;
                        }

                        const quantity =
                            Number(
                                item.quantity ||
                                1
                            );

                        const price =
                            Number(
                                product.selling_price ??
                                product.price ??
                                0
                            );

                        return {
                            cart_id:
                                `guest-${product.id}`,
                            product_id:
                                product.id,
                            product_name:
                                product.product_name ||
                                product.name,
                            price,
                            selling_price:
                                price,
                            image:
                                product.image ||
                                product.product_image ||
                                product.image_url,
                            stock_quantity:
                                Number(
                                    product.stock_quantity ??
                                    product.stock ??
                                    0
                                ),
                            product_status:
                                product.status ||
                                "Active",
                            quantity,
                            subtotal:
                                price *
                                quantity,
                            guest:
                                true
                        };
                    })
                    .filter(Boolean);

            this.total =
                this.items.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.subtotal ||
                            0
                        ),
                    0
                );

            this.render();
        } catch (error) {
            Store.toast(
                error.message,
                "error"
            );

            this.items = [];
            this.render();
        }
    },

    showLoading() {
        this.hideAllStates();

        document
            .getElementById(
                "cartLoading"
            )
            .classList
            .remove("hidden");
    },

    render() {
        this.hideAllStates();

        if (!this.items.length) {
            document
                .getElementById(
                    "cartEmptyState"
                )
                .classList
                .remove("hidden");

            document
                .getElementById(
                    "cartHeadingText"
                )
                .textContent =
                "Your cart is ready for something beautiful.";

            return;
        }

        const workspace =
            document.getElementById(
                "cartWorkspace"
            );

        workspace.classList.remove(
            "hidden"
        );

        document
            .getElementById(
                "clearGuestCartButton"
            )
            .classList
            .toggle(
                "hidden",
                !this.guestMode
            );

        const quantity =
            this.items.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.quantity ||
                        0
                    ),
                0
            );

        document
            .getElementById(
                "cartItemsTitle"
            )
            .textContent =
            `${quantity} item${
                quantity === 1
                    ? ""
                    : "s"
            }`;

        document
            .getElementById(
                "cartHeadingText"
            )
            .textContent =
            `${quantity} item${
                quantity === 1
                    ? ""
                    : "s"
            } ready for checkout.`;

        document
            .getElementById(
                "cartItems"
            )
            .innerHTML =
            this.items
                .map(
                    item =>
                        this.itemMarkup(
                            item
                        )
                )
                .join("");

        this.recalculate();
    },

    itemMarkup(item) {
        const image =
            Store.img(item);

        const stock =
            Number(
                item.stock_quantity ||
                0
            );

        const status =
            String(
                item.product_status ||
                "Active"
            ).toLowerCase();

        const unavailable =
            stock < 1 ||
            status === "inactive";

        return `
            <article
                class="cart-item"
                data-cart-item="${Components.e(item.cart_id)}"
                data-product-id="${Components.e(item.product_id)}"
            >
                <a
                    class="cart-item-image"
                    href="product.html?id=${encodeURIComponent(item.product_id)}"
                >
                    ${
                        image
                            ? `
                                <img
                                    src="${Components.e(image)}"
                                    alt="${Components.e(item.product_name)}"
                                >
                            `
                            : `
                                <div class="cart-item-placeholder">
                                    <i class="fa-solid fa-spa"></i>
                                </div>
                            `
                    }
                </a>

                <div class="cart-item-info">
                    <span class="cart-item-category">
                        RUKHNAV
                    </span>

                    <h3>
                        <a href="product.html?id=${encodeURIComponent(item.product_id)}">
                            ${Components.e(item.product_name)}
                        </a>
                    </h3>

                    <div class="cart-item-price">
                        ${Store.money(item.price ?? item.selling_price)}
                    </div>

                    <div class="cart-item-stock">
                        ${
                            unavailable
                                ? "Currently unavailable"
                                : `${stock} unit(s) available`
                        }
                    </div>
                </div>

                <div class="cart-item-controls">
                    <div class="cart-item-subtotal">
                        ${Store.money(
                            Number(
                                item.price ??
                                item.selling_price ??
                                0
                            ) *
                            Number(
                                item.quantity ||
                                0
                            )
                        )}
                    </div>

                    <div class="cart-item-actions">
                        <div class="cart-quantity-control">
                            <button
                                type="button"
                                data-quantity-action="decrease"
                                aria-label="Decrease quantity"
                                ${item.quantity <= 1 ? "disabled" : ""}
                            >
                                −
                            </button>

                            <input
                                type="number"
                                min="1"
                                max="${Math.max(1, stock)}"
                                value="${Components.e(item.quantity)}"
                                data-quantity-input
                                aria-label="Quantity"
                            >

                            <button
                                type="button"
                                data-quantity-action="increase"
                                aria-label="Increase quantity"
                                ${item.quantity >= stock ? "disabled" : ""}
                            >
                                +
                            </button>
                        </div>

                        <button
                            type="button"
                            class="remove-cart-item"
                            data-remove-cart-item
                            aria-label="Remove item"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    recalculate() {
        this.total =
            this.items.reduce(
                (
                    total,
                    item
                ) =>
                    total +
                    Number(
                        item.price ??
                        item.selling_price ??
                        0
                    ) *
                    Number(
                        item.quantity ||
                        0
                    ),
                0
            );

        document
            .getElementById(
                "cartSubtotal"
            )
            .textContent =
            Store.money(
                this.total
            );

        document
            .getElementById(
                "cartDiscount"
            )
            .textContent =
            Store.money(0);

        document
            .getElementById(
                "cartGrandTotal"
            )
            .textContent =
            Store.money(
                this.total
            );
    },

    async handleCartClick(event) {
        const itemElement =
            event.target.closest(
                "[data-cart-item]"
            );

        if (!itemElement) {
            return;
        }

        const item =
            this.items.find(
                row =>
                    String(
                        row.cart_id
                    ) ===
                    String(
                        itemElement.dataset.cartItem
                    )
            );

        if (!item) {
            return;
        }

        const quantityAction =
            event.target.closest(
                "[data-quantity-action]"
            );

        if (quantityAction) {
            const delta =
                quantityAction.dataset.quantityAction ===
                "increase"
                    ? 1
                    : -1;

            await this.changeQuantity(
                item,
                Number(item.quantity) +
                delta,
                itemElement
            );

            return;
        }

        const removeButton =
            event.target.closest(
                "[data-remove-cart-item]"
            );

        if (removeButton) {
            await this.removeItem(
                item,
                itemElement
            );
        }
    },

    async handleQuantityChange(event) {
        const input =
            event.target.closest(
                "[data-quantity-input]"
            );

        if (!input) {
            return;
        }

        const itemElement =
            input.closest(
                "[data-cart-item]"
            );

        const item =
            this.items.find(
                row =>
                    String(
                        row.cart_id
                    ) ===
                    String(
                        itemElement.dataset.cartItem
                    )
            );

        if (!item) {
            return;
        }

        const quantity =
            Math.max(
                1,
                Math.min(
                    Number(
                        item.stock_quantity ||
                        1
                    ),
                    Math.floor(
                        Number(
                            input.value ||
                            1
                        )
                    )
                )
            );

        await this.changeQuantity(
            item,
            quantity,
            itemElement
        );
    },

    async changeQuantity(
        item,
        quantity,
        element
    ) {
        if (
            quantity < 1 ||
            quantity >
            Number(
                item.stock_quantity ||
                0
            )
        ) {
            Store.toast(
                "The selected quantity is not available.",
                "error"
            );

            return;
        }

        element.classList.add(
            "cart-item-updating"
        );

        try {
            if (
                this.authenticated &&
                !item.guest
            ) {
                await API.put(
                    `${API.cart}/${encodeURIComponent(item.cart_id)}`,
                    {
                        quantity
                    }
                );
            } else {
                const guestCart =
                    Store.read(
                        Store.cartKey
                    );

                const guestItem =
                    guestCart.find(
                        row =>
                            String(
                                row.productId
                            ) ===
                            String(
                                item.product_id
                            )
                    );

                if (guestItem) {
                    guestItem.quantity =
                        quantity;

                    Store.write(
                        Store.cartKey,
                        guestCart
                    );
                }
            }

            item.quantity =
                quantity;

            item.subtotal =
                Number(
                    item.price ??
                    item.selling_price ??
                    0
                ) *
                quantity;

            this.render();
            await Store.refreshCartCount();
        } catch (error) {
            Store.toast(
                error.message,
                "error"
            );

            if (this.authenticated) {
                await this.loadBackendCart();
            }
        } finally {
            element.classList.remove(
                "cart-item-updating"
            );
        }
    },

    async removeItem(
        item,
        element
    ) {
        if (
            !confirm(
                `Remove ${item.product_name} from your cart?`
            )
        ) {
            return;
        }

        element.classList.add(
            "cart-item-updating"
        );

        try {
            if (
                this.authenticated &&
                !item.guest
            ) {
                await API.delete(
                    `${API.cart}/${encodeURIComponent(item.cart_id)}`
                );
            } else {
                const next =
                    Store.read(
                        Store.cartKey
                    ).filter(
                        row =>
                            String(
                                row.productId
                            ) !==
                            String(
                                item.product_id
                            )
                    );

                Store.write(
                    Store.cartKey,
                    next
                );
            }

            this.items =
                this.items.filter(
                    row =>
                        String(
                            row.cart_id
                        ) !==
                        String(
                            item.cart_id
                        )
                );

            this.render();
            await Store.refreshCartCount();

            Store.toast(
                "Product removed from cart."
            );
        } catch (error) {
            Store.toast(
                error.message,
                "error"
            );

            element.classList.remove(
                "cart-item-updating"
            );
        }
    },

    async loadRecommendations() {
        try {
            const data =
                await API.get(
                    API.products
                );

            const products =
                Array.isArray(
                    data.products
                )
                    ? data.products
                    : Array.isArray(
                        data.data
                    )
                        ? data.data
                        : Array.isArray(data)
                            ? data
                            : [];

            const visible =
                products
                    .filter(
                        product =>
                            Number(
                                product.stock_quantity ??
                                product.stock ??
                                0
                            ) > 0
                    )
                    .slice(0, 5);

            if (!visible.length) {
                return;
            }

            const container =
                document.getElementById(
                    "recommendedProducts"
                );

            container.innerHTML =
                visible
                    .map(
                        product =>
                            Store.card(
                                product
                            )
                    )
                    .join("");

            Store.bindCards(
                container
            );

            document
                .getElementById(
                    "cartRecommendations"
                )
                .classList
                .remove("hidden");
        } catch (error) {
            console.warn(
                "Cart recommendations unavailable.",
                error
            );
        }
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => CartPage.init()
);
