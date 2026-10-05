CREATE TABLE IF NOT EXISTS customer_password_recovery_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    customer_id INT NOT NULL,

    request_token_hash CHAR(64) NOT NULL,

    status ENUM(
        'Pending',
        'Approved',
        'Used',
        'Expired',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending',

    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    approved_at TIMESTAMP NULL DEFAULT NULL,

    approved_by_admin_id INT NULL DEFAULT NULL,

    expires_at DATETIME NOT NULL,

    used_at TIMESTAMP NULL DEFAULT NULL,

    cancelled_at TIMESTAMP NULL DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_customer_password_recovery_token (
        request_token_hash
    ),

    KEY idx_customer_password_recovery_customer (
        customer_id
    ),

    KEY idx_customer_password_recovery_status (
        status
    ),

    KEY idx_customer_password_recovery_customer_status (
        customer_id,
        status
    ),

    KEY idx_customer_password_recovery_expires (
        expires_at
    )
);
