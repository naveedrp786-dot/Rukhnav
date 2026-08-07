const mysql = require("mysql2");

const useSsl =
    String(process.env.DB_SSL || "")
        .trim()
        .toLowerCase() === "true";

const poolOptions = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "rukhnav",
    waitForConnections: true,
    connectionLimit: Number(
        process.env.DB_CONNECTION_LIMIT || 10
    ),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

if (useSsl) {
    poolOptions.ssl = {
        rejectUnauthorized:
            String(
                process.env.DB_SSL_REJECT_UNAUTHORIZED ||
                "true"
            ).toLowerCase() !== "false"
    };
}

const connection =
    mysql.createPool(poolOptions);

connection.getConnection((err, conn) => {
    if (err) {
        console.error(
            "MySQL connection failed:",
            err.message
        );
        return;
    }

    console.log(
        `MySQL connected: ${process.env.DB_NAME || "rukhnav"}`
    );

    conn.release();
});

module.exports = connection.promise();
