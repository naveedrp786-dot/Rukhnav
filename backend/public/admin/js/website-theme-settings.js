"use strict";
const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;

const API = RUKHNAV_ORIGIN + "/api/admin/website/settings";

const token =
    localStorage.getItem("token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("adminToken") ||
    sessionStorage.getItem("admin_token");

if (!token) {
    window.location.href = "login.html";
}

const $ = id => document.getElementById(id);

const GROUP_META = {
    branding: {
        title: "Brand Identity",
        description: "Configure the name, tagline, logo and favicon used across the storefront."
    },
    theme: {
        title: "Theme Appearance",
        description: "Set storefront colors, typography, rounded corners and product-card appearance."
    },
    header: {
        title: "Header & Navigation",
        description: "Control the announcement bar, search, categories and customer shortcuts."
    },
    footer: {
        title: "Footer Content",
        description: "Edit footer messaging, newsletter content and payment icon visibility."
    },
    store: {
        title: "Store Behaviour",
        description: "Configure currency, catalog behaviour, reviews, loyalty, coupons and product browsing."
    },
    payments: {
        title: "Payment Methods",
        description: "Choose available payment methods and provide account details shown during checkout."
    },
    contact: {
        title: "Contact Information",
        description: "Maintain support contact details, address, WhatsApp and business hours."
    },
    social: {
        title: "Social Profiles",
        description: "Connect the storefront footer and social components to official profiles."
    },
    seo: {
        title: "Search & Sharing",
        description: "Configure default metadata, indexing and website verification values."
    }
};

const SCHEMA = {
    branding: [
        ["brand_name", "Brand Name", "text"],
        ["tagline", "Tagline", "text"],
        ["logo_url", "Logo URL or Path", "url", "Example: /uploads/website/logo.png"],
        ["logo_alt", "Logo Alt Text", "text"],
        ["favicon_url", "Favicon URL or Path", "url"]
    ],
    theme: [
        ["primary_color", "Primary Color", "color"],
        ["secondary_color", "Secondary Color", "color"],
        ["accent_color", "Accent Color", "color"],
        ["background_color", "Page Background", "color"],
        ["surface_color", "Card Background", "color"],
        ["text_color", "Text Color", "color"],
        ["muted_text_color", "Muted Text Color", "color"],
        ["heading_font", "Heading Font", "text"],
        ["body_font", "Body Font", "text"],
        ["border_radius", "Border Radius (px)", "number"],
        ["product_card_style", "Product Card Style", "select", ["elevated", "bordered", "minimal"]]
    ],
    header: [
        ["announcement_enabled", "Enable Announcement Bar", "boolean"],
        ["announcement_text", "Announcement Text", "text"],
        ["announcement_link", "Announcement Link", "url"],
        ["search_placeholder", "Search Placeholder", "text"],
        ["show_categories", "Show Category Navigation", "boolean"],
        ["show_account", "Show Account Shortcut", "boolean"],
        ["show_wishlist", "Show Wishlist Shortcut", "boolean"],
        ["show_orders", "Show Orders Shortcut", "boolean"],
        ["show_cart", "Show Cart Shortcut", "boolean"],
        ["sticky_header", "Sticky Header", "boolean"]
    ],
    footer: [
        ["short_description", "Brand Description", "textarea"],
        ["copyright_text", "Copyright Text", "text"],
        ["show_newsletter", "Show Newsletter Signup", "boolean"],
        ["newsletter_title", "Newsletter Title", "text"],
        ["newsletter_text", "Newsletter Description", "textarea"],
        ["show_payment_icons", "Show Payment Icons", "boolean"]
    ],
    store: [
        ["currency_code", "Currency Code", "text"],
        ["currency_symbol", "Currency Symbol", "text"],
        ["show_currency_code", "Display Currency Code", "boolean"],
        ["tax_included", "Prices Include Tax", "boolean"],
        ["show_out_of_stock", "Show Out-of-stock Products", "boolean"],
        ["allow_backorders", "Allow Backorders", "boolean"],
        ["wishlist_enabled", "Enable Wishlist", "boolean"],
        ["reviews_enabled", "Enable Reviews", "boolean"],
        ["loyalty_enabled", "Enable Loyalty", "boolean"],
        ["coupons_enabled", "Enable Coupons", "boolean"],
        ["compare_enabled", "Enable Product Comparison", "boolean"],
        ["recently_viewed_enabled", "Enable Recently Viewed", "boolean"],
        ["products_per_page", "Products Per Page", "number"],
        ["default_sort", "Default Product Sort", "select", ["featured", "newest", "price_low", "price_high", "rating"]]
    ],
    payments: [
        ["cash_on_delivery_enabled", "Cash on Delivery", "boolean"],
        ["easypaisa_enabled", "EasyPaisa", "boolean"],
        ["jazzcash_enabled", "JazzCash", "boolean"],
        ["bank_transfer_enabled", "Bank Transfer", "boolean"],
        ["card_enabled", "Card Payment", "boolean"],
        ["easypaisa_number", "EasyPaisa Number", "text"],
        ["jazzcash_number", "JazzCash Number", "text"],
        ["bank_name", "Bank Name", "text"],
        ["bank_account_title", "Account Title", "text"],
        ["bank_account_number", "Account Number", "text"],
        ["bank_iban", "IBAN", "text"]
    ],
    contact: [
        ["support_email", "Support Email", "email"],
        ["support_phone", "Support Phone", "text"],
        ["whatsapp_number", "WhatsApp Number", "text"],
        ["address", "Address", "textarea"],
        ["city", "City", "text"],
        ["country", "Country", "text"],
        ["business_hours", "Business Hours", "textarea"]
    ],
    social: [
        ["facebook_url", "Facebook URL", "url"],
        ["instagram_url", "Instagram URL", "url"],
        ["tiktok_url", "TikTok URL", "url"],
        ["youtube_url", "YouTube URL", "url"],
        ["x_url", "X / Twitter URL", "url"],
        ["pinterest_url", "Pinterest URL", "url"]
    ],
    seo: [
        ["site_title", "Default Site Title", "text"],
        ["meta_description", "Meta Description", "textarea"],
        ["meta_keywords", "Meta Keywords", "textarea"],
        ["og_image_url", "Open Graph Image URL", "url"],
        ["robots_index", "Allow Search Engine Indexing", "boolean"],
        ["google_site_verification", "Google Site Verification", "text"],
        ["facebook_domain_verification", "Facebook Domain Verification", "text"]
    ]
};

let settings = {};
let activeGroup = "branding";
let messageTimer;

function authHeaders(json = false) {
    const headers = {
        Authorization: token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`
    };

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

async function request(url, options = {}) {
    const response = await fetch(url, options);
    let data = {};

    try {
        data = await response.json();
    } catch {}

    if (response.status === 401 || response.status === 403) {
        window.location.href = "login.html";
        throw new Error("Your admin session has expired.");
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed with status ${response.status}.`);
    }

    return data;
}

function showMessage(text, type = "success") {
    clearTimeout(messageTimer);

    const box = $("settingsMessage");
    box.textContent = text;
    box.className = `settings-message show ${type}`;

    messageTimer = setTimeout(() => {
        box.textContent = "";
        box.className = "settings-message";
    }, 5000);
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function fieldMarkup(definition, value) {
    const [key, label, type, extra] = definition;
    const id = `setting_${key}`;

    if (type === "boolean") {
        return `
            <label class="field-group toggle-field">
                <span>${escapeHtml(label)}</span>
                <input
                    type="checkbox"
                    id="${id}"
                    data-key="${escapeHtml(key)}"
                    data-type="boolean"
                    ${value ? "checked" : ""}
                >
            </label>
        `;
    }

    if (type === "textarea") {
        return `
            <div class="field-group full">
                <label for="${id}">${escapeHtml(label)}</label>
                <textarea id="${id}" data-key="${escapeHtml(key)}" data-type="textarea" rows="4">${escapeHtml(value ?? "")}</textarea>
            </div>
        `;
    }

    if (type === "select") {
        return `
            <div class="field-group">
                <label for="${id}">${escapeHtml(label)}</label>
                <select id="${id}" data-key="${escapeHtml(key)}" data-type="select">
                    ${(extra || []).map(option => `
                        <option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>
                            ${escapeHtml(option.replaceAll("_", " "))}
                        </option>
                    `).join("")}
                </select>
            </div>
        `;
    }

    return `
        <div class="field-group">
            <label for="${id}">${escapeHtml(label)}</label>
            <input
                type="${escapeHtml(type)}"
                id="${id}"
                data-key="${escapeHtml(key)}"
                data-type="${escapeHtml(type)}"
                value="${escapeHtml(value ?? "")}"
            >
            ${extra && typeof extra === "string" ? `<small class="field-help">${escapeHtml(extra)}</small>` : ""}
        </div>
    `;
}

function renderGroup() {
    const meta = GROUP_META[activeGroup];

    $("activeGroupLabel").textContent = activeGroup.replaceAll("_", " ");
    $("activeGroupTitle").textContent = meta.title;
    $("activeGroupDescription").textContent = meta.description;

    const values = settings[activeGroup] || {};

    $("settingsFields").innerHTML = SCHEMA[activeGroup]
        .map(definition => fieldMarkup(definition, values[definition[0]]))
        .join("");

    document.querySelectorAll(".settings-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.group === activeGroup);
    });

    updatePreview();
}

function collectGroup() {
    const payload = {};

    $("settingsFields").querySelectorAll("[data-key]").forEach(field => {
        const key = field.dataset.key;
        const type = field.dataset.type;

        if (type === "boolean") {
            payload[key] = field.checked;
        } else if (type === "number") {
            payload[key] = Number(field.value || 0);
        } else {
            payload[key] = field.value.trim();
        }
    });

    return payload;
}

function updatePreview() {
    const branding = settings.branding || {};
    const theme = settings.theme || {};
    const header = settings.header || {};

    $("previewLogo").textContent = branding.brand_name || "RUKHNAV";
    $("previewTagline").textContent = branding.tagline || "Nature, Beauty & Care";
    $("previewSearch").textContent = header.search_placeholder || "Search products";
    $("previewAnnouncement").textContent = header.announcement_text || "";

    const frame = $("previewFrame");
    frame.style.setProperty("--preview-primary", theme.primary_color || "#173f2b");
    frame.style.backgroundColor = theme.background_color || "#f7f4ec";
    frame.style.color = theme.text_color || "#1f2a22";

    document.querySelectorAll(".preview-announcement,.preview-category-bar,.preview-hero button").forEach(element => {
        element.style.backgroundColor = theme.primary_color || "#173f2b";
    });

    document.querySelectorAll(".preview-hero").forEach(element => {
        element.style.background = `linear-gradient(135deg, ${theme.background_color || "#f7f4ec"}, ${theme.secondary_color || "#e5b83d"}55)`;
    });
}

async function loadSettings() {
    $("settingsLoading").classList.remove("hidden");
    $("settingsWorkspace").classList.add("hidden");

    try {
        const data = await request(API, {
            headers: authHeaders()
        });

        settings = data.settings || {};
        renderGroup();

        $("settingsLoading").classList.add("hidden");
        $("settingsWorkspace").classList.remove("hidden");
    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function saveCurrentGroup(event) {
    event.preventDefault();

    const button = $("saveSettingsBtn");
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving';

    try {
        const payload = collectGroup();

        const data = await request(`${API}/${activeGroup}`, {
            method: "PUT",
            headers: authHeaders(true),
            body: JSON.stringify(payload)
        });

        settings[activeGroup] = data.settings || payload;
        renderGroup();
        showMessage(`${GROUP_META[activeGroup].title} saved successfully.`);
    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

async function resetCurrentGroup() {
    const confirmed = window.confirm(
        `Restore ${GROUP_META[activeGroup].title} to its default values?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const data = await request(`${API}/${activeGroup}/reset`, {
            method: "POST",
            headers: authHeaders(true)
        });

        settings[activeGroup] = data.settings || {};
        renderGroup();
        showMessage(`${GROUP_META[activeGroup].title} restored to defaults.`);
    } catch (error) {
        showMessage(error.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".settings-tab").forEach(button => {
        button.addEventListener("click", () => {
            activeGroup = button.dataset.group;
            renderGroup();
        });
    });

    $("settingsForm").addEventListener("submit", saveCurrentGroup);
    $("resetGroupBtn").addEventListener("click", resetCurrentGroup);
    $("refreshSettingsBtn").addEventListener("click", loadSettings);

    $("settingsFields").addEventListener("input", event => {
        const key = event.target.dataset.key;

        if (!key) {
            return;
        }

        settings[activeGroup] = {
            ...(settings[activeGroup] || {}),
            ...collectGroup()
        };

        updatePreview();
    });

    loadSettings();
});
