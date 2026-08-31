"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const serverPath = path.join(backendRoot, "server.js");
const sidebarPath = path.join(projectRoot, "public/admin/components/sidebar.html");

function patchServer() {
    let text = fs.readFileSync(serverPath, "utf8");

    if (!text.includes('require("./routes/notificationCenterRoutes")')) {
        const requireMarker = 'const adminCustomerRoutes =\n    require("./routes/adminCustomerRoutes");';
        if (!text.includes(requireMarker)) {
            throw new Error("Could not find adminCustomerRoutes require marker in server.js");
        }
        text = text.replace(requireMarker, `${requireMarker}\n\nconst notificationCenterRoutes =\n    require("./routes/notificationCenterRoutes");`);
    }

    if (!text.includes('"/api/admin/notifications"')) {
        const mountMarker = 'app.use(\n    "/api/admin/customers",\n    adminCustomerRoutes\n);';
        if (!text.includes(mountMarker)) {
            throw new Error("Could not find admin customer route mount marker in server.js");
        }
        text = text.replace(mountMarker, `${mountMarker}\n\napp.use(\n    "/api/admin/notifications",\n    notificationCenterRoutes\n);`);
    }

    fs.writeFileSync(serverPath, text);
}

function patchSidebar() {
    if (!fs.existsSync(sidebarPath)) {
        console.warn("Sidebar file was not found; skipping sidebar patch.");
        return;
    }

    let text = fs.readFileSync(sidebarPath, "utf8");
    if (text.includes('/admin/notification-center.html')) {
        return;
    }

    const settingsItem = `                    <li>\n\n                        <a href="/admin/settings.html">\n\n                            <i class="fa-solid fa-gear"></i>\n\n                            <span>Settings</span>\n\n                        </a>\n\n                    </li>`;

    const notificationItem = `${settingsItem}\n\n\n                    <li>\n\n                        <a href="/admin/notification-center.html">\n\n                            <i class="fa-solid fa-bell"></i>\n\n                            <span>Notification Center</span>\n\n                        </a>\n\n                    </li>`;

    if (!text.includes(settingsItem)) {
        throw new Error("Could not find Settings sidebar item.");
    }

    text = text.replace(settingsItem, notificationItem);
    fs.writeFileSync(sidebarPath, text);
}

patchServer();
patchSidebar();
console.log("Notification Center installed into server.js and sidebar.html.");
