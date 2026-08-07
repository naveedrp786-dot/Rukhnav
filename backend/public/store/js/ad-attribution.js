"use strict";

/*
 * Add this script to landing pages that may receive
 * Facebook/Instagram ad traffic. It stores UTM and
 * Facebook click identifiers for checkout attribution.
 */
(() => {
    const params =
        new URLSearchParams(
            location.search
        );

    const keys = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "fbclid"
    ];

    const current =
        JSON.parse(
            sessionStorage.getItem(
                "rukhnav_ad_attribution"
            ) ||
            "{}"
        );

    keys.forEach(key => {
        const value =
            params.get(key);

        if (value) {
            current[key] =
                value;
        }
    });

    current.landing_page =
        current.landing_page ||
        location.href;

    current.referrer_url =
        current.referrer_url ||
        document.referrer ||
        "";

    sessionStorage.setItem(
        "rukhnav_ad_attribution",
        JSON.stringify(current)
    );
})();
