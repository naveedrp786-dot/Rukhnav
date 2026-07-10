const db = require("../config/db");

// =========================
// Get Customer Profile
// =========================
exports.getProfile = async (req, res) => {

    try {

        const customer_id = req.user.id;

        const [profile] = await db.query(

            `SELECT
                c.full_name,
                c.email,

                p.profile_picture,
                p.phone,
                p.gender,
                p.date_of_birth,
                p.skin_type,
                p.hair_type,
                p.address,
                p.city,
                p.country,
                p.postal_code

            FROM customers c

            LEFT JOIN customer_profiles p
            ON c.id = p.customer_id

            WHERE c.id = ?`,

            [customer_id]

        );

        res.json({

            success: true,

            profile: profile[0]

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};

// =========================
// Create Profile
// =========================
exports.createProfile = async (req, res) => {

    try {

        const customer_id = req.user.id;

        const {

            phone,
            gender,
            date_of_birth,
            skin_type,
            hair_type,
            address,
            city,
            country,
            postal_code

        } = req.body;

        const [existing] = await db.query(

            "SELECT id FROM customer_profiles WHERE customer_id=?",

            [customer_id]

        );

        if (existing.length > 0) {

            return res.status(400).json({

                success: false,

                message: "Profile already exists."

            });

        }

        const [result] = await db.query(

            `INSERT INTO customer_profiles

            (
                customer_id,
                phone,
                gender,
                date_of_birth,
                skin_type,
                hair_type,
                address,
                city,
                country,
                postal_code
            )

            VALUES (?,?,?,?,?,?,?,?,?,?)`,

            [

                customer_id,
                phone,
                gender,
                date_of_birth,
                skin_type,
                hair_type,
                address,
                city,
                country,
                postal_code

            ]

        );

        res.status(201).json({

            success: true,

            message: "Profile created successfully.",

            profileId: result.insertId

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};

// =========================
// Update Profile
// =========================
exports.updateProfile = async (req, res) => {

    try {

        const customer_id = req.user.id;

        const {

            phone,
            gender,
            date_of_birth,
            skin_type,
            hair_type,
            address,
            city,
            country,
            postal_code

        } = req.body;

        await db.query(

            `UPDATE customer_profiles

            SET

            phone=?,
            gender=?,
            date_of_birth=?,
            skin_type=?,
            hair_type=?,
            address=?,
            city=?,
            country=?,
            postal_code=?

            WHERE customer_id=?`,

            [

                phone,
                gender,
                date_of_birth,
                skin_type,
                hair_type,
                address,
                city,
                country,
                postal_code,
                customer_id

            ]

        );

        res.json({

            success: true,

            message: "Profile updated successfully."

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

const fs = require("fs");
const path = require("path");

// =========================
// Upload Profile Picture
// =========================
exports.uploadProfilePicture = async (req, res) => {

    try {

        const customer_id = req.user.id;

        if (!req.file) {

            return res.status(400).json({

                success: false,
                message: "Please upload an image."

            });

        }

        // Check profile
        const [profile] = await db.query(

            "SELECT profile_picture FROM customer_profiles WHERE customer_id=?",

            [customer_id]

        );

        if (profile.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Profile not found."

            });

        }

        // Delete old picture
        if (profile[0].profile_picture) {

            const oldPath = path.join(
                __dirname,
                "..",
                profile[0].profile_picture
            );

            if (fs.existsSync(oldPath)) {

                fs.unlinkSync(oldPath);

            }

        }

        const imagePath =
            "uploads/profiles/" + req.file.filename;

        await db.query(

            `UPDATE customer_profiles
             SET profile_picture=?
             WHERE customer_id=?`,

            [
                imagePath,
                customer_id
            ]

        );

        const imageUrl =
    `${req.protocol}://${req.get("host")}/${imagePath}`;

res.json({
    success: true,
    message: "Profile picture uploaded successfully.",
    image: imageUrl
});

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};