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

    if (!showcase || !products.length) {
        return;
    }

    const link =
        document.getElementById("showcaseLink");

    const image =
        document.getElementById("showcaseImage");

    const name =
        document.getElementById("showcaseName");

    const description =
        document.getElementById(
            "showcaseDescription"
        );

    const price =
        document.getElementById("showcasePrice");

    const dots =
        document.getElementById("showcaseDots");

    const prev =
        document.getElementById("showcasePrev");

    const next =
        document.getElementById("showcaseNext");


    const featured =
        products
            .filter(product =>
                product &&
                product.id &&
                (
                    product.image ||
                    product.image_url
                )
            )
            .slice(0, 8);

    if (!featured.length) {
        showcase.classList.add("hidden");
        return;
    }


    let current = 0;
    let timer = null;


    const productImage = product => {

        const value =
            product.image_url ||
            product.image ||
            "";

        if (!value) return "";

        if (/^https?:\/\//i.test(value)) {
            return value;
        }

        if (String(value).startsWith("/")) {
            return `${API.base}${value}`;
        }

        return `${API.base}/uploads/products/${value}`;
    };


    const productPrice = product => {

        const value =
            Number(
                product.sale_price ||
                product.price ||
                0
            );

        return `Rs. ${value.toLocaleString(
            "en-PK",
            {
                maximumFractionDigits:2
            }
        )}`;
    };


    const render = index => {

        current =
            (index + featured.length) %
            featured.length;

        const product =
            featured[current];

        showcase.classList.add(
            "is-changing"
        );

        window.setTimeout(() => {

            link.href =
                `product-details.html?id=${
                    encodeURIComponent(product.id)
                }`;

            image.src =
                productImage(product);

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
                "Discover natural care from RUKHNAV.";

            price.textContent =
                productPrice(product);

            Array
                .from(dots.children)
                .forEach((dot, dotIndex) => {
                    dot.classList.toggle(
                        "active",
                        dotIndex === current
                    );
                });

            showcase.classList.remove(
                "is-changing"
            );

        }, 180);
    };


    const start = () => {

        window.clearInterval(timer);

        if (featured.length > 1) {
            timer =
                window.setInterval(
                    () => render(current + 1),
                    5000
                );
        }
    };


    dots.innerHTML =
        featured
            .map(
                (_, index) =>
                    `<button
                        type="button"
                        class="rk-showcase-dot${
                            index === 0
                                ? " active"
                                : ""
                        }"
                        aria-label="Show product ${
                            index + 1
                        }"
                        data-index="${index}"
                    ></button>`
            )
            .join("");


    dots.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".rk-showcase-dot"
                );

            if (!button) return;

            render(
                Number(button.dataset.index)
            );

            start();
        }
    );


    prev?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            render(current - 1);
            start();
        }
    );


    next?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            render(current + 1);
            start();
        }
    );


    showcase.addEventListener(
        "mouseenter",
        () =>
            window.clearInterval(timer)
    );


    showcase.addEventListener(
        "mouseleave",
        start
    );


    render(0);
    start();
}
