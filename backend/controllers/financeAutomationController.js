"use strict";

const db = require("../config/db");
const automation =
    require("../services/accountingAutomationService");

function adminId(req) {
    return req.admin?.id || req.admin?.adminId || req.admin?.userId || null;
}

async function tableExists(table) {
    const [rows] = await db.query(
        `
        SELECT 1
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
        LIMIT 1
        `,
        [table]
    );
    return rows.length > 0;
}

exports.getAutomationDashboard = async (req, res) => {
    try {
        const [settings] = await db.query(
            `
            SELECT setting_key, setting_value, description, updated_at
            FROM finance_automation_settings
            ORDER BY setting_key
            `
        );

        const [[journalSummary]] = await db.query(
            `
            SELECT
                COUNT(*) AS total_journals,
                SUM(status = 'Posted') AS posted_journals,
                SUM(status = 'Draft') AS draft_journals,
                SUM(status = 'Reversed') AS reversed_journals,
                COALESCE(SUM(CASE WHEN status = 'Posted' THEN total_debit ELSE 0 END),0) AS posted_value
            FROM journal_entries
            `
        );

        const [[sourceSummary]] = await db.query(
            `
            SELECT
                COUNT(*) AS automated_events,
                COUNT(DISTINCT source_type) AS source_types
            FROM accounting_source_events
            `
        );

        const [recent] = await db.query(
            `
            SELECT
                ase.id,
                ase.source_type,
                ase.source_id,
                ase.event_key,
                ase.created_at,
                je.journal_number,
                je.journal_date,
                je.narration,
                je.total_debit
            FROM accounting_source_events ase
            JOIN journal_entries je
              ON je.id = ase.journal_entry_id
            ORDER BY ase.id DESC
            LIMIT 20
            `
        );

        let couponSummary = {
            totalCoupons: 0,
            activeCoupons: 0,
            redeemedCount: 0,
            discountImpact: 0
        };

        if (await tableExists("coupons")) {
            const [[row]] = await db.query(`
                SELECT
                    COUNT(*) AS totalCoupons,
                    SUM(LOWER(status) = 'active') AS activeCoupons,
                    COALESCE(SUM(used_count),0) AS redeemedCount
                FROM coupons
            `);
            couponSummary = {
                ...couponSummary,
                totalCoupons: Number(row.totalCoupons || 0),
                activeCoupons: Number(row.activeCoupons || 0),
                redeemedCount: Number(row.redeemedCount || 0)
            };
        }

        if (await tableExists("orders")) {
            const [[row]] = await db.query(`
                SELECT
                    COALESCE(SUM(discount_amount),0) AS discountImpact
                FROM orders
                WHERE order_status != 'Cancelled'
            `);
            couponSummary.discountImpact = Number(row.discountImpact || 0);
        }

        res.json({
            success: true,
            settings,
            journalSummary: {
                totalJournals: Number(journalSummary.total_journals || 0),
                postedJournals: Number(journalSummary.posted_journals || 0),
                draftJournals: Number(journalSummary.draft_journals || 0),
                reversedJournals: Number(journalSummary.reversed_journals || 0),
                postedValue: Number(journalSummary.posted_value || 0)
            },
            sourceSummary: {
                automatedEvents: Number(sourceSummary.automated_events || 0),
                sourceTypes: Number(sourceSummary.source_types || 0)
            },
            couponSummary,
            recent: recent.map(row => ({
                ...row,
                total_debit: Number(row.total_debit || 0)
            }))
        });
    } catch (error) {
        console.error("Finance automation dashboard error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load finance automation dashboard.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.updateAutomationSetting = async (req, res) => {
    try {
        const key = String(req.params.key || "").trim();
        const value = String(req.body.setting_value ?? "").trim();

        if (!key || !value) {
            return res.status(400).json({
                success: false,
                message: "Setting key and value are required."
            });
        }

        const [result] = await db.query(
            `
            UPDATE finance_automation_settings
            SET setting_value = ?
            WHERE setting_key = ?
            `,
            [value, key]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Finance automation setting was not found."
            });
        }

        res.json({
            success: true,
            message: "Finance automation setting updated successfully."
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to update finance automation setting."
        });
    }
};

exports.reconcile = async (req, res) => {
    const connection = await db.getConnection();
    const summary = {
        customerPayments: 0,
        customerRefunds: 0,
        supplierPayments: 0,
        financeTransactions: 0,
        skipped: 0,
        failed: []
    };

    try {
        await connection.beginTransaction();

        if (await tableExists("payment_transactions")) {
            const [payments] = await connection.query(
                `
                SELECT *
                FROM payment_transactions
                WHERE status = 'Paid'
                ORDER BY id
                `
            );
            for (const payment of payments) {
                try {
                    const result = await automation.postCustomerPayment(
                        connection,
                        payment,
                        adminId(req)
                    );
                    result.created ? summary.customerPayments++ : summary.skipped++;
                } catch (error) {
                    summary.failed.push(`Customer payment ${payment.id}: ${error.message}`);
                }
            }
        }

        if (await tableExists("payment_refunds")) {
            const [refunds] = await connection.query(
                `
                SELECT
                    pr.*,
                    pt.payment_method
                FROM payment_refunds pr
                JOIN payment_transactions pt
                  ON pt.id = pr.payment_transaction_id
                WHERE pr.status = 'Completed'
                ORDER BY pr.id
                `
            );
            for (const refund of refunds) {
                try {
                    const result = await automation.postCustomerRefund(
                        connection,
                        refund,
                        refund,
                        adminId(req)
                    );
                    result.created ? summary.customerRefunds++ : summary.skipped++;
                } catch (error) {
                    summary.failed.push(`Customer refund ${refund.id}: ${error.message}`);
                }
            }
        }

        if (await tableExists("supplier_payments")) {
            const [payments] = await connection.query(
                `
                SELECT *
                FROM supplier_payments
                WHERE status = 'Posted'
                ORDER BY id
                `
            );
            for (const payment of payments) {
                try {
                    const result = await automation.postSupplierPayment(
                        connection,
                        payment,
                        adminId(req)
                    );
                    result.created ? summary.supplierPayments++ : summary.skipped++;
                } catch (error) {
                    summary.failed.push(`Supplier payment ${payment.id}: ${error.message}`);
                }
            }
        }

        const [transactions] = await connection.query(
            `
            SELECT *
            FROM finance_transactions
            WHERE status = 'Posted'
            ORDER BY id
            `
        );
        for (const transaction of transactions) {
            try {
                const result = await automation.postFinanceTransaction(
                    connection,
                    transaction,
                    adminId(req)
                );
                result.created ? summary.financeTransactions++ : summary.skipped++;
            } catch (error) {
                summary.failed.push(`Finance transaction ${transaction.id}: ${error.message}`);
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: "Finance reconciliation completed.",
            summary
        });
    } catch (error) {
        await connection.rollback();
        console.error("Finance reconciliation error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Unable to reconcile finance records."
        });
    } finally {
        connection.release();
    }
};

exports.getFinanceOperations = async (req, res) => {
    try {
        const [[customerPayments]] = await db.query(`
            SELECT
                COUNT(*) AS total_count,
                COALESCE(SUM(CASE WHEN status IN ('Paid','Partially Refunded') THEN amount - COALESCE(refunded_amount,0) ELSE 0 END),0) AS net_collected,
                COALESCE(SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END),0) AS pending_amount,
                COALESCE(SUM(refunded_amount),0) AS refunded_amount
            FROM payment_transactions
        `);

        let supplier = {total_count:0,total_paid:0};
        if (await tableExists("supplier_payments")) {
            [[supplier]] = await db.query(`
                SELECT
                    COUNT(*) AS total_count,
                    COALESCE(SUM(CASE WHEN status = 'Posted' THEN amount ELSE 0 END),0) AS total_paid
                FROM supplier_payments
            `);
        }

        let coupons = {total_count:0,active_count:0,used_count:0};
        if (await tableExists("coupons")) {
            [[coupons]] = await db.query(`
                SELECT
                    COUNT(*) AS total_count,
                    SUM(LOWER(status) = 'active') AS active_count,
                    COALESCE(SUM(used_count),0) AS used_count
                FROM coupons
            `);
        }

        const [[discounts]] = await db.query(`
            SELECT
                COALESCE(SUM(discount_amount),0) AS discount_total
            FROM orders
            WHERE order_status != 'Cancelled'
        `);

        res.json({
            success: true,
            customerPayments: {
                totalCount: Number(customerPayments.total_count || 0),
                netCollected: Number(customerPayments.net_collected || 0),
                pendingAmount: Number(customerPayments.pending_amount || 0),
                refundedAmount: Number(customerPayments.refunded_amount || 0)
            },
            supplierPayments: {
                totalCount: Number(supplier.total_count || 0),
                totalPaid: Number(supplier.total_paid || 0)
            },
            coupons: {
                totalCount: Number(coupons.total_count || 0),
                activeCount: Number(coupons.active_count || 0),
                usedCount: Number(coupons.used_count || 0),
                discountTotal: Number(discounts.discount_total || 0)
            }
        });
    } catch (error) {
        console.error("Finance operations error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load payments and coupon finance summary.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};
