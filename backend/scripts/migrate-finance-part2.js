"use strict";
require("dotenv").config();
const db = require("../config/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS accounting_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_code VARCHAR(20) NOT NULL UNIQUE,
                account_name VARCHAR(150) NOT NULL UNIQUE,
                account_type ENUM('Asset','Liability','Equity','Revenue','Expense') NOT NULL,
                parent_account_id INT NULL,
                normal_balance ENUM('Debit','Credit') NOT NULL,
                allow_posting TINYINT(1) NOT NULL DEFAULT 1,
                status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                description VARCHAR(500) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_account_type_status (account_type,status),
                CONSTRAINT fk_account_parent FOREIGN KEY (parent_account_id)
                    REFERENCES accounting_accounts(id)
                    ON UPDATE CASCADE ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS journal_entries (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                journal_number VARCHAR(40) NULL UNIQUE,
                journal_date DATE NOT NULL,
                reference_type VARCHAR(80) NULL,
                reference_id BIGINT NULL,
                reference_number VARCHAR(150) NULL,
                narration VARCHAR(1000) NOT NULL,
                status ENUM('Draft','Posted','Reversed') NOT NULL DEFAULT 'Draft',
                total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
                total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
                posted_by INT NULL,
                posted_at DATETIME NULL,
                reversed_by INT NULL,
                reversed_at DATETIME NULL,
                reversal_reason VARCHAR(500) NULL,
                reversal_entry_id BIGINT NULL,
                created_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_journal_date_status (journal_date,status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS journal_entry_lines (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                journal_entry_id BIGINT NOT NULL,
                line_number INT NOT NULL,
                account_id INT NOT NULL,
                description VARCHAR(500) NULL,
                debit DECIMAL(15,2) NOT NULL DEFAULT 0,
                credit DECIMAL(15,2) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_journal_line (journal_entry_id,line_number),
                INDEX idx_line_account (account_id,journal_entry_id),
                CONSTRAINT fk_line_journal FOREIGN KEY (journal_entry_id)
                    REFERENCES journal_entries(id)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_line_account FOREIGN KEY (account_id)
                    REFERENCES accounting_accounts(id)
                    ON UPDATE CASCADE ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS finance_account_gl_map (
                id INT AUTO_INCREMENT PRIMARY KEY,
                finance_account_id INT NOT NULL UNIQUE,
                accounting_account_id INT NOT NULL UNIQUE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_map_finance FOREIGN KEY (finance_account_id)
                    REFERENCES finance_accounts(id)
                    ON UPDATE CASCADE ON DELETE CASCADE,
                CONSTRAINT fk_map_gl FOREIGN KEY (accounting_account_id)
                    REFERENCES accounting_accounts(id)
                    ON UPDATE CASCADE ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            INSERT INTO accounting_accounts
                (account_code,account_name,account_type,normal_balance,allow_posting,description)
            VALUES
                ('1000','Assets','Asset','Debit',0,'Assets control account'),
                ('1100','Cash and Cash Equivalents','Asset','Debit',0,'Cash control account'),
                ('1110','Main Cash','Asset','Debit',1,'Primary cash account'),
                ('1120','Bank Accounts','Asset','Debit',0,'Bank control account'),
                ('1200','Accounts Receivable','Asset','Debit',1,'Customer balances due'),
                ('1300','Inventory','Asset','Debit',1,'Inventory value'),
                ('1500','Property and Equipment','Asset','Debit',1,'Fixed assets'),
                ('2000','Liabilities','Liability','Credit',0,'Liabilities control account'),
                ('2100','Accounts Payable','Liability','Credit',1,'Supplier balances due'),
                ('2200','Accrued Expenses','Liability','Credit',1,'Accrued expenses'),
                ('3000','Equity','Equity','Credit',0,'Equity control account'),
                ('3100','Owner Capital','Equity','Credit',1,'Owner capital'),
                ('3200','Retained Earnings','Equity','Credit',1,'Retained earnings'),
                ('4000','Revenue','Revenue','Credit',0,'Revenue control account'),
                ('4100','Product Sales','Revenue','Credit',1,'Product sales'),
                ('4200','Other Income','Revenue','Credit',1,'Other income'),
                ('5000','Cost of Sales','Expense','Debit',0,'Cost of sales control account'),
                ('5100','Cost of Goods Sold','Expense','Debit',1,'Cost of goods sold'),
                ('6000','Operating Expenses','Expense','Debit',0,'Operating expense control account'),
                ('6110','Courier Expense','Expense','Debit',1,'Courier expense'),
                ('6120','Electricity Expense','Expense','Debit',1,'Electricity expense'),
                ('6130','Internet Expense','Expense','Debit',1,'Internet expense'),
                ('6140','Marketing Expense','Expense','Debit',1,'Marketing expense'),
                ('6150','Rent Expense','Expense','Debit',1,'Rent expense'),
                ('6160','Fuel Expense','Expense','Debit',1,'Fuel expense'),
                ('6170','Salary Expense','Expense','Debit',1,'Salary expense'),
                ('6180','Office Supplies Expense','Expense','Debit',1,'Office supplies'),
                ('6190','Miscellaneous Expense','Expense','Debit',1,'Miscellaneous expense')
            ON DUPLICATE KEY UPDATE
                account_name=VALUES(account_name),
                account_type=VALUES(account_type),
                normal_balance=VALUES(normal_balance),
                allow_posting=VALUES(allow_posting),
                description=VALUES(description)
        `);

        console.log("Finance Part 2 migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Finance Part 2 migration failed:", error);
        process.exit(1);
    }
}
run();
