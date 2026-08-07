const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");

const supplierDebitNoteController = require(
    "../controllers/supplierDebitNoteController"
);

router.post(
    "/",
    adminAuth,
    supplierDebitNoteController.createDebitNote
);

router.get(
    "/",
    adminAuth,
    supplierDebitNoteController.getDebitNotes
);

router.post(
    "/:id/post",
    adminAuth,
    supplierDebitNoteController.postDebitNote
);

router.put(
    "/:id/cancel",
    adminAuth,
    supplierDebitNoteController.cancelDebitNote
);

router.get(
    "/:id",
    adminAuth,
    supplierDebitNoteController.getDebitNoteById
);

module.exports = router;
