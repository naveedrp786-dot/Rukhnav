const EasyPaisa = require("./easypaisaService");
const JazzCash = require("./jazzcashService");
const Stripe = require("./stripeService");

function getGateway(paymentMethod) {

    switch (paymentMethod) {

        case "EasyPaisa":
            return EasyPaisa;

        case "JazzCash":
            return JazzCash;

        case "Stripe":
            return Stripe;

        default:
            return null;
    }

}

module.exports = {
    getGateway
};