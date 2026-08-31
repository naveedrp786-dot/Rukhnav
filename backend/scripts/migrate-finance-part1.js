"use strict";

require("dotenv").config();

const db = require("../config/db");

async function run() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS finance_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_name VARCHAR(120) NOT NULL,
                account_type ENUM(
                    'Cash',
                    'Bank',
                    'Mobile Wallet'
                ) NOT NULL,
                institution_name VARCHAR(120) NULL,
                account_number VARCHAR(100) NULL,
                opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
                status ENUM(
                    'Active',
                    'Inactive'
                ) NOT NULL DEFAULT 'Active',
                notes VARCHAR(500) NULL,
                created_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uq_finance_account_name (
                    account_name
                ),

                INDEX idx_finance_accounts_status (
                    status,
                    account_type
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS finance_expense_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_name VARCHAR(100) NOT NULL,
                description VARCHAR(500) NULL,
                status ENUM(
                    'Active',
                    'Inactive'
                ) NOT NULL DEFAULT 'Active',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uq_finance_expense_category (
                    category_name
                )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS finance_transactions (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                transaction_number VARCHAR(40) NULL,
                transaction_date DATE NOT NULL,
                transaction_type ENUM(
                    'Income',
                    'Expense',
                    'Transfer In',
                    'Transfer Out',
                    'Opening Balance',
                    'Adjustment'
                ) NOT NULL,
                account_id INT NOT NULL,
                category_id INT NULL,
                amount DECIMAL(15,2) NOT NULL,
                reference_type VARCHAR(80) NULL,
                reference_id BIGINT NULL,
                reference_number VARCHAR(150) NULL,
                description VARCHAR(1000) NOT NULL,
                status ENUM(
                    'Posted',
                    'Cancelled'
                ) NOT NULL DEFAULT 'Posted',
                created_by INT NULL,
                cancelled_by INT NULL,
                cancelled_at DATETIME NULL,
                cancellation_reason VARCHAR(500) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                UNIQUE KEY uq_finance_transaction_number (
                    transaction_number
                ),

                INDEX idx_finance_transactions_date (
                    transaction_date,
                    status
                ),

                INDEX idx_finance_transactions_account (
                    account_id,
                    transaction_date
                ),

                INDEX idx_finance_transactions_reference (
                    reference_type,
                    reference_id
                ),

                CONSTRAINT fk_finance_transaction_account
                    FOREIGN KEY (account_id)
                    REFERENCES finance_accounts(id)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT,

                CONSTRAINT fk_finance_transaction_category
                    FOREIGN KEY (category_id)
                    REFERENCES finance_expense_categories(id)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        await db.query(`
            INSERT INTO finance_accounts
                (
                    account_name,
                    account_type,
                    institution_name,
                    opening_balance,
                    status,
                    notes
                )
            VALUES
                (
                    'Main Cash',
                    'Cash',
                    'RUKHNAV',
                    0,
                    'Active',
                    'Primary cash account'
                )
            ON DUPLICATE KEY UPDATE
                account_name =
                    VALUES(account_name)
        `);

        await db.query(`
            INSERT INTO finance_expense_categories
                (
                    category_name,
                    description
                )
            VALUES
                ('Courier', 'Courier and delivery charges'),
                ('Electricity', 'Electricity and utility charges'),
                ('Internet', 'Internet and communication costs'),
                ('Marketing', 'Advertising and promotional costs'),
                ('Office Rent', 'Office, shop or warehouse rent'),
                ('Petrol', 'Fuel and transportation costs'),
                ('Salary', 'Employee salaries and wages'),
                ('Supplies', 'Office and operational supplies'),
                ('Miscellaneous', 'Other business expenses')
            ON DUPLICATE KEY UPDATE
                description =
                    VALUES(description)
        `);

        console.log(
            "Finance Module Part 1 migration completed successfully."
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Finance Module Part 1 migration failed:",
            error
        );

        process.exit(1);
    }
}

run();
