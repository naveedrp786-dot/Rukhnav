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


const themeStudioState = {
    category: "All",
    mode: "all",
    search: ""
};

function normaliseThemeStudioText(value = "") {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function themeStudioCategories() {
    const presets =
        window.RUKHNAV_THEME_PRESETS || [];

    return [
        "All",
        ...Array.from(
            new Set(
                presets
                    .map(
                        preset =>
                            preset.category ||
                            "Other"
                    )
                    .filter(Boolean)
            )
        )
    ];
}

function themeStudioFilteredPresets() {
    const presets =
        window.RUKHNAV_THEME_PRESETS || [];

    const query =
        normaliseThemeStudioText(
            themeStudioState.search
        );

    return presets.filter(preset => {
        const theme =
            preset.theme || {};

        const category =
            preset.category ||
            "Other";

        if (
            themeStudioState.category !== "All" &&
            category !== themeStudioState.category
        ) {
            return false;
        }

        if (
            themeStudioState.mode !== "all" &&
            String(
                theme.theme_mode || ""
            ).toLowerCase() !==
                themeStudioState.mode
        ) {
            return false;
        }

        if (!query) {
            return true;
        }

        const haystack = [
            preset.name,
            preset.description,
            category,
            theme.theme_mode,
            theme.theme_treatment,
            theme.heading_font,
            theme.body_font
        ]
            .map(normaliseThemeStudioText)
            .join(" ");

        return haystack.includes(query);
    });
}

function renderThemeStudioControls() {
    const categories =
        document.getElementById(
            "rukhnavThemeCategories"
        );

    if (categories) {
        categories.innerHTML =
            themeStudioCategories()
                .map(category => `
                    <button
                        type="button"
                        class="rukhnav-theme-filter-chip ${
                            themeStudioState.category ===
                            category
                                ? "active"
                                : ""
                        }"
                        data-theme-category="${
                            themePresetEscape(category)
                        }"
                    >
                        ${
                            themePresetEscape(category)
                        }
                    </button>
                `)
                .join("");
    }

    const modeButtons =
        document.querySelectorAll(
            "[data-theme-mode-filter]"
        );

    modeButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.themeModeFilter ===
                themeStudioState.mode
        );
    });

    const search =
        document.getElementById(
            "rukhnavThemeSearch"
        );

    if (
        search &&
        search.value !== themeStudioState.search
    ) {
        search.value =
            themeStudioState.search;
    }
}

function bindThemeStudioControls() {
    const categoryContainer =
        document.getElementById(
            "rukhnavThemeCategories"
        );

    if (
        categoryContainer &&
        !categoryContainer.dataset.bound
    ) {
        categoryContainer.dataset.bound = "1";

        categoryContainer.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-theme-category]"
                    );

                if (!button) {
                    return;
                }

                themeStudioState.category =
                    button.dataset.themeCategory ||
                    "All";

                renderThemeStudioControls();
                renderThemePresets();
            }
        );
    }

    const modeContainer =
        document.getElementById(
            "rukhnavThemeModeFilters"
        );

    if (
        modeContainer &&
        !modeContainer.dataset.bound
    ) {
        modeContainer.dataset.bound = "1";

        modeContainer.addEventListener(
            "click",
            event => {
                const button =
                    event.target.closest(
                        "[data-theme-mode-filter]"
                    );

                if (!button) {
                    return;
                }

                themeStudioState.mode =
                    button.dataset.themeModeFilter ||
                    "all";

                renderThemeStudioControls();
                renderThemePresets();
            }
        );
    }

    const search =
        document.getElementById(
            "rukhnavThemeSearch"
        );

    if (
        search &&
        !search.dataset.bound
    ) {
        search.dataset.bound = "1";

        search.addEventListener(
            "input",
            event => {
                themeStudioState.search =
                    event.target.value || "";

                renderThemePresets();
            }
        );
    }
}

function renderThemePresets() {
    const container =
        document.getElementById(
            "rukhnavThemePresetLibrary"
        );

    if (!container) {
        return;
    }

    renderThemeStudioControls();
    bindThemeStudioControls();

    const allPresets =
        window.RUKHNAV_THEME_PRESETS || [];

    const presets =
        themeStudioFilteredPresets();

    const count =
        document.getElementById(
            "rukhnavThemePresetCount"
        );

    if (count) {
        count.textContent =
            presets.length ===
            allPresets.length
                ? `${allPresets.length} Themes`
                : `${presets.length} of ${allPresets.length}`;
    }

    if (!presets.length) {
        container.innerHTML = `
            <div class="theme-preset-empty">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <strong>No matching themes</strong>
                <span>
                    Try another category, appearance
                    or search phrase.
                </span>
            </div>
        `;
        return;
    }

    container.innerHTML =
        presets.map(preset => {

            const theme =
                preset.theme || {};

            const swatches = [
                theme.primary_color,
                theme.secondary_color,
                theme.accent_color,
                theme.highlight_color,
                theme.glow_color
            ].filter(Boolean);

            const headingFont =
                theme.heading_font ||
                "Georgia";

            const bodyFont =
                theme.body_font ||
                "Arial";

            const category =
                preset.category ||
                "Other";

            const mode =
                String(
                    theme.theme_mode ||
                    "light"
                ).toLowerCase();

            const treatment =
                theme.theme_treatment ||
                theme.atmosphere_mode ||
                "soft";

            const visualProfile =
                String(
                    theme.visual_profile ||
                    "signature"
                )
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9-]/g,
                        "-"
                    );

            return `
                <article
                    class="
                        rukhnav-theme-card
                        rukhnav-theme-card-${themePresetEscape(
                            mode
                        )}
                        rukhnav-theme-profile-${themePresetEscape(
                            visualProfile
                        )}
                    "
                    data-theme-preset="${themePresetEscape(
                        preset.id
                    )}"
                >
                    <div
                        class="rukhnav-theme-card-preview"
                        style="
                            --preview-primary:${themePresetEscape(
                                theme.primary_color
                            )};
                            --preview-secondary:${themePresetEscape(
                                theme.secondary_color
                            )};
                            --preview-accent:${themePresetEscape(
                                theme.accent_color
                            )};
                            --preview-background:${themePresetEscape(
                                theme.background_color
                            )};
                            --preview-surface:${themePresetEscape(
                                theme.surface_color
                            )};
                            --preview-text:${themePresetEscape(
                                theme.text_color
                            )};
                            --preview-heading:${themePresetEscape(
                                theme.heading_color
                            )};
                            --preview-muted:${themePresetEscape(
                                theme.muted_color
                            )};
                            --preview-link:${themePresetEscape(
                                theme.link_color
                            )};
                            --preview-shade-1:${themePresetEscape(
                                theme.shade_1 ||
                                theme.primary_color
                            )};
                            --preview-shade-2:${themePresetEscape(
                                theme.shade_2 ||
                                theme.secondary_color
                            )};
                            --preview-shade-3:${themePresetEscape(
                                theme.shade_3 ||
                                theme.accent_color
                            )};
                            --preview-shade-4:${themePresetEscape(
                                theme.shade_4 ||
                                theme.background_color
                            )};
                            --preview-highlight:${themePresetEscape(
                                theme.highlight_color ||
                                theme.secondary_color
                            )};
                            --preview-glow:${themePresetEscape(
                                theme.glow_color ||
                                theme.secondary_color
                            )};
                            --preview-heading-font:'${themePresetEscape(
                                headingFont
                            )}';
                            --preview-body-font:'${themePresetEscape(
                                bodyFont
                            )}';
                            --preview-card-radius:${Number(
                                theme.border_radius || 18
                            )}px;
                            --preview-button-radius:${Number(
                                theme.button_radius || 12
                            )}px;

                            --preview-smoke-strength:${Number(
                                theme.smoke_strength ?? 0.6
                            )};

                            --preview-glass-strength:${Number(
                                theme.glass_strength ?? 0.75
                            )};

                            --preview-glow-strength:${Number(
                                theme.glow_strength ?? 0.7
                            )};
                        "
                    >
                        <div class="rukhnav-theme-preview-atmosphere">
                            <span class="rukhnav-preview-orb orb-one"></span>
                            <span class="rukhnav-preview-orb orb-two"></span>
                            <span class="rukhnav-preview-orb orb-three"></span>
                        </div>

                        <div class="rukhnav-theme-preview-browser">
                            <div class="rukhnav-theme-preview-nav">
                                <span class="preview-brand">
                                    RUKHNAV
                                </span>

                                <div class="preview-nav-lines">
                                    <i></i>
                                    <i></i>
                                    <i></i>
                                </div>
                            </div>

                            <div class="rukhnav-theme-preview-hero">
                                <div class="preview-copy">
                                    <small>
                                        ${
                                            themePresetEscape(
                                                category
                                            )
                                        }
                                    </small>

                                    <strong>
                                        Beautiful Rituals
                                    </strong>

                                    <p>
                                        Herbal beauty,
                                        elevated.
                                    </p>

                                    <button
                                        type="button"
                                        tabindex="-1"
                                    >
                                        Shop Now
                                    </button>
                                </div>

                                <div class="preview-product">
                                    <span></span>
                                </div>
                            </div>

                            <div class="rukhnav-theme-preview-products">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>

                    <div class="rukhnav-theme-card-content">

                        <div class="rukhnav-theme-card-heading">
                            <div>
                                <div class="rukhnav-theme-card-tags">
                                    <span>
                                        ${
                                            themePresetEscape(
                                                category
                                            )
                                        }
                                    </span>

                                    <span>
                                        ${
                                            themePresetEscape(
                                                mode === "dark"
                                                    ? "Dark"
                                                    : "Light"
                                            )
                                        }
                                    </span>
                                </div>

                                <h4
                                    style="
                                        font-family:'${themePresetEscape(
                                            headingFont
                                        )}',serif;
                                    "
                                >
                                    ${
                                        themePresetEscape(
                                            preset.name
                                        )
                                    }
                                </h4>

                                <p>
                                    ${
                                        themePresetEscape(
                                            preset.description
                                        )
                                    }
                                </p>
                            </div>

                            <i
                                class="
                                    fa-solid
                                    fa-circle-check
                                    rukhnav-theme-selected-icon
                                "
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

                        <div class="rukhnav-theme-font-preview">
                            <div>
                                <small>Heading</small>
                                <strong
                                    style="
                                        font-family:'${themePresetEscape(
                                            headingFont
                                        )}',serif;
                                    "
                                >
                                    ${themePresetEscape(
                                        headingFont
                                    )}
                                </strong>
                            </div>

                            <div>
                                <small>Body</small>
                                <strong
                                    style="
                                        font-family:'${themePresetEscape(
                                            bodyFont
                                        )}',sans-serif;
                                    "
                                >
                                    ${themePresetEscape(
                                        bodyFont
                                    )}
                                </strong>
                            </div>
                        </div>

                        <div class="rukhnav-theme-meta">
                            <span>
                                <i class="fa-solid fa-layer-group"></i>
                                ${themePresetEscape(
                                    treatment
                                )}
                            </span>

                            <span>
                                <i class="fa-solid fa-circle-half-stroke"></i>
                                ${themePresetEscape(
                                    mode
                                )}
                            </span>
                        </div>

                        <button
                            type="button"
                            class="rukhnav-theme-apply"
                            data-apply-theme="${themePresetEscape(
                                preset.id
                            )}"
                        >
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            Apply Theme
                        </button>
                    </div>
                </article>
            `;
        }).join("");

    refreshThemePresetSelection();

    container
        .querySelectorAll(
            "[data-apply-theme]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                event => {
                    event.stopPropagation();

                    applyThemePreset(
                        button.dataset.applyTheme
                    );
                }
            );
        });

    container
        .querySelectorAll(
            "[data-theme-preset]"
        )
        .forEach(card => {
            card.addEventListener(
                "dblclick",
                () => {
                    applyThemePreset(
                        card.dataset.themePreset
                    );
                }
            );
        });
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
        renderThemePresets();
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
