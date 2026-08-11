"use strict";

const ProductDetails = {
    product: null,
    images: [],
    products: [],
    quantity: 1,
    activeImageIndex: 0,
    activeTab: "description",
    placeholderCount: 10,
    reviewData: null,
    reviewsLoading: false,
    reviewEligible: false,
    reviewPhotosOnly: false,

    async init() {
        this.bind();

        const productId =
            Number.parseInt(
                new URLSearchParams(
                    location.search
                ).get("id"),
                10
            );

        if (
            !Number.isInteger(productId) ||
            productId <= 0
        ) {
            this.fail(
                "A valid product ID is required."
            );
            return;
        }

        try {
            const results =
                await Promise.allSettled([
                    API.get(
                        API.product(productId)
                    ),
                    API.get(
                        `/api/product-media/public/${productId}`
                    ),
                    API.get(
                        "/api/products"
                    )
                ]);

            const detailResult =
                results[0];

            if (
                detailResult.status !==
                "fulfilled"
            ) {
                throw detailResult.reason;
            }

            const detail =
                detailResult.value;

            this.product =
                detail.product ||
                detail.data ||
                detail;

            if (!this.product?.id) {
                throw new Error(
                    "Product not found or unavailable."
                );
            }

            if (
                results[1].status ===
                "fulfilled"
            ) {
                this.images =
                    Array.isArray(
                        results[1].value.images
                    )
                        ? results[1].value.images
                        : [];
            }

            if (
                results[2].status ===
                "fulfilled"
            ) {
                const list =
                    results[2].value;

                this.products =
                    Array.isArray(list.products)
                        ? list.products
                        : Array.isArray(list.data)
                            ? list.data
                            : Array.isArray(list)
                                ? list
                                : [];
            }

            this.render();
            this.remember();

            document
                .getElementById(
                    "pdLoading"
                )
                ?.classList.add(
                    "hidden"
                );

            document
                .getElementById(
                    "pdContent"
                )
                ?.classList.remove(
                    "hidden"
                );

        } catch (error) {
            this.fail(
                error.message ||
                "Unable to load product."
            );
        }
    },

    bind() {
        document
            .getElementById("pdMinus")
            ?.addEventListener(
                "click",
                () =>
                    this.changeQty(-1)
            );

        document
            .getElementById("pdPlus")
            ?.addEventListener(
                "click",
                () =>
                    this.changeQty(1)
            );

        document
            .getElementById("pdQuantity")
            ?.addEventListener(
                "change",
                event => {
                    this.quantity =
                        this.limitQty(
                            Number(
                                event.target.value
                            ) || 1
                        );

                    event.target.value =
                        this.quantity;
                }
            );

        document
            .getElementById("pdAddCart")
            ?.addEventListener(
                "click",
                () =>
                    this.addCart()
            );

        document
            .getElementById("pdBuyNow")
            ?.addEventListener(
                "click",
                () =>
                    this.buyNow()
            );

        document
            .getElementById("pdWishlist")
            ?.addEventListener(
                "click",
                () =>
                    this.wishlist()
            );

        document
            .getElementById("pdThumbPrev")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "pdThumbs",
                        -360
                    )
            );

        document
            .getElementById("pdThumbNext")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "pdThumbs",
                        360
                    )
            );

        document
            .getElementById("pdImagePrev")
            ?.addEventListener(
                "click",
                () =>
                    this.stepImage(-1)
            );

        document
            .getElementById("pdImageNext")
            ?.addEventListener(
                "click",
                () =>
                    this.stepImage(1)
            );

        document
            .getElementById("relatedPrev")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "relatedProducts",
                        -820
                    )
            );

        document
            .getElementById("relatedNext")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "relatedProducts",
                        820
                    )
            );

        document
            .getElementById("popularPrev")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "popularProducts",
                        -820
                    )
            );

        document
            .getElementById("popularNext")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "popularProducts",
                        820
                    )
            );

        document
            .getElementById("recentPrev")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "recentProducts",
                        -820
                    )
            );

        document
            .getElementById("recentNext")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "recentProducts",
                        820
                    )
            );

        document
            .getElementById("newPrev")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "newProducts",
                        -820
                    )
            );

        document
            .getElementById("newNext")
            ?.addEventListener(
                "click",
                () =>
                    this.scroll(
                        "newProducts",
                        820
                    )
            );

        document
            .getElementById("pdZoomButton")
            ?.addEventListener(
                "click",
                () =>
                    this.openLightbox()
            );

        document
            .getElementById("pdMainImage")
            ?.addEventListener(
                "click",
                () =>
                    this.openLightbox()
            );

        document
            .getElementById("pdLightboxClose")
            ?.addEventListener(
                "click",
                () =>
                    this.closeLightbox()
            );

        document
            .getElementById("pdLightboxPrev")
            ?.addEventListener(
                "click",
                () =>
                    this.stepLightbox(-1)
            );

        document
            .getElementById("pdLightboxNext")
            ?.addEventListener(
                "click",
                () =>
                    this.stepLightbox(1)
            );

        document
            .getElementById("pdLightbox")
            ?.addEventListener(
                "click",
                event => {
                    if (
                        event.target.id ===
                        "pdLightbox"
                    ) {
                        this.closeLightbox();
                    }
                }
            );

        document
            .getElementById("pdReviewLink")
            ?.addEventListener(
                "click",
                () =>
                    this.scrollToReviews()
            );

        document
            .querySelectorAll("[data-tab]")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        this.tab(
                            button.dataset.tab
                        )
                );
            });

        document
            .querySelectorAll("[data-share]")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        this.share(
                            button.dataset.share
                        )
                );
            });

        document
            .getElementById(
                "reviewImageLightboxClose"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.closeReviewImage()
            );

        document
            .getElementById(
                "reviewImageLightbox"
            )
            ?.addEventListener(
                "click",
                event => {
                    if (
                        event.target.id ===
                        "reviewImageLightbox"
                    ) {
                        this.closeReviewImage();
                    }
                }
            );

        document.addEventListener(
            "keydown",
            event => {
                const lightbox =
                    document.getElementById(
                        "pdLightbox"
                    );

                if (
                    lightbox?.classList
                        .contains("hidden")
                ) {
                    return;
                }

                if (event.key === "Escape") {
                    this.closeLightbox();
                }

                if (event.key === "ArrowLeft") {
                    this.stepLightbox(-1);
                }

                if (event.key === "ArrowRight") {
                    this.stepLightbox(1);
                }
            }
        );
    },

    stock(product = this.product) {
        return Number(
            product?.stock_quantity ??
            product?.stock ??
            0
        );
    },

    price(product = this.product) {
        const discount =
            Number(
                product?.discount_price ||
                0
            );

        return discount > 0
            ? discount
            : Number(
                product?.selling_price ??
                product?.price ??
                0
            );
    },

    regularPrice(product = this.product) {
        return Number(
            product?.selling_price ??
            product?.price ??
            0
        );
    },

    imageUrl(value) {
        if (!value) {
            return "";
        }

        const path =
            String(value);

        if (
            /^https?:\/\//i.test(path) ||
            path.startsWith("data:") ||
            path.startsWith("blob:")
        ) {
            return path;
        }

        if (
            path.startsWith("/store/") ||
            path.startsWith("images/")
        ) {
            return path;
        }

        const clean =
            path.replace(/^\/+/, "");

        if (
            clean.startsWith("uploads/") ||
            clean.startsWith("store/")
        ) {
            return `${API.base}/${clean}`;
        }

        return `${API.base}/uploads/products/${clean}`;
    },

    placeholderImages() {
        const name =
            this.product?.product_name ||
            "RUKHNAV Product";

        return Array.from(
            {
                length:
                    this.placeholderCount
            },
            (_, index) => ({
                id:
                    `placeholder-${index + 1}`,

                image_url:
                    `images/product-placeholders/product-placeholder-${String(index + 1).padStart(2, "0")}.svg`,

                image_alt:
                    `${name} gallery view ${index + 1}`,

                placeholder:
                    true,

                sort_order:
                    index + 1
            })
        );
    },

    render() {
        const product =
            this.product;

        document.title =
            `${product.product_name || "Product"} | RUKHNAV`;

        this.text(
            "pdName",
            product.product_name ||
            "Product"
        );

        this.text(
            "pdBreadcrumbName",
            product.product_name ||
            "Product"
        );

        this.text(
            "pdCategory",
            product.category ||
            "RUKHNAV"
        );

        this.text(
            "pdBrand",
            product.brand ||
            "RUKHNAV"
        );

        this.text(
            "pdPrice",
            Store.money(
                this.price()
            )
        );

        this.text(
            "pdShortDescription",
            product.description ||
            "A carefully selected RUKHNAV product for your beauty and personal-care routine."
        );

        this.text(
            "pdSku",
            product.sku ||
            "Not assigned"
        );

        this.text(
            "pdUnit",
            product.unit ||
            "Piece"
        );

        this.text(
            "pdWeight",
            product.weight ||
            "Not specified"
        );

        this.text(
            "pdBatch",
            product.batch_number ||
            "Not specified"
        );

        this.renderPrice();
        this.renderRating();
        this.renderStock();
        this.renderBadges();
        this.renderGallery();
        this.tab("description");
        this.renderInlineReviews();
        this.renderCarousels();
    },

    renderPrice() {
        const regular =
            this.regularPrice();

        const current =
            this.price();

        const oldPrice =
            document.getElementById(
                "pdOldPrice"
            );

        const badge =
            document.getElementById(
                "pdDiscountBadge"
            );

        if (
            regular > current &&
            current > 0
        ) {
            const percentage =
                Math.round(
                    (
                        (
                            regular -
                            current
                        ) /
                        regular
                    ) *
                    100
                );

            if (oldPrice) {
                oldPrice.textContent =
                    Store.money(regular);

                oldPrice.classList
                    .remove("hidden");
            }

            if (badge) {
                badge.textContent =
                    `${percentage}% OFF`;

                badge.classList
                    .remove("hidden");
            }

            return;
        }

        oldPrice?.classList.add(
            "hidden"
        );

        badge?.classList.add(
            "hidden"
        );
    },

    renderRating() {
        const rating =
            Number(
                this.product.averageRating ??
                this.product.average_rating ??
                0
            );

        const total =
            Number(
                this.product.totalReviews ??
                this.product.total_reviews ??
                0
            );

        const rounded =
            Math.max(
                0,
                Math.min(
                    5,
                    Math.round(rating)
                )
            );

        this.text(
            "pdStars",
            "★".repeat(rounded) +
            "☆".repeat(5 - rounded)
        );

        this.text(
            "pdReviewSummary",
            total > 0
                ? `${rating.toFixed(1)} from ${total} review${total === 1 ? "" : "s"}`
                : "No reviews yet"
        );
    },

    renderStock() {
        const stock =
            this.stock();

        const stockBox =
            document.getElementById(
                "pdStockBox"
            );

        const quantity =
            document.getElementById(
                "pdQuantity"
            );

        const available =
            stock > 0;

        this.text(
            "pdStock",
            available
                ? `${stock} in stock`
                : "Out of stock"
        );

        this.text(
            "pdStockNote",
            stock > 0 &&
            stock <= 5
                ? "Low stock — order soon"
                : "Live ERP availability"
        );

        stockBox?.classList.toggle(
            "out",
            !available
        );

        stockBox?.classList.toggle(
            "low",
            stock > 0 &&
            stock <= 5
        );

        if (quantity) {
            quantity.max =
                Math.max(1, stock);

            quantity.disabled =
                !available;
        }

        [
            "pdAddCart",
            "pdBuyNow"
        ].forEach(id => {
            const button =
                document.getElementById(id);

            if (button) {
                button.disabled =
                    !available;
            }
        });
    },

    renderBadges() {
        const badges = [];

        if (
            this.product.is_featured === 1 ||
            this.product.is_featured === true
        ) {
            badges.push(
                '<span class="featured">Featured</span>'
            );
        }

        if (
            String(
                this.product.stock_status ||
                ""
            )
                .toLowerCase()
                .includes("low")
        ) {
            badges.push(
                '<span class="low">Low Stock</span>'
            );
        }

        if (
            Number(
                this.product.discount_price ||
                0
            ) > 0
        ) {
            badges.push(
                '<span class="sale">Sale</span>'
            );
        }

        document
            .getElementById("pdBadges")
            ?.replaceChildren();

        const container =
            document.getElementById(
                "pdBadges"
            );

        if (container) {
            container.innerHTML =
                badges.join("");
        }
    },

    renderGallery() {
        const galleryImages = [];

        const primaryImage =
            this.product.image ||
            this.product.product_image ||
            this.product.image_url ||
            this.product.main_image ||
            this.product.thumbnail ||
            "";

        if (primaryImage) {
            galleryImages.push({
                id:
                    "product-main",

                image_url:
                    primaryImage,

                image_alt:
                    this.product.product_name ||
                    this.product.name ||
                    "RUKHNAV Product",

                is_primary:
                    true
            });
        }

        galleryImages.push(
            ...this.images
        );

        const unique = [];
        const seen =
            new Set();

        galleryImages.forEach(image => {
            const url =
                this.imageUrl(
                    image.image_url ||
                    image.image
                );

            if (
                url &&
                !seen.has(url)
            ) {
                seen.add(url);

                unique.push({
                    ...image,
                    url
                });
            }
        });

        if (
            unique.length <
            this.placeholderCount
        ) {
            this.placeholderImages()
                .forEach(image => {
                    const url =
                        this.imageUrl(
                            image.image_url
                        );

                    if (!seen.has(url)) {
                        seen.add(url);

                        unique.push({
                            ...image,
                            url
                        });
                    }
                });
        }

        this.images =
            unique.slice(
                0,
                Math.max(
                    this.placeholderCount,
                    unique.length
                )
            );

        this.activeImageIndex =
            0;

        const thumbs =
            document.getElementById(
                "pdThumbs"
            );

        if (thumbs) {
            thumbs.innerHTML =
                this.images
                    .map(
                        (image, index) => `
                            <button
                                type="button"
                                class="${index === 0 ? "active" : ""}"
                                data-image-index="${index}"
                                aria-label="View product image ${index + 1}"
                            >
                                <img
                                    src="${Components.e(image.url)}"
                                    alt="${Components.e(image.image_alt || `Product image ${index + 1}`)}"
                                    loading="${index > 3 ? "lazy" : "eager"}"
                                >
                            </button>
                        `
                    )
                    .join("");

            thumbs
                .querySelectorAll(
                    "[data-image-index]"
                )
                .forEach(button => {
                    button.addEventListener(
                        "click",
                        () =>
                            this.selectImage(
                                Number(
                                    button.dataset.imageIndex
                                )
                            )
                    );
                });
        }

        this.selectImage(0);
    },

    selectImage(index) {
        if (!this.images.length) {
            return;
        }

        const normalized =
            (
                index +
                this.images.length
            ) %
            this.images.length;

        this.activeImageIndex =
            normalized;

        const image =
            this.images[normalized];

        const main =
            document.getElementById(
                "pdMainImage"
            );

        if (main) {
            main.src =
                image.url;

            main.alt =
                image.image_alt ||
                this.product.product_name ||
                "Product image";
        }

        document
            .querySelectorAll(
                "#pdThumbs [data-image-index]"
            )
            .forEach(button => {
                const active =
                    Number(
                        button.dataset.imageIndex
                    ) ===
                    normalized;

                button.classList.toggle(
                    "active",
                    active
                );

                if (active) {
                    button.scrollIntoView({
                        behavior:
                            "smooth",

                        block:
                            "nearest",

                        inline:
                            "center"
                    });
                }
            });

        this.text(
            "pdImageCounter",
            `${normalized + 1} / ${this.images.length}`
        );

        this.updateLightbox();
    },

    stepImage(direction) {
        this.selectImage(
            this.activeImageIndex +
            direction
        );
    },

    tab(name) {
        this.activeTab =
            name;

        document
            .querySelectorAll(
                "[data-tab]"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.tab ===
                    name
                );
            });

        const product =
            this.product ||
            {};

        const content =
            document.getElementById(
                "pdTabContent"
            );

        if (!content) {
            return;
        }

        const defaults = {
            description:
                "Detailed product information can be added from ERP Website Management.",

            ingredients:
                "Ingredients information can be added from ERP Website Management.",

            directions:
                "Directions for use can be added from ERP Website Management.",

            warnings:
                "Warnings and precautions can be added from ERP Website Management."
        };

        const headings = {
            description:
                "Product description",

            ingredients:
                "Ingredients",

            directions:
                "Directions for use",

            warnings:
                "Warnings and precautions"
        };

        if (
            [
                "description",
                "ingredients",
                "directions",
                "warnings"
            ].includes(name)
        ) {
            const value =
                product[name] ||
                defaults[name];

            content.innerHTML = `
                <div class="pd-tab-copy">
                    <h3>${headings[name]}</h3>
                    <p>${Components.e(value)}</p>
                </div>
            `;

            this.scrollTabsIntoView();
            return;
        }

        if (name === "shipping") {
            content.innerHTML = `
                <div class="pd-policy-grid">
                    <article>
                        <i class="fa-solid fa-truck-fast"></i>
                        <h3>Shipping</h3>
                        <p>
                            RUKHNAV aims to deliver across Pakistan where courier service is available.
                            Delivery dates are estimates and may vary by location and courier conditions.
                        </p>
                    </article>

                    <article>
                        <i class="fa-solid fa-box-open"></i>
                        <h3>Returns</h3>
                        <p>
                            For hygiene and safety, opened cosmetics and personal-care products are normally
                            non-returnable unless damaged, defective or incorrectly supplied.
                        </p>
                    </article>

                    <article>
                        <i class="fa-solid fa-headset"></i>
                        <h3>Support</h3>
                        <p>
                            Keep your order number and contact RUKHNAV promptly if a parcel arrives damaged,
                            incomplete or incorrect.
                        </p>
                    </article>
                </div>
            `;

            this.scrollTabsIntoView();
            return;
        }

        if (name === "reviews") {
            this.scrollToReviews();
        }
    },

    renderInlineReviews() {
        const mount =
            document.getElementById(
                "productReviewsInlineMount"
            );

        if (!mount) {
            return;
        }

        mount.innerHTML =
            this.reviewShellMarkup();

        this.bindReviewInterface();
        this.loadReviews();

        if (API.isAuthenticated()) {
            this.loadReviewEligibility();
        }

        document
            .getElementById(
                "scrollToReviewFormButton"
            )
            ?.addEventListener(
                "click",
                () => {
                    const form =
                        document.getElementById(
                            "productReviewForm"
                        );

                    if (form) {
                        form.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });

                        form.querySelector(
                            "select, textarea, input"
                        )?.focus();

                        return;
                    }

                    this.scrollToReviews();
                }
            );
    },

    scrollToReviews() {
        document
            .getElementById(
                "productReviewsInlineSection"
            )
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    },

    reviewShellMarkup() {
        return `
            <section class="product-reviews-module">

                <div class="review-list-heading">
                    <div>
                        <span>Customer Feedback</span>
                        <h3>Reviews &amp; photos</h3>
                    </div>

                    <button
                        id="refreshReviewsButton"
                        type="button"
                        class="btn secondary"
                    >
                        <i class="fa-solid fa-rotate"></i>
                        Refresh
                    </button>
                </div>

                <div class="review-public-filters">
                    <label>
                        <span>Rating</span>
                        <select id="publicReviewRatingFilter">
                            <option value="">All ratings</option>
                            <option value="5">5 stars</option>
                            <option value="4">4 stars</option>
                            <option value="3">3 stars</option>
                            <option value="2">2 stars</option>
                            <option value="1">1 star</option>
                        </select>
                    </label>

                    <label>
                        <span>Sort</span>
                        <select id="publicReviewSort">
                            <option value="latest">Most recent</option>
                            <option value="helpful">Most helpful</option>
                            <option value="highest">Highest rating</option>
                            <option value="lowest">Lowest rating</option>
                            <option value="oldest">Oldest first</option>
                        </select>
                    </label>

                    <label class="review-photo-filter">
                        <input
                            id="publicReviewPhotosOnly"
                            type="checkbox"
                        >
                        <span>With customer photos only</span>
                    </label>
                </div>

                <div
                    id="productReviewsLoading"
                    class="review-list-state"
                >
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    Loading customer reviews...
                </div>

                <div
                    id="productReviewsEmpty"
                    class="review-list-state hidden"
                >
                    <i class="fa-regular fa-star"></i>
                    <strong>
                        Be the first to review this product
                    </strong>
                    <span>
                        Customer comments and photos will appear here.
                    </span>
                </div>

                <div
                    id="productReviewsList"
                    class="product-reviews-list"
                ></div>

                <div class="review-experience-heading">
                    <span>
                        Verified Customer Experience
                    </span>

                    <h3>
                        Customer Reviews &amp; Photos
                    </h3>

                    <p>
                        Ratings are calculated from approved customer
                        reviews and verified purchases.
                    </p>
                </div>

                <div class="review-overview">
                    <div class="review-score-card">
                        <strong id="reviewAverageScore">
                            0.0
                        </strong>

                        <span id="reviewAverageStars">
                            ☆☆☆☆☆
                        </span>

                        <small id="reviewTotalCount">
                            No reviews yet
                        </small>
                    </div>

                    <div
                        id="reviewDistribution"
                        class="review-distribution"
                    >
                        ${[5,4,3,2,1].map(star => `
                            <div>
                                <span>${star} star</span>
                                <i>
                                    <b style="width:0%"></b>
                                </i>
                                <em>0</em>
                            </div>
                        `).join("")}
                    </div>
                </div>

                <div class="review-create-card">
                    <div>
                        <span>
                            Share Your Experience
                        </span>

                        <h3>
                            Write a review with photos
                        </h3>

                        <p>
                            Rate this product, add your comments
                            and upload up to five JPG, PNG or WEBP
                            pictures.
                        </p>
                    </div>

                    ${
                        API.isAuthenticated()
                            ? `
                                <form
                                    id="productReviewForm"
                                    class="product-review-form"
                                >
                                    <label>
                                        <span>
                                            Your rating *
                                        </span>

                                        <select
                                            name="rating"
                                            required
                                        >
                                            <option value="">
                                                Choose rating
                                            </option>
                                            <option value="5">
                                                5 — Excellent
                                            </option>
                                            <option value="4">
                                                4 — Very good
                                            </option>
                                            <option value="3">
                                                3 — Good
                                            </option>
                                            <option value="2">
                                                2 — Fair
                                            </option>
                                            <option value="1">
                                                1 — Poor
                                            </option>
                                        </select>
                                    </label>

                                    <label>
                                        <span>
                                            Your comments *
                                        </span>

                                        <textarea
                                            name="comment"
                                            rows="4"
                                            minlength="5"
                                            maxlength="2000"
                                            placeholder="Tell other customers about your experience..."
                                            required
                                        ></textarea>
                                    </label>

                                    <label class="review-photo-picker">
                                        <span>
                                            Customer photos
                                        </span>

                                        <input
                                            id="productReviewImages"
                                            type="file"
                                            name="review_images"
                                            accept="image/jpeg,image/png,image/webp"
                                            multiple
                                        >

                                        <small>
                                            Maximum 5 pictures, 5 MB each.
                                        </small>
                                    </label>

                                    <div
                                        id="reviewPhotoPreview"
                                        class="review-photo-preview"
                                    ></div>

                                    <div
                                        id="productReviewEligibility"
                                        class="product-review-eligibility checking"
                                    >
                                        <i class="fa-solid fa-spinner fa-spin"></i>

                                        <span>
                                            Checking whether this delivered
                                            product is eligible for review...
                                        </span>
                                    </div>

                                    <button
                                        id="submitProductReview"
                                        type="submit"
                                        class="btn primary"
                                        disabled
                                    >
                                        <i class="fa-regular fa-star"></i>
                                        Submit Verified Review
                                    </button>

                                    <div
                                        id="productReviewMessage"
                                        class="product-review-message"
                                        aria-live="polite"
                                    ></div>
                                </form>
                            `
                            : `
                                <div class="review-login-prompt">
                                    <i class="fa-regular fa-user"></i>

                                    <p>
                                        Sign in to rate this product and
                                        upload customer photos.
                                    </p>

                                    <a
                                        href="account.html?return=${encodeURIComponent(location.pathname + location.search)}"
                                        class="btn primary"
                                    >
                                        Sign In
                                    </a>
                                </div>
                            `
                    }
                </div>

            </section>
        `;
    },

    bindReviewInterface() {
        document
            .getElementById(
                "refreshReviewsButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.loadReviews(true)
            );

        document
            .getElementById(
                "productReviewForm"
            )
            ?.addEventListener(
                "submit",
                event =>
                    this.submitReview(event)
            );

        document
            .getElementById(
                "productReviewImages"
            )
            ?.addEventListener(
                "change",
                event =>
                    this.previewReviewPhotos(
                        event
                    )
            );

        document
            .getElementById(
                "publicReviewRatingFilter"
            )
            ?.addEventListener(
                "change",
                () => {
                    this.reviewData = null;
                    this.loadReviews(true);
                }
            );

        document
            .getElementById(
                "publicReviewSort"
            )
            ?.addEventListener(
                "change",
                () => {
                    this.reviewData = null;
                    this.loadReviews(true);
                }
            );

        document
            .getElementById(
                "publicReviewPhotosOnly"
            )
            ?.addEventListener(
                "change",
                event => {
                    this.reviewPhotosOnly =
                        Boolean(
                            event.currentTarget.checked
                        );

                    if (this.reviewData) {
                        this.renderReviews(
                            this.reviewData
                        );
                    }
                }
            );

        if (API.isAuthenticated()) {
            this.loadReviewEligibility();
        }
    },


    async loadReviewEligibility() {
        const notice =
            document.getElementById(
                "productReviewEligibility"
            );

        const button =
            document.getElementById(
                "submitProductReview"
            );

        this.reviewEligible =
            false;

        if (button) {
            button.disabled =
                true;
        }

        try {
            const data =
                await API.get(
                    "/api/reviews/eligible-products"
                );

            const products =
                Array.isArray(
                    data.products
                )
                    ? data.products
                    : [];

            const record =
                products.find(
                    product =>
                        Number(
                            product.product_id
                        ) ===
                        Number(
                            this.product.id
                        )
                );

            if (
                record &&
                record.can_review
            ) {
                this.reviewEligible =
                    true;

                if (button) {
                    button.disabled =
                        false;
                }

                if (notice) {
                    notice.className =
                        "product-review-eligibility eligible";

                    notice.innerHTML = `
                        <i class="fa-solid fa-circle-check"></i>
                        <span>
                            Verified delivered purchase. You can review this product and add photos.
                        </span>
                    `;
                }

                return;
            }

            if (
                record &&
                !record.can_review
            ) {
                if (notice) {
                    notice.className =
                        "product-review-eligibility reviewed";

                    notice.innerHTML = `
                        <i class="fa-solid fa-circle-check"></i>
                        <span>
                            You have already submitted a review for this product.
                        </span>
                    `;
                }

                return;
            }

            if (notice) {
                notice.className =
                    "product-review-eligibility unavailable";

                notice.innerHTML = `
                    <i class="fa-solid fa-truck"></i>
                    <span>
                        Reviews are available after an order containing this product has been delivered.
                    </span>
                `;
            }
        } catch (error) {
            if (notice) {
                notice.className =
                    "product-review-eligibility unavailable";

                notice.innerHTML = `
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <span>
                        ${Components.e(
                            error.message ||
                            "Unable to verify review eligibility."
                        )}
                    </span>
                `;
            }
        }
    },

    async loadReviews(force = false) {
        if (
            this.reviewsLoading ||
            (
                this.reviewData &&
                !force
            )
        ) {
            if (this.reviewData) {
                this.renderReviews(
                    this.reviewData
                );
            }
            return;
        }

        this.reviewsLoading =
            true;

        const loading =
            document.getElementById(
                "productReviewsLoading"
            );

        const empty =
            document.getElementById(
                "productReviewsEmpty"
            );

        const list =
            document.getElementById(
                "productReviewsList"
            );

        loading?.classList.remove(
            "hidden"
        );

        empty?.classList.add(
            "hidden"
        );

        if (list) {
            list.innerHTML = "";
        }

        try {
            const rating =
                document.getElementById(
                    "publicReviewRatingFilter"
                )?.value || "";

            const sort =
                document.getElementById(
                    "publicReviewSort"
                )?.value || "latest";

            const query =
                new URLSearchParams({
                    limit:
                        "50",
                    sort
                });

            if (rating) {
                query.set(
                    "rating",
                    rating
                );
            }

            const data =
                await API.get(
                    `/api/reviews/product/${encodeURIComponent(this.product.id)}?${query.toString()}`
                );

            this.reviewData =
                data;

            this.renderReviews(data);

            this.product.averageRating =
                Number(
                    data.averageRating ||
                    0
                );

            this.product.totalReviews =
                Number(
                    data.totalReviews ||
                    0
                );

            this.renderRating();
        } catch (error) {
            loading?.classList.add(
                "hidden"
            );

            if (list) {
                list.innerHTML = `
                    <div class="review-load-error">
                        ${Components.e(
                            error.message ||
                            "Unable to load customer reviews."
                        )}
                    </div>
                `;
            }
        } finally {
            this.reviewsLoading =
                false;
        }
    },

    renderReviews(data) {
        const loading =
            document.getElementById(
                "productReviewsLoading"
            );

        const empty =
            document.getElementById(
                "productReviewsEmpty"
            );

        const list =
            document.getElementById(
                "productReviewsList"
            );

        const allReviews =
            Array.isArray(data.reviews)
                ? data.reviews
                : [];

        const reviews =
            this.reviewPhotosOnly
                ? allReviews.filter(
                    review =>
                        Array.isArray(
                            review.images
                        ) &&
                        review.images.length >
                            0
                )
                : allReviews;

        const total =
            Number(
                data.totalReviews ||
                reviews.length ||
                0
            );

        const average =
            Number(
                data.averageRating ||
                0
            );

        loading?.classList.add(
            "hidden"
        );

        this.text(
            "reviewAverageScore",
            average.toFixed(1)
        );

        this.text(
            "reviewAverageStars",
            this.starText(average)
        );

        this.text(
            "reviewTotalCount",
            total
                ? `${total} approved review${total === 1 ? "" : "s"}`
                : "No reviews yet"
        );

        const distribution =
            data.distribution ||
            {};

        const rows =
            document.querySelectorAll(
                "#reviewDistribution > div"
            );

        [5,4,3,2,1].forEach(
            (star, index) => {
                const count =
                    Number(
                        distribution[star] ||
                        0
                    );

                const percentage =
                    total
                        ? Math.round(
                            count /
                            total *
                            100
                        )
                        : 0;

                const row =
                    rows[index];

                if (row) {
                    const bar =
                        row.querySelector("b");

                    const number =
                        row.querySelector("em");

                    if (bar) {
                        bar.style.width =
                            `${percentage}%`;
                    }

                    if (number) {
                        number.textContent =
                            String(count);
                    }
                }
            }
        );

        if (!reviews.length) {
            empty?.classList.remove(
                "hidden"
            );

            const emptyStrong =
                empty?.querySelector(
                    "strong"
                );

            const emptyText =
                empty?.querySelector(
                    "span"
                );

            if (emptyStrong) {
                emptyStrong.textContent =
                    this.reviewPhotosOnly
                        ? "No reviews with photos found"
                        : "Be the first to review this product";
            }

            if (emptyText) {
                emptyText.textContent =
                    this.reviewPhotosOnly
                        ? "Clear the photo filter to view all approved reviews."
                        : "Approved customer comments and photos will appear here.";
            }

            return;
        }

        empty?.classList.add(
            "hidden"
        );

        if (list) {
            list.innerHTML =
                reviews
                    .map(
                        review =>
                            this.reviewMarkup(
                                review
                            )
                    )
                    .join("");

            list
                .querySelectorAll(
                    "[data-review-photo]"
                )
                .forEach(image => {
                    image.addEventListener(
                        "click",
                        () =>
                            this.openReviewImage(
                                image.dataset.reviewPhoto
                            )
                    );
                });

            list
                .querySelectorAll(
                    "[data-review-helpful]"
                )
                .forEach(button => {
                    button.addEventListener(
                        "click",
                        () =>
                            this.markReviewHelpful(
                                button
                            )
                    );
                });
        }
    },

    reviewMarkup(review) {
        const rating =
            Math.max(
                0,
                Math.min(
                    5,
                    Number(review.rating) ||
                    0
                )
            );

        const images =
            Array.isArray(review.images)
                ? review.images
                : [];

        const avatar =
            review.profile_picture_url ||
            "";

        const initials =
            String(
                review.full_name ||
                "Customer"
            )
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(
                    part =>
                        part.charAt(0)
                )
                .join("")
                .toUpperCase();

        return `
            <article class="product-review-card">
                <header>
                    <div class="review-customer-avatar">
                        ${
                            avatar
                                ? `<img src="${Components.e(avatar)}" alt="">`
                                : `<span>${Components.e(initials || "R")}</span>`
                        }
                    </div>

                    <div>
                        <strong>${Components.e(review.full_name || "RUKHNAV Customer")}</strong>
                        <span class="review-stars">${this.starText(rating)}</span>
                    </div>

                    ${
                        review.verified_purchase
                            ? '<b class="verified-purchase"><i class="fa-solid fa-circle-check"></i> Verified Purchase</b>'
                            : ""
                    }
                </header>

                <p>${Components.e(review.comment || "")}</p>

                ${
                    images.length
                        ? `
                            <div class="customer-review-photos">
                                ${images.map(image => {
                                    const url =
                                        image.url ||
                                        this.imageUrl(
                                            image.image_url
                                        );

                                    return `
                                        <button type="button" data-review-photo="${Components.e(url)}">
                                            <img
                                                src="${Components.e(url)}"
                                                alt="${Components.e(image.image_alt || "Customer review photo")}"
                                                loading="lazy"
                                            >
                                        </button>
                                    `;
                                }).join("")}
                            </div>
                        `
                        : ""
                }

                ${
                    review.admin_reply
                        ? `
                            <div class="review-admin-reply">
                                <strong>RUKHNAV replied</strong>
                                <p>${Components.e(review.admin_reply)}</p>
                            </div>
                        `
                        : ""
                }

                <footer>
                    <span>${review.created_at ? new Date(review.created_at).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"}) : ""}</span>

                    <button
                        type="button"
                        data-review-helpful="${Components.e(review.id)}"
                    >
                        <i class="fa-regular fa-thumbs-up"></i>
                        Helpful
                        <b>${Number(review.helpful_count || 0)}</b>
                    </button>
                </footer>
            </article>
        `;
    },

    starText(value) {
        const rounded =
            Math.max(
                0,
                Math.min(
                    5,
                    Math.round(
                        Number(value) ||
                        0
                    )
                )
            );

        return (
            "★".repeat(rounded) +
            "☆".repeat(5 - rounded)
        );
    },

    previewReviewPhotos(event) {
        const preview =
            document.getElementById(
                "reviewPhotoPreview"
            );

        if (!preview) {
            return;
        }

        const files =
            Array.from(
                event.target.files ||
                []
            );

        if (files.length > 5) {
            event.target.value = "";
            preview.innerHTML = "";
            this.reviewMessage(
                "Select no more than five pictures.",
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
            preview.innerHTML = "";
            this.reviewMessage(
                "Each picture must be JPG, PNG or WEBP and no larger than 5 MB.",
                "error"
            );
            return;
        }

        preview.innerHTML =
            files
                .map(
                    file => `
                        <img
                            src="${URL.createObjectURL(file)}"
                            alt="Selected review photo"
                        >
                    `
                )
                .join("");
    },

    async submitReview(event) {
        event.preventDefault();

        if (!this.reviewEligible) {
            this.reviewMessage(
                "You can review this product only after your order containing it has been delivered.",
                "error"
            );

            return;
        }

        const form =
            event.currentTarget;

        const button =
            document.getElementById(
                "submitProductReview"
            );

        const original =
            button?.innerHTML;

        if (button) {
            button.disabled = true;
            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Submitting';
        }

        this.reviewMessage(
            "Submitting your review...",
            "info"
        );

        try {
            const formData =
                new FormData(form);

            formData.set(
                "product_id",
                String(this.product.id)
            );

            const response =
                await fetch(
                    `${API.base}/api/reviews`,
                    {
                        method:
                            "POST",

                        headers:
                            API.authHeaders(
                                false
                            ),

                        body:
                            formData
                    }
                );

            let data = {};

            try {
                data =
                    await response.json();
            } catch {}

            if (
                !response.ok ||
                data.success ===
                    false
            ) {
                throw new Error(
                    data.message ||
                    `Review submission failed (${response.status})`
                );
            }

            form.reset();

            const preview =
                document.getElementById(
                    "reviewPhotoPreview"
                );

            if (preview) {
                preview.innerHTML = "";
            }

            this.reviewMessage(
                data.message ||
                "Review submitted successfully.",
                "success"
            );

            Store.toast(
                data.message ||
                "Review submitted."
            );

            this.reviewData =
                null;

            this.reviewEligible =
                false;

            const eligibility =
                document.getElementById(
                    "productReviewEligibility"
                );

            if (eligibility) {
                eligibility.className =
                    "product-review-eligibility reviewed";

                eligibility.innerHTML = `
                    <i class="fa-solid fa-circle-check"></i>
                    <span>
                        Review submitted. ${
                            data.review?.status === "Approved"
                                ? "It is now visible publicly."
                                : "It will appear publicly after approval."
                        }
                    </span>
                `;
            }

            await this.loadReviews(true);
        } catch (error) {
            this.reviewMessage(
                error.message ||
                "Unable to submit review.",
                "error"
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = original;
            }
        }
    },

    reviewMessage(message, type = "") {
        const element =
            document.getElementById(
                "productReviewMessage"
            );

        if (!element) {
            return;
        }

        element.textContent =
            message;

        element.className =
            `product-review-message ${type}`
                .trim();
    },

    async markReviewHelpful(button) {
        if (
            button.dataset.loading ===
            "true"
        ) {
            return;
        }

        button.dataset.loading =
            "true";

        try {
            const id =
                button.dataset.reviewHelpful;

            const data =
                await API.post(
                    `/api/reviews/${encodeURIComponent(id)}/helpful`,
                    {}
                );

            const count =
                button.querySelector("b");

            if (count) {
                count.textContent =
                    String(
                        data.helpfulCount ??
                        Number(
                            count.textContent
                        ) +
                        1
                    );
            }
        } catch (error) {
            Store.toast(
                error.message ||
                "Unable to mark this review helpful.",
                "error"
            );
        } finally {
            delete button.dataset.loading;
        }
    },

    openReviewImage(url) {
        const lightbox =
            document.getElementById(
                "reviewImageLightbox"
            );

        const image =
            document.getElementById(
                "reviewImageLightboxImage"
            );

        if (!lightbox || !image) {
            return;
        }

        image.src =
            url;

        lightbox.classList.remove(
            "hidden"
        );

        lightbox.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "pd-no-scroll"
        );
    },

    closeReviewImage() {
        const lightbox =
            document.getElementById(
                "reviewImageLightbox"
            );

        lightbox?.classList.add(
            "hidden"
        );

        lightbox?.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "pd-no-scroll"
        );
    },

    scrollTabsIntoView() {
        document
            .querySelector(
                ".pd-tabs"
            )
            ?.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "start"
            });
    },

    renderCarousels() {
        const currentId =
            String(
                this.product.id
            );

        const available =
            this.products.filter(
                product =>
                    String(product.id) !==
                    currentId
            );

        const currentCategory =
            String(
                this.product.category ||
                ""
            )
                .trim()
                .toLowerCase();

        const related =
            available.filter(
                product =>
                    String(
                        product.category ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    currentCategory
            );

        const popular =
            [...available]
                .sort(
                    (a, b) =>
                        Number(
                            b.totalReviews ??
                            b.total_reviews ??
                            0
                        ) -
                        Number(
                            a.totalReviews ??
                            a.total_reviews ??
                            0
                        )
                );

        const newest =
            [...available]
                .sort(
                    (a, b) =>
                        Number(b.id) -
                        Number(a.id)
                );

        const recentIds =
            this.getRecentIds()
                .filter(
                    id =>
                        String(id) !==
                        currentId
                );

        const recent =
            recentIds
                .map(
                    id =>
                        this.products.find(
                            product =>
                                String(product.id) ===
                                String(id)
                        )
                )
                .filter(Boolean);

        this.renderStrip(
            "relatedProducts",
            related.length
                ? related
                : available
        );

        this.renderStrip(
            "popularProducts",
            popular
        );

        this.renderStrip(
            "recentProducts",
            recent
        );

        this.renderStrip(
            "newProducts",
            newest
        );
    },

    renderStrip(id, products) {
        const strip =
            document.getElementById(id);

        if (!strip) {
            return;
        }

        const rows =
            products.slice(0, 14);

        if (!rows.length) {
            strip.innerHTML = `
                <div class="pd-strip-empty">
                    More products will appear here when they are available.
                </div>
            `;
            return;
        }

        strip.innerHTML =
            rows
                .map(
                    product =>
                        this.cardMarkup(product)
                )
                .join("");

        strip
            .querySelectorAll(
                "[data-strip-cart]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    async event => {
                        event.preventDefault();
                        event.stopPropagation();

                        const productId =
                            Number(
                                button.dataset.stripCart
                            );

                        await this.addProductToCart(
                            productId,
                            button
                        );
                    }
                );
            });
    },

    cardMarkup(product) {
        const image =
            this.imageUrl(
                product.image
            ) ||
            "images/product-placeholders/product-placeholder-01.svg";

        const rating =
            Number(
                product.averageRating ??
                product.average_rating ??
                0
            );

        const stock =
            this.stock(product);

        return `
            <article class="pd-card">
                <a href="product.html?id=${encodeURIComponent(product.id)}">
                    <div class="pd-card-image">
                        <img
                            src="${Components.e(image)}"
                            alt="${Components.e(product.product_name || "Product")}"
                            loading="lazy"
                        >

                        ${stock <= 0
                            ? '<span class="pd-card-stock out">Out of stock</span>'
                            : stock <= 5
                                ? '<span class="pd-card-stock low">Low stock</span>'
                                : ""}
                    </div>

                    <span>${Components.e(product.category || "RUKHNAV")}</span>
                    <h3>${Components.e(product.product_name || "Product")}</h3>

                    <div class="pd-card-rating">
                        ${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))}
                    </div>

                    <strong>${Store.money(this.price(product))}</strong>
                </a>

                <div class="pd-card-actions">
                    <button
                        type="button"
                        data-strip-cart="${Components.e(product.id)}"
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        <i class="fa-solid fa-cart-plus"></i>
                        Add
                    </button>

                    <a href="guest-checkout.html?product_id=${encodeURIComponent(product.id)}&quantity=1">
                        <i class="fa-solid fa-bolt"></i>
                        Buy
                    </a>
                </div>
            </article>
        `;
    },

    changeQty(delta) {
        this.quantity =
            this.limitQty(
                this.quantity +
                delta
            );

        const input =
            document.getElementById(
                "pdQuantity"
            );

        if (input) {
            input.value =
                this.quantity;
        }
    },

    limitQty(value) {
        return Math.min(
            Math.max(
                Number.parseInt(
                    value,
                    10
                ) || 1,
                1
            ),
            Math.max(
                this.stock(),
                1
            )
        );
    },

    async addCart() {
        if (
            this.stock() <= 0
        ) {
            Store.toast(
                "This product is out of stock.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById(
                "pdAddCart"
            );

        await this.withButton(
            button,
            "Adding",
            async () => {
                await Store.addCart(
                    this.product.id,
                    this.quantity
                );

                await Store
                    .refreshCartCount?.();

                this.showAddedToCart(
                    this.product,
                    this.quantity
                );
            }
        );
    },

    async addProductToCart(
        productId,
        button
    ) {
        await this.withButton(
            button,
            "",
            async () => {
                await Store.addCart(
                    productId,
                    1
                );

                await Store
                    .refreshCartCount?.();

                const addedProduct =
                    this.products.find(
                        product =>
                            Number(product.id) ===
                            Number(productId)
                    ) || {
                        id: productId,
                        product_name:
                            "Product"
                    };

                this.showAddedToCart(
                    addedProduct,
                    1
                );
            }
        );
    },

    showAddedToCart(
        product,
        quantity = 1
    ) {
        document
            .getElementById(
                "rukhnavCartActions"
            )
            ?.remove();

        if (
            !document.getElementById(
                "rukhnavCartActionsStyle"
            )
        ) {
            const style =
                document.createElement(
                    "style"
                );

            style.id =
                "rukhnavCartActionsStyle";

            style.textContent = `
                #rukhnavCartActions {
                    position: fixed;
                    inset: 0;
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background:
                        rgba(8, 28, 19, .48);
                    backdrop-filter:
                        blur(3px);
                }

                .rukhnav-cart-actions-card {
                    position: relative;
                    width:
                        min(560px, 100%);
                    padding: 34px;
                    border-radius: 20px;
                    background: #fff;
                    box-shadow:
                        0 24px 70px
                        rgba(0, 0, 0, .22);
                    text-align: center;
                }

                .rukhnav-cart-actions-close {
                    position: absolute;
                    top: 14px;
                    right: 16px;
                    width: 38px;
                    height: 38px;
                    border: 0;
                    border-radius: 50%;
                    background: #f4f1e8;
                    color: #174d35;
                    font-size: 26px;
                    line-height: 1;
                    cursor: pointer;
                }

                .rukhnav-cart-actions-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 66px;
                    height: 66px;
                    margin:
                        0 auto 18px;
                    border-radius: 50%;
                    background: #e5f5eb;
                    color: #16814b;
                    font-size: 34px;
                    font-weight: 800;
                }

                .rukhnav-cart-actions-label {
                    margin-bottom: 8px;
                    color: #d59c00;
                    font-size: 12px;
                    font-weight: 800;
                    letter-spacing: .12em;
                }

                .rukhnav-cart-actions-card h3 {
                    margin: 0 0 10px;
                    color: #174d35;
                    font-size: 27px;
                    line-height: 1.15;
                }

                .rukhnav-cart-actions-product {
                    margin: 0;
                    color: #17251d;
                    font-weight: 750;
                }

                .rukhnav-cart-actions-qty {
                    display: block;
                    margin-top: 4px;
                    color: #68746d;
                    font-size: 13px;
                }

                .rukhnav-cart-actions-buttons {
                    display: grid;
                    grid-template-columns:
                        1fr 1fr;
                    gap: 10px;
                    margin-top: 26px;
                }

                .rukhnav-cart-actions-buttons
                a,
                .rukhnav-cart-actions-buttons
                button {
                    min-height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px 15px;
                    border-radius: 10px;
                    font: inherit;
                    font-size: 14px;
                    font-weight: 750;
                    text-decoration: none;
                    box-sizing: border-box;
                    cursor: pointer;
                }

                .rukhnav-cart-continue {
                    border:
                        1px solid #d9ddd8;
                    background: #fff;
                    color: #174d35;
                }

                .rukhnav-cart-view {
                    border:
                        1px solid #174d35;
                    background: #fff;
                    color: #174d35;
                }

                .rukhnav-cart-checkout {
                    grid-column: 1 / -1;
                    border:
                        1px solid #174d35;
                    background: #174d35;
                    color: #fff;
                }

                .rukhnav-cart-actions-buttons
                a:hover,
                .rukhnav-cart-actions-buttons
                button:hover {
                    transform:
                        translateY(-1px);
                }

                @media (
                    max-width: 600px
                ) {
                    .rukhnav-cart-actions-card {
                        padding:
                            30px 18px 20px;
                    }

                    .rukhnav-cart-actions-card h3 {
                        font-size: 23px;
                    }

                    .rukhnav-cart-actions-buttons {
                        grid-template-columns:
                            1fr;
                    }

                    .rukhnav-cart-checkout {
                        grid-column: auto;
                    }
                }
            `;

            document.head
                .appendChild(style);
        }

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            "rukhnavCartActions";

        overlay.setAttribute(
            "role",
            "dialog"
        );

        overlay.setAttribute(
            "aria-modal",
            "true"
        );

        overlay.innerHTML = `
            <div class="rukhnav-cart-actions-card">

                <button
                    type="button"
                    class="rukhnav-cart-actions-close"
                    aria-label="Close"
                >
                    &times;
                </button>

                <div class="rukhnav-cart-actions-icon">
                    &#10003;
                </div>

                <div class="rukhnav-cart-actions-label">
                    ADDED TO YOUR CART
                </div>

                <h3>
                    Product added successfully
                </h3>

                <p class="rukhnav-cart-actions-product"></p>

                <span class="rukhnav-cart-actions-qty"></span>

                <div class="rukhnav-cart-actions-buttons">

                    <button
                        type="button"
                        class="rukhnav-cart-continue"
                    >
                        Continue Shopping
                    </button>

                    <a
                        href="cart.html"
                        class="rukhnav-cart-view"
                    >
                        View Cart
                    </a>

                    <button
                        type="button"
                        class="rukhnav-cart-checkout"
                    >
                        Proceed to Checkout
                    </button>

                </div>
            </div>
        `;

        const name =
            product?.product_name ||
            product?.name ||
            "Product";

        overlay.querySelector(
            ".rukhnav-cart-actions-product"
        ).textContent =
            name;

        overlay.querySelector(
            ".rukhnav-cart-actions-qty"
        ).textContent =
            `Quantity: ${Number(quantity) || 1}`;

        const close =
            () =>
                overlay.remove();

        overlay.querySelector(
            ".rukhnav-cart-actions-close"
        ).addEventListener(
            "click",
            close
        );

        overlay.querySelector(
            ".rukhnav-cart-continue"
        ).addEventListener(
            "click",
            close
        );

        overlay.addEventListener(
            "click",
            event => {
                if (
                    event.target ===
                    overlay
                ) {
                    close();
                }
            }
        );

        overlay.querySelector(
            ".rukhnav-cart-checkout"
        ).addEventListener(
            "click",
            () => {
                location.href =
                    API.isAuthenticated()
                        ? "checkout.html"
                        : "guest-checkout.html?source=cart";
            }
        );

        document.body
            .appendChild(
                overlay
            );
    },

    buyNow() {
        if (
            this.stock() <= 0
        ) {
            Store.toast(
                "This product is out of stock.",
                "error"
            );
            return;
        }

        const params =
            new URLSearchParams(
                location.search
            );

        const checkout =
            new URL(
                "guest-checkout.html",
                location.href
            );

        checkout.searchParams.set(
            "product_id",
            this.product.id
        );

        checkout.searchParams.set(
            "quantity",
            this.quantity
        );

        [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_content",
            "utm_term",
            "fbclid"
        ].forEach(key => {
            const value =
                params.get(key);

            if (value) {
                checkout.searchParams.set(
                    key,
                    value
                );
            }
        });

        location.href =
            checkout.toString();
    },

    async wishlist() {
        const button =
            document.getElementById(
                "pdWishlist"
            );

        try {
            if (API.isAuthenticated()) {
                await API.post(
                    "/api/wishlist",
                    {
                        product_id:
                            this.product.id
                    }
                );
            } else if (
                typeof Store.addGuestWishlist ===
                "function"
            ) {
                await Store
                    .addGuestWishlist(
                        this.product
                    );
            } else {
                throw new Error(
                    "Sign in to add this product to your wishlist."
                );
            }

            button
                ?.querySelector("i")
                ?.classList.replace(
                    "fa-regular",
                    "fa-solid"
                );

            Store.toast(
                "Product added to wishlist."
            );

            await Store
                .refreshWishlistCount?.();

        } catch (error) {
            Store.toast(
                error.message ||
                "Unable to update wishlist.",
                "error"
            );
        }
    },

    async withButton(
        button,
        loadingText,
        callback
    ) {
        if (!button) {
            return callback();
        }

        const original =
            button.innerHTML;

        button.disabled =
            true;

        if (loadingText) {
            button.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i>${loadingText}`;
        }

        try {
            await callback();
        } catch (error) {
            Store.toast(
                error.message ||
                "Unable to complete the action.",
                "error"
            );
        } finally {
            button.disabled =
                false;

            button.innerHTML =
                original;
        }
    },

    remember() {
        const ids =
            this.getRecentIds()
                .filter(
                    id =>
                        String(id) !==
                        String(
                            this.product.id
                        )
                );

        ids.unshift(
            this.product.id
        );

        localStorage.setItem(
            "rukhnav_recent_products",
            JSON.stringify(
                ids.slice(0, 16)
            )
        );
    },

    getRecentIds() {
        try {
            const value =
                JSON.parse(
                    localStorage.getItem(
                        "rukhnav_recent_products"
                    ) ||
                    "[]"
                );

            return Array.isArray(value)
                ? value
                : [];
        } catch {
            return [];
        }
    },

    openLightbox() {
        if (!this.images.length) {
            return;
        }

        const lightbox =
            document.getElementById(
                "pdLightbox"
            );

        lightbox?.classList.remove(
            "hidden"
        );

        lightbox?.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "pd-no-scroll"
        );

        this.updateLightbox();
    },

    closeLightbox() {
        const lightbox =
            document.getElementById(
                "pdLightbox"
            );

        lightbox?.classList.add(
            "hidden"
        );

        lightbox?.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "pd-no-scroll"
        );
    },

    stepLightbox(direction) {
        this.selectImage(
            this.activeImageIndex +
            direction
        );
    },

    updateLightbox() {
        const image =
            this.images[
                this.activeImageIndex
            ];

        if (!image) {
            return;
        }

        const element =
            document.getElementById(
                "pdLightboxImage"
            );

        if (element) {
            element.src =
                image.url;

            element.alt =
                image.image_alt ||
                this.product.product_name ||
                "Product image";
        }

        this.text(
            "pdLightboxCaption",
            `${this.product.product_name || "Product"} — image ${this.activeImageIndex + 1} of ${this.images.length}`
        );
    },

    async share(type) {
        const url =
            location.href;

        const title =
            this.product?.product_name ||
            "RUKHNAV Product";

        if (type === "copy") {
            try {
                await navigator.clipboard
                    .writeText(url);

                Store.toast(
                    "Product link copied."
                );
            } catch {
                Store.toast(url);
            }

            return;
        }

        const links = {
            whatsapp:
                `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,

            facebook:
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,

            x:
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
        };

        if (links[type]) {
            window.open(
                links[type],
                "_blank",
                "noopener,noreferrer,width=720,height=620"
            );
        }
    },

    scroll(id, amount) {
        document
            .getElementById(id)
            ?.scrollBy({
                left:
                    amount,

                behavior:
                    "smooth"
            });
    },

    fail(message) {
        document
            .getElementById(
                "pdLoading"
            )
            ?.classList.add(
                "hidden"
            );

        document
            .getElementById(
                "pdError"
            )
            ?.classList.remove(
                "hidden"
            );

        this.text(
            "pdErrorText",
            message
        );
    },

    text(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value ?? "";
        }
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () =>
        ProductDetails.init()
);
