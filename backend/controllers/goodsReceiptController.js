const goodsReceiptService =
    require("../services/goodsReceiptService");

const sendError = (res, error) => {
    console.error(error);

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Internal Server Error"
    });
};

// =====================================================
// Create GRN
// =====================================================
exports.createGoodsReceipt = async (req, res) => {
    try {
        const goodsReceipt =
            await goodsReceiptService.createGoodsReceipt({
                purchaseOrderId: req.params.id,
                receiptDate: req.body.receipt_date,
                supplierDeliveryNote:
                    req.body.supplier_delivery_note,
                vehicleNumber: req.body.vehicle_number,
                remarks: req.body.remarks,
                items: req.body.items,
                adminId: req.admin?.id
            });

        return res.status(201).json({
            success: true,
            message:
                "Goods receipt note posted successfully.",
            goods_receipt: goodsReceipt
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// =====================================================
// Get All GRNs
// =====================================================
exports.getGoodsReceipts = async (req, res) => {
    try {
        const goodsReceipts =
            await goodsReceiptService.getGoodsReceipts({
                purchaseOrderId:
                    req.query.purchase_order_id,
                status: req.query.status
            });

        return res.json({
            success: true,
            count: goodsReceipts.length,
            goods_receipts: goodsReceipts
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// =====================================================
// Get One GRN
// =====================================================
exports.getGoodsReceiptById = async (req, res) => {
    try {
        const result =
            await goodsReceiptService.getGoodsReceiptById(
                req.params.id
            );

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        return sendError(res, error);
    }
};

// =====================================================
// Get GRNs for One Purchase Order
// =====================================================
exports.getPurchaseOrderGoodsReceipts = async (
    req,
    res
) => {
    try {
        const goodsReceipts =
            await goodsReceiptService
                .getPurchaseOrderGoodsReceipts(
                    req.params.id
                );

        return res.json({
            success: true,
            count: goodsReceipts.length,
            goods_receipts: goodsReceipts
        });
    } catch (error) {
        return sendError(res, error);
    }
};
