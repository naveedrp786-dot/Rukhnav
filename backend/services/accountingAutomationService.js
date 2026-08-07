"use strict";

const db = require("../config/db");

function dateOnly(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
}

function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.round(number * 100) / 100;
}

function journalNumber(id, date) {
    return `AJ-${String(date).replaceAll("-", "")}-${String(id).padStart(6, "0")}`;
}

async function setting(connection, key, fallback = null) {
    const [[row]] = await connection.query(
        `SELECT setting_value FROM finance_automation_settings WHERE setting_key = ? LIMIT 1`,
        [key]
    );
    return row ? row.setting_value : fallback;
}

async function enabled(connection, key) {
    return String(await setting(connection, key, "true")).toLowerCase() === "true";
}

async function accountByCode(connection, code) {
    const [[account]] = await connection.query(
        `
        SELECT id, account_code, account_name, status, allow_posting
        FROM accounting_accounts
        WHERE account_code = ?
        LIMIT 1
        `,
        [code]
    );
    if (!account || account.status !== "Active" || !Number(account.allow_posting)) {
        throw new Error(`Accounting account ${code} is unavailable for posting.`);
    }
    return account;
}

async function accountForPaymentMethod(connection, method) {
    const value = String(method || "").toLowerCase().replaceAll("_", " ");
    if (value.includes("cash") || value === "cod") {
        return accountByCode(connection, "1110");
    }
    if (value.includes("jazz") || value.includes("easypaisa") || value.includes("wallet")) {
        return accountByCode(connection, "1140");
    }
    return accountByCode(connection, "1130");
}

async function sourceExists(connection, sourceType, sourceId, eventKey) {
    const [[row]] = await connection.query(
        `
        SELECT id, journal_entry_id
        FROM accounting_source_events
        WHERE source_type = ?
          AND source_id = ?
          AND event_key = ?
        LIMIT 1
        `,
        [sourceType, sourceId, eventKey]
    );
    return row || null;
}

async function createPostedJournal(connection, {
    sourceType,
    sourceId,
    eventKey,
    journalDate,
    referenceType,
    referenceNumber,
    narration,
    adminId = null,
    lines
}) {
    const existing = await sourceExists(
        connection,
        sourceType,
        sourceId,
        eventKey
    );
    if (existing) {
        return {
            created: false,
            journalEntryId: existing.journal_entry_id
        };
    }

    const normalized = lines
        .map(line => ({
            accountId: Number(line.accountId),
            description: String(line.description || narration).slice(0, 500),
            debit: money(line.debit),
            credit: money(line.credit)
        }))
        .filter(line => line.accountId && (line.debit > 0 || line.credit > 0));

    const totalDebit = money(normalized.reduce((sum, line) => sum + line.debit, 0));
    const totalCredit = money(normalized.reduce((sum, line) => sum + line.credit, 0));

    if (normalized.length < 2 || totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.009) {
        throw new Error(
            `Automatic journal is not balanced. Debit PKR ${totalDebit.toFixed(2)}, Credit PKR ${totalCredit.toFixed(2)}.`
        );
    }

    const date = dateOnly(journalDate);
    const [result] = await connection.query(
        `
        INSERT INTO journal_entries
            (
                journal_date,
                reference_type,
                reference_id,
                reference_number,
                narration,
                status,
                total_debit,
                total_credit,
                posted_by,
                posted_at,
                created_by
            )
        VALUES (?, ?, ?, ?, ?, 'Posted', ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `,
        [
            date,
            referenceType || sourceType,
            sourceId,
            referenceNumber || null,
            narration,
            totalDebit,
            totalCredit,
            adminId,
            adminId
        ]
    );

    const number = journalNumber(result.insertId, date);
    await connection.query(
        `UPDATE journal_entries SET journal_number = ? WHERE id = ?`,
        [number, result.insertId]
    );

    for (let index = 0; index < normalized.length; index += 1) {
        const line = normalized[index];
        await connection.query(
            `
            INSERT INTO journal_entry_lines
                (
                    journal_entry_id,
                    line_number,
                    account_id,
                    description,
                    debit,
                    credit
                )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                result.insertId,
                index + 1,
                line.accountId,
                line.description,
                line.debit,
                line.credit
            ]
        );
    }

    await connection.query(
        `
        INSERT INTO accounting_source_events
            (
                source_type,
                source_id,
                event_key,
                journal_entry_id
            )
        VALUES (?, ?, ?, ?)
        `,
        [sourceType, sourceId, eventKey, result.insertId]
    );

    return {
        created: true,
        journalEntryId: result.insertId,
        journalNumber: number
    };
}

async function postCustomerPayment(connection, payment, adminId = null) {
    if (!await enabled(connection, "AUTO_POST_CUSTOMER_PAYMENTS")) {
        return {created:false, skipped:true};
    }
    if (String(payment.status) !== "Paid") {
        return {created:false, skipped:true};
    }

    const cashAccount = await accountForPaymentMethod(connection, payment.payment_method);
    const receivable = await accountByCode(
        connection,
        await setting(connection, "CUSTOMER_PAYMENT_CREDIT_ACCOUNT", "1200")
    );

    return createPostedJournal(connection, {
        sourceType: "Customer Payment",
        sourceId: payment.id,
        eventKey: "PAYMENT_PAID",
        journalDate: payment.paid_at || payment.created_at,
        referenceType: "Order Payment",
        referenceNumber: payment.payment_number || payment.transaction_reference,
        narration: `Customer payment received for order ${payment.order_id}.`,
        adminId,
        lines: [
            {
                accountId: cashAccount.id,
                debit: payment.amount,
                credit: 0,
                description: `Payment received via ${payment.payment_method}`
            },
            {
                accountId: receivable.id,
                debit: 0,
                credit: payment.amount,
                description: "Settlement of customer receivable"
            }
        ]
    });
}

async function postCustomerRefund(connection, refund, payment, adminId = null) {
    if (!await enabled(connection, "AUTO_POST_CUSTOMER_REFUNDS")) {
        return {created:false, skipped:true};
    }

    const cashAccount = await accountForPaymentMethod(connection, payment.payment_method);
    const receivable = await accountByCode(
        connection,
        await setting(connection, "CUSTOMER_PAYMENT_CREDIT_ACCOUNT", "1200")
    );

    return createPostedJournal(connection, {
        sourceType: "Customer Refund",
        sourceId: refund.id,
        eventKey: "REFUND_COMPLETED",
        journalDate: refund.completed_at || refund.created_at,
        referenceType: "Payment Refund",
        referenceNumber: refund.refund_number || refund.transaction_reference,
        narration: `Customer refund for order ${refund.order_id}.`,
        adminId,
        lines: [
            {
                accountId: receivable.id,
                debit: refund.amount,
                credit: 0,
                description: "Reverse customer receivable settlement"
            },
            {
                accountId: cashAccount.id,
                debit: 0,
                credit: refund.amount,
                description: `Refund paid via ${payment.payment_method}`
            }
        ]
    });
}

async function postSupplierPayment(connection, payment, adminId = null) {
    if (!await enabled(connection, "AUTO_POST_SUPPLIER_PAYMENTS")) {
        return {created:false, skipped:true};
    }

    const payable = await accountByCode(
        connection,
        await setting(connection, "SUPPLIER_PAYMENT_DEBIT_ACCOUNT", "2100")
    );
    const cashAccount = await accountForPaymentMethod(connection, payment.payment_method);

    return createPostedJournal(connection, {
        sourceType: "Supplier Payment",
        sourceId: payment.id,
        eventKey: "SUPPLIER_PAYMENT_POSTED",
        journalDate: payment.payment_date,
        referenceType: "Purchase Payment",
        referenceNumber: payment.payment_number || payment.reference_no,
        narration: `Supplier payment posted against purchase order ${payment.purchase_order_id}.`,
        adminId,
        lines: [
            {
                accountId: payable.id,
                debit: payment.amount,
                credit: 0,
                description: "Settlement of supplier payable"
            },
            {
                accountId: cashAccount.id,
                debit: 0,
                credit: payment.amount,
                description: `Supplier payment via ${payment.payment_method}`
            }
        ]
    });
}

async function financeGlAccount(connection, financeAccountId) {
    const [[row]] = await connection.query(
        `
        SELECT aa.id, aa.account_code, aa.account_name
        FROM finance_account_gl_map map
        JOIN accounting_accounts aa
          ON aa.id = map.accounting_account_id
        WHERE map.finance_account_id = ?
        LIMIT 1
        `,
        [financeAccountId]
    );
    if (!row) throw new Error("Finance account has no general-ledger mapping.");
    return row;
}

async function expenseGlAccount(connection, categoryId) {
    const [[row]] = await connection.query(
        `
        SELECT aa.id, aa.account_code, aa.account_name
        FROM finance_category_gl_map map
        JOIN accounting_accounts aa
          ON aa.id = map.accounting_account_id
        WHERE map.finance_category_id = ?
        LIMIT 1
        `,
        [categoryId]
    );
    return row || accountByCode(connection, "6190");
}

async function postFinanceTransaction(connection, transaction, adminId = null) {
    if (!await enabled(connection, "AUTO_POST_FINANCE_TRANSACTIONS")) {
        return {created:false, skipped:true};
    }
    if (transaction.status !== "Posted") {
        return {created:false, skipped:true};
    }

    const cashAccount = await financeGlAccount(connection, transaction.account_id);
    let debitAccount;
    let creditAccount;

    if (transaction.transaction_type === "Income") {
        debitAccount = cashAccount;
        creditAccount = await accountByCode(
            connection,
            await setting(connection, "MANUAL_INCOME_CREDIT_ACCOUNT", "4200")
        );
    } else if (transaction.transaction_type === "Expense") {
        debitAccount = await expenseGlAccount(connection, transaction.category_id);
        creditAccount = cashAccount;
    } else {
        const counterpart = await accountByCode(
            connection,
            await setting(connection, "ADJUSTMENT_COUNTERPART_ACCOUNT", "3200")
        );
        if (money(transaction.amount) >= 0) {
            debitAccount = cashAccount;
            creditAccount = counterpart;
        } else {
            debitAccount = counterpart;
            creditAccount = cashAccount;
        }
    }

    const amount = Math.abs(money(transaction.amount));

    return createPostedJournal(connection, {
        sourceType: "Finance Transaction",
        sourceId: transaction.id,
        eventKey: "FINANCE_TRANSACTION_POSTED",
        journalDate: transaction.transaction_date,
        referenceType: transaction.reference_type || "Manual Finance",
        referenceNumber: transaction.transaction_number || transaction.reference_number,
        narration: transaction.description,
        adminId,
        lines: [
            {
                accountId: debitAccount.id,
                debit: amount,
                credit: 0,
                description: transaction.description
            },
            {
                accountId: creditAccount.id,
                debit: 0,
                credit: amount,
                description: transaction.description
            }
        ]
    });
}

module.exports = {
    createPostedJournal,
    postCustomerPayment,
    postCustomerRefund,
    postSupplierPayment,
    postFinanceTransaction
};
