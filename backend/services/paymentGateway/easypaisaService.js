const { easypaisa } = require("../../config/paymentConfig");

exports.createPayment = async (paymentData) => {

    return {
        success: true,
        gateway: "EasyPaisa",
        environment: "Sandbox",
        merchantId: easypaisa.merchantId,
        storeId: easypaisa.storeId,
        amount: paymentData.amount,
        transaction_reference: paymentData.transaction_reference,
        returnUrl: easypaisa.returnUrl,
        message: "EasyPaisa sandbox payment initialized."
    };

};