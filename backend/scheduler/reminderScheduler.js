const cron = require("node-cron");

const db = require("../config/db");

const {
    getDueReminders,
    calculateNextOccurrence
} = require("../services/reminderEngine");

const {
    createCoupon
} = require("../services/couponService");

const {
    sendEmail
} = require("../services/emailService");

const {
    logNotification
} = require("../services/notificationService");

cron.schedule("* * * * *", async () => {

    console.log("==================================");
    console.log("⏰ Scheduler Running");

    try {

        const reminders = await getDueReminders();

        console.log(`Found ${reminders.length} reminder(s)`);

        for (const reminder of reminders) {

            console.log(`Processing: ${reminder.title}`);

            let coupon = null;

            // Generate Coupon
            if (reminder.auto_generate_coupon) {

                coupon = await createCoupon(
                    reminder.customer_id,
                    reminder.coupon_discount
                );

                console.log("🎁 Coupon:", coupon.code);
            }

            // Email Subject
            const subject = `Happy ${reminder.reminder_type} from RUKHNAV`;

            // Email Body
            const html = `
                <h1>🌿 RUKHNAV Cosmetics</h1>

                <h2>Dear ${reminder.full_name},</h2>

                <p>We wish you a wonderful ${reminder.reminder_type}.</p>

                ${
                    coupon
                    ? `
                    <h3>Your Gift</h3>

                    <h2>${coupon.discount}% OFF</h2>

                    <h1>${coupon.code}</h1>

                    <p>Valid Until ${coupon.expiryDate}</p>
                    `
                    : ""
                }

                <hr>

                <p>Thank you for choosing RUKHNAV Cosmetics.</p>
            `;

            // Send Email
            await sendEmail(
                reminder.email,
                subject,
                html
            );

            // Log Notification
            await logNotification({

                customer_id: reminder.customer_id,

                reminder_id: reminder.id,

                coupon_id: coupon ? coupon.id : null,

                notification_type: "Email",

                subject,

                message: `Reminder: ${reminder.title}`,

                status: "Sent"

            });

            // Calculate next occurrence
            const nextDate = calculateNextOccurrence(
                reminder.next_occurrence,
                reminder.recurrence
            );

            // Update reminder
            await db.query(

                `UPDATE reminders
                 SET next_occurrence=?
                 WHERE id=?`,

                [
                    nextDate,
                    reminder.id
                ]

            );

            console.log("✅ Reminder Completed");
        }

    } catch (error) {

        console.error(error);

    }

});

console.log("✅ Reminder Scheduler Started");