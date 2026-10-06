"use strict";

const db = require("../config/db");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const {
    sendEmail
} = require("../services/emailService");

const {
    sendWhatsApp,
    isSimulationMode
} = require(
    "../services/notificationProviderService"
);

// =========================================
// Configuration
// =========================================

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 3;
const REQUEST_WINDOW_MINUTES = 15;
const PASSWORD_SALT_ROUNDS = 12;

// Password-reset links use a cryptographically random,
// single-use token instead of the customer OTP flow.
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_EXPIRY_MINUTES = 20;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


// =========================================
// Request Account Verification Code
// =========================================

exports.requestVerificationCode = async (
    req,
    res
) => {

    try {

        const rawIdentifier =
            req.body.identifier ||
            req.body.email ||
            req.body.phone;

        const identifierData =
            identifyAndNormalize(
                rawIdentifier
            );

        if (!identifierData.value) {
            return res.status(400).json({
                success: false,
                message:
                    "Email address or phone number is required."
            });
        }

        const customer =
            await findCustomer(
                db,
                identifierData
            );

        if (!customer) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });
        }

        if (customer.deleted_at) {
            return res.status(400).json({
                success: false,
                message:
                    "This account is no longer available."
            });
        }

        const alreadyVerified =
            identifierData.type === "Email"
                ? Boolean(
                    customer.email_verified_at
                )
                : Boolean(
                    customer.phone_verified_at
                );

        if (alreadyVerified) {
            return res.status(400).json({
                success: false,
                message:
                    `${identifierData.type} is already verified.`
            });
        }

        const purpose =
            identifierData.type === "Email"
                ? "Email Verification"
                : "Phone Verification";

        // =========================================
        // Phone Verification Provider Check
        // WhatsApp OTP through WasenderAPI
        // =========================================
        if (
            identifierData.type === "Phone" &&
            !isSimulationMode() &&
            !process.env.WASENDER_API_TOKEN
        ) {
            return res.status(503).json({
                success: false,
                message:
                    "WhatsApp verification is temporarily unavailable. Please try again later."
            });
        }

        const requestAllowed =
            await checkRequestLimit(
                customer.id,
                identifierData.value,
                purpose
            );

        if (!requestAllowed) {
            return res.status(429).json({
                success: false,
                message:
                    "Too many verification-code requests. Please try again later."
            });
        }

        const code =
            generateNumericCode();

        const codeHash =
            await bcrypt.hash(
                code,
                10
            );

        // Cancel previous unused codes
        await db.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE customer_id = ?
            AND identifier = ?
            AND purpose = ?
            AND status = 'Pending'
        `, [
            customer.id,
            identifierData.value,
            purpose
        ]);

        await db.query(`
            INSERT INTO customer_auth_codes (
                customer_id,
                identifier,
                identifier_type,
                purpose,
                code_hash,
                status,
                attempts,
                max_attempts,
                expires_at,
                requested_ip
            )
            VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                'Pending',
                0,
                ?,
                DATE_ADD(
                    NOW(),
                    INTERVAL ? MINUTE
                ),
                ?
            )
        `, [
            customer.id,
            identifierData.value,
            identifierData.type,
            purpose,
            codeHash,
            MAX_OTP_ATTEMPTS,
            OTP_EXPIRY_MINUTES,
            getRequestIp(req)
        ]);


    // =========================================
    // Deliver Verification Code
    // =========================================

    if (identifierData.type === "Email") {

        const recipientName =
            customer.full_name ||
            customer.first_name ||
            "Customer";

        const emailSent =
            await sendEmail(
                identifierData.value,
                "Verify your RUKHNAV account",
                `
                <div style="
                    font-family:Arial,sans-serif;
                    max-width:560px;
                    margin:auto;
                    padding:28px;
                    color:#1f2a24;
                ">
                    <h1 style="
                        margin:0 0 12px;
                        color:#17452f;
                    ">
                        RUKHNAV
                    </h1>

                    <h2 style="
                        margin:0 0 18px;
                        color:#1f2a24;
                    ">
                        Verify your email address
                    </h2>

                    <p>
                        Hello ${recipientName},
                    </p>

                    <p>
                        Use this verification code to activate
                        your RUKHNAV customer account:
                    </p>

                    <div style="
                        margin:24px 0;
                        padding:18px;
                        text-align:center;
                        background:#f7f4ec;
                        border-radius:12px;
                    ">
                        <strong style="
                            font-size:32px;
                            letter-spacing:8px;
                            color:#17452f;
                        ">
                            ${code}
                        </strong>
                    </div>

                    <p>
                        This code expires in
                        ${OTP_EXPIRY_MINUTES} minutes.
                    </p>

                    <p style="
                        font-size:12px;
                        color:#6f776f;
                    ">
                        If you did not request this code,
                        you can safely ignore this email.
                    </p>
                </div>
                `
            );

        if (!emailSent) {

            return res.status(502).json({
                success: false,
                message:
                    "The verification code was created, but the email could not be sent. Please try again."
            });

        }

    }

    // =========================================
    // Deliver Phone Verification via WhatsApp
    // =========================================

    if (identifierData.type === "Phone") {

        try {

            await sendWhatsApp({
                to:
                    identifierData.value,

                message:
                    `Your RUKHNAV verification code is ${code}. ` +
                    `This code expires in ${OTP_EXPIRY_MINUTES} minutes. ` +
                    `Do not share this code with anyone.`
            });

        } catch (deliveryError) {

            // Do not leave a usable OTP behind when
            // delivery to WhatsApp has failed.
            await db.query(`
                UPDATE customer_auth_codes

                SET status = 'Cancelled'

                WHERE customer_id = ?
                AND identifier = ?
                AND purpose = ?
                AND status = 'Pending'
            `, [
                customer.id,
                identifierData.value,
                purpose
            ]);

            console.error(
                "WhatsApp verification delivery error:",
                deliveryError
            );

            return res.status(502).json({
                success: false,
                message:
                    "The verification code could not be sent through WhatsApp. Please try again."
            });

        }

    }


        const response = {
            success: true,

            message:
                identifierData.type === "Phone"
                    ? "Verification code sent to your WhatsApp number."
                    : "Verification code sent to your email address.",

            identifier:
                maskIdentifier(
                    identifierData
                ),

            identifierType:
                identifierData.type,

            expiresInMinutes:
                OTP_EXPIRY_MINUTES
        };

        // Only expose OTP during development.
        if (
            process.env.NODE_ENV !==
            "production"
        ) {
            response.developmentCode =
                code;
        }

        return res.json(response);

    } catch (error) {

        console.error(
            "Request verification code error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to create verification code.",
            error: error.message
        });

    }

};

// =========================================
// Verify Customer Account
// =========================================

exports.verifyAccount = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            identifier,
            email,
            phone,
            code
        } = req.body;

        const identifierData =
            identifyAndNormalize(
                identifier ||
                email ||
                phone
            );

        if (
            !identifierData.value ||
            !isValidCode(code)
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "A valid identifier and six-digit verification code are required."
            });
        }

        const customer =
            await findCustomer(
                connection,
                identifierData
            );

        if (!customer) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Verification code is invalid or expired."
            });
        }

        const purpose =
            identifierData.type === "Email"
                ? "Email Verification"
                : "Phone Verification";

        const authCode =
            await getLatestPendingCode(
                connection,
                customer.id,
                identifierData.value,
                purpose
            );

        if (!authCode) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Verification code is invalid or expired."
            });
        }

        const verification =
            await validateCode(
                connection,
                authCode,
                String(code)
            );

        if (!verification.valid) {

            await connection.commit();

            return res.status(
                verification.statusCode
            ).json({
                success: false,
                message:
                    verification.message,
                remainingAttempts:
                    verification
                        .remainingAttempts
            });

        }

        const verificationColumn =
            identifierData.type === "Email"
                ? "email_verified_at"
                : "phone_verified_at";

        await connection.query(`
            UPDATE customers

            SET
                ${verificationColumn} =
                    CURRENT_TIMESTAMP,

                status =
                    CASE
                        WHEN status =
                             'Pending Verification'
                        THEN 'Active'
                        ELSE status
                    END,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [customer.id]);

        await connection.query(`
            UPDATE customer_auth_codes

            SET
                status = 'Used',
                used_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [authCode.id]);

        await connection.commit();

        return res.json({
            success: true,
            message:
                `${identifierData.type} verified successfully. You can now log in.`,
            customer: {
                id:
                    customer.id,

                status:
                    customer.status ===
                    "Pending Verification"
                        ? "Active"
                        : customer.status
            }
        });

    } catch (error) {

        await connection.rollback();

        console.error(
            "Verify customer account error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to verify customer account.",
            error: error.message
        });

    } finally {

        connection.release();

    }

};


// =========================================
// Mobile Password Recovery Approval
// =========================================

const MOBILE_RECOVERY_SECRET_BYTES = 32;
const MOBILE_RECOVERY_REQUEST_MINUTES = 24 * 60;
const MOBILE_RECOVERY_RESET_TOKEN_MINUTES = 15;
const MOBILE_RECOVERY_OTP_PURPOSE =
    "Account Recovery";

function hashRecoverySecret(secret) {
    return crypto
        .createHash("sha256")
        .update(String(secret || ""))
        .digest("hex");
}

function isRecoverySecretValid(secret) {
    return /^[a-f0-9]{64}$/i.test(
        String(secret || "").trim()
    );
}

// =========================================
// Request Password Reset Code
// =========================================

exports.requestPasswordReset = async (
    req,
    res
) => {

    const genericMessage =
        "If an account matches those details, a secure password-reset link has been sent.";

    try {

        const identifierData =
            identifyAndNormalize(
                req.body.identifier ||
                req.body.email ||
                req.body.phone
            );

        /*
         * Do not reveal whether an account exists.
         */
        if (!identifierData.value) {
            return res.json({
                success: true,
                message: genericMessage
            });
        }

        const customer =
            await findCustomer(
                db,
                identifierData
            );

        if (
            !customer ||
            customer.deleted_at
        ) {

            /*
             * Keep mobile recovery outwardly indistinguishable
             * whether the supplied phone belongs to an account.
             *
             * This dummy browser secret is intentionally NOT
             * persisted anywhere.
             */
            if (
                identifierData.type === "Phone"
            ) {

                const dummyRecoverySecret =
                    crypto
                        .randomBytes(
                            MOBILE_RECOVERY_SECRET_BYTES
                        )
                        .toString("hex");

                res.set(
                    "Cache-Control",
                    "no-store"
                );

                return res.json({
                    success: true,
                    message:
                        "Your mobile password-recovery request is waiting for RUKHNAV administrator approval.",
                    recovery:
                        "admin_approval",
                    mobileRecoveryPending:
                        true,
                    recoverySecret:
                        dummyRecoverySecret,
                    expiresInMinutes:
                        MOBILE_RECOVERY_REQUEST_MINUTES
                });
            }

            return res.json({
                success: true,
                message: genericMessage
            });
        }

        /*
         * Preserve the existing request-rate protection.
         */
        const allowed =
            await checkRequestLimit(
                customer.id,
                identifierData.value,
                "Password Reset"
            );

        if (!allowed) {

            console.warn(
                "Password reset request throttled."
            );

            if (identifierData.type === "Phone") {

                /*
                 * Enumeration resistance:
                 *
                 * A throttled registered phone must have the
                 * same outward response shape as every other
                 * syntactically valid mobile recovery request.
                 *
                 * This secret is deliberately NOT stored.
                 */
                const dummyRecoverySecret =
                    crypto
                        .randomBytes(
                            MOBILE_RECOVERY_SECRET_BYTES
                        )
                        .toString("hex");

                res.set(
                    "Cache-Control",
                    "no-store"
                );

                return res.json({
                    success: true,
                    message:
                        "Your mobile password-recovery request is waiting for RUKHNAV Admin approval.",
                    recovery:
                        "admin_approval",
                    mobileRecoveryPending:
                        true,
                    recoverySecret:
                        dummyRecoverySecret,
                    expiresInMinutes:
                        MOBILE_RECOVERY_REQUEST_MINUTES
                });
            }

            return res.json({
                success: true,
                message: genericMessage
            });
        }

        /*
         * Mobile-number password recovery requires administrator
         * approval. Do not create a usable password-reset token yet.
         *
         * The browser receives the raw recovery secret. Only its
         * SHA-256 hash is stored server-side.
         */
        if (identifierData.type === "Phone") {

            res.set(
                "Cache-Control",
                "no-store"
            );

            const recoverySecret =
                crypto
                    .randomBytes(
                        MOBILE_RECOVERY_SECRET_BYTES
                    )
                    .toString("hex");

            const recoverySecretHash =
                hashRecoverySecret(
                    recoverySecret
                );

            await db.query(`
                UPDATE customer_password_recovery_requests

                SET
                    status = 'Cancelled',
                    cancelled_at = CURRENT_TIMESTAMP

                WHERE customer_id = ?
                AND status IN (
                    'Pending',
                    'Approved'
                )
            `, [
                customer.id
            ]);

            await db.query(`
                INSERT INTO customer_password_recovery_requests (
                    customer_id,
                    request_token_hash,
                    status,
                    requested_at,
                    expires_at
                )

                VALUES (
                    ?,
                    ?,
                    'Pending',
                    CURRENT_TIMESTAMP,
                    DATE_ADD(
                        CURRENT_TIMESTAMP,
                        INTERVAL ? MINUTE
                    )
                )
            `, [
                customer.id,
                recoverySecretHash,
                MOBILE_RECOVERY_REQUEST_MINUTES
            ]);

            return res.json({
                success: true,
                message:
                    "Your mobile password-recovery request is waiting for RUKHNAV administrator approval.",
                recovery:
                    "admin_approval",
                mobileRecoveryPending:
                    true,
                recoverySecret,
                expiresInMinutes:
                    MOBILE_RECOVERY_REQUEST_MINUTES
            });
        }

        /*
         * Only the SHA-256 hash is stored in the database.
         * The raw token exists only long enough to be delivered
         * to the customer.
         */
        const rawToken =
            crypto
                .randomBytes(
                    PASSWORD_RESET_TOKEN_BYTES
                )
                .toString("hex");

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");

        /*
         * Invalidate any previous unused password-reset
         * authorization for this customer/identifier.
         */
        await db.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE customer_id = ?
            AND identifier = ?
            AND purpose = 'Password Reset'
            AND status = 'Pending'
        `, [
            customer.id,
            identifierData.value
        ]);

        /*
         * Reuse the existing customer_auth_codes table.
         * code_hash now stores the SHA-256 token hash for
         * Password Reset records.
         */
        await db.query(`
            INSERT INTO customer_auth_codes (
                customer_id,
                identifier,
                identifier_type,
                purpose,
                code_hash,
                status,
                attempts,
                max_attempts,
                expires_at,
                requested_ip
            )

            VALUES (
                ?,
                ?,
                ?,
                'Password Reset',
                ?,
                'Pending',
                0,
                1,
                DATE_ADD(
                    CURRENT_TIMESTAMP,
                    INTERVAL ? MINUTE
                ),
                ?
            )
        `, [
            customer.id,
            identifierData.value,
            identifierData.type,
            tokenHash,
            PASSWORD_RESET_EXPIRY_MINUTES,
            getRequestIp(req)
        ]);

                /*
         * Build password-reset links from a trusted application
         * base URL rather than the incoming Host header.
         *
         * Production falls back to the canonical RUKHNAV domain.
         * Development can explicitly provide FRONTEND_URL or
         * APP_BASE_URL when another origin is required.
         */
        const publicBaseUrl =
            String(
                process.env.FRONTEND_URL ||
                process.env.APP_BASE_URL ||
                "https://www.rukhnav.store"
            )
                .trim()
                .replace(/\/+$/, "");

        let trustedBaseUrl;

        try {
            const parsedBaseUrl =
                new URL(publicBaseUrl);

            if (
                parsedBaseUrl.protocol !== "https:" &&
                !(
                    process.env.NODE_ENV !== "production" &&
                    parsedBaseUrl.protocol === "http:"
                )
            ) {
                throw new Error(
                    "Password-reset base URL must use HTTPS."
                );
            }

            trustedBaseUrl =
                parsedBaseUrl.origin;

        } catch (urlError) {

            throw new Error(
                "Invalid trusted password-reset application URL."
            );
        }

        const resetUrl =
            `${trustedBaseUrl}` +
            `/store/reset-password.html` +
            `?token=${encodeURIComponent(rawToken)}`;

        /*
         * Email reset link.
         */
        if (identifierData.type === "Email") {

            const recipientName =
                customer.full_name ||
                customer.first_name ||
                "Customer";

            const safeName =
                escapeHtml(
                    recipientName
                );

            const safeUrl =
                escapeHtml(
                    resetUrl
                );

            const emailSent =
                await sendEmail(
                    identifierData.value,
                    "Reset your RUKHNAV password",
                    `
                    <div style="
                        font-family:Arial,sans-serif;
                        max-width:560px;
                        margin:auto;
                        padding:28px;
                        color:#1f2a24;
                    ">
                        <h1 style="
                            margin:0 0 12px;
                            color:#17452f;
                        ">
                            RUKHNAV
                        </h1>

                        <h2 style="
                            margin:0 0 18px;
                            color:#1f2a24;
                        ">
                            Reset your password
                        </h2>

                        <p>
                            Hello ${safeName},
                        </p>

                        <p>
                            We received a request to reset
                            your RUKHNAV account password.
                        </p>

                        <p style="
                            margin:28px 0;
                        ">
                            <a
                                href="${safeUrl}"
                                style="
                                    display:inline-block;
                                    padding:13px 22px;
                                    background:#17452f;
                                    color:#ffffff;
                                    text-decoration:none;
                                    border-radius:8px;
                                    font-weight:700;
                                "
                            >
                                Reset Password
                            </a>
                        </p>

                        <p>
                            This secure link expires in
                            ${PASSWORD_RESET_EXPIRY_MINUTES}
                            minutes and can only be used once.
                        </p>

                        <p style="
                            font-size:13px;
                            color:#6f776f;
                        ">
                            If you did not request a password
                            reset, you can safely ignore this
                            email.
                        </p>
                    </div>
                    `
                );

            if (!emailSent) {

                await db.query(`
                    UPDATE customer_auth_codes

                    SET status = 'Cancelled'

                    WHERE customer_id = ?
                    AND identifier = ?
                    AND purpose = 'Password Reset'
                    AND status = 'Pending'
                `, [
                    customer.id,
                    identifierData.value
                ]);

                console.error(
                    "Password reset email delivery failed."
                );

                return res.json({
                    success: true,
                    message: genericMessage
                });
            }
        }

        return res.json({
            success: true,
            message:
                genericMessage,
            expiresInMinutes:
                PASSWORD_RESET_EXPIRY_MINUTES
        });

    } catch (error) {

        console.error(
            "Request customer password reset error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to request password reset."
        });
    }
};

// =========================================
// Reset Customer Password
// =========================================

exports.resetPassword = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            token,
            new_password,
            confirm_password
        } = req.body;

        /*
         * A reset token is 32 random bytes encoded as
         * 64 hexadecimal characters.
         */
        const cleanToken =
            String(token || "")
                .trim();

        if (
            !/^[a-f0-9]{64}$/i.test(
                cleanToken
            )
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "This password-reset link is invalid or incomplete."
            });
        }

        if (
            typeof new_password !==
                "string" ||
            new_password.length < 8
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "New password must contain at least 8 characters."
            });
        }

        if (
            confirm_password !==
                undefined &&
            new_password !==
                confirm_password
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Password confirmation does not match."
            });
        }

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(cleanToken)
                .digest("hex");

        /*
         * Lock the matching authorization row so the
         * same reset link cannot be consumed twice
         * concurrently.
         */
        const [resetRows] =
            await connection.query(`
                SELECT
                    id,
                    customer_id,
                    expires_at

                FROM customer_auth_codes

                WHERE purpose =
                    'Password Reset'

                AND code_hash = ?

                AND status =
                    'Pending'

                LIMIT 1

                FOR UPDATE
            `, [
                tokenHash
            ]);

        const resetRecord =
            resetRows[0];

        if (!resetRecord) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "This password-reset link is invalid or has already been used."
            });
        }

        const expiresAt =
            new Date(
                resetRecord.expires_at
            );

        if (
            Number.isNaN(
                expiresAt.getTime()
            ) ||
            expiresAt.getTime() <=
                Date.now()
        ) {

            await connection.query(`
                UPDATE customer_auth_codes

                SET status = 'Expired'

                WHERE id = ?
            `, [
                resetRecord.id
            ]);

            await connection.commit();

            return res.status(400).json({
                success: false,
                message:
                    "This password-reset link has expired. Please request a new one."
            });
        }

        /*
         * Fetch and lock the customer account that owns
         * this reset authorization.
         */
        const [customerRows] =
            await connection.query(`
                SELECT
                    id,
                    password,
                    status,
                    deleted_at

                FROM customers

                WHERE id = ?

                LIMIT 1

                FOR UPDATE
            `, [
                resetRecord.customer_id
            ]);

        const customer =
            customerRows[0];

        if (
            !customer ||
            customer.deleted_at
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "This password-reset link is no longer valid."
            });
        }

        if (
            customer.status ===
                "Deletion Requested"
        ) {
            await connection.rollback();

            return res.status(403).json({
                success: false,
                message:
                    "This account cannot reset its password while deletion is requested."
            });
        }

        /*
         * Do not allow the password-reset flow to simply
         * set the same password again.
         */
        const samePassword =
            await bcrypt.compare(
                new_password,
                customer.password
            );

        if (samePassword) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "New password must be different from the current password."
            });
        }

        const passwordHash =
            await bcrypt.hash(
                new_password,
                PASSWORD_SALT_ROUNDS
            );

        /*
         * Change the password and clear login lockout
         * state just like the previous reset flow.
         */
        await connection.query(`
            UPDATE customers

            SET
                password = ?,
                password_changed_at =
                    CURRENT_TIMESTAMP,
                failed_login_attempts = 0,
                account_locked_until = NULL,
                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [
            passwordHash,
            customer.id
        ]);

        /*
         * Consume this authorization permanently.
         */
        await connection.query(`
            UPDATE customer_auth_codes

            SET
                status = 'Used',
                used_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
            AND status = 'Pending'
        `, [
            resetRecord.id
        ]);

        /*
         * Cancel any other outstanding reset links for
         * the same customer.
         */
        await connection.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE customer_id = ?
            AND purpose = 'Password Reset'
            AND status = 'Pending'
            AND id <> ?
        `, [
            customer.id,
            resetRecord.id
        ]);

        /*
         * Revoke every existing customer session after
         * an account-recovery password change.
         *
         * Preserve the existing tolerant behavior in case
         * an older database does not yet contain the
         * customer_sessions table.
         */
        try {

            await connection.query(`
                UPDATE customer_sessions

                SET revoked_at =
                    CURRENT_TIMESTAMP

                WHERE customer_id = ?
                AND revoked_at IS NULL
            `, [
                customer.id
            ]);

        } catch (sessionError) {

            if (
                sessionError.code !==
                    "ER_NO_SUCH_TABLE"
            ) {
                throw sessionError;
            }
        }

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Password reset successfully. Please sign in with your new password."
        });

    } catch (error) {

        try {
            await connection.rollback();
        } catch (_) {}

        console.error(
            "Reset customer password error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to reset password."
        });

    } finally {

        connection.release();
    }
};

// =========================================
// Identifier Normalization Helpers
// =========================================

function identifyAndNormalize(value) {

    const cleanValue =
        String(value || "").trim();

    if (!cleanValue) {
        return {
            type: "",
            value: ""
        };
    }

    if (cleanValue.includes("@")) {
        return {
            type: "Email",
            value:
                cleanValue.toLowerCase()
        };
    }

    return {
        type: "Phone",
        value:
            normalizePhone(cleanValue)
    };

}

function normalizePhone(value) {

    const original =
        String(value || "").trim();

    if (!original) {
        return "";
    }

    let digits =
        original.replace(/\D/g, "");

    if (digits.startsWith("0092")) {
        digits =
            digits.substring(2);
    }

    if (digits.startsWith("92")) {
        return `+${digits}`;
    }

    if (digits.startsWith("0")) {
        return `+92${digits.substring(1)}`;
    }

    return `+${digits}`;

}

// =========================================
// Restored Customer Auth Helper Foundation
// =========================================

async function findCustomer(
    executor,
    identifierData
) {

    const column =
        identifierData.type === "Email"
            ? "email"
            : "phone";

    const [rows] =
        await executor.query(`
            SELECT
                id,
                full_name,
                email,
                phone,
                status,
                email_verified_at,
                phone_verified_at,
                deleted_at

            FROM customers

            WHERE ${column} = ?

            LIMIT 1
        `, [identifierData.value]);

    return rows.length > 0
        ? rows[0]
        : null;

}

async function getLatestPendingCode(
    connection,
    customerId,
    identifier,
    purpose
) {

    const [rows] =
        await connection.query(`
            SELECT
                id,
                code_hash,
                attempts,
                max_attempts,
                expires_at

            FROM customer_auth_codes

            WHERE customer_id = ?
            AND identifier = ?
            AND purpose = ?
            AND status = 'Pending'

            ORDER BY id DESC

            LIMIT 1

            FOR UPDATE
        `, [
            customerId,
            identifier,
            purpose
        ]);

    return rows.length > 0
        ? rows[0]
        : null;

}

async function validateCode(
    connection,
    authCode,
    submittedCode
) {

    const expired =
        new Date(authCode.expires_at) <=
        new Date();

    if (expired) {

        await connection.query(`
            UPDATE customer_auth_codes

            SET status = 'Expired'

            WHERE id = ?
        `, [authCode.id]);

        return {
            valid: false,
            statusCode: 400,
            message:
                "The code has expired. Please request a new code.",
            remainingAttempts: 0
        };

    }

    const currentAttempts =
        Number(authCode.attempts || 0);

    const maximumAttempts =
        Number(
            authCode.max_attempts ||
            MAX_OTP_ATTEMPTS
        );

    if (
        currentAttempts >=
        maximumAttempts
    ) {

        await connection.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE id = ?
        `, [authCode.id]);

        return {
            valid: false,
            statusCode: 429,
            message:
                "Maximum code attempts exceeded. Please request a new code.",
            remainingAttempts: 0
        };

    }

    const matches =
        await bcrypt.compare(
            submittedCode,
            authCode.code_hash
        );

    if (!matches) {

        const newAttempts =
            currentAttempts + 1;

        const shouldCancel =
            newAttempts >=
            maximumAttempts;

        await connection.query(`
            UPDATE customer_auth_codes

            SET
                attempts = ?,
                status = ?

            WHERE id = ?
        `, [
            newAttempts,
            shouldCancel
                ? "Cancelled"
                : "Pending",
            authCode.id
        ]);

        return {
            valid: false,
            statusCode:
                shouldCancel
                    ? 429
                    : 400,
            message:
                shouldCancel
                    ? "Maximum code attempts exceeded. Please request a new code."
                    : "The verification code is incorrect.",
            remainingAttempts:
                Math.max(
                    maximumAttempts -
                    newAttempts,
                    0
                )
        };

    }

    return {
        valid: true,
        statusCode: 200,
        message:
            "Code verified.",
        remainingAttempts:
            Math.max(
                maximumAttempts -
                currentAttempts,
                0
            )
    };

}

async function checkRequestLimit(
    customerId,
    identifier,
    purpose
) {

    const [rows] =
        await db.query(`
            SELECT
                COUNT(*) AS total_requests

            FROM customer_auth_codes

            WHERE customer_id = ?
            AND identifier = ?
            AND purpose = ?

            AND created_at >=
                DATE_SUB(
                    NOW(),
                    INTERVAL ? MINUTE
                )
        `, [
            customerId,
            identifier,
            purpose,
            REQUEST_WINDOW_MINUTES
        ]);

    return (
        Number(
            rows[0].total_requests || 0
        ) <
        MAX_REQUESTS_PER_WINDOW
    );

}

function generateNumericCode() {

    const minimum =
        10 ** (OTP_LENGTH - 1);

    const maximum =
        (10 ** OTP_LENGTH) - 1;

    return String(
        Math.floor(
            minimum +
            Math.random() *
            (maximum - minimum + 1)
        )
    );

}

function isValidCode(code) {

    return new RegExp(
        `^\\d{${OTP_LENGTH}}$`
    ).test(
        String(code || "")
    );

}

function maskIdentifier(
    identifierData
) {

    if (
        identifierData.type === "Email"
    ) {

        const [
            username,
            domain
        ] =
            identifierData
                .value
                .split("@");

        const visible =
            username.slice(0, 2);

        return (
            visible +
            "*".repeat(
                Math.max(
                    username.length - 2,
                    3
                )
            ) +
            "@" +
            domain
        );

    }

    const value =
        identifierData.value;

    return (
        "*".repeat(
            Math.max(
                value.length - 4,
                4
            )
        ) +
        value.slice(-4)
    );

}

function getRequestIp(req) {

    const forwarded =
        req.headers[
            "x-forwarded-for"
        ];

    if (forwarded) {
        return String(forwarded)
            .split(",")[0]
            .trim();
    }

    return (
        req.ip ||
        req.socket?.remoteAddress ||
        null
    );

}

// =========================================
// Check Mobile Password Recovery Status
// =========================================

exports.checkMobilePasswordRecovery = async (
    req,
    res
) => {

    res.set(
        "Cache-Control",
        "no-store"
    );

    try {

        const recoverySecret =
            String(
                req.body.recovery_secret ||
                req.body.recoverySecret ||
                ""
            ).trim();

        if (
            !isRecoverySecretValid(
                recoverySecret
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid password-recovery request."
            });
        }

        const recoverySecretHash =
            hashRecoverySecret(
                recoverySecret
            );

        const [rows] =
            await db.query(`
                SELECT
                    id,
                    customer_id,
                    status,
                    expires_at,
                    approved_at

                FROM customer_password_recovery_requests

                WHERE request_token_hash = ?

                LIMIT 1
            `, [
                recoverySecretHash
            ]);

        if (!rows.length) {

            /*
             * A syntactically valid but unknown recovery secret
             * must not reveal whether the original phone number
             * belonged to a customer account.
             */
            return res.json({
                success: true,
                status: "Pending"
            });
        }

        const recovery =
            rows[0];

        if (
            recovery.status === "Pending" &&
            new Date(recovery.expires_at).getTime() <=
                Date.now()
        ) {

            await db.query(`
                UPDATE customer_password_recovery_requests

                SET status = 'Expired'

                WHERE id = ?
                AND status = 'Pending'
            `, [
                recovery.id
            ]);

            return res.json({
                success: true,
                status: "Expired"
            });
        }

        return res.json({
            success: true,
            status:
                recovery.status
        });

    } catch (error) {

        console.error(
            "Check mobile password recovery error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to check password-recovery request."
        });
    }
};

// =========================================
// Request OTP For Approved Mobile Recovery
// =========================================

exports.requestMobilePasswordRecoveryOtp = async (
    req,
    res
) => {

    res.set(
        "Cache-Control",
        "no-store"
    );

    const identifierData =
        identifyAndNormalize(
            req.body.identifier ||
            req.body.phone ||
            ""
        );

    /*
     * Keep ineligible/nonexistent-account responses
     * neutral to avoid account enumeration.
     */
    const neutralResponse = () =>
        res.json({
            success: true,
            message:
                "If an approved password-recovery request is available, a verification code will be sent to the registered mobile number."
        });

    if (
        !identifierData.value ||
        identifierData.type !== "Phone"
    ) {
        return neutralResponse();
    }

    const connection =
        await db.getConnection();

    let code = null;
    let customer = null;

    try {

        await connection.beginTransaction();

        customer =
            await findCustomer(
                connection,
                identifierData
            );

        if (
            !customer ||
            customer.deleted_at
        ) {

            await connection.rollback();

            return neutralResponse();
        }

        const [recoveryRows] =
            await connection.query(`
                SELECT
                    id,
                    customer_id,
                    status,
                    expires_at

                FROM customer_password_recovery_requests

                WHERE customer_id = ?
                  AND status = 'Approved'
                  AND expires_at > CURRENT_TIMESTAMP

                ORDER BY id DESC

                LIMIT 1

                FOR UPDATE
            `, [
                customer.id
            ]);

        if (!recoveryRows.length) {

            await connection.rollback();

            return neutralResponse();
        }

        if (
            !isSimulationMode() &&
            !process.env.WASENDER_API_TOKEN
        ) {

            await connection.rollback();

            console.error(
                "Mobile password recovery OTP unavailable: WASENDER_API_TOKEN is not configured."
            );

            return neutralResponse();
        }

        const requestAllowed =
            await checkRequestLimit(
                customer.id,
                customer.phone,
                MOBILE_RECOVERY_OTP_PURPOSE
            );

        if (!requestAllowed) {

            await connection.rollback();

            console.warn(
                "Mobile password recovery OTP request rate-limited."
            );

            return neutralResponse();
        }

        /*
         * Password recovery OTPs use crypto.randomInt()
         * rather than Math.random().
         */
        const minimum =
            10 ** (OTP_LENGTH - 1);

        const maximumExclusive =
            10 ** OTP_LENGTH;

        code =
            String(
                crypto.randomInt(
                    minimum,
                    maximumExclusive
                )
            );

        const codeHash =
            await bcrypt.hash(
                code,
                PASSWORD_SALT_ROUNDS
            );

        await connection.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE customer_id = ?
              AND identifier = ?
              AND purpose = ?
              AND status = 'Pending'
        `, [
            customer.id,
            customer.phone,
            MOBILE_RECOVERY_OTP_PURPOSE
        ]);

        await connection.query(`
            INSERT INTO customer_auth_codes (
                customer_id,
                identifier,
                identifier_type,
                purpose,
                code_hash,
                status,
                attempts,
                max_attempts,
                expires_at,
                requested_ip
            )

            VALUES (
                ?,
                ?,
                'Phone',
                ?,
                ?,
                'Pending',
                0,
                ?,
                DATE_ADD(
                    CURRENT_TIMESTAMP,
                    INTERVAL ? MINUTE
                ),
                ?
            )
        `, [
            customer.id,
            customer.phone,
            MOBILE_RECOVERY_OTP_PURPOSE,
            codeHash,
            MAX_OTP_ATTEMPTS,
            OTP_EXPIRY_MINUTES,
            getRequestIp(req)
        ]);

        await connection.commit();

    } catch (error) {

        try {
            await connection.rollback();
        } catch (_) {}

        console.error(
            "Request mobile password recovery OTP error:",
            error
        );

        return neutralResponse();

    } finally {

        connection.release();
    }

    /*
     * Send only after the database transaction succeeds.
     * If delivery fails, invalidate the pending OTP.
     */
    try {

        await sendWhatsApp({
            to:
                customer.phone,

            message:
                `Your RUKHNAV password recovery code is ${code}. ` +
                `This code expires in ${OTP_EXPIRY_MINUTES} minutes. ` +
                "Do not share this code with anyone."
        });

    } catch (deliveryError) {

        await db.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE customer_id = ?
              AND identifier = ?
              AND purpose = ?
              AND status = 'Pending'
        `, [
            customer.id,
            customer.phone,
            MOBILE_RECOVERY_OTP_PURPOSE
        ]);

        console.error(
            "Mobile password recovery OTP delivery error:",
            deliveryError
        );

        return neutralResponse();
    }

    const response = {
        success: true,
        otpRequired: true,
        expiresInMinutes:
            OTP_EXPIRY_MINUTES,
        message:
            "A verification code has been sent to your registered WhatsApp number."
    };

    if (
        process.env.NODE_ENV !==
        "production"
    ) {
        response.developmentCode =
            code;
    }

    return res.json(response);
};


// =========================================
// Verify OTP For Approved Mobile Recovery
// =========================================

exports.verifyMobilePasswordRecoveryOtp = async (
    req,
    res
) => {

    res.set(
        "Cache-Control",
        "no-store"
    );

    const identifierData =
        identifyAndNormalize(
            req.body.identifier ||
            req.body.phone ||
            ""
        );

    const submittedCode =
        String(
            req.body.code ||
            req.body.otp ||
            ""
        ).trim();

    if (
        !identifierData.value ||
        identifierData.type !== "Phone" ||
        !isValidCode(submittedCode)
    ) {

        return res.status(400).json({
            success: false,
            message:
                "A valid mobile number and six-digit verification code are required."
        });
    }

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const customer =
            await findCustomer(
                connection,
                identifierData
            );

        if (
            !customer ||
            customer.deleted_at
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "The verification code is invalid or expired."
            });
        }

        const [recoveryRows] =
            await connection.query(`
                SELECT
                    id,
                    customer_id,
                    status,
                    expires_at

                FROM customer_password_recovery_requests

                WHERE customer_id = ?
                  AND status = 'Approved'
                  AND expires_at > CURRENT_TIMESTAMP

                ORDER BY id DESC

                LIMIT 1

                FOR UPDATE
            `, [
                customer.id
            ]);

        if (!recoveryRows.length) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "The verification code is invalid or expired."
            });
        }

        const authCode =
            await getLatestPendingCode(
                connection,
                customer.id,
                customer.phone,
                MOBILE_RECOVERY_OTP_PURPOSE
            );

        if (!authCode) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "The verification code is invalid or expired."
            });
        }

        const validation =
            await validateCode(
                connection,
                authCode,
                submittedCode
            );

        if (!validation.valid) {

            await connection.commit();

            return res
                .status(
                    validation.statusCode
                )
                .json({
                    success: false,
                    message:
                        validation.message,
                    remainingAttempts:
                        validation.remainingAttempts
                });
        }

        /*
         * OTP has now proved possession of the
         * registered mobile number.
         */

        const rawResetToken =
            crypto
                .randomBytes(
                    PASSWORD_RESET_TOKEN_BYTES
                )
                .toString("hex");

        const resetTokenHash =
            crypto
                .createHash("sha256")
                .update(rawResetToken)
                .digest("hex");

        await connection.query(`
            UPDATE customer_auth_codes

            SET
                status = 'Used',
                used_at = CURRENT_TIMESTAMP

            WHERE id = ?
              AND status = 'Pending'
        `, [
            authCode.id
        ]);

        /*
         * Only one active Password Reset authorization
         * may remain for this customer.
         */
        await connection.query(`
            UPDATE customer_auth_codes

            SET status = 'Cancelled'

            WHERE customer_id = ?
              AND purpose = 'Password Reset'
              AND status = 'Pending'
        `, [
            customer.id
        ]);

        await connection.query(`
            INSERT INTO customer_auth_codes (
                customer_id,
                identifier,
                identifier_type,
                purpose,
                code_hash,
                status,
                attempts,
                max_attempts,
                expires_at,
                requested_ip
            )

            VALUES (
                ?,
                ?,
                'Phone',
                'Password Reset',
                ?,
                'Pending',
                0,
                1,
                DATE_ADD(
                    CURRENT_TIMESTAMP,
                    INTERVAL ? MINUTE
                ),
                ?
            )
        `, [
            customer.id,
            customer.phone,
            resetTokenHash,
            MOBILE_RECOVERY_RESET_TOKEN_MINUTES,
            getRequestIp(req)
        ]);

        /*
         * Recovery authorization is single-use.
         */
        const [recoveryUpdate] =
            await connection.query(`
                UPDATE customer_password_recovery_requests

                SET
                    status = 'Used',
                    used_at = CURRENT_TIMESTAMP

                WHERE id = ?
                  AND status = 'Approved'
            `, [
                recoveryRows[0].id
            ]);

        if (
            Number(
                recoveryUpdate.affectedRows ||
                0
            ) !== 1
        ) {

            throw new Error(
                "Approved recovery could not be consumed."
            );
        }

        await connection.commit();

        return res.json({
            success: true,
            verified: true,
            status: "Used",
            resetToken:
                rawResetToken,
            expiresInMinutes:
                MOBILE_RECOVERY_RESET_TOKEN_MINUTES
        });

    } catch (error) {

        try {
            await connection.rollback();
        } catch (_) {}

        console.error(
            "Verify mobile password recovery OTP error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to verify password-recovery code."
        });

    } finally {

        connection.release();
    }
};
