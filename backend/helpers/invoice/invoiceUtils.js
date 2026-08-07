function money(value) {
    return `PKR ${Number(value || 0).toFixed(2)}`;
}

function drawLine(doc, y) {
    doc
        .moveTo(40, y)
        .lineTo(555, y)
        .lineWidth(1)
        .strokeColor("#C9A227")
        .stroke();
}

module.exports = {
    money,
    drawLine
};