"use strict";

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const productMediaService = require("../services/productMediaService");

function customerId(req) {
    return Number(req.user?.id || req.customer?.id || req.customerId);
}

function cleanText(value, maximum = 2000) {
    return String(value || "").trim().slice(0, maximum);
}

function integer(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

function isDevelopment() {
    return (
        String(process.env.NODE_ENV || "development").toLowerCase() !== "production" ||
        String(process.env.REVIEW_MODERATION_MODE || "auto").toLowerCase() === "auto"
    );
}

function publicUrl(req, storedPath) {
    if (!storedPath) return null;
    if (/^https?:\/\//i.test(storedPath)) return storedPath;
    const normalized = `/${String(storedPath).replace(/^\/+/, "")}`;
    return `${req.protocol}://${req.get("host")}${normalized}`;
}

function removeFiles(files = []) {
    files.forEach(file => {
        if (!file?.path) return;
        fs.unlink(file.path, () => {});
    });
}

function removeStoredImages(rows = []) {
    rows.forEach(row => {
        const value = String(row.image_url || "");
        if (!value.startsWith("/uploads/reviews/")) return;
        const fullPath = path.join(
            __dirname,
            "..",
            value.replace(/^\/+/, "")
        );
        fs.unlink(fullPath, () => {});
    });
}

async function productExists(connection, productId) {
    const [rows] = await connection.query(
        "SELECT id FROM products WHERE id = ? LIMIT 1",
        [productId]
    );
    return rows.length > 0;
}

async function verifiedPurchase(connection, customerIdValue, productId) {
    try {
        const [rows] = await connection.query(
            `
            SELECT 1
            FROM orders o
            JOIN order_items oi
                ON oi.order_id = o.id
            WHERE o.customer_id = ?
              AND oi.product_id = ?
              AND LOWER(o.order_status) = 'delivered'
            LIMIT 1
            `,
            [customerIdValue, productId]
        );
        return rows.length > 0 ? 1 : 0;
    } catch {
        return 0;
    }
}

async function fetchImages(connection, reviewIds) {
    if (!reviewIds.length) return new Map();

    const placeholders = reviewIds.map(() => "?").join(",");
    const [rows] = await connection.query(
        `
        SELECT id, review_id, image_url, image_alt, sort_order, created_at
        FROM review_images
        WHERE review_id IN (${placeholders})
          AND status = 'Active'
        ORDER BY review_id, sort_order, id
        `,
        reviewIds
    );

    const grouped = new Map();
    rows.forEach(row => {
        if (!grouped.has(row.review_id)) grouped.set(row.review_id, []);
        grouped.get(row.review_id).push(row);
    });
    return grouped;
}

function serializeReview(req, row, images = []) {
    const profilePicture = row.profile_picture_url || row.profile_picture;
    const productImage = row.product_image_url || row.product_image;

    return {
        ...row,
        rating: Number(row.rating),
        verified_purchase: Boolean(row.verified_purchase),
        helpful_count: Number(row.helpful_count || 0),
        profile_picture_url: publicUrl(req, profilePicture),
        product_image_url: publicUrl(req, productImage),
        images: images.map(image => ({
            ...image,
            url: publicUrl(req, image.image_url)
        }))
    };
}

async function getOneReview(
    connection,
    reviewId
) {
    const productImageSql =
        await productMediaService
            .primaryImageSql(
                "p",
                connection
            );

    const [rows] =
        await connection.query(
            `
            SELECT
                r.*,
                c.full_name,
                cp.profile_picture,
                p.product_name,
                ${productImageSql}
                    AS product_image,
                (
                    SELECT
                        rr.reply_text
                    FROM review_replies rr
                    WHERE rr.review_id = r.id
                      AND rr.status = 'Active'
                    ORDER BY rr.id DESC
                    LIMIT 1
                ) AS admin_reply
            FROM reviews r
            JOIN customers c
                ON c.id = r.customer_id
            LEFT JOIN customer_profiles cp
                ON cp.customer_id = c.id
            JOIN products p
                ON p.id = r.product_id
            WHERE r.id = ?
            LIMIT 1
            `,
            [reviewId]
        );

    return rows[0] || null;
}

exports.addReview = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const currentCustomerId = customerId(req);
        const productId = integer(req.body.product_id);
        const rating = integer(req.body.rating);
        const comment = cleanText(req.body.comment, 2000);

        if (!currentCustomerId || !productId) {
            removeFiles(req.files);
            return res.status(400).json({
                success: false,
                message: "A valid customer and product are required."
            });
        }

        if (!rating || rating < 1 || rating > 5) {
            removeFiles(req.files);
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5."
            });
        }

        if (comment.length < 5) {
            removeFiles(req.files);
            return res.status(400).json({
                success: false,
                message: "Review comments must contain at least 5 characters."
            });
        }

        await connection.beginTransaction();

        if (!(await productExists(connection, productId))) {
            await connection.rollback();
            removeFiles(req.files);
            return res.status(404).json({
                success: false,
                message: "Product was not found."
            });
        }

        const [existing] = await connection.query(
            `SELECT id FROM reviews WHERE customer_id = ? AND product_id = ? LIMIT 1`,
            [currentCustomerId, productId]
        );

        if (existing.length) {
            await connection.rollback();
            removeFiles(req.files);
            return res.status(409).json({
                success: false,
                code: "REVIEW_ALREADY_EXISTS",
                message: "You have already reviewed this product. Edit your existing review instead."
            });
        }

        const verified = await verifiedPurchase(
            connection,
            currentCustomerId,
            productId
        );

        if (!verified) {
            await connection.rollback();
            removeFiles(req.files);

            return res.status(403).json({
                success: false,
                code: "DELIVERED_PURCHASE_REQUIRED",
                message:
                    "You can review this product only after a RUKHNAV order containing it has been delivered."
            });
        }

        const status = isDevelopment() ? "Approved" : "Pending";

        const [result] = await connection.query(
            `
            INSERT INTO reviews
            (customer_id, product_id, rating, comment, status, verified_purchase, helpful_count)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            `,
            [currentCustomerId, productId, rating, comment, status, verified]
        );

        for (let index = 0; index < (req.files || []).length; index += 1) {
            const file = req.files[index];
            await connection.query(
                `
                INSERT INTO review_images
                (review_id, image_url, image_alt, sort_order, status)
                VALUES (?, ?, ?, ?, 'Active')
                `,
                [
                    result.insertId,
                    `/uploads/reviews/${file.filename}`,
                    `Customer review photo ${index + 1}`,
                    index
                ]
            );
        }

        await connection.commit();

        const review = await getOneReview(connection, result.insertId);
        const imageMap = await fetchImages(connection, [result.insertId]);

        return res.status(201).json({
            success: true,
            message:
                status === "Approved"
                    ? "Review published successfully."
                    : "Review submitted and is awaiting approval.",
            review: serializeReview(
                req,
                review,
                imageMap.get(result.insertId) || []
            )
        });
    } catch (error) {
        try { await connection.rollback(); } catch {}
        removeFiles(req.files);
        console.error("Add review V2 error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to submit review.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    } finally {
        connection.release();
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const productId = integer(req.params.id || req.params.productId);
        const limit = Math.min(Math.max(integer(req.query.limit) || 20, 1), 100);
        const offset = Math.max(integer(req.query.offset) || 0, 0);
        const ratingFilter = integer(req.query.rating);
        const sort = String(req.query.sort || "latest").toLowerCase();

        if (!productId) {
            return res.status(400).json({ success: false, message: "A valid product ID is required." });
        }

        const orderBy = {
            latest: "r.created_at DESC",
            oldest: "r.created_at ASC",
            highest: "r.rating DESC, r.created_at DESC",
            lowest: "r.rating ASC, r.created_at DESC",
            helpful: "r.helpful_count DESC, r.created_at DESC"
        }[sort] || "r.created_at DESC";

        const parameters = [productId];
        let ratingSql = "";
        if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
            ratingSql = " AND r.rating = ? ";
            parameters.push(ratingFilter);
        }
        parameters.push(limit, offset);

        const [reviews] = await db.query(
            `
            SELECT
                r.id, r.customer_id, r.product_id, r.rating, r.comment,
                r.status, r.verified_purchase, r.helpful_count,
                r.created_at, r.updated_at,
                c.full_name,
                cp.profile_picture,
                (SELECT rr.reply_text
                 FROM review_replies rr
                 WHERE rr.review_id = r.id AND rr.status = 'Active'
                 ORDER BY rr.id DESC LIMIT 1) AS admin_reply
            FROM reviews r
            JOIN customers c ON c.id = r.customer_id
            LEFT JOIN customer_profiles cp ON cp.customer_id = c.id
            WHERE r.product_id = ?
              AND r.status = 'Approved'
              ${ratingSql}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
            `,
            parameters
        );

        const [[summary]] = await db.query(
            `
            SELECT COUNT(*) AS totalReviews, COALESCE(ROUND(AVG(rating), 1), 0) AS averageRating
            FROM reviews
            WHERE product_id = ? AND status = 'Approved'
            `,
            [productId]
        );

        const [distributionRows] = await db.query(
            `
            SELECT rating, COUNT(*) AS total
            FROM reviews
            WHERE product_id = ? AND status = 'Approved'
            GROUP BY rating
            `,
            [productId]
        );

        const imageMap = await fetchImages(db, reviews.map(review => review.id));
        const distribution = {1:0,2:0,3:0,4:0,5:0};
        distributionRows.forEach(row => { distribution[row.rating] = Number(row.total); });

        return res.json({
            success: true,
            productId,
            averageRating: Number(summary.averageRating || 0),
            totalReviews: Number(summary.totalReviews || 0),
            distribution,
            reviews: reviews.map(review =>
                serializeReview(req, review, imageMap.get(review.id) || [])
            )
        });
    } catch (error) {
        console.error("Get product reviews V2 error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to load product reviews.",
            error: process.env.NODE_ENV === "production" ? undefined : error.message
        });
    }
};

exports.getMyReviews = async (
    req,
    res
) => {
    try {
        const currentCustomerId =
            customerId(req);

        const productImageSql =
            await productMediaService
                .primaryImageSql("p");

        const [reviews] =
            await db.query(
                `
                SELECT
                    r.*,
                    p.product_name,
                    ${productImageSql}
                        AS product_image,
                    (
                        SELECT
                            rr.reply_text
                        FROM review_replies rr
                        WHERE rr.review_id = r.id
                          AND rr.status = 'Active'
                        ORDER BY rr.id DESC
                        LIMIT 1
                    ) AS admin_reply
                FROM reviews r
                JOIN products p
                    ON p.id = r.product_id
                WHERE r.customer_id = ?
                ORDER BY r.created_at DESC
                `,
                [currentCustomerId]
            );

        const imageMap =
            await fetchImages(
                db,
                reviews.map(
                    item => item.id
                )
            );

        return res.json({
            success: true,
            count:
                reviews.length,
            reviews:
                reviews.map(
                    item =>
                        serializeReview(
                            req,
                            item,
                            imageMap.get(
                                item.id
                            ) || []
                        )
                )
        });
    } catch (error) {
        console.error(
            "Get my reviews V3 error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load your reviews.",
            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};

exports.getReviewById = async (req, res) => {
    try {
        const reviewId = integer(req.params.id);
        const review = await getOneReview(db, reviewId);
        if (!review || (review.status !== "Approved" && review.customer_id !== customerId(req))) {
            return res.status(404).json({ success: false, message: "Review was not found." });
        }
        const imageMap = await fetchImages(db, [reviewId]);
        return res.json({
            success: true,
            review: serializeReview(req, review, imageMap.get(reviewId) || [])
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to load review." });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const reviewId = integer(req.params.id);
        const currentCustomerId = customerId(req);
        const rating = integer(req.body.rating);
        const comment = cleanText(req.body.comment, 2000);

        if (!rating || rating < 1 || rating > 5 || comment.length < 5) {
            return res.status(400).json({ success: false, message: "Provide a rating from 1 to 5 and at least 5 comment characters." });
        }

        const status = isDevelopment() ? "Approved" : "Pending";
        const [result] = await db.query(
            `
            UPDATE reviews
            SET rating = ?, comment = ?, status = ?, approved_by = NULL, approved_at = NULL
            WHERE id = ? AND customer_id = ?
            `,
            [rating, comment, status, reviewId, currentCustomerId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: "Review was not found." });
        }

        return res.json({ success: true, message: status === "Approved" ? "Review updated." : "Review updated and returned for moderation." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to update review." });
    }
};

exports.deleteReview = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const reviewId = integer(req.params.id);
        const currentCustomerId = customerId(req);
        await connection.beginTransaction();
        const [owned] = await connection.query(
            "SELECT id FROM reviews WHERE id = ? AND customer_id = ? LIMIT 1",
            [reviewId, currentCustomerId]
        );
        if (!owned.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Review was not found." });
        }
        const [images] = await connection.query("SELECT image_url FROM review_images WHERE review_id = ?", [reviewId]);
        await connection.query("DELETE FROM reviews WHERE id = ?", [reviewId]);
        await connection.commit();
        removeStoredImages(images);
        return res.json({ success: true, message: "Review deleted successfully." });
    } catch (error) {
        try { await connection.rollback(); } catch {}
        return res.status(500).json({ success: false, message: "Unable to delete review." });
    } finally {
        connection.release();
    }
};

exports.addImages = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const reviewId = integer(req.params.id);
        const currentCustomerId = customerId(req);
        await connection.beginTransaction();
        const [owned] = await connection.query(
            "SELECT id FROM reviews WHERE id = ? AND customer_id = ? LIMIT 1",
            [reviewId, currentCustomerId]
        );
        if (!owned.length) {
            await connection.rollback();
            removeFiles(req.files);
            return res.status(404).json({ success: false, message: "Review was not found." });
        }
        const [[countRow]] = await connection.query(
            "SELECT COUNT(*) AS total FROM review_images WHERE review_id = ? AND status = 'Active'",
            [reviewId]
        );
        if (Number(countRow.total) + (req.files || []).length > 5) {
            await connection.rollback();
            removeFiles(req.files);
            return res.status(400).json({ success: false, message: "A review can contain no more than five pictures." });
        }
        for (let i=0; i<(req.files || []).length; i+=1) {
            const file=req.files[i];
            await connection.query(
                "INSERT INTO review_images (review_id,image_url,image_alt,sort_order,status) VALUES (?,?,?,?, 'Active')",
                [reviewId, `/uploads/reviews/${file.filename}`, `Customer review photo ${Number(countRow.total)+i+1}`, Number(countRow.total)+i]
            );
        }
        await connection.commit();
        return res.status(201).json({ success: true, message: "Review pictures uploaded successfully." });
    } catch (error) {
        try { await connection.rollback(); } catch {}
        removeFiles(req.files);
        return res.status(500).json({ success:false, message:"Unable to upload review pictures." });
    } finally { connection.release(); }
};

exports.deleteImage = async (req, res) => {
    try {
        const imageId = integer(req.params.imageId);
        const currentCustomerId = customerId(req);
        const [rows] = await db.query(
            `SELECT ri.id, ri.image_url FROM review_images ri JOIN reviews r ON r.id=ri.review_id WHERE ri.id=? AND r.customer_id=? LIMIT 1`,
            [imageId, currentCustomerId]
        );
        if (!rows.length) return res.status(404).json({success:false,message:"Review picture was not found."});
        await db.query("DELETE FROM review_images WHERE id=?", [imageId]);
        removeStoredImages(rows);
        return res.json({success:true,message:"Review picture removed."});
    } catch { return res.status(500).json({success:false,message:"Unable to remove review picture."}); }
};

exports.markHelpful = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const reviewId = integer(req.params.id);
        const voterId = customerId(req);
        await connection.beginTransaction();
        await connection.query(
            "INSERT IGNORE INTO review_helpful_votes (review_id, customer_id) VALUES (?, ?)",
            [reviewId, voterId]
        );
        const [[count]] = await connection.query(
            "SELECT COUNT(*) AS total FROM review_helpful_votes WHERE review_id = ?",
            [reviewId]
        );
        await connection.query("UPDATE reviews SET helpful_count = ? WHERE id = ?", [count.total, reviewId]);
        await connection.commit();
        return res.json({success:true,helpfulCount:Number(count.total)});
    } catch (error) {
        try { await connection.rollback(); } catch {}
        return res.status(500).json({success:false,message:"Unable to mark review helpful."});
    } finally { connection.release(); }
};

exports.reportReview = async (req, res) => {
    try {
        const reviewId = integer(req.params.id);
        const reporterId = customerId(req);
        const reason = cleanText(req.body.reason, 100);
        const details = cleanText(req.body.details, 1000) || null;
        if (!reason) return res.status(400).json({success:false,message:"Select a report reason."});
        await db.query(
            `INSERT INTO review_reports (review_id, reporter_customer_id, reason, details) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE reason=VALUES(reason), details=VALUES(details), status='Pending', updated_at=CURRENT_TIMESTAMP`,
            [reviewId, reporterId, reason, details]
        );
        return res.status(201).json({success:true,message:"Review report submitted."});
    } catch { return res.status(500).json({success:false,message:"Unable to report review."}); }
};


/* =====================================================
   Products Eligible for Customer Review
   GET /api/reviews/eligible-products
===================================================== */

exports.getEligibleProducts = async (
    req,
    res
) => {
    try {
        const currentCustomerId =
            customerId(req);

        const orderId =
            integer(
                req.query.order_id
            );

        if (!currentCustomerId) {
            return res.status(401).json({
                success: false,
                message:
                    "Customer authentication is required."
            });
        }

        const parameters = [
            currentCustomerId
        ];

        let orderFilter = "";

        if (orderId) {
            orderFilter =
                " AND o.id = ? ";

            parameters.push(
                orderId
            );
        }

        const [products] =
            await db.query(
                `
                SELECT
                    oi.product_id,
                    p.product_name,

                    MAX(o.id)
                        AS latest_order_id,

                    MAX(o.order_number)
                        AS latest_order_number,

                    MAX(
                        COALESCE(
                            o.delivered_at,
                            o.updated_at,
                            o.created_at
                        )
                    ) AS delivered_at,

                    SUM(oi.quantity)
                        AS delivered_quantity,

                    MAX(r.id)
                        AS review_id,

                    MAX(r.status)
                        AS review_status,

                    CASE
                        WHEN MAX(r.id) IS NULL
                        THEN 1
                        ELSE 0
                    END AS can_review

                FROM orders o

                INNER JOIN order_items oi
                    ON oi.order_id =
                        o.id

                INNER JOIN products p
                    ON p.id =
                        oi.product_id

                LEFT JOIN reviews r
                    ON r.customer_id =
                        o.customer_id
                    AND r.product_id =
                        oi.product_id

                WHERE
                    o.customer_id = ?
                    AND LOWER(
                        o.order_status
                    ) = 'delivered'

                    ${orderFilter}

                GROUP BY
                    oi.product_id,
                    p.product_name

                ORDER BY
                    delivered_at DESC,
                    p.product_name ASC
                `,
                parameters
            );

        return res.json({
            success: true,
            message:
                "Delivered products fetched successfully.",

            products:
                products.map(
                    product => ({
                        ...product,

                        product_id:
                            Number(
                                product.product_id
                            ),

                        latest_order_id:
                            Number(
                                product.latest_order_id
                            ),

                        delivered_quantity:
                            Number(
                                product.delivered_quantity || 0
                            ),

                        can_review:
                            Boolean(
                                Number(
                                    product.can_review
                                )
                            )
                    })
                )
        });
    } catch (error) {
        console.error(
            "Eligible review products error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Unable to load delivered products for review.",

            error:
                process.env.NODE_ENV ===
                "production"
                    ? undefined
                    : error.message
        });
    }
};
