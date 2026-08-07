// =====================================================
// RUKHNAV ERP — Main Dashboard Shared Layout
// =====================================================

async function loadDashboardComponent(
    elementId,
    componentPath
) {
    const target =
        document.getElementById(elementId);

    if (!target) {
        return;
    }

    try {
        const response =
            await fetch(componentPath, {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                `Unable to load ${componentPath}`
            );
        }

        target.innerHTML =
            await response.text();
    } catch (error) {
        console.error(
            "Component loading error:",
            error
        );
    }
}


// =====================================================
// Sidebar expandable menus
// =====================================================

function initializeSidebarMenus() {
    const groups =
        document.querySelectorAll(
            ".sidebar .menu-group"
        );

    groups.forEach((group) => {
        const button =
            group.querySelector(
                ":scope > .has-submenu"
            );

        const submenu =
            group.querySelector(
                ":scope > .submenu"
            );

        if (!button || !submenu) {
            return;
        }

        button.addEventListener(
            "click",
            () => {
                const willOpen =
                    !group.classList.contains(
                        "open"
                    );

                groups.forEach(
                    (otherGroup) => {
                        if (
                            otherGroup !== group
                        ) {
                            otherGroup.classList.remove(
                                "open"
                            );

                            otherGroup
                                .querySelector(
                                    ":scope > .has-submenu"
                                )
                                ?.setAttribute(
                                    "aria-expanded",
                                    "false"
                                );
                        }
                    }
                );

                group.classList.toggle(
                    "open",
                    willOpen
                );

                button.setAttribute(
                    "aria-expanded",
                    String(willOpen)
                );
            }
        );
    });
}


// =====================================================
// Highlight current sidebar page
// =====================================================

function highlightCurrentSidebarLink() {
    const currentPath =
        window.location.pathname
            .replace(/\/+$/, "")
            .toLowerCase();

    const links =
        document.querySelectorAll(
            ".sidebar a[href]"
        );

    links.forEach((link) => {
        if (
            link.getAttribute("href") === "#"
        ) {
            return;
        }

        const linkPath =
            new URL(
                link.href,
                window.location.origin
            )
                .pathname
                .replace(/\/+$/, "")
                .toLowerCase();

        if (linkPath !== currentPath) {
            return;
        }

        // CSS expects active class on the LI
        const listItem =
            link.closest("li");

        listItem?.classList.add(
            "active"
        );

        link.classList.add(
            "active"
        );

        // Keep its parent submenu open
        const group =
            link.closest(".menu-group");

        if (group) {
            group.classList.add(
                "open"
            );

            group
                .querySelector(
                    ":scope > .has-submenu"
                )
                ?.setAttribute(
                    "aria-expanded",
                    "true"
                );
        }
    });
}


// =====================================================
// Load profile from localStorage
// =====================================================

function loadStoredAdminProfile() {
    let admin = null;

    const possibleKeys = [
        "admin",
        "adminUser",
        "currentAdmin",
        "user"
    ];

    for (const key of possibleKeys) {
        const stored =
            localStorage.getItem(key);

        if (!stored) {
            continue;
        }

        try {
            admin =
                JSON.parse(stored);

            if (admin) {
                break;
            }
        } catch (error) {
            console.warn(
                `Invalid ${key} data in localStorage.`
            );
        }
    }

    const nameElement =
        document.getElementById(
            "adminName"
        );

    const roleElement =
        document.getElementById(
            "adminRole"
        );

    const imageElement =
        document.getElementById(
            "adminImage"
        );

    if (!admin) {
        if (nameElement) {
            nameElement.textContent =
                "Administrator";
        }

        if (roleElement) {
            roleElement.textContent =
                "Admin";
        }

        return;
    }

    const fullName =
        admin.full_name ||
        admin.name ||
        `${admin.first_name || ""} ${
            admin.last_name || ""
        }`.trim() ||
        "Administrator";

    if (nameElement) {
        nameElement.textContent =
            fullName;
    }

    if (roleElement) {
        roleElement.textContent =
            admin.role ||
            "Admin";
    }

    if (
        imageElement &&
        admin.profile_image
    ) {
        imageElement.src =
            admin.profile_image.startsWith(
                "http"
            )
                ? admin.profile_image
                : `/uploads/admins/${admin.profile_image}`;
    }
}


// =====================================================
// Logout
// =====================================================

function bindDashboardLogout() {
    const logoutButton =
        document.getElementById(
            "logoutBtn"
        );

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        (event) => {
            event.preventDefault();

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );

            if (!confirmed) {
                return;
            }

            [
                "token",
                "adminToken",
                "admin_token",
                "admin",
                "adminUser",
                "currentAdmin",
                "user"
            ].forEach((key) => {
                localStorage.removeItem(
                    key
                );
            });

            window.location.href =
                "/admin/login.html";
        }
    );
}


// =====================================================
// Initialize shared layout
// =====================================================

window.addEventListener(
    "DOMContentLoaded",
    async () => {
        await Promise.all([
            loadDashboardComponent(
                "sidebar-container",
                "/admin/components/sidebar.html"
            ),

            loadDashboardComponent(
                "topbar-container",
                "/admin/components/topbar.html"
            ),

            loadDashboardComponent(
                "footer-container",
                "/admin/components/footer.html"
            )
        ]);

        initializeSidebarMenus();
        highlightCurrentSidebarLink();
        loadStoredAdminProfile();
        bindDashboardLogout();
    }
);