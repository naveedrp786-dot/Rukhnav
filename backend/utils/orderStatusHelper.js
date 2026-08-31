"use strict";

const STATUS = Object.freeze({
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    PACKED: "Packed",
    READY_FOR_PICKUP: "Ready For Pickup",
    HANDED_TO_COURIER: "Handed To Courier",
    IN_TRANSIT: "In Transit",
    OUT_FOR_DELIVERY: "Out For Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    RETURNED: "Returned",
    REFUNDED: "Refunded"
});

const ALL_STATUSES = Object.freeze(Object.values(STATUS));

const NORMALISED_STATUS_LOOKUP = new Map(
    ALL_STATUSES.map(status => [status.toLowerCase(), status])
);

const TRANSITIONS = Object.freeze({
    [STATUS.PENDING]: [STATUS.CONFIRMED, STATUS.CANCELLED],
    [STATUS.CONFIRMED]: [STATUS.PROCESSING, STATUS.CANCELLED],
    [STATUS.PROCESSING]: [STATUS.PACKED, STATUS.CANCELLED],
    [STATUS.PACKED]: [STATUS.READY_FOR_PICKUP, STATUS.CANCELLED],
    [STATUS.READY_FOR_PICKUP]: [STATUS.HANDED_TO_COURIER, STATUS.CANCELLED],
    [STATUS.HANDED_TO_COURIER]: [STATUS.IN_TRANSIT, STATUS.RETURNED],
    [STATUS.IN_TRANSIT]: [STATUS.OUT_FOR_DELIVERY, STATUS.RETURNED],
    [STATUS.OUT_FOR_DELIVERY]: [STATUS.DELIVERED, STATUS.RETURNED],
    [STATUS.DELIVERED]: [STATUS.RETURNED],
    [STATUS.CANCELLED]: [STATUS.REFUNDED],
    [STATUS.RETURNED]: [STATUS.REFUNDED],
    [STATUS.REFUNDED]: []
});

const STATUS_TIMESTAMP_COLUMNS = Object.freeze({
    [STATUS.CONFIRMED]: "confirmed_at",
    [STATUS.PROCESSING]: "processing_at",
    [STATUS.PACKED]: "packed_at",
    [STATUS.READY_FOR_PICKUP]: "ready_for_pickup_at",
    [STATUS.HANDED_TO_COURIER]: "handed_to_courier_at",
    [STATUS.IN_TRANSIT]: "in_transit_at",
    [STATUS.OUT_FOR_DELIVERY]: "out_for_delivery_at",
    [STATUS.DELIVERED]: "delivered_at",
    [STATUS.CANCELLED]: "cancelled_at",
    [STATUS.RETURNED]: "returned_at",
    [STATUS.REFUNDED]: "refunded_at"
});

const normaliseStatus = value => {
    if (typeof value !== "string") {
        return null;
    }

    return NORMALISED_STATUS_LOOKUP.get(value.trim().toLowerCase()) || null;
};

const canTransition = (oldStatus, newStatus) => {
    const current = normaliseStatus(oldStatus);
    const next = normaliseStatus(newStatus);

    if (!current || !next || current === next) {
        return false;
    }

    return (TRANSITIONS[current] || []).includes(next);
};

const getAllowedTransitions = status => {
    const current = normaliseStatus(status);
    return current ? [...(TRANSITIONS[current] || [])] : [];
};

const getTimestampColumn = status => {
    const canonicalStatus = normaliseStatus(status);
    return canonicalStatus ? STATUS_TIMESTAMP_COLUMNS[canonicalStatus] || null : null;
};

module.exports = {
    STATUS,
    ALL_STATUSES,
    normaliseStatus,
    canTransition,
    getAllowedTransitions,
    getTimestampColumn
};
