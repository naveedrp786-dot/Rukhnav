const db = require("../config/db");

// ==========================
// Create Reminder
// ==========================
exports.createReminder = async (req, res) => {

    try {

        const customerId = req.user.id;

        const {

            title,
            reminder_type,
            event_date,
            remind_before,
            repeat_type,
            email_notification,
            whatsapp_notification,
            app_notification,
            notes

        } = req.body;

        if (!title || !event_date) {

            return res.status(400).json({
                success: false,
                message: "Title and event date are required."
            });

        }

        const [result] = await db.query(

            `INSERT INTO reminders
            (
                customer_id,
                title,
                reminder_type,
                event_date,
                remind_before,
                repeat_type,
                email_notification,
                whatsapp_notification,
                app_notification,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                customerId,
                title,
                reminder_type || "Custom",
                event_date,
                remind_before || 1,
                repeat_type || "Yearly",
                email_notification ?? true,
                whatsapp_notification ?? false,
                app_notification ?? true,
                notes || null
            ]

        );

        res.status(201).json({

            success: true,
            message: "Reminder created successfully.",
            reminderId: result.insertId

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};