"use strict";
const express=require("express");
const router=express.Router();
const auth=require("../middleware/auth");
const controller=require("../controllers/customerReturnController");

// Guest route MUST remain before customer JWT middleware.
router.post("/guest",controller.createGuestReturn);

router.use(auth);
router.post("/",controller.createReturn);
router.get("/",controller.getMyReturns);
router.get("/:id",controller.getMyReturnDetails);
router.put("/:id/cancel",controller.cancelMyReturn);
module.exports=router;
