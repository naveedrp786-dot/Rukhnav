"use strict";
const service = require("../services/customerReturnService");
const customerIdFrom = req => Number(req.user?.id || req.user?.customerId || req.customer?.id || req.customer?.customerId);
const handle = (res,error,label) => { console.error(`${label}:`,error); return res.status(error.statusCode||500).json({success:false,message:error.message||"Unexpected server error."}); };
exports.createGuestReturn=async(req,res)=>{try{
    const result=await service.createGuestReturnRequest({
        orderNumber:req.body?.order_number,
        guestToken:req.body?.guest_token || req.query?.token,
        payload:req.body||{}
    });
    return res.status(201).json({
        success:true,
        message:"Guest return request submitted successfully.",
        return_request:result
    });
}catch(e){
    return handle(res,e,"Create guest return error");
}};

exports.createReturn=async(req,res)=>{try{const result=await service.createReturnRequest({customerId:customerIdFrom(req),payload:req.body||{}});return res.status(201).json({success:true,message:"Return request submitted successfully.",return_request:result});}catch(e){return handle(res,e,"Create customer return error");}};
exports.getMyReturns=async(req,res)=>{try{const rows=await service.getCustomerReturns(customerIdFrom(req));return res.json({success:true,total:rows.length,returns:rows});}catch(e){return handle(res,e,"Get customer returns error");}};
exports.getMyReturnDetails=async(req,res)=>{try{return res.json({success:true,...await service.getReturnDetails({returnId:req.params.id,customerId:customerIdFrom(req)})});}catch(e){return handle(res,e,"Get customer return details error");}};
exports.cancelMyReturn=async(req,res)=>{try{const result=await service.cancelCustomerReturn({returnId:req.params.id,customerId:customerIdFrom(req),notes:req.body?.notes});return res.json({success:true,message:"Return request cancelled successfully.",return_request:result});}catch(e){return handle(res,e,"Cancel customer return error");}};
