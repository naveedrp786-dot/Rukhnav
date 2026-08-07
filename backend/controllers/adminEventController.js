"use strict";

const db = require("../config/db");

function ok(res, payload = {}) {
    return res.json({ success: true, ...payload });
}
function fail(res, message, status = 500) {
    return res.status(status).json({ success: false, message });
}
function idValue(value) {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

exports.getSummary = async (req, res) => {
    try {
        const [[events]] = await db.query(`
            SELECT
                COUNT(*) AS total_events,
                SUM(status = 'Active') AS active_events,
                SUM(event_type IN ('Birthday','Family Birthday')) AS birthdays,
                SUM(event_type = 'Anniversary') AS anniversaries
            FROM customer_events
        `);
        const [[logs]] = await db.query(`
            SELECT
                SUM(status = 'Pending') AS pending_reminders,
                SUM(status = 'Sent') AS sent_reminders
            FROM event_reminder_logs
        `);
        return ok(res, {
            summary: {
                totalEvents: Number(events.total_events || 0),
                activeEvents: Number(events.active_events || 0),
                birthdays: Number(events.birthdays || 0),
                anniversaries: Number(events.anniversaries || 0),
                pendingReminders: Number(logs.pending_reminders || 0),
                sentReminders: Number(logs.sent_reminders || 0)
            },
            developmentBypass: process.env.NODE_ENV !== 'production'
        });
    } catch (error) {
        console.error('Admin event summary error:', error);
        return fail(res, error.message);
    }
};

exports.getEvents = async (req, res) => {
    try {
        const where=[]; const params=[];
        const search=String(req.query.search||'').trim();
        const status=String(req.query.status||'').trim();
        const type=String(req.query.type||'').trim();
        if (search) {
            where.push(`(c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR ce.event_name LIKE ? OR ce.event_type LIKE ?)`);
            const like=`%${search}%`; params.push(like,like,like,like,like);
        }
        if (status) { where.push('ce.status = ?'); params.push(status); }
        if (type) { where.push('ce.event_type = ?'); params.push(type); }
        const [rows]=await db.query(`
            SELECT
                ce.id, ce.customer_id, ce.event_type, ce.event_name, ce.event_date,
                ce.recurrence, ce.reminder_days, ce.remind_by_email,
                ce.remind_by_whatsapp, ce.remind_by_sms, ce.notes, ce.status,
                ce.created_at, ce.updated_at,
                c.full_name, c.email, c.phone,
                COALESCE(cr.membership_level, 'Bronze') AS membership_level,
                (SELECT erl.scheduled_for FROM event_reminder_logs erl
                 WHERE erl.customer_event_id = ce.id ORDER BY erl.id DESC LIMIT 1) AS reminder_date,
                (SELECT erl.status FROM event_reminder_logs erl
                 WHERE erl.customer_event_id = ce.id ORDER BY erl.id DESC LIMIT 1) AS latest_reminder_status
            FROM customer_events ce
            JOIN customers c ON c.id = ce.customer_id
            LEFT JOIN customer_rewards cr ON cr.customer_id = ce.customer_id
            ${where.length ? 'WHERE '+where.join(' AND ') : ''}
            ORDER BY ce.event_date ASC, ce.id DESC
        `, params);
        return ok(res,{events:rows});
    } catch (error) {
        console.error('Admin events list error:', error);
        return fail(res,error.message);
    }
};

exports.getLogs = async (req, res) => {
    try {
        const status=String(req.query.status||'').trim();
        const params=[];
        const condition=status ? 'WHERE erl.status = ?' : '';
        if(status) params.push(status);
        const [rows]=await db.query(`
            SELECT erl.*, ce.event_name, ce.event_type, c.full_name
            FROM event_reminder_logs erl
            JOIN customer_events ce ON ce.id = erl.customer_event_id
            JOIN customers c ON c.id = erl.customer_id
            ${condition}
            ORDER BY erl.scheduled_for DESC, erl.id DESC
            LIMIT 500
        `,params);
        return ok(res,{logs:rows});
    } catch(error){
        console.error('Admin event logs error:',error);
        return fail(res,error.message);
    }
};

exports.updateStatus = async (req,res) => {
    try {
        const id=idValue(req.params.id);
        const status=String(req.body.status||'').trim();
        if(!id) return fail(res,'A valid event ID is required.',400);
        if(!['Active','Inactive'].includes(status)) return fail(res,'Status must be Active or Inactive.',400);
        const [result]=await db.query(`UPDATE customer_events SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,[status,id]);
        if(!result.affectedRows) return fail(res,'Customer event was not found.',404);
        return ok(res,{message:`Event ${status.toLowerCase()} successfully.`});
    } catch(error){
        console.error('Admin event status error:',error);
        return fail(res,error.message);
    }
};

exports.deleteEvent = async (req,res) => {
    try {
        const id=idValue(req.params.id);
        if(!id) return fail(res,'A valid event ID is required.',400);
        const [rows]=await db.query(`SELECT status FROM customer_events WHERE id=? LIMIT 1`,[id]);
        if(!rows.length) return fail(res,'Customer event was not found.',404);
        if(rows[0].status === 'Active') return fail(res,'Pause the event before permanently deleting it.',400);
        await db.query(`DELETE FROM customer_events WHERE id=?`,[id]);
        return ok(res,{message:'Customer event permanently deleted.'});
    } catch(error){
        console.error('Admin event delete error:',error);
        return fail(res,error.message);
    }
};
