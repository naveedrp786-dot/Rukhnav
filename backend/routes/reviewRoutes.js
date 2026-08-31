"use strict";

const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const controller = require("../controllers/reviewController");
const { uploadReviewImages } = require("../middleware/uploadReview");

function upload(req, res, next) {
    uploadReviewImages(req, res, error => {
        if (!error) return next();
        return res.status(400).json({
            success: false,
            message:
                error.code === "LIMIT_FILE_SIZE"
                    ? "Each review picture must be 5 MB or smaller."
                    : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
                        ? "Upload no more than five review pictures."
                        : error.message || "Unable to upload review pictures."
        });
    });
}

router.get("/product/:id", controller.getProductReviews);
router.get(
    "/eligible-products",
    auth,
    controller.getEligibleProducts
);

router.get("/mine", auth, controller.getMyReviews);
router.get("/my-reviews", auth, controller.getMyReviews);
router.post("/", auth, upload, controller.addReview);
router.get("/:id", auth, controller.getReviewById);
router.put("/:id", auth, controller.updateReview);
router.delete("/:id", auth, controller.deleteReview);
router.post("/:id/images", auth, upload, controller.addImages);
router.delete("/images/:imageId", auth, controller.deleteImage);
router.post("/:id/helpful", auth, controller.markHelpful);
router.post("/:id/report", auth, controller.reportReview);

module.exports = router;
