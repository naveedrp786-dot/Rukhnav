CREATE TABLE IF NOT EXISTS notification_campaigns (
    id BIGINT NOT NULL AUTO_INCREMENT,

    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL DEFAULT 'Custom',
    audience_type VARCHAR(100) NOT NULL DEFAULT 'Selected Customers',

    send_email TINYINT(1) NOT NULL DEFAULT 0,
    send_whatsapp TINYINT(1) NOT NULL DEFAULT 0,

    email_template_id BIGINT NULL,
    whatsapp_template_id BIGINT NULL,

    email_subject VARCHAR(255) NULL,
    email_body LONGTEXT NULL,
    whatsapp_message LONGTEXT NULL,

    status ENUM(
        'Draft',
        'Scheduled',
        'Processing',
        'Completed',
        'Failed',
        'Cancelled'
    ) NOT NULL DEFAULT 'Draft',

    scheduled_at DATETIME NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,

    total_recipients INT NOT NULL DEFAULT 0,
    queued_count INT NOT NULL DEFAULT 0,
    sent_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,

    created_by_admin_id INT NULL,
    updated_by_admin_id INT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_notification_campaign_status (status),
    INDEX idx_notification_campaign_scheduled (
        status,
        scheduled_at
    ),
    INDEX idx_notification_campaign_created_at (
        created_at
    )
);


CREATE TABLE IF NOT EXISTS notification_campaign_recipients (
    id BIGINT NOT NULL AUTO_INCREMENT,

    campaign_id BIGINT NOT NULL,
    customer_id INT NULL,

    recipient_name VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    whatsapp_number VARCHAR(50) NULL,

    email_status ENUM(
        'Not Selected',
        'Queued',
        'Sent',
        'Failed',
        'Skipped',
        'Unsubscribed'
    ) NOT NULL DEFAULT 'Not Selected',

    whatsapp_status ENUM(
        'Not Selected',
        'Queued',
        'Sent',
        'Failed',
        'Skipped',
        'Unsubscribed'
    ) NOT NULL DEFAULT 'Not Selected',

    email_queue_id BIGINT NULL,
    whatsapp_queue_id BIGINT NULL,

    email_error TEXT NULL,
    whatsapp_error TEXT NULL,

    email_sent_at DATETIME NULL,
    whatsapp_sent_at DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_campaign_recipient_campaign (
        campaign_id
    ),

    INDEX idx_campaign_recipient_customer (
        customer_id
    ),

    INDEX idx_campaign_recipient_email_queue (
        email_queue_id
    ),

    INDEX idx_campaign_recipient_whatsapp_queue (
        whatsapp_queue_id
    ),

    CONSTRAINT fk_notification_campaign_recipient_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES notification_campaigns(id)
        ON DELETE CASCADE
);
