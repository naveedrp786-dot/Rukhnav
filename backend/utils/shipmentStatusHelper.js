"use strict";

const SHIPMENT_STATUS = Object.freeze({
    CREATED: "Created",
    READY: "Ready",
    PICKED_UP: "Picked Up",
    IN_TRANSIT: "In Transit",
    OUT_FOR_DELIVERY: "Out For Delivery",
    DELIVERED: "Delivered",
    RETURNED: "Returned",
    CANCELLED: "Cancelled"
});

const ALL_SHIPMENT_STATUSES = Object.freeze(Object.values(SHIPMENT_STATUS));

const lookup = new Map(
    ALL_SHIPMENT_STATUSES.map(status => [status.toLowerCase(), status])
);

const TRANSITIONS = Object.freeze({
    [SHIPMENT_STATUS.CREATED]: [SHIPMENT_STATUS.READY, SHIPMENT_STATUS.CANCELLED],
    [SHIPMENT_STATUS.READY]: [SHIPMENT_STATUS.PICKED_UP, SHIPMENT_STATUS.CANCELLED],
    [SHIPMENT_STATUS.PICKED_UP]: [SHIPMENT_STATUS.IN_TRANSIT, SHIPMENT_STATUS.RETURNED],
    [SHIPMENT_STATUS.IN_TRANSIT]: [SHIPMENT_STATUS.OUT_FOR_DELIVERY, SHIPMENT_STATUS.RETURNED],
    [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.RETURNED],
    [SHIPMENT_STATUS.DELIVERED]: [SHIPMENT_STATUS.RETURNED],
    [SHIPMENT_STATUS.RETURNED]: [],
    [SHIPMENT_STATUS.CANCELLED]: []
});

const ORDER_STATUS_BY_SHIPMENT_STATUS = Object.freeze({
    [SHIPMENT_STATUS.READY]: "Ready For Pickup",
    [SHIPMENT_STATUS.PICKED_UP]: "Handed To Courier",
    [SHIPMENT_STATUS.IN_TRANSIT]: "In Transit",
    [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: "Out For Delivery",
    [SHIPMENT_STATUS.DELIVERED]: "Delivered",
    [SHIPMENT_STATUS.RETURNED]: "Returned"
});

const normaliseShipmentStatus = value => {
    if (typeof value !== "string") return null;
    return lookup.get(value.trim().toLowerCase()) || null;
};

const canTransitionShipment = (oldStatus, newStatus) => {
    const current = normaliseShipmentStatus(oldStatus);
    const next = normaliseShipmentStatus(newStatus);
    if (!current || !next || current === next) return false;
    return (TRANSITIONS[current] || []).includes(next);
};

const getAllowedShipmentTransitions = status => {
    const current = normaliseShipmentStatus(status);
    return current ? [...(TRANSITIONS[current] || [])] : [];
};

const getOrderStatusForShipment = status => {
    const canonical = normaliseShipmentStatus(status);
    return canonical ? ORDER_STATUS_BY_SHIPMENT_STATUS[canonical] || null : null;
};

module.exports = {
    SHIPMENT_STATUS,
    ALL_SHIPMENT_STATUSES,
    normaliseShipmentStatus,
    canTransitionShipment,
    getAllowedShipmentTransitions,
    getOrderStatusForShipment
};
