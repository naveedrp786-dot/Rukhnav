const QRCode = require("qrcode");

async function drawQR(doc, order, y) {

    const qrData =
`Order #${order.id}
Customer: ${order.full_name}
Total: ${order.total_amount}`;

    const qr = await QRCode.toDataURL(qrData);

    const buffer = Buffer.from(
        qr.replace(/^data:image\/png;base64,/, ""),
        "base64"
    );

    doc.image(buffer, 430, y, {
        width: 90
    });

    doc
        .fontSize(8)
        .fillColor("gray")
        .text(
            "Scan for order verification",
            415,
            y + 95
        );

}

module.exports = drawQR;