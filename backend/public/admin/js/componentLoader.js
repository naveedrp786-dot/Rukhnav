"use strict";

/*
 * RUKHNAV ERP shared layout loader.
 * This remains compatible with pages that already use componentLoader.js,
 * while keeping sidebar state, topbar identity and admin profile consistent.
 */

const RUKHNAV_SIDEBAR_SCROLL_KEY = "rukhnav_admin_sidebar_scroll";


/* =========================================
   Global Admin Notification Bell
========================================= */

function loadAdminNotificationBell() {
    if (
        window.RUKHNAV_ADMIN_NOTIFICATION_BELL_V2 ||
        document.querySelector(
            'script[data-rukhnav-admin-notification-bell]'
        )
    ) {
        return;
    }

    const script =
        document.createElement("script");

    script.src =
        "/admin/js/admin-notification-bell.js?v=3";

    script.async =
        true;

    script.dataset
        .rukhnavAdminNotificationBell =
        "true";

    document.head
        .appendChild(script);
}



async function loadComponent(targetId, url) {
    const target = document.getElementById(targetId);
    if (!target) return;
    try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`${url} returned ${response.status}`);
        target.innerHTML = await response.text();
    } catch (error) {
        console.error("Component load error:", error);
    }
}

function setGroupOpen(group, open) {
    if (!group) return;
    group.classList.toggle("open", open);
    group.querySelector(":scope > .has-submenu")
        ?.setAttribute("aria-expanded", String(open));
}

function initialiseSidebar() {
    const groups = [...document.querySelectorAll(".sidebar .menu-group")];
    groups.forEach(group => {
        const button = group.querySelector(":scope > .has-submenu");
        if (!button || button.dataset.bound === "1") return;
        button.dataset.bound = "1";
        button.addEventListener("click", event => {
            event.preventDefault();
            const opening = !group.classList.contains("open");
            groups.forEach(other => {
                if (other !== group) setGroupOpen(other, false);
            });
            setGroupOpen(group, opening);
        });
    });
}

function normalisePath(value) {
    let path = String(value || "").split("?")[0].split("#")[0].toLowerCase();
    if (path.endsWith("/") && path !== "/") path = path.slice(0, -1);
    return path;
}

function markActiveNavigation() {
    const currentPath = normalisePath(location.pathname);
    let activeLink = null;

    document.querySelectorAll(".sidebar a[href]").forEach(link => {
        const rawHref = link.getAttribute("href") || "";
        if (!rawHref || rawHref === "#") return;
        const linkPath = normalisePath(new URL(link.href, location.origin).pathname);
        const active = linkPath === currentPath;
        link.classList.toggle("active", active);
        link.closest("li")?.classList.toggle("active", active);
        if (active) activeLink = link;
    });

    if (!activeLink) return;
    activeLink.setAttribute("aria-current", "page");
    setGroupOpen(activeLink.closest(".menu-group"), true);
    /* Deliberately no scrollIntoView(): it caused sidebar jumps toward Logout. */
}

function getSidebarScroller() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return null;
    const nav = sidebar.querySelector(".sidebar-nav");
    return nav && nav.scrollHeight > nav.clientHeight ? nav : sidebar;
}

function restoreSidebarScroll() {
    const scroller = getSidebarScroller();
    if (!scroller) return;
    const saved = Number(sessionStorage.getItem(RUKHNAV_SIDEBAR_SCROLL_KEY));
    if (!Number.isFinite(saved) || saved < 0) return;
    requestAnimationFrame(() => { scroller.scrollTop = saved; });
}

function bindSidebarScrollMemory() {
    const scroller = getSidebarScroller();
    if (!scroller || scroller.dataset.scrollMemory === "1") return;
    scroller.dataset.scrollMemory = "1";
    const remember = () => sessionStorage.setItem(
        RUKHNAV_SIDEBAR_SCROLL_KEY,
        String(scroller.scrollTop || 0)
    );
    scroller.addEventListener("scroll", remember, { passive: true });
    document.querySelectorAll(".sidebar a[href]").forEach(link => {
        if ((link.getAttribute("href") || "") !== "#") {
            link.addEventListener("click", remember);
        }
    });
}

function storedAdmin() {
    const keys = ["admin", "adminUser", "currentAdmin", "user"];
    for (const key of keys) {
        try {
            const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch {}
    }
    return null;
}

function renderAdmin(admin = {}) {
    const name = document.getElementById("adminName");
    const role = document.getElementById("adminRole");
    const image = document.getElementById("adminImage");
    const fullName = admin.full_name || admin.name ||
        `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || "Administrator";
    if (name) name.textContent = fullName;
    if (role) role.textContent = admin.role || "Admin";
    if (image) {
        if (admin.profile_image) {
            image.src = /^https?:/i.test(admin.profile_image)
                ? admin.profile_image
                : `/uploads/admins/${admin.profile_image}`;
        }
        image.onerror = () => { image.src = "/admin/images/default-user.png"; };
    }
}

async function loadAdminProfile() {
    renderAdmin(storedAdmin() || {});
    const token = localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") ||
        localStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch("/api/admin/profile", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data?.success && data?.admin) renderAdmin(data.admin);
    } catch (error) {
        console.warn("Admin profile could not be refreshed:", error);
    }
}

function bindLogoutAction() {
    const button = document.getElementById("logoutBtn");
    if (!button || button.dataset.bound === "1") return;
    button.dataset.bound = "1";
    button.addEventListener("click", event => {
        event.preventDefault();
        if (!confirm("Are you sure you want to logout?")) return;
        ["token","adminToken","admin_token","admin","adminUser","currentAdmin","user"]
            .forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
        sessionStorage.removeItem(RUKHNAV_SIDEBAR_SCROLL_KEY);
        location.href = "/admin/login.html";
    });
}


function setSharedTopbarPageTitle() {
    const target = document.getElementById("pageTitle");
    if (!target) return;

    const pageHeading = document.querySelector(
        ".main .content h1, .main .erp-page h1, main h1:not(#pageTitle)"
    );

    const fallback = document.title
        .replace(/\s*\|\s*RUKHNAV.*$/i, "")
        .trim();

    target.textContent = pageHeading?.textContent?.trim() || fallback || "RUKHNAV ERP";
}



function applyUnifiedPageHero() {
    const main = document.querySelector("main.main");
    if (!main) return;

    const currentPage = (location.pathname.split("/").pop() || "").toLowerCase();
    if (["", "index.html", "dashboard.html", "login.html"].includes(currentPage)) {
        return;
    }

    const heading = [...main.querySelectorAll("h1")].find(
        item => !item.closest("#topbar-container")
    );
    if (!heading) return;

    let hero = heading.closest(
        ".page-header, .erp-page-header, .erp-v5-hero, .executive-header, " +
        ".reviews-hero, .review-hero, .product-management-hero, .products-hero, " +
        ".settings-header, .admins-header, .admin-page-header, .reports-header, " +
        ".loyalty-header, .payment-header, .payments-header, .coupon-header, " +
        ".invoices-header, .orders-header, .events-header, .referrals-header"
    );

    if (!hero) {
        const copy = heading.parentElement;
        const candidate = copy?.parentElement;

        if (
            candidate &&
            candidate !== main &&
            !candidate.matches(".content, .erp-page") &&
            candidate.querySelector("p")
        ) {
            hero = candidate;
        } else {
            hero = copy;
        }
    }

    if (!hero || hero.closest("#topbar-container")) return;

    hero.classList.add("rukhnav-page-hero");

    // Give the left copy column a stable class without changing page logic.
    const copyBlock = heading.parentElement;
    if (copyBlock && copyBlock !== hero) {
        copyBlock.classList.add("rukhnav-page-hero__copy");
    }

    // Existing action containers retain their original IDs/classes and handlers.
    const actionBlock = hero.querySelector(
        ".header-actions, .erp-header-actions, .erp-v5-hero__actions, .page-actions"
    );
    actionBlock?.classList.add("rukhnav-page-hero__actions");
}

async function initializeAdminLayout() {
    if (window.RUKHNAV_ADMIN_LAYOUT_INITIALIZED) return;
    window.RUKHNAV_ADMIN_LAYOUT_INITIALIZED = true;
    try {
        await Promise.all([
            loadComponent("sidebar-container", "/admin/components/sidebar.html"),
            loadComponent("topbar-container", "/admin/components/topbar.html"),
            loadComponent("footer-container", "/admin/components/footer.html")
        ]);

        loadAdminNotificationBell();

        initialiseSidebar();
        markActiveNavigation();
        restoreSidebarScroll();
        bindSidebarScrollMemory();
        bindLogoutAction();
        setSharedTopbarPageTitle();
        applyUnifiedPageHero();
        await loadAdminProfile();
    } catch (error) {
        window.RUKHNAV_ADMIN_LAYOUT_INITIALIZED = false;
        console.error("Admin layout error:", error);
    }
}

window.initializeAdminLayout = initializeAdminLayout;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAdminLayout, { once: true });
} else {
    initializeAdminLayout();
}
