"use strict";

/*
 * RUKHNAV browser API configuration.
 *
 * Local:
 *   http://localhost:3000
 *
 * Production:
 *   When the storefront/admin and Node API are served by the same
 *   RUKHNAV server, API_BASE_URL automatically becomes the current origin.
 *
 * If the API is later moved to api.rukhnav.com, set:
 *   window.RUKHNAV_API_ORIGIN = "https://api.rukhnav.com";
 * before this file loads.
 */
window.RUKHNAV_API_ORIGIN =
    window.RUKHNAV_API_ORIGIN ||
    window.location.origin;

window.RUKHNAV_API_BASE =
    `${window.RUKHNAV_API_ORIGIN}/api`;
