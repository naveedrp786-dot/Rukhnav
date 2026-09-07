"use strict";

/*
 * ============================================================
 * RUKHNAV PRODUCT CARD IMAGE ROTATOR
 * ============================================================
 *
 * - Uses existing /api/product-media/public/:productId
 * - Works with dynamically generated Store.card() cards
 * - Loads galleries only when cards approach the viewport
 * - Rotates only real database images
 * - Does not animate placeholder galleries
 * - Pauses off-screen / hidden browser tabs
 * - Mobile + desktop browser compatible
 * ============================================================
 */

(() => {

    const ROTATION_MS = 5200;
    const FADE_MS = 700;
    const STAGGER_MS = 650;
    const MAX_STAGGER_STEPS = 7;
    const MAX_IMAGES = 5;

    const galleryCache = new Map();
    const activeCards = new Map();
    const preparedCards = new WeakSet();

    /*
     * --------------------------------------------------------
     * Inject only the small CSS required for the transition.
     * This avoids changing existing storefront CSS files.
     * --------------------------------------------------------
     */

    const style = document.createElement("style");

    style.textContent = `
        .product-card .product-image img {
            transition:
                opacity ${FADE_MS}ms ease,
                transform .5s cubic-bezier(.2,.7,.2,1),
                filter .3s ease;
        }

        .product-card .product-image img.rk-card-image-changing {
            opacity: 0;
        }

        @media (prefers-reduced-motion: reduce) {
            .product-card .product-image img {
                transition: none !important;
            }
        }
    `;

    document.head.appendChild(style);


    /*
     * --------------------------------------------------------
     * Helpers
     * --------------------------------------------------------
     */

    function apiBase() {

        if (
            window.API &&
            typeof API.base === "string"
        ) {
            return API.base.replace(/\/+$/, "");
        }

        return window.location.origin;
    }


    function imageUrl(value) {

        const image =
            String(value || "").trim();

        if (!image) {
            return "";
        }

        if (
            /^https?:\/\//i.test(image) ||
            image.startsWith("data:")
        ) {
            return image;
        }

        if (image.startsWith("/")) {
            return `${apiBase()}${image}`;
        }

        if (image.startsWith("uploads/")) {
            return `${apiBase()}/${image}`;
        }

        return `${apiBase()}/uploads/products/${image}`;
    }


    function productIdFromCard(card) {

        const link =
            card.querySelector(
                '.product-image[href*="product.html?id="]'
            );

        if (!link) {
            return null;
        }

        try {

            const url =
                new URL(
                    link.href,
                    window.location.href
                );

            const id =
                Number.parseInt(
                    url.searchParams.get("id"),
                    10
                );

            return (
                Number.isInteger(id) &&
                id > 0
            )
                ? id
                : null;

        } catch {
            return null;
        }
    }


    function uniqueImages(images = []) {

        const seen = new Set();
        const result = [];

        images.forEach(item => {

            const raw =
                typeof item === "string"
                    ? item
                    : (
                        item?.image_url ||
                        item?.url ||
                        item?.image ||
                        ""
                    );

            const url =
                imageUrl(raw);

            if (
                url &&
                !seen.has(url)
            ) {
                seen.add(url);

                result.push(url);
            }

        });

        return result.slice(
            0,
            MAX_IMAGES
        );
    }


    /*
     * --------------------------------------------------------
     * Gallery loader
     * --------------------------------------------------------
     */

    async function loadGallery(productId) {

        if (
            galleryCache.has(productId)
        ) {
            return galleryCache.get(productId);
        }

        const request =
            (async () => {

                try {

                    const response =
                        await fetch(
                            `${apiBase()}/api/product-media/public/${encodeURIComponent(productId)}`,
                            {
                                headers: {
                                    Accept:
                                        "application/json"
                                }
                            }
                        );

                    if (!response.ok) {
                        return [];
                    }

                    const data =
                        await response.json();

                    /*
                     * Backend explicitly reports
                     * source: "database" or "placeholders".
                     *
                     * We only rotate real gallery images.
                     */

                    if (
                        data?.success === false ||
                        data?.source !== "database"
                    ) {
                        return [];
                    }

                    return uniqueImages(
                        Array.isArray(data.images)
                            ? data.images
                            : []
                    );

                } catch (error) {

                    console.warn(
                        "RUKHNAV card gallery unavailable:",
                        productId,
                        error
                    );

                    return [];
                }

            })();

        galleryCache.set(
            productId,
            request
        );

        return request;
    }


    /*
     * --------------------------------------------------------
     * Image preloading
     * --------------------------------------------------------
     */

    function preload(url) {

        if (!url) {
            return Promise.resolve(false);
        }

        return new Promise(resolve => {

            const image = new Image();

            image.decoding = "async";

            image.onload = async () => {

                try {
                    await image.decode?.();
                } catch {
                    // Image is already loaded; decode support varies.
                }

                resolve(true);
            };

            image.onerror = () => {
                resolve(false);
            };

            image.src = url;

            /*
             * Cached images can already be complete before
             * the load handler gets a chance to run.
             */
            if (image.complete && image.naturalWidth > 0) {
                resolve(true);
            }
        });
    }


    /*
     * --------------------------------------------------------
     * Stop animation
     * --------------------------------------------------------
     */

    function stopCard(card) {

        const state =
            activeCards.get(card);

        if (!state) {
            return;
        }

        if (state.timer) {
            window.clearTimeout(
                state.timer
            );
        }

        state.timer = null;
        state.running = false;
    }


    /*
     * --------------------------------------------------------
     * Start / continue animation
     * --------------------------------------------------------
     */

    async function startCard(card) {

        if (
            document.hidden ||
            !card.isConnected
        ) {
            return;
        }

        const currentState =
            activeCards.get(card);

        if (
            currentState?.running
        ) {
            return;
        }

        const productId =
            productIdFromCard(card);

        if (!productId) {
            return;
        }

        const img =
            card.querySelector(
                ".product-image img"
            );

        if (!img) {
            return;
        }

        const gallery =
            await loadGallery(
                productId
            );

        if (
            !Array.isArray(gallery) ||
            gallery.length < 2
        ) {
            return;
        }

        /*
         * Keep the current image as part of the cycle
         * if it is not already returned by the gallery.
         */

        const currentUrl =
            imageUrl(
                img.getAttribute("src")
            );

        let images =
            [...gallery];

        if (
            currentUrl &&
            !images.includes(currentUrl)
        ) {
            images.unshift(
                currentUrl
            );
        }

        images =
            [...new Set(images)]
                .slice(
                    0,
                    MAX_IMAGES
                );

        if (
            images.length < 2
        ) {
            return;
        }

        let state =
            activeCards.get(card);

        if (!state) {

            /*
             * Stagger cards so the complete product grid does
             * not change images at exactly the same moment.
             *
             * Product ID keeps the delay stable even when cards
             * are re-rendered by pagination or CMS updates.
             */

            const staggerStep =
                Math.abs(
                    Number(productId) || 0
                ) %
                MAX_STAGGER_STEPS;

            state = {
                index: Math.max(
                    0,
                    images.indexOf(
                        currentUrl
                    )
                ),
                images,
                timer: null,
                running: false,
                visible: true,
                firstRotation: true,
                staggerDelay:
                    staggerStep *
                    STAGGER_MS
            };

            activeCards.set(
                card,
                state
            );

        } else {

            state.images =
                images;

            state.visible =
                true;
        }


        const schedule =
            () => {

                if (
                    document.hidden ||
                    !state.visible ||
                    !card.isConnected
                ) {
                    stopCard(card);
                    return;
                }

                state.running = true;

                const delay =
                    ROTATION_MS +
                    (
                        state.firstRotation
                            ? state.staggerDelay
                            : 0
                    );

                state.firstRotation =
                    false;

                state.timer =
                    window.setTimeout(
                        async () => {

                            const nextIndex =
                                (
                                    state.index + 1
                                ) %
                                state.images.length;

                            const nextUrl =
                                state.images[
                                    nextIndex
                                ];

                            const afterNext =
                                state.images[
                                    (
                                        nextIndex + 1
                                    ) %
                                    state.images.length
                                ];

                            /*
                             * IMPORTANT:
                             * Keep the current image fully visible until
                             * the next image has completely loaded.
                             */
                            const nextReady =
                                await preload(nextUrl);

                            if (
                                !nextReady ||
                                document.hidden ||
                                !state.visible ||
                                !card.isConnected
                            ) {
                                /*
                                 * Never remove the current working image
                                 * because another gallery image failed.
                                 */
                                schedule();
                                return;
                            }

                            /*
                             * The browser now has nextUrl ready.
                             * Only now begin the fade.
                             */
                            img.classList.add(
                                "rk-card-image-changing"
                            );

                            await new Promise(
                                resolve =>
                                    window.setTimeout(
                                        resolve,
                                        FADE_MS
                                    )
                            );

                            if (
                                document.hidden ||
                                !state.visible ||
                                !card.isConnected
                            ) {
                                img.classList.remove(
                                    "rk-card-image-changing"
                                );

                                stopCard(card);
                                return;
                            }

                            img.src = nextUrl;

                            try {
                                await img.decode?.();
                            } catch {
                                // The preloaded image remains usable.
                            }

                            state.index =
                                nextIndex;

                            img.classList.remove(
                                "rk-card-image-changing"
                            );

                            /*
                             * Quietly prepare the following image while
                             * the customer is viewing this one.
                             */
                            preload(afterNext);

                            schedule();

                        },
                        delay
                    );
            };


        preload(
            state.images[
                (
                    state.index + 1
                ) %
                state.images.length
            ]
        );

        schedule();
    }


    /*
     * --------------------------------------------------------
     * Intersection observer
     *
     * Gallery requests happen only when product cards are near
     * the viewport, reducing unnecessary network traffic.
     * --------------------------------------------------------
     */

    const observer =
        new IntersectionObserver(
            entries => {

                entries.forEach(
                    entry => {

                        const card =
                            entry.target;

                        const state =
                            activeCards.get(card);

                        if (
                            entry.isIntersecting
                        ) {

                            if (state) {
                                state.visible = true;
                            }

                            startCard(card);

                        } else {

                            if (state) {
                                state.visible = false;
                            }

                            stopCard(card);
                        }

                    }
                );

            },
            {
                rootMargin:
                    "250px 0px",
                threshold:
                    0.01
            }
        );


    /*
     * --------------------------------------------------------
     * Register newly created cards
     * --------------------------------------------------------
     */

    function registerCard(card) {

        if (
            !card ||
            preparedCards.has(card)
        ) {
            return;
        }

        const image =
            card.querySelector(
                ".product-image img"
            );

        if (!image) {
            return;
        }

        preparedCards.add(card);

        image.loading =
            image.loading ||
            "lazy";

        observer.observe(
            card
        );
    }


    function scan(root = document) {

        if (
            root instanceof Element &&
            root.matches(
                ".product-card"
            )
        ) {
            registerCard(root);
        }

        root
            .querySelectorAll?.(
                ".product-card"
            )
            .forEach(
                registerCard
            );
    }


    /*
     * Initial cards.
     */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => scan(document),
            {
                once: true
            }
        );

    } else {

        scan(document);
    }


    /*
     * Watch cards added later by:
     * home.js
     * products.js
     * recommendations
     * pagination
     * CMS rendering
     */

    const mutationObserver =
        new MutationObserver(
            mutations => {

                mutations.forEach(
                    mutation => {

                        mutation.addedNodes
                            .forEach(
                                node => {

                                    if (
                                        node instanceof
                                        Element
                                    ) {
                                        scan(node);
                                    }

                                }
                            );

                    }
                );

            }
        );


    mutationObserver.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );


    /*
     * Pause all animations when browser tab is hidden.
     */

    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.hidden) {

                activeCards
                    .forEach(
                        (_, card) =>
                            stopCard(card)
                    );

                return;
            }

            document
                .querySelectorAll(
                    ".product-card"
                )
                .forEach(
                    card => {
                        const state =
                            activeCards.get(
                                card
                            );

                        if (
                            !state ||
                            state.visible !==
                                false
                        ) {
                            startCard(card);
                        }
                    }
                );

        }
    );

})();
