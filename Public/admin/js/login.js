const RUKHNAV_ORIGIN = window.RUKHNAV_API_ORIGIN || window.location.origin;
// ==========================================
// RUKHNAV ERP Login
// ==========================================

const loginForm = document.getElementById("loginForm");

const emailInput = document.getElementById("email");

const passwordInput = document.getElementById("password");

const rememberMe = document.getElementById("rememberMe");

const togglePassword = document.getElementById("togglePassword");

const errorMessage = document.getElementById("errorMessage");

const loader = document.getElementById("loader");

const btnText = document.getElementById("btnText");

// ==========================================
// API URL
// ==========================================

const API_URL = RUKHNAV_ORIGIN + "/api/admin";

// ==========================================
// Toggle Password Visibility
// ==========================================

togglePassword.addEventListener("click", () => {

    const icon = togglePassword.querySelector("i");

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        icon.classList.remove("fa-eye");

        icon.classList.add("fa-eye-slash");

    } else {

        passwordInput.type = "password";

        icon.classList.remove("fa-eye-slash");

        icon.classList.add("fa-eye");

    }

});

// ==========================================
// Remember Me
// ==========================================

window.addEventListener("load", () => {

    const savedEmail = localStorage.getItem("rememberEmail");

    if (savedEmail) {

        emailInput.value = savedEmail;

        rememberMe.checked = true;

    }

});
// ==========================================
// Login Form Submit
// ==========================================

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    errorMessage.textContent = "";

    const email = emailInput.value.trim();

    const password = passwordInput.value.trim();

    if (!email || !password) {

        errorMessage.textContent =
            "Please enter email and password.";

        return;

    }

    loader.classList.remove("hidden");

    btnText.textContent = "Logging in...";

    try {

        const response = await fetch(

            `${API_URL}/login`,

            {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    email,
                    password

                })

            }

        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(

                data.message ||
                "Login failed."

            );

        }

        handleLoginSuccess(data);

    }

    catch (error) {

        errorMessage.textContent =
            error.message;

    }

    finally {

        loader.classList.add("hidden");

        btnText.textContent = "Login";

    }

});
// ==========================================
// Login Success
// ==========================================

function handleLoginSuccess(data) {

    if (rememberMe.checked) {

        localStorage.setItem(

            "rememberEmail",

            emailInput.value.trim()

        );

    } else {

        localStorage.removeItem(

            "rememberEmail"

        );

    }

    // Store JWT

    localStorage.setItem(

        "token",

        data.token

    );

    // Store Admin Data

    localStorage.setItem(

        "admin",

        JSON.stringify(data.admin)

    );

    // Redirect

    window.location.href =
        "dashboard.html";

}
// ==========================================
// Check Login Status
// ==========================================

function isLoggedIn() {

    return !!localStorage.getItem(
        "token"
    );

}

// ==========================================
// Logout
// ==========================================

function logout() {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "admin"
    );

    window.location.href =
        "login.html";

}

// ==========================================
// Auto Redirect
// ==========================================

if (

    window.location.pathname
        .includes("login.html")

) {

    if (isLoggedIn()) {

        window.location.href =
            "dashboard.html";

    }

}