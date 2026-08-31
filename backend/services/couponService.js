const db = require("../config/db");

function generateCouponCode(prefix = "RUK") {

    const random = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

    return `${prefix}-${random}`;
}

async function createCoupon(customerId, discount) {

    const code = generateCouponCode();

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const expiryDate = expiry.toISOString().split("T")[0];

    const [result] = await db.query(
`INSERT INTO coupons
(
    customer_id,
    coupon_type,
    code,
    discount_type,
    discount_value,
    minimum_order,
    usage_limit,
    expiry_date,
    status
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
[
    customerId,
    "Birthday",
    code,
    "percentage",
    discount,
    0,
    1,
    expiryDate,
    "active"
]
);

    return {
        id: result.insertId,
        code,
        discount,
        expiryDate
    };
}

module.exports = {
    createCoupon
};