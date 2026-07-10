require("dotenv").config();

const morgan = require("morgan");
const logger = require("./utils/logger");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

// Database Connection
require("./config/db");
// Start Reminder Scheduler
require("./scheduler/reminderScheduler");

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static("uploads"));

// Routes
const productRoutes = require("./routes/productRoutes");
const customerRoutes = require("./routes/customerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const couponRoutes = require("./routes/couponRoutes");
const profileRoutes = require("./routes/profileRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reminderRoutes = require("./routes/reminderRoutes");


app.use("/products", productRoutes);
app.use("/customers", customerRoutes);
app.use("/admin", adminRoutes);
app.use("/categories", categoryRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/reviews", reviewRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/coupons", couponRoutes);
app.use("/profile", profileRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/reminders", reminderRoutes);

// Home Route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to RUKHNAV Cosmetics Backend API"
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Global Error Handler
app.use((err, req, res, next) => {

    logger.error(err.stack || err.message);

    res.status(err.statusCode || err.status || 500).json({
        success: false,
        message:
            process.env.NODE_ENV === "production"
                ? "Internal Server Error"
                : err.message
    });

});

// Start Server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`✅ Server running on port ${PORT}`);
});

server.on("error", (err) => {

    if (err.code === "EADDRINUSE") {

        logger.error(`Port ${PORT} is already in use.`);
        process.exit(1);

    }

    throw err;

});