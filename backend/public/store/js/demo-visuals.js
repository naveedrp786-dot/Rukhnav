"use strict";

/*
 * =========================================================
 * RUKHNAV Temporary Storefront Visuals
 *
 * Real ERP images always have priority.
 * Temporary pictures are only used when a real image
 * is missing or cannot be loaded.
 * =========================================================
 */

(() => {
    const base =
        "assets/demo/";

    const assets = {
        hair:
            base + "hair-care.svg",

        face:
            base + "face-care.svg",

        skin:
            base + "face-care.svg",

        body:
            base + "body-care.svg",

        fashion:
            base + "fashion.svg",

        herbal:
            base + "herbal.svg",

        product:
            base + "product.svg"
    };


    function classify(value = "") {
        const text =
            String(value)
                .toLowerCase();

        if (
            text.includes("hair") ||
            text.includes("shampoo") ||
            text.includes("conditioner")
        ) {
            return "hair";
        }

        if (
            text.includes("face") ||
            text.includes("cream") ||
            text.includes("facial")
        ) {
            return "face";
        }

        if (
            text.includes("skin")
        ) {
            return "skin";
        }

        if (
            text.includes("body")
        ) {
            return "body";
        }

        if (
            text.includes("fashion")
        ) {
            return "fashion";
        }

        if (
            text.includes("herbal") ||
            text.includes("natural")
        ) {
            return "herbal";
        }

        return "product";
    }


    function fallbackFor(
        value = ""
    ) {
        return assets[
            classify(value)
        ] || assets.product;
    }


    function imageContext(
        image
    ) {
        const parentText =
            image.closest(
                "article, a, .card, .product-card, .category-card"
            )?.textContent || "";

        return [
            image.alt || "",
            image.dataset.category || "",
            image.dataset.productName || "",
            parentText
        ].join(" ");
    }


    function useFallback(
        image
    ) {
        if (
            !image ||
            image.dataset.rukhnavFallback ===
                "1"
        ) {
            return;
        }

        image.dataset.rukhnavFallback =
            "1";

        image.src =
            fallbackFor(
                imageContext(image)
            );
    }


    /*
     * Broken product/category images.
     */

    document.addEventListener(
        "error",
        event => {
            const image =
                event.target;

            if (
                !(image instanceof HTMLImageElement)
            ) {
                return;
            }

            const context =
                imageContext(image);

            const className =
                String(
                    image.className || ""
                );

            const relevant =
                /product|category|cms-category|gallery/i
                    .test(
                        className +
                        " " +
                        context
                    );

            if (relevant) {
                useFallback(image);
            }
        },
        true
    );


    /*
     * Patch Store helpers so products/categories with
     * completely empty image fields also receive a
     * temporary visual.
     */

    function patchStore() {
        if (
            !window.Store ||
            window.Store
                .__demoVisualsPatched
        ) {
            return Boolean(
                window.Store
            );
        }

        const Store =
            window.Store;


        if (
            typeof Store.categoryImage ===
            "function"
        ) {
            const original =
                Store.categoryImage
                    .bind(Store);

            Store.categoryImage =
                function (
                    category = {}
                ) {
                    const result =
                        original(category);

                    if (result) {
                        return result;
                    }

                    return fallbackFor(
                        category.category_name ||
                        category.name ||
                        category.title ||
                        "category"
                    );
                };
        }


        if (
            typeof Store.img ===
            "function"
        ) {
            const original =
                Store.img
                    .bind(Store);

            Store.img =
                function (
                    product = {}
                ) {
                    const result =
                        original(product);

                    if (result) {
                        return result;
                    }

                    return fallbackFor(
                        [
                            product.product_name,
                            product.name,
                            product.category,
                            product.category_name
                        ]
                            .filter(Boolean)
                            .join(" ")
                    );
                };
        }


        Store.__demoVisualsPatched =
            true;

        return true;
    }


    if (!patchStore()) {
        const timer =
            setInterval(
                () => {
                    if (patchStore()) {
                        clearInterval(
                            timer
                        );
                    }
                },
                25
            );

        setTimeout(
            () =>
                clearInterval(
                    timer
                ),
            5000
        );
    }


    /*
     * Handle images added later by dynamic ERP rendering.
     */

    const observer =
        new MutationObserver(
            mutations => {
                for (
                    const mutation
                    of mutations
                ) {
                    for (
                        const node
                        of mutation.addedNodes
                    ) {
                        if (
                            !(
                                node instanceof
                                HTMLElement
                            )
                        ) {
                            continue;
                        }

                        const images =
                            node.matches?.(
                                "img"
                            )
                                ? [node]
                                : [
                                    ...node
                                        .querySelectorAll?.(
                                            "img"
                                        ) || []
                                ];

                        for (
                            const image
                            of images
                        ) {
                            if (
                                image.complete &&
                                image.naturalWidth ===
                                    0
                            ) {
                                const text =
                                    imageContext(
                                        image
                                    );

                                if (
                                    /product|category|hair|skin|face|body|fashion|herbal/i
                                        .test(
                                            text +
                                            " " +
                                            image.className
                                        )
                                ) {
                                    useFallback(
                                        image
                                    );
                                }
                            }
                        }
                    }
                }
            }
        );

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );
})();
