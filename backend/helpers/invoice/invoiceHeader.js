const path = require("path");
const { drawLine } = require("./invoiceUtils");

function drawHeader(doc, order) {

    const logo = path.join(__dirname, "../../assets/logo.png");

    try {

        doc.image(logo, 40, 30, {
            width: 70
        });

    } catch {

        console.log("Logo not found");

    }

    doc
        .fillColor("#0B6E4F")
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("RUKHNAV", 130, 35);

    doc
        .fontSize(13)
        .fillColor("#444")
        .font("Helvetica")
        .text("Natural Herbal Cosmetics", 130, 65);

    doc
        .fontSize(10)
        .text("Rawalpindi, Pakistan", 130, 88)
        .text("Phone: +92 308 1201745")
        .text("Email: support@rukhnav.com")
        .text("Website: www.rukhnav.com");

    doc
        .fillColor("#0B6E4F")
        .fontSize(28)
        .font("Helvetica-Bold")
        .text("INVOICE", 410, 40);

    doc
        .fillColor("black")
        .fontSize(11)
        .font("Helvetica")
        .text(`Invoice #: INV-${String(order.id).padStart(6, "0")}`, 390, 80)
        .text(`Order #: ${order.id}`)
        .text(`Date: ${new Date(order.created_at).toLocaleDateString()}`);

    drawLine(doc, 145);

}

module.exports = drawHeader;