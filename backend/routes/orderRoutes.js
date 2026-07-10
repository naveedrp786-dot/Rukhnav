const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const auth = require("../middleware/auth");

// Customer places an order
router.post("/", auth, orderController.placeOrder);
router.get("/", auth, orderController.getMyOrders);
router.get("/:id", auth, orderController.getOrderDetails);
router.put("/:id/cancel", auth, orderController.cancelOrder);

module.exports = router;