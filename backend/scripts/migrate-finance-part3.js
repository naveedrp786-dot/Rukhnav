"use strict";

require("dotenv").config();
const db = require("../config/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS accounting_source_events (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                source_type VARCHAR(80) NOT NULL,
                source_id BIGINT NOT NULL,
                event_key VARCHAR(80) NOT NULL,
                journal_entry_id BIGINT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                UNIQUE KEY uq_accounting_source_event (
                    source_type,
                    source_id,
                    event_key
                ),

                INDEX idx_accounting_source_journal (
                    journal_entry_id
                ),

                CONSTRAINT fk_accounting_source_journal
                    FOREIGN KEY (journal_entry_id)
                    REFERENCES journal_entries(id)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS finance_automation_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                description VARCHAR(500) NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS finance_category_gl_map (
                id INT AUTO_INCREMENT PRIMARY KEY,
                finance_category_id INT NOT NULL,
                accounting_account_id INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                UNIQUE KEY uq_finance_category_map (
                    finance_category_id
                ),

                CONSTRAINT fk_finance_category_map_category
                    FOREIGN KEY (finance_category_id)
                    REFERENCES finance_expense_categories(id)
                    ON UPDATE CASCADE
                    ON DELETE CASCADE,

                CONSTRAINT fk_finance_category_map_account
                    FOREIGN KEY (accounting_account_id)
                    REFERENCES accounting_accounts(id)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            INSERT INTO accounting_accounts
                (
                    account_code,
                    account_name,
                    account_type,
                    normal_balance,
                    allow_posting,
                    description
                )
            VALUES
                ('1130', 'Bank Clearing', 'Asset', 'Debit', 1, 'Bank and card payment clearing'),
                ('1140', 'Mobile Wallet Clearing', 'Asset', 'Debit', 1, 'JazzCash and Easypaisa clearing'),
                ('4300', 'Sales Discounts', 'Revenue', 'Debit', 1, 'Contra-revenue for coupons and discounts'),
                ('2190', 'Payment Clearing Liability', 'Liability', 'Credit', 1, 'Unidentified payment clearing'),
                ('3300', 'Opening Balance Equity', 'Equity', 'Credit', 1, 'Opening balance counterpart')
            ON DUPLICATE KEY UPDATE
                account_name = VALUES(account_name),
                account_type = VALUES(account_type),
                normal_balance = VALUES(normal_balance),
                allow_posting = VALUES(allow_posting),
                description = VALUES(description)
        `);

        await db.query(`
            INSERT INTO finance_automation_settings
                (setting_key, setting_value, description)
            VALUES
                ('AUTO_POST_CUSTOMER_PAYMENTS', 'true', 'Post paid customer collections automatically'),
                ('AUTO_POST_CUSTOMER_REFUNDS', 'true', 'Post completed customer refunds automatically'),
                ('AUTO_POST_SUPPLIER_PAYMENTS', 'true', 'Post supplier payments automatically'),
                ('AUTO_POST_FINANCE_TRANSACTIONS', 'true', 'Post manual cash-book entries automatically'),
                ('CUSTOMER_PAYMENT_CREDIT_ACCOUNT', '1200', 'Accounts Receivable'),
                ('SUPPLIER_PAYMENT_DEBIT_ACCOUNT', '2100', 'Accounts Payable'),
                ('MANUAL_INCOME_CREDIT_ACCOUNT', '4200', 'Other Income'),
                ('ADJUSTMENT_COUNTERPART_ACCOUNT', '3200', 'Retained Earnings')
            ON DUPLICATE KEY UPDATE
                description = VALUES(description)
        `);

        await db.query(`
            INSERT IGNORE INTO finance_account_gl_map
                (finance_account_id, accounting_account_id)
            SELECT
                fa.id,
                aa.id
            FROM finance_accounts fa
            JOIN accounting_accounts aa
              ON aa.account_code =
                 CASE
                    WHEN fa.account_type = 'Cash' THEN '1110'
                    WHEN fa.account_type = 'Bank' THEN '1130'
                    ELSE '1140'
                 END
        `);

        await db.query(`
            INSERT IGNORE INTO finance_category_gl_map
                (finance_category_id, accounting_account_id)
            SELECT
                fc.id,
                aa.id
            FROM finance_expense_categories fc
            JOIN accounting_accounts aa
              ON aa.account_code =
                 CASE fc.category_name
                    WHEN 'Courier' THEN '6110'
                    WHEN 'Electricity' THEN '6120'
                    WHEN 'Internet' THEN '6130'
                    WHEN 'Marketing' THEN '6140'
                    WHEN 'Office Rent' THEN '6150'
                    WHEN 'Petrol' THEN '6160'
                    WHEN 'Salary' THEN '6170'
                    WHEN 'Supplies' THEN '6180'
                    ELSE '6190'
                 END
        `);

        console.log("Finance Module Part 3 migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Finance Module Part 3 migration failed:", error);
        process.exit(1);
    }
}

run();
