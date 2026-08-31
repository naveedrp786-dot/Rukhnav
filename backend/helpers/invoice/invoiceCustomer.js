const { drawLine } = require("./invoiceUtils");

function drawCustomer(doc, order) {

    doc
        .fillColor("#0B6E4F")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Customer Information", 40, 160);

    doc
        .fillColor("black")
        .fontSize(11)
        .font("Helvetica")
        .text(`Name: ${order.full_name}`, 40, 185)
        .text(`Email: ${order.email}`)
        .text(`Phone: ${order.phone || "-"}`);

    doc
        .fillColor("#0B6E4F")
        .font("Helvetica-Bold")
        .text("Shipping Address", 320, 160);

    doc
        .fillColor("black")
        .font("Helvetica")
        .text(order.address_line1 || "-", 320, 185);

    if (order.address_line2) {
        doc.text(order.address_line2);
    }

    doc
        .text(`${order.city || ""}, ${order.province || ""}`)
        .text(order.postal_code || "")
        .text(order.country || "");

    drawLine(doc, 270);

}

module.exports = drawCustomer;