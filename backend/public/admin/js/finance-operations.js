"use strict";

async function loadFinanceOperations() {
    try {
        const data = await f2Api("/operations");

        document.getElementById("opsNetCollected").textContent =
            f2Money(data.customerPayments.netCollected);
        document.getElementById("opsPending").textContent =
            f2Money(data.customerPayments.pendingAmount);
        document.getElementById("opsRefunded").textContent =
            f2Money(data.customerPayments.refundedAmount);
        document.getElementById("opsCustomerCount").textContent =
            `${data.customerPayments.totalCount} payment record(s)`;

        document.getElementById("opsSupplierPaid").textContent =
            f2Money(data.supplierPayments.totalPaid);
        document.getElementById("opsSupplierCount").textContent =
            `${data.supplierPayments.totalCount} supplier payment(s)`;

        document.getElementById("opsActiveCoupons").textContent =
            String(data.coupons.activeCount);
        document.getElementById("opsCouponCount").textContent =
            `${data.coupons.totalCount} coupon(s) total`;
        document.getElementById("opsCouponUses").textContent =
            String(data.coupons.usedCount);
        document.getElementById("opsDiscountTotal").textContent =
            f2Money(data.coupons.discountTotal);
    } catch (error) {
        f2Message("operationsMessage", error.message, "error");
    }
}

document.addEventListener(
    "DOMContentLoaded",
    loadFinanceOperations,
    {once:true}
);
