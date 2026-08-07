"use strict";
/* Compatibility entry point: every shared-shell ERP page now uses one layout engine. */
(function () {
    if (typeof window.initializeAdminLayout === "function") {
        window.initializeAdminLayout();
        return;
    }
    if (document.querySelector('script[data-rukhnav-component-loader]')) return;
    const script = document.createElement("script");
    script.src = "/admin/js/componentLoader.js";
    script.dataset.rukhnavComponentLoader = "1";
    document.head.appendChild(script);
})();
