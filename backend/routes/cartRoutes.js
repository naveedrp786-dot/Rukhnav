const express = require("express");
const router = express.Router();

const cartController = require("../controllers/cartController");
const auth = require("../middleware/auth");

// Customer must be logged in
router.post("/", auth, cartController.addToCart);
router.get("/", auth, cartController.getCart);
router.put("/:id", auth, cartController.updateCart);
router.delete("/:id", auth, cartController.removeFromCart);

module.exports = router;