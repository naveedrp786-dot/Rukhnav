"use strict";

const ResetPasswordPage = {
    resendSeconds: 60,
    resendTimer: null,

    async init() {
        await this.waitForStore();

        this.bind();
        this.prefill();
        this.startResendTimer();
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
        const otpInputs =
            [...document.querySelectorAll("#otpFields input")];

        otpInputs.forEach((input, index) => {
            input.addEventListener("input", () => {
                input.value =
                    input.value.replace(/\D/g, "").slice(0, 1);

                if (input.value && index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            });

            input.addEventListener("keydown", event => {
                if (
                    event.key === "Backspace" &&
                    !input.value &&
                    index > 0
                ) {
                    otpInputs[index - 1].focus();
                }
            });

            input.addEventListener("paste", event => {
                event.preventDefault();

                const digits =
                    event.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, 6)
                        .split("");

                digits.forEach((digit, digitIndex) => {
                    if (otpInputs[digitIndex]) {
                        otpInputs[digitIndex].value = digit;
                    }
                });

                otpInputs[Math.min(digits.length, 6) - 1]?.focus();
            });
        });

        document.querySelectorAll("[data-password-toggle]")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => this.togglePassword(button)
                );
            });

        document.getElementById("newPassword")
            .addEventListener(
                "input",
                event => this.updateStrength(event.target.value)
            );

        document.getElementById("resetPasswordForm")
            .addEventListener(
                "submit",
                event => this.resetPassword(event)
            );

        document.getElementById("resendCodeButton")
            .addEventListener(
                "click",
                () => this.resendCode()
            );
    },

    prefill() {
        const params =
            new URLSearchParams(location.search);

        const identifier =
            params.get("identifier") ||
            sessionStorage.getItem("rukhnav_reset_identifier") ||
            "";

        document.getElementById("resetIdentifier").value =
            identifier;

        const developmentCode =
            sessionStorage.getItem("rukhnav_development_reset_code");

        if (developmentCode && /^\d{6}$/.test(developmentCode)) {
            const inputs =
                [...document.querySelectorAll("#otpFields input")];

            developmentCode.split("").forEach((digit, index) => {
                inputs[index].value = digit;
            });

            this.showMessage(
                `Development reset code loaded: ${developmentCode}`,
                "info"
            );
        }

        const expiry =
            sessionStorage.getItem("rukhnav_reset_expiry_minutes");

        if (expiry) {
            document.getElementById("codeExpiryText").textContent =
                `Code expires in approximately ${expiry} minute(s).`;
        }
    },

    code() {
        return [...document.querySelectorAll("#otpFields input")]
            .map(input => input.value)
            .join("");
    },

    async resetPassword(event) {
        event.preventDefault();

        const identifier =
            document.getElementById("resetIdentifier").value.trim();

        const code =
            this.code();

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmNewPassword").value;

        if (!/^\d{6}$/.test(code)) {
            this.showMessage(
                "Enter the complete six-digit reset code.",
                "error"
            );
            return;
        }

        if (newPassword.length < 8) {
            this.showMessage(
                "New password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showMessage(
                "Password confirmation does not match.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById("resetPasswordButton");

        const original =
            button.innerHTML;

        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Resetting Password';

        try {
            const data = await API.post(
                API.customer("/password/reset"),
                {
                    identifier,
                    code,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                }
            );

            API.clearCustomerSession();

            sessionStorage.removeItem("rukhnav_reset_identifier");
            sessionStorage.removeItem("rukhnav_reset_expiry_minutes");
            sessionStorage.removeItem("rukhnav_development_reset_code");

            this.showMessage(data.message, "success");

            setTimeout(() => {
                location.href =
                    `account.html?identifier=${encodeURIComponent(identifier)}`;
            }, 1600);
        } catch (error) {
            const suffix =
                error.data?.remainingAttempts !== undefined
                    ? ` ${error.data.remainingAttempts} attempt(s) remaining.`
                    : "";

            this.showMessage(
                error.message + suffix,
                "error"
            );
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    },

    async resendCode() {
        const identifier =
            document.getElementById("resetIdentifier").value.trim();

        if (!identifier) {
            this.showMessage(
                "Enter your email address or mobile number first.",
                "error"
            );
            return;
        }

        const button =
            document.getElementById("resendCodeButton");

        button.disabled = true;

        try {
            const data = await API.post(
                API.customer("/password/forgot"),
                { identifier }
            );

            if (data.developmentCode) {
                sessionStorage.setItem(
                    "rukhnav_development_reset_code",
                    String(data.developmentCode)
                );
            }

            this.showMessage(data.message, "success");
            this.startResendTimer();
        } catch (error) {
            this.showMessage(error.message, "error");
            button.disabled = false;
        }
    },

    startResendTimer() {
        clearInterval(this.resendTimer);

        this.resendSeconds = 60;

        const button =
            document.getElementById("resendCodeButton");

        const countdown =
            document.getElementById("resendCountdown");

        button.disabled = true;

        const render = () => {
            countdown.textContent =
                String(this.resendSeconds);

            if (this.resendSeconds <= 0) {
                clearInterval(this.resendTimer);
                button.disabled = false;
                button.innerHTML = "Resend code";
                return;
            }

            button.innerHTML =
                `Resend in <span id="resendCountdown">${this.resendSeconds}</span>s`;

            this.resendSeconds -= 1;
        };

        render();

        this.resendTimer =
            setInterval(render, 1000);
    },

    togglePassword(button) {
        const input =
            document.getElementById(
                button.dataset.passwordToggle
            );

        const showing =
            input.type === "text";

        input.type =
            showing ? "password" : "text";

        button.querySelector("i").className =
            showing
                ? "fa-regular fa-eye"
                : "fa-regular fa-eye-slash";
    },

    updateStrength(password) {
        let score = 0;

        if (password.length >= 8) score += 1;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        const widths = [0, 25, 50, 75, 100];
        const labels = [
            "Use at least 8 characters.",
            "Weak password",
            "Fair password",
            "Good password",
            "Strong password"
        ];

        const bar =
            document.getElementById("passwordStrengthBar");

        bar.style.width =
            `${widths[score]}%`;

        bar.style.background =
            score < 2
                ? "#b63a30"
                : score < 4
                    ? "#d39b29"
                    : "#20804a";

        document.getElementById("passwordStrengthText").textContent =
            labels[score];
    },

    showMessage(message, type) {
        const element =
            document.getElementById("resetMessage");

        element.textContent = message;
        element.className =
            `reset-message show ${type}`;
    }
};

document.addEventListener(
    "DOMContentLoaded",
    () => ResetPasswordPage.init()
);
