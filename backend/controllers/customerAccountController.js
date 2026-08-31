"use strict";

const db = require("../config/db");
const bcrypt = require("bcrypt");
const {
    shouldEnforceCustomerVerification
} = require(
    "../utils/customerVerificationMode"
);

// =========================================
// Configuration
// =========================================

const DELETION_GRACE_DAYS = 30;

const allowedDeletionReasons = [
    "No Longer Needed",
    "Privacy Concerns",
    "Too Many Messages",
    "Created Another Account",
    "Difficult to Use",
    "Other"
];

// =========================================
// Get Account-Deletion Status
// Protected Route
// =========================================

exports.getDeletionStatus = async (
    req,
    res
) => {

    try {

        const customerId =
            Number(req.user.id);

        const [customerRows] =
            await db.query(`
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    status,
                    deletion_requested_at,
                    deleted_at

                FROM customers

                WHERE id = ?
            `, [customerId]);

        if (customerRows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });
        }

        const customer =
            customerRows[0];

        const [requestRows] =
            await db.query(`
                SELECT
                    id,
                    reason,
                    additional_details,
                    status,
                    requested_at,
                    scheduled_for,
                    cancelled_at,
                    completed_at

                FROM customer_account_deletion_requests

                WHERE customer_id = ?

                ORDER BY id DESC

                LIMIT 1
            `, [customerId]);

        const deletionRequest =
            requestRows.length > 0
                ? requestRows[0]
                : null;

        let remainingDays = 0;

        if (
            deletionRequest &&
            deletionRequest.status ===
                "Pending"
        ) {

            const scheduledDate =
                new Date(
                    deletionRequest
                        .scheduled_for
                );

            const currentDate =
                new Date();

            const difference =
                scheduledDate.getTime() -
                currentDate.getTime();

            remainingDays =
                Math.max(
                    Math.ceil(
                        difference /
                        (
                            1000 *
                            60 *
                            60 *
                            24
                        )
                    ),
                    0
                );

        }

        return res.json({
            success: true,

            account: {
                id:
                    customer.id,

                status:
                    customer.status,

                deletionRequested:
                    customer.status ===
                    "Deletion Requested",

                deletionRequestedAt:
                    customer
                        .deletion_requested_at,

                deletedAt:
                    customer.deleted_at
            },

            deletionRequest,

            remainingDays
        });

    } catch (error) {

        console.error(
            "Get deletion status error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load account-deletion status.",
            error: error.message
        });

    }

};

// =========================================
// Request Account Deletion
// Protected Route
// =========================================

exports.requestAccountDeletion = async (
    req,
    res
) => {

    const connection =
        await db.getConnection();

    try {

        await connection.beginTransaction();

        const customerId =
            Number(req.user.id);

        const {
            password,
            reason,
            additional_details
        } = req.body;

        if (
            typeof password !== "string" ||
            !password
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Your current password is required."
            });

        }

        if (
            !allowedDeletionReasons.includes(
                reason
            )
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Please select a valid account-deletion reason."
            });

        }

        if (
            reason === "Other" &&
            !String(
                additional_details || ""
            ).trim()
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Please provide additional details for the selected reason."
            });

        }

        const [customerRows] =
            await connection.query(`
                SELECT
                    id,
                    full_name,
                    email,
                    phone,
                    password,
                    status,
                    deleted_at

                FROM customers

                WHERE id = ?

                FOR UPDATE
            `, [customerId]);

        if (customerRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });

        }

        const customer =
            customerRows[0];

        if (customer.deleted_at) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "This account has already been deleted."
            });

        }

        if (
            customer.status ===
            "Deletion Requested"
        ) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "Account deletion has already been requested."
            });

        }

        const passwordMatches =
            await bcrypt.compare(
                password,
                customer.password
            );

        if (!passwordMatches) {

            await connection.rollback();

            return res.status(401).json({
                success: false,
                message:
                    "The password you entered is incorrect."
            });

        }

        const [pendingRows] =
            await connection.query(`
                SELECT id

                FROM customer_account_deletion_requests

                WHERE customer_id = ?
                AND status = 'Pending'

                LIMIT 1

                FOR UPDATE
            `, [customerId]);

        if (pendingRows.length > 0) {

            await connection.rollback();

            return res.status(409).json({
                success: false,
                message:
                    "A pending account-deletion request already exists."
            });

        }

        const [result] =
            await connection.query(`
                INSERT INTO customer_account_deletion_requests (
                    customer_id,
                    reason,
                    additional_details,
                    status,
                    requested_at,
                    scheduled_for
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'Pending',
                    CURRENT_TIMESTAMP,
                    DATE_ADD(
                        CURRENT_TIMESTAMP,
                        INTERVAL ? DAY
                    )
                )
            `, [
                customerId,
                reason,
                String(
                    additional_details || ""
                ).trim() || null,
                DELETION_GRACE_DAYS
            ]);

        await connection.query(`
            UPDATE customers

            SET
                status =
                    'Deletion Requested',

                deletion_requested_at =
                    CURRENT_TIMESTAMP,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [customerId]);

        // Revoke all stored login sessions.

        await connection.query(`
            UPDATE customer_sessions

            SET revoked_at =
                CURRENT_TIMESTAMP

            WHERE customer_id = ?
            AND revoked_at IS NULL
        `, [customerId]);

        await connection.commit();

        const [createdRows] =
            await db.query(`
                SELECT
                    id,
                    reason,
                    status,
                    requested_at,
                    scheduled_for

                FROM customer_account_deletion_requests

                WHERE id = ?
            `, [result.insertId]);

        return res.status(201).json({
            success: true,

            message:
                `Account deletion requested. You have ${DELETION_GRACE_DAYS} days to cancel this request.`,

            deletionRequest:
                createdRows[0],

            logoutRequired: true
        });

    } catch (error) {

        await connection.rollback();

        console.error(
            "Request account deletion error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to request account deletion.",
            error: error.message
        });

    } finally {

        connection.release();

    }

};

// =========================================
// Cancel Account Deletion
// Public Recovery Route
// =========================================

exports.cancelAccountDeletion = async (
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
            password
        } = req.body;

        const identifierData =
            identifyAndNormalize(
                identifier ||
                email ||
                phone
            );

        if (!identifierData.value) {

            await connection.rollback();

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

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Password is required."
            });

        }

        const identifierColumn =
            identifierData.type === "Email"
                ? "email"
                : "phone";

        const [customerRows] =
            await connection.query(`
                SELECT
                    id,
                    password,
                    status,
                    deleted_at

                FROM customers

                WHERE ${identifierColumn} = ?

                LIMIT 1

                FOR UPDATE
            `, [identifierData.value]);

        if (customerRows.length === 0) {

            await connection.rollback();

            return res.status(401).json({
                success: false,
                message:
                    "Invalid account details or password."
            });

        }

        const customer =
            customerRows[0];

        if (customer.deleted_at) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "The account-deletion period has already ended."
            });

        }

        const passwordMatches =
            await bcrypt.compare(
                password,
                customer.password
            );

        if (!passwordMatches) {

            await connection.rollback();

            return res.status(401).json({
                success: false,
                message:
                    "Invalid account details or password."
            });

        }

        const [requestRows] =
            await connection.query(`
                SELECT
                    id,
                    scheduled_for

                FROM customer_account_deletion_requests

                WHERE customer_id = ?
                AND status = 'Pending'

                ORDER BY id DESC

                LIMIT 1

                FOR UPDATE
            `, [customer.id]);

        if (requestRows.length === 0) {

            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "No pending account-deletion request was found."
            });

        }

        const deletionRequest =
            requestRows[0];

        if (
            new Date(
                deletionRequest
                    .scheduled_for
            ) <= new Date()
        ) {

            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "The account-deletion cancellation period has ended."
            });

        }

        await connection.query(`
            UPDATE customer_account_deletion_requests

            SET
                status = 'Cancelled',

                cancelled_at =
                    CURRENT_TIMESTAMP,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [deletionRequest.id]);

        await connection.query(`
            UPDATE customers

            SET
                status = 'Active',

                deletion_requested_at =
                    NULL,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [customer.id]);

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Account-deletion request cancelled successfully. You can now log in again."
        });

    } catch (error) {

        await connection.rollback();

        console.error(
            "Cancel account deletion error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to cancel account deletion.",
            error: error.message
        });

    } finally {

        connection.release();

    }

};

// =========================================
// Update Reminder Preferences
// Protected Route
// =========================================

exports.updateReminderPreferences = async (
    req,
    res
) => {

    try {

        const customerId =
            Number(req.user.id);

        const {
            email_reminders_enabled,
            whatsapp_reminders_enabled,
            sms_reminders_enabled
        } = req.body;

        const emailEnabled =
            toBooleanNumber(
                email_reminders_enabled
            );

        const whatsappEnabled =
            toBooleanNumber(
                whatsapp_reminders_enabled
            );

        const smsEnabled =
            toBooleanNumber(
                sms_reminders_enabled
            );

        const [customerRows] =
            await db.query(`
                SELECT
                    id,
                    email,
                    phone,
                    email_verified_at,
                    phone_verified_at

                FROM customers

                WHERE id = ?
                AND deleted_at IS NULL
            `, [customerId]);

        if (customerRows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Customer account was not found."
            });
        }

        const customer =
            customerRows[0];

        if (
            emailEnabled &&
            (
                !customer.email ||
                !customer.email_verified_at
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Verify your email before enabling email reminders."
            });
        }

        if (
            (
                whatsappEnabled ||
                smsEnabled
            ) &&
            (
                !customer.phone ||
                !customer.phone_verified_at
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Verify your phone number before enabling WhatsApp or SMS reminders."
            });
        }

        await db.query(`
            UPDATE customers

            SET
                email_reminders_enabled = ?,

                whatsapp_reminders_enabled = ?,

                sms_reminders_enabled = ?,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?
        `, [
            emailEnabled,
            whatsappEnabled,
            smsEnabled,
            customerId
        ]);

        return res.json({
            success: true,

            message:
                "Reminder preferences updated successfully.",

            preferences: {
                email:
                    Boolean(emailEnabled),

                whatsapp:
                    Boolean(
                        whatsappEnabled
                    ),

                sms:
                    Boolean(smsEnabled)
            }
        });

    } catch (error) {

        console.error(
            "Update reminder preferences error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to update reminder preferences.",
            error: error.message
        });

    }

};

// =========================================
// Helpers
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

    let digits =
        String(value || "")
            .replace(/\D/g, "");

    if (!digits) {
        return "";
    }

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

function toBooleanNumber(value) {

    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    )
        ? 1
        : 0;

}