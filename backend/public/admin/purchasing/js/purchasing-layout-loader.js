const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
async function loadPurchasingComponent(id, path) {
    const target =
        document.getElementById(id);

    if (!target) {
        return;
    }

    try {
        const response =
            await fetch(path);

        if (!response.ok) {
            throw new Error(
                `Unable to load ${path}`
            );
        }

        target.innerHTML =
            await response.text();
    } catch (error) {
        console.error(error);
    }
}

function bindPurchasingLogout() {
    const button =
        document.getElementById("logoutBtn");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        event => {
            event.preventDefault();

            if (
                confirm(
                    "Are you sure you want to logout?"
                )
            ) {
                localStorage.removeItem("token");
                localStorage.removeItem("admin");
                localStorage.removeItem("adminToken");
                localStorage.removeItem("admin_token");

                window.location.href =
                    "../../login.html";
            }
        }
    );
}

async function loadPurchasingAdminProfile() {
    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token");

    if (!token) {
        return;
    }

    try {
        const response = await fetch(
            RUKHNAV_ORIGIN + "/api/admins/profile",
            {
                headers: {
                    "Content-Type":
                        "application/json",
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const admin =
            data.admin || {};

        const name =
            document.getElementById("adminName");

        const role =
            document.getElementById("adminRole");

        const image =
            document.getElementById("adminImage");

        if (name) {
            name.textContent =
                `${admin.first_name || ""} ${admin.last_name || ""}`.trim() ||
                "Administrator";
        }

        if (role) {
            role.textContent =
                admin.role || "Administrator";
        }

        if (image) {
            image.src =
                admin.profile_image
                    ? `${RUKHNAV_ORIGIN}/uploads/admins/${admin.profile_image}`
                    : "../../images/default-user.png";
        }
    } catch (error) {
        console.error(
            "Unable to load admin profile:",
            error
        );
    }
}

window.addEventListener(
    "DOMContentLoaded",
    async () => {
        await loadPurchasingComponent(
            "sidebar-container",
            "../../components/sidebar.html"
        );

        await loadPurchasingComponent(
            "topbar-container",
            "../../components/topbar.html"
        );

        await loadPurchasingComponent(
            "footer-container",
            "../../components/footer.html"
        );

        bindPurchasingLogout();
        loadPurchasingAdminProfile();
    }
);


/* RUKHNAV_ADMIN_LIVE_NOTIFICATION_BELL */
(() => {
    const script =
        document.createElement("script");

    script.src =
        "/admin/js/admin-notification-bell.js";

    script.async =
        true;

    document.head
        .appendChild(script);
})();


/* RUKHNAV_NOTIFICATION_BELL_V2_LOADER */
(() => {
    if (
        document.querySelector(
            'script[data-rukhnav-notification-v2]'
        )
    ) {
        return;
    }

    const script =
        document.createElement("script");

    script.src =
        "/admin/js/admin-notification-bell.js?v=2";

    script.async = true;

    script.dataset
        .rukhnavNotificationV2 =
        "true";

    document.head
        .appendChild(script);
})();
