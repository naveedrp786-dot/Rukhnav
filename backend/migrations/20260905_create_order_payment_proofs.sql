CREATE TABLE IF NOT EXISTS order_payment_proofs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    order_id INT NOT NULL,

    receipt_filename VARCHAR(255) NOT NULL,
    receipt_original_name VARCHAR(255) NULL,
    receipt_mime_type VARCHAR(100) NOT NULL,
    receipt_size INT UNSIGNED NOT NULL DEFAULT 0,

    verification_status
        ENUM('Pending','Verified','Rejected')
        NOT NULL DEFAULT 'Pending',

    verified_by INT NULL,
    verified_at DATETIME NULL,

    rejection_reason VARCHAR(1000) NULL,

    created_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_order_payment_proof_order (
        order_id
    ),

    KEY idx_order_payment_proof_status (
        verification_status
    ),

    KEY idx_order_payment_proof_verified_by (
        verified_by
    ),

    CONSTRAINT fk_order_payment_proof_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_order_payment_proof_admin
        FOREIGN KEY (verified_by)
        REFERENCES admins(id)
        ON DELETE SET NULL
);
