"use strict";

const express = require("express");
const router = express.Router();

const adminAuth =
    require("../middleware/adminAuth");

const controller =
    require("../controllers/financeController");

const automationController =
    require("../controllers/financeAutomationController");

router.use(adminAuth);

router.get(
    "/dashboard",
    controller.getDashboard
);

router.get(
    "/setup",
    controller.getSetup
);

router.get(
    "/transactions",
    controller.getTransactions
);

router.post(
    "/accounts",
    controller.createAccount
);

router.post(
    "/transactions",
    controller.createTransaction
);

router.patch(
    "/transactions/:id/cancel",
    controller.cancelTransaction
);


router.get("/accounting/accounts",controller.getChartOfAccounts);
router.post("/accounting/accounts",controller.createAccountingAccount);
router.get("/journals",controller.getJournals);
router.get("/journals/:id",controller.getJournalById);
router.post("/journals",controller.createJournal);
router.patch("/journals/:id/post",controller.postJournal);
router.post("/journals/:id/reverse",controller.reverseJournal);
router.get("/ledger",controller.getGeneralLedger);


router.get(
    "/automation/dashboard",
    automationController.getAutomationDashboard
);

router.patch(
    "/automation/settings/:key",
    automationController.updateAutomationSetting
);

router.post(
    "/automation/reconcile",
    automationController.reconcile
);

router.get(
    "/operations",
    automationController.getFinanceOperations
);

module.exports = router;
