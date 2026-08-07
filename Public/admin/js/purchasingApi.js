const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
const API_BASE_URL = RUKHNAV_ORIGIN;

function adminToken() {
    return localStorage.getItem("adminToken") ||
           localStorage.getItem("admin_token") ||
           localStorage.getItem("token") || "";
}

async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken()}`,
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
}

function money(value) {
    return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR"
    }).format(Number(value || 0));
}

function showError(error) {
    const el = document.querySelector("#notice");
    if (el) {
        el.textContent = error.message || String(error);
        el.style.display = "block";
    }
}
