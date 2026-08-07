"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

const controller = require("../controllers/productMediaController");
const adminAuth = require("../middleware/adminAuth");
const {
    getUploadDirectory
} = require("../config/storage");

// =====================================================
// Persistent Product Gallery Storage
// =====================================================
// Main product uploads use:
//   <UPLOAD_ROOT>/products
//
// Gallery uploads use:
//   <UPLOAD_ROOT>/products/gallery
//
// In Railway production set:
//   UPLOAD_ROOT=/data/rukhnav/uploads
//
// This makes gallery images persist across deployments.

const productsUploadDirectory =
    getUploadDirectory("products");

const galleryUploadDirectory =
    path.join(
        productsUploadDirectory,
        "gallery"
    );

fs.mkdirSync(
    galleryUploadDirectory,
    {
        recursive: true
    }
);

// =====================================================
// Multer Storage
// =====================================================

const storage =
    multer.diskStorage({
        destination: (
            req,
            file,
            cb
        ) => {
            cb(
                null,
                galleryUploadDirectory
            );
        },

        filename: (
            req,
            file,
            cb
        ) => {
            const extension =
                path.extname(
                    file.originalname
                )
                .toLowerCase();

            const uniqueName =
                `${Date.now()}-${Math.round(
                    Math.random() * 1e9
                )}${extension}`;

            cb(
                null,
                uniqueName
            );
        }
    });

// =====================================================
// File Validation
// =====================================================

const allowedMimeTypes =
    new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);

const upload =
    multer({
        storage,

        limits: {
            fileSize:
                8 * 1024 * 1024,

            files:
                10
        },

        fileFilter: (
            req,
            file,
            cb
        ) => {
            if (
                allowedMimeTypes.has(
                    file.mimetype
                )
            ) {
                return cb(
                    null,
                    true
                );
            }

            return cb(
                new Error(
                    "Only JPG, PNG and WEBP images are allowed."
                ),
                false
            );
        }
    });

// =====================================================
// Public Product Gallery Route
// =====================================================

router.get(
    "/public/:productId",
    controller.getPublicGallery
);

// =====================================================
// Protected Admin Product Gallery Routes
// =====================================================

router.use(
    adminAuth
);

router.get(
    "/:productId",
    controller.getAdminGallery
);

router.post(
    "/:productId",
    upload.array(
        "images",
        10
    ),
    controller.uploadImages
);

router.patch(
    "/image/:imageId",
    controller.updateImage
);

router.patch(
    "/image/:imageId/primary",
    controller.setPrimary
);

router.delete(
    "/image/:imageId",
    controller.deleteImage
);

module.exports =
    router;
