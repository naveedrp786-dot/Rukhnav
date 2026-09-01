"use strict";

const queueService =
    require("./notificationQueueService");

const customerNotificationService =
    require("./customerNotificationService");

function formatPaymentMethod(value) {
    const raw =
        String(value || "")
            .trim()
            .toLowerCase();

    const labels = {
        cash_on_delivery:
            "Cash on Delivery",
        cod:
            "Cash on Delivery",
        bank_transfer:
            "Bank Transfer",
        easypaisa:
            "Easypaisa",
        jazzcash:
            "JazzCash",
        card:
            "Card",
        credit_card:
            "Credit Card",
        debit_card:
            "Debit Card"
    };

    if (!raw) {
        return "";
    }

    return (
        labels[raw] ||
        raw
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, char =>
                char.toUpperCase()
            )
    );
}

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
                        formatPaymentMethod(
                            paymentMethod
                        ),
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

    const displayOrder =
        orderNumber ||
        `#${orderId}`;

    const notificationContent = {
        Confirmed: {
            title: "Order confirmed",
            message:
                `Your RUKHNAV order ${displayOrder} has been confirmed.`,
            icon: "circle-check",
            priority: "High"
        },
        Processing: {
            title: "Order is being prepared",
            message:
                `We are preparing your RUKHNAV order ${displayOrder}.`,
            icon: "box-open",
            priority: "Normal"
        },
        Packed: {
            title: "Order packed",
            message:
                `Your order ${displayOrder} has been packed and is getting ready for dispatch.`,
            icon: "box",
            priority: "Normal"
        },
        "Ready For Pickup": {
            title: "Order ready for pickup",
            message:
                `Your order ${displayOrder} is ready for pickup.`,
            icon: "store",
            priority: "High"
        },
        "Handed To Courier": {
            title: "Order handed to courier",
            message:
                `Your order ${displayOrder} has been handed to the courier.`,
            icon: "truck-fast",
            priority: "High"
        },
        "In Transit": {
            title: "Order in transit",
            message:
                `Your order ${displayOrder} is on its way to you.`,
            icon: "truck",
            priority: "High"
        },
        "Out For Delivery": {
            title: "Out for delivery",
            message:
                `Your order ${displayOrder} is out for delivery today.`,
            icon: "truck-fast",
            priority: "Urgent"
        },
        Shipped: {
            title: "Your order has shipped",
            message:
                `Your RUKHNAV order ${displayOrder} has been shipped and is on its way.`,
            icon: "truck",
            priority: "High"
        },
        Delivered: {
            title: "Order delivered",
            message:
                `Your RUKHNAV order ${displayOrder} has been delivered. We hope you enjoy your products.`,
            icon: "circle-check",
            priority: "High"
        },
        Cancelled: {
            title: "Order cancelled",
            message:
                `Your RUKHNAV order ${displayOrder} has been cancelled.`,
            icon: "circle-xmark",
            priority: "High"
        },
        Returned: {
            title: "Order returned",
            message:
                `The return status for order ${displayOrder} has been updated.`,
            icon: "rotate-left",
            priority: "High"
        },
        Refunded: {
            title: "Order refunded",
            message:
                `The refund for order ${displayOrder} has been processed.`,
            icon: "money-bill-transfer",
            priority: "High"
        }
    };

    const content =
        notificationContent[orderStatus] || {
            title: "Order status updated",
            message:
                `Order ${displayOrder} is now ${orderStatus}.`,
            icon: "bell",
            priority: "Normal"
        };

    const queuePromise =
        safeQueue(
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
                            formatPaymentMethod(
                                paymentMethod
                            ),
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

    const inboxPromise =
        customerNotificationService
            .createNotification({
                customerId,
                notificationType:
                    orderStatus === "Returned"
                        ? "Return"
                        : orderStatus === "Refunded"
                            ? "Refund"
                            : "Order",
                title:
                    content.title,
                message:
                    content.message,
                actionLabel:
                    trackingUrl &&
                    [
                        "Handed To Courier",
                        "In Transit",
                        "Out For Delivery",
                        "Shipped"
                    ].includes(orderStatus)
                        ? "Track Order"
                        : "View Order",
                actionUrl:
                    trackingUrl &&
                    [
                        "Handed To Courier",
                        "In Transit",
                        "Out For Delivery",
                        "Shipped"
                    ].includes(orderStatus)
                        ? trackingUrl
                        : orderUrl,
                orderId,
                referenceType:
                    "order_status",
                referenceId:
                    `${orderId}:${orderStatus}`,
                icon:
                    content.icon,
                priority:
                    content.priority
            })
            .catch(error => {
                console.error(
                    `[Customer Inbox: ${eventKey}]`,
                    error.message
                );

                return {
                    created: false,
                    error: error.message
                };
            });

    return Promise.all([
        queuePromise,
        inboxPromise
    ]).then(
        ([queueResult, inboxResult]) => ({
            queue: queueResult,
            inbox: inboxResult
        })
    );
}

function shipmentStatusChanged({
    customerId,
    orderId,
    orderNumber,
    orderStatus = "",
    shipmentId = "",
    shipmentNumber = "",
    shipmentStatus = "",
    courierName = "",
    serviceType = "",
    trackingNumber = "",
    trackingUrl = "",
    estimatedDeliveryDate = "",
    grandTotal = "",
    paymentMethod = "",
    paymentStatus = "",
    orderUrl = ""
}) {

    const shipmentEventMap = {
        "Picked Up":
            "SHIPMENT_PICKED_UP",
        "In Transit":
            "SHIPMENT_IN_TRANSIT",
        "Out For Delivery":
            "SHIPMENT_OUT_FOR_DELIVERY",
        "Delivered":
            "SHIPMENT_DELIVERED",
        "Returned":
            "SHIPMENT_RETURNED",
        "Cancelled":
            "SHIPMENT_CANCELLED"
    };

    const eventKey =
        shipmentEventMap[shipmentStatus];

    if (!eventKey) {
        return Promise.resolve({
            queued: false,
            skipped: true,
            reason:
                "No dedicated customer shipment event for this status."
        });
    }

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
                        orderStatus || "",
                    shipment_id:
                        shipmentId || "",
                    shipment_number:
                        shipmentNumber || "",
                    shipment_status:
                        shipmentStatus || "",
                    courier_name:
                        courierName || "",
                    service_type:
                        serviceType || "",
                    tracking_number:
                        trackingNumber || "",
                    tracking_url:
                        trackingUrl || "",
                    estimated_delivery_date:
                        estimatedDeliveryDate || "",
                    grand_total:
                        grandTotal === ""
                            ? ""
                            : Number(
                                grandTotal || 0
                            ).toFixed(2),
                    payment_method:
                        formatPaymentMethod(
                            paymentMethod
                        ),
                    payment_status:
                        paymentStatus || "",
                    order_url:
                        orderUrl || ""
                },
                dedupeReference:
                    `shipment-${shipmentId}-${shipmentStatus}`
            }),
        eventKey
    );
}

function reviewRequestReminder({
    customerId,
    orderId,
    orderNumber,
    deliveredAt = new Date()
}) {
    const deliveredDate =
        deliveredAt instanceof Date
            ? deliveredAt
            : new Date(deliveredAt);

    if (
        Number.isNaN(
            deliveredDate.getTime()
        )
    ) {
        return Promise.reject(
            new Error(
                "Invalid delivery date for review reminder."
            )
        );
    }

    const scheduledFor =
        new Date(
            deliveredDate.getTime() +
            (2 * 24 * 60 * 60 * 1000)
        );

    const reviewUrl =
        `/store/orders.html?review_order=${encodeURIComponent(
            orderId
        )}`;

    return safeQueue(
        queueService
            .queueCustomerEvent({
                eventKey:
                    "REVIEW_REQUEST",
                customerId,
                variables: {
                    order_id:
                        orderId,
                    order_number:
                        orderNumber || "",
                    review_url:
                        reviewUrl
                },
                dedupeReference:
                    `review-request-order-${orderId}`,
                scheduledFor
            }),
        "REVIEW_REQUEST"
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
    shipmentStatusChanged,
    reviewRequestReminder,
    customerRegistered,
    orderPlaced,
    orderStatusChanged,
    loyaltyPointsEarned,
    membershipUpgraded,
    customerEventReminder
};
