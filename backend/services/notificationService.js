const db = require("../config/db");

async function logNotification({
    customer_id,
    reminder_id = null,
    coupon_id = null,
    notification_type,
    subject,
    message,
    status = "Sent",
    error_message = null
}) {

    const [result] = await db.query(
        `INSERT INTO notification_logs
        (
            customer_id,
            reminder_id,
            coupon_id,
            notification_type,
            subject,
            message,
            status,
            error_message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            customer_id,
            reminder_id,
            coupon_id,
            notification_type,
            subject,
            message,
            status,
            error_message
        ]
    );

    return result.insertId;
}

module.exports = {
    logNotification
};