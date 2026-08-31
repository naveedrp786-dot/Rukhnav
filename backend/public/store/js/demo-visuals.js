/* =========================================================
   RUKHNAV — TEMPORARY STOREFRONT VISUALS
   Professional development photography fallbacks

   IMPORTANT:
   1. Real ERP images always have priority.
   2. These images are temporary presentation fallbacks.
   3. Remove/replace when final RUKHNAV photography is ready.
   ========================================================= */

(() => {
    "use strict";

    const TEMP_IMAGES = {
        fashion: [
            "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1000&q=85"
        ],

        body: [
            "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1000&q=85"
        ],

        face: [
            "https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1000&q=85"
        ],

        hair: [
            "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&w=1000&q=85"
        ],

        herbal: [
            "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1000&q=85"
        ],

        beauty: [
            "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1000&q=85",
            "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1000&q=85"
        ]
    };

    const normalize = value =>
        String(value || "")
            .toLowerCase()
            .replace(/&/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    function detectCategory(text) {
        const value = normalize(text);

        if (
            value.includes("fashion") ||
            value.includes("bag") ||
            value.includes("accessor")
        ) {
            return "fashion";
        }

        if (
            value.includes("hair") ||
            value.includes("shampoo") ||
            value.includes("conditioner") ||
            value.includes("oil")
        ) {
            return "hair";
        }

        if (
            value.includes("face") ||
            value.includes("cream") ||
            value.includes("skin") ||
            value.includes("serum")
        ) {
            return "face";
        }

        if (
            value.includes("body") ||
            value.includes("lotion") ||
            value.includes("wash")
        ) {
            return "body";
        }

        if (
            value.includes("herbal") ||
            value.includes("natural")
        ) {
            return "herbal";
        }

        return "beauty";
    }

    function chooseImage(category, index = 0) {
        const list =
            TEMP_IMAGES[category] ||
            TEMP_IMAGES.beauty;

        return list[
            Math.abs(index) % list.length
        ];
    }

    function imageLooksBroken(img) {
        if (!img) return true;

        const src =
            String(
                img.getAttribute("src") || ""
            ).trim();

        if (!src) return true;

        if (
            src.includes("/assets/demo/") ||
            src.includes("product.svg") ||
            src === "#" ||
            src === "null" ||
            src === "undefined"
        ) {
            return true;
        }

        if (
            img.complete &&
            img.naturalWidth === 0
        ) {
            return true;
        }

        return false;
    }

    function installFallback(
        img,
        category,
        index
    ) {
        if (!img || img.dataset.rukhnavFallbackReady) {
            return;
        }

        img.dataset.rukhnavFallbackReady = "1";

        const fallback =
            chooseImage(category, index);

        img.addEventListener(
            "error",
            () => {
                if (
                    img.dataset.rukhnavFallbackApplied === "1"
                ) {
                    return;
                }

                img.dataset.rukhnavFallbackApplied = "1";
                img.src = fallback;
            },
            { once: true }
        );

        if (imageLooksBroken(img)) {
            img.dataset.rukhnavFallbackApplied = "1";
            img.src = fallback;
        }
    }

    function enhanceCards() {
        const selectors = [
            ".product-card",
            ".category-card",
            ".shop-category-card",
            ".home-shop-card",
            ".pd-related-card",
            ".related-product-card"
        ];

        document
            .querySelectorAll(
                selectors.join(",")
            )
            .forEach(
                (card, index) => {
                    const category =
                        detectCategory(
                            card.textContent
                        );

                    const img =
                        card.querySelector("img");

                    if (img) {
                        installFallback(
                            img,
                            category,
                            index
                        );
                    }
                }
            );
    }

    function enhanceLooseImages() {
        document
            .querySelectorAll(
                "img.product-image, img.category-image"
            )
            .forEach(
                (img, index) => {
                    const parent =
                        img.closest(
                            ".product-card, .category-card"
                        );

                    const category =
                        detectCategory(
                            parent?.textContent ||
                            img.alt
                        );

                    installFallback(
                        img,
                        category,
                        index
                    );
                }
            );
    }

    function run() {
        enhanceCards();
        enhanceLooseImages();
    }

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            run
        );
    } else {
        run();
    }

    let timer = null;

    const observer =
        new MutationObserver(() => {
            clearTimeout(timer);

            timer =
                setTimeout(
                    run,
                    80
                );
        });

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );
})();
