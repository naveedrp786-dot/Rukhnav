"use strict";

const notificationService =
    require("../services/customerNotificationService");

function customerId(req) {
    return Number(
        req.user?.id ||
        req.user?.customerId ||
        0
    );
}

exports.list = async (req, res) => {
    try {
        const id = customerId(req);

        if (!id) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        const limit =
            Math.min(
                Math.max(
                    Number(req.query.limit) || 30,
                    1
                ),
                100
            );

        const offset =
            Math.max(
                Number(req.query.offset) || 0,
                0
            );

        const unreadOnly =
            String(
                req.query.unread_only || ""
            ).toLowerCase() === "true";

        const notifications =
            await notificationService
                .listForCustomer(
                    id,
                    {
                        limit,
                        offset,
                        unreadOnly
                    }
                );

        const unreadCount =
            await notificationService
                .getUnreadCount(id);

        res.json({
            success: true,
            unreadCount,
            notifications
        });

    } catch (error) {
        console.error(
            "Customer notification list error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load notifications."
        });
    }
};

exports.unreadCount = async (req, res) => {
    try {
        const id = customerId(req);

        if (!id) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        const unreadCount =
            await notificationService
                .getUnreadCount(id);

        res.json({
            success: true,
            unreadCount
        });

    } catch (error) {
        console.error(
            "Customer unread notification error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to load unread notification count."
        });
    }
};

exports.markRead = async (req, res) => {
    try {
        const id = customerId(req);

        const notificationId =
            Number(req.params.id);

        if (!id) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        if (!notificationId) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid notification ID is required."
            });
        }

        const updated =
            await notificationService
                .markRead(
                    id,
                    notificationId
                );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message:
                    "Notification not found."
            });
        }

        const unreadCount =
            await notificationService
                .getUnreadCount(id);

        res.json({
            success: true,
            unreadCount
        });

    } catch (error) {
        console.error(
            "Customer mark notification read error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to update notification."
        });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        const id = customerId(req);

        if (!id) {
            return res.status(401).json({
                success: false,
                message: "Customer authentication required."
            });
        }

        const updated =
            await notificationService
                .markAllRead(id);

        res.json({
            success: true,
            updated,
            unreadCount: 0
        });

    } catch (error) {
        console.error(
            "Customer mark-all notifications error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Unable to update notifications."
        });
    }
};
