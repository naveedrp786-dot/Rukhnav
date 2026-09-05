"use strict";

const fs = require("fs");
const path = require("path");

const db =
    require("../config/db");

const {
    getPrivateDirectory
} = require(
    "../config/privateStorage"
);

const proofDirectory =
    getPrivateDirectory(
        "payment-proofs"
    );

const MANUAL_METHODS =
    new Set([
        "jazzcash",
        "easypaisa",
        "bank_transfer"
    ]);

const normaliseOrderMethod =
    value =>
        String(value || "")
            .trim()
            .toLowerCase()
            .replace(
                /\s+/g,
                "_"
            );

const fail = (
    message,
    statusCode = 400
) => {
    const error =
        new Error(message);

    error.statusCode =
        statusCode;

    return error;
};

const safeUnlink =
    filename => {
        if (!filename) {
            return;
        }

        const safeName =
            path.basename(
                filename
            );

        const fullPath =
            path.join(
                proofDirectory,
                safeName
            );

        try {
            fs.unlinkSync(
                fullPath
            );
        } catch (error) {
            if (
                error.code !==
                "ENOENT"
            ) {
                console.error(
                    "Unable to remove payment proof:",
                    error
                );
            }
        }
    };

async function getOrderForProof(
    orderId,
    customerId = null
) {
    const params =
        [orderId];

    let ownershipSql =
        "";

    if (customerId !== null) {
        ownershipSql =
            " AND customer_id = ?";

        params.push(
            customerId
        );
    }

    const [[order]] =
        await db.query(
            `
                SELECT
                    id,
                    order_number,
                    customer_id,
                    checkout_type,
                    payment_method,
                    payment_status,
                    transaction_id,
                    payment_phone,
                    grand_total,
                    paid_amount,
                    balance_amount
                FROM orders
                WHERE id = ?
                ${ownershipSql}
                LIMIT 1
            `,
            params
        );

    return order || null;
}

async function saveProof({
    orderId,
    customerId = null,
    file
}) {
    if (!file) {
        throw fail(
            "Payment receipt image is required."
        );
    }

    const order =
        await getOrderForProof(
            orderId,
            customerId
        );

    if (!order) {
        safeUnlink(
            file.filename
        );

        throw fail(
            "Order not found.",
            404
        );
    }

    const method =
        normaliseOrderMethod(
            order.payment_method
        );

    if (
        !MANUAL_METHODS.has(
            method
        )
    ) {
        safeUnlink(
            file.filename
        );

        throw fail(
            "A payment receipt can only be submitted for a manual payment order.",
            409
        );
    }

    if (
        String(
            order.payment_status ||
            ""
        )
            .toLowerCase() ===
        "paid"
    ) {
        safeUnlink(
            file.filename
        );

        throw fail(
            "This order is already paid.",
            409
        );
    }

    if (
        !order.transaction_id
    ) {
        safeUnlink(
            file.filename
        );

        throw fail(
            "The order does not have a transaction reference.",
            409
        );
    }

    if (
        (
            method === "jazzcash" ||
            method === "easypaisa"
        ) &&
        !order.payment_phone
    ) {
        safeUnlink(
            file.filename
        );

        throw fail(
            "The order does not have a payment phone number.",
            409
        );
    }

    const [[existing]] =
        await db.query(
            `
                SELECT *
                FROM order_payment_proofs
                WHERE order_id = ?
                LIMIT 1
            `,
            [orderId]
        );

    if (
        existing &&
        existing.verification_status ===
            "Verified"
    ) {
        safeUnlink(
            file.filename
        );

        throw fail(
            "The payment proof for this order has already been verified.",
            409
        );
    }

    if (existing) {
        await db.query(
            `
                UPDATE order_payment_proofs
                SET
                    receipt_filename = ?,
                    receipt_original_name = ?,
                    receipt_mime_type = ?,
                    receipt_size = ?,
                    verification_status = 'Pending',
                    verified_by = NULL,
                    verified_at = NULL,
                    rejection_reason = NULL
                WHERE order_id = ?
            `,
            [
                file.filename,
                String(
                    file.originalname ||
                    ""
                ).slice(
                    0,
                    255
                ) || null,
                file.mimetype,
                Number(
                    file.size ||
                    0
                ),
                orderId
            ]
        );

        if (
            existing.receipt_filename &&
            existing.receipt_filename !==
                file.filename
        ) {
            safeUnlink(
                existing
                    .receipt_filename
            );
        }
    } else {
        await db.query(
            `
                INSERT INTO order_payment_proofs
                (
                    order_id,
                    receipt_filename,
                    receipt_original_name,
                    receipt_mime_type,
                    receipt_size,
                    verification_status
                )
                VALUES
                (?, ?, ?, ?, ?, 'Pending')
            `,
            [
                orderId,
                file.filename,
                String(
                    file.originalname ||
                    ""
                ).slice(
                    0,
                    255
                ) || null,
                file.mimetype,
                Number(
                    file.size ||
                    0
                )
            ]
        );
    }

    const [[proof]] =
        await db.query(
            `
                SELECT
                    id,
                    order_id,
                    receipt_original_name,
                    receipt_mime_type,
                    receipt_size,
                    verification_status,
                    verified_by,
                    verified_at,
                    rejection_reason,
                    created_at,
                    updated_at
                FROM order_payment_proofs
                WHERE order_id = ?
                LIMIT 1
            `,
            [orderId]
        );

    return {
        order,
        proof
    };
}

async function getProof(
    orderId
) {
    const [[proof]] =
        await db.query(
            `
                SELECT
                    opp.*,
                    o.order_number,
                    o.customer_id,
                    o.checkout_type,
                    o.payment_method,
                    o.payment_status,
                    o.transaction_id,
                    o.payment_phone,
                    o.grand_total,
                    o.paid_amount,
                    o.balance_amount
                FROM order_payment_proofs opp
                INNER JOIN orders o
                    ON o.id =
                       opp.order_id
                WHERE opp.order_id = ?
                LIMIT 1
            `,
            [orderId]
        );

    return proof || null;
}

function getProofFilePath(
    filename
) {
    if (!filename) {
        return null;
    }

    return path.join(
        proofDirectory,
        path.basename(
            filename
        )
    );
}

module.exports = {
    saveProof,
    getProof,
    getProofFilePath,
    safeUnlink
};
