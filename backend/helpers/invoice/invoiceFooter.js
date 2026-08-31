function drawFooter(doc) {

    const y = doc.page.height - 70;

    doc
        .moveTo(40, y)
        .lineTo(555, y)
        .strokeColor("#C9A227")
        .stroke();

    doc
        .fontSize(10)
        .fillColor("#0B6E4F")
        .font("Helvetica-Bold")
        .text(
    "This document confirms the return of goods to the supplier.",
    40,
    y + 10,
    {
        width: 515,
        align: "center"
    }
);

    doc
        .fontSize(8)
        .fillColor("gray")
        .font("Helvetica")
        .text(
            "Natural Herbal Cosmetics | www.rukhnav.com | support@rukhnav.com",
            40,
            y + 28,
            {
                width: 515,
                align: "center"
            }
        );

}

module.exports = drawFooter;