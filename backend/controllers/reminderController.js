const db = require("../config/db");
const {
    calculateNextOccurrence
} = require("../services/reminderEngine");

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

    recurrence,
    auto_generate_coupon,
    coupon_discount,

    email_notification,
    whatsapp_notification,
    app_notification,
    status,
    notes

} = req.body;

const nextOccurrence = calculateNextOccurrence(
    event_date,
    recurrence
);

        if (!title || !event_date) {

            return res.status(400).json({
                success: false,
                message: "Title and event date are required."
            });

        }
        
        const [result] = await db.query(
    `INSERT INTO reminders (
        customer_id,
        title,
        reminder_type,
        event_date,
        remind_before,
        repeat_type,
        recurrence,
        auto_generate_coupon,
        coupon_discount,
        next_occurrence,
        email_notification,
        whatsapp_notification,
        app_notification,
        status,
        notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        customerId,
        title,
        reminder_type || "Custom",
        event_date,
        remind_before || 1,
        repeat_type || "None",
        recurrence || "None",
        auto_generate_coupon ?? false,
        coupon_discount ?? null,
        nextOccurrence,
        email_notification ?? true,
        whatsapp_notification ?? false,
        app_notification ?? true,
        status || "Active",
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

// ==========================
// Get All Reminders
// ==========================
exports.getMyReminders = async (req, res) => {

    try {

        const customerId = req.user.id;

        const [reminders] = await db.query(

            `SELECT
                id,
                title,
                reminder_type,
                event_date,
                remind_before,
                repeat_type,
                email_notification,
                whatsapp_notification,
                app_notification,
                status,
                notes,
                created_at
            FROM reminders
            WHERE customer_id = ?
            ORDER BY event_date ASC`,

            [customerId]

        );

        res.json({

            success: true,
            total: reminders.length,
            reminders

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};

// ==========================
// Get Single Reminder
// ==========================
exports.getReminder = async (req, res) => {

    try {

        const customerId = req.user.id;
        const reminderId = req.params.id;

        const [rows] = await db.query(

            `SELECT *
             FROM reminders
             WHERE id = ?
             AND customer_id = ?`,

            [reminderId, customerId]

        );

        if (rows.length === 0) {

            return res.status(404).json({

                success: false,
                message: "Reminder not found."

            });

        }

        res.json({

            success: true,
            reminder: rows[0]

        });

    } catch (error) {

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};
// ==========================
// Update Reminder
// ==========================
exports.updateReminder = async (req, res) => {

    try {

        const customerId = req.user.id;
        const reminderId = req.params.id;

        const {

            title,
            reminder_type,
            event_date,
            remind_before,
            repeat_type,
            email_notification,
            whatsapp_notification,
            app_notification,
            status,
            notes

        } = req.body;

        const [result] = await db.query(

            `UPDATE reminders

            SET

                title=?,
                reminder_type=?,
                event_date=?,
                remind_before=?,
                repeat_type=?,
                email_notification=?,
                whatsapp_notification=?,
                app_notification=?,
                status=?,
                notes=?

            WHERE id=?
            AND customer_id=?`,

            [

                title,
                reminder_type,
                event_date,
                remind_before,
                repeat_type,
                email_notification,
                whatsapp_notification,
                app_notification,
                status,
                notes,
                reminderId,
                customerId

            ]

        );

        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,
                message: "Reminder not found."

            });

        }

        res.json({

            success: true,
            message: "Reminder updated successfully."

        });

    } catch (error) {

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};

// ==========================
// Delete Reminder
// ==========================
exports.deleteReminder = async (req, res) => {

    try {

        const customerId = req.user.id;
        const reminderId = req.params.id;

        const [result] = await db.query(

            `DELETE
             FROM reminders
             WHERE id=?
             AND customer_id=?`,

            [

                reminderId,
                customerId

            ]

        );

        if (result.affectedRows === 0) {

            return res.status(404).json({

                success: false,
                message: "Reminder not found."

            });

        }

        res.json({

            success: true,
            message: "Reminder deleted successfully."

        });

    } catch (error) {

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};

// ==========================
// Upcoming Reminders
// ==========================
exports.getUpcomingReminders = async (req, res) => {

    try {

        const customerId = req.user.id;

        const [reminders] = await db.query(

            `SELECT
                id,
                title,
                reminder_type,
                event_date,
                remind_before,
                repeat_type,
                notes,

                DATEDIFF(event_date, CURDATE()) AS days_left

            FROM reminders

            WHERE customer_id = ?

            AND status = 'Active'

            AND DATEDIFF(event_date, CURDATE()) >= 0

            AND DATEDIFF(event_date, CURDATE()) <= remind_before

            ORDER BY event_date ASC`,

            [customerId]

        );

        res.json({

            success: true,
            total: reminders.length,
            reminders

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,
            message: error.message

        });

    }

};