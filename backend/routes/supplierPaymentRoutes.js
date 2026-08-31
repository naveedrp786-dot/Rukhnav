const express = require("express");

const supplierPaymentController = require(
    "../controllers/supplierPaymentController"
);

const adminAuth = require(
    "../middleware/adminAuth"
);

const router = express.Router();

router.post(
    "/",
    adminAuth,
    supplierPaymentController.createSupplierPayment
);

router.get(
    "/",
    adminAuth,
    supplierPaymentController.getSupplierPayments
);

router.get(
    "/supplier/:supplierId",
    adminAuth,
    supplierPaymentController.getSupplierPaymentHistory
);

router.get(
    "/purchase-order/:purchaseOrderId",
    adminAuth,
    supplierPaymentController.getPurchaseOrderPayments
);

router.put(
    "/:id/cancel",
    adminAuth,
    supplierPaymentController.cancelSupplierPayment
);

router.get(
    "/:id",
    adminAuth,
    supplierPaymentController.getSupplierPaymentById
);

module.exports = router;
