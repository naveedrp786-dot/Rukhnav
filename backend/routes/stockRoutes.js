const express = require("express");
const router = express.Router();

const stockController = require("../controllers/stockController");
const adminAuth = require("../middleware/adminAuth");

// ==============================
// Get Products
// ==============================
router.get(
    "/products",
    adminAuth,
    stockController.getProducts
);

// ==============================
// Get Suppliers
// ==============================
router.get(
    "/suppliers",
    adminAuth,
    stockController.getSuppliers
);

// ==============================
// Stock In
// ==============================
router.post(
    "/in",
    adminAuth,
    stockController.stockIn
);


module.exports = router;