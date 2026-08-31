"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");

function backup(file) {
    const target = `${file}.before-finance-part3`;
    if (fs.existsSync(file) && !fs.existsSync(target)) {
        fs.copyFileSync(file, target);
    }
}

function patchSidebar() {
    const file = path.join(
        projectRoot,
        "public",
        "admin",
        "components",
        "sidebar.html"
    );

    backup(file);
    let text = fs.readFileSync(file, "utf8");

    const oldLinks = [
        "/admin/payments.html",
        "/admin/supplierPayments.html",
        "/admin/coupons.html",
        "/admin/finance-operations.html",
        "/admin/finance-automation.html"
    ];

    // Remove duplicate standalone submenu list items for payments/coupons.
    for (const href of oldLinks) {
        const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(
            `<li[^>]*>\\s*<a[^>]*href=["']${escaped}["'][\\s\\S]*?<\\/a>\\s*<\\/li>`,
            "gi"
        );
        text = text.replace(pattern, "");
    }

    const dashboardLinkPattern =
        /<li[^>]*>\s*<a[^>]*href=["']\/admin\/finance\.html["'][\s\S]*?<\/a>\s*<\/li>/i;

    const match = text.match(dashboardLinkPattern);

    if (!match) {
        throw new Error(
            "Finance Dashboard sidebar link was not found. Install Finance Part 1 and Part 2 first."
        );
    }

    const financeLinks = `${match[0]}

                    <li>
                        <a href="/admin/finance-operations.html">
                            <i class="fa-solid fa-money-bill-transfer"></i>
                            <span>Payments & Coupons</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/payments.html">
                            <i class="fa-solid fa-money-check-dollar"></i>
                            <span>Customer Payments</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/supplierPayments.html">
                            <i class="fa-solid fa-hand-holding-dollar"></i>
                            <span>Supplier Payments</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/coupons.html">
                            <i class="fa-solid fa-ticket"></i>
                            <span>Coupons & Discounts</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/finance-accounts.html">
                            <i class="fa-solid fa-sitemap"></i>
                            <span>Chart of Accounts</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/finance-journals.html">
                            <i class="fa-solid fa-book"></i>
                            <span>Journal Entries</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/finance-ledger.html">
                            <i class="fa-solid fa-book-open"></i>
                            <span>General Ledger</span>
                        </a>
                    </li>

                    <li>
                        <a href="/admin/finance-automation.html">
                            <i class="fa-solid fa-gears"></i>
                            <span>Automation & Reconciliation</span>
                        </a>
                    </li>`;

    // Remove existing Part 2 links after dashboard before reinserting combined group.
    text = text.replace(
        /<li[^>]*>\s*<a[^>]*href=["']\/admin\/finance-accounts\.html["'][\s\S]*?<\/a>\s*<\/li>/gi,
        ""
    );
    text = text.replace(
        /<li[^>]*>\s*<a[^>]*href=["']\/admin\/finance-journals\.html["'][\s\S]*?<\/a>\s*<\/li>/gi,
        ""
    );
    text = text.replace(
        /<li[^>]*>\s*<a[^>]*href=["']\/admin\/finance-ledger\.html["'][\s\S]*?<\/a>\s*<\/li>/gi,
        ""
    );

    text = text.replace(dashboardLinkPattern, financeLinks);
    fs.writeFileSync(file, text);

    console.log("Finance sidebar combined successfully.");
}

patchSidebar();
console.log("Finance Module Part 3 installed successfully.");
