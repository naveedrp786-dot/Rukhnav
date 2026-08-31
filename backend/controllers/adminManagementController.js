const db = require("../config/db");
const bcrypt = require("bcrypt");

// ======================================================
// RUKHNAV ERP
// Admin Management Controller
// ======================================================



// ======================================================
// GET ALL ADMINS
// ======================================================

exports.getAdmins = async (req, res) => {

    try {

        const [admins] = await db.query(`

            SELECT

                id,
                first_name,
                last_name,
                email,
                phone,
                profile_image,
                role,
                status,
                created_at,
                updated_at

            FROM admins

            ORDER BY id DESC

        `);

        return res.status(200).json({

            success: true,

            totalAdmins: admins.length,

            admins

        });

    }

    catch (error) {

        console.error("GET ADMINS ERROR:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to fetch administrators."

        });

    }

};



// ======================================================
// GET ADMIN BY ID
// ======================================================

exports.getAdminById = async (req, res) => {

    try {

        const { id } = req.params;

        const [admins] = await db.query(

            `

            SELECT

                id,
                first_name,
                last_name,
                email,
                phone,
                profile_image,
                role,
                status,
                created_at,
                updated_at

            FROM admins

            WHERE id = ?

            `,

            [id]

        );

        if (admins.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Administrator not found."

            });

        }

        return res.status(200).json({

            success: true,

            admin: admins[0]

        });

    }

    catch (error) {

        console.error("GET ADMIN ERROR:", error);

        return res.status(500).json({

            success: false,

            message: "Unable to load administrator."

        });

    }

};

// ======================================================
// CREATE NEW ADMIN
// ======================================================

exports.createAdmin = async (req, res) => {

    try {

        const {
            first_name,
            last_name,
            email,
            phone,
            password,
            role,
            status
        } = req.body;

        const profile_image =
            req.file
                ? req.file.filename
                : null;

        // =====================================
        // Required Field Validation
        // =====================================

        if (
            !first_name ||
            !last_name ||
            !email ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "First Name, Last Name, Email and Password are required."

            });

        }

        // =====================================
        // Email Validation
        // =====================================

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {

            return res.status(400).json({

                success: false,

                message: "Invalid email address."

            });

        }

        // =====================================
        // Check Duplicate Email
        // =====================================

        const [existing] = await db.query(

            "SELECT id FROM admins WHERE email = ?",

            [email]

        );

        if (existing.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    "An administrator with this email already exists."

            });

        }

        // =====================================
        // Password Encryption
        // =====================================

        const hashedPassword =
            await bcrypt.hash(password, 10);

        // =====================================
        // Allowed Roles
        // =====================================

        const allowedRoles = [

            "superadmin",
            "admin",
            "manager",
            "inventory",
            "finance",
            "support"

        ];

        const adminRole =
            allowedRoles.includes(role)
                ? role
                : "admin";

        // =====================================
        // Allowed Status
        // =====================================

        const adminStatus =
            status === "Inactive"
                ? "Inactive"
                : "Active";

        // =====================================
        // Insert Administrator
        // =====================================

        const [result] = await db.query(

            `

            INSERT INTO admins (

                first_name,
                last_name,
                email,
                phone,
                password,
                role,
                status,
                profile_image

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?)

            `,

            [

                first_name.trim(),

                last_name.trim(),

                email.trim().toLowerCase(),

                phone || null,

                hashedPassword,

                adminRole,

                adminStatus,

                profile_image

            ]

        );

        return res.status(201).json({

            success: true,

            message:
                "Administrator created successfully.",

            adminId: result.insertId

        });

    }

    catch (error) {

        console.error(

            "CREATE ADMIN ERROR:",

            error

        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to create administrator."

        });

    }

};

// ======================================================
// UPDATE ADMIN
// ======================================================

exports.updateAdmin = async (req, res) => {

    try {

        const { id } = req.params;

        const {

            first_name,
            last_name,
            email,
            phone,
            password,
            role,
            status

        } = req.body;

        // =====================================
        // Check Administrator Exists
        // =====================================

        const [admins] = await db.query(

            "SELECT * FROM admins WHERE id = ?",

            [id]

        );

        if (admins.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Administrator not found."

            });

        }

        // =====================================
        // Check Duplicate Email
        // =====================================

        const [duplicate] = await db.query(

            `SELECT id
             FROM admins
             WHERE email = ?
             AND id <> ?`,

            [

                email,

                id

            ]

        );

        if (duplicate.length > 0) {

            return res.status(409).json({

                success: false,

                message: "Email already exists."

            });

        }

        // =====================================
        // Prepare Password
        // =====================================

        let newPassword = admins[0].password;

        if (password && password.trim() !== "") {

            newPassword = await bcrypt.hash(

                password,

                10

            );

        }

        // =====================================
        // Validate Role
        // =====================================

        const allowedRoles = [

            "superadmin",
            "admin",
            "manager",
            "inventory",
            "finance",
            "support"

        ];

        const adminRole =

            allowedRoles.includes(role)

                ? role

                : admins[0].role;

        // =====================================
        // Validate Status
        // =====================================

        const adminStatus =

            status === "Inactive"

                ? "Inactive"

                : "Active";

        // =====================================
        // Prepare Profile Image
        // =====================================

        const profile_image =
            req.file
                ? req.file.filename
                : admins[0].profile_image;

        // =====================================
        // Update Administrator
        // =====================================

        await db.query(

            `

            UPDATE admins

            SET

                first_name = ?,

                last_name = ?,

                email = ?,

                phone = ?,

                password = ?,

                role = ?,

                status = ?,

                profile_image = ?

            WHERE id = ?

            `,

            [

                first_name,

                last_name,

                email.toLowerCase(),

                phone,

                newPassword,

                adminRole,

                adminStatus,

                profile_image,

                id

            ]

        );

        return res.status(200).json({

            success: true,

            message: "Administrator updated successfully."

        });

    }

    catch (error) {

        console.error(

            "UPDATE ADMIN ERROR:",

            error

        );

        return res.status(500).json({

            success: false,

            message: "Unable to update administrator."

        });

    }

};

// ======================================================
// DELETE ADMIN
// ======================================================

exports.deleteAdmin = async (req, res) => {

    try {

        const { id } = req.params;

        // Prevent deleting yourself
        if (req.admin && Number(req.admin.id) === Number(id)) {

            return res.status(400).json({

                success: false,

                message: "You cannot delete your own account."

            });

        }

        const [admins] = await db.query(

            "SELECT id FROM admins WHERE id = ?",

            [id]

        );

        if (admins.length === 0) {

            return res.status(404).json({

                success: false,

                message: "Administrator not found."

            });

        }

        await db.query(

            "DELETE FROM admins WHERE id = ?",

            [id]

        );

        return res.status(200).json({

            success: true,

            message: "Administrator deleted successfully."

        });

    }

    catch (error) {

        console.error(

            "DELETE ADMIN ERROR:",

            error

        );

        return res.status(500).json({

            success: false,

            message: "Unable to delete administrator."

        });

    }

};

// ======================================================
// END OF FILE
// ======================================================