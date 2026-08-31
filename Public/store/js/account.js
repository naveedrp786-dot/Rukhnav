"use strict";

const AccountPage = {
    customer: null,
    messageTimer: null,

    async init() {
        await this.waitForStore();

        this.bind();

        if (API.isAuthenticated()) {
            await this.loadProfile();
        } else {
            this.showGuest();
        }

        this.applyReturnTab();
    },

    waitForStore() {
        return new Promise(resolve => {
            if (
                Store.settings &&
                Object.keys(Store.settings).length
            ) {
                resolve();
                return;
            }

            document.addEventListener(
                "rukhnav:store-ready",
                resolve,
                { once: true }
            );
        });
    },

    bind() {
        document
            .querySelectorAll(
                "[data-account-tab]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        this.showAuthForm(
                            button.dataset.accountTab
                        )
                );
            });

        document
            .querySelectorAll(
                "[data-password-toggle]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        this.togglePassword(
                            button
                        )
                );
            });

        document
            .getElementById("loginForm")
            .addEventListener(
                "submit",
                event =>
                    this.login(event)
            );

        document
            .getElementById("registerForm")
            .addEventListener(
                "submit",
                event =>
                    this.register(event)
            );

        document
            .getElementById("forgotPasswordForm")
            .addEventListener(
                "submit",
                event =>
                    this.requestPasswordReset(event)
            );

        document
            .getElementById("showForgotPassword")
            .addEventListener(
                "click",
                () =>
                    this.showAuthForm(
                        "forgot"
                    )
            );

        document
            .getElementById("backToLogin")
            .addEventListener(
                "click",
                () =>
                    this.showAuthForm(
                        "login"
                    )
            );

        document
            .getElementById("logoutButton")
            .addEventListener(
                "click",
                () =>
                    this.logout()
            );

        document
            .querySelectorAll(
                "[data-dashboard-panel]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();

                        this.showDashboardPanel(
                            button.dataset.dashboardPanel
                        );
                    }
                );
            });

        document
            .getElementById("copyReferralButton")
            .addEventListener(
                "click",
                () =>
                    this.copyReferral()
            );
    },

    applyReturnTab() {
        const params =
            new URLSearchParams(
                location.search
            );

        const mode =
            params.get("mode");

        if (
            mode === "register" &&
            !API.isAuthenticated()
        ) {
            this.showAuthForm(
                "register"
            );
        }
    },

    hideViews() {
        [
            "accountLoading",
            "guestAccountView",
            "customerDashboard"
        ].forEach(id => {
            document
                .getElementById(id)
                ?.classList.add(
                    "hidden"
                );
        });
    },

    showGuest() {
        this.hideViews();

        document
            .getElementById("guestAccountView")
            .classList.remove("hidden");
    },

    showAuthForm(name) {
        const forms = {
            login: "loginForm",
            register: "registerForm",
            forgot: "forgotPasswordForm"
        };

        Object.values(forms)
            .forEach(id => {
                document
                    .getElementById(id)
                    .classList.add(
                        "hidden"
                    );
            });

        document
            .getElementById(
                forms[name] ||
                forms.login
            )
            .classList.remove(
                "hidden"
            );

        document
            .querySelectorAll(
                "[data-account-tab]"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.accountTab ===
                    name
                );
            });

        document
            .querySelector(".account-tabs")
            .classList.toggle(
                "hidden",
                name === "forgot"
            );

        this.clearMessage();
    },

    togglePassword(button) {
        const input =
            document.getElementById(
                button.dataset.passwordToggle
            );

        const showing =
            input.type === "text";

        input.type =
            showing
                ? "password"
                : "text";

        const icon =
            button.querySelector("i");

        icon.classList.toggle(
            "fa-eye",
            showing
        );

        icon.classList.toggle(
            "fa-eye-slash",
            !showing
        );
    },

    async login(event) {
        event.preventDefault();

        const identifier =
            document
                .getElementById("loginIdentifier")
                .value
                .trim();

        const password =
            document
                .getElementById("loginPassword")
                .value;

        const remember =
            document
                .getElementById("rememberLogin")
                .checked;

        const button =
            document.getElementById(
                "loginButton"
            );

        this.setLoading(
            button,
            true,
            "Signing In"
        );

        try {
            const data =
                await API.post(
                    API.customer("/login"),
                    {
                        identifier,
                        password
                    }
                );

            API.saveCustomerSession(
                data.token,
                data.customer,
                remember
            );

            this.customer =
                data.customer;

            await Store.mergeGuestCart();
            await Store.refreshCartCount();

            this.showMessage(
                "Login successful. Welcome back!",
                "success"
            );

            const returnUrl =
                new URLSearchParams(
                    location.search
                ).get("return");

            if (returnUrl) {
                setTimeout(
                    () => {
                        location.href =
                            returnUrl;
                    },
                    500
                );

                return;
            }

            await this.loadProfile();
        } catch (error) {
            if (
                error.data
                    ?.verificationRequired
            ) {
                this.showMessage(
                    error.message +
                    " Please use the verification option from your registration message.",
                    "info"
                );
            } else {
                this.showMessage(
                    error.message,
                    "error"
                );
            }
        } finally {
            this.setLoading(
                button,
                false
            );
        }
    },

    async register(event) {
        event.preventDefault();

        const firstName =
            document
                .getElementById("registerFirstName")
                .value
                .trim();

        const lastName =
            document
                .getElementById("registerLastName")
                .value
                .trim();

        const fullName =
            document
                .getElementById("registerFullName")
                .value
                .trim();

        const email =
            document
                .getElementById("registerEmail")
                .value
                .trim();

        const phone =
            document
                .getElementById("registerPhone")
                .value
                .trim();

        const referralCode =
            document
                .getElementById("registerReferral")
                .value
                .trim();

        const password =
            document
                .getElementById("registerPassword")
                .value;

        const confirmPassword =
            document
                .getElementById("registerConfirmPassword")
                .value;

        if (!email && !phone) {
            this.showMessage(
                "Enter an email address or mobile number.",
                "error"
            );
            return;
        }

        if (password.length < 8) {
            this.showMessage(
                "Password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (
            password !==
            confirmPassword
        ) {
            this.showMessage(
                "Passwords do not match.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById(
                "registerButton"
            );

        this.setLoading(
            button,
            true,
            "Creating Account"
        );

        try {
            const data =
                await API.post(
                    API.customer("/register"),
                    {
                        first_name:
                            firstName || null,
                        last_name:
                            lastName || null,
                        full_name:
                            fullName,
                        email:
                            email || null,
                        phone:
                            phone || null,
                        password,
                        referral_code:
                            referralCode || null
                    }
                );

            const options = [];

            if (
                data.verificationOptions
                    ?.email
            ) {
                options.push("email");
            }

            if (
                data.verificationOptions
                    ?.phone
            ) {
                options.push("phone");
            }

            this.showMessage(
                `${
                    data.message ||
                    "Registration successful."
                } Verification is available through ${
                    options.join(" or ") ||
                    "your registered identifier"
                }.`,
                "success"
            );

            event.currentTarget.reset();

            setTimeout(
                () => {
                    this.showAuthForm(
                        "login"
                    );

                    document
                        .getElementById("loginIdentifier")
                        .value =
                        email || phone;
                },
                1800
            );
        } catch (error) {
            this.showMessage(
                error.message,
                "error"
            );
        } finally {
            this.setLoading(
                button,
                false
            );
        }
    },

    requestPasswordReset(event) {
        event.preventDefault();

        const identifier =
            document
                .getElementById("forgotIdentifier")
                .value
                .trim();

        if (!identifier) {
            this.showMessage(
                "Enter your email address or mobile number.",
                "error"
            );
            return;
        }

        this.showMessage(
            "Password-reset UI is ready. The exact reset endpoint will be connected in the account recovery package.",
            "info"
        );
    },

    async loadProfile() {
        this.hideViews();

        document
            .getElementById("accountLoading")
            .classList.remove("hidden");

        try {
            const data =
                await API.get(
                    API.customer("/profile")
                );

            this.customer =
                data.customer ||
                {};

            this.renderDashboard(
                this.customer
            );

            this.hideViews();

            document
                .getElementById("customerDashboard")
                .classList.remove("hidden");
        } catch (error) {
            if (
                error.status === 401 ||
                error.status === 403
            ) {
                API.clearCustomerSession();
                this.showGuest();

                this.showMessage(
                    "Please sign in to continue.",
                    "info"
                );

                return;
            }

            API.clearCustomerSession();
            this.showGuest();

            this.showMessage(
                error.message,
                "error"
            );
        }
    },

    renderDashboard(customer) {
        const fullName =
            customer.full_name ||
            [
                customer.first_name,
                customer.last_name
            ]
                .filter(Boolean)
                .join(" ") ||
            "Customer";

        const contact =
            customer.email ||
            customer.phone ||
            "";

        const initials =
            fullName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part =>
                    part.charAt(0)
                )
                .join("")
                .toUpperCase() ||
            "R";

        document
            .getElementById("dashboardGreeting")
            .textContent =
            `Welcome, ${
                customer.first_name ||
                fullName.split(" ")[0]
            }`;

        document
            .getElementById("customerInitials")
            .textContent =
            initials;

        document
            .getElementById("customerNavName")
            .textContent =
            fullName;

        document
            .getElementById("customerNavContact")
            .textContent =
            contact;

        document
            .getElementById("accountStatus")
            .textContent =
            customer.status ||
            "Active";

        document
            .getElementById("accountMemberSince")
            .textContent =
            customer.created_at
                ? `Member since ${
                    new Date(
                        customer.created_at
                    ).toLocaleDateString(
                        "en-GB",
                        {
                            month:
                                "long",
                            year:
                                "numeric"
                        }
                    )
                }`
                : "";

        document
            .getElementById("customerReferralCode")
            .textContent =
            customer.referral_code ||
            "—";

        const values = {
            profileFullName:
                fullName,
            profileEmail:
                customer.email ||
                "Not added",
            profilePhone:
                customer.phone ||
                "Not added",
            profileAddress:
                customer.address ||
                "Not added",
            profileCity:
                customer.city ||
                "Not added",
            profileCountry:
                customer.country ||
                "Pakistan",
            profilePostalCode:
                customer.postal_code ||
                "Not added",
            profileStatus:
                customer.status ||
                "Active"
        };

        Object.entries(values)
            .forEach(
                ([id, value]) => {
                    document
                        .getElementById(id)
                        .textContent =
                        value;
                }
            );
    },

    showDashboardPanel(name) {
        [
            "overview",
            "profile",
            "rewards"
        ].forEach(panel => {
            document
                .getElementById(
                    `${panel}Panel`
                )
                .classList.toggle(
                    "hidden",
                    panel !== name
                );
        });

        document
            .querySelectorAll(
                ".customer-nav-button"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.dashboardPanel ===
                    name
                );
            });
    },

    async copyReferral() {
        const code =
            this.customer
                ?.referral_code;

        if (!code) {
            Store.toast(
                "No referral code is available.",
                "error"
            );
            return;
        }

        try {
            await navigator.clipboard.writeText(
                code
            );

            Store.toast(
                "Referral code copied."
            );
        } catch {
            Store.toast(
                `Referral code: ${code}`
            );
        }
    },

    logout() {
        API.clearCustomerSession();

        localStorage.removeItem(
            Store.cartSyncKey
        );

        this.customer = null;

        Store.refreshCartCount();
        this.showGuest();
        this.showAuthForm("login");

        Store.toast(
            "You have signed out."
        );
    },

    setLoading(
        button,
        loading,
        label = ""
    ) {
        if (loading) {
            button.dataset.original =
                button.innerHTML;

            button.disabled = true;

            button.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i> ${Components.e(label)}`;
        } else {
            button.disabled = false;

            if (
                button.dataset.original
            ) {
                button.innerHTML =
                    button.dataset.original;

                delete button.dataset
                    .original;
            }
        }
    },

    showMessage(
        message,
        type = "info"
    ) {
        clearTimeout(
            this.messageTimer
        );

        const element =
            document.getElementById(
                "accountMessage"
            );

        element.textContent =
            message;

        element.className =
            `account-message show ${type}`;

        this.messageTimer =
            setTimeout(
                () =>
                    this.clearMessage(),
                8000
            );
    },

    clearMessage() {
        const element =
            document.getElementById(
                "accountMessage"
            );

        element.textContent = "";
        element.className =
            "account-message";
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => AccountPage.init()
);
