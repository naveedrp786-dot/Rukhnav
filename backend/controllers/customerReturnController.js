"use strict";

const {
    queueOwnerActivity
} = require("../services/ownerActivityNotificationService");
const service = require("../services/customerReturnService");
const customerIdFrom = req => Number(req.user?.id || req.user?.customerId || req.customer?.id || req.customer?.customerId);
const handle = (res,error,label) => { console.error(`${label}:`,error); return res.status(error.statusCode||500).json({success:false,message:error.message||"Unexpected server error."}); };
exports.createGuestReturn=async(req,res)=>{try{
    const result=await service.createGuestReturnRequest({
        orderNumber:req.body?.order_number,
        guestToken:req.body?.guest_token || req.query?.token,
        returnAccessToken:req.body?.return_access_token || req.query?.return_access_token,
        payload:req.body||{}
    });
    queueOwnerActivity({
        type: "RETURN_REQUESTED",
        title: "Guest Return Request",
        reference:
            result.return_number ||
            result.order_number ||
            `Return #${result.id}`,
        details: [
            {
                label: "Order",
                value: result.order_number || "-"
            },
            {
                label: "Requested amount",
                value:
                    `Rs. ${Number(
                        result.requested_amount || 0
                    ).toFixed(2)}`
            },
            {
                label: "Items",
                value: result.item_count || 0
            },
            {
                label: "Customer type",
                value: "Guest"
            }
        ]
    });

    return res.status(201).json({
        success:true,
        message:"Guest return request submitted successfully.",
        return_request:result
    });
}catch(e){
    return handle(res,e,"Create guest return error");
}};

exports.createReturn=async(req,res)=>{
    try{
        const result=
            await service.createReturnRequest({
                customerId:
                    customerIdFrom(req),
                payload:
                    req.body || {}
            });

        queueOwnerActivity({
            type: "RETURN_REQUESTED",
            title: "Customer Return Request",
            customerName:
                req.user?.full_name ||
                req.user?.name ||
                "",
            customerEmail:
                req.user?.email || "",
            customerPhone:
                req.user?.phone || "",
            reference:
                result.return_number ||
                result.order_number ||
                `Return #${result.id}`,
            details: [
                {
                    label: "Order",
                    value:
                        result.order_number || "-"
                },
                {
                    label: "Requested amount",
                    value:
                        `Rs. ${Number(
                            result.requested_amount || 0
                        ).toFixed(2)}`
                },
                {
                    label: "Items",
                    value:
                        result.item_count || 0
                }
            ]
        });

        return res.status(201).json({
            success:true,
            message:
                "Return request submitted successfully.",
            return_request:
                result
        });
    }catch(e){
        return handle(
            res,
            e,
            "Create customer return error"
        );
    }
};
exports.getMyReturns=async(req,res)=>{try{const rows=await service.getCustomerReturns(customerIdFrom(req));return res.json({success:true,total:rows.length,returns:rows});}catch(e){return handle(res,e,"Get customer returns error");}};
exports.getMyReturnDetails=async(req,res)=>{try{return res.json({success:true,...await service.getReturnDetails({returnId:req.params.id,customerId:customerIdFrom(req)})});}catch(e){return handle(res,e,"Get customer return details error");}};
exports.cancelMyReturn=async(req,res)=>{try{const result=await service.cancelCustomerReturn({returnId:req.params.id,customerId:customerIdFrom(req),notes:req.body?.notes});return res.json({success:true,message:"Return request cancelled successfully.",return_request:result});}catch(e){return handle(res,e,"Cancel customer return error");}};


exports.uploadGuestReturnMedia = async (req,res) => {
    try {
        const media =
            await service.saveReturnMedia({
                returnId:
                    req.params.id,

                guestToken:
                    req.body?.guest_token ||
                    req.query?.token,

                returnAccessToken:
                    req.body?.return_access_token ||
                    req.query?.return_access_token,

                files:
                    req.files || []
            });

        queueOwnerActivity({
            type: "RETURN_EVIDENCE_UPLOADED",
            title: "Guest Return Evidence Uploaded",
            reference:
                `Return #${req.params.id}`,
            details: [
                {
                    label: "Files uploaded",
                    value:
                        Array.isArray(media)
                            ? media.length
                            : 0
                },
                {
                    label: "Customer type",
                    value: "Guest"
                }
            ]
        });

        queueOwnerActivity({
            type: "RETURN_EVIDENCE_UPLOADED",
            title: "Customer Return Evidence Uploaded",
            customerName:
                req.user?.full_name ||
                req.user?.name ||
                "",
            customerEmail:
                req.user?.email || "",
            customerPhone:
                req.user?.phone || "",
            reference:
                `Return #${req.params.id}`,
            details: [
                {
                    label: "Files uploaded",
                    value:
                        Array.isArray(media)
                            ? media.length
                            : 0
                }
            ]
        });

        return res.status(201).json({
            success:true,
            message:"Return evidence uploaded successfully.",
            media
        });

    } catch(e) {
        return handle(
            res,
            e,
            "Upload guest return evidence error"
        );
    }
};


exports.uploadCustomerReturnMedia = async (req,res) => {
    try {
        const media =
            await service.saveReturnMedia({
                returnId:
                    req.params.id,

                customerId:
                    customerIdFrom(req),

                files:
                    req.files || []
            });

        return res.status(201).json({
            success:true,
            message:"Return evidence uploaded successfully.",
            media
        });

    } catch(e) {
        return handle(
            res,
            e,
            "Upload customer return evidence error"
        );
    }
};
