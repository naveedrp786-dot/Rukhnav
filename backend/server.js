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

// Canonical web root.
// Keep the storefront/admin UI in one place so Linux deployments
// (Render/Railway) cannot accidentally serve a stale duplicate.
const frontendPublicRoot = path.join(__dirname, "public");

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

// Serve the single canonical storefront/admin directory.
app.use(
    express.static(frontendPublicRoot)
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

// ============================================================
// RUKHNAV SEO — ROBOTS + SITEMAP
// Stage 1B-B
// ============================================================

app.get("/robots.txt", (req, res) => {
    const baseUrl = "https://www.rukhnav.store";

    res.type("text/plain");

    return res.send(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /admin/",
            "Disallow: /store/account.html",
            "Disallow: /store/cart.html",
            "Disallow: /store/checkout.html",
            "Disallow: /store/orders.html",
            "Disallow: /store/order-details.html",
            "Disallow: /store/reset-password.html",
            "",
            `Sitemap: ${baseUrl}/sitemap.xml`,
            ""
        ].join("\n")
    );
});

app.get("/sitemap.xml", async (req, res, next) => {
    try {
        const db = require("./config/db");

        const baseUrl =
            "https://www.rukhnav.store";

        const staticPages = [
            "/store/index.html",
            "/store/products.html",
            "/store/category/hair-care",
            "/store/category/face-care",
            "/store/category/fashion",
            "/store/category/decoration",
            "/store/about.html",
            "/store/contact.html",
            "/store/faq.html",
            "/store/reviews.html",
            "/store/shipping-policy.html",
            "/store/refund-policy.html",
            "/store/privacy-policy.html",
            "/store/terms.html",
            "/store/cookie-policy.html"
        ];

        const [products] = await db.query(
            `
            SELECT
                id,
                slug,
                updated_at
            FROM products
            WHERE status != 'Inactive'
            ORDER BY id ASC
            `
        );

        const escapeXml = (value) =>
            String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&apos;");

        const urls = [];

        for (const page of staticPages) {
            urls.push(
                [
                    "  <url>",
                    `    <loc>${escapeXml(baseUrl + page)}</loc>`,
                    "  </url>"
                ].join("\n")
            );
        }

        for (const product of products) {
            const productUrl =
                `${baseUrl}/store/product/${encodeURIComponent(product.slug)}`;

            const lines = [
                "  <url>",
                `    <loc>${escapeXml(productUrl)}</loc>`
            ];

            if (product.updated_at) {
                const date =
                    new Date(product.updated_at);

                if (!Number.isNaN(date.getTime())) {
                    lines.push(
                        `    <lastmod>${date.toISOString()}</lastmod>`
                    );
                }
            }

            lines.push("  </url>");

            urls.push(lines.join("\n"));
        }

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            "</urlset>",
            ""
        ].join("\n");

        res.type("application/xml");

        return res.send(xml);

    } catch (error) {
        return next(error);
    }
});

// ============================================================
// RUKHNAV SEO — PRETTY PRODUCT URL
// Stage 1G-C2-B1
// ============================================================


// STAGE 3C CATEGORY LANDING ROUTES
const seoCategoryLandingPages = Object.freeze({
    "hair-care": Object.freeze({
        label: "Hair Care",
        title: "Herbal Hair Care Products | RUKHNAV",
        description:
            "Shop RUKHNAV hair care products including herbal shampoo and herbal hair oil for gentle cleansing, nourishment and everyday hair care.",
        intro:
            "Explore RUKHNAV hair care products, including herbal shampoos and herbal hair oil for everyday cleansing, nourishment and regular hair care."
    }),

    "face-care": Object.freeze({
        label: "Face Care",
        title: "Herbal Face Care Products | RUKHNAV",
        description:
            "Shop RUKHNAV face care products including herbal neem face wash, charcoal face wash and whitening cream for everyday skin care.",
        intro:
            "Explore RUKHNAV face care products, including herbal neem face wash, charcoal face wash and whitening cream for everyday skin care."
    }),

    "fashion": Object.freeze({
        label: "Fashion",
        title: "Handmade Fashion & Crochet Products | RUKHNAV",
        description:
            "Shop handmade fashion products from RUKHNAV including crochet clothing, earrings, sequin dupattas, borders and colourful tassel designs.",
        intro:
            "Discover handmade RUKHNAV fashion pieces including crochet clothing, earrings, sequin dupattas, decorative borders and colourful tassel designs."
    }),

    "decoration": Object.freeze({
        label: "Decoration",
        title: "Customised Event Decoration Products | RUKHNAV",
        description:
            "Shop customised event decoration products from RUKHNAV including handmade event signage, grazing items and personalised sweet pickers.",
        intro:
            "Explore customised RUKHNAV decoration products for celebrations and special occasions, including event signage, grazing items and personalised sweet pickers."
    })
});

const escapeCategoryHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

app.get("/store/category/:categorySlug", async (req, res, next) => {
    try {
        const categorySlug = String(
            req.params.categorySlug || ""
        ).trim().toLowerCase();

        const category =
            seoCategoryLandingPages[categorySlug];

        if (!category) {
            return next();
        }

        const categoryTemplatePath =
            path.join(
                __dirname,
                "public",
                "store",
                "category.html"
            );

        let html =
            await require("fs").promises.readFile(
                categoryTemplatePath,
                "utf8"
            );

        const canonical =
            `https://www.rukhnav.store/store/category/${categorySlug}`;

        const replacements = {
            "__CATEGORY_TITLE__":
                escapeCategoryHtml(category.title),

            "__CATEGORY_DESCRIPTION__":
                escapeCategoryHtml(category.description),

            "__CATEGORY_CANONICAL__":
                escapeCategoryHtml(canonical),

            "__CATEGORY_LABEL__":
                escapeCategoryHtml(category.label),

            "__CATEGORY_INTRO__":
                escapeCategoryHtml(category.intro)
        };

        for (const [token, value] of Object.entries(replacements)) {
            html = html.split(token).join(value);
        }

        res.type("html");

        return res.send(html);

    } catch (error) {
        return next(error);
    }
});

app.get("/store/product/:slug", (req, res) => {
    return res.sendFile(
        path.join(
            frontendPublicRoot,
            "store",
            "product.html"
        )
    );
});

// ============================================================
// END RUKHNAV SEO — ROBOTS + SITEMAP
// ============================================================

// 404 Handler
// =====================================================


app.use(
    "/api/contact",
    require("./routes/contactRoutes")
);

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
