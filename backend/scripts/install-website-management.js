"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");

function backup(file) {
    const target = `${file}.before-website-management`;
    if (fs.existsSync(file) && !fs.existsSync(target)) {
        fs.copyFileSync(file, target);
    }
}

function patchServer() {
    const file = path.join(backendRoot, "server.js");
    backup(file);
    let text = fs.readFileSync(file, "utf8");

    if (!text.includes('require("./routes/websiteCmsRoutes")')) {
        const marker = 'const customerPaymentsRoutes =';
        const index = text.indexOf(marker);
        if (index < 0) throw new Error("Unable to locate route import area.");
        text = text.slice(0,index) +
            'const websiteCmsRoutes = require("./routes/websiteCmsRoutes");\n' +
            'const publicWebsiteRoutes = require("./routes/publicWebsiteRoutes");\n\n' +
            text.slice(index);
    }

    if (!text.includes('"/api/admin/website"')) {
        const marker = '// Home Route';
        const index = text.indexOf(marker);
        if (index < 0) throw new Error("Unable to locate route mount area.");
        const mounts = `
app.use("/api/admin/website", websiteCmsRoutes);
app.use("/api/website", publicWebsiteRoutes);

`;
        text = text.slice(0,index) + mounts + text.slice(index);
    }

    fs.writeFileSync(file, text);
}

function patchSidebar() {
    const file = path.join(
        projectRoot,
        "public",
        "admin",
        "components",
        "sidebar.html"
    );

    if (!fs.existsSync(file)) return;
    backup(file);

    let text = fs.readFileSync(file, "utf8");

    if (!text.includes('/admin/website-management.html')) {
        throw new Error("Website Management sidebar link was not found.");
    }

    fs.writeFileSync(file, text);
}

patchServer();
patchSidebar();

console.log("Website Management CMS installed successfully.");
