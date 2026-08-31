const db = require("../config/db");

// ===============================
// Calculate Next Occurrence
// ===============================
function calculateNextOccurrence(eventDate, recurrence) {

    let next = new Date(eventDate);
    const today = new Date();

    while (next < today) {

        switch (recurrence) {

            case "Daily":
                next.setDate(next.getDate() + 1);
                break;

            case "Weekly":
                next.setDate(next.getDate() + 7);
                break;

            case "Monthly":
                next.setMonth(next.getMonth() + 1);
                break;

            case "Yearly":
                next.setFullYear(next.getFullYear() + 1);
                break;

            default:
                return eventDate;
        }
    }

    return next.toISOString().split("T")[0];
}

// ===============================
// Get Due Reminders
// ===============================
async function getDueReminders() {

    const [rows] = await db.query(`
        SELECT
            r.*,
            c.first_name,
            c.last_name,
            c.email,
            c.phone
        FROM reminders r
        JOIN customers c
            ON r.customer_id = c.id
        WHERE r.status = 'Active'
        AND r.next_occurrence = CURDATE()
    `);

    return rows;
}

// ===============================
// Exports
// ===============================
module.exports = {
    calculateNextOccurrence,
    getDueReminders
};