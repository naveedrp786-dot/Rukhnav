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
