"use strict";

const db = require("../config/db");
const accountingAutomation = require("../services/accountingAutomationService");

const TYPES = [
    "Income",
    "Expense",
    "Adjustment"
];

const ACCOUNT_TYPES = [
    "Cash",
    "Bank",
    "Mobile Wallet"
];

function clean(
    value,
    maximum = 1000
) {
    return String(value || "")
        .trim()
        .slice(0, maximum);
}

function positiveNumber(
    value
) {
    const number =
        Number(value);

    return (
        Number.isFinite(number) &&
        number > 0
    )
        ? number
        : null;
}

function positiveInteger(
    value
) {
    const number =
        Number.parseInt(
            value,
            10
        );

    return (
        Number.isInteger(number) &&
        number > 0
    )
        ? number
        : null;
}

function adminId(
    req
) {
    return (
        req.admin?.id ||
        req.admin?.adminId ||
        req.admin?.userId ||
        null
    );
}

function transactionNumber(
    id,
    date
) {
    const compactDate =
        String(date)
            .replaceAll("-", "");

    return (
        `FIN-${compactDate}-${String(id)
            .padStart(6, "0")}`
    );
}

async function tableExists(
    tableName
) {
    const [rows] =
        await db.query(
            `
            SELECT 1
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA =
                DATABASE()
              AND TABLE_NAME = ?
            LIMIT 1
            `,
            [tableName]
        );

    return rows.length > 0;
}

async function scalar(
    sql,
    values = []
) {
    try {
        const [[row]] =
            await db.query(
                sql,
                values
            );

        return Number(
            row?.total || 0
        );
    } catch (error) {
        console.warn(
            "Finance scalar query skipped:",
            error.message
        );

        return 0;
    }
}

exports.getDashboard = async (
    req,
    res
) => {
    try {
        const hasPayments =
            await tableExists(
                "payment_transactions"
            );

        const hasSupplierPayments =
            await tableExists(
                "supplier_payments"
            );

        const customerCollections =
            hasPayments
                ? await scalar(`
                    SELECT
                        COALESCE(
                            SUM(
                                amount -
                                COALESCE(
                                    refunded_amount,
                                    0
                                )
                            ),
                            0
                        ) AS total
                    FROM payment_transactions
                    WHERE status IN (
                        'Paid',
                        'Partially Refunded'
                    )
                `)
                : 0;

        const supplierPayments =
            hasSupplierPayments
                ? await scalar(`
                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS total
                    FROM supplier_payments
                    WHERE status = 'Posted'
                `)
                : 0;

        const manualIncome =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total
                FROM finance_transactions
                WHERE
                    transaction_type IN (
                        'Income',
                        'Transfer In',
                        'Opening Balance'
                    )
                    AND status = 'Posted'
            `);

        const manualExpenses =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total
                FROM finance_transactions
                WHERE
                    transaction_type IN (
                        'Expense',
                        'Transfer Out'
                    )
                    AND status = 'Posted'
            `);

        const openingBalances =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(opening_balance),
                        0
                    ) AS total
                FROM finance_accounts
                WHERE status = 'Active'
            `);

        const todayIncome =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total
                FROM finance_transactions
                WHERE
                    transaction_type IN (
                        'Income',
                        'Transfer In'
                    )
                    AND status = 'Posted'
                    AND transaction_date =
                        CURRENT_DATE
            `) +
            (
                hasPayments
                    ? await scalar(`
                        SELECT
                            COALESCE(
                                SUM(
                                    amount -
                                    COALESCE(
                                        refunded_amount,
                                        0
                                    )
                                ),
                                0
                            ) AS total
                        FROM payment_transactions
                        WHERE status IN (
                            'Paid',
                            'Partially Refunded'
                        )
                          AND DATE(
                                COALESCE(
                                    paid_at,
                                    created_at
                                )
                              ) = CURRENT_DATE
                    `)
                    : 0
            );

        const todayOutflow =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total
                FROM finance_transactions
                WHERE
                    transaction_type IN (
                        'Expense',
                        'Transfer Out'
                    )
                    AND status = 'Posted'
                    AND transaction_date =
                        CURRENT_DATE
            `) +
            (
                hasSupplierPayments
                    ? await scalar(`
                        SELECT
                            COALESCE(
                                SUM(amount),
                                0
                            ) AS total
                        FROM supplier_payments
                        WHERE status = 'Posted'
                          AND payment_date =
                              CURRENT_DATE
                    `)
                    : 0
            );

        const monthIncome =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total
                FROM finance_transactions
                WHERE
                    transaction_type IN (
                        'Income',
                        'Transfer In'
                    )
                    AND status = 'Posted'
                    AND YEAR(transaction_date) =
                        YEAR(CURRENT_DATE)
                    AND MONTH(transaction_date) =
                        MONTH(CURRENT_DATE)
            `) +
            (
                hasPayments
                    ? await scalar(`
                        SELECT
                            COALESCE(
                                SUM(
                                    amount -
                                    COALESCE(
                                        refunded_amount,
                                        0
                                    )
                                ),
                                0
                            ) AS total
                        FROM payment_transactions
                        WHERE status IN (
                            'Paid',
                            'Partially Refunded'
                        )
                          AND YEAR(
                                COALESCE(
                                    paid_at,
                                    created_at
                                )
                              ) =
                              YEAR(CURRENT_DATE)
                          AND MONTH(
                                COALESCE(
                                    paid_at,
                                    created_at
                                )
                              ) =
                              MONTH(CURRENT_DATE)
                    `)
                    : 0
            );

        const monthOutflow =
            await scalar(`
                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total
                FROM finance_transactions
                WHERE
                    transaction_type IN (
                        'Expense',
                        'Transfer Out'
                    )
                    AND status = 'Posted'
                    AND YEAR(transaction_date) =
                        YEAR(CURRENT_DATE)
                    AND MONTH(transaction_date) =
                        MONTH(CURRENT_DATE)
            `) +
            (
                hasSupplierPayments
                    ? await scalar(`
                        SELECT
                            COALESCE(
                                SUM(amount),
                                0
                            ) AS total
                        FROM supplier_payments
                        WHERE status = 'Posted'
                          AND YEAR(payment_date) =
                              YEAR(CURRENT_DATE)
                          AND MONTH(payment_date) =
                              MONTH(CURRENT_DATE)
                    `)
                    : 0
            );

        const totalIncome =
            customerCollections +
            manualIncome;

        const totalOutflow =
            supplierPayments +
            manualExpenses;

        const currentBalance =
            openingBalances +
            totalIncome -
            totalOutflow;

        const [accounts] =
            await db.query(`
                SELECT
                    a.id,
                    a.account_name,
                    a.account_type,
                    a.institution_name,
                    a.account_number,
                    a.opening_balance,
                    a.status,

                    (
                        a.opening_balance +
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN ft.status !=
                                        'Posted'
                                    THEN 0

                                    WHEN ft.transaction_type IN (
                                        'Income',
                                        'Transfer In',
                                        'Opening Balance'
                                    )
                                    THEN ft.amount

                                    WHEN ft.transaction_type IN (
                                        'Expense',
                                        'Transfer Out'
                                    )
                                    THEN -ft.amount

                                    ELSE 0
                                END
                            ),
                            0
                        )
                    ) AS current_balance

                FROM finance_accounts a

                LEFT JOIN finance_transactions ft
                    ON ft.account_id =
                        a.id

                GROUP BY
                    a.id

                ORDER BY
                    a.status = 'Active' DESC,
                    a.account_type,
                    a.account_name
            `);

        return res.json({
            success: true,

            summary: {
                openingBalances,
                customerCollections,
                manualIncome,
                totalIncome,
                supplierPayments,
                manualExpenses,
                totalOutflow,
                currentBalance,
                todayIncome,
                todayOutflow,
                todayNet:
                    todayIncome -
                    todayOutflow,
                monthIncome,
                monthOutflow,
                monthNet:
                    monthIncome -
                    monthOutflow
            },

            accounts:
                accounts.map(
                    account => ({
                        ...account,
                        opening_balance:
                            Number(
                                account
                                    .opening_balance || 0
                            ),
                        current_balance:
                            Number(
                                account
                                    .current_balance || 0
                            )
                    })
                )
        });
    } catch (error) {
        console.error(
            "Finance dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load finance dashboard.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

exports.getTransactions = async (
    req,
    res
) => {
    try {
        const page =
            positiveInteger(
                req.query.page
            ) || 1;

        const limit =
            Math.min(
                positiveInteger(
                    req.query.limit
                ) || 20,
                100
            );

        const offset =
            (page - 1) *
            limit;

        const type =
            clean(
                req.query.type,
                40
            );

        const accountId =
            positiveInteger(
                req.query.account_id
            );

        const search =
            clean(
                req.query.search,
                150
            );

        const conditions = [
            "1 = 1"
        ];

        const values = [];

        if (type) {
            conditions.push(
                "ft.transaction_type = ?"
            );
            values.push(type);
        }

        if (accountId) {
            conditions.push(
                "ft.account_id = ?"
            );
            values.push(accountId);
        }

        if (search) {
            const value =
                `%${search}%`;

            conditions.push(`
                (
                    ft.transaction_number LIKE ?
                    OR ft.reference_number LIKE ?
                    OR ft.description LIKE ?
                    OR a.account_name LIKE ?
                    OR ec.category_name LIKE ?
                )
            `);

            values.push(
                value,
                value,
                value,
                value,
                value
            );
        }

        const where =
            conditions.join(
                " AND "
            );

        const [[countRow]] =
            await db.query(
                `
                SELECT
                    COUNT(*) AS total
                FROM finance_transactions ft
                INNER JOIN finance_accounts a
                    ON a.id =
                        ft.account_id
                LEFT JOIN finance_expense_categories ec
                    ON ec.id =
                        ft.category_id
                WHERE ${where}
                `,
                values
            );

        const [transactions] =
            await db.query(
                `
                SELECT
                    ft.id,
                    ft.transaction_number,
                    ft.transaction_date,
                    ft.transaction_type,
                    ft.amount,
                    ft.reference_type,
                    ft.reference_id,
                    ft.reference_number,
                    ft.description,
                    ft.status,
                    ft.created_at,
                    a.account_name,
                    a.account_type,
                    ec.category_name
                FROM finance_transactions ft
                INNER JOIN finance_accounts a
                    ON a.id =
                        ft.account_id
                LEFT JOIN finance_expense_categories ec
                    ON ec.id =
                        ft.category_id
                WHERE ${where}
                ORDER BY
                    ft.transaction_date DESC,
                    ft.id DESC
                LIMIT ?
                OFFSET ?
                `,
                [
                    ...values,
                    limit,
                    offset
                ]
            );

        const total =
            Number(
                countRow.total || 0
            );

        return res.json({
            success: true,
            transactions:
                transactions.map(
                    transaction => ({
                        ...transaction,
                        amount:
                            Number(
                                transaction.amount ||
                                0
                            )
                    })
                ),
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.max(
                        1,
                        Math.ceil(
                            total /
                            limit
                        )
                    )
            }
        });
    } catch (error) {
        console.error(
            "Finance transaction list error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load cash-book transactions.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

exports.getSetup = async (
    req,
    res
) => {
    try {
        const [accounts] =
            await db.query(`
                SELECT
                    id,
                    account_name,
                    account_type,
                    institution_name,
                    account_number,
                    opening_balance,
                    status
                FROM finance_accounts
                ORDER BY
                    status = 'Active' DESC,
                    account_name
            `);

        const [categories] =
            await db.query(`
                SELECT
                    id,
                    category_name,
                    description,
                    status
                FROM finance_expense_categories
                ORDER BY
                    status = 'Active' DESC,
                    category_name
            `);

        return res.json({
            success: true,
            accounts,
            categories
        });
    } catch (error) {
        console.error(
            "Finance setup error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load finance setup."
        });
    }
};

exports.createAccount = async (
    req,
    res
) => {
    try {
        const accountName =
            clean(
                req.body.account_name,
                120
            );

        const accountType =
            clean(
                req.body.account_type,
                40
            );

        const openingBalance =
            Number(
                req.body.opening_balance ||
                0
            );

        if (!accountName) {
            return res.status(400).json({
                success: false,
                message:
                    "Account name is required."
            });
        }

        if (
            !ACCOUNT_TYPES.includes(
                accountType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Select a valid account type."
            });
        }

        if (
            !Number.isFinite(
                openingBalance
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Opening balance must be numeric."
            });
        }

        const [result] =
            await db.query(
                `
                INSERT INTO finance_accounts
                    (
                        account_name,
                        account_type,
                        institution_name,
                        account_number,
                        opening_balance,
                        notes,
                        created_by
                    )
                VALUES
                    (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    accountName,
                    accountType,
                    clean(
                        req.body
                            .institution_name,
                        120
                    ) || null,
                    clean(
                        req.body
                            .account_number,
                        100
                    ) || null,
                    openingBalance,
                    clean(
                        req.body.notes,
                        500
                    ) || null,
                    adminId(req)
                ]
            );

        return res.status(201).json({
            success: true,
            message:
                "Finance account created successfully.",
            accountId:
                result.insertId
        });
    } catch (error) {
        console.error(
            "Create finance account error:",
            error
        );

        return res
            .status(
                error.code ===
                    "ER_DUP_ENTRY"
                    ? 409
                    : 500
            )
            .json({
                success: false,
                message:
                    error.code ===
                        "ER_DUP_ENTRY"
                        ? "An account with this name already exists."
                        : "Unable to create finance account."
            });
    }
};

exports.createTransaction = async (
    req,
    res
) => {
    let connection;

    try {
        const type =
            clean(
                req.body.transaction_type,
                40
            );

        const accountId =
            positiveInteger(
                req.body.account_id
            );

        const categoryId =
            positiveInteger(
                req.body.category_id
            );

        const amount =
            positiveNumber(
                req.body.amount
            );

        const date =
            clean(
                req.body.transaction_date,
                10
            );

        const description =
            clean(
                req.body.description,
                1000
            );

        if (
            !TYPES.includes(
                type
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Select a valid transaction type."
            });
        }

        if (!accountId) {
            return res.status(400).json({
                success: false,
                message:
                    "Select a finance account."
            });
        }

        if (!amount) {
            return res.status(400).json({
                success: false,
                message:
                    "Amount must be greater than zero."
            });
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/
                .test(date)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid transaction date is required."
            });
        }

        if (!description) {
            return res.status(400).json({
                success: false,
                message:
                    "Transaction description is required."
            });
        }

        if (
            type === "Expense" &&
            !categoryId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Expense category is required."
            });
        }

        connection =
            await db.getConnection();

        await connection
            .beginTransaction();

        const [[account]] =
            await connection.query(
                `
                SELECT id
                FROM finance_accounts
                WHERE id = ?
                  AND status = 'Active'
                LIMIT 1
                FOR UPDATE
                `,
                [accountId]
            );

        if (!account) {
            const error =
                new Error(
                    "Selected finance account is unavailable."
                );

            error.statusCode =
                404;

            throw error;
        }

        const [result] =
            await connection.query(
                `
                INSERT INTO finance_transactions
                    (
                        transaction_date,
                        transaction_type,
                        account_id,
                        category_id,
                        amount,
                        reference_type,
                        reference_number,
                        description,
                        created_by
                    )
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    date,
                    type,
                    accountId,
                    type === "Expense"
                        ? categoryId
                        : null,
                    amount,
                    clean(
                        req.body
                            .reference_type,
                        80
                    ) || "Manual",
                    clean(
                        req.body
                            .reference_number,
                        150
                    ) || null,
                    description,
                    adminId(req)
                ]
            );

        const number =
            transactionNumber(
                result.insertId,
                date
            );

        await connection.query(
            `
            UPDATE finance_transactions
            SET transaction_number = ?
            WHERE id = ?
            `,
            [
                number,
                result.insertId
            ]
        );

        const [[financeTransaction]] =
            await connection.query(
                `
                SELECT *
                FROM finance_transactions
                WHERE id = ?
                LIMIT 1
                `,
                [result.insertId]
            );

        await accountingAutomation.postFinanceTransaction(
            connection,
            financeTransaction,
            adminId(req)
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                `${type} transaction posted successfully.`,
            transactionId:
                result.insertId,
            transactionNumber:
                number
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch {}
        }

        console.error(
            "Create finance transaction error:",
            error
        );

        return res
            .status(
                error.statusCode ||
                500
            )
            .json({
                success: false,
                message:
                    error.message ||
                    "Unable to post finance transaction."
            });
    } finally {
        connection?.release();
    }
};

exports.cancelTransaction = async (
    req,
    res
) => {
    try {
        const id =
            positiveInteger(
                req.params.id
            );

        const reason =
            clean(
                req.body.reason,
                500
            );

        if (!id) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid transaction ID is required."
            });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                message:
                    "Cancellation reason is required."
            });
        }

        const [result] =
            await db.query(
                `
                UPDATE finance_transactions
                SET
                    status = 'Cancelled',
                    cancelled_by = ?,
                    cancelled_at =
                        CURRENT_TIMESTAMP,
                    cancellation_reason = ?
                WHERE id = ?
                  AND status = 'Posted'
                `,
                [
                    adminId(req),
                    reason,
                    id
                ]
            );

        if (
            result.affectedRows === 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Transaction was not found or is already cancelled."
            });
        }

        return res.json({
            success: true,
            message:
                "Finance transaction cancelled successfully."
        });
    } catch (error) {
        console.error(
            "Cancel finance transaction error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to cancel finance transaction."
        });
    }
};

/* =====================================================
   Finance Part 2 — Accounting Helpers
===================================================== */

const ACCOUNTING_TYPES = ["Asset","Liability","Equity","Revenue","Expense"];

function financeMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100) / 100;
}

function makeJournalNumber(id,date) {
    return `JV-${String(date).replaceAll("-","")}-${String(id).padStart(6,"0")}`;
}

async function journalDetail(connection,id) {
    const [[journal]] = await connection.query(
        `SELECT * FROM journal_entries WHERE id=? LIMIT 1`,
        [id]
    );
    if (!journal) return null;

    const [lines] = await connection.query(
        `SELECT jel.*,aa.account_code,aa.account_name,aa.account_type
         FROM journal_entry_lines jel
         INNER JOIN accounting_accounts aa ON aa.id=jel.account_id
         WHERE jel.journal_entry_id=?
         ORDER BY jel.line_number`,
        [id]
    );

    return {
        ...journal,
        total_debit:Number(journal.total_debit||0),
        total_credit:Number(journal.total_credit||0),
        lines:lines.map(line=>({
            ...line,
            debit:Number(line.debit||0),
            credit:Number(line.credit||0)
        }))
    };
}

/* =====================================================
   Chart of Accounts
===================================================== */

exports.getChartOfAccounts = async (req,res) => {
    try {
        const conditions=["1=1"];
        const values=[];
        const type=clean(req.query.type,30);
        const status=clean(req.query.status,20);
        const search=clean(req.query.search,150);

        if (type) { conditions.push("aa.account_type=?"); values.push(type); }
        if (status) { conditions.push("aa.status=?"); values.push(status); }
        if (search) {
            const value=`%${search}%`;
            conditions.push("(aa.account_code LIKE ? OR aa.account_name LIKE ? OR aa.description LIKE ?)");
            values.push(value,value,value);
        }

        const [accounts]=await db.query(
            `SELECT aa.id,aa.account_code,aa.account_name,aa.account_type,
                    aa.parent_account_id,parent.account_code AS parent_code,
                    parent.account_name AS parent_name,aa.normal_balance,
                    aa.allow_posting,aa.status,aa.description,
                    COALESCE(SUM(CASE WHEN je.status='Posted' THEN jel.debit ELSE 0 END),0) AS total_debit,
                    COALESCE(SUM(CASE WHEN je.status='Posted' THEN jel.credit ELSE 0 END),0) AS total_credit
             FROM accounting_accounts aa
             LEFT JOIN accounting_accounts parent ON parent.id=aa.parent_account_id
             LEFT JOIN journal_entry_lines jel ON jel.account_id=aa.id
             LEFT JOIN journal_entries je ON je.id=jel.journal_entry_id
             WHERE ${conditions.join(" AND ")}
             GROUP BY aa.id
             ORDER BY aa.account_code`,
            values
        );

        return res.json({
            success:true,
            accounts:accounts.map(account=>{
                const debit=Number(account.total_debit||0);
                const credit=Number(account.total_credit||0);
                return {
                    ...account,
                    allow_posting:Boolean(Number(account.allow_posting)),
                    total_debit:debit,
                    total_credit:credit,
                    balance:account.normal_balance==="Debit"
                        ? debit-credit
                        : credit-debit
                };
            })
        });
    } catch (error) {
        console.error("Chart of accounts error:",error);
        return res.status(500).json({success:false,message:"Unable to load chart of accounts.",error:process.env.NODE_ENV==="production"?undefined:error.message});
    }
};

exports.createAccountingAccount = async (req,res) => {
    try {
        const code=clean(req.body.account_code,20);
        const name=clean(req.body.account_name,150);
        const type=clean(req.body.account_type,30);
        const parentId=positiveInteger(req.body.parent_account_id);

        if (!code || !/^[A-Za-z0-9.-]+$/.test(code)) {
            return res.status(400).json({success:false,message:"A valid account code is required."});
        }
        if (!name) return res.status(400).json({success:false,message:"Account name is required."});
        if (!ACCOUNTING_TYPES.includes(type)) {
            return res.status(400).json({success:false,message:"Select a valid account type."});
        }

        if (parentId) {
            const [[parent]]=await db.query(
                `SELECT id,account_type FROM accounting_accounts WHERE id=? LIMIT 1`,
                [parentId]
            );
            if (!parent) return res.status(404).json({success:false,message:"Parent account was not found."});
            if (parent.account_type!==type) {
                return res.status(409).json({success:false,message:"Parent and child accounts must use the same account type."});
            }
        }

        const [result]=await db.query(
            `INSERT INTO accounting_accounts
             (account_code,account_name,account_type,parent_account_id,normal_balance,allow_posting,description)
             VALUES (?,?,?,?,?,?,?)`,
            [
                code,name,type,parentId||null,
                ["Asset","Expense"].includes(type)?"Debit":"Credit",
                req.body.allow_posting===false?0:1,
                clean(req.body.description,500)||null
            ]
        );

        return res.status(201).json({success:true,message:"Accounting account created successfully.",accountId:result.insertId});
    } catch (error) {
        console.error("Create accounting account error:",error);
        return res.status(error.code==="ER_DUP_ENTRY"?409:500).json({
            success:false,
            message:error.code==="ER_DUP_ENTRY"
                ?"This account code or name already exists."
                :"Unable to create accounting account."
        });
    }
};

/* =====================================================
   Journal Entries
===================================================== */

exports.getJournals = async (req,res) => {
    try {
        const page=positiveInteger(req.query.page)||1;
        const limit=Math.min(positiveInteger(req.query.limit)||20,100);
        const offset=(page-1)*limit;
        const status=clean(req.query.status,20);
        const search=clean(req.query.search,150);
        const conditions=["1=1"];
        const values=[];

        if (status) { conditions.push("je.status=?"); values.push(status); }
        if (search) {
            const value=`%${search}%`;
            conditions.push("(je.journal_number LIKE ? OR je.reference_number LIKE ? OR je.narration LIKE ?)");
            values.push(value,value,value);
        }
        const where=conditions.join(" AND ");

        const [[countRow]]=await db.query(
            `SELECT COUNT(*) AS total FROM journal_entries je WHERE ${where}`,
            values
        );

        const [journals]=await db.query(
            `SELECT je.*,COUNT(jel.id) AS line_count
             FROM journal_entries je
             LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
             WHERE ${where}
             GROUP BY je.id
             ORDER BY je.journal_date DESC,je.id DESC
             LIMIT ? OFFSET ?`,
            [...values,limit,offset]
        );

        const total=Number(countRow.total||0);
        return res.json({
            success:true,
            journals:journals.map(j=>({...j,total_debit:Number(j.total_debit||0),total_credit:Number(j.total_credit||0),line_count:Number(j.line_count||0)})),
            pagination:{page,limit,total,totalPages:Math.max(1,Math.ceil(total/limit))}
        });
    } catch (error) {
        console.error("Journal list error:",error);
        return res.status(500).json({success:false,message:"Unable to load journal entries."});
    }
};

exports.getJournalById = async (req,res) => {
    let connection;
    try {
        const id=positiveInteger(req.params.id);
        if (!id) return res.status(400).json({success:false,message:"A valid journal ID is required."});
        connection=await db.getConnection();
        const journal=await journalDetail(connection,id);
        if (!journal) return res.status(404).json({success:false,message:"Journal entry was not found."});
        return res.json({success:true,journal});
    } catch (error) {
        console.error("Journal detail error:",error);
        return res.status(500).json({success:false,message:"Unable to load journal entry."});
    } finally { connection?.release(); }
};

exports.createJournal = async (req,res) => {
    let connection;
    try {
        const date=clean(req.body.journal_date,10);
        const narration=clean(req.body.narration,1000);
        const lines=Array.isArray(req.body.lines)?req.body.lines:[];
        const postNow=[true,1,"1"].includes(req.body.post_now);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({success:false,message:"A valid journal date is required."});
        }
        if (!narration) return res.status(400).json({success:false,message:"Journal narration is required."});
        if (lines.length<2) return res.status(400).json({success:false,message:"A journal requires at least two lines."});

        const normalized=[];
        for (let index=0;index<lines.length;index+=1) {
            const line=lines[index]||{};
            const accountId=positiveInteger(line.account_id);
            const debit=financeMoney(line.debit||0);
            const credit=financeMoney(line.credit||0);
            if (!accountId) return res.status(400).json({success:false,message:`Select an account for line ${index+1}.`});
            if (debit===null||credit===null||(debit>0&&credit>0)||(debit<=0&&credit<=0)) {
                return res.status(400).json({success:false,message:`Line ${index+1} must contain either a debit or a credit.`});
            }
            normalized.push({accountId,debit,credit,description:clean(line.description,500)||null});
        }

        const totalDebit=Math.round(normalized.reduce((s,l)=>s+l.debit,0)*100)/100;
        const totalCredit=Math.round(normalized.reduce((s,l)=>s+l.credit,0)*100)/100;
        if (totalDebit<=0||Math.abs(totalDebit-totalCredit)>0.009) {
            return res.status(409).json({success:false,message:`Journal is not balanced. Debit PKR ${totalDebit.toFixed(2)}, Credit PKR ${totalCredit.toFixed(2)}.`});
        }

        connection=await db.getConnection();
        await connection.beginTransaction();

        const ids=[...new Set(normalized.map(l=>l.accountId))];
        const [accounts]=await connection.query(
            `SELECT id,account_code,account_name,allow_posting,status
             FROM accounting_accounts WHERE id IN (?) FOR UPDATE`,
            [ids]
        );
        if (accounts.length!==ids.length) {
            const error=new Error("One or more journal accounts were not found."); error.statusCode=404; throw error;
        }
        const invalid=accounts.find(a=>a.status!=="Active"||!Number(a.allow_posting));
        if (invalid) {
            const error=new Error(`Posting is not allowed to ${invalid.account_code} — ${invalid.account_name}.`); error.statusCode=409; throw error;
        }

        const status=postNow?"Posted":"Draft";
        const [result]=await connection.query(
            `INSERT INTO journal_entries
             (journal_date,reference_type,reference_number,narration,status,total_debit,total_credit,posted_by,posted_at,created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
                date,clean(req.body.reference_type,80)||"Manual",
                clean(req.body.reference_number,150)||null,narration,status,
                totalDebit,totalCredit,postNow?adminId(req):null,
                postNow?new Date():null,adminId(req)
            ]
        );

        const number=makeJournalNumber(result.insertId,date);
        await connection.query(`UPDATE journal_entries SET journal_number=? WHERE id=?`,[number,result.insertId]);

        for (let i=0;i<normalized.length;i+=1) {
            const line=normalized[i];
            await connection.query(
                `INSERT INTO journal_entry_lines
                 (journal_entry_id,line_number,account_id,description,debit,credit)
                 VALUES (?,?,?,?,?,?)`,
                [result.insertId,i+1,line.accountId,line.description,line.debit,line.credit]
            );
        }

        await connection.commit();
        return res.status(201).json({
            success:true,
            message:postNow?"Journal posted successfully.":"Journal draft saved successfully.",
            journalId:result.insertId,journalNumber:number,status,totalDebit,totalCredit
        });
    } catch (error) {
        if (connection) { try { await connection.rollback(); } catch {} }
        console.error("Create journal error:",error);
        return res.status(error.statusCode||500).json({success:false,message:error.message||"Unable to create journal entry."});
    } finally { connection?.release(); }
};

exports.postJournal = async (req,res) => {
    try {
        const id=positiveInteger(req.params.id);
        if (!id) return res.status(400).json({success:false,message:"A valid journal ID is required."});
        const [result]=await db.query(
            `UPDATE journal_entries
             SET status='Posted',posted_by=?,posted_at=CURRENT_TIMESTAMP
             WHERE id=? AND status='Draft' AND total_debit=total_credit AND total_debit>0`,
            [adminId(req),id]
        );
        if (!result.affectedRows) return res.status(409).json({success:false,message:"Only balanced Draft journals can be posted."});
        return res.json({success:true,message:"Journal posted successfully."});
    } catch (error) {
        console.error("Post journal error:",error);
        return res.status(500).json({success:false,message:"Unable to post journal."});
    }
};

exports.reverseJournal = async (req,res) => {
    let connection;
    try {
        const id=positiveInteger(req.params.id);
        const reason=clean(req.body.reason,500);
        if (!id) return res.status(400).json({success:false,message:"A valid journal ID is required."});
        if (!reason) return res.status(400).json({success:false,message:"Reversal reason is required."});

        connection=await db.getConnection();
        await connection.beginTransaction();
        const original=await journalDetail(connection,id);
        if (!original) { const e=new Error("Journal entry was not found."); e.statusCode=404; throw e; }
        if (original.status!=="Posted") { const e=new Error("Only Posted journals can be reversed."); e.statusCode=409; throw e; }

        const date=new Date().toISOString().slice(0,10);
        const [result]=await connection.query(
            `INSERT INTO journal_entries
             (journal_date,reference_type,reference_id,reference_number,narration,status,total_debit,total_credit,posted_by,posted_at,created_by)
             VALUES (?,'Journal Reversal',?,?,?,?, 'Posted',?,?,?,CURRENT_TIMESTAMP,?)`,
            [date,id,original.journal_number,`Reversal of ${original.journal_number}: ${reason}`,original.total_credit,original.total_debit,adminId(req),adminId(req)]
        );

        const number=makeJournalNumber(result.insertId,date);
        await connection.query(`UPDATE journal_entries SET journal_number=? WHERE id=?`,[number,result.insertId]);

        for (let i=0;i<original.lines.length;i+=1) {
            const line=original.lines[i];
            await connection.query(
                `INSERT INTO journal_entry_lines
                 (journal_entry_id,line_number,account_id,description,debit,credit)
                 VALUES (?,?,?,?,?,?)`,
                [result.insertId,i+1,line.account_id,`Reversal: ${line.description||original.narration}`,line.credit,line.debit]
            );
        }

        await connection.query(
            `UPDATE journal_entries
             SET status='Reversed',reversed_by=?,reversed_at=CURRENT_TIMESTAMP,reversal_reason=?,reversal_entry_id=?
             WHERE id=?`,
            [adminId(req),reason,result.insertId,id]
        );

        await connection.commit();
        return res.json({success:true,message:"Journal reversed successfully.",reversalJournalId:result.insertId,reversalJournalNumber:number});
    } catch (error) {
        if (connection) { try { await connection.rollback(); } catch {} }
        console.error("Reverse journal error:",error);
        return res.status(error.statusCode||500).json({success:false,message:error.message||"Unable to reverse journal."});
    } finally { connection?.release(); }
};

/* =====================================================
   General Ledger
===================================================== */

exports.getGeneralLedger = async (req,res) => {
    try {
        const accountId=positiveInteger(req.query.account_id);
        if (!accountId) return res.status(400).json({success:false,message:"Select an accounting account."});

        const [[account]]=await db.query(
            `SELECT id,account_code,account_name,account_type,normal_balance
             FROM accounting_accounts WHERE id=? LIMIT 1`,
            [accountId]
        );
        if (!account) return res.status(404).json({success:false,message:"Accounting account was not found."});

        const conditions=["jel.account_id=?","je.status='Posted'"];
        const values=[accountId];
        const from=clean(req.query.date_from,10);
        const to=clean(req.query.date_to,10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { conditions.push("je.journal_date>=?"); values.push(from); }
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { conditions.push("je.journal_date<=?"); values.push(to); }

        const [rows]=await db.query(
            `SELECT je.id AS journal_id,je.journal_number,je.journal_date,
                    je.reference_type,je.reference_number,je.narration,
                    jel.line_number,jel.description,jel.debit,jel.credit
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id=jel.journal_entry_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY je.journal_date,je.id,jel.line_number`,
            values
        );

        let running=0;
        const entries=rows.map(row=>{
            const debit=Number(row.debit||0);
            const credit=Number(row.credit||0);
            running=Math.round((running+(account.normal_balance==="Debit"?debit-credit:credit-debit))*100)/100;
            return {...row,debit,credit,running_balance:running};
        });

        return res.json({
            success:true,
            account,
            summary:{
                totalDebit:entries.reduce((s,r)=>s+r.debit,0),
                totalCredit:entries.reduce((s,r)=>s+r.credit,0),
                closingBalance:running
            },
            entries
        });
    } catch (error) {
        console.error("General ledger error:",error);
        return res.status(500).json({success:false,message:"Unable to load general ledger.",error:process.env.NODE_ENV==="production"?undefined:error.message});
    }
};

