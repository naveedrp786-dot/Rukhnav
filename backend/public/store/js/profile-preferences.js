"use strict";

const ProfilePreferences = {
    account: null,
    profile: null,
    loyalty: null,

    async init() {
        if (!API.isAuthenticated()) return;

        this.bind();
        await this.load();
    },

    bind() {
        document.getElementById("customerProfileForm")
            ?.addEventListener("submit", event => this.saveProfile(event));

        document.getElementById("reminderPreferencesForm")
            ?.addEventListener("submit", event => this.savePreferences(event));
    },

    async load() {
        try {
            /*
             * Customer account data is authoritative for identity/contact
             * fields such as full name, email, phone and verification state.
             *
             * Extended profile and loyalty data are optional. A temporary
             * failure in either must not prevent the customer's real account
             * phone/email from appearing in the Profile form.
             */
            const [accountResponse, profileResponse, loyaltyResponse] =
                await Promise.all([
                    API.get(API.customer("/profile")),
                    API.get("/api/profile").catch(error => {
                        console.warn(
                            "Extended profile unavailable:",
                            error.message
                        );

                        return { profile: {} };
                    }),
                    API.get("/api/customer-loyalty/me").catch(() => ({
                        loyalty: {}
                    }))
                ]);

            this.account =
                accountResponse?.customer || {};

            this.profile =
                profileResponse?.profile || {};

            this.loyalty =
                loyaltyResponse?.loyalty || {};

            this.populateProfile();
            this.populatePreferences();
            this.renderCompletion();
        } catch (error) {
            console.error("Profile preferences load error:", error);
            this.message("profileSaveMessage", error.message, "error");
        }
    },

    populateProfile() {
        const account = this.account || {};
        const profile = this.profile || {};

        this.value("profileEditFullName", account.full_name || profile.full_name || "");
        this.value("profileEditEmail", account.email || profile.email || "");
        this.value("profileEditPhone", account.phone || profile.phone || "");
        this.value("profileEditGender", profile.gender || "");
        this.value("profileEditDateOfBirth", this.dateValue(profile.date_of_birth));
        this.value("profileEditSkinType", profile.skin_type || "");
        this.value("profileEditHairType", profile.hair_type || "");
        this.value("profileEditAddress", profile.address || account.address || "");
        this.value("profileEditCity", profile.city || account.city || "");
        this.value("profileEditCountry", profile.country || account.country || "Pakistan");
        this.value("profileEditPostalCode", profile.postal_code || account.postal_code || "");

        this.verificationBadge(
            "profileEmailVerification",
            Boolean(account.email),
            Boolean(account.email_verified_at || account.emailVerified)
        );

        this.verificationBadge(
            "profilePhoneVerification",
            Boolean(account.phone),
            Boolean(account.phone_verified_at || account.phoneVerified)
        );
    },

    populatePreferences() {
        const account = this.account || {};
        const benefits = this.loyalty?.benefits || {};

        const emailVerified = Boolean(
            account.email && (account.email_verified_at || account.emailVerified)
        );
        const phoneVerified = Boolean(
            account.phone && (account.phone_verified_at || account.phoneVerified)
        );

        const emailAllowed = benefits.emailRemindersEnabled !== false;
        const whatsappAllowed = Boolean(benefits.whatsappRemindersEnabled);
        const smsAllowed = Boolean(benefits.smsRemindersEnabled);

        this.preference(
            "emailPreferenceRow",
            "emailRemindersEnabled",
            emailVerified && emailAllowed,
            Boolean(account.email_reminders_enabled),
            "emailPreferenceDescription",
            !account.email
                ? "Add an email address before enabling this channel."
                : !emailVerified
                    ? "Verify your email address before enabling this channel."
                    : !emailAllowed
                        ? "Your membership does not currently include email reminders."
                        : "Available for your verified email address."
        );

        this.preference(
            "whatsappPreferenceRow",
            "whatsappRemindersEnabled",
            phoneVerified && whatsappAllowed,
            Boolean(account.whatsapp_reminders_enabled),
            "whatsappPreferenceDescription",
            !account.phone
                ? "Add a mobile number before enabling WhatsApp."
                : !phoneVerified
                    ? "Verify your mobile number before enabling WhatsApp."
                    : !whatsappAllowed
                        ? "WhatsApp reminders unlock with an eligible membership."
                        : "Available for your verified mobile number."
        );

        this.preference(
            "smsPreferenceRow",
            "smsRemindersEnabled",
            phoneVerified && smsAllowed,
            Boolean(account.sms_reminders_enabled),
            "smsPreferenceDescription",
            !account.phone
                ? "Add a mobile number before enabling SMS."
                : !phoneVerified
                    ? "Verify your mobile number before enabling SMS."
                    : !smsAllowed
                        ? "SMS reminders are reserved for eligible premium members."
                        : "Available for your verified mobile number."
        );

        const level = this.loyalty?.membershipLevel || "Bronze";
        document.getElementById("membershipPermissionNote").textContent =
            `${level} membership permissions are applied automatically. ` +
            "A channel must be included in your membership and its email or phone identifier must be verified.";
    },

    preference(rowId, inputId, enabled, checked, descriptionId, description) {
        const row = document.getElementById(rowId);
        const input = document.getElementById(inputId);
        const descriptionElement = document.getElementById(descriptionId);

        if (!row || !input) return;

        input.disabled = !enabled;
        input.checked = enabled && checked;
        row.classList.toggle("disabled", !enabled);
        if (descriptionElement) descriptionElement.textContent = description;
    },

    async saveProfile(event) {
        event.preventDefault();

        const button = document.getElementById("saveCustomerProfileButton");
        this.loading(button, true, "Saving profile");
        this.message("profileSaveMessage", "", "");

        const payload = {
            full_name: this.get("profileEditFullName"),
            email: this.get("profileEditEmail") || null,
            phone: this.get("profileEditPhone") || null,
            gender: this.get("profileEditGender") || null,
            date_of_birth: this.get("profileEditDateOfBirth") || null,
            skin_type: this.get("profileEditSkinType") || null,
            hair_type: this.get("profileEditHairType") || null,
            address: this.get("profileEditAddress") || null,
            city: this.get("profileEditCity") || null,
            country: this.get("profileEditCountry") || "Pakistan",
            postal_code: this.get("profileEditPostalCode") || null
        };

        try {
            const data = await API.put("/api/profile", payload);
            this.message("profileSaveMessage", data.message || "Profile saved.", "success");
            Store.toast(data.message || "Profile saved successfully.");
            await this.load();

            if (typeof CustomerCentre !== "undefined") {
                await CustomerCentre.loadCustomerCentre();
                CustomerCentre.showPanel("profile");
            }
        } catch (error) {
            this.message("profileSaveMessage", error.message, "error");
        } finally {
            this.loading(button, false);
        }
    },

    async savePreferences(event) {
        event.preventDefault();

        const button = document.getElementById("saveReminderPreferencesButton");
        this.loading(button, true, "Saving preferences");
        this.message("preferencesSaveMessage", "", "");

        const payload = {
            email_reminders_enabled: document.getElementById("emailRemindersEnabled").checked,
            whatsapp_reminders_enabled: document.getElementById("whatsappRemindersEnabled").checked,
            sms_reminders_enabled: document.getElementById("smsRemindersEnabled").checked
        };

        try {
            const data = await API.patch("/api/profile/preferences", payload);
            this.message("preferencesSaveMessage", data.message || "Preferences saved.", "success");
            Store.toast(data.message || "Reminder preferences saved.");
            await this.load();
        } catch (error) {
            this.message("preferencesSaveMessage", error.message, "error");
        } finally {
            this.loading(button, false);
        }
    },

    renderCompletion() {
        const values = [
            this.get("profileEditFullName"),
            this.get("profileEditEmail") || this.get("profileEditPhone"),
            this.get("profileEditGender"),
            this.get("profileEditDateOfBirth"),
            this.get("profileEditAddress"),
            this.get("profileEditCity"),
            this.get("profileEditCountry"),
            this.get("profileEditPostalCode"),
            this.profile?.profile_picture
        ];

        const complete = values.filter(Boolean).length;
        const percent = Math.round((complete / values.length) * 100);

        const ring = document.getElementById("profileCompletionRing");
        const label = document.getElementById("profileCompletionPercent");
        if (ring) ring.style.setProperty("--completion", `${percent}%`);
        if (label) label.textContent = `${percent}%`;
    },

    verificationBadge(id, exists, verified) {
        const element = document.getElementById(id);
        if (!element) return;

        if (!exists) {
            element.textContent = "Not added";
            element.className = "verification-pill pending";
        } else if (verified) {
            element.textContent = "Verified";
            element.className = "verification-pill verified";
        } else {
            element.textContent = "Unverified";
            element.className = "verification-pill pending";
        }
    },

    value(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value ?? "";
    },

    get(id) {
        return document.getElementById(id)?.value?.trim() || "";
    },

    dateValue(value) {
        return value ? String(value).slice(0, 10) : "";
    },

    message(id, text, type) {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = text || "";
        element.className = `inline-save-message ${type || ""}`.trim();
    },

    loading(button, loading, label = "") {
        if (!button) return;
        if (loading) {
            button.dataset.original = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
        } else {
            button.disabled = false;
            if (button.dataset.original) {
                button.innerHTML = button.dataset.original;
                delete button.dataset.original;
            }
        }
    }
};

document.addEventListener("DOMContentLoaded", () => ProfilePreferences.init());
