const express = require("express");
const router = express.Router();

const rewardController = require("../controllers/rewardController");

router.get("/:customerId", rewardController.getRewardBalance);

router.post("/redeem", rewardController.redeemPoints);

module.exports = router;