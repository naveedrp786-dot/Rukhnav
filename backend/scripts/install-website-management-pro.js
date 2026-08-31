"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const serverFile = path.join(backendRoot, "server.js");

function backup(file) {
    const target = `${file}.before-website-management-pro`;
    if (fs.existsSync(file) && !fs.existsSync(target)) {
        fs.copyFileSync(file, target);
    }
}

function patchServer() {
    backup(serverFile);
    let text = fs.readFileSync(serverFile, "utf8");

    if (!text.includes('require("./routes/websiteCmsRoutes")')) {
        const marker = 'const express = require("express");';
        text = text.replace(
            marker,
            `${marker}
const websiteCmsRoutes = require("./routes/websiteCmsRoutes");
const publicWebsiteRoutes = require("./routes/publicWebsiteRoutes");`
        );
    }

    if (!text.includes('app.use("/uploads"')) {
        if (!text.includes('const path = require("path");')) {
            text = text.replace(
                'const express = require("express");',
                'const express = require("express");\nconst path = require("path");'
            );
        }

        const marker = 'app.use(express.json';
        const index = text.indexOf(marker);
        const mount =
            'app.use("/uploads", express.static(path.join(__dirname, "uploads")));\n\n';

        if (index >= 0) {
            text = text.slice(0, index) + mount + text.slice(index);
        }
    }

    if (!text.includes('app.use("/api/admin/website"')) {
        const marker = "// Home Route";
        const mounts =
            'app.use("/api/admin/website", websiteCmsRoutes);\n' +
            'app.use("/api/website", publicWebsiteRoutes);\n\n';

        const index = text.indexOf(marker);
        text = index >= 0
            ? text.slice(0, index) + mounts + text.slice(index)
            : text + "\n" + mounts;
    }

    fs.writeFileSync(serverFile, text);
}

function patchSidebar() {
    const file = path.join(
        projectRoot,
        "public",
        "admin",
        "components",
        "sidebar.html"
    );

    if (!fs.existsSync(file)) {
        console.log("Sidebar not found; Website Management page is still available directly.");
        return;
    }

    let text = fs.readFileSync(file, "utf8");

    if (text.includes("/admin/website-management.html")) {
        return;
    }

    backup(file);

    const item = `
                <li>
                    <a href="/admin/website-management.html">
                        <i class="fa-solid fa-store"></i>
                        <span>Website Management</span>
                    </a>
                </li>
`;

    const logoutIndex = text.lastIndexOf("<li");
    text = logoutIndex >= 0
        ? text.slice(0, logoutIndex) + item + text.slice(logoutIndex)
        : text.replace("</ul>", `${item}</ul>`);

    fs.writeFileSync(file, text);
}

patchServer();
patchSidebar();

console.log("Website Management Pro installed.");
console.log("No public/store files were changed.");
