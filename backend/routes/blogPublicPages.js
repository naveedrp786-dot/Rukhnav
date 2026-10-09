"use strict";

const express = require("express");
const db = require("../config/db");

const router = express.Router();

const BASE = "https://www.rukhnav.store";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeArticleHtml(value) {
  const source = String(value == null ? "" : value);

  // Only interpret markup produced by the plain-text editor.
  const paragraphs = source.split(/<\/p\s*>/i);
  const result = [];

  for (const fragment of paragraphs) {
    const text = fragment.replace(/^\s*<p\s*>/i, "");
    if (!text.trim()) continue;

    const parts = text.split(/<br\s*\/?\s*>/i);
    const escaped = parts.map(part => {
      // Decode the known editor entities once, then re-escape.
      const decoded = part
        .replace(/&#39;/g, "\x27")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&amp;/g, "&");
      return escapeHtml(decoded);
    }).join('<br>');

    result.push("<p>" + escaped + "</p>");
  }

  return result.join("\n");
}

function page({ title, description, canonical, body }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeCanonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeCanonical}">
<link rel="stylesheet" href="/store/css/theme.css">
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Arial,sans-serif;background:#faf9f6;color:#24332c}
header{background:#183f34;color:white;padding:20px 6%}
header a{color:white;text-decoration:none;margin-right:22px}
header strong{font-size:22px;letter-spacing:2px}
nav{margin-top:14px}
main{max-width:1050px;margin:40px auto;padding:0 20px}
h1{font-size:clamp(30px,5vw,46px)}
h2{line-height:1.3}
a{color:#176b55}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}
.card{background:white;border:1px solid #e5e8e2;border-radius:12px;padding:24px}
.card h2{font-size:22px;margin-top:0}
.card p{line-height:1.7;color:#5c675e}
.article{background:white;border-radius:12px;padding:clamp(20px,5vw,48px)}
.article-content{font-size:18px;line-height:1.85}
.article-content p{margin:0 0 20px}
.article-content br{display:block}
.meta{color:#69776d;font-size:14px}
footer{padding:35px 6%;background:#183f34;color:white;margin-top:60px}
footer a{color:white}
</style>
</head>
<body>
<header>
<a href="/store/index.html"><strong>RUKHNAV</strong></a>
<nav>
<a href="/store/index.html">Home</a>
<a href="/store/products.html">Shop</a>
<a href="/blog">Beauty Blog</a>
</nav>
</header>
<main>${body}</main>
<footer>
<p>RUKHNAV — Beauty, Haircare &amp; Skincare</p>
<a href="/store/privacy-policy.html">Privacy Policy</a>
</footer>
</body>
</html>`;
}

function unavailable(res, error) {
  if (error && error.code === "ER_NO_SUCH_TABLE") {
    return res.status(503).type("html").send(
      page({
        title: "Blog Temporarily Unavailable | RUKHNAV",
        description: "Please try again later.",
        canonical: `${BASE}/blog`,
        body: "<h1>Blog temporarily unavailable</h1>"
      })
    );
  }

  console.error(
    "Public blog rendering failed:",
    error && error.code || "UNKNOWN"
  );

  return res.status(500).send("Blog temporarily unavailable");
}

router.get("/", async (req, res) => {
  try {
    const [articles] = await db.query(
      `SELECT title, slug, excerpt, author_name, published_at
       FROM blog_articles
       WHERE status = 'published'
         AND published_at <= NOW()
       ORDER BY published_at DESC, id DESC
       LIMIT 50`
    );

    const cards = articles.map(article => `
      <article class="card">
        <h2>
          <a href="/blog/${encodeURIComponent(article.slug)}">
            ${escapeHtml(article.title)}
          </a>
        </h2>
        <p>${escapeHtml(article.excerpt || "")}</p>
        <a href="/blog/${encodeURIComponent(article.slug)}">
          Read article →
        </a>
      </article>
    `).join("");

    const body = `
      <h1>Beauty &amp; Haircare Blog</h1>
      <p>Explore practical guides, beauty tips and haircare advice.</p>
      <div class="grid">
        ${cards || "<p>New articles coming soon.</p>"}
      </div>
    `;

    return res.type("html").send(
      page({
        title: "Beauty & Haircare Blog | RUKHNAV",
        description:
          "Explore beauty, haircare and skincare guides from RUKHNAV.",
        canonical: `${BASE}/blog`,
        body
      })
    );
  } catch (error) {
    return unavailable(res, error);
  }
});

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug;

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 240) {
    return res.status(404).send("Article not found");
  }

  try {
    const [rows] = await db.query(
      `SELECT title, slug, excerpt, content_html,
              seo_title, seo_description, published_at,
              author_name
       FROM blog_articles
       WHERE slug = ?
         AND status = 'published'
         AND published_at <= NOW()
       LIMIT 1`,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).send("Article not found");
    }

    const article = rows[0];
    const canonical = `${BASE}/blog/${slug}`;

    // Article HTML is created from escaped plain text by the
    // current blog controller. Rich HTML must be sanitized
    // before enabling a rich-text editor.
    const body = `
      <article class="article">
        <p><a href="/blog">← All articles</a></p>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="meta">
          ${escapeHtml(article.author_name || "RUKHNAV Editorial")}
        </p>
        <div class="article-content">
          ${safeArticleHtml(article.content_html)}
        </div>
      </article>
    `;

    return res.type("html").send(
      page({
        title: article.seo_title ||
          `${article.title} | RUKHNAV`,
        description: article.seo_description ||
          article.excerpt ||
          "Beauty and haircare advice from RUKHNAV.",
        canonical,
        body
      })
    );
  } catch (error) {
    return unavailable(res, error);
  }
});

module.exports = router;
