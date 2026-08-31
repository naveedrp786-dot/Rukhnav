const service = require("../services/executiveDashboardService");

exports.getExecutiveDashboard = async (req, res) => {
    try {
        const dashboard = await service.getExecutiveDashboard();
        return res.json({ success: true, dashboard });
    } catch (error) {
        console.error("Executive dashboard error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Unable to load main ERP dashboard."
        });
    }
};
