"use strict";

const API_BASE = "/api/admin/website";
const state = {settings:{}, status:"Draft"};

const $ = id => document.getElementById(id);

function token() {
    return (
        localStorage.getItem("adminToken") ||
        localStorage.getItem("admin_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("adminToken") ||
        sessionStorage.getItem("admin_token") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("authToken") ||
        ""
    );
}

async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const auth = token();

    if (auth) {
        headers.set(
            "Authorization",
            auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`
        );
    }

    if (options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        body:
            options.body instanceof FormData ||
            typeof options.body === "string" ||
            options.body == null
                ? options.body
                : JSON.stringify(options.body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
}

function getPath(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
    const keys = path.split(".");
    let current = object;

    keys.slice(0, -1).forEach(key => {
        if (!current[key] || typeof current[key] !== "object") {
            current[key] = {};
        }
        current = current[key];
    });

    current[keys.at(-1)] = value;
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function message(text, type = "") {
    const element = $("message");
    element.textContent = text || "";
    element.className = `wmp-message ${type}`.trim();
}

function status() {
    $("statusBar").innerHTML = `
        <strong>${escapeHtml(state.status || "Draft")}</strong>
        <span>Storefront files are protected. Only published settings are sent to customers.</span>
    `;
}

function bindFields() {
    document.querySelectorAll("[data-path]").forEach(input => {
        const value = getPath(state.settings, input.dataset.path);

        if (input.type === "checkbox") {
            input.checked = Boolean(value);
        } else if (value !== undefined && value !== null) {
            input.value = value;
        }

        if (input.dataset.bound === "true") return;
        input.dataset.bound = "true";

        input.addEventListener("input", () => {
            const next =
                input.type === "checkbox"
                    ? input.checked
                    : input.type === "number"
                        ? Number(input.value || 0)
                        : input.value;

            setPath(state.settings, input.dataset.path, next);
        });
    });
}


// ======================================================
// Predefined Website Theme Presets
// ======================================================

function themePresetEscape(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function themeMatchesPreset(preset) {
    const current =
        state.settings.theme || {};

    return Object.entries(
        preset.theme || {}
    ).every(
        ([key, value]) =>
            String(current[key] ?? "") ===
            String(value ?? "")
    );
}

function refreshThemePresetSelection() {
    const presets =
        window.RUKHNAV_THEME_PRESETS || [];

    document
        .querySelectorAll(
            "[data-theme-preset]"
        )
        .forEach(card => {

            const preset =
                presets.find(
                    item =>
                        item.id ===
                        card.dataset.themePreset
                );

            card.classList.toggle(
                "selected",
                Boolean(
                    preset &&
                    themeMatchesPreset(
                        preset
                    )
                )
            );
        });
}

function applyThemePreset(presetId) {
    const presets =
        window.RUKHNAV_THEME_PRESETS || [];

    const preset =
        presets.find(
            item =>
                item.id === presetId
        );

    if (!preset) {
        message(
            "Theme preset could not be found.",
            "error"
        );
        return;
    }

    state.settings.theme = {
        ...(state.settings.theme || {}),
        ...(preset.theme || {})
    };

    /*
     * Refill the existing editable Theme controls
     * from the updated state object.
     */
    bindFields();

    refreshThemePresetSelection();

    message(
        `${preset.name} applied to the draft. ` +
        "Review or customise the settings below, " +
        "then Save Draft and Publish.",
        "success"
    );
}

function renderThemePresets() {
    const container =
        document.getElementById(
            "rukhnavThemePresetLibrary"
        );

    if (!container) {
        return;
    }

    const presets =
        window.RUKHNAV_THEME_PRESETS || [];

    const count =
        document.getElementById(
            "rukhnavThemePresetCount"
        );

    if (count) {
        count.textContent =
            `${presets.length} Themes`;
    }

    container.innerHTML =
        presets.map(preset => {

            const theme =
                preset.theme || {};

            const swatches = [
                theme.primary_color,
                theme.secondary_color,
                theme.accent_color,
                theme.background_color,
                theme.surface_color
            ].filter(Boolean);

            return `
                <article
                    class="rukhnav-theme-card"
                    data-theme-preset="${themePresetEscape(
                        preset.id
                    )}"
                >
                    <div class="rukhnav-theme-card-preview">
                        <div
                            class="rukhnav-theme-preview-top"
                            style="
                                background:${themePresetEscape(
                                    theme.primary_color
                                )};
                            "
                        >
                            <span
                                style="
                                    background:${themePresetEscape(
                                        theme.secondary_color
                                    )};
                                "
                            ></span>

                            <span
                                style="
                                    background:${themePresetEscape(
                                        theme.accent_color
                                    )};
                                "
                            ></span>
                        </div>

                        <div
                            class="rukhnav-theme-preview-body"
                            style="
                                background:${themePresetEscape(
                                    theme.background_color
                                )};
                                color:${themePresetEscape(
                                    theme.text_color
                                )};
                            "
                        >
                            <strong
                                style="
                                    color:${themePresetEscape(
                                        theme.heading_color
                                    )};
                                "
                            >
                                Aa
                            </strong>

                            <span
                                style="
                                    background:${themePresetEscape(
                                        theme.primary_color
                                    )};
                                    border-radius:${Number(
                                        theme.button_radius || 0
                                    )}px;
                                "
                            >
                                Shop
                            </span>
                        </div>
                    </div>

                    <div class="rukhnav-theme-card-content">

                        <div class="rukhnav-theme-card-heading">
                            <div>
                                <h4>
                                    ${themePresetEscape(
                                        preset.name
                                    )}
                                </h4>

                                <p>
                                    ${themePresetEscape(
                                        preset.description
                                    )}
                                </p>
                            </div>

                            <i
                                class="fa-solid fa-circle-check
                                rukhnav-theme-selected-icon"
                            ></i>
                        </div>

                        <div class="rukhnav-theme-swatches">
                            ${swatches.map(
                                colour => `
                                    <span
                                        title="${themePresetEscape(
                                            colour
                                        )}"
                                        style="
                                            background:${themePresetEscape(
                                                colour
                                            )};
                                        "
                                    ></span>
                                `
                            ).join("")}
                        </div>

                        <div class="rukhnav-theme-meta">
                            <span>
                                ${themePresetEscape(
                                    theme.heading_font ||
                                    "Default"
                                )}
                            </span>

                            <span>
                                ${Number(
                                    theme.border_radius || 0
                                )}px radius
                            </span>
                        </div>

                        <button
                            type="button"
                            class="rukhnav-theme-apply"
                            data-apply-theme="${themePresetEscape(
                                preset.id
                            )}"
                        >
                            <i class="fa-solid fa-palette"></i>
                            Apply Theme
                        </button>
                    </div>
                </article>
            `;
        }).join("");

    container
        .querySelectorAll(
            "[data-apply-theme]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {
                    applyThemePreset(
                        button.dataset.applyTheme
                    );
                }
            );
        });

    refreshThemePresetSelection();
}


function renderNavigation() {
    state.settings.navigation ||= [];
    $("navEditor").innerHTML = state.settings.navigation.map((item, index) => `
        <div class="repeat-row nav-row">
            <input data-nav="label" data-index="${index}" value="${escapeHtml(item.label || "")}" placeholder="Label">
            <input data-nav="url" data-index="${index}" value="${escapeHtml(item.url || "")}" placeholder="URL">
            <input type="number" data-nav="sort_order" data-index="${index}" value="${Number(item.sort_order || index + 1)}">
            <label><input type="checkbox" data-nav="enabled" data-index="${index}" ${item.enabled !== false ? "checked" : ""}>Enabled</label>
            <button type="button" class="delete" data-delete-nav="${index}"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join("");

    document.querySelectorAll("[data-nav]").forEach(input => {
        input.addEventListener("input", () => {
            const item = state.settings.navigation[Number(input.dataset.index)];
            item[input.dataset.nav] =
                input.type === "checkbox"
                    ? input.checked
                    : input.type === "number"
                        ? Number(input.value || 0)
                        : input.value;
        });
    });

    document.querySelectorAll("[data-delete-nav]").forEach(button => {
        button.addEventListener("click", () => {
            state.settings.navigation.splice(Number(button.dataset.deleteNav), 1);
            renderNavigation();
        });
    });
}

function renderCategories() {
    state.settings.home ||= {};
    state.settings.home.category_cards ||= [];

    $("categoryEditor").innerHTML =
        state.settings.home.category_cards.map((item, index) => `
            <div class="repeat-row category-row">
                <input data-category="title" data-index="${index}" value="${escapeHtml(item.title || "")}" placeholder="Title">
                <input data-category="text" data-index="${index}" value="${escapeHtml(item.text || "")}" placeholder="Description">
                <input data-category="url" data-index="${index}" value="${escapeHtml(item.url || "")}" placeholder="URL">
                <input data-category="image_url" data-index="${index}" value="${escapeHtml(item.image_url || "")}" placeholder="Image URL">
                <input data-category="icon" data-index="${index}" value="${escapeHtml(item.icon || "fa-leaf")}" placeholder="Icon">
                <label><input type="checkbox" data-category="enabled" data-index="${index}" ${item.enabled !== false ? "checked" : ""}>Enabled</label>
                <button type="button" class="delete" data-delete-category="${index}"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join("");

    document.querySelectorAll("[data-category]").forEach(input => {
        input.addEventListener("input", () => {
            const item =
                state.settings.home.category_cards[Number(input.dataset.index)];

            item[input.dataset.category] =
                input.type === "checkbox"
                    ? input.checked
                    : input.value;
        });
    });

    document.querySelectorAll("[data-delete-category]").forEach(button => {
        button.addEventListener("click", () => {
            state.settings.home.category_cards.splice(
                Number(button.dataset.deleteCategory),
                1
            );
            renderCategories();
        });
    });
}

async function upload(file, mediaType = "Image") {
    const form = new FormData();
    form.append("file", file);
    form.append("media_type", mediaType);

    const data = await request("/media", {
        method: "POST",
        body: form
    });

    return data.media;
}

function bindUploads() {
    document.querySelectorAll("[data-upload-path]").forEach(input => {
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                message(`Uploading ${file.name}...`);
                const media = await upload(
                    file,
                    input.dataset.uploadType || "Image"
                );

                setPath(
                    state.settings,
                    input.dataset.uploadPath,
                    media.file_url
                );

                const target = document.querySelector(
                    `[data-path="${input.dataset.uploadPath}"]`
                );

                if (target) target.value = media.file_url;

                message("Image uploaded. Save Draft, then Publish.", "success");
            } catch (error) {
                message(error.message, "error");
            } finally {
                input.value = "";
            }
        });
    });

    $("libraryUpload")?.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            await upload(file, "Image");
            message("Image added to Media Library.", "success");
            await loadMedia();
        } catch (error) {
            message(error.message, "error");
        } finally {
            event.target.value = "";
        }
    });
}

async function loadMedia() {
    try {
        const data = await request("/media");
        $("mediaGrid").innerHTML = (data.media || []).map(item => `
            <article class="media-card">
                <img src="${escapeHtml(item.file_url)}" alt="${escapeHtml(item.alt_text || item.file_name)}">
                <strong>${escapeHtml(item.file_name)}</strong>
                <code>${escapeHtml(item.file_url)}</code>
                <button type="button" data-copy="${escapeHtml(item.file_url)}">Copy URL</button>
            </article>
        `).join("") || "<p>No media uploaded yet.</p>";

        document.querySelectorAll("[data-copy]").forEach(button => {
            button.addEventListener("click", async () => {
                await navigator.clipboard.writeText(button.dataset.copy);
                message("Media URL copied.", "success");
            });
        });
    } catch (error) {
        $("mediaGrid").innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
}

async function loadHistory() {
    try {
        const data = await request("/history");
        $("historyList").innerHTML = (data.history || []).map(item => `
            <article>
                <strong>${escapeHtml(item.action_type)}</strong>
                <span>${escapeHtml(item.created_by_name || "Admin")} · ${new Date(item.created_at).toLocaleString()}</span>
            </article>
        `).join("") || "<p>No history yet.</p>";
    } catch {
        $("historyList").innerHTML = "<p>No history available.</p>";
    }
}


async function mergeDefaults() {
    try {
        const data =
            await request(
                "/merge-defaults",
                {
                    method: "POST"
                }
            );

        state.settings =
            data.settings ||
            state.settings;

        state.settings.pages ||=
            {};

        bindFields();
        renderThemePresets();
        renderNavigation();
        renderCategories();

        message(
            data.message,
            "success"
        );

        await loadHistory();
    } catch (error) {
        message(
            error.message,
            "error"
        );
    }
}

async function load() {
    try {
        const data = await request("/settings");
        state.settings = data.settings || {};
        state.settings.pages ||= {};
        state.status = data.status || "Draft";

        bindFields();
        renderNavigation();
        renderCategories();
        bindUploads();
        status();

        await Promise.all([
            loadMedia(),
            loadHistory()
        ]);
    } catch (error) {
        message(error.message, "error");
    }
}

async function save() {
    try {
        const data = await request("/settings", {
            method: "PUT",
            body: {settings: state.settings}
        });

        state.status = "Draft";
        status();
        message(data.message, "success");
        await loadHistory();
    } catch (error) {
        message(error.message, "error");
    }
}

async function publish() {
    try {
        await save();

        const data = await request("/publish", {
            method: "POST"
        });

        state.status = "Published";
        status();
        message(data.message, "success");
        await loadHistory();
    } catch (error) {
        message(error.message, "error");
    }
}

async function restore() {
    if (!confirm("Restore the draft to the last published website?")) return;

    try {
        const data = await request("/restore-published", {
            method: "POST"
        });

        message(data.message, "success");
        location.reload();
    } catch (error) {
        message(error.message, "error");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-tab]").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll("[data-tab]").forEach(item =>
                item.classList.remove("active")
            );
            document.querySelectorAll("[data-panel]").forEach(item =>
                item.classList.remove("active")
            );

            button.classList.add("active");
            document.querySelector(
                `[data-panel="${button.dataset.tab}"]`
            )?.classList.add("active");
        });
    });

    $("addNav").addEventListener("click", () => {
        state.settings.navigation ||= [];
        state.settings.navigation.push({
            label: "New Link",
            url: "#",
            enabled: true,
            sort_order: state.settings.navigation.length + 1
        });
        renderNavigation();
    });

    $("addCategory").addEventListener("click", () => {
        state.settings.home ||= {};
        state.settings.home.category_cards ||= [];
        state.settings.home.category_cards.push({
            title: "New Category",
            text: "",
            url: "products.html",
            image_url: "",
            icon: "fa-leaf",
            enabled: true
        });
        renderCategories();
    });

    $("saveButton").addEventListener("click", save);
    $("publishButton").addEventListener("click", publish);
    $("mergeDefaultsButton")
        .addEventListener(
            "click",
            mergeDefaults
        );

    $("restoreButton")
        .addEventListener(
            "click",
            restore
        );

    load();
});
