const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = "uploads/profiles";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage
const storage = multer.diskStorage({

    destination(req, file, cb) {
        cb(null, uploadDir);
    },

    filename(req, file, cb) {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }

});

// File filter
const fileFilter = (req, file, cb) => {

    console.log("Original Name:", file.originalname);
    console.log("Extension:", path.extname(file.originalname));
    console.log("MIME Type:", file.mimetype);

    const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ];

    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
        return cb(null, true);
    }

    cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed."));
};

// Upload middleware
module.exports = multer({

    storage,

    fileFilter,

    limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
}

});