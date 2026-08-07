const db = require("../config/db");
const bcrypt = require("bcrypt");

// =====================================
// Get Company Settings
// =====================================
exports.getCompanySettings = async (req, res) => {

    try {

        const [rows] = await db.query(
            "SELECT * FROM company_settings LIMIT 1"
        );

        res.json({
            success: true,
            company: rows[0]
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// =====================================
// Update Company Settings
// =====================================
exports.updateCompanySettings = async (req, res) => {

    try {

        const {

            company_name,
            company_tagline,
            company_email,
            company_phone,
            website,
            address,
            city,
            province,
            country,
            postal_code,
            ntn,
            strn,
            currency,
            invoice_prefix

        } = req.body;

        await db.query(
            `
            UPDATE company_settings
            SET
                company_name=?,
                company_tagline=?,
                company_email=?,
                company_phone=?,
                website=?,
                address=?,
                city=?,
                province=?,
                country=?,
                postal_code=?,
                ntn=?,
                strn=?,
                currency=?,
                invoice_prefix=?
            WHERE id=1
            `,
            [

                company_name,
                company_tagline,
                company_email,
                company_phone,
                website,
                address,
                city,
                province,
                country,
                postal_code,
                ntn,
                strn,
                currency,
                invoice_prefix

            ]
        );

        res.json({

            success: true,
            message: "Company settings updated successfully."

        });

    } catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

};

// =====================================
// Get Logged-in Admin Profile
// =====================================
exports.getProfile = async (req, res) => {

    try {

        const adminId =
            req.admin?.id ||
            req.user?.id;

        if (!adminId) {
            return res.status(401).json({
                success: false,
                message: "Admin session is invalid."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                profile_image,
                status
            FROM admins
            WHERE id = ?
            `,
            [adminId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Admin not found."
            });
        }

        const admin = rows[0];

        res.json({
            success: true,
            profile: {
                ...admin,
                full_name: [admin.first_name, admin.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim()
            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// =====================================
// Update Profile
// =====================================
exports.updateProfile = async (req, res) => {

    try {

        const adminId =
            req.admin?.id ||
            req.user?.id;

        if (!adminId) {
            return res.status(401).json({
                success: false,
                message: "Admin session is invalid."
            });
        }

        const {
            full_name,
            phone
        } = req.body;

        const cleanName = String(full_name || "").trim();

        if (!cleanName) {
            return res.status(400).json({
                success: false,
                message: "Full name is required."
            });
        }

        const nameParts = cleanName
            .split(/\s+/)
            .filter(Boolean);

        const firstName = nameParts.shift() || "";
        const lastName = nameParts.join(" ");

        await db.query(
            `
            UPDATE admins
            SET
                first_name=?,
                last_name=?,
                phone=?
            WHERE id=?
            `,
            [
                firstName,
                lastName,
                phone || null,
                adminId
            ]
        );

        res.json({
            success: true,
            message: "Profile updated successfully."
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// =====================================
// Change Password
// =====================================
exports.changePassword = async (req, res) => {

    try {

        const {

            currentPassword,
            newPassword

        } = req.body;

        const [rows] = await db.query(

            "SELECT password FROM admins WHERE id=?",

            [req.admin?.id || req.user?.id]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Admin not found."

            });

        }

        const match = await bcrypt.compare(

            currentPassword,

            rows[0].password

        );

        if (!match) {

            return res.status(400).json({

                success: false,

                message: "Current password is incorrect."

            });

        }

        const hashedPassword = await bcrypt.hash(

            newPassword,

            10

        );

        await db.query(

            "UPDATE admins SET password=? WHERE id=?",

            [

                hashedPassword,

                req.admin?.id || req.user?.id

            ]

        );

        res.json({

            success: true,

            message: "Password changed successfully."

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};