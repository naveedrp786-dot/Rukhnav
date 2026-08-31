exports.createPayment = async (paymentData) => {

    return {
        success: true,
        gateway: "Stripe",
        message: "Stripe Payment Created",
        paymentData
    };

};