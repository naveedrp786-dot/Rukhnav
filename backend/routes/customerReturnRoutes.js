"use strict";
const express=require("express");
const router=express.Router();
const auth=require("../middleware/auth");
const controller=require("../controllers/customerReturnController");
const {
    uploadReturnMedia
}=require("../middleware/uploadReturnMedia");

function handleReturnUpload(handler){
    return (req,res,next)=>{
        uploadReturnMedia(req,res,error=>{
            if(!error){
                return handler(req,res,next);
            }

            return res.status(400).json({
                success:false,
                message:
                    error.code==="LIMIT_FILE_SIZE"
                        ? "Each return evidence file must be 25 MB or smaller."
                        : error.code==="LIMIT_FILE_COUNT" ||
                          error.code==="LIMIT_UNEXPECTED_FILE"
                            ? "Upload no more than six return evidence files."
                            : error.message ||
                              "Unable to upload return evidence."
            });
        });
    };
}

// Guest routes MUST remain before customer JWT middleware.
router.post("/guest",controller.createGuestReturn);

router.post(
    "/guest/:id/media",
    handleReturnUpload(
        controller.uploadGuestReturnMedia
    )
);

router.use(auth);
router.post("/",controller.createReturn);

router.post(
    "/:id/media",
    handleReturnUpload(
        controller.uploadCustomerReturnMedia
    )
);

router.get("/",controller.getMyReturns);
router.get("/:id",controller.getMyReturnDetails);
router.put("/:id/cancel",controller.cancelMyReturn);
module.exports=router;
