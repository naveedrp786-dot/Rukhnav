CREATE TABLE IF NOT EXISTS customer_notifications (
    id BIGINT NOT NULL AUTO_INCREMENT,

    customer_id INT NOT NULL,

    notification_type ENUM(
        'Order',
        'Promotion',
        'Sale',
        'New Product',
        'Announcement',
        'Reward',
        'Review',
        'Loyalty',
        'Return',
        'Refund',
        'Account',
        'Event',
        'General'
    ) NOT NULL DEFAULT 'General',

    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,

    action_label VARCHAR(80) DEFAULT NULL,
    action_url VARCHAR(500) DEFAULT NULL,

    order_id INT DEFAULT NULL,
    campaign_id BIGINT DEFAULT NULL,

    reference_type VARCHAR(60) DEFAULT NULL,
    reference_id VARCHAR(100) DEFAULT NULL,

    icon VARCHAR(80) DEFAULT NULL,

    priority ENUM(
        'Low',
        'Normal',
        'High',
        'Urgent'
    ) NOT NULL DEFAULT 'Normal',

    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME DEFAULT NULL,

    expires_at DATETIME DEFAULT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_customer_notification_customer (
        customer_id,
        is_read,
        created_at
    ),

    KEY idx_customer_notification_order (
        order_id
    ),

    KEY idx_customer_notification_campaign (
        campaign_id
    ),

    KEY idx_customer_notification_expiry (
        expires_at
    ),

    CONSTRAINT fk_customer_notification_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_customer_notification_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT fk_customer_notification_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES notification_campaigns(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
