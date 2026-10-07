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

const productSeoMetadataOverrides = Object.freeze({
    "sunsation-herbal-shampoo-100-ml": Object.freeze({
        title:
            "Herbal Hair Shampoo 100ml in Pakistan | SUNSATION RUKHNAV",
        description:
            "Shop SUNSATION Herbal Hair Shampoo 100ml online in Pakistan from RUKHNAV. A herbal hair-care formula for gentle cleansing and everyday hair care."
    }),

    "sunsation-herbal-shampoo-200-ml": Object.freeze({
        title:
            "Herbal Hair Shampoo 200ml in Pakistan | SUNSATION RUKHNAV",
        description:
            "Shop SUNSATION Herbal Hair Shampoo 200ml online in Pakistan from RUKHNAV. A herbal hair-care formula for gentle cleansing and everyday hair care."
    }),

    "herbal-hair-oil-100-ml": Object.freeze({
        title:
            "Herbal Hair Oil 100ml in Pakistan | RUKHNAV",
        description:
            "Shop RUKHNAV Herbal Hair Oil 100ml online in Pakistan. A nourishing herbal hair-care blend for the hair and scalp and a regular hair-care routine."
    }),

    "whitening-cream-40-grm": Object.freeze({
        title:
            "Whitening Cream 40g in Pakistan | Herbal RUKHNAV",
        description:
            "Shop RUKHNAV Whitening Cream 40g online in Pakistan. This herbal brightening formula moisturizes and nourishes the skin while supporting its natural glow."
    }),

    "herbal-neem-face-wash-130ml": Object.freeze({
        title:
            "Herbal Neem Face Wash 130ml in Pakistan | RUKHNAV",
        description:
            "Shop RUKHNAV Herbal Neem Face Wash 130ml online in Pakistan. A refreshing herbal cleanser with neem for removing dirt, excess oil and everyday impurities."
    }),

    "charcoal-facewash-130ml": Object.freeze({
        title:
            "Herbal Charcoal Face Wash 130ml in Pakistan | RUKHNAV",
        description:
            "Shop RUKHNAV Herbal Charcoal Face Wash 130ml online in Pakistan. A refreshing cleanser with activated charcoal and herbal extracts for everyday cleansing."
    }),

    "handmade-crochet-cardigan": Object.freeze({
        title:
            "Handmade Crochet Cardigan | RUKHNAV",
        description:
            "Shop a handmade crochet cardigan from RUKHNAV, carefully crafted for a cozy, stylish and unique look. Choose your preferred colour at checkout."
    }),

    "corchet-yarn-frock": Object.freeze({
        title:
            "Handmade Crochet Yarn Frock | RUKHNAV",
        description:
            "Shop a handmade crochet yarn frock from RUKHNAV, beautifully crafted for a charming, comfortable and unique look. Choose your preferred colour at checkout."
    }),

    "corchet-yarn-frock-navy-blue": Object.freeze({
        title:
            "Handmade Crochet Yarn Frock - Navy Blue | RUKHNAV",
        description:
            "Shop a handmade crochet yarn frock in navy blue from RUKHNAV, handcrafted for a stylish, comfortable and adorable look. Colour can be requested at checkout."
    }),

    "hand-made-ear-rings-1-pcs": Object.freeze({
        title:
            "Handmade Earrings | RUKHNAV",
        description:
            "Shop handmade earrings from RUKHNAV, carefully crafted to add a unique, elegant and stylish touch to your look. Choose your preferred colour at checkout."
    }),

    "sequence-dopatta": Object.freeze({
        title:
            "Handmade Sequin Dupatta | RUKHNAV",
        description:
            "Shop a handmade sequin dupatta from RUKHNAV, beautifully embellished to add graceful sparkle and traditional charm. Choose your preferred colour at checkout."
    }),

    "tassal-8-pcs-without-box": Object.freeze({
        title:
            "Handmade Tassel Border - 8 Pcs | RUKHNAV",
        description:
            "Shop an 8-piece handmade tassel border set from RUKHNAV, crafted to add a stylish, colourful and elegant finishing touch to dresses and dupattas."
    }),

    "hand-made-event-signage-4-pcs-single-pack": Object.freeze({
        title:
            "Handmade Event Signage - 4 Pcs | RUKHNAV",
        description:
            "Shop handmade event signage from RUKHNAV for Mehndi, Sehrabandi, Mayo and other special occasions. Mention your occasion requirements at checkout."
    }),

    "customised-key-chain-1-pcs-31": Object.freeze({
        title:
            "Customised Key Chain | RUKHNAV",
        description:
            "Shop a customised key chain from RUKHNAV, personalised with your name, photo or special message. A thoughtful personalised gift for someone special."
    }),

    "sweet-pickers-20-pcs": Object.freeze({
        title:
            "Customised Sweet Pickers - 20 Pcs | RUKHNAV",
        description:
            "Shop 20 customised sweet pickers from RUKHNAV for celebrations and special events. Personalise them with your name, message, colours or theme."
    }),

    "sequence-border-without-box": Object.freeze({
        title:
            "Handmade Sequin Border | RUKHNAV",
        description:
            "Shop a handmade sequin border from RUKHNAV, crafted to add sparkle and an elegant finishing touch to dresses and dupattas. Choose your preferred colour at checkout."
    })
});

const escapeProductSeoHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const productSeoDescription = (product) => {
    const text =
        String(product.description || "")
            .replace(/\s+/g, " ")
            .trim();

    if (text) {
        return text.length <= 160
            ? text
            : `${text.slice(0, 157).trim()}...`;
    }

    return `Shop ${product.product_name || "RUKHNAV product"} online from RUKHNAV.`;
};

const safeProductSeoJson = (value) =>
    JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");

app.get("/store/product/:slug", async (req, res, next) => {
    try {
        const db = require("./config/db");

        const requestedSlug =
            String(req.params.slug || "").trim();

        if (!requestedSlug) {
            return res.sendFile(
                path.join(
                    frontendPublicRoot,
                    "store",
                    "product.html"
                )
            );
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                product_name,
                slug,
                description,
                category,
                sku,
                brand,
                selling_price,
                stock_quantity,
                image,
                status
            FROM products
            WHERE slug = ?
              AND status != 'Inactive'
            LIMIT 1
            `,
            [requestedSlug]
        );

        const product = rows[0];

        if (!product) {
            return res.sendFile(
                path.join(
                    frontendPublicRoot,
                    "store",
                    "product.html"
                )
            );
        }

        const templatePath =
            path.join(
                frontendPublicRoot,
                "store",
                "product.html"
            );

        let html =
            await require("fs").promises.readFile(
                templatePath,
                "utf8"
            );

        const override =
            productSeoMetadataOverrides[
                String(product.slug || "")
            ];

        const title =
            override?.title ||
            `${product.product_name || "Product"} | RUKHNAV`;

        const description =
            override?.description ||
            productSeoDescription(product);

        const canonical =
            `https://www.rukhnav.store/store/product/${encodeURIComponent(product.slug)}`;

        const price =
            Number(product.selling_price);

        const stock =
            Number(product.stock_quantity || 0);

        const schema = {
            "@context": "https://schema.org",
            "@type": "Product",
            name:
                product.product_name ||
                "RUKHNAV product",
            description,
            url: canonical,
            category:
                product.category ||
                undefined,
            sku:
                product.sku
                    ? String(product.sku)
                    : undefined
        };

        const brand =
            String(product.brand || "").trim();

        if (brand) {
            schema.brand = {
                "@type": "Brand",
                name: brand
            };
        }

        if (
            Number.isFinite(price) &&
            price > 0
        ) {
            schema.offers = {
                "@type": "Offer",
                url: canonical,
                priceCurrency: "PKR",
                price: price.toFixed(2),
                availability:
                    stock > 0
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                itemCondition:
                    "https://schema.org/NewCondition"
            };
        }

        const seoHead = [
            `<title>${escapeProductSeoHtml(title)}</title>`,
            "",
            `    <meta name="description" content="${escapeProductSeoHtml(description)}">`,
            "",
            `    <link rel="canonical" href="${escapeProductSeoHtml(canonical)}">`,
            "",
            '    <meta property="og:type" content="product">',
            `    <meta property="og:title" content="${escapeProductSeoHtml(title)}">`,
            `    <meta property="og:description" content="${escapeProductSeoHtml(description)}">`,
            `    <meta property="og:url" content="${escapeProductSeoHtml(canonical)}">`,
            "",
            '    <meta name="twitter:card" content="summary">',
            `    <meta name="twitter:title" content="${escapeProductSeoHtml(title)}">`,
            `    <meta name="twitter:description" content="${escapeProductSeoHtml(description)}">`,
            "",
            '    <script id="rukhnav-product-jsonld" type="application/ld+json">',
            safeProductSeoJson(schema),
            "    </script>"
        ].join("\n");

        const genericHeadPattern =
            /<title>Product Details \| RUKHNAV<\/title>[\s\S]*?<meta\s+name="description"\s+content="View RUKHNAV product information, customer reviews and verified customer photos\."\s*>/;

        if (!genericHeadPattern.test(html)) {
            throw new Error(
                "Product SEO template contract not found."
            );
        }

        html =
            html.replace(
                genericHeadPattern,
                seoHead
            );

        res.type("html");

        return res.send(html);

    } catch (error) {
        console.error(
            "Product SEO enrichment failed:",
            error.message
        );

        return res.sendFile(
            path.join(
                frontendPublicRoot,
                "store",
                "product.html"
            )
        );
    }
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
