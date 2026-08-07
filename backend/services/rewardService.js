const db = require("../config/db");

// =====================================
// Initialize Reward Account
// =====================================
async function initializeRewards(customerId) {

    await db.query(
        `INSERT IGNORE INTO customer_rewards (customer_id)
         VALUES (?)`,
        [customerId]
    );

}

// =====================================
// Calculate Reward Points
// 1 Point = Every PKR 100 Spent
// =====================================
function calculateRewardPoints(orderAmount) {

    return Math.floor(orderAmount / 100);

}

// =====================================
// Process Reward After Order Delivery
// =====================================
async function processOrderRewards(orderId) {

    console.log("✅ processOrderRewards started for order:", orderId);

    // Get order
    const [orders] = await db.query(
        `
        SELECT *
        FROM orders
        WHERE id = ?
        `,
        [orderId]
    );

    if (orders.length === 0) {
        throw new Error("Order not found.");
    }

    const order = orders[0];
    console.log("Order found:", order);

    const customerId = order.customer_id;
    const amount = Number(order.total_amount);

    const earnedPoints = calculateRewardPoints(amount);
    console.log("Earned points:", earnedPoints);

    // Get reward account
    const [rewardRows] = await db.query(
        `
        SELECT *
        FROM customer_rewards
        WHERE customer_id = ?
        `,
        [customerId]
    );

    if (rewardRows.length === 0) {
        throw new Error("Customer reward account not found.");
    }

    const reward = rewardRows[0];
    console.log("Reward account:", reward);

    const newRewardPoints = reward.reward_points + earnedPoints;
    const newLifetimePoints = reward.lifetime_points + earnedPoints;
    const newTotalSpent = Number(reward.total_spent) + amount;
    const newTotalOrders = reward.total_orders + 1;

    let membership = "Bronze";

    if (newLifetimePoints >= 5000)
        membership = "Platinum";
    else if (newLifetimePoints >= 1500)
        membership = "Gold";
    else if (newLifetimePoints >= 500)
        membership = "Silver";

    // Update reward account
    await db.query(
        `
        UPDATE customer_rewards
        SET
            reward_points = ?,
            lifetime_points = ?,
            total_spent = ?,
            total_orders = ?,
            membership_level = ?
        WHERE customer_id = ?
        `,
        [
            newRewardPoints,
            newLifetimePoints,
            newTotalSpent,
            newTotalOrders,
            membership,
            customerId
        ]
    );

    // Save transaction
    await db.query(
        `
        INSERT INTO reward_transactions
        (
            customer_id,
            order_id,
            transaction_type,
            points,
            description
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            customerId,
            orderId,
            "Earn",
            earnedPoints,
            `Reward for Order #${orderId}`
        ]
    );

    return {
        earnedPoints,
        membership
    };

}

module.exports = {
    initializeRewards,
    calculateRewardPoints,
    processOrderRewards
};