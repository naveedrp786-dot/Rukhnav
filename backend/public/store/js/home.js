"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    // Wait until Store.settings is initialized by the shared store runtime.
    while (
        !window.Store ||
        !Store.settings ||
        !Object.keys(Store.settings).length
    ) {
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    const footer =
        Store.settings.footer || {};

    // IMPORTANT:
    // Homepage hero text is controlled exclusively by
    // website-cms-bridge.js via /api/website/settings.
    //
    // Do not write to:
    //   #heroEyebrow
    //   #heroTitle
    //   #heroText
    //
    // This prevents the legacy page-home API from overwriting
    // values published from Admin -> Website Management.

    const newsletterTitle =
        document.getElementById("newsletterTitle");

    const newsletterText =
        document.getElementById("newsletterText");

    if (
        newsletterTitle &&
        footer.newsletter_title
    ) {
        newsletterTitle.textContent =
            footer.newsletter_title;
    }

    if (
        newsletterText &&
        footer.newsletter_text
    ) {
        newsletterText.textContent =
            footer.newsletter_text;
    }

    // Load homepage products.
    try {
        const response =
            await API.get(
                API.products
            );

        const products =
            Array.isArray(response.products)
                ? response.products
                : Array.isArray(response.data)
                    ? response.data
                    : Array.isArray(response)
                        ? response
                        : [];

        const loading =
            document.getElementById(
                "homeLoading"
            );

        const empty =
            document.getElementById(
                "homeEmpty"
            );

        const grid =
            document.getElementById(
                "homeProducts"
            );

        if (loading) {
            loading.classList.add(
                "hidden"
            );
        }

        if (!products.length) {
            if (empty) {
                empty.classList.remove(
                    "hidden"
                );
            }

            return;
        }

        initializeProductShowcase(products);

        if (grid) {
            grid.innerHTML =
                products
                    .slice(0, 10)
                    .map(
                        product =>
                            Store.card(
                                product
                            )
                    )
                    .join("");

            grid.classList.remove(
                "hidden"
            );

            Store.bindCards(
                grid
            );
        }
    } catch {
        const loading =
            document.getElementById(
                "homeLoading"
            );

        const empty =
            document.getElementById(
                "homeEmpty"
            );

        if (loading) {
            loading.classList.add(
                "hidden"
            );
        }

        if (empty) {
            empty.classList.remove(
                "hidden"
            );
        }
    }

    const newsletterForm =
        document.getElementById(
            "newsletterForm"
        );

    if (newsletterForm) {
        newsletterForm.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                Store.toast(
                    "Thank you for subscribing."
                );

                event.target.reset();
            }
        );
    }
});



/* =========================================================
   LIVE HOMEPAGE PRODUCT SHOWCASE
   ========================================================= */

function initializeProductShowcase(products = []) {

    const showcase =
        document.getElementById("productShowcase");

    if (!showcase || !Array.isArray(products) || !products.length) {
        return;
    }

    const link =
        document.getElementById("showcaseLink");

    const image =
        document.getElementById("showcaseImage");

    const name =
        document.getElementById("showcaseName");

    const description =
        document.getElementById("showcaseDescription");

    const price =
        document.getElementById("showcasePrice");

    const dots =
        document.getElementById("showcaseDots");

    const prev =
        document.getElementById("showcasePrev");

    const next =
        document.getElementById("showcaseNext");

    if (
        !link ||
        !image ||
        !name ||
        !description ||
        !price ||
        !dots
    ) {
        return;
    }


    /*
     * Use the same product-image fields as Store.img().
     */
    const getImage = product => {

        if (
            window.Store &&
            typeof Store.img === "function"
        ) {
            return Store.img(product);
        }

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
            String(value).startsWith("data:")
        ) {
            return value;
        }

        if (String(value).startsWith("/")) {
            return `${API.base}${value}`;
        }

        return `${API.base}/uploads/products/${value}`;
    };


    const featured =
        products.filter(
            product =>
                product &&
                product.id
        );

    if (!featured.length) {
        showcase.classList.add("hidden");
        return;
    }


    let current = 0;
    let timer = null;
    let renderTimer = null;

    const ROTATION_MS = 4200;


    const getPrice = product => {

        const value = Number(
            product.selling_price ??
            product.sale_price ??
            product.price ??
            0
        );

        const symbol =
            Store?.settings?.store?.currency_symbol ||
            Store?.settings?.currency_symbol ||
            "Rs.";

        return `${symbol} ${new Intl.NumberFormat(
            "en-PK",
            {
                maximumFractionDigits: 2
            }
        ).format(value)}`;
    };


    const stop = () => {

        if (timer) {
            window.clearTimeout(timer);
            timer = null;
        }
    };


    const scheduleNext = () => {

        stop();

        if (
            featured.length <= 1 ||
            document.hidden
        ) {
            return;
        }

        timer = window.setTimeout(() => {

            render(current + 1);

            scheduleNext();

        }, ROTATION_MS);
    };


    const render = index => {

        if (!featured.length) {
            return;
        }

        current =
            (index + featured.length) %
            featured.length;

        const product =
            featured[current];

        showcase.classList.add("is-changing");

        if (renderTimer) {
            window.clearTimeout(renderTimer);
        }

        renderTimer = window.setTimeout(() => {

            /*
             * Canonical storefront product page.
             */
            link.href =
                `product.html?id=${
                    encodeURIComponent(product.id)
                }`;

            const imageUrl =
                getImage(product);

            const picture =
                image.closest(".rk-showcase-picture");

            const showPlaceholder = () => {

                image.style.display = "none";

                if (picture) {
                    picture.classList.add(
                        "no-product-image"
                    );
                }
            };

            const showProductImage = () => {

                image.style.display = "";

                if (picture) {
                    picture.classList.remove(
                        "no-product-image"
                    );
                }
            };

            image.onerror = () => {

                image.onerror = null;
                image.removeAttribute("src");

                showPlaceholder();
            };

            image.onload = () => {
                showProductImage();
            };

            if (imageUrl) {

                showProductImage();

                image.src =
                    imageUrl;

            } else {

                image.removeAttribute("src");

                showPlaceholder();
            }

            image.alt =
                product.product_name ||
                product.name ||
                "RUKHNAV product";

            name.textContent =
                product.product_name ||
                product.name ||
                "RUKHNAV Product";

            description.textContent =
                product.short_description ||
                product.description ||
                product.category ||
                product.category_name ||
                "Discover natural care from RUKHNAV.";

            price.textContent =
                getPrice(product);

            Array
                .from(dots.children)
                .forEach(
                    (dot, dotIndex) => {

                        const active =
                            dotIndex === current;

                        dot.classList.toggle(
                            "active",
                            active
                        );

                        dot.setAttribute(
                            "aria-current",
                            active
                                ? "true"
                                : "false"
                        );
                    }
                );

            showcase.classList.remove(
                "is-changing"
            );

        }, 220);
    };


    /*
     * Build selector dots once.
     */
    dots.innerHTML = "";

    featured.forEach((product, index) => {

        const dot =
            document.createElement("button");

        dot.type =
            "button";

        dot.className =
            "rk-showcase-dot";

        dot.setAttribute(
            "aria-label",
            `Show ${
                product.product_name ||
                product.name ||
                `product ${index + 1}`
            }`
        );

        dot.addEventListener(
            "click",
            event => {

                event.preventDefault();

                render(index);
                scheduleNext();
            }
        );

        dots.appendChild(dot);
    });


    if (prev) {

        prev.addEventListener(
            "click",
            event => {

                event.preventDefault();

                render(current - 1);
                scheduleNext();
            }
        );
    }


    if (next) {

        next.addEventListener(
            "click",
            event => {

                event.preventDefault();

                render(current + 1);
                scheduleNext();
            }
        );
    }


    /*
     * Pause while customer is interacting with the showcase.
     */
    showcase.addEventListener(
        "mouseenter",
        stop
    );

    showcase.addEventListener(
        "mouseleave",
        scheduleNext
    );

    showcase.addEventListener(
        "focusin",
        stop
    );

    showcase.addEventListener(
        "focusout",
        scheduleNext
    );


    /*
     * Do not keep running timers in an inactive browser tab.
     */
    document.addEventListener(
        "visibilitychange",
        () => {

            if (document.hidden) {
                stop();
            } else {
                scheduleNext();
            }
        }
    );


    /*
     * IMPORTANT:
     * Render immediately and start automatic rotation.
     */
    render(0);
    scheduleNext();
}
