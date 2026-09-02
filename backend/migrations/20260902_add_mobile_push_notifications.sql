-- =========================================================
-- RUKHNAV Mobile Push Notifications
-- Additive migration for Expo Push Notifications
-- =========================================================

CREATE TABLE IF NOT EXISTS customer_push_devices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    customer_id INT NOT NULL,

    expo_push_token VARCHAR(255) NOT NULL,
    platform ENUM('android','ios') NOT NULL,

    device_name VARCHAR(190) DEFAULT NULL,
    device_id VARCHAR(190) DEFAULT NULL,

    is_active TINYINT(1) NOT NULL DEFAULT 1,

    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_customer_push_token (
        expo_push_token
    ),

    KEY idx_customer_push_devices_customer (
        customer_id,
        is_active
    ),

    KEY idx_customer_push_devices_device (
        customer_id,
        device_id
    ),

    CONSTRAINT fk_customer_push_devices_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------
-- Add Push to Notification Center channel settings
-- ---------------------------------------------------------

ALTER TABLE notification_channel_settings
    MODIFY COLUMN channel
    ENUM(
        'Email',
        'WhatsApp',
        'SMS',
        'Push'
    ) NOT NULL;


INSERT INTO notification_channel_settings
(
    channel,
    enabled,
    provider,
    simulation_mode,
    from_name,
    from_address
)
VALUES
(
    'Push',
    0,
    'Expo',
    0,
    'RUKHNAV',
    NULL
)
ON DUPLICATE KEY UPDATE
    provider = VALUES(provider);


-- ---------------------------------------------------------
-- Add Push to notification templates
-- ---------------------------------------------------------

ALTER TABLE notification_templates
    MODIFY COLUMN channel
    ENUM(
        'Email',
        'WhatsApp',
        'SMS',
        'Push'
    ) NOT NULL;


-- ---------------------------------------------------------
-- Add Push to delivery logs
-- ---------------------------------------------------------

ALTER TABLE notification_delivery_logs
    MODIFY COLUMN channel
    ENUM(
        'Email',
        'WhatsApp',
        'SMS',
        'Push'
    ) NOT NULL;


-- ---------------------------------------------------------
-- Add Push to notification queue
-- ---------------------------------------------------------

ALTER TABLE notification_queue
    MODIFY COLUMN channel
    ENUM(
        'Email',
        'WhatsApp',
        'SMS',
        'Push'
    ) NOT NULL;


-- ---------------------------------------------------------
-- Add Push to notification event rules
-- ---------------------------------------------------------

ALTER TABLE notification_event_rules
    MODIFY COLUMN channel
    ENUM(
        'Email',
        'WhatsApp',
        'SMS',
        'Push'
    ) NOT NULL;

