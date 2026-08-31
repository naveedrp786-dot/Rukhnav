const purchasingDashboardService =
    require("../services/purchasingDashboardService");

exports.getDashboard = async (req, res) => {
    try {
        const dashboard =
            await purchasingDashboardService.getPurchasingDashboard();

        return res.status(200).json({
            success: true,
            dashboard
        });
    } catch (error) {
        console.error("Purchasing dashboard error:", error);

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Unable to load purchasing dashboard."
        });
    }
};
