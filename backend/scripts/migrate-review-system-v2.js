"use strict";

const path = require("path");

require("dotenv").config({
    path: path.resolve(
        __dirname,
        "../.env.development"
    )
});

const db = require("../config/db");

async function tableExists(name) {
    const [rows] = await db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1`,
        [name]
    );
    return rows.length > 0;
}

async function columnExists(table, column) {
    const [rows] = await db.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1`,
        [table, column]
    );
    return rows.length > 0;
}

async function indexExists(table, indexName) {
    const [rows] = await db.query(
        `SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1`,
        [table, indexName]
    );
    return rows.length > 0;
}

async function addColumn(table, column, definition) {
    if (!(await columnExists(table, column))) {
        await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`Added ${table}.${column}`);
    }
}

async function run() {
    if (!(await tableExists("reviews"))) {
        await db.query(`
            CREATE TABLE reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                product_id INT NOT NULL,
                rating TINYINT NOT NULL,
                comment TEXT NULL,
                status ENUM('Pending','Approved','Rejected','Hidden') NOT NULL DEFAULT 'Pending',
                verified_purchase TINYINT(1) NOT NULL DEFAULT 0,
                helpful_count INT NOT NULL DEFAULT 0,
                admin_reply TEXT NULL,
                featured TINYINT(1) NOT NULL DEFAULT 0,
                approved_by INT NULL,
                approved_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_reviews_customer_v2 FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_reviews_product_v2 FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                CONSTRAINT chk_reviews_rating_v2 CHECK (rating BETWEEN 1 AND 5)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("Created reviews table");
    }

    await addColumn("reviews", "verified_purchase", "TINYINT(1) NOT NULL DEFAULT 0 AFTER status");
    await addColumn("reviews", "helpful_count", "INT NOT NULL DEFAULT 0 AFTER verified_purchase");
    await addColumn("reviews", "admin_reply", "TEXT NULL AFTER helpful_count");
    await addColumn("reviews", "featured", "TINYINT(1) NOT NULL DEFAULT 0");
    await addColumn("reviews", "approved_by", "INT NULL");
    await addColumn("reviews", "approved_at", "DATETIME NULL");
    await addColumn("reviews", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

    if (!(await indexExists("reviews", "uq_reviews_customer_product"))) {
        const [duplicates] = await db.query(`SELECT customer_id,product_id,COUNT(*) total FROM reviews GROUP BY customer_id,product_id HAVING COUNT(*)>1 LIMIT 1`);
        if (!duplicates.length) {
            await db.query("ALTER TABLE reviews ADD UNIQUE KEY uq_reviews_customer_product (customer_id, product_id)");
            console.log("Added unique customer/product review index");
        } else {
            console.warn("Skipped unique review index because duplicate customer/product reviews exist.");
        }
    }
    if (!(await indexExists("reviews", "idx_reviews_product_status"))) {
        await db.query("ALTER TABLE reviews ADD INDEX idx_reviews_product_status (product_id, status)");
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS review_images (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            review_id INT NOT NULL,
            image_url VARCHAR(500) NOT NULL,
            image_alt VARCHAR(200) NULL,
            sort_order INT NOT NULL DEFAULT 0,
            status ENUM('Active','Hidden') NOT NULL DEFAULT 'Active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_review_images_review_v2 FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE ON UPDATE CASCADE,
            INDEX idx_review_images_review_v2 (review_id, status, sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS review_helpful_votes (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            review_id INT NOT NULL,
            customer_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_review_helpful_review_v2 FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
            CONSTRAINT fk_review_helpful_customer_v2 FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            UNIQUE KEY uq_review_helpful_customer_v2 (review_id, customer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS review_reports (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            review_id INT NOT NULL,
            reporter_customer_id INT NOT NULL,
            reason VARCHAR(100) NOT NULL,
            details VARCHAR(1000) NULL,
            status ENUM('Pending','Reviewed','Dismissed') NOT NULL DEFAULT 'Pending',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_review_reports_review_v2 FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
            CONSTRAINT fk_review_reports_customer_v2 FOREIGN KEY (reporter_customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            UNIQUE KEY uq_review_report_customer_v2 (review_id, reporter_customer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS review_replies (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            review_id INT NOT NULL,
            admin_id INT NULL,
            reply_text TEXT NOT NULL,
            status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_review_replies_review_v2 FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
            CONSTRAINT fk_review_replies_admin_v2 FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("RUKHNAV Review System V2 migration completed successfully.");
    await db.end();
}

run().catch(async error => {
    console.error("Review V2 migration failed:", error);
    try { await db.end(); } catch {}
    process.exit(1);
});
