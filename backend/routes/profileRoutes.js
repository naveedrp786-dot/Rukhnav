"use strict";
const express=require("express");
const router=express.Router();
const auth=require("../middleware/auth");
const upload=require("../middleware/uploadProfile");
const controller=require("../controllers/profileController");
function uploadError(error,req,res,next){
    if(!error) return next();
    return res.status(400).json({success:false,message:error.code==="LIMIT_FILE_SIZE"?"Profile picture must be 5 MB or smaller.":error.message});
}
router.get("/",auth,controller.getProfile);
router.post("/",auth,controller.createProfile);
router.put("/",auth,controller.updateProfile);
router.patch("/preferences",auth,controller.updatePreferences);
router.post("/upload-picture",auth,(req,res,next)=>upload.single("profile_picture")(req,res,error=>uploadError(error,req,res,next)),controller.uploadProfilePicture);
router.delete("/picture",auth,controller.deleteProfilePicture);
module.exports=router;
