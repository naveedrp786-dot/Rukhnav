const cron = require("node-cron");

const {
    getDueReminders
} = require("../services/reminderEngine");

cron.schedule("* * * * *", async () => {

    console.log("==================================");
    console.log("⏰ Scheduler Running");

    try {

        const reminders = await getDueReminders();

        console.log(`Found ${reminders.length} reminder(s)`);

        reminders.forEach(reminder => {

            console.log("-------------------------");
            console.log("Customer:", reminder.first_name, reminder.last_name);
            console.log("Reminder:", reminder.title);
            console.log("Email:", reminder.email);

        });

    } catch (err) {

        console.error(err);

    }

});

console.log("✅ Reminder Scheduler Started");