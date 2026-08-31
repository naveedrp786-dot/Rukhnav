"use strict";

const fs = require("fs/promises");
const path = require("path");
const db = require("../config/db");

const {
    shouldEnforceCustomerVerification
} = require("../utils/customerVerificationMode");

function cleanText(value, max = 500) {
    return typeof value === "string"
        ? value.trim().slice(0, max)
        : "";
}

function normalizeEmail(value) {
    const email = cleanText(value, 254).toLowerCase();
    return email || null;
}

function normalizePhone(value) {
    let phone = cleanText(value, 30).replace(/[\s()-]/g, "");
    if (!phone) return null;
    if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
    if (/^03\d{9}$/.test(phone)) phone = `+92${phone.slice(1)}`;
    if (/^3\d{9}$/.test(phone)) phone = `+92${phone}`;
    if (/^92\d{10}$/.test(phone)) phone = `+${phone}`;
    return phone;
}

function toBooleanNumber(value) {
    return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function publicImageUrl(req, image) {
    if (!image) return null;
    if (/^https?:\/\//i.test(image)) return image;
    const base = `${req.protocol}://${req.get("host")}`;
    return `${base}/${String(image).replace(/^\/+/, "")}`;
}

function withCacheBust(url, version) {
    if (!url) return null;
    return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || Date.now())}`;
}

async function safeDeleteUpload(relativePath) {
    if (!relativePath || /^https?:\/\//i.test(relativePath)) return;
    const absolute = path.resolve(__dirname, "..", String(relativePath).replace(/^\/+/, ""));
    const uploadsRoot = path.resolve(__dirname, "..", "uploads");
    if (!absolute.startsWith(uploadsRoot + path.sep)) return;
    try { await fs.unlink(absolute); } catch (error) {
        if (error.code !== "ENOENT") {
            console.warn("Unable to remove old profile picture:", error.message);
        }
    }
}

async function loadProfile(customerId) {
    const [rows] = await db.query(`
        SELECT
            c.id,
            c.full_name,
            c.email,
            c.phone,
            c.status,
            c.referral_code,
            c.email_verified_at,
            c.phone_verified_at,
            c.email_reminders_enabled,
            c.whatsapp_reminders_enabled,
            c.sms_reminders_enabled,
            p.profile_picture,
            p.gender,
            p.date_of_birth,
            p.skin_type,
            p.hair_type,
            COALESCE(p.address, c.address) AS address,
            COALESCE(p.city, c.city) AS city,
            COALESCE(p.country, c.country, 'Pakistan') AS country,
            COALESCE(p.postal_code, c.postal_code) AS postal_code,
            p.updated_at AS profile_updated_at
        FROM customers c
        LEFT JOIN customer_profiles p ON p.customer_id = c.id
        WHERE c.id = ?
          AND c.deleted_at IS NULL
        LIMIT 1
    `, [customerId]);
    return rows[0] || null;
}

function shapeProfile(req, row) {
    const url = publicImageUrl(req, row.profile_picture);
    return {
        ...row,
        profile_picture_url: withCacheBust(url, row.profile_updated_at || Date.now()),
        email_verified: Boolean(row.email_verified_at),
        phone_verified: Boolean(row.phone_verified_at),
        email_reminders_enabled: Boolean(row.email_reminders_enabled),
        whatsapp_reminders_enabled: Boolean(row.whatsapp_reminders_enabled),
        sms_reminders_enabled: Boolean(row.sms_reminders_enabled)
    };
}

exports.getProfile = async (req, res) => {
    try {
        const profile = await loadProfile(Number(req.user.id));
        if (!profile) {
            return res.status(404).json({ success: false, message: "Customer profile was not found." });
        }
        return res.json({ success: true, profile: shapeProfile(req, profile) });
    } catch (error) {
        console.error("Get customer profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load customer profile.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.createProfile = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const customerId = Number(req.user.id);
        await connection.query(`
            INSERT INTO customer_profiles (
                customer_id, phone, gender, date_of_birth,
                skin_type, hair_type, address, city, country, postal_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                phone = VALUES(phone), gender = VALUES(gender),
                date_of_birth = VALUES(date_of_birth), skin_type = VALUES(skin_type),
                hair_type = VALUES(hair_type), address = VALUES(address),
                city = VALUES(city), country = VALUES(country), postal_code = VALUES(postal_code)
        `, [
            customerId,
            normalizePhone(req.body.phone),
            cleanText(req.body.gender, 30) || null,
            cleanText(req.body.date_of_birth, 10) || null,
            cleanText(req.body.skin_type, 50) || null,
            cleanText(req.body.hair_type, 50) || null,
            cleanText(req.body.address, 1000) || null,
            cleanText(req.body.city, 100) || null,
            cleanText(req.body.country, 100) || "Pakistan",
            cleanText(req.body.postal_code, 30) || null
        ]);
        await connection.commit();
        const profile = await loadProfile(customerId);
        return res.status(201).json({
            success: true,
            message: "Profile saved successfully.",
            profile: shapeProfile(req, profile)
        });
    } catch (error) {
        await connection.rollback();
        console.error("Create customer profile error:", error);
        return res.status(500).json({ success: false, message: "Unable to save customer profile.", error: process.env.NODE_ENV === "production" ? undefined : error.message });
    } finally { connection.release(); }
};

exports.updateProfile = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const customerId = Number(req.user.id);
        const fullName = cleanText(req.body.full_name, 150);
        const email = normalizeEmail(req.body.email);
        const phone = normalizePhone(req.body.phone);
        if (!fullName) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Full name is required." });
        }
        if (!email && !phone) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Keep at least one email address or mobile number." });
        }
        const [currentRows] = await connection.query(`
            SELECT email, phone FROM customers
            WHERE id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE
        `, [customerId]);
        if (!currentRows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Customer was not found." });
        }
        const [duplicates] = await connection.query(`
            SELECT id FROM customers
            WHERE id <> ? AND deleted_at IS NULL
              AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
            LIMIT 1
        `, [customerId, email, email, phone, phone]);
        if (duplicates.length) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: "Another customer already uses this email or mobile number." });
        }
        const emailChanged = (currentRows[0].email || null) !== email;
        const phoneChanged = (currentRows[0].phone || null) !== phone;
        const address = cleanText(req.body.address, 1000) || null;
        const city = cleanText(req.body.city, 100) || null;
        const country = cleanText(req.body.country, 100) || "Pakistan";
        const postalCode = cleanText(req.body.postal_code, 30) || null;

        await connection.query(`
            UPDATE customers SET
                full_name = ?, email = ?, phone = ?,
                email_verified_at = CASE WHEN ? THEN NULL ELSE email_verified_at END,
                phone_verified_at = CASE WHEN ? THEN NULL ELSE phone_verified_at END,
                email_reminders_enabled = CASE WHEN ? THEN 0 ELSE email_reminders_enabled END,
                whatsapp_reminders_enabled = CASE WHEN ? THEN 0 ELSE whatsapp_reminders_enabled END,
                sms_reminders_enabled = CASE WHEN ? THEN 0 ELSE sms_reminders_enabled END,
                address = ?, city = ?, country = ?, postal_code = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [fullName, email, phone, emailChanged, phoneChanged, emailChanged, phoneChanged, phoneChanged, address, city, country, postalCode, customerId]);

        await connection.query(`
            INSERT INTO customer_profiles (
                customer_id, phone, gender, date_of_birth,
                skin_type, hair_type, address, city, country, postal_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                phone = VALUES(phone), gender = VALUES(gender),
                date_of_birth = VALUES(date_of_birth), skin_type = VALUES(skin_type),
                hair_type = VALUES(hair_type), address = VALUES(address),
                city = VALUES(city), country = VALUES(country), postal_code = VALUES(postal_code)
        `, [customerId, phone, cleanText(req.body.gender, 30) || null, cleanText(req.body.date_of_birth, 10) || null, cleanText(req.body.skin_type, 50) || null, cleanText(req.body.hair_type, 50) || null, address, city, country, postalCode]);

        await connection.commit();
        const profile = await loadProfile(customerId);
        return res.json({
            success: true,
            message: emailChanged || phoneChanged
                ? "Profile updated. Changed contact details must be verified again."
                : "Profile updated successfully.",
            verificationRequired: emailChanged || phoneChanged,
            profile: shapeProfile(req, profile)
        });
    } catch (error) {
        await connection.rollback();
        console.error("Update customer profile error:", error);
        return res.status(500).json({ success: false, message: "Unable to update customer profile.", error: process.env.NODE_ENV === "production" ? undefined : error.message });
    } finally { connection.release(); }
};

exports.updatePreferences = async (req, res) => {
    try {
        const customerId = Number(req.user.id);
        const requested = {
            email: toBooleanNumber(req.body.email_reminders_enabled),
            whatsapp: toBooleanNumber(req.body.whatsapp_reminders_enabled),
            sms: toBooleanNumber(req.body.sms_reminders_enabled)
        };
        const [rows] = await db.query(`
            SELECT c.email, c.phone, c.email_verified_at, c.phone_verified_at,
                COALESCE(lc.email_reminders_enabled, 0) AS membership_email,
                COALESCE(lc.whatsapp_reminders_enabled, 0) AS membership_whatsapp,
                COALESCE(lc.sms_reminders_enabled, 0) AS membership_sms
            FROM customers c
            LEFT JOIN customer_rewards cr ON cr.customer_id = c.id
            LEFT JOIN customer_loyalty_categories lc
                ON lc.category_name = COALESCE(cr.membership_level, 'Bronze')
               AND lc.status = 'Active'
            WHERE c.id = ? AND c.deleted_at IS NULL LIMIT 1
        `, [customerId]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Customer account was not found." });
        const customer = rows[0];
        const enforce = shouldEnforceCustomerVerification();
        if (requested.email && (!customer.email || (enforce && !customer.email_verified_at))) return res.status(400).json({ success: false, message: customer.email ? "Verify your email address first." : "Add an email address first." });
        if (requested.whatsapp && (!customer.phone || (enforce && !customer.phone_verified_at))) return res.status(400).json({ success: false, message: customer.phone ? "Verify your mobile number first." : "Add a mobile number first." });
        if (requested.sms && (!customer.phone || (enforce && !customer.phone_verified_at))) return res.status(400).json({ success: false, message: customer.phone ? "Verify your mobile number first." : "Add a mobile number first." });
        if (process.env.CUSTOMER_VERIFICATION_MODE === "production") {
            if (requested.email && !customer.membership_email) return res.status(403).json({ success: false, message: "Your membership does not include email reminders." });
            if (requested.whatsapp && !customer.membership_whatsapp) return res.status(403).json({ success: false, message: "WhatsApp reminders require an eligible membership." });
            if (requested.sms && !customer.membership_sms) return res.status(403).json({ success: false, message: "SMS reminders require an eligible membership." });
        }
        await db.query(`UPDATE customers SET email_reminders_enabled=?, whatsapp_reminders_enabled=?, sms_reminders_enabled=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [requested.email, requested.whatsapp, requested.sms, customerId]);
        return res.json({ success: true, message: "Reminder preferences updated successfully.", preferences: {
            email_reminders_enabled: Boolean(requested.email),
            whatsapp_reminders_enabled: Boolean(requested.whatsapp),
            sms_reminders_enabled: Boolean(requested.sms)
        }});
    } catch (error) {
        console.error("Update reminder preferences error:", error);
        return res.status(500).json({ success: false, message: "Unable to update reminder preferences.", error: process.env.NODE_ENV === "production" ? undefined : error.message });
    }
};

exports.uploadProfilePicture = async (req, res) => {
    const connection = await db.getConnection();
    const newRelativePath = req.file ? `uploads/profiles/${req.file.filename}` : null;
    try {
        const customerId = Number(req.user.id);
        if (!req.file) return res.status(400).json({ success: false, message: "Please upload an image." });
        await connection.beginTransaction();
        const [rows] = await connection.query(`
            SELECT profile_picture FROM customer_profiles
            WHERE customer_id = ? LIMIT 1 FOR UPDATE
        `, [customerId]);
        const oldImage = rows[0]?.profile_picture || null;
        await connection.query(`
            INSERT INTO customer_profiles (customer_id, profile_picture)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
                profile_picture = VALUES(profile_picture),
                updated_at = CURRENT_TIMESTAMP
        `, [customerId, newRelativePath]);
        await connection.commit();
        if (oldImage && oldImage !== newRelativePath) await safeDeleteUpload(oldImage);
        const profile = await loadProfile(customerId);
        return res.json({
            success: true,
            message: "Profile picture uploaded successfully.",
            image: newRelativePath,
            imageUrl: withCacheBust(publicImageUrl(req, newRelativePath), Date.now()),
            profile: shapeProfile(req, profile)
        });
    } catch (error) {
        await connection.rollback();
        if (newRelativePath) await safeDeleteUpload(newRelativePath);
        console.error("Upload profile picture error:", error);
        return res.status(500).json({ success: false, message: "Unable to upload profile picture.", error: process.env.NODE_ENV === "production" ? undefined : error.message });
    } finally { connection.release(); }
};

exports.deleteProfilePicture = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const customerId = Number(req.user.id);
        await connection.beginTransaction();
        const [rows] = await connection.query(`SELECT profile_picture FROM customer_profiles WHERE customer_id=? LIMIT 1 FOR UPDATE`, [customerId]);
        const oldImage = rows[0]?.profile_picture || null;
        await connection.query(`UPDATE customer_profiles SET profile_picture=NULL, updated_at=CURRENT_TIMESTAMP WHERE customer_id=?`, [customerId]);
        await connection.commit();
        if (oldImage) await safeDeleteUpload(oldImage);
        return res.json({ success: true, message: "Profile picture removed successfully.", image: null, imageUrl: null });
    } catch (error) {
        await connection.rollback();
        console.error("Delete profile picture error:", error);
        return res.status(500).json({ success: false, message: "Unable to remove profile picture.", error: process.env.NODE_ENV === "production" ? undefined : error.message });
    } finally { connection.release(); }
};
