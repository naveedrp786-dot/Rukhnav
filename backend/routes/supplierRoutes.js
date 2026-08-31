const express = require("express");
const router = express.Router();

const supplierController = require("../controllers/supplierController");
const adminAuth = require("../middleware/adminAuth");

router.get(
    "/inactive/all",
    adminAuth,
    supplierController.getInactiveSuppliers
);

router.get(
    "/",
    adminAuth,
    supplierController.getSuppliers
);

router.get(
    "/:id",
    adminAuth,
    supplierController.getSupplierById
);

router.post(
    "/",
    adminAuth,
    supplierController.createSupplier
);

router.put(
    "/:id",
    adminAuth,
    supplierController.updateSupplier
);

router.patch(
    "/:id/deactivate",
    adminAuth,
    supplierController.deactivateSupplier
);

router.patch(
    "/:id/restore",
    adminAuth,
    supplierController.restoreSupplier
);

router.delete(
    "/:id/permanent",
    adminAuth,
    supplierController.permanentDeleteSupplier
);

module.exports = router;