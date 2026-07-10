const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const adminAuth = require("../middleware/adminAuth");
const upload = require("../middleware/uploadProduct");

// Public Routes
router.get("/", productController.getProducts);

router.get(
    "/top-rated",
    productController.getTopRatedProducts
);
router.get(
    "/best-selling",
    productController.getBestSellingProducts
);
router.get(
    "/latest",
    productController.getLatestProducts
);
router.get(
    "/featured",
    productController.getFeaturedProducts
);

router.get("/:id", productController.getProductById);

// Admin Routes
router.post(
    "/",
    adminAuth,
    upload.single("image"),
    productController.addProduct
);

router.put(
    "/:id",
    adminAuth,
    upload.single("image"),
    productController.updateProduct
);

router.delete(
    "/:id",
    adminAuth,
    productController.deleteProduct
);

module.exports = router;