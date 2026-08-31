"use strict";

const db = require("../config/db");

const customerId = req =>
    Number(
        req.user?.id ||
        req.user?.customerId
    );

const clean = (
    value,
    maximum = 255
) =>
    String(value || "")
        .trim()
        .slice(0, maximum);

function validate(payload) {
    const address = {
        address_type:
            clean(
                payload.address_type ||
                "Home",
                30
            ),

        full_name:
            clean(
                payload.full_name,
                150
            ),

        phone:
            clean(
                payload.phone,
                40
            ),

        address_line1:
            clean(
                payload.address_line1,
                255
            ),

        address_line2:
            clean(
                payload.address_line2,
                255
            ) || null,

        city:
            clean(
                payload.city,
                120
            ),

        province:
            clean(
                payload.province,
                120
            ) || null,

        postal_code:
            clean(
                payload.postal_code,
                30
            ) || null,

        country:
            clean(
                payload.country ||
                "Pakistan",
                120
            ),

        delivery_instructions:
            clean(
                payload.delivery_instructions,
                500
            ) || null,

        is_default:
            Boolean(
                payload.is_default
            )
    };

    if (
        !address.full_name ||
        !address.phone ||
        !address.address_line1 ||
        !address.city
    ) {
        return {
            error:
                "Recipient name, phone, address and city are required."
        };
    }

    return {
        address
    };
}

async function ensureDefault(
    connection,
    id,
    customer
) {
    await connection.query(
        `
        UPDATE customer_addresses
        SET is_default = 0
        WHERE customer_id = ?
        `,
        [customer]
    );

    await connection.query(
        `
        UPDATE customer_addresses
        SET is_default = 1
        WHERE id = ?
          AND customer_id = ?
        `,
        [id, customer]
    );
}

exports.getAll = async (
    req,
    res
) => {
    try {
        const [rows] =
            await db.query(
                `
                SELECT
                    id,
                    address_type,
                    full_name,
                    phone,
                    address_line1,
                    address_line2,
                    city,
                    province,
                    postal_code,
                    country,
                    delivery_instructions,
                    is_default,
                    created_at,
                    updated_at
                FROM customer_addresses
                WHERE customer_id = ?
                ORDER BY
                    is_default DESC,
                    id DESC
                `,
                [customerId(req)]
            );

        return res.json({
            success: true,
            addresses: rows
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message:
                "Unable to load saved addresses."
        });
    }
};

exports.create = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        const customer =
            customerId(req);

        const result =
            validate(req.body);

        if (result.error) {
            return res.status(400).json({
                success: false,
                message:
                    result.error
            });
        }

        await connection.beginTransaction();

        const [[count]] =
            await connection.query(
                `
                SELECT COUNT(*) AS total
                FROM customer_addresses
                WHERE customer_id = ?
                `,
                [customer]
            );

        const address = {
            ...result.address,
            is_default:
                result.address.is_default ||
                Number(count.total) === 0
        };

        const [insert] =
            await connection.query(
                `
                INSERT INTO customer_addresses
                (
                    customer_id,
                    address_type,
                    full_name,
                    phone,
                    address_line1,
                    address_line2,
                    city,
                    province,
                    postal_code,
                    country,
                    delivery_instructions,
                    is_default
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    customer,
                    address.address_type,
                    address.full_name,
                    address.phone,
                    address.address_line1,
                    address.address_line2,
                    address.city,
                    address.province,
                    address.postal_code,
                    address.country,
                    address.delivery_instructions,
                    address.is_default ? 1 : 0
                ]
            );

        if (address.is_default) {
            await ensureDefault(
                connection,
                insert.insertId,
                customer
            );
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message:
                "Address added successfully.",
            addressId:
                insert.insertId
        });
    } catch (error) {
        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Unable to add address."
        });
    } finally {
        connection.release();
    }
};

exports.update = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        const customer =
            customerId(req);

        const id =
            Number(req.params.id);

        const result =
            validate(req.body);

        if (
            !Number.isInteger(id) ||
            id < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid address ID is required."
            });
        }

        if (result.error) {
            return res.status(400).json({
                success: false,
                message:
                    result.error
            });
        }

        await connection.beginTransaction();

        const [update] =
            await connection.query(
                `
                UPDATE customer_addresses
                SET
                    address_type = ?,
                    full_name = ?,
                    phone = ?,
                    address_line1 = ?,
                    address_line2 = ?,
                    city = ?,
                    province = ?,
                    postal_code = ?,
                    country = ?,
                    delivery_instructions = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND customer_id = ?
                `,
                [
                    result.address.address_type,
                    result.address.full_name,
                    result.address.phone,
                    result.address.address_line1,
                    result.address.address_line2,
                    result.address.city,
                    result.address.province,
                    result.address.postal_code,
                    result.address.country,
                    result.address.delivery_instructions,
                    id,
                    customer
                ]
            );

        if (!update.affectedRows) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Address not found."
            });
        }

        if (
            result.address.is_default
        ) {
            await ensureDefault(
                connection,
                id,
                customer
            );
        }

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Address updated successfully."
        });
    } catch (error) {
        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Unable to update address."
        });
    } finally {
        connection.release();
    }
};

exports.setDefault = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        const id =
            Number(req.params.id);

        const customer =
            customerId(req);

        await connection.beginTransaction();

        const [[address]] =
            await connection.query(
                `
                SELECT id
                FROM customer_addresses
                WHERE id = ?
                  AND customer_id = ?
                LIMIT 1
                `,
                [id, customer]
            );

        if (!address) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Address not found."
            });
        }

        await ensureDefault(
            connection,
            id,
            customer
        );

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Default address updated."
        });
    } catch (error) {
        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Unable to update default address."
        });
    } finally {
        connection.release();
    }
};

exports.remove = async (
    req,
    res
) => {
    const connection =
        await db.getConnection();

    try {
        const id =
            Number(req.params.id);

        const customer =
            customerId(req);

        await connection.beginTransaction();

        const [[address]] =
            await connection.query(
                `
                SELECT id, is_default
                FROM customer_addresses
                WHERE id = ?
                  AND customer_id = ?
                LIMIT 1
                `,
                [id, customer]
            );

        if (!address) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Address not found."
            });
        }

        await connection.query(
            `
            DELETE FROM customer_addresses
            WHERE id = ?
              AND customer_id = ?
            `,
            [id, customer]
        );

        if (address.is_default) {
            const [[next]] =
                await connection.query(
                    `
                    SELECT id
                    FROM customer_addresses
                    WHERE customer_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                    `,
                    [customer]
                );

            if (next) {
                await ensureDefault(
                    connection,
                    next.id,
                    customer
                );
            }
        }

        await connection.commit();

        return res.json({
            success: true,
            message:
                "Address deleted successfully."
        });
    } catch (error) {
        await connection.rollback();

        return res.status(500).json({
            success: false,
            message:
                "Unable to delete address."
        });
    } finally {
        connection.release();
    }
};
