"use strict";

const WishlistPage = {
    authenticated: false,
    guestMode: false,
    items: [],

    async init() {
        await this.waitForStore();

        this.authenticated = API.isAuthenticated();
        this.bind();

        if (this.authenticated) {
            await this.loadBackendWishlist();
        } else {
            this.showSignInState();
        }
    },

    waitForStore() {
        return new Promise(resolve => {
            if (Store.settings && Object.keys(Store.settings).length) {
                resolve();
                return;
            }

            document.addEventListener(
                "rukhnav:store-ready",
                resolve,
                { once: true }
            );
        });
    },

    bind() {
        document
            .getElementById("continueGuestWishlistButton")
            .addEventListener(
                "click",
                async () => {
                    this.guestMode = true;
                    await this.loadGuestWishlist();
                }
            );

        document
            .getElementById("wishlistSearch")
            .addEventListener("input", () => this.render());

        document
            .getElementById("wishlistStockFilter")
            .addEventListener("change", () => this.render());

        document
            .getElementById("wishlistSort")
            .addEventListener("change", () => this.render());

        document
            .getElementById("wishlistGrid")
            .addEventListener(
                "click",
                event => this.handleGridClick(event)
            );

        document
            .getElementById("moveAllToCartButton")
            .addEventListener(
                "click",
                event => this.moveAllToCart(event.currentTarget)
            );

        document
            .getElementById("shareWishlistButton")
            .addEventListener(
                "click",
                () => this.shareWishlist()
            );

        document.addEventListener(
            "rukhnav:wishlist-merged",
            () => {
                if (API.isAuthenticated()) {
                    this.loadBackendWishlist();
                }
            }
        );
    },

    hideStates() {
        [
            "wishlistLoading",
            "wishlistSignInState",
            "wishlistEmptyState",
            "wishlistWorkspace"
        ].forEach(id => {
            document.getElementById(id)?.classList.add("hidden");
        });
    },

    showLoading() {
        this.hideStates();
        document.getElementById("wishlistLoading").classList.remove("hidden");
    },

    showSignInState() {
        this.hideStates();
        document.getElementById("wishlistSignInState").classList.remove("hidden");
    },

    async loadBackendWishlist() {
        this.showLoading();

        try {
            const data = await API.get("/api/wishlist");
            this.items = Array.isArray(data.wishlist) ? data.wishlist : [];
            this.render();
        } catch (error) {
            if (error.status === 401 || error.status === 403) {
                this.authenticated = false;
                this.showSignInState();
                return;
            }

            Store.toast(error.message, "error");
            this.items = [];
            this.render();
        }
    },

    async loadGuestWishlist() {
        this.showLoading();

        const savedIds = Store.read(Store.wishKey);

        if (!savedIds.length) {
            this.items = [];
            this.render();
            return;
        }

        try {
            const data = await API.get(API.products);

            const products = Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data)
                        ? data
                        : [];

            this.items = savedIds
                .map((productId, index) => {
                    const product = products.find(
                        row => String(row.id) === String(productId)
                    );

                    if (!product) return null;

                    return {
                        wishlist_id: `guest-${product.id}`,
                        product_id: product.id,
                        product_name: product.product_name || product.name,
                        price: product.selling_price ?? product.price ?? 0,
                        image: product.image || product.product_image || product.image_url,
                        stock: product.stock_quantity ?? product.stock ?? 0,
                        status: product.status || "Active",
                        created_at: new Date(
                            Date.now() - index * 1000
                        ).toISOString(),
                        guest: true
                    };
                })
                .filter(Boolean);

            this.render();
        } catch (error) {
            Store.toast(error.message, "error");
            this.items = [];
            this.render();
        }
    },

    filteredItems() {
        const search =
            document.getElementById("wishlistSearch").value.trim().toLowerCase();

        const stockFilter =
            document.getElementById("wishlistStockFilter").value;

        const sort =
            document.getElementById("wishlistSort").value;

        let rows = [...this.items];

        if (search) {
            rows = rows.filter(item =>
                String(item.product_name || "")
                    .toLowerCase()
                    .includes(search)
            );
        }

        if (stockFilter === "in") {
            rows = rows.filter(item =>
                this.isAvailable(item)
            );
        }

        if (stockFilter === "out") {
            rows = rows.filter(item =>
                !this.isAvailable(item)
            );
        }

        if (sort === "recent") {
            rows.sort(
                (a, b) =>
                    new Date(b.created_at || 0) -
                    new Date(a.created_at || 0)
            );
        }

        if (sort === "price_low") {
            rows.sort(
                (a, b) =>
                    Number(a.price || 0) -
                    Number(b.price || 0)
            );
        }

        if (sort === "price_high") {
            rows.sort(
                (a, b) =>
                    Number(b.price || 0) -
                    Number(a.price || 0)
            );
        }

        if (sort === "name") {
            rows.sort((a, b) =>
                String(a.product_name || "")
                    .localeCompare(
                        String(b.product_name || "")
                    )
            );
        }

        return rows;
    },

    render() {
        this.hideStates();

        if (!this.items.length) {
            document
                .getElementById("wishlistEmptyState")
                .classList.remove("hidden");

            Store.refreshWishlistCount();
            return;
        }

        document
            .getElementById("wishlistWorkspace")
            .classList.remove("hidden");

        const rows = this.filteredItems();

        const inStock = this.items.filter(
            item => this.isAvailable(item)
        ).length;

        document.getElementById("wishlistTotalCount").textContent =
            this.items.length;

        document.getElementById("wishlistInStockCount").textContent =
            inStock;

        document.getElementById("wishlistOutOfStockCount").textContent =
            this.items.length - inStock;

        document.getElementById("wishlistResultsText").textContent =
            `${rows.length} saved product${rows.length === 1 ? "" : "s"} shown`;

        const grid = document.getElementById("wishlistGrid");

        if (!rows.length) {
            grid.innerHTML = `
                <div class="wishlist-no-results">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <h3>No matching products</h3>
                    <p>Try changing your search or availability filter.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = rows
            .map(item => this.itemMarkup(item))
            .join("");

        Store.refreshWishlistCount();
    },

    itemMarkup(item) {
        const image = Store.img(item);
        const available = this.isAvailable(item);

        return `
            <article
                class="wishlist-card"
                data-wishlist-id="${Components.e(item.wishlist_id)}"
                data-product-id="${Components.e(item.product_id)}"
            >
                <span class="wishlist-status-badge ${available ? "" : "out"}">
                    ${available ? "In stock" : "Out of stock"}
                </span>

                <button
                    type="button"
                    class="wishlist-remove-button"
                    data-remove-wishlist
                    aria-label="Remove product"
                >
                    <i class="fa-solid fa-trash"></i>
                </button>

                <a
                    class="wishlist-card-image"
                    href="product.html?id=${encodeURIComponent(item.product_id)}"
                >
                    ${
                        image
                            ? `<img src="${Components.e(image)}" alt="${Components.e(item.product_name)}">`
                            : `<div class="wishlist-placeholder"><i class="fa-solid fa-spa"></i></div>`
                    }
                </a>

                <div class="wishlist-card-body">
                    <small>RUKHNAV</small>

                    <h3>
                        <a href="product.html?id=${encodeURIComponent(item.product_id)}">
                            ${Components.e(item.product_name)}
                        </a>
                    </h3>

                    <div class="wishlist-rating">★★★★★</div>
                    <div class="wishlist-price">${Store.money(item.price)}</div>

                    <div class="wishlist-date">
                        Saved ${this.date(item.created_at)}
                    </div>

                    <div class="wishlist-card-actions">
                        <button
                            type="button"
                            class="btn primary"
                            data-move-to-cart
                            ${available ? "" : "disabled"}
                        >
                            <i class="fa-solid fa-cart-plus"></i>
                            Add to cart
                        </button>

                        <button
                            type="button"
                            class="wishlist-buy-button"
                            data-buy-now
                            ${available ? "" : "disabled"}
                            aria-label="Buy now"
                        >
                            <i class="fa-solid fa-bolt"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    async handleGridClick(event) {
        const card = event.target.closest("[data-wishlist-id]");
        if (!card) return;

        const item = this.items.find(
            row =>
                String(row.wishlist_id) ===
                String(card.dataset.wishlistId)
        );

        if (!item) return;

        if (event.target.closest("[data-remove-wishlist]")) {
            await this.removeItem(item, card);
            return;
        }

        if (event.target.closest("[data-move-to-cart]")) {
            await this.moveToCart(item, card, false);
            return;
        }

        if (event.target.closest("[data-buy-now]")) {
            await this.moveToCart(item, card, true);
        }
    },

    async removeItem(item, card) {
        if (!confirm(`Remove ${item.product_name} from your wishlist?`)) {
            return;
        }

        card.classList.add("wishlist-card-updating");

        try {
            if (this.authenticated && !item.guest) {
                await API.delete(
                    `/api/wishlist/${encodeURIComponent(item.wishlist_id)}`
                );
            } else {
                await Store.removeGuestWishlist(item.product_id);
            }

            this.items = this.items.filter(
                row =>
                    String(row.wishlist_id) !==
                    String(item.wishlist_id)
            );

            this.render();
            await Store.refreshWishlistCount();

            Store.toast("Product removed from wishlist.");
        } catch (error) {
            card.classList.remove("wishlist-card-updating");
            Store.toast(error.message, "error");
        }
    },

    async moveToCart(item, card, buyNow = false) {
        if (!this.isAvailable(item)) {
            Store.toast("This product is currently unavailable.", "error");
            return;
        }

        card.classList.add("wishlist-card-updating");

        try {
            await Store.addCart(item.product_id, 1);

            if (this.authenticated && !item.guest) {
                await API.delete(
                    `/api/wishlist/${encodeURIComponent(item.wishlist_id)}`
                );
            } else {
                await Store.removeGuestWishlist(item.product_id);
            }

            this.items = this.items.filter(
                row =>
                    String(row.wishlist_id) !==
                    String(item.wishlist_id)
            );

            this.render();
            await Store.refreshWishlistCount();

            if (buyNow) {
                location.href = "cart.html";
                return;
            }

            Store.toast("Product moved to cart.");
        } catch (error) {
            card.classList.remove("wishlist-card-updating");
            Store.toast(error.message, "error");
        }
    },

    async moveAllToCart(button) {
        const availableItems =
            this.items.filter(item => this.isAvailable(item));

        if (!availableItems.length) {
            Store.toast("No available products can be added.", "error");
            return;
        }

        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Adding products';

        let moved = 0;
        let failed = 0;

        for (const item of availableItems) {
            try {
                await Store.addCart(item.product_id, 1);

                if (this.authenticated && !item.guest) {
                    await API.delete(
                        `/api/wishlist/${encodeURIComponent(item.wishlist_id)}`
                    );
                } else {
                    await Store.removeGuestWishlist(item.product_id);
                }

                moved += 1;
            } catch {
                failed += 1;
            }
        }

        this.items = this.items.filter(
            item =>
                !availableItems
                    .slice(0, moved)
                    .some(
                        movedItem =>
                            String(movedItem.wishlist_id) ===
                            String(item.wishlist_id)
                    )
        );

        button.disabled = false;
        button.innerHTML = original;

        await Store.refreshCartCount();
        await Store.refreshWishlistCount();

        if (this.authenticated) {
            await this.loadBackendWishlist();
        } else {
            await this.loadGuestWishlist();
        }

        if (moved) {
            Store.toast(`${moved} product(s) added to cart.`);
        }

        if (failed) {
            Store.toast(`${failed} product(s) could not be moved.`, "error");
        }
    },

    async shareWishlist() {
        const productNames =
            this.items
                .slice(0, 10)
                .map(item => item.product_name)
                .join(", ");

        const text =
            productNames
                ? `My RUKHNAV wishlist: ${productNames}`
                : "My RUKHNAV wishlist";

        if (navigator.share) {
            try {
                await navigator.share({
                    title: "My RUKHNAV Wishlist",
                    text,
                    url: location.href
                });
                return;
            } catch {}
        }

        try {
            await navigator.clipboard.writeText(text);
            Store.toast("Wishlist summary copied.");
        } catch {
            Store.toast(text);
        }
    },

    isAvailable(item) {
        return (
            Number(item.stock || 0) > 0 &&
            String(item.status || "active").toLowerCase() !== "inactive"
        );
    },

    date(value) {
        if (!value) return "recently";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return "recently";

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => WishlistPage.init()
);
