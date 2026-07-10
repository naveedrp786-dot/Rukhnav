const upload = require("../middleware/uploadProfile");
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const profileController = require("../controllers/profileController");

router.get(
    "/",
    auth,
    profileController.getProfile
);

router.post(
    "/",
    auth,
    profileController.createProfile
);

router.put(
    "/",
    auth,
    profileController.updateProfile
    
);

router.post(
    "/upload-picture",
    auth,
    (req, res, next) => {
        upload.single("profile_picture")(req, res, function (err) {

            if (err) {

                if (err.code === "LIMIT_FILE_SIZE") {

                    return res.status(400).json({
                        success: false,
                        message: "Image size must be less than 5 MB."
                    });

                }

                return res.status(400).json({
                    success: false,
                    message: err.message
                });

            }

            next();

        });
    },
    profileController.uploadProfilePicture
);

module.exports = router;
