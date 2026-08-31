"use strict";

window.AccountModules = {
    customer: null,
    addresses: [],
    coupons: {
        available: [],
        used: [],
        expired: []
    },
    activeCouponFilter: "available",
    loaded: {
        addresses: false,
        coupons: false,
        security: false
    },

    async init() {
        await this.waitForAccount();

        if (!API.isAuthenticated()) {
            return;
        }

        this.customer =
            CustomerCentre.customer ||
            API.customerRecord() ||
            {};

        this.bind();
        this.renderVerificationState();

        await this.loadOverviewCounts();
    },

    waitForAccount() {
        return Promise.race([
            new Promise(resolve => {
                const check = () => {
                    if (
                        window.CustomerCentre &&
                        (
                            CustomerCentre.customer ||
                            !API.isAuthenticated()
                        )
                    ) {
                        resolve();
                        return;
                    }

                    setTimeout(check, 80);
                };

                check();
            }),

            new Promise(resolve =>
                setTimeout(resolve, 2500)
            )
        ]);
    },

    bind() {
        document
            .querySelectorAll(
                '[data-centre-panel="addresses"]'
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => this.loadAddresses()
                );
            });

        document
            .querySelectorAll(
                '[data-centre-panel="coupons"]'
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => this.loadCoupons()
                );
            });

        document
            .querySelectorAll(
                '[data-centre-panel="security"]'
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => this.loadSecurity()
                );
            });

        document
            .getElementById("addAddressButton")
            ?.addEventListener(
                "click",
                () => this.openAddressForm()
            );

        document
            .getElementById("cancelAddressButton")
            ?.addEventListener(
                "click",
                () => this.closeAddressForm()
            );

        document
            .getElementById("addressForm")
            ?.addEventListener(
                "submit",
                event => this.saveAddress(event)
            );

        document
            .getElementById("addressesList")
            ?.addEventListener(
                "click",
                event => this.handleAddressAction(event)
            );

        document
            .getElementById("refreshCouponsButton")
            ?.addEventListener(
                "click",
                () => this.loadCoupons(true)
            );

        document
            .querySelectorAll(
                "[data-coupon-filter]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        document
                            .querySelectorAll(
                                "[data-coupon-filter]"
                            )
                            .forEach(item =>
                                item.classList.remove("active")
                            );

                        button.classList.add("active");

                        this.activeCouponFilter =
                            button.dataset.couponFilter;

                        this.renderCoupons();
                    }
                );
            });

        document
            .getElementById("couponsList")
            ?.addEventListener(
                "click",
                event => {
                    const button =
                        event.target.closest(
                            "[data-copy-coupon]"
                        );

                    if (!button) return;

                    navigator.clipboard
                        .writeText(
                            button.dataset.copyCoupon
                        )
                        .then(() =>
                            this.message(
                                "couponMessage",
                                "Coupon code copied.",
                                "success"
                            )
                        );
                }
            );

        document
            .querySelectorAll(
                "[data-request-verification]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        this.requestVerification(
                            button.dataset.requestVerification,
                            button
                        )
                );
            });

        document
            .getElementById("verificationCodeForm")
            ?.addEventListener(
                "submit",
                event =>
                    this.confirmVerification(event)
            );

        document
            .getElementById("cancelVerificationButton")
            ?.addEventListener(
                "click",
                () => {
                    document
                        .getElementById("verificationCodeForm")
                        ?.classList.add("hidden");
                }
            );

        document
            .getElementById("changePasswordForm")
            ?.addEventListener(
                "submit",
                event =>
                    this.changePassword(event)
            );

        document
            .querySelectorAll(
                "[data-account-password-toggle]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        const input =
                            document.getElementById(
                                button.dataset
                                    .accountPasswordToggle
                            );

                        if (!input) return;

                        input.type =
                            input.type === "password"
                                ? "text"
                                : "password";

                        button.innerHTML =
                            input.type === "password"
                                ? '<i class="fa-regular fa-eye"></i>'
                                : '<i class="fa-regular fa-eye-slash"></i>';
                    }
                );
            });

        document
            .getElementById("revokeOtherSessionsButton")
            ?.addEventListener(
                "click",
                () => this.revokeOtherSessions()
            );

        document
            .getElementById("deleteAccountForm")
            ?.addEventListener(
                "submit",
                event =>
                    this.requestDeletion(event)
            );

        document
            .getElementById("cancelDeletionRequestButton")
            ?.addEventListener(
                "click",
                () => this.cancelDeletion()
            );

        document.addEventListener(
            "rukhnav:profile-updated",
            event => {
                this.customer =
                    event.detail ||
                    CustomerCentre.customer ||
                    this.customer;

                this.renderVerificationState();
            }
        );
    },

    message(id, text, type = "") {
        const element =
            document.getElementById(id);

        if (!element) return;

        element.textContent = text || "";
        element.className =
            `inline-save-message ${type}`.trim();
    },

    loading(button, active, label = "Saving") {
        if (!button) return;

        if (active) {
            button.dataset.original =
                button.innerHTML;

            button.disabled = true;
            button.innerHTML =
                `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
        } else {
            button.disabled = false;
            button.innerHTML =
                button.dataset.original ||
                button.innerHTML;
        }
    },

    money(value) {
        return Store.money
            ? Store.money(value)
            : `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
    },

    date(value) {
        if (!value) return "—";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString(
                "en-PK",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );
    },

    async loadOverviewCounts() {
        try {
            const data =
                await API.get(
                    "/api/customer-portal/summary"
                );

            const counts =
                data.counts || {};

            const map = {
                accountAddressCount:
                    counts.addresses,
                accountCouponCount:
                    counts.availableCoupons,
                accountReviewCount:
                    counts.reviews,
                accountOrderCount:
                    counts.orders,
                accountWishlistCount:
                    counts.wishlist,
                accountEventCount:
                    counts.events
            };

            Object.entries(map)
                .forEach(([id, value]) => {
                    const element =
                        document.getElementById(id);

                    if (element) {
                        element.textContent =
                            Number(value || 0);
                    }
                });
        } catch {
            // Counts are optional and must not block the Account Centre.
        }
    },

    async loadAddresses(force = false) {
        if (
            this.loaded.addresses &&
            !force
        ) {
            return;
        }

        const loading =
            document.getElementById(
                "addressesLoading"
            );

        const empty =
            document.getElementById(
                "addressesEmpty"
            );

        loading?.classList.remove("hidden");
        empty?.classList.add("hidden");

        try {
            const data =
                await API.get(
                    "/api/customer-addresses"
                );

            this.addresses =
                Array.isArray(data.addresses)
                    ? data.addresses
                    : [];

            this.loaded.addresses = true;
            this.renderAddresses();
        } catch (error) {
            this.message(
                "addressMessage",
                error.message,
                "error"
            );
        } finally {
            loading?.classList.add("hidden");
        }
    },

    renderAddresses() {
        const list =
            document.getElementById(
                "addressesList"
            );

        const empty =
            document.getElementById(
                "addressesEmpty"
            );

        if (!list) return;

        if (!this.addresses.length) {
            list.innerHTML = "";
            empty?.classList.remove("hidden");
            return;
        }

        empty?.classList.add("hidden");

        list.innerHTML =
            this.addresses
                .map(address => `
                    <article
                        class="address-card ${
                            address.is_default
                                ? "default"
                                : ""
                        }"
                    >
                        <div class="address-card-top">
                            <span>
                                <i class="fa-solid fa-location-dot"></i>
                                ${Components.e(address.address_type || "Address")}
                            </span>

                            ${
                                address.is_default
                                    ? '<strong>Default</strong>'
                                    : ""
                            }
                        </div>

                        <h3>
                            ${Components.e(address.full_name || "")}
                        </h3>

                        <p>
                            ${Components.e(address.address_line1 || "")}
                            ${
                                address.address_line2
                                    ? `<br>${Components.e(address.address_line2)}`
                                    : ""
                            }
                            <br>
                            ${Components.e(address.city || "")}
                            ${
                                address.province
                                    ? `, ${Components.e(address.province)}`
                                    : ""
                            }
                            ${
                                address.postal_code
                                    ? ` ${Components.e(address.postal_code)}`
                                    : ""
                            }
                        </p>

                        <small>
                            <i class="fa-solid fa-phone"></i>
                            ${Components.e(address.phone || "")}
                        </small>

                        ${
                            address.delivery_instructions
                                ? `
                                    <small>
                                        <i class="fa-regular fa-note-sticky"></i>
                                        ${Components.e(address.delivery_instructions)}
                                    </small>
                                `
                                : ""
                        }

                        <div class="address-card-actions">
                            <button
                                type="button"
                                data-edit-address="${address.id}"
                            >
                                <i class="fa-solid fa-pen"></i>
                                Edit
                            </button>

                            ${
                                !address.is_default
                                    ? `
                                        <button
                                            type="button"
                                            data-default-address="${address.id}"
                                        >
                                            <i class="fa-solid fa-circle-check"></i>
                                            Make Default
                                        </button>
                                    `
                                    : ""
                            }

                            <button
                                type="button"
                                class="danger-link"
                                data-delete-address="${address.id}"
                            >
                                <i class="fa-solid fa-trash"></i>
                                Delete
                            </button>
                        </div>
                    </article>
                `)
                .join("");
    },

    openAddressForm(address = null) {
        document
            .getElementById("addressForm")
            ?.classList.remove("hidden");

        document.getElementById(
            "addressFormTitle"
        ).textContent =
            address
                ? "Edit Address"
                : "Add Address";

        document.getElementById("addressId").value =
            address?.id || "";

        document.getElementById("addressType").value =
            address?.address_type || "Home";

        document.getElementById("addressFullName").value =
            address?.full_name ||
            this.customer?.full_name ||
            "";

        document.getElementById("addressPhone").value =
            address?.phone ||
            this.customer?.phone ||
            "";

        document.getElementById("addressLine1").value =
            address?.address_line1 || "";

        document.getElementById("addressLine2").value =
            address?.address_line2 || "";

        document.getElementById("addressCity").value =
            address?.city ||
            this.customer?.city ||
            "";

        document.getElementById("addressProvince").value =
            address?.province || "";

        document.getElementById("addressPostalCode").value =
            address?.postal_code ||
            this.customer?.postal_code ||
            "";

        document.getElementById("addressCountry").value =
            address?.country || "Pakistan";

        document.getElementById("addressInstructions").value =
            address?.delivery_instructions || "";

        document.getElementById("addressIsDefault").checked =
            Boolean(address?.is_default);

        document
            .getElementById("addressForm")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    },

    closeAddressForm() {
        document
            .getElementById("addressForm")
            ?.classList.add("hidden");

        document
            .getElementById("addressForm")
            ?.reset();

        document.getElementById(
            "addressCountry"
        ).value = "Pakistan";
    },

    async saveAddress(event) {
        event.preventDefault();

        const id =
            document
                .getElementById("addressId")
                .value;

        const button =
            document.getElementById(
                "saveAddressButton"
            );

        const payload = {
            address_type:
                document.getElementById("addressType").value,
            full_name:
                document.getElementById("addressFullName").value.trim(),
            phone:
                document.getElementById("addressPhone").value.trim(),
            address_line1:
                document.getElementById("addressLine1").value.trim(),
            address_line2:
                document.getElementById("addressLine2").value.trim() || null,
            city:
                document.getElementById("addressCity").value.trim(),
            province:
                document.getElementById("addressProvince").value.trim() || null,
            postal_code:
                document.getElementById("addressPostalCode").value.trim() || null,
            country:
                document.getElementById("addressCountry").value.trim() || "Pakistan",
            delivery_instructions:
                document.getElementById("addressInstructions").value.trim() || null,
            is_default:
                document.getElementById("addressIsDefault").checked
        };

        this.loading(button, true, "Saving");

        try {
            const data =
                id
                    ? await API.put(
                        `/api/customer-addresses/${id}`,
                        payload
                    )
                    : await API.post(
                        "/api/customer-addresses",
                        payload
                    );

            this.message(
                "addressMessage",
                data.message,
                "success"
            );

            this.closeAddressForm();
            await this.loadAddresses(true);
            await this.loadOverviewCounts();
        } catch (error) {
            this.message(
                "addressMessage",
                error.message,
                "error"
            );
        } finally {
            this.loading(button, false);
        }
    },

    async handleAddressAction(event) {
        const edit =
            event.target.closest(
                "[data-edit-address]"
            );

        const makeDefault =
            event.target.closest(
                "[data-default-address]"
            );

        const remove =
            event.target.closest(
                "[data-delete-address]"
            );

        if (edit) {
            const address =
                this.addresses.find(
                    item =>
                        String(item.id) ===
                        edit.dataset.editAddress
                );

            if (address) {
                this.openAddressForm(address);
            }

            return;
        }

        if (makeDefault) {
            try {
                const data =
                    await API.patch(
                        `/api/customer-addresses/${makeDefault.dataset.defaultAddress}/default`,
                        {}
                    );

                this.message(
                    "addressMessage",
                    data.message,
                    "success"
                );

                await this.loadAddresses(true);
            } catch (error) {
                this.message(
                    "addressMessage",
                    error.message,
                    "error"
                );
            }

            return;
        }

        if (remove) {
            if (
                !confirm(
                    "Delete this saved address?"
                )
            ) {
                return;
            }

            try {
                const data =
                    await API.delete(
                        `/api/customer-addresses/${remove.dataset.deleteAddress}`
                    );

                this.message(
                    "addressMessage",
                    data.message,
                    "success"
                );

                await this.loadAddresses(true);
                await this.loadOverviewCounts();
            } catch (error) {
                this.message(
                    "addressMessage",
                    error.message,
                    "error"
                );
            }
        }
    },

    async loadCoupons(force = false) {
        if (
            this.loaded.coupons &&
            !force
        ) {
            this.renderCoupons();
            return;
        }

        document
            .getElementById("couponsLoading")
            ?.classList.remove("hidden");

        try {
            const data =
                await API.get(
                    "/api/customer-portal/coupons"
                );

            this.coupons = {
                available:
                    data.coupons?.available ||
                    [],
                used:
                    data.coupons?.used ||
                    [],
                expired:
                    data.coupons?.expired ||
                    []
            };

            this.loaded.coupons = true;
            this.renderCoupons();
        } catch (error) {
            this.message(
                "couponMessage",
                error.message,
                "error"
            );
        } finally {
            document
                .getElementById("couponsLoading")
                ?.classList.add("hidden");
        }
    },

    renderCoupons() {
        const list =
            document.getElementById(
                "couponsList"
            );

        const empty =
            document.getElementById(
                "couponsEmpty"
            );

        const rows =
            this.coupons[
                this.activeCouponFilter
            ] || [];

        if (!list) return;

        if (!rows.length) {
            list.innerHTML = "";
            empty?.classList.remove("hidden");
            return;
        }

        empty?.classList.add("hidden");

        list.innerHTML =
            rows.map(coupon => `
                <article class="coupon-card ${this.activeCouponFilter}">
                    <div class="coupon-cut"></div>

                    <div>
                        <span>${Components.e(coupon.coupon_type || "Promotion")}</span>

                        <h3>
                            ${
                                coupon.discount_type === "percentage"
                                    ? `${Number(coupon.discount_value || 0)}% OFF`
                                    : `${this.money(coupon.discount_value)} OFF`
                            }
                        </h3>

                        <strong>${Components.e(coupon.code)}</strong>

                        <p>
                            Minimum order:
                            ${this.money(coupon.minimum_order || 0)}
                        </p>

                        <small>
                            ${
                                this.activeCouponFilter === "used"
                                    ? `Used ${this.date(coupon.redeemed_at)}`
                                    : `Valid until ${this.date(coupon.expiry_date)}`
                            }
                        </small>
                    </div>

                    ${
                        this.activeCouponFilter === "available"
                            ? `
                                <button
                                    type="button"
                                    data-copy-coupon="${Components.e(coupon.code)}"
                                >
                                    <i class="fa-regular fa-copy"></i>
                                    Copy Code
                                </button>
                            `
                            : ""
                    }
                </article>
            `).join("");
    },

    renderVerificationState() {
        const customer =
            this.customer ||
            CustomerCentre.customer ||
            {};

        const emailVerified =
            Boolean(
                customer.email_verified_at ||
                customer.emailVerifiedAt ||
                customer.email_verified === true ||
                customer.email_verified === 1 ||
                customer.email_verified === "1"
            );

        const phoneVerified =
            Boolean(
                customer.phone_verified_at ||
                customer.phoneVerifiedAt ||
                customer.phone_verified === true ||
                customer.phone_verified === 1 ||
                customer.phone_verified === "1"
            );

        const emailStatus =
            document.getElementById(
                "securityEmailStatus"
            );

        const phoneStatus =
            document.getElementById(
                "securityPhoneStatus"
            );

        const emailValue =
            document.getElementById(
                "securityEmailValue"
            );

        const phoneValue =
            document.getElementById(
                "securityPhoneValue"
            );

        if (emailValue) {
            emailValue.textContent =
                customer.email ||
                "No email added";
        }

        if (phoneValue) {
            phoneValue.textContent =
                customer.phone ||
                "No mobile number added";
        }

        if (emailStatus) {
            emailStatus.textContent =
                emailVerified
                    ? "Verified"
                    : "Pending";

            emailStatus.className =
                `verification-pill ${
                    emailVerified
                        ? "verified"
                        : "pending"
                }`;
        }

        if (phoneStatus) {
            phoneStatus.textContent =
                phoneVerified
                    ? "Verified"
                    : "Pending";

            phoneStatus.className =
                `verification-pill ${
                    phoneVerified
                        ? "verified"
                        : "pending"
                }`;
        }

        document
            .querySelectorAll(
                '[data-request-verification="email"]'
            )
            .forEach(button => {
                button.classList.toggle(
                    "hidden",
                    emailVerified ||
                    !customer.email
                );

                button.disabled =
                    emailVerified ||
                    !customer.email;
            });

        document
            .querySelectorAll(
                '[data-request-verification="phone"]'
            )
            .forEach(button => {
                button.classList.toggle(
                    "hidden",
                    phoneVerified ||
                    !customer.phone
                );

                button.disabled =
                    phoneVerified ||
                    !customer.phone;
            });
    },

    async requestVerification(
        channel,
        button
    ) {
        const identifier =
            channel === "email"
                ? this.customer?.email
                : this.customer?.phone;

        if (!identifier) {
            this.message(
                "verificationMessage",
                `Add a ${
                    channel === "email"
                        ? "valid email address"
                        : "mobile number"
                } in Profile first.`,
                "error"
            );

            return;
        }

        this.loading(button, true, "Sending");

        try {
            const data =
                await API.post(
                    API.customer(
                        "/verification/request"
                    ),
                    {
                        identifier,
                        channel
                    }
                );

            document.getElementById(
                "verificationChannel"
            ).value = channel;

            document
                .getElementById(
                    "verificationCodeForm"
                )
                ?.classList.remove("hidden");

            this.message(
                "verificationMessage",
                data.message ||
                "Verification code sent.",
                "success"
            );

            if (data.developmentCode) {
                document.getElementById(
                    "verificationCode"
                ).value =
                    data.developmentCode;
            }
        } catch (error) {
            this.message(
                "verificationMessage",
                error.message,
                "error"
            );
        } finally {
            this.loading(button, false);
        }
    },

    async confirmVerification(event) {
        event.preventDefault();

        const channel =
            document.getElementById(
                "verificationChannel"
            ).value;

        const identifier =
            channel === "email"
                ? this.customer?.email
                : this.customer?.phone;

        const code =
            document.getElementById(
                "verificationCode"
            ).value.trim();

        const button =
            document.getElementById(
                "confirmVerificationButton"
            );

        this.loading(button, true, "Confirming");

        try {
            const data =
                await API.post(
                    API.customer(
                        "/verification/confirm"
                    ),
                    {
                        identifier,
                        code,
                        verification_code: code
                    }
                );

            this.message(
                "verificationMessage",
                data.message ||
                "Verification completed.",
                "success"
            );

            document
                .getElementById(
                    "verificationCodeForm"
                )
                ?.classList.add("hidden");

            await CustomerCentre.loadCustomerCentre();

            this.customer =
                CustomerCentre.customer;

            this.renderVerificationState();
        } catch (error) {
            this.message(
                "verificationMessage",
                error.message,
                "error"
            );
        } finally {
            this.loading(button, false);
        }
    },

    async changePassword(event) {
        event.preventDefault();

        const form =
            event.currentTarget;

        const currentPassword =
            document.getElementById(
                "currentPassword"
            ).value;

        const newPassword =
            document.getElementById(
                "newPassword"
            ).value;

        const confirmPassword =
            document.getElementById(
                "confirmNewPassword"
            ).value;

        if (newPassword.length < 8) {
            this.message(
                "passwordMessage",
                "New password must contain at least 8 characters.",
                "error"
            );

            return;
        }

        if (
            newPassword !==
            confirmPassword
        ) {
            this.message(
                "passwordMessage",
                "New passwords do not match.",
                "error"
            );

            return;
        }

        const button =
            document.getElementById(
                "changePasswordButton"
            );

        this.loading(button, true, "Updating");

        try {
            const data =
                await API.put(
                    API.customer(
                        "/account/password"
                    ),
                    {
                        current_password:
                            currentPassword,
                        new_password:
                            newPassword,
                        confirm_password:
                            confirmPassword
                    }
                );

            form?.reset();

            this.message(
                "passwordMessage",
                data.message,
                "success"
            );
        } catch (error) {
            this.message(
                "passwordMessage",
                error.message,
                "error"
            );
        } finally {
            this.loading(button, false);
        }
    },

    async loadSecurity(force = false) {
        if (
            this.loaded.security &&
            !force
        ) {
            return;
        }

        this.renderVerificationState();

        await Promise.allSettled([
            this.loadSessions(),
            this.loadDeletionStatus()
        ]);

        this.loaded.security = true;
    },

    async loadSessions() {
        const list =
            document.getElementById(
                "sessionsList"
            );

        if (!list) return;

        list.innerHTML =
            '<div class="account-module-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading sessions...</div>';

        try {
            const data =
                await API.get(
                    API.customer(
                        "/account/sessions"
                    )
                );

            const sessions =
                Array.isArray(data.sessions)
                    ? data.sessions
                    : [];

            if (!sessions.length) {
                list.innerHTML =
                    '<div class="account-module-state"><strong>No stored sessions found</strong><span>Your current token is still protected.</span></div>';

                return;
            }

            list.innerHTML =
                sessions.map(session => `
                    <article class="session-row">
                        <i class="fa-solid ${
                            /mobile|android|iphone/i.test(
                                session.user_agent || ""
                            )
                                ? "fa-mobile-screen"
                                : "fa-desktop"
                        }"></i>

                        <div>
                            <strong>
                                ${Components.e(session.device_name || "Signed-in device")}
                            </strong>

                            <span>
                                ${Components.e(session.ip_address || "IP unavailable")}
                                ·
                                ${this.date(session.last_used_at || session.created_at)}
                            </span>
                        </div>

                        ${
                            session.is_current
                                ? "<b>Current</b>"
                                : ""
                        }
                    </article>
                `).join("");
        } catch (error) {
            list.innerHTML =
                `<div class="account-module-state error">${Components.e(error.message)}</div>`;
        }
    },

    async revokeOtherSessions() {
        const button =
            document.getElementById(
                "revokeOtherSessionsButton"
            );

        if (
            !confirm(
                "Sign out all other stored sessions?"
            )
        ) {
            return;
        }

        this.loading(button, true, "Signing Out");

        try {
            const data =
                await API.delete(
                    API.customer(
                        "/account/sessions/others"
                    )
                );

            this.message(
                "sessionMessage",
                data.message,
                "success"
            );

            await this.loadSessions();
        } catch (error) {
            this.message(
                "sessionMessage",
                error.message,
                "error"
            );
        } finally {
            this.loading(button, false);
        }
    },

    async loadDeletionStatus() {
        try {
            const data =
                await API.get(
                    API.customer(
                        "/account/deletion"
                    )
                );

            const request =
                data.deletionRequest;

            const pending =
                request?.status ===
                "Pending";

            const box =
                document.getElementById(
                    "deletionStatusBox"
                );

            if (box) {
                box.innerHTML =
                    pending
                        ? `
                            <strong>Deletion requested</strong>
                            <span>
                                Scheduled for
                                ${this.date(request.scheduled_for)}.
                                ${Number(data.remainingDays || 0)}
                                day(s) remaining.
                            </span>
                        `
                        : `
                            <strong>No pending deletion request</strong>
                            <span>Your account remains active.</span>
                        `;
            }

            document
                .getElementById(
                    "cancelDeletionRequestButton"
                )
                ?.classList.toggle(
                    "hidden",
                    !pending
                );

            document
                .getElementById(
                    "requestDeletionButton"
                )
                ?.classList.toggle(
                    "hidden",
                    pending
                );
        } catch (error) {
            this.message(
                "deletionMessage",
                error.message,
                "error"
            );
        }
    },

    async requestDeletion(event) {
        event.preventDefault();

        const form =
            event.currentTarget;

        if (
            !confirm(
                "Request account deletion? You will have a recovery period before permanent deletion."
            )
        ) {
            return;
        }

        const button =
            document.getElementById(
                "requestDeletionButton"
            );

        this.loading(button, true, "Requesting");

        try {
            const data =
                await API.post(
                    API.customer(
                        "/account/deletion"
                    ),
                    {
                        password:
                            document.getElementById(
                                "deletionPassword"
                            ).value,
                        reason:
                            document.getElementById(
                                "deletionReason"
                            ).value,
                        additional_details:
                            document.getElementById(
                                "deletionDetails"
                            ).value.trim() ||
                            null
                    }
                );

            this.message(
                "deletionMessage",
                data.message,
                "success"
            );

            form?.reset();
            await this.loadDeletionStatus();
        } catch (error) {
            this.message(
                "deletionMessage",
                error.message,
                "error"
            );
        } finally {
            this.loading(button, false);
        }
    },

    async cancelDeletion() {
        if (
            !confirm(
                "Cancel the pending account-deletion request?"
            )
        ) {
            return;
        }

        try {
            const data =
                await API.post(
                    API.customer(
                        "/account/deletion/cancel-authenticated"
                    ),
                    {}
                );

            this.message(
                "deletionMessage",
                data.message,
                "success"
            );

            await this.loadDeletionStatus();
        } catch (error) {
            this.message(
                "deletionMessage",
                error.message,
                "error"
            );
        }
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => AccountModules.init()
);
