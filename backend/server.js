require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const logger = require("./utils/logger");
const { uploadRoot } = require("./config/storage");

// Load database connection
require("./config/db");

const app = express();

// =====================================================
// Core Middleware
// =====================================================

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

const allowedOrigins =
    String(process.env.CORS_ORIGINS || "")
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean);

app.set(
    "trust proxy",
    process.env.NODE_ENV === "production"
        ? 1
        : false
);

app.use(
    cors({
        origin(origin, callback) {
            // Allow server-to-server tools and same-origin requests.
            if (!origin) {
                return callback(null, true);
            }

            if (
                process.env.NODE_ENV !== "production" ||
                allowedOrigins.includes(origin)
            ) {
                return callback(null, true);
            }

            return callback(
                new Error("Origin is not allowed by CORS.")
            );
        },
        credentials: true
    })
);
app.use(
    morgan(
        process.env.NODE_ENV === "production"
            ? "combined"
            : "dev"
    )
);

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true
    })
);

// Uploaded files
app.use(
    "/uploads",
    express.static(uploadRoot, {
        maxAge:
            process.env.NODE_ENV === "production"
                ? "7d"
                : 0,
        fallthrough: true
    })
);

// Main frontend public folder
// macOS is commonly case-insensitive, while Linux production
// servers are case-sensitive. Support both during migration.
const frontendPublicRoot =
    [
        path.join(__dirname, "../public"),
        path.join(__dirname, "../Public")
    ].find(candidate => {
        try {
            return require("fs").existsSync(candidate);
        } catch {
            return false;
        }
    }) ||
    path.join(__dirname, "../public");

// =====================================================
// Browser Favicon
// =====================================================
// Reuse the existing RUKHNAV brand logo instead of
// requiring a separate favicon.ico file.
app.get("/favicon.ico", (req, res) => {
    res.type("png");
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "admin",
            "images",
            "logo.png"
        )
    );
});

// Primary frontend files.
// Keep the canonical top-level Public/public folder first
// so Railway serves the same frontend files tracked and
// edited by the project.
app.use(
    express.static(frontendPublicRoot)
);

// Backend-specific public files remain available only
// as a fallback when the frontend root does not contain
// the requested asset.
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// =====================================================
// Route Imports
// =====================================================

const productRoutes =
    require("./routes/productRoutes");

const productMediaRoutes =
    require("./routes/productMediaRoutes");

const customerRoutes =
    require("./routes/customerRoutes");

const adminRoutes =
    require("./routes/adminRoutes");

const categoryRoutes =
    require("./routes/categoryRoutes");

const cartRoutes =
    require("./routes/cartRoutes");

const orderRoutes =
    require("./routes/orderRoutes");

const reviewRoutes =
    require("./routes/reviewRoutes");

const stockRoutes =
    require("./routes/stockRoutes");

const wishlistRoutes =
    require("./routes/wishlistRoutes");

const couponRoutes =
    require("./routes/couponRoutes");

const customerPortalRoutes =
    require("./routes/customerPortalRoutes");

const profileRoutes =
    require("./routes/profileRoutes");

const dashboardRoutes =
    require("./routes/dashboardRoutes");

const reminderRoutes =
    require("./routes/reminderRoutes");

const inventoryRoutes =
    require("./routes/inventoryRoutes");

const invoiceRoutes =
    require("./routes/invoiceRoutes");

const addressRoutes =
    require("./routes/addressRoutes");

const customerAddressRoutes =
    require("./routes/customerAddressRoutes");

const adminManagementRoutes =
    require("./routes/adminManagementRoutes");

const settingsRoutes =
    require("./routes/settingsRoutes");

const supplierRoutes =
    require("./routes/supplierRoutes");

const salesRoutes =
    require("./routes/salesRoutes");

const purchaseRoutes =
    require("./routes/purchaseRoutes");

const purchaseReturnRoutes =
    require("./routes/purchaseReturnRoutes");

const stockAdjustmentRoutes =
    require("./routes/stockAdjustmentRoutes");

const customerLoyaltyRoutes =
    require("./routes/customerLoyaltyRoutes");

const adminLoyaltyRoutes =
    require("./routes/adminLoyaltyRoutes");

const customerEventRoutes =
    require("./routes/customerEventRoutes");

const customerPaymentsRoutes =
    require("./routes/customerPaymentsRoutes");

const websiteCmsRoutes =
    require("./routes/websiteCmsRoutes");

const publicWebsiteRoutes =
    require("./routes/publicWebsiteRoutes");

const adminDashboardRoutes =
    require("./routes/adminDashboardRoutes");

const customerReturnRoutes =
    require("./routes/customerReturnRoutes");

const adminReturnRoutes =
    require("./routes/adminReturnRoutes");

const adminOrderRoutes =
    require("./routes/adminOrderRoutes");

const adminCustomerRoutes =
    require("./routes/adminCustomerRoutes");

const adminReferralRoutes =
    require("./routes/adminReferralRoutes");

const adminReviewRoutes =
    require("./routes/adminReviewRoutes");

const adminEventRoutes =
    require("./routes/adminEventRoutes");

const reportRoutes =
    require("./routes/reportRoutes");

const shipmentRoutes =
    require("./routes/shipmentRoutes");

const adminPaymentRoutes =
    require("./routes/adminPaymentRoutes");

const goodsReceiptRoutes =
    require("./routes/goodsReceiptRoutes");

const supplierPaymentRoutes =
    require("./routes/supplierPaymentRoutes");

const supplierDebitNoteRoutes =
    require("./routes/supplierDebitNoteRoutes");

const purchasingDashboardRoutes =
    require("./routes/purchasingDashboardRoutes");

const healthRoutes =
    require("./routes/healthRoutes");

const adminNotificationRoutes =
    require("./routes/adminNotificationRoutes");

const notificationCenterRoutes =
    require("./routes/notificationCenterRoutes");

// =====================================================
// Background Jobs
// =====================================================

const {
    startEventReminderJob
} = require("./jobs/eventReminderJob");

const notificationQueueWorker =
    require("./jobs/notificationQueueWorker");

// Optional legacy reminder scheduler
if (
    process.env.ENABLE_REMINDER_SCHEDULER ===
    "true"
) {
    require("./scheduler/reminderScheduler");
}

// =====================================================
// API Routes
// =====================================================

app.use(
    "/api/products",
    productRoutes
);

app.use(
    "/api/product-media",
    productMediaRoutes
);

app.use(
    "/api/customers",
    customerRoutes
);

app.use(
    "/api/admin",
    adminRoutes
);

app.use(
    "/api/categories",
    categoryRoutes
);

app.use(
    "/api/cart",
    cartRoutes
);

app.use(
    "/api/orders",
    orderRoutes
);

app.use(
    "/api/reviews",
    reviewRoutes
);

app.use(
    "/api/stock",
    stockRoutes
);

app.use(
    "/api/wishlist",
    wishlistRoutes
);

app.use(
    "/api/coupons",
    couponRoutes
);

app.use(
    "/api/customer-portal",
    customerPortalRoutes
);

app.use(
    "/api/profile",
    profileRoutes
);

app.use(
    "/api/dashboard",
    dashboardRoutes
);

app.use(
    "/api/reminders",
    reminderRoutes
);

app.use(
    "/api/inventory",
    inventoryRoutes
);

app.use(
    "/api/invoices",
    invoiceRoutes
);

app.use(
    "/api/addresses",
    addressRoutes
);

app.use(
    "/api/customer-addresses",
    customerAddressRoutes
);

app.use(
    "/api/admins",
    adminManagementRoutes
);

app.use(
    "/api/settings",
    settingsRoutes
);

app.use(
    "/api/suppliers",
    supplierRoutes
);

app.use(
    "/api/sales",
    salesRoutes
);

app.use(
    "/api/purchases",
    purchaseRoutes
);

app.use(
    "/api/purchase-returns",
    purchaseReturnRoutes
);

app.use(
    "/api/stock-adjustments",
    stockAdjustmentRoutes
);

app.use(
    "/api/customer-loyalty",
    customerLoyaltyRoutes
);

app.use(
    "/api/admin/loyalty",
    adminLoyaltyRoutes
);

app.use(
    "/api/customer-events",
    customerEventRoutes
);

app.use(
    "/api/customer-payments",
    customerPaymentsRoutes
);

app.use(
    "/api/admin/dashboard",
    adminDashboardRoutes
);

app.use(
    "/api/returns",
    customerReturnRoutes
);

app.use(
    "/api/admin/returns",
    adminReturnRoutes
);

app.use(
    "/api/admin/website",
    websiteCmsRoutes
);

app.use(
    "/api/website",
    publicWebsiteRoutes
);

app.use(
    "/api/admin/orders",
    adminOrderRoutes
);

app.use(
    "/api/admin/customers",
    adminCustomerRoutes
);

app.use(
    "/api/admin/referrals",
    adminReferralRoutes
);

app.use(
    "/api/admin/reviews",
    adminReviewRoutes
);

app.use(
    "/api/admin/events",
    adminEventRoutes
);

app.use(
    "/api/admin/notifications",
    adminNotificationRoutes
);

app.use(
    "/api/admin/notification-center",
    notificationCenterRoutes
);

app.use(
    "/api/reports",
    reportRoutes
);

app.use(
    "/api/admin/shipments",
    shipmentRoutes
);

app.use(
    "/api/admin/payments",
    adminPaymentRoutes
);

app.use(
    "/api/grn",
    goodsReceiptRoutes
);

app.use(
    "/api/supplier-payments",
    supplierPaymentRoutes
);

app.use(
    "/api/supplier-debit-notes",
    supplierDebitNoteRoutes
);

app.use(
    "/api/purchasing-dashboard",
    purchasingDashboardRoutes
);

app.use(
    "/api/health",
    healthRoutes
);

// =====================================================
// Home Route
// =====================================================

app.get("/", (req, res) => {
    res.redirect("/store/index.html");
});

// =====================================================
// 404 Handler
// =====================================================

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// =====================================================
// Global Error Handler
// =====================================================

app.use((err, req, res, next) => {
    logger.error(
        err.stack ||
        err.message ||
        "Unknown server error"
    );

    return res
        .status(
            err.statusCode ||
            err.status ||
            500
        )
        .json({
            success: false,
            message:
                process.env.NODE_ENV ===
                "production"
                    ? "Internal Server Error"
                    : err.message
        });
});

// =====================================================
// Start Server
// =====================================================

const PORT =
    process.env.PORT || 3000;

const server = app.listen(
    PORT,
    () => {
        console.log(
            `RUKHNAV server listening on port ${PORT}`
        );

        try {
            startEventReminderJob();
        } catch (error) {
            logger.error(
                `Unable to start event reminder job: ${
                    error.message
                }`
            );
        }

        try {
            notificationQueueWorker.start();
        } catch (error) {
            logger.error(
                `Unable to start notification queue worker: ${
                    error.message
                }`
            );
        }
    }
);

// =====================================================
// Server Error Handler
// =====================================================

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        logger.error(
            `Port ${PORT} is already in use.`
        );

        process.exit(1);
    }

    logger.error(
        err.stack ||
        err.message ||
        "Unknown server error"
    );

    throw err;
});

// =====================================================
// Graceful Shutdown
// =====================================================
let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    logger.info(
        `${signal} received. Closing HTTP server...`
    );

    server.close(error => {
        if (error) {
            logger.error(
                error.stack || error.message
            );
            process.exit(1);
        }

        logger.info(
            "HTTP server closed successfully."
        );
        process.exit(0);
    });

    setTimeout(() => {
        logger.error(
            "Forced shutdown after timeout."
        );
        process.exit(1);
    }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
