"use strict";

const db = require("../config/db");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toSafeHtml(text) {
  return String(text)
    .split(/\r?\n\r?\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, "<br>")}</p>`)
    .join("\n");
}

function validSlug(value) {
  return typeof value === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value.length <= 240;
}

function validText(value, max) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max;
}

function databaseError(res, err) {
  if (err && err.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).json({
      error: "BLOG_DATABASE_NOT_READY"
    });
  }

  console.error("Blog database operation failed:", err.code || "UNKNOWN");

  return res.status(500).json({
    error: "BLOG_OPERATION_FAILED"
  });
}

exports.listPublished = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, slug, excerpt, featured_image,
              author_name, published_at
       FROM blog_articles
       WHERE status = 'published'
         AND published_at <= NOW()
       ORDER BY published_at DESC, id DESC
       LIMIT 50`
    );

    return res.json({ articles: rows });
  } catch (err) {
    return databaseError(res, err);
  }
};

exports.getPublished = async (req, res) => {
  const { slug } = req.params;

  if (!validSlug(slug)) {
    return res.status(400).json({ error: "INVALID_SLUG" });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, title, slug, excerpt, content_html,
              featured_image, author_name,
              seo_title, seo_description,
              canonical_url, published_at
       FROM blog_articles
       WHERE slug = ?
         AND status = 'published'
         AND published_at <= NOW()
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "ARTICLE_NOT_FOUND" });
    }

    return res.json({ article: rows[0] });
  } catch (err) {
    return databaseError(res, err);
  }
};

exports.listAdmin = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, slug, status,
              category_id, published_at,
              created_at, updated_at
       FROM blog_articles
       ORDER BY updated_at DESC, id DESC
       LIMIT 100`
    );

    return res.json({ articles: rows });
  } catch (err) {
    return databaseError(res, err);
  }
};

exports.createDraft = async (req, res) => {
  const { title, slug, content_text, excerpt } = req.body || {};

  if (
    !validText(title, 220) ||
    !validSlug(slug) ||
    !validText(content_text, 100000) ||
    (excerpt != null &&
      (typeof excerpt !== "string" || excerpt.length > 5000))
  ) {
    return res.status(400).json({ error: "INVALID_ARTICLE_DATA" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO blog_articles
       (title, slug, excerpt, content_html, status)
       VALUES (?, ?, ?, ?, 'draft')`,
      [
        title.trim(),
        slug,
        excerpt || null,
        toSafeHtml(content_text)
      ]
    );

    return res.status(201).json({
      id: result.insertId,
      status: "draft"
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "SLUG_ALREADY_EXISTS" });
    }
    return databaseError(res, err);
  }
};

exports.updateDraft = async (req, res) => {
  const id = Number(req.params.id);
  const { title, slug, content_text, excerpt } = req.body || {};

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !validText(title, 220) ||
    !validSlug(slug) ||
    !validText(content_text, 100000) ||
    (excerpt != null &&
      (typeof excerpt !== "string" || excerpt.length > 5000))
  ) {
    return res.status(400).json({ error: "INVALID_ARTICLE_DATA" });
  }

  try {
    const [result] = await db.query(
      `UPDATE blog_articles
       SET title = ?, slug = ?, excerpt = ?,
           content_html = ?
       WHERE id = ? AND status = 'draft'`,
      [
        title.trim(),
        slug,
        excerpt || null,
        toSafeHtml(content_text),
        id
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        error: "DRAFT_NOT_FOUND"
      });
    }

    return res.json({ id, status: "draft" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "SLUG_ALREADY_EXISTS" });
    }
    return databaseError(res, err);
  }
};

exports.publish = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: "INVALID_ARTICLE_ID" });
  }

  try {
    const [result] = await db.query(
      `UPDATE blog_articles
       SET status = 'published',
           published_at = NOW()
       WHERE id = ? AND status = 'draft'`,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        error: "DRAFT_NOT_FOUND"
      });
    }

    return res.json({ id, status: "published" });
  } catch (err) {
    return databaseError(res, err);
  }
};


exports.getAdminArticle = async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "INVALID_ARTICLE_ID"
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, title, slug, excerpt, content_html,
              status, category_id, published_at
       FROM blog_articles
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "ARTICLE_NOT_FOUND"
      });
    }

    return res.json({ article: rows[0] });
  } catch (err) {
    return databaseError(res, err);
  }
};
