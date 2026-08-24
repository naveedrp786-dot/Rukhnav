"use strict";

const queueService =
    require("./notificationQueueService");

function safeQueue(
    promise,
    label
) {
    return Promise.resolve(promise)
        .catch(
            error => {
                console.error(
                    `[Notification Hook: ${label}]`,
                    error.message
                );

                return {
                    queued:
                        0,
                    error:
                        error.message
                };
            }
        );
}

function customerRegistered({
    customerId,
    fullName,
    email,
    phone
}) {
    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey:
                    "CUSTOMER_REGISTERED",
                customerId,
                variables: {
                    customer_name:
                        fullName,
                    customer_email:
                        email || "",
                    customer_phone:
                        phone || ""
                },
                dedupeReference:
                    `registration-${customerId}`
            }),
        "CUSTOMER_REGISTERED"
    );
}

function orderPlaced({
    customerId,
    orderId,
    orderNumber,
    grandTotal,
    orderStatus = "Pending",
    paymentMethod = "",
    paymentStatus = "",
    trackingNumber = "",
    trackingUrl = "",
    orderUrl = ""
}) {
    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey:
                    "ORDER_PLACED",
                customerId,
                variables: {
                    order_id:
                        orderId,
                    order_number:
                        orderNumber,
                    grand_total:
                        Number(
                            grandTotal || 0
                        ).toFixed(2),
                    order_status:
                        orderStatus,
                    payment_method:
                        paymentMethod || "",
                    payment_status:
                        paymentStatus || "",
                    tracking_number:
                        trackingNumber || "",
                    tracking_url:
                        trackingUrl || "",
                    order_url:
                        orderUrl || ""
                },
                dedupeReference:
                    `order-${orderId}`
            }),
        "ORDER_PLACED"
    );
}

function orderStatusChanged({
    customerId,
    orderId,
    orderNumber,
    orderStatus,
    grandTotal = "",
    paymentMethod = "",
    paymentStatus = "",
    trackingNumber = "",
    trackingUrl = "",
    orderUrl = ""
}) {

    const statusEventMap = {
        Confirmed:
            "ORDER_CONFIRMED"
    };

    const eventKey =
        statusEventMap[orderStatus] ||
        "ORDER_STATUS_CHANGED";

    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey,
                customerId,
                variables: {
                    order_id:
                        orderId,
                    order_number:
                        orderNumber,
                    order_status:
                        orderStatus,
                    grand_total:
                        grandTotal === ""
                            ? ""
                            : Number(
                                grandTotal || 0
                            ).toFixed(2),
                    payment_method:
                        paymentMethod || "",
                    payment_status:
                        paymentStatus || "",
                    tracking_number:
                        trackingNumber || "",
                    tracking_url:
                        trackingUrl || "",
                    order_url:
                        orderUrl || ""
                },
                dedupeReference:
                    `order-${orderId}-${orderStatus}`
            }),
        eventKey
    );
}

function loyaltyPointsEarned({
    customerId,
    points,
    availablePoints,
    referenceNumber = ""
}) {
    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey:
                    "LOYALTY_POINTS_EARNED",
                customerId,
                variables: {
                    points:
                        Number(
                            points || 0
                        ),
                    available_points:
                        Number(
                            availablePoints || 0
                        )
                },
                dedupeReference:
                    referenceNumber ||
                    `points-${Date.now()}`
            }),
        "LOYALTY_POINTS_EARNED"
    );
}

function membershipUpgraded({
    customerId,
    membershipLevel,
    referenceNumber = ""
}) {
    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey:
                    "MEMBERSHIP_UPGRADED",
                customerId,
                variables: {
                    membership_level:
                        membershipLevel
                },
                dedupeReference:
                    referenceNumber ||
                    `membership-${membershipLevel}`
            }),
        "MEMBERSHIP_UPGRADED"
    );
}

function customerEventReminder({
    customerId,
    eventId,
    eventName,
    eventDate,
    channels = null
}) {
    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey:
                    "CUSTOMER_EVENT_REMINDER",
                customerId,
                variables: {
                    event_id:
                        eventId,
                    event_name:
                        eventName,
                    event_date:
                        eventDate
                },
                dedupeReference:
                    `event-${eventId}-${eventDate}`,
                forceChannels:
                    channels
            }),
        "CUSTOMER_EVENT_REMINDER"
    );
}

module.exports = {
    customerRegistered,
    orderPlaced,
    orderStatusChanged,
    loyaltyPointsEarned,
    membershipUpgraded,
    customerEventReminder
};
