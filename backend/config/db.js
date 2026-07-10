console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
console.log("DB_NAME:", process.env.DB_NAME);

const mysql = require("mysql2");

const connection = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "rukhnav",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
connection.getConnection((err, conn) => {
    if (err) {
        console.error("❌ MySQL Connection Failed");
        console.error(err.message);
    } else {
        console.log("✅ MySQL Connected Successfully");
        conn.release();
    }
});

module.exports = connection.promise();