"use strict";

const db = require("../config/db");

const {
    awardReferralBonus
} = require("./loyaltyTransactionService");

/**
 * Create an application error.
 */
function createError(
    message,
    statusCode = 400,
    code = "REFERRAL_ERROR"
) {
    const error = new Error(message);

    error.statusCode = statusCode;
    error.code = code;

    return error;
}

/**
 * Convert a database value safely.
 */
function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

/**
 * Award a referral bonus after the referred
 * customer completes their first paid sale.
 */
async function processFirstPaidSaleReferral({
    referredCustomerId,
    saleId,
    saleNumber = null
}) {
    const parsedCustomerId =
        Number.parseInt(
            referredCustomerId,
            10
        );

    const parsedSaleId =
        Number.parseInt(
            saleId,
            10
        );

    if (
        !Number.isInteger(parsedCustomerId) ||
        parsedCustomerId <= 0
    ) {
        throw createError(
            "A valid referred customer ID is required.",
            400,
            "INVALID_REFERRED_CUSTOMER_ID"
        );
    }

    if (
        !Number.isInteger(parsedSaleId) ||
        parsedSaleId <= 0
    ) {
        throw createError(
            "A valid sale ID is required.",
            400,
            "INVALID_SALE_ID"
        );
    }

    /*
     * Find the referral relationship and
     * the reward configured for the
     * referrer's current membership category.
     */
    const [referralRows] =
        await db.query(
            `
            SELECT
                referral.id,
                referral.referral_code_used,
                referral.referrer_customer_id,
                referral.referred_customer_id,
                referral.status,
                referral.referrer_reward_points,

                referrer.full_name
                    AS referrer_name,

                referred.full_name
                    AS referred_customer_name,

                COALESCE(
                    rewards.membership_level,
                    'Bronze'
                ) AS referrer_membership,

                category.referral_bonus_points

            FROM customer_referrals referral

            JOIN customers referrer
                ON referrer.id =
                   referral.referrer_customer_id

            JOIN customers referred
                ON referred.id =
                   referral.referred_customer_id

            LEFT JOIN customer_rewards rewards
                ON rewards.customer_id =
                   referral.referrer_customer_id

            JOIN customer_loyalty_categories category
                ON category.category_name =
                   COALESCE(
                       rewards.membership_level,
                       'Bronze'
                   )

            WHERE
                referral.referred_customer_id = ?
                AND category.status = 'Active'
                AND referrer.status = 'Active'
                AND referrer.deleted_at IS NULL

            LIMIT 1
            `,
            [parsedCustomerId]
        );

    /*
     * The customer may have registered
     * without using a referral code.
     */
    if (referralRows.length === 0) {
        return {
            success: true,
            referralFound: false,
            rewarded: false,
            alreadyRewarded: false,
            message:
                "This customer was not referred by another customer."
        };
    }

    const referral =
        referralRows[0];

    /*
     * Find the customer's first completed
     * and fully paid sale.
     *
     * Cancelled sales are not eligible.
     */
    const [[firstPaidSale]] =
        await db.query(
            `
            SELECT
                MIN(id) AS first_paid_sale_id

            FROM sales

            WHERE
                customer_id = ?
                AND payment_status = 'Paid'
                AND sale_status = 'Completed'
            `,
            [parsedCustomerId]
        );

    const firstPaidSaleId =
        Number(
            firstPaidSale
                .first_paid_sale_id
        );

    if (
        !firstPaidSaleId ||
        firstPaidSaleId !== parsedSaleId
    ) {
        return {
            success: true,
            referralFound: true,
            rewarded: false,
            alreadyRewarded:
                referral.status === "Rewarded",
            message:
                "Referral bonuses are only awarded from the referred customer's first completed and paid sale."
        };
    }

    const bonusPoints =
        Math.floor(
            toNumber(
                referral
                    .referral_bonus_points
            )
        );

    if (bonusPoints <= 0) {
        return {
            success: true,
            referralFound: true,
            rewarded: false,
            alreadyRewarded: false,
            message:
                "The referrer's membership category does not currently provide referral bonus points."
        };
    }

    /*
     * awardReferralBonus() uses the referred
     * customer's ID as its idempotency key.
     *
     * This prevents duplicate referral rewards.
     */
    const ledgerResult =
        await awardReferralBonus({
            customerId:
                referral
                    .referrer_customer_id,

            points:
                bonusPoints,

            referredCustomerId:
                referral
                    .referred_customer_id,

            referenceNumber:
                saleNumber ||
                `SALE-${parsedSaleId}`,

            description:
                `Referral reward for referring ${referral.referred_customer_name}.`,

            metadata: {
                referralId:
                    referral.id,

                referredCustomerId:
                    referral
                        .referred_customer_id,

                referredCustomerName:
                    referral
                        .referred_customer_name,

                qualifyingSaleId:
                    parsedSaleId,

                qualifyingSaleNumber:
                    saleNumber,

                referrerMembership:
                    referral
                        .referrer_membership,

                referralCodeUsed:
                    referral
                        .referral_code_used
            }
        });

    /*
     * Keep customer_referrals synchronized
     * with the loyalty transaction ledger.
     */
    await db.query(
        `
        UPDATE customer_referrals

        SET
            status = 'Rewarded',
            referrer_reward_points = ?

        WHERE id = ?
        `,
        [
            bonusPoints,
            referral.id
        ]
    );

    return {
        success: true,

        referralFound:
            true,

        rewarded:
            !ledgerResult
                .alreadyProcessed,

        alreadyRewarded:
            Boolean(
                ledgerResult
                    .alreadyProcessed
            ),

        message:
            ledgerResult
                .alreadyProcessed
                ? "The referral bonus was already awarded."
                : "Referral bonus awarded successfully.",

        referralId:
            referral.id,

        referrerCustomerId:
            referral
                .referrer_customer_id,

        referredCustomerId:
            referral
                .referred_customer_id,

        membershipLevel:
            referral
                .referrer_membership,

        pointsAwarded:
            bonusPoints,

        transaction:
            ledgerResult.transaction ||
            null
    };
}

module.exports = {
    processFirstPaidSaleReferral
};