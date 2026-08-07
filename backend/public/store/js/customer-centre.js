"use strict";

window.CustomerCentre = {
    customer: null,
    loyalty: null,
    messageTimer: null,
    profileRecord: null,
    reviewsLoaded: false,

    async init() {
        await this.waitForStore();
        this.bind();
        this.updateRegistrationMethod();

        if (API.isAuthenticated()) {
            await this.loadCustomerCentre();
        } else {
            this.showGuest();
        }

        const mode = new URLSearchParams(location.search).get("mode");

        if (mode === "register" && !API.isAuthenticated()) {
            this.showAuthForm("register");
        }

        if (!API.isAuthenticated()) {
            const referralFromUrl =
                new URLSearchParams(location.search).get("ref") ||
                new URLSearchParams(location.search).get("referral");

            if (referralFromUrl) {
                const referralInput = document.getElementById("registerReferral");
                if (referralInput) {
                    referralInput.value = referralFromUrl.trim().toUpperCase();
                    this.showAuthForm("register");
                    this.updateReferralRegistrationHint();
                }
            }
        }
    },

    waitForStore() {
        return new Promise(resolve => {
            if (Store.settings && Object.keys(Store.settings).length) {
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
        document.querySelectorAll("[data-auth-tab]").forEach(button => {
            button.addEventListener("click", () => {
                this.showAuthForm(button.dataset.authTab);
            });
        });

        document.querySelectorAll("[data-password-toggle]").forEach(button => {
            button.addEventListener("click", () => {
                this.togglePassword(button);
            });
        });

        document
            .querySelectorAll('input[name="registration_method"]')
            .forEach(input => {
                input.addEventListener("change", () => {
                    this.updateRegistrationMethod();
                });
            });

        document
            .getElementById("profilePictureInput")
            ?.addEventListener("change", event => {
                this.previewProfilePicture(event);
            });

        document
            .getElementById("uploadProfilePictureButton")
            ?.addEventListener("click", () => {
                this.uploadProfilePicture();
            });

        document
            .getElementById("cancelProfilePreviewButton")
            ?.addEventListener("click", () => {
                this.cancelProfilePreview();
            });

        document
            .getElementById("removeProfilePictureButton")
            ?.addEventListener("click", () => {
                this.removeProfilePicture();
            });

        const loginForm =
            document.getElementById("loginForm");

        const registerForm =
            document.getElementById("registerForm");

        const forgotPasswordForm =
            document.getElementById("forgotPasswordForm");

        loginForm?.addEventListener(
            "submit",
            event => this.login(event)
        );

        registerForm?.addEventListener(
            "submit",
            event => this.register(event)
        );

        forgotPasswordForm?.addEventListener(
            "submit",
            event => this.requestReset(event)
        );

        document
            .getElementById("showForgotPassword")
            ?.addEventListener("click", () => {
                this.showAuthForm("forgot");
            });

        document
            .getElementById("backToLogin")
            ?.addEventListener("click", () => {
                this.showAuthForm("login");
            });

        document
            .getElementById("logoutButton")
            ?.addEventListener("click", () => {
                this.logout();
            });

        document
            .querySelectorAll("[data-centre-panel]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    this.showPanel(
                        button.dataset.centrePanel
                    );
                });
            });

        document
            .getElementById("copyReferralButton")
            ?.addEventListener("click", () => {
                this.copyReferral();
            });

        document
            .getElementById("shareReferralButton")
            ?.addEventListener("click", () => {
                this.shareReferral();
            });

        document
            .getElementById("registerReferral")
            ?.addEventListener("input", event => {
                const input = event.currentTarget;
                const cursor = input.selectionStart;
                input.value = input.value.toUpperCase().replace(/\s+/g, "");
                if (cursor !== null) input.setSelectionRange(cursor, cursor);
                this.updateReferralRegistrationHint();
            });

        document
            .getElementById("eventsMenuLink")
            ?.addEventListener("click", event => {
                if (
                    !this.loyalty
                        ?.benefits
                        ?.eventMenuEnabled
                ) {
                    event.preventDefault();

                    Store.toast(
                        "Events & Reminders unlock at Gold membership.",
                        "error"
                    );
                }
            });

        document
            .getElementById("overviewEventsLink")
            ?.addEventListener("click", event => {
                if (
                    !this.loyalty
                        ?.benefits
                        ?.eventMenuEnabled
                ) {
                    event.preventDefault();
                    location.href =
                        "rewards.html";
                }
            });
    },

    hideViews() {
        [
            "accountLoading",
            "guestAccountView",
            "customerCentre"
        ].forEach(id => {
            document
                .getElementById(id)
                ?.classList.add("hidden");
        });
    },

    showGuest() {
        this.hideViews();

        document
            .getElementById("guestAccountView")
            ?.classList.remove("hidden");
    },

    showAuthForm(name) {
        const forms = {
            login: "loginForm",
            register: "registerForm",
            forgot: "forgotPasswordForm"
        };

        Object.values(forms).forEach(id =>
            document.getElementById(id).classList.add("hidden")
        );

        document.getElementById(forms[name] || forms.login)
            .classList.remove("hidden");

        document.querySelectorAll("[data-auth-tab]").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.authTab === name
            );
        });

        document.querySelector(".auth-tabs")
            .classList.toggle("hidden", name === "forgot");

        this.clearMessage();
    },

    togglePassword(button) {
        const input =
            document.getElementById(
                button.dataset.passwordToggle
            );

        if (!input) {
            return;
        }

        const show =
            input.type === "password";

        input.type =
            show
                ? "text"
                : "password";

        const icon =
            button.querySelector("i");

        if (icon) {
            icon.className =
                show
                    ? "fa-regular fa-eye-slash"
                    : "fa-regular fa-eye";
        }
    },

    async login(event) {
        event.preventDefault();
        event.stopPropagation();

        const form =
            event.currentTarget;

        if (
            !form ||
            form.id !== "loginForm"
        ) {
            return;
        }

        const identifierInput =
            document.getElementById(
                "loginIdentifier"
            );

        const passwordInput =
            document.getElementById(
                "loginPassword"
            );

        const rememberInput =
            document.getElementById(
                "rememberLogin"
            );

        const button =
            document.getElementById(
                "loginButton"
            );

        const identifier =
            identifierInput
                ?.value
                ?.trim() || "";

        const password =
            passwordInput
                ?.value || "";

        const remember =
            Boolean(
                rememberInput?.checked
            );

        if (!identifier) {
            this.showMessage(
                "Enter your email address or mobile number.",
                "error"
            );

            identifierInput?.focus();
            return;
        }

        if (!password) {
            this.showMessage(
                "Enter your password.",
                "error"
            );

            passwordInput?.focus();
            return;
        }

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

            if (!data.token) {
                throw new Error(
                    "Customer login token was not returned."
                );
            }

            API.saveCustomerSession(
                data.token,
                data.customer || {},
                remember
            );

            if (
                typeof Store.mergeGuestCart ===
                "function"
            ) {
                try {
                    await Store.mergeGuestCart();
                } catch (mergeError) {
                    console.warn(
                        "Guest cart merge skipped:",
                        mergeError
                    );
                }
            }

            if (
                typeof Store.mergeGuestWishlist ===
                "function"
            ) {
                try {
                    await Store.mergeGuestWishlist();
                } catch (mergeError) {
                    console.warn(
                        "Guest wishlist merge skipped:",
                        mergeError
                    );
                }
            }

            const returnUrl =
                new URLSearchParams(
                    location.search
                ).get("return");

            if (returnUrl) {
                location.href =
                    returnUrl;
                return;
            }

            await this.loadCustomerCentre();

        } catch (error) {
            this.showMessage(
                error.message ||
                "Unable to sign in.",
                "error"
            );

        } finally {
            this.setLoading(
                button,
                false
            );
        }
    },

    async register(event) {
        event.preventDefault();
        event.stopPropagation();

        const form =
            event.currentTarget;

        if (
            !form ||
            form.id !== "registerForm"
        ) {
            return;
        }

        const first_name =
            document.getElementById("registerFirstName").value.trim();

        const last_name =
            document.getElementById("registerLastName").value.trim();

        const full_name =
            document.getElementById("registerFullName").value.trim();

        const registrationMethod =
            document.querySelector('input[name="registration_method"]:checked')?.value || "email";

        const email =
            registrationMethod === "email"
                ? document.getElementById("registerEmail").value.trim()
                : "";

        const phone =
            registrationMethod === "phone"
                ? document.getElementById("registerPhone").value.trim()
                : "";

        const referral_code =
            document.getElementById("registerReferral").value.trim();

        const password =
            document.getElementById("registerPassword").value;

        const confirmPassword =
            document.getElementById("registerConfirmPassword").value;

        const acceptTerms =
            Boolean(
                document.getElementById(
                    "acceptTerms"
                )?.checked
            );

        const acceptPrivacy =
            Boolean(
                document.getElementById(
                    "acceptPrivacy"
                )?.checked
            );

        const acceptMarketing =
            Boolean(
                document.getElementById(
                    "acceptMarketing"
                )?.checked
            );

        if (
            !acceptTerms ||
            !acceptPrivacy
        ) {
            this.showMessage(
                "Please accept the Terms & Conditions and Privacy Policy before creating your account.",
                "error"
            );
            return;
        }

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

        if (password !== confirmPassword) {
            this.showMessage("Passwords do not match.", "error");
            return;
        }

        const button =
            document.getElementById("registerButton");

        this.setLoading(button, true, "Creating Account");

        try {
            const data = await API.post(
                API.customer("/register"),
                {
                    first_name: first_name || null,
                    last_name: last_name || null,
                    full_name,
                    email: email || null,
                    phone: phone || null,
                    password,
                    referral_code: referral_code || null,
                    accept_terms: acceptTerms,
                    accept_privacy: acceptPrivacy,
                    accept_marketing: acceptMarketing,
                    terms_version: "2026-08-05",
                    privacy_version: "2026-08-05"
                }
            );

            this.showMessage(
                data.message || "Registration successful. Please verify your account.",
                "success"
            );

            event.currentTarget.reset();

            setTimeout(() => {
                this.showAuthForm("login");
                document.getElementById("loginIdentifier").value =
                    email || phone;
            }, 1600);
        } catch (error) {
            this.showMessage(error.message, "error");
        } finally {
            this.setLoading(button, false);
        }
    },

    async requestReset(event) {
        event.preventDefault();

        const identifier =
            document.getElementById("forgotIdentifier").value.trim();

        if (!identifier) {
            this.showMessage(
                "Enter your email address or mobile number.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById("forgotPasswordButton");

        this.setLoading(button, true, "Sending Code");

        try {
            const data = await API.post(
                API.customer("/password/forgot"),
                { identifier }
            );

            sessionStorage.setItem(
                "rukhnav_reset_identifier",
                identifier
            );

            if (data.expiresInMinutes) {
                sessionStorage.setItem(
                    "rukhnav_reset_expiry_minutes",
                    String(data.expiresInMinutes)
                );
            }

            if (data.developmentCode) {
                sessionStorage.setItem(
                    "rukhnav_development_reset_code",
                    String(data.developmentCode)
                );
            }

            this.showMessage(data.message, "success");

            setTimeout(() => {
                location.href =
                    `reset-password.html?identifier=${encodeURIComponent(identifier)}`;
            }, 900);
        } catch (error) {
            this.showMessage(error.message, "error");
        } finally {
            this.setLoading(button, false);
        }
    },

    async loadCustomerCentre() {
        this.hideViews();

        document
            .getElementById("accountLoading")
            ?.classList.remove("hidden");

        try {
            const results =
                await Promise.allSettled([
                    API.get(
                        API.customer("/profile")
                    ),
                    API.get(
                        "/api/profile"
                    ),
                    API.get(
                        "/api/customer-loyalty/me"
                    )
                ]);

            if (
                results[0].status !==
                "fulfilled"
            ) {
                throw results[0].reason;
            }

            const customerResponse =
                results[0].value;

            const profileResponse =
                results[1].status ===
                    "fulfilled"
                    ? results[1].value
                    : {};

            const customer =
                customerResponse.customer ||
                customerResponse.profile ||
                customerResponse.data ||
                customerResponse ||
                {};

            const profile =
                profileResponse.profile ||
                profileResponse.customer ||
                profileResponse.data ||
                {};

            this.profileRecord =
                profile;

            this.customer = {
                ...customer,
                ...profile,
                id:
                    customer.id ||
                    profile.id
            };

            if (
                results[2].status ===
                "fulfilled"
            ) {
                this.loyalty =
                    results[2].value.loyalty ||
                    results[2].value ||
                    {};
            } else {
                this.loyalty = {
                    membershipLevel: "Bronze",
                    availablePoints: 0,
                    lifetimePoints: 0,
                    benefits: {
                        eventMenuEnabled: false
                    }
                };
            }

            this.renderCustomer();
            this.renderLoyalty();

            this.hideViews();

            document
                .getElementById("customerCentre")
                ?.classList.remove("hidden");
        } catch (error) {
            API.clearCustomerSession();
            this.showGuest();
            this.showMessage(error.message, "error");
        }
    },

    setText(id, value) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent =
                value ?? "";
        }
    },

    renderCustomer() {
        const customer = this.customer;

        const fullName =
            customer.full_name ||
            [customer.first_name, customer.last_name]
                .filter(Boolean)
                .join(" ") ||
            "Customer";

        const firstName =
            customer.first_name ||
            fullName.split(/\s+/)[0];

        const initials =
            fullName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(part => part.charAt(0))
                .join("")
                .toUpperCase() || "R";

        this.setText(
            "dashboardGreeting",
            `Welcome, ${firstName}`
        );

        this.setText(
            "customerInitials",
            initials
        );

        this.setText(
            "profilePictureInitials",
            initials
        );

        this.setText(
            "customerName",
            fullName
        );

        this.applyProfilePicture(
            customer.profile_picture ||
            customer.profile_image ||
            customer.image ||
            customer.image_url ||
            customer.profile_picture_url ||
            ""
        );
        this.setText(
            "customerContact",
            customer.email ||
            customer.phone ||
            ""
        );

        this.setText(
            "welcomeCardTitle",
            `Welcome back, ${firstName}`
        );

        this.setText(
            "welcomeCardText",
            "Your orders, rewards and account details are ready."
        );

        this.setText(
            "accountStatus",
            customer.status || "Active"
        );

        this.setText(
            "memberSince",
            customer.created_at
                ? `Member since ${new Date(
                    customer.created_at
                ).toLocaleDateString(
                    "en-GB",
                    {
                        month: "long",
                        year: "numeric"
                    }
                )}`
                : ""
        );

        this.setText(
            "referralCode",
            customer.referral_code || "—"
        );

        const referralCode = customer.referral_code || "";
        const referralUrl = referralCode
            ? `${location.origin}${location.pathname}?mode=register&ref=${encodeURIComponent(referralCode)}`
            : "—";
        this.setText("referralLink", referralUrl);

        const profileValues = {
            profileFullName: fullName,
            profileEmail: customer.email || "Not added",
            profilePhone: customer.phone || "Not added",
            profileAddress: customer.address || "Not added",
            profileCity: customer.city || "Not added",
            profileCountry: customer.country || "Pakistan",
            profilePostalCode: customer.postal_code || "Not added",
            profileStatus: customer.status || "Active"
        };

        Object.entries(
            profileValues
        ).forEach(([id, value]) => {
            this.setText(
                id,
                value
            );
        });
    },

    renderLoyalty() {
        const loyalty =
            this.loyalty || {};

        const level =
            String(
                loyalty.membershipLevel ||
                "Bronze"
            );

        const key =
            level.toLowerCase();

        const points =
            Number(
                loyalty.availablePoints ||
                0
            );

        const eventEnabled =
            Boolean(
                loyalty
                    .benefits
                    ?.eventMenuEnabled
            );

        const badge =
            document.getElementById(
                "customerMembershipBadge"
            );

        if (badge) {
            badge.className =
                `membership-badge ${key}`;

            badge.textContent =
                `${level} Member`;
        }

        this.setText(
            "overviewMembership",
            level
        );

        this.setText(
            "overviewPoints",
            `${new Intl.NumberFormat(
                "en-PK"
            ).format(points)} available points`
        );

        const menuLink =
            document.getElementById(
                "eventsMenuLink"
            );

        const menuStatus =
            document.getElementById(
                "eventsMenuStatus"
            );

        const overviewText =
            document.getElementById(
                "overviewEventsText"
            );

        if (menuLink) {
            menuLink.classList.toggle(
                "locked-link",
                !eventEnabled
            );

            menuLink.classList.toggle(
                "unlocked-link",
                eventEnabled
            );
        }

        if (menuStatus) {
            menuStatus.textContent =
                eventEnabled
                    ? "Unlocked"
                    : "Locked";
        }

        if (overviewText) {
            overviewText.textContent =
                eventEnabled
                    ? "Premium reminders unlocked"
                    : "Unlock at Gold membership";
        }
    },

    async showPanel(name) {
        [
            "overview",
            "profile",
            "reviews",
            "addresses",
            "coupons",
            "preferences",
            "security"
        ].forEach(panel => {
            document
                .getElementById(
                    `${panel}Panel`
                )
                ?.classList.toggle(
                    "hidden",
                    panel !== name
                );
        });

        document
            .querySelectorAll(
                "[data-centre-panel]"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset
                        .centrePanel === name
                );
            });

        /*
         * The original My Reviews panel only became visible.
         * It never requested /api/reviews/mine, so the loading
         * indicator remained on the screen forever.
         */
        if (
            name === "reviews" &&
            !this.reviewsLoaded
        ) {
            await this.loadMyReviews();
        }
    },

    async copyReferral() {
        const code = this.customer?.referral_code;

        if (!code) {
            Store.toast("No referral code is available.", "error");
            return;
        }

        try {
            await navigator.clipboard.writeText(code);
            Store.toast("Referral code copied.");
        } catch {
            Store.toast(`Referral code: ${code}`);
        }
    },

    updateReferralRegistrationHint() {
        const input = document.getElementById("registerReferral");
        const hint = document.getElementById("referralRegistrationHint");
        if (!input || !hint) return;

        const code = input.value.trim();
        hint.classList.remove("active");

        if (!code) {
            hint.textContent = "Have a referral code? Enter it here. It will be checked when you create your account.";
            return;
        }

        hint.textContent = `Referral code ${code} will be verified when you create your account.`;
        hint.classList.add("active");
    },

    async shareReferral() {
        const code = this.customer?.referral_code;
        if (!code) {
            Store.toast("No referral code is available.", "error");
            return;
        }

        const url = `${location.origin}${location.pathname}?mode=register&ref=${encodeURIComponent(code)}`;
        const text = `Join RUKHNAV using my referral code ${code}.`;

        try {
            if (navigator.share) {
                await navigator.share({ title: "RUKHNAV Referral", text, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            Store.toast("Referral link copied.");
        } catch (error) {
            if (error?.name !== "AbortError") {
                Store.toast(`Referral code: ${code}`);
            }
        }
    },

    updateRegistrationMethod() {
        const method =
            document.querySelector('input[name="registration_method"]:checked')?.value || "email";

        const emailField =
            document.getElementById("registerEmailField");

        const phoneField =
            document.getElementById("registerPhoneField");

        const emailInput =
            document.getElementById("registerEmail");

        const phoneInput =
            document.getElementById("registerPhone");

        emailField.classList.toggle("hidden", method !== "email");
        phoneField.classList.toggle("hidden", method !== "phone");

        emailInput.required = method === "email";
        phoneInput.required = method === "phone";

        if (method === "email") {
            phoneInput.value = "";
        } else {
            emailInput.value = "";
        }
    },

    profilePictureUrl(value) {
        if (!value) return "";

        if (/^https?:|^data:|^blob:/.test(value)) {
            return value;
        }

        return value.startsWith("/")
            ? API.base + value
            : `${API.base}/${value}`;
    },

    applyProfilePicture(value) {
        const url =
            this.profilePictureUrl(value);

        const sidebarImage =
            document.getElementById("customerAvatarImage");

        const sidebarInitials =
            document.getElementById("customerInitials");

        const profileImage =
            document.getElementById("profilePicturePreview");

        const profileInitials =
            document.getElementById("profilePictureInitials");

        if (url) {
            if (sidebarImage) {
                sidebarImage.onerror = () => {
                    sidebarImage.classList.add("hidden");
                    sidebarInitials?.classList.remove("hidden");
                };
                sidebarImage.src = url;
                sidebarImage.classList.remove("hidden");
            }

            if (profileImage) {
                profileImage.onerror = () => {
                    profileImage.classList.add("hidden");
                    profileInitials?.classList.remove("hidden");
                };
                profileImage.src = url;
                profileImage.classList.remove("hidden");
            }

            sidebarInitials?.classList.add("hidden");
            profileInitials?.classList.add("hidden");
        } else {
            if (sidebarImage) {
                sidebarImage.removeAttribute("src");
                sidebarImage.classList.add("hidden");
            }

            if (profileImage) {
                profileImage.removeAttribute("src");
                profileImage.classList.add("hidden");
            }

            sidebarInitials?.classList.remove("hidden");
            profileInitials?.classList.remove("hidden");
        }
    },

    previewProfilePicture(event) {
        const file =
            event.target.files?.[0];

        this.setProfilePictureMessage("");

        if (!file) {
            this.cancelProfilePreview();
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            event.target.value = "";
            this.setProfilePictureMessage(
                "Choose a JPG, PNG or WEBP image.",
                "error"
            );
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            event.target.value = "";
            this.setProfilePictureMessage(
                "Image size must be less than 5 MB.",
                "error"
            );
            return;
        }

        const previewUrl =
            URL.createObjectURL(file);

        document.getElementById("profilePicturePreview").src =
            previewUrl;

        document.getElementById("profilePicturePreview")
            .classList.remove("hidden");

        document.getElementById("profilePictureInitials")
            .classList.add("hidden");

        document.getElementById("uploadProfilePictureButton").disabled =
            false;

        document.getElementById("cancelProfilePreviewButton")
            .classList.remove("hidden");
    },

    cancelProfilePreview() {
        const input =
            document.getElementById("profilePictureInput");

        input.value = "";

        document.getElementById("uploadProfilePictureButton").disabled =
            true;

        document.getElementById("cancelProfilePreviewButton")
            .classList.add("hidden");

        this.applyProfilePicture(
            this.customer?.profile_picture ||
            this.customer?.profile_image ||
            this.customer?.image ||
            this.customer?.image_url ||
            this.customer?.profile_picture_url ||
            ""
        );

        this.setProfilePictureMessage("");
    },

    async uploadProfilePicture() {
        const input =
            document.getElementById("profilePictureInput");

        const file =
            input.files?.[0];

        if (!file) {
            this.setProfilePictureMessage(
                "Choose a picture first.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById("uploadProfilePictureButton");

        const original =
            button.innerHTML;

        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Uploading';

        try {
            const formData =
                new FormData();

            formData.append(
                "profile_picture",
                file
            );

            const response =
                await fetch(
                    API.base + "/api/profile/upload-picture",
                    {
                        method: "POST",
                        headers: API.authHeaders(false),
                        body: formData
                    }
                );

            let data = {};

            try {
                data = await response.json();
            } catch {}

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    `Upload failed (${response.status})`
                );
            }

            const uploadedProfile =
                data.profile ||
                data.customer ||
                {};

            const image =
                data.image ||
                data.profile_picture_url ||
                data.profile_picture ||
                data.profileImage ||
                uploadedProfile.profile_picture_url ||
                uploadedProfile.profile_picture ||
                "";

            this.customer = {
                ...this.customer,
                ...uploadedProfile,
                profile_picture:
                    uploadedProfile.profile_picture ||
                    this.customer.profile_picture ||
                    "",
                profile_picture_url:
                    image
            };

            this.profileRecord = {
                ...(this.profileRecord || {}),
                ...uploadedProfile,
                profile_picture_url:
                    image
            };

            this.applyProfilePicture(image);

            try {
                const refreshed =
                    await API.get(
                        "/api/profile"
                    );

                const profile =
                    refreshed.profile ||
                    refreshed.customer ||
                    {};

                this.customer = {
                    ...this.customer,
                    ...profile
                };

                this.profileRecord =
                    profile;

                this.applyProfilePicture(
                    profile.profile_picture_url ||
                    profile.profile_picture ||
                    image
                );
            } catch {}

            input.value = "";

            document.getElementById("cancelProfilePreviewButton")
                .classList.add("hidden");

            this.setProfilePictureMessage(
                data.message ||
                "Profile picture uploaded successfully.",
                "success"
            );

            Store.toast(
                "Profile picture updated."
            );
        } catch (error) {
            this.setProfilePictureMessage(
                error.message,
                "error"
            );
        } finally {
            button.disabled = true;
            button.innerHTML = original;
        }
    },

    async removeProfilePicture() {
        const hasPicture =
            Boolean(
                this.customer?.profile_picture_url ||
                this.customer?.profile_picture ||
                this.profileRecord?.profile_picture_url ||
                this.profileRecord?.profile_picture
            );

        if (!hasPicture) {
            this.setProfilePictureMessage(
                "No profile picture is currently saved.",
                "error"
            );
            return;
        }

        if (
            !window.confirm(
                "Remove your saved profile picture?"
            )
        ) {
            return;
        }

        const button =
            document.getElementById(
                "removeProfilePictureButton"
            );

        const original =
            button?.innerHTML;

        if (button) {
            button.disabled = true;
            button.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Removing';
        }

        try {
            const data =
                await API.delete(
                    "/api/profile/picture"
                );

            this.customer = {
                ...this.customer,
                profile_picture: null,
                profile_picture_url: null
            };

            this.profileRecord = {
                ...(this.profileRecord || {}),
                profile_picture: null,
                profile_picture_url: null
            };

            this.applyProfilePicture("");

            this.setProfilePictureMessage(
                data.message ||
                "Profile picture removed.",
                "success"
            );

            Store.toast(
                "Profile picture removed."
            );
        } catch (error) {
            this.setProfilePictureMessage(
                error.message ||
                "Unable to remove profile picture.",
                "error"
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = original;
            }
        }
    },

    async loadMyReviews() {
        const loading =
            document.getElementById(
                "myReviewsLoading"
            );

        const empty =
            document.getElementById(
                "myReviewsEmpty"
            );

        const list =
            document.getElementById(
                "myReviewsList"
            );

        loading?.classList.remove(
            "hidden"
        );

        empty?.classList.add(
            "hidden"
        );

        if (list) {
            list.innerHTML = "";
        }

        try {
            const data =
                await API.get(
                    "/api/reviews/mine"
                );

            const reviews =
                Array.isArray(data.reviews)
                    ? data.reviews
                    : [];

            this.reviewsLoaded =
                true;

            loading?.classList.add(
                "hidden"
            );

            if (!reviews.length) {
                empty?.classList.remove(
                    "hidden"
                );
                return;
            }

            if (list) {
                list.innerHTML =
                    reviews
                        .map(
                            review =>
                                this.myReviewMarkup(
                                    review
                                )
                        )
                        .join("");
            }
        } catch (error) {
            loading?.classList.add(
                "hidden"
            );

            if (list) {
                list.innerHTML = `
                    <div class="my-reviews-error">
                        ${this.escapeHtml(
                            error.message ||
                            "Unable to load your reviews."
                        )}
                    </div>
                `;
            }
        }
    },

    myReviewMarkup(review) {
        const images =
            Array.isArray(review.images)
                ? review.images
                : [];

        const rating =
            Math.max(
                0,
                Math.min(
                    5,
                    Number(review.rating) ||
                    0
                )
            );

        const status =
            review.status ||
            "Pending";

        const productId =
            review.product_id ||
            review.productId ||
            "";

        return `
            <article class="my-review-card">
                <div class="my-review-product">
                    ${
                        review.product_image_url
                            ? `<img src="${this.escapeHtml(review.product_image_url)}" alt="">`
                            : '<div class="my-review-product-placeholder"><i class="fa-solid fa-spa"></i></div>'
                    }

                    <div>
                        <a href="product.html?id=${encodeURIComponent(productId)}">
                            ${this.escapeHtml(review.product_name || "Product")}
                        </a>
                        <span>${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
                    </div>

                    <b class="review-status ${String(status).toLowerCase()}">
                        ${this.escapeHtml(status)}
                    </b>
                </div>

                <p>${this.escapeHtml(review.comment || "")}</p>

                ${
                    images.length
                        ? `
                            <div class="my-review-photos">
                                ${images.map(image => `
                                    <a href="${this.escapeHtml(image.url || image.image_url || "")}" target="_blank" rel="noopener">
                                        <img src="${this.escapeHtml(image.url || image.image_url || "")}" alt="${this.escapeHtml(image.image_alt || "Review photo")}">
                                    </a>
                                `).join("")}
                            </div>
                        `
                        : ""
                }

                <div class="my-review-meta">
                    <span>${review.verified_purchase ? "Verified purchase" : "Customer review"}</span>
                    <span>${review.created_at ? new Date(review.created_at).toLocaleDateString("en-GB") : ""}</span>
                </div>
            </article>
        `;
    },

    escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    setProfilePictureMessage(message, type = "") {
        const element =
            document.getElementById("profilePictureMessage");

        element.textContent =
            message;

        element.className =
            `profile-picture-message ${type}`.trim();
    },

    logout() {
        API.clearCustomerSession();

        localStorage.removeItem(Store.cartSyncKey);
        localStorage.removeItem(Store.wishSyncKey);

        this.customer = null;
        this.loyalty = null;

        this.showGuest();
        this.showAuthForm("login");
        Store.refreshCartCount();
        Store.refreshWishlistCount?.();

        Store.toast("You have signed out.");
    },

    setLoading(button, loading, label = "") {
        if (loading) {
            button.dataset.original = button.innerHTML;
            button.disabled = true;
            button.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i> ${Components.e(label)}`;
            return;
        }

        button.disabled = false;

        if (button.dataset.original) {
            button.innerHTML = button.dataset.original;
            delete button.dataset.original;
        }
    },

    showMessage(message, type = "info") {
        clearTimeout(this.messageTimer);

        const element =
            document.getElementById("accountMessage");

        if (!element) {
            console.warn(
                "Account message element was not found:",
                message
            );
            return;
        }

        element.textContent =
            message;

        element.className =
            `account-message show ${type}`;

        this.messageTimer =
            setTimeout(() => this.clearMessage(), 8000);
    },

    clearMessage() {
        const element =
            document.getElementById("accountMessage");

        if (!element) {
            return;
        }

        element.textContent = "";
        element.className =
            "account-message";
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => window.CustomerCentre.init()
);
