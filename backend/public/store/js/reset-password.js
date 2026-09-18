"use strict";

const ResetPasswordPage = {

    token: "",

    init() {

        this.token =
            new URLSearchParams(
                window.location.search
            )
                .get("token")
                ?.trim() ||
            "";

        /*
         * Keep the reset credential only in memory.
         * Remove it from the browser address immediately so
         * later resource requests/navigation cannot expose it.
         */
        if (this.token) {
            try {
                window.history.replaceState(
                    {},
                    document.title,
                    window.location.pathname
                );
            } catch (_) {}
        }

        this.bindEvents();
        this.bindPasswordToggles();
        this.validateResetLink();
        this.updatePasswordStrength();
    },

    bindEvents() {

        document
            .getElementById(
                "resetPasswordForm"
            )
            ?.addEventListener(
                "submit",
                (event) =>
                    this.submit(event)
            );

        document
            .getElementById(
                "newPassword"
            )
            ?.addEventListener(
                "input",
                () =>
                    this.updatePasswordStrength()
            );
    },

    bindPasswordToggles() {

        document
            .querySelectorAll(
                "[data-password-toggle]"
            )
            .forEach((button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const targetId =
                            button.getAttribute(
                                "data-password-toggle"
                            );

                        const input =
                            document.getElementById(
                                targetId
                            );

                        if (!input) {
                            return;
                        }

                        const reveal =
                            input.type ===
                            "password";

                        input.type =
                            reveal
                                ? "text"
                                : "password";

                        const icon =
                            button.querySelector("i");

                        if (icon) {
                            icon.className =
                                reveal
                                    ? "fa-regular fa-eye-slash"
                                    : "fa-regular fa-eye";
                        }
                    }
                );
            });
    },

    validateResetLink() {

        const valid =
            /^[a-f0-9]{64}$/i.test(
                this.token
            );

        if (valid) {
            return true;
        }

        const form =
            document.getElementById(
                "resetPasswordForm"
            );

        if (form) {

            form
                .querySelectorAll(
                    "input, button"
                )
                .forEach((element) => {
                    element.disabled = true;
                });
        }

        this.showMessage(
            "This password-reset link is invalid or incomplete. Please request a new reset link.",
            "error"
        );

        return false;
    },

    updatePasswordStrength() {

        const input =
            document.getElementById(
                "newPassword"
            );

        const bar =
            document.getElementById(
                "passwordStrengthBar"
            );

        const text =
            document.getElementById(
                "passwordStrengthText"
            );

        if (
            !input ||
            !bar ||
            !text
        ) {
            return;
        }

        const value =
            input.value || "";

        let score = 0;

        if (value.length >= 8) {
            score += 1;
        }

        if (value.length >= 12) {
            score += 1;
        }

        if (/[a-z]/.test(value)) {
            score += 1;
        }

        if (/[A-Z]/.test(value)) {
            score += 1;
        }

        if (/[0-9]/.test(value)) {
            score += 1;
        }

        if (/[^A-Za-z0-9]/.test(value)) {
            score += 1;
        }

        const percentage =
            Math.min(
                100,
                Math.round(
                    (score / 6) * 100
                )
            );

        bar.style.width =
            `${percentage}%`;

        if (!value) {
            text.textContent =
                "Use at least 8 characters.";
            return;
        }

        if (value.length < 8) {
            text.textContent =
                "Password must contain at least 8 characters.";
            return;
        }

        if (score <= 2) {
            text.textContent =
                "Password strength: Basic";
            return;
        }

        if (score <= 4) {
            text.textContent =
                "Password strength: Good";
            return;
        }

        text.textContent =
            "Password strength: Strong";
    },

    async submit(event) {

        event.preventDefault();

        if (!this.validateResetLink()) {
            return;
        }

        const newPassword =
            document
                .getElementById(
                    "newPassword"
                )
                .value;

        const confirmPassword =
            document
                .getElementById(
                    "confirmNewPassword"
                )
                .value;

        if (
            !newPassword ||
            newPassword.length < 8
        ) {
            this.showMessage(
                "New password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (
            newPassword !==
            confirmPassword
        ) {
            this.showMessage(
                "Password confirmation does not match.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById(
                "resetPasswordButton"
            );

        this.setLoading(
            button,
            true
        );

        try {

            const data =
                await API.post(
                    API.customer(
                        "/password/reset"
                    ),
                    {
                        token:
                            this.token,

                        new_password:
                            newPassword,

                        confirm_password:
                            confirmPassword
                    }
                );

            this.token = "";

            this.showMessage(
                data.message ||
                    "Password reset successfully.",
                "success"
            );

            const form =
                document.getElementById(
                    "resetPasswordForm"
                );

            if (form) {
                form.reset();
            }

            setTimeout(() => {
                window.location.href =
                    "account.html";
            }, 1200);

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

    setLoading(
        button,
        loading
    ) {

        if (!button) {
            return;
        }

        button.disabled =
            Boolean(loading);

        if (loading) {

            button.dataset.originalText =
                button.innerHTML;

            button.innerHTML =
                `Resetting password
                <i class="fa-solid fa-spinner fa-spin"></i>`;

            return;
        }

        if (
            button.dataset.originalText
        ) {
            button.innerHTML =
                button.dataset.originalText;
        }
    },

    showMessage(
        message,
        type = "info"
    ) {

        const target =
            document.getElementById(
                "resetMessage"
            );

        if (!target) {
            return;
        }

        target.textContent =
            message || "";

        target.className =
            `reset-message ${type}`;

        target.hidden =
            !message;
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => {
        ResetPasswordPage.init();
    }
);
