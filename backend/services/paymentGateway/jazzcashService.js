exports.createPayment = async (paymentData) => {

    return {
        success: true,
        gateway: "JazzCash",
        message: "JazzCash Sandbox Payment Created",
        paymentData
    };

};