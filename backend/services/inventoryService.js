"use strict";

// =====================================================
// RUKHNAV ERP — Shared Inventory Service
// =====================================================

function getStockStatus(
    stockQuantity,
    lowStockLevel
) {
    const stock =
        Number(stockQuantity || 0);

    const lowLevel =
        Number(lowStockLevel || 0);

    if (stock <= 0) {
        return "Out of Stock";
    }

    if (stock <= lowLevel) {
        return "Low Stock";
    }

    return "In Stock";
}

function validateMovement({
    productId,
    transactionType,
    quantity,
    previousStock,
    newStock
}) {
    if (
        !Number.isInteger(Number(productId)) ||
        Number(productId) <= 0
    ) {
        throw new Error(
            "A valid product ID is required for an inventory movement."
        );
    }

    const allowedTypes = [
        "Stock In",
        "Stock Out",
        "Adjustment"
    ];

    if (
        !allowedTypes.includes(
            transactionType
        )
    ) {
        throw new Error(
            "Invalid inventory transaction type."
        );
    }

    if (
        !Number.isFinite(Number(quantity)) ||
        Number(quantity) <= 0
    ) {
        throw new Error(
            "Inventory movement quantity must be greater than zero."
        );
    }

    if (
        !Number.isFinite(Number(previousStock)) ||
        Number(previousStock) < 0
    ) {
        throw new Error(
            "Previous stock must be zero or greater."
        );
    }

    if (
        !Number.isFinite(Number(newStock)) ||
        Number(newStock) < 0
    ) {
        throw new Error(
            "New stock must be zero or greater."
        );
    }
}

async function recordMovement(
    connection,
    {
        productId,
        transactionType,
        quantity,
        previousStock,
        newStock,
        costPrice = 0,
        supplierId = null,
        reference = null,
        remarks = null,
        createdBy = null
    }
) {
    if (
        !connection ||
        typeof connection.query !== "function"
    ) {
        throw new Error(
            "A valid database connection is required."
        );
    }

    validateMovement({
        productId,
        transactionType,
        quantity,
        previousStock,
        newStock
    });

    const movementReference =
        String(
            reference ||
            `INV-${productId}-${Date.now()}`
        ).trim();

    const [result] =
        await connection.query(
            `
            INSERT INTO inventory_transactions
            (
                product_id,
                transaction_type,
                quantity,
                previous_stock,
                new_stock,
                cost_price,
                supplier_id,
                reference,
                remarks,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                Number(productId),
                transactionType,
                Number(quantity),
                Number(previousStock),
                Number(newStock),
                Number(costPrice || 0),
                supplierId
                    ? Number(supplierId)
                    : null,
                movementReference,
                remarks
                    ? String(remarks).trim()
                    : null,
                createdBy
                    ? Number(createdBy)
                    : null
            ]
        );

    return {
        id: result.insertId,
        productId:
            Number(productId),
        transactionType,
        quantity:
            Number(quantity),
        previousStock:
            Number(previousStock),
        newStock:
            Number(newStock),
        reference:
            movementReference
    };
}

module.exports = {
    getStockStatus,
    recordMovement
};
