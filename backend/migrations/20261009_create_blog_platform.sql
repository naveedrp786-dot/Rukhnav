-- RUKHNAV Beauty Blog
-- Stage 1B-C
-- Schema definition only.
-- Execute separately after database review and approval.

CREATE TABLE IF NOT EXISTS blog_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_blog_category_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blog_articles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED NULL,
    title VARCHAR(220) NOT NULL,
    slug VARCHAR(240) NOT NULL,
    excerpt TEXT NULL,
    content_html LONGTEXT NOT NULL,
    featured_image VARCHAR(1000) NULL,
    author_name VARCHAR(150) NULL,
    status ENUM('draft','published','archived')
        NOT NULL DEFAULT 'draft',
    seo_title VARCHAR(220) NULL,
    seo_description VARCHAR(320) NULL,
    canonical_url VARCHAR(1000) NULL,
    published_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_blog_article_slug (slug),
    KEY idx_blog_status_published (status, published_at),
    KEY idx_blog_category (category_id),
    CONSTRAINT fk_blog_article_category
        FOREIGN KEY (category_id)
        REFERENCES blog_categories(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blog_article_products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_blog_article_product (article_id, product_id),
    KEY idx_blog_related_product (product_id),
    CONSTRAINT fk_blog_related_article
        FOREIGN KEY (article_id)
        REFERENCES blog_articles(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blog_affiliate_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT UNSIGNED NOT NULL,
    merchant_name VARCHAR(150) NOT NULL,
    product_name VARCHAR(220) NOT NULL,
    destination_url VARCHAR(2048) NOT NULL,
    image_url VARCHAR(2048) NULL,
    disclosure_text VARCHAR(500) NULL,
    display_order INT NOT NULL DEFAULT 0,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_blog_affiliate_article (article_id),
    CONSTRAINT fk_blog_affiliate_article
        FOREIGN KEY (article_id)
        REFERENCES blog_articles(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
