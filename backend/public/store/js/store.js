"use strict";

window.Store = {
    settings: {},

    categories: [],
    categoryPromise: null,

    cartKey:
        "rukhnav_local_cart",

    wishKey:
        "rukhnav_local_wishlist",

    cartSyncKey:
        "rukhnav_cart_sync",

    wishSyncKey:
        "rukhnav_wishlist_sync",

    read(key) {
        try {
            const value =
                JSON.parse(
                    localStorage.getItem(key) ||
                    "[]"
                );

            return Array.isArray(value)
                ? value
                : [];
        } catch {
            return [];
        }
    },

    write(key, value) {
        localStorage.setItem(
            key,
            JSON.stringify(
                Array.isArray(value)
                    ? value
                    : []
            )
        );
    },

    async loadCategories() {

        if (this.categoryPromise) {
            return this.categoryPromise;
        }

        this.categoryPromise =
            (async () => {

                try {

                    const response =
                        await API.get(
                            API.categories
                        );

                    const rows =
                        Array.isArray(response)
                            ? response
                            : Array.isArray(
                                response.categories
                            )
                                ? response.categories
                                : Array.isArray(
                                    response.data
                                )
                                    ? response.data
                                    : [];

                    this.categories =
                        rows
                            .filter(
                                category =>
                                    String(
                                        category.status ||
                                        "active"
                                    )
                                        .toLowerCase() ===
                                    "active"
                            )
                            .map(
                                category => ({
                                    id:
                                        Number(
                                            category.id ||
                                            0
                                        ),

                                    category_name:
                                        String(
                                            category.category_name ||
                                            category.name ||
                                            ""
                                        ).trim(),

                                    description:
                                        String(
                                            category.description ||
                                            ""
                                        ).trim(),

                                    image:
                                        category.image ||
                                        category.image_url ||
                                        "",

                                    icon_key:
                                        String(
                                            category.icon_key ||
                                            "sparkles"
                                        ).trim(),

                                    icon_color:
                                        String(
                                            category.icon_color ||
                                            "#D4A72C"
                                        ).trim()
                                })
                            )
                            .filter(
                                category =>
                                    Boolean(
                                        category.category_name
                                    )
                            );

                    return this.categories;

                } catch (error) {

                    console.warn(
                        "Unable to load storefront categories:",
                        error
                    );

                    this.categories = [];

                    return [];
                }

            })();

        return this.categoryPromise;
    },


    categoryUrl(categoryName) {

        return (
            "products.html?category=" +
            encodeURIComponent(
                String(
                    categoryName ||
                    ""
                )
            )
        );
    },


    categoryImage(category = {}) {

        const value =
            String(
                category.image ||
                ""
            ).trim();

        if (!value) {
            return "";
        }

        if (
            /^(https?:)?\/\//i.test(value) ||
            value.startsWith("data:")
        ) {
            return value;
        }

        if (value.startsWith("/")) {
            return `${API.base}${value}`;
        }

        return (
            `${API.base}/uploads/categories/` +
            encodeURIComponent(value)
        );
    },


    categoryIcon(iconKey = "sparkles") {

        const icons = {
            leaf: "fa-leaf",
            droplet: "fa-droplet",
            sparkles: "fa-sparkles",
            flower: "fa-fan",
            heart: "fa-heart",
            sun: "fa-sun",
            bottle: "fa-bottle-droplet",
            seedling: "fa-seedling",
            spa: "fa-spa",
            hair: "fa-wand-magic-sparkles",
            gift: "fa-gift",
            star: "fa-star",
            beauty: "fa-wand-sparkles",
            cleanser: "fa-pump-soap",
            shopping: "fa-bag-shopping",
            shirt: "fa-shirt"
        };

        const key =
            String(
                iconKey ||
                "sparkles"
            ).trim();

        return (
            icons[key] ||
            icons.sparkles
        );
    },


    categoryIconColor(color = "") {

        const value =
            String(
                color ||
                ""
            ).trim();

        return /^#[0-9a-fA-F]{6}$/.test(value)
            ? value
            : "#D4A72C";
    },


    renderCategoryNavigation() {

        const categories =
            Array.isArray(
                this.categories
            )
                ? this.categories
                : [];

        // ================================================
        // Search Dropdown
        // ================================================

        const searchCategory =
            document.getElementById(
                "searchCategory"
            );

        if (searchCategory) {

            const previousValue =
                searchCategory.value;

            searchCategory.innerHTML =
                '<option value="">All categories</option>' +
                categories
                    .map(
                        category => `
                            <option value="${Components.e(
                                category.category_name
                            )}">
                                ${Components.e(
                                    category.category_name
                                )}
                            </option>
                        `
                    )
                    .join("");

            if (
                categories.some(
                    category =>
                        category.category_name ===
                        previousValue
                )
            ) {
                searchCategory.value =
                    previousValue;
            }
        }

        // ================================================
        // Main Navigation Categories
        // ================================================

        const navigation =
            document.querySelector(
                ".categories-nav > div"
            );

        if (navigation) {

            const categoryLinks =
                categories
                    .map(
                        category => `
                            <a href="${Components.e(
                                this.categoryUrl(
                                    category.category_name
                                )
                            )}">
                                ${Components.e(
                                    category.category_name
                                )}
                            </a>
                        `
                    )
                    .join("");

            navigation.innerHTML = `
                <a href="products.html">
                    All Products
                </a>

                ${categoryLinks}

                <a href="products.html?sort=newest">
                    New Arrivals
                </a>

                <a href="rewards.html">
                    Rewards
                </a>

                <a href="returns.html">
                    Returns
                </a>

                <a href="contact.html">
                    Help
                </a>
            `;
        }
    },


    renderHomepageCategories() {

        const grid =
            document.querySelector(
                ".home-shop-shortcuts .categories, .section:has(.categories) .categories"
            );

        if (!grid) {
            return false;
        }

        const categories =
            Array.isArray(
                this.categories
            )
                ? this.categories
                : [];

        if (!categories.length) {
            return false;
        }

        grid.innerHTML =
            categories
                .map(
                    category => {

                        const name =
                            category.category_name;

                        const image =
                            this.categoryImage(
                                category
                            );

                        const description =
                            category.description ||
                            `Explore ${name} products`;

                        const iconKey =
                            category.icon_key ||
                            "sparkles";

                        const iconColor =
                            this.categoryIconColor(
                                category.icon_color
                            );

                        const iconClass =
                            this.categoryIcon(
                                iconKey
                            );

                        return `
                            <a
                                href="${Components.e(
                                    this.categoryUrl(name)
                                )}"
                                class="rukhnav-category-card"
                                style="--category-accent:${Components.e(
                                    iconColor
                                )}"
                            >

                                ${
                                    image
                                        ? `
                                            <div class="rukhnav-category-visual rukhnav-category-visual--image">
                                                <img
                                                    class="cms-category-image"
                                                    src="${Components.e(
                                                        image
                                                    )}"
                                                    alt="${Components.e(
                                                        name
                                                    )}"
                                                >
                                            </div>
                                        `
                                        : `
                                            <div class="rukhnav-category-visual rukhnav-category-visual--icon">
                                                <i
                                                    class="fa-solid ${Components.e(
                                                        iconClass
                                                    )}"
                                                    aria-hidden="true"
                                                ></i>
                                            </div>
                                        `
                                }

                                <b>
                                    ${Components.e(name)}
                                </b>

                                <span>
                                    ${Components.e(
                                        description
                                    )}
                                </span>

                            </a>
                        `;
                    }
                )
                .join("");

        return true;
    },


    async refreshAccountAvatar() {
        const image =
            document.getElementById(
                "headerAccountImage"
            );

        const initials =
            document.getElementById(
                "headerAccountInitials"
            );

        const icon =
            document.getElementById(
                "headerAccountIcon"
            );

        if (
            !image ||
            !initials ||
            !icon
        ) {
            return;
        }

        const showGuest = () => {
            image.classList.add(
                "hidden"
            );

            image.removeAttribute(
                "src"
            );

            initials.classList.add(
                "hidden"
            );

            initials.textContent = "";

            icon.classList.remove(
                "hidden"
            );
        };

        const showInitials = customer => {
            const name =
                String(
                    customer?.full_name ||
                    customer?.first_name ||
                    customer?.name ||
                    "RUKHNAV Customer"
                )
                    .trim();

            const letters =
                name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(part =>
                        part
                            .charAt(0)
                            .toUpperCase()
                    )
                    .join("") ||
                "R";

            image.classList.add(
                "hidden"
            );

            image.removeAttribute(
                "src"
            );

            icon.classList.add(
                "hidden"
            );

            initials.textContent =
                letters;

            initials.classList.remove(
                "hidden"
            );
        };

        const showImage = url => {
            image.src = url;

            image.onload = () => {
                icon.classList.add(
                    "hidden"
                );

                initials.classList.add(
                    "hidden"
                );

                image.classList.remove(
                    "hidden"
                );
            };

            image.onerror = () => {
                const customer =
                    API.customerRecord();

                showInitials(
                    customer
                );
            };
        };

        if (
            !API.isAuthenticated()
        ) {
            showGuest();
            return;
        }

        const storedCustomer =
            API.customerRecord() ||
            {};

        try {
            const data =
                await API.get(
                    "/api/profile"
                );

            const profile =
                data?.profile ||
                data?.customer ||
                data ||
                {};

            const mergedCustomer = {
                ...storedCustomer,
                ...profile
            };

            const picture =
                profile.profile_picture_url ||
                profile.profile_picture ||
                storedCustomer.profile_picture_url ||
                storedCustomer.profile_picture ||
                "";

            if (picture) {
                const url =
                    /^https?:\/\//i.test(
                        picture
                    )
                        ? picture
                        : `${API.base}/${String(
                            picture
                        ).replace(
                            /^\/+/, ""
                        )}`;

                showImage(url);
            } else {
                showInitials(
                    mergedCustomer
                );
            }
        } catch (error) {
            console.warn(
                "Unable to refresh storefront account avatar.",
                error
            );

            const picture =
                storedCustomer.profile_picture_url ||
                storedCustomer.profile_picture ||
                "";

            if (picture) {
                const url =
                    /^https?:\/\//i.test(
                        picture
                    )
                        ? picture
                        : `${API.base}/${String(
                            picture
                        ).replace(
                            /^\/+/, ""
                        )}`;

                showImage(url);
            } else {
                showInitials(
                    storedCustomer
                );
            }
        }
    },


    async init() {
        try {
            this.settings =
                await Theme.load();
        } catch (error) {
            console.warn(
                "Store theme initialization failed; safe defaults are active.",
                error
            );

            this.settings =
                Theme.defaults || {};
        }

        try {

            await this.loadCategories();

            Components.header(
                this.settings
            );

            Components.footer(
                this.settings
            );

            await this.refreshAccountAvatar();

            this.renderCategoryNavigation();
            this.renderHomepageCategories();

            this.bind();
        } finally {
            await Promise.allSettled([
                this.refreshCartCount(),
                this.refreshWishlistCount()
            ]);

            document.dispatchEvent(
                new CustomEvent(
                    "rukhnav:store-ready",
                    {
                        detail:
                            this.settings
                    }
                )
            );
        }
    },

    bind() {
        document
            .getElementById(
                "globalSearch"
            )
            ?.addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    const query =
                        document
                            .getElementById(
                                "searchInput"
                            )
                            ?.value
                            .trim() ||
                        "";

                    const category =
                        document
                            .getElementById(
                                "searchCategory"
                            )
                            ?.value ||
                        "";

                    const parameters =
                        new URLSearchParams();

                    if (query) {
                        parameters.set(
                            "search",
                            query
                        );
                    }

                    if (category) {
                        parameters.set(
                            "category",
                            category
                        );
                    }

                    const suffix =
                        parameters.toString();

                    location.href =
                        `products.html${
                            suffix
                                ? `?${suffix}`
                                : ""
                        }`;
                }
            );

        const menu =
            document.getElementById(
                "mobileMenu"
            );

        const overlay =
            document.getElementById(
                "overlay"
            );

        const open = () => {
            menu?.classList.add("open");
            overlay?.classList.add("show");
        };

        const close = () => {
            menu?.classList.remove("open");
            overlay?.classList.remove("show");
        };

        document
            .getElementById("menuBtn")
            ?.addEventListener(
                "click",
                open
            );

        document
            .getElementById("closeMenu")
            ?.addEventListener(
                "click",
                close
            );

        overlay
            ?.addEventListener(
                "click",
                close
            );
    },

    img(product = {}) {
        const value =
            product.image ||
            product.product_image ||
            product.image_url ||
            product.main_image ||
            "";

        if (!value) {
            return "";
        }

        if (
            /^(https?:)?\/\//i.test(value) ||
            value.startsWith("data:")
        ) {
            return value;
        }

        if (value.startsWith("/")) {
            return `${API.base}${value}`;
        }

        return `${API.base}/uploads/products/${value}`;
    },

    money(value) {
        const symbol =
            this.settings.store
                ?.currency_symbol ||
            this.settings.currency_symbol ||
            "Rs.";

        return `${symbol} ${
            new Intl.NumberFormat(
                "en-PK",
                {
                    maximumFractionDigits: 2
                }
            ).format(
                Number(value) || 0
            )
        }`;
    },

    card(product = {}) {
        const id =
            product.id;

        const name =
            product.product_name ||
            product.name ||
            "Product";

        const category =
            product.category ||
            product.category_name ||
            "RUKHNAV";

        const price =
            product.selling_price ??
            product.price ??
            0;

        const stock =
            Number(
                product.stock_quantity ??
                product.stock ??
                0
            );

        const image =
            this.img(product);

        return `
            <article class="product-card">
                <a
                    class="product-image"
                    href="product.html?id=${encodeURIComponent(id)}"
                >
                    ${
                        image
                            ? `
                                <img
                                    src="${Components.e(image)}"
                                    alt="${Components.e(name)}"
                                >
                            `
                            : `
                                <div class="placeholder">
                                    <i class="fa-solid fa-spa"></i>
                                </div>
                            `
                    }
                </a>

                <button
                    class="wish-card"
                    data-wish="${Components.e(id)}"
                    type="button"
                    aria-label="Add to wishlist"
                >
                    <i class="fa-regular fa-heart"></i>
                </button>

                <div class="product-body">
                    <small>
                        ${Components.e(category)}
                    </small>

                    <a href="product.html?id=${encodeURIComponent(id)}">
                        ${Components.e(name)}
                    </a>

                    <div class="stars">
                        ★★★★★
                    </div>

                    <div class="price-row">
                        <span class="price">
                            ${this.money(price)}
                        </span>

                        <button
                            class="add-card"
                            data-cart="${Components.e(id)}"
                            type="button"
                            ${stock < 1 ? "disabled" : ""}
                            aria-label="Add product to cart"
                        >
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    bindCards(container) {
        container
            ?.addEventListener(
                "click",
                async event => {
                    const cart =
                        event.target.closest(
                            "[data-cart]"
                        );

                    const wish =
                        event.target.closest(
                            "[data-wish]"
                        );

                    if (cart) {
                        cart.disabled = true;

                        try {
                            await this.addCart(
                                cart.dataset.cart,
                                1
                            );

                            this.toast(
                                "Product added to cart."
                            );
                        } catch (error) {
                            this.toast(
                                error.message,
                                "error"
                            );
                        } finally {
                            cart.disabled = false;
                        }
                    }

                    if (wish) {
                        try {
                            await this.toggleWish(
                                wish.dataset.wish
                            );

                            this.toast(
                                "Wishlist updated."
                            );
                        } catch (error) {
                            this.toast(
                                error.message,
                                "error"
                            );
                        }
                    }
                }
            );
    },

    async addCart(
        productId,
        quantity = 1
    ) {
        const amount =
            Math.max(
                1,
                Math.floor(
                    Number(quantity) || 1
                )
            );

        /*
         * Try the authenticated cart first only when a
         * real customer token exists.
         */
        if (API.isAuthenticated()) {
            try {
                const data =
                    await API.post(
                        API.cart,
                        {
                            product_id:
                                Number(productId),

                            quantity:
                                amount
                        }
                    );

                await this.refreshCartCount();

                return data;

            } catch (error) {
                /*
                 * An expired/invalid customer session should not
                 * prevent shopping. Clear it and continue using
                 * the browser guest cart.
                 */
                if (
                    error.status !== 401 &&
                    error.status !== 403
                ) {
                    throw error;
                }

                API.clearCustomerSession();
            }
        }

        const cart =
            this.read(
                this.cartKey
            );

        const existing =
            cart.find(
                item =>
                    String(
                        item.productId
                    ) ===
                    String(productId)
            );

        if (existing) {
            existing.quantity =
                Number(
                    existing.quantity ||
                    0
                ) + amount;
        } else {
            cart.push({
                productId:
                    Number(productId),

                quantity:
                    amount
            });
        }

        this.write(
            this.cartKey,
            cart
        );

        await this.refreshCartCount();

        return {
            success: true,
            guest: true
        };
    },

    async refreshCartCount() {
        let count = 0;

        if (API.isAuthenticated()) {
            try {
                const data =
                    await API.get(
                        API.cart
                    );

                const items =
                    Array.isArray(data.cart)
                        ? data.cart
                        : Array.isArray(data.items)
                            ? data.items
                            : [];

                count =
                    Number(
                        data.itemCount ??
                        data.item_count
                    );

                if (!Number.isFinite(count)) {
                    count =
                        items.reduce(
                            (total, item) =>
                                total +
                                Number(
                                    item.quantity ||
                                    0
                                ),
                            0
                        );
                }
            } catch (error) {
                if (
                    error.status === 401 ||
                    error.status === 403
                ) {
                    API.clearCustomerSession();
                }

                count =
                    this.read(
                        this.cartKey
                    ).reduce(
                        (total, item) =>
                            total +
                            Number(
                                item.quantity ||
                                0
                            ),
                        0
                    );
            }
        } else {
            count =
                this.read(
                    this.cartKey
                ).reduce(
                    (total, item) =>
                        total +
                        Number(
                            item.quantity ||
                            0
                        ),
                    0
                );
        }

        [
            "cartCount",
            "header-cart-count"
        ].forEach(id => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent =
                    count;
            }
        });

        return count;
    },

    async mergeGuestCart() {
        if (!API.isAuthenticated()) {
            return;
        }

        const guestCart =
            this.read(
                this.cartKey
            );

        if (!guestCart.length) {
            return;
        }

        let merged = 0;

        for (const item of guestCart) {
            try {
                await API.post(
                    API.cart,
                    {
                        product_id:
                            Number(
                                item.productId
                            ),

                        quantity:
                            Math.max(
                                1,
                                Number(
                                    item.quantity ||
                                    1
                                )
                            )
                    }
                );

                merged += 1;
            } catch (error) {
                console.warn(
                    "Guest cart item could not be merged:",
                    error
                );
            }
        }

        if (merged) {
            localStorage.removeItem(
                this.cartKey
            );

            localStorage.setItem(
                this.cartSyncKey,
                String(Date.now())
            );

            document.dispatchEvent(
                new CustomEvent(
                    "rukhnav:cart-merged"
                )
            );
        }

        await this.refreshCartCount();
    },

    addGuestWishlist(productId) {
        const wishlist =
            this.read(
                this.wishKey
            );

        if (
            !wishlist.some(
                id =>
                    String(id) ===
                    String(productId)
            )
        ) {
            wishlist.push(
                Number(productId)
            );

            this.write(
                this.wishKey,
                wishlist
            );
        }

        this.refreshWishlistCount();
    },

    removeGuestWishlist(productId) {
        const wishlist =
            this.read(
                this.wishKey
            ).filter(
                id =>
                    String(id) !==
                    String(productId)
            );

        this.write(
            this.wishKey,
            wishlist
        );

        this.refreshWishlistCount();
    },

    async toggleWish(productId) {
        if (API.isAuthenticated()) {
            try {
                const data =
                    await API.post(
                        "/api/wishlist/toggle",
                        {
                            product_id:
                                Number(productId)
                        }
                    );

                await this.refreshWishlistCount();

                return data;
            } catch (error) {
                if (
                    error.status !== 404 &&
                    error.status !== 405
                ) {
                    throw error;
                }
            }
        }

        const wishlist =
            this.read(
                this.wishKey
            );

        const exists =
            wishlist.some(
                id =>
                    String(id) ===
                    String(productId)
            );

        if (exists) {
            this.removeGuestWishlist(
                productId
            );
        } else {
            this.addGuestWishlist(
                productId
            );
        }

        return {
            success: true,
            guest: true,
            added: !exists
        };
    },

    async refreshWishlistCount() {
        let count = 0;

        if (API.isAuthenticated()) {
            try {
                const data =
                    await API.get(
                        "/api/wishlist"
                    );

                const rows =
                    Array.isArray(
                        data.wishlist
                    )
                        ? data.wishlist
                        : Array.isArray(
                            data.items
                        )
                            ? data.items
                            : [];

                count =
                    Number(
                        data.count ??
                        data.itemCount
                    );

                if (!Number.isFinite(count)) {
                    count =
                        rows.length;
                }
            } catch {
                count =
                    this.read(
                        this.wishKey
                    ).length;
            }
        } else {
            count =
                this.read(
                    this.wishKey
                ).length;
        }

        [
            "wishCount",
            "wishlistCount"
        ].forEach(id => {
            const element =
                document.getElementById(id);

            if (element) {
                element.textContent =
                    count;
            }
        });

        return count;
    },

    async mergeGuestWishlist() {
        if (!API.isAuthenticated()) {
            return;
        }

        const wishlist =
            this.read(
                this.wishKey
            );

        for (const productId of wishlist) {
            try {
                await API.post(
                    "/api/wishlist",
                    {
                        product_id:
                            Number(productId)
                    }
                );
            } catch {
                // Keep processing other products.
            }
        }

        if (wishlist.length) {
            localStorage.removeItem(
                this.wishKey
            );

            localStorage.setItem(
                this.wishSyncKey,
                String(Date.now())
            );
        }

        await this.refreshWishlistCount();
    },

    toast(
        message,
        type = "success"
    ) {
        const region =
            document.getElementById(
                "toast"
            );

        if (!region) {
            console.info(message);
            return;
        }

        const element =
            document.createElement(
                "div"
            );

        element.className =
            `toast ${type}`;

        element.textContent =
            message;

        region.appendChild(
            element
        );

        setTimeout(
            () => element.remove(),
            3200
        );
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => Store.init()
);
