"use strict";

const express = require("express");
const router = express.Router();

const productController =
    require(
        "../controllers/productController"
    );

const productCrudController =
    require(
        "../controllers/productCrudController"
    );

const productImageController =
    require(
        "../controllers/productImageController"
    );

const adminAuth =
    require("../middleware/adminAuth");

const upload =
    require(
        "../middleware/uploadProduct"
    );

// ==========================================
// Public Product Lists
// ==========================================

router.get(
    "/",
    productController.getProducts
);

router.get(
    "/top-rated",
    productController
        .getTopRatedProducts
);

router.get(
    "/best-selling",
    productController
        .getBestSellingProducts
);

router.get(
    "/latest",
    productController
        .getLatestProducts
);

router.get(
    "/featured",
    productController
        .getFeaturedProducts
);

// ==========================================
// Protected Inactive Products
// ==========================================

router.get(
    "/inactive/all",
    adminAuth,
    productController
        .getInactiveProducts
);

// ==========================================
// Public Product Gallery
// ==========================================

router.get(
    "/:id/images",
    productImageController
        .getProductImages
);

// ==========================================
// Protected Product Gallery Management
// ==========================================

router.post(
    "/:id/images",
    adminAuth,
    upload.array("images", 20),
    productImageController
        .addProductImages
);

router.patch(
    "/:id/images/:imageId/main",
    adminAuth,
    productImageController
        .setMainProductImage
);

router.delete(
    "/:id/images/:imageId",
    adminAuth,
    productImageController
        .deleteProductImage
);

// ==========================================
// Protected Product Recovery
// ==========================================

router.patch(
    "/:id/restore",
    adminAuth,
    productController.restoreProduct
);

router.delete(
    "/:id/permanent",
    adminAuth,
    productController
        .permanentDeleteProduct
);

// ==========================================
// Public Single Product with Full Gallery
// ==========================================

router.get(
    "/:id",
    productCrudController
        .getProductById
);

// ==========================================
// Protected Product Creation
// ==========================================

router.post(
    "/",
    adminAuth,
    upload.array("images", 20),
    productCrudController.addProduct
);

// ==========================================
// Protected Product Update
// New images are added to the existing gallery
// ==========================================

router.put(
    "/:id",
    adminAuth,
    upload.array("images", 20),
    productCrudController
        .updateProduct
);

// ==========================================
// Protected Product Deactivation
// ==========================================

router.delete(
    "/:id",
    adminAuth,
    productController.deleteProduct
);

module.exports = router;