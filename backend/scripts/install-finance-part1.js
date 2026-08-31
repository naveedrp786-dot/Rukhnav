"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot =
    path.resolve(
        __dirname,
        ".."
    );

const projectRoot =
    path.resolve(
        backendRoot,
        ".."
    );

function backup(
    file
) {
    const backupFile =
        `${file}.before-finance-part1`;

    if (!fs.existsSync(backupFile)) {
        fs.copyFileSync(
            file,
            backupFile
        );
    }
}

function patchServer() {
    const file =
        path.join(
            backendRoot,
            "server.js"
        );

    backup(file);

    let text =
        fs.readFileSync(
            file,
            "utf8"
        );

    if (
        !text.includes(
            'require("./routes/financeRoutes")'
        )
    ) {
        const marker =
            'const adminPaymentRoutes =\n    require("./routes/adminPaymentRoutes");';

        if (!text.includes(marker)) {
            throw new Error(
                "Unable to find admin payment route import marker."
            );
        }

        text =
            text.replace(
                marker,
                `${marker}\n\nconst financeRoutes =\n    require("./routes/financeRoutes");`
            );
    }

    if (
        !text.includes(
            '"/api/admin/finance"'
        )
    ) {
        const marker = `app.use(
    "/api/admin/payments",
    adminPaymentRoutes
);`;

        if (!text.includes(marker)) {
            throw new Error(
                "Unable to find admin payment route mount marker."
            );
        }

        text =
            text.replace(
                marker,
                `${marker}\n\napp.use(\n    "/api/admin/finance",\n    financeRoutes\n);`
            );
    }

    fs.writeFileSync(
        file,
        text
    );
}

function patchSidebar() {
    const file =
        path.join(
            projectRoot,
            "public",
            "admin",
            "components",
            "sidebar.html"
        );

    backup(file);

    let text =
        fs.readFileSync(
            file,
            "utf8"
        );

    if (
        text.includes(
            "/admin/finance.html"
        )
    ) {
        return;
    }

    const groupPattern =
        /<li\s+class="menu-group"[^>]*data-menu-group="finance"[\s\S]*?<\/li>\s*(?=<li\s+class="menu-section-title"|<\/ul>)/i;

    const existing =
        text.match(
            groupPattern
        );

    if (existing) {
        const block =
            existing[0];

        const submenuEnd =
            block.lastIndexOf(
                "</ul>"
            );

        const link = `
                    <li>
                        <a href="/admin/finance.html">
                            <i class="fa-solid fa-chart-pie"></i>
                            <span>Finance Dashboard</span>
                        </a>
                    </li>

`;

        const updated =
            block.slice(
                0,
                submenuEnd
            ) +
            link +
            block.slice(
                submenuEnd
            );

        text =
            text.replace(
                block,
                updated
            );
    } else {
        const reportsMarker =
            '<li class="menu-section-title">\n                Management\n            </li>';

        const financeGroup = `
            <li
                class="menu-group"
                data-menu-group="finance"
            >
                <button
                    type="button"
                    class="nav-link-item has-submenu"
                    aria-expanded="false"
                >
                    <i class="fa-solid fa-wallet"></i>
                    <span>Finance</span>
                    <i class="fa-solid fa-chevron-down submenu-arrow"></i>
                </button>

                <ul class="submenu">
                    <li>
                        <a href="/admin/finance.html">
                            <i class="fa-solid fa-chart-pie"></i>
                            <span>Finance Dashboard</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/payments.html">
                            <i class="fa-solid fa-money-bill-transfer"></i>
                            <span>Customer Payments</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/supplier-payments.html">
                            <i class="fa-solid fa-hand-holding-dollar"></i>
                            <span>Supplier Payments</span>
                        </a>
                    </li>
                </ul>
            </li>

`;

        if (!text.includes(reportsMarker)) {
            throw new Error(
                "Unable to locate sidebar Management marker."
            );
        }

        text =
            text.replace(
                reportsMarker,
                financeGroup +
                reportsMarker
            );
    }

    fs.writeFileSync(
        file,
        text
    );
}

patchServer();
patchSidebar();

console.log(
    "Finance Module Part 1 installed successfully."
);
