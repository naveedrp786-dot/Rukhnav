"use strict";

const crypto = require("crypto");
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const notificationHooks =
    require("../services/notificationHooks");

const {
    shouldEnforceCustomerVerification,
    getCustomerVerificationMode
} = require(
    "../utils/customerVerificationMode"
);
// =========================================
// Configuration
// =========================================

const PASSWORD_SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MINUTES = 15;

// =========================================
// Customer Registration
// =========================================

exports.register = async (req, res) => {

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const {
            first_name,
            last_name,
            full_name,
            email,
            phone,
            password,
            referral_code,
            accept_terms,
            accept_privacy,
            accept_marketing,
            terms_version,
            privacy_version
        } = req.body;

        const cleanFirstName =
            cleanText(first_name);

        const cleanLastName =
            cleanText(last_name);

        const cleanFullName =
            cleanText(full_name) ||
            [
                cleanFirstName,
                cleanLastName
            ]
                .filter(Boolean)
                .join(" ");

        const cleanEmail =
            normalizeEmail(email);

        const cleanPhone =
            normalizePhone(phone);

        const cleanReferralCode =
            cleanText(referral_code)
                .toUpperCase();

        const termsAccepted =
            accept_terms === true ||
            accept_terms === 1 ||
            accept_terms === "1" ||
            accept_terms === "true";

        const privacyAccepted =
            accept_privacy === true ||
            accept_privacy === 1 ||
            accept_privacy === "1" ||
            accept_privacy === "true";

        const marketingAccepted =
            accept_marketing === true ||
            accept_marketing === 1 ||
            accept_marketing === "1" ||
            accept_marketing === "true";

        const cleanTermsVersion =
            cleanText(terms_version) ||
            "2026-08-05";

        const cleanPrivacyVersion =
            cleanText(privacy_version) ||
            "2026-08-05";

        const consentIp =
            String(
                req.headers["x-forwarded-for"] ||
                req.socket?.remoteAddress ||
                req.ip ||
                ""
            )
                .split(",")[0]
                .trim()
                .slice(0, 64) ||
            null;

        const consentUserAgent =
            cleanText(
                req.headers["user-agent"]
            )
                .slice(0, 500) ||
            null;

        // =================================
        // Validation
        // =================================

        if (
            !termsAccepted ||
            !privacyAccepted
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "You must accept the Terms & Conditions and Privacy Policy before creating an account."
            });
        }

        if (!cleanFullName) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Customer name is required."
            });

        }

        if (!cleanEmail && !cleanPhone) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "An email address or phone number is required."
            });

        }

        if (
            cleanEmail &&
            !isValidEmail(cleanEmail)
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid email address."
            });

        }

        if (
            cleanPhone &&
            !isValidPhone(cleanPhone)
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid phone number."
            });

        }

        if (
            typeof password !== "string" ||
            password.length < 8
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Password must contain at least 8 characters."
            });

        }

        // =================================
        // Check Duplicate Email or Phone
        // =================================

        const [duplicateRows] =
            await connection.query(`
                SELECT
                    id,
                    email,
                    phone

                FROM customers

                WHERE
                    (
                        ? IS NOT NULL
                        AND email = ?
                    )

                    OR

                    (
                        ? IS NOT NULL
                        AND phone = ?
                    )

                LIMIT 1
            `, [
                cleanEmail,
                cleanEmail,
                cleanPhone,
                cleanPhone
            ]);

        if (duplicateRows.length > 0) {

            await connection.rollback();

            const existing =
                duplicateRows[0];

            let message =
                "An account already exists with these details.";

            if (
                cleanEmail &&
                existing.email === cleanEmail
            ) {
                message =
                    "This email address is already registered.";
            } else if (
                cleanPhone &&
                existing.phone === cleanPhone
            ) {
                message =
                    "This phone number is already registered.";
            }

            return res.status(409).json({
                success: false,
                message
            });

        }

        // =================================
        // Validate Referral Code
        // =================================

        let referrerCustomer = null;

        if (cleanReferralCode) {

            const [referrerRows] =
                await connection.query(`
                    SELECT
                        id,
                        full_name,
                        referral_code,
                        status

                    FROM customers

                    WHERE referral_code = ?

                    LIMIT 1
                `, [cleanReferralCode]);

            if (referrerRows.length === 0) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "The referral code is invalid."
                });

            }

            referrerCustomer =
                referrerRows[0];

            if (
                referrerCustomer.status !==
                "Active"
            ) {

                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "This referral code is not currently available."
                });

            }

        }

        // =================================
        // Hash Password
        // =================================

        const hashedPassword =
            await bcrypt.hash(
                password,
                PASSWORD_SALT_ROUNDS
            );

        // =================================
        // Create Customer
        // =================================

        const [result] =
            await connection.query(`
                INSERT INTO customers (
                    first_name,
                    last_name,
                    full_name,
                    email,
                    phone,
                    password,
                    address,
                    city,
                    country,
                    postal_code,
                    status,
                    referred_by_customer_id,
                    password_changed_at,
                    accepted_terms,
                    accepted_terms_at,
                    terms_version,
                    accepted_privacy,
                    accepted_privacy_at,
                    privacy_version,
                    accepted_marketing,
                    accepted_marketing_at,
                    consent_ip,
                    consent_user_agent
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    NULL,
                    NULL,
                    'Pakistan',
                    NULL,
                    'Pending Verification',
                    ?,
                    CURRENT_TIMESTAMP,
                    1,
                    CURRENT_TIMESTAMP,
                    ?,
                    1,
                    CURRENT_TIMESTAMP,
                    ?,
                    ?,
                    CASE
                        WHEN ? = 1
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END,
                    ?,
                    ?
                )
            `, [
                cleanFirstName || null,
                cleanLastName || null,
                cleanFullName,
                cleanEmail || null,
                cleanPhone || null,
                hashedPassword,
                referrerCustomer
                    ? referrerCustomer.id
                    : null,
                cleanTermsVersion,
                cleanPrivacyVersion,
                Number(marketingAccepted),
                Number(marketingAccepted),
                consentIp,
                consentUserAgent
            ]);

        const customerId =
            result.insertId;

        // =================================
        // Generate Customer Referral Code
        // =================================

        const generatedReferralCode =
            generateReferralCode(
                customerId
            );

        await connection.query(`
            UPDATE customers

            SET referral_code = ?

            WHERE id = ?
        `, [
            generatedReferralCode,
            customerId
        ]);

        // =================================
        // Save Referral Relationship
        // =================================

        if (referrerCustomer) {

            await connection.query(`
                INSERT INTO customer_referrals (
                    referral_code_used,
                    referrer_customer_id,
                    referred_customer_id,
                    status
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'Registered'
                )
            `, [
                cleanReferralCode,
                referrerCustomer.id,
                customerId
            ]);

        }

        await connection.commit();

        // =================================
        // Initialise Customer Loyalty Account
        // =================================

        try {

            await db.query(
                `
                INSERT IGNORE INTO customer_rewards (
                    customer_id
                )
                VALUES (?)
                `,
                [customerId]
            );

        } catch (rewardError) {

            console.error(
                "Loyalty account initialisation error:",
                rewardError
            );

        }


        notificationHooks
            .customerRegistered({
                customerId,
                fullName:
                    cleanFullName,
                email:
                    cleanEmail || null,
                phone:
                    cleanPhone || null
            });

        return res.status(201).json({
            success: true,

            message:
                "Registration successful. Please verify your account.",

            verificationRequired: true,

            verificationOptions: {
                email:
                    Boolean(cleanEmail),

                phone:
                    Boolean(cleanPhone)
            },

            customer: {
                id: customerId,
                full_name:
                    cleanFullName,
                email:
                    cleanEmail || null,
                phone:
                    cleanPhone || null,
                referral_code:
                    generatedReferralCode,
                status:
                    "Pending Verification"
            }
        });

    } catch (error) {

        await connection.rollback();

        console.error(
            "Customer registration error:",
            error
        );

        if (
            error.code ===
            "ER_DUP_ENTRY"
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "An account already exists with this email, phone number, or referral code."
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Unable to register customer.",
            error: error.message
        });

    } finally {

        connection.release();

    }

};

// =========================================
// Customer Login
// =========================================

exports.login = async (req, res) => {

    try {

        const {
            identifier,
            email,
            phone,
            password
        } = req.body;

        const suppliedIdentifier =
            cleanText(
                identifier ||
                email ||
                phone
            );

        if (!suppliedIdentifier) {
            return res.status(400).json({
                success: false,
                message:
                    "Email address or phone number is required."
            });
        }

        if (
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Password is required."
            });
        }

        const isEmailLogin =
            suppliedIdentifier.includes("@");

        const cleanIdentifier =
            isEmailLogin
                ? normalizeEmail(
                    suppliedIdentifier
                )
                : normalizePhone(
                    suppliedIdentifier
                );

        const [customerRows] =
            await db.query(`
                SELECT
                    id,
                    first_name,
                    last_name,
                    full_name,
                    email,
                    phone,
                    password,
                    referral_code,
                    status,
                    email_verified_at,
                    phone_verified_at,
                    failed_login_attempts,
                    account_locked_until,
                    deleted_at

                FROM customers

                WHERE ${
                    isEmailLogin
                        ? "email"
                        : "phone"
                } = ?

                LIMIT 1
            `, [cleanIdentifier]);

        // Do not reveal whether an account exists.

        if (customerRows.length === 0) {
            return res.status(401).json({
                success: false,
                message:
                    "Invalid email, phone number, or password."
            });
        }

        const customer =
            customerRows[0];

        // =================================
        // Deleted Account Check
        // =================================

        if (customer.deleted_at) {
            return res.status(401).json({
                success: false,
                message:
                    "This account is no longer available."
            });
        }

        // =================================
        // Temporary Account Lock
        // =================================

        if (
            customer.account_locked_until &&
            new Date(
                customer.account_locked_until
            ) > new Date()
        ) {
            return res.status(423).json({
                success: false,
                message:
                    "Your account is temporarily locked because of multiple failed login attempts. Please try again later."
            });
        }

        // =================================
        // Check Password
        // =================================

        const passwordMatches =
            await bcrypt.compare(
                password,
                customer.password
            );

        if (!passwordMatches) {

            const failedAttempts =
                Number(
                    customer
                        .failed_login_attempts || 0
                ) + 1;

            if (
                failedAttempts >=
                MAX_LOGIN_ATTEMPTS
            ) {

                await db.query(`
                    UPDATE customers

                    SET
                        failed_login_attempts = 0,

                        account_locked_until =
                            DATE_ADD(
                                NOW(),
                                INTERVAL ? MINUTE
                            )

                    WHERE id = ?
                `, [
                    ACCOUNT_LOCK_MINUTES,
                    customer.id
                ]);

                return res.status(423).json({
                    success: false,
                    message:
                        `Your account has been locked for ${ACCOUNT_LOCK_MINUTES} minutes.`
                });

            }

            await db.query(`
                UPDATE customers

                SET failed_login_attempts = ?

                WHERE id = ?
            `, [
                failedAttempts,
                customer.id
            ]);

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email, phone number, or password.",
                remainingAttempts:
                    MAX_LOGIN_ATTEMPTS -
                    failedAttempts
            });

        }

        // =================================
// Check Login-Identifier Verification
// =================================

const identifierVerified =
    isEmailLogin
        ? Boolean(
            customer.email_verified_at
        )
        : Boolean(
            customer.phone_verified_at
        );

if (
    shouldEnforceCustomerVerification() &&
    !identifierVerified
) {
    return res.status(403).json({
        success: false,
        verificationRequired: true,

        identifierType:
            isEmailLogin
                ? "Email"
                : "Phone",

        verificationMethod:
            isEmailLogin
                ? "email"
                : "phone",

        identifier:
            isEmailLogin
                ? customer.email
                : customer.phone,

        message:
            isEmailLogin
                ? "Please verify your email address before logging in."
                : "Please verify your phone number before logging in."
    });
}

        // =================================
        // Check Account Status
        // =================================

        if (
    shouldEnforceCustomerVerification() &&
    customer.status ===
    "Pending Verification"
) {
    return res.status(403).json({
        success: false,
        verificationRequired: true,
        message:
            "Please verify your account before logging in."
    });
}

        if (
            customer.status === "Inactive" ||
            customer.status === "Suspended"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "This account is currently unavailable. Please contact support."
            });
        }

        if (
            customer.status ===
            "Deletion Requested"
        ) {
            return res.status(403).json({
                success: false,
                deletionRequested: true,
                message:
                    "Account deletion has been requested. Cancel the deletion request to continue."
            });
        }

        // =================================
        // Successful Login
        // =================================

        await db.query(`
            UPDATE customers

            SET
                failed_login_attempts = 0,
                account_locked_until = NULL,
                last_login_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [customer.id]);

        const jwtSecret =
            process.env.JWT_SECRET;

        if (!jwtSecret) {
            throw new Error(
                "JWT_SECRET is missing from the environment configuration."
            );
        }

        const token =
            jwt.sign(
                {
                    id:
                        customer.id,

                    email:
                        customer.email,

                    phone:
                        customer.phone,

                    accountType:
                        "customer"
                },
                jwtSecret,
                {
                    expiresIn: "24h"
                }
            );

        // =================================
        // Record Customer Session
        // =================================

        try {
            const sessionHash =
                crypto
                    .createHash("sha256")
                    .update(token)
                    .digest("hex");

            const userAgent =
                String(
                    req.headers[
                        "user-agent"
                    ] || ""
                ).slice(0, 1000);

            const ipAddress =
                String(
                    req.ip ||
                    req.socket?.remoteAddress ||
                    ""
                ).slice(0, 45) || null;

            const deviceName =
                /mobile|android|iphone|ipad/i
                    .test(userAgent)
                    ? "Mobile Device"
                    : "Desktop Browser";

            await db.query(
                `
                INSERT INTO customer_sessions
                (
                    customer_id,
                    refresh_token_hash,
                    device_name,
                    user_agent,
                    ip_address,
                    last_used_at,
                    expires_at
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    DATE_ADD(
                        CURRENT_TIMESTAMP,
                        INTERVAL 24 HOUR
                    )
                )
                `,
                [
                    customer.id,
                    sessionHash,
                    deviceName,
                    userAgent || null,
                    ipAddress
                ]
            );
        } catch (sessionError) {
            // Session tracking must never prevent
            // a successful customer login.
            console.error(
                "Customer session tracking error:",
                sessionError
            );
        }

        return res.json({
            success: true,
            message:
                "Login successful.",
            token,

            customer: {
                id:
                    customer.id,

                first_name:
                    customer.first_name,

                last_name:
                    customer.last_name,

                full_name:
                    customer.full_name,

                email:
                    customer.email,

                phone:
                    customer.phone,

                referral_code:
                    customer.referral_code,

                status:
                    customer.status
            }
        });

    } catch (error) {

        console.error(
            "Customer login error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to log in.",
            error: error.message
        });

    }

};
// =========================================
// Customer Profile
// =========================================

exports.profile = async (req, res) => {

    try {

        const [customerRows] =
            await db.query(`
                SELECT
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.full_name,
                    c.email,
                    c.phone,
                    c.address,
                    c.city,
                    c.country,
                    c.postal_code,
                    c.status,
                    c.referral_code,
                    c.referred_by_customer_id,
                    c.email_verified_at,
                    c.phone_verified_at,
                    c.email_reminders_enabled,
                    c.whatsapp_reminders_enabled,
                    c.sms_reminders_enabled,
                    c.last_login_at,
                    c.created_at,
                    c.updated_at,

                    referrer.full_name
                        AS referred_by_name,

                    referrer.referral_code
                        AS referrer_code

                FROM customers c

                LEFT JOIN customers referrer
                    ON c.referred_by_customer_id =
                       referrer.id

                WHERE c.id = ?
                AND c.deleted_at IS NULL
            `, [req.user.id]);

        if (customerRows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer was not found."
            });
        }

        const [referralRows] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_referrals,

                    COUNT(
                        CASE
                            WHEN status = 'Qualified'
                            THEN 1
                        END
                    ) AS qualified_referrals,

                    COUNT(
                        CASE
                            WHEN status = 'Rewarded'
                            THEN 1
                        END
                    ) AS rewarded_referrals,

                    COALESCE(
                        SUM(
                            referrer_reward_points
                        ),
                        0
                    ) AS referral_points

                FROM customer_referrals

                WHERE referrer_customer_id = ?
            `, [req.user.id]);

        const customer =
            customerRows[0];

        return res.json({
            success: true,

            customer,

            referralSummary: {
                totalReferrals:
                    Number(
                        referralRows[0]
                            .total_referrals || 0
                    ),

                qualifiedReferrals:
                    Number(
                        referralRows[0]
                            .qualified_referrals || 0
                    ),

                rewardedReferrals:
                    Number(
                        referralRows[0]
                            .rewarded_referrals || 0
                    ),

                referralPoints:
                    Number(
                        referralRows[0]
                            .referral_points || 0
                    )
            }
        });

    } catch (error) {

        console.error(
            "Customer profile error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load customer profile.",
            error: error.message
        });

    }

};


// =========================================
// Customer Referral History
// =========================================

exports.getMyReferrals = async (req, res) => {

    try {

        const [rows] =
            await db.query(`
                SELECT
                    r.id,
                    r.referred_customer_id,

                    referred.full_name
                        AS referred_name,

                    referred.status
                        AS referred_account_status,

                    r.status
                        AS referral_status,

                    r.referral_code_used,

                    r.referrer_reward_points,

                    r.created_at

                FROM customer_referrals r

                LEFT JOIN customers referred
                    ON referred.id =
                       r.referred_customer_id

                WHERE
                    r.referrer_customer_id = ?

                ORDER BY
                    r.created_at DESC,
                    r.id DESC
            `, [req.user.id]);

        return res.json({
            success: true,

            referrals:
                rows.map(row => ({
                    id:
                        row.id,

                    referredCustomerId:
                        row.referred_customer_id,

                    referredName:
                        row.referred_name ||
                        "RUKHNAV Customer",

                    referredAccountStatus:
                        row.referred_account_status ||
                        "Unknown",

                    referralStatus:
                        row.referral_status ||
                        "Registered",

                    referralCodeUsed:
                        row.referral_code_used ||
                        null,

                    rewardPoints:
                        Number(
                            row.referrer_reward_points ||
                            0
                        ),

                    createdAt:
                        row.created_at
                }))
        });

    } catch (error) {

        console.error(
            "Customer referral history error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load your referral history."
        });

    }

};

// =========================================
// Check Referral Code
// =========================================

exports.checkReferralCode = async (
    req,
    res
) => {

    try {

        const referralCode =
            cleanText(
                req.params.code
            ).toUpperCase();

        if (!referralCode) {
            return res.status(400).json({
                success: false,
                message:
                    "Referral code is required."
            });
        }

        const [rows] =
            await db.query(`
                SELECT
                    id,
                    full_name,
                    referral_code

                FROM customers

                WHERE referral_code = ?
                AND status = 'Active'
                AND deleted_at IS NULL

                LIMIT 1
            `, [referralCode]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                valid: false,
                message:
                    "Referral code is invalid."
            });
        }

        return res.json({
            success: true,
            valid: true,
            message:
                "Referral code is valid.",
            referrer: {
                firstName:
                    getFirstName(
                        rows[0].full_name
                    )
            }
        });

    } catch (error) {

        console.error(
            "Referral check error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to check referral code.",
            error: error.message
        });

    }

};

// =========================================
// Helpers
// =========================================

function cleanText(value) {

    return String(value || "")
        .trim();

}

function normalizeEmail(value) {

    return cleanText(value)
        .toLowerCase();

}

function normalizePhone(value) {

    const original =
        cleanText(value);

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

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}

function isValidPhone(phone) {

    return /^\+[1-9]\d{9,14}$/
        .test(phone);

}

function generateReferralCode(
    customerId
) {

    const randomPart =
        crypto
            .randomBytes(2)
            .toString("hex")
            .toUpperCase();

    return (
        `RUKH-${String(customerId)
            .padStart(6, "0")}-` +
        randomPart
    );

}

function getFirstName(fullName) {

    return cleanText(fullName)
        .split(/\s+/)[0] || "Customer";

}