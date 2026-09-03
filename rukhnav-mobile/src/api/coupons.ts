import {
  apiRequest,
} from "./client";


export type CouponApplyResponse = {
  success?: boolean;
  message?: string;

  coupon?: {
    code?: string;
  };

  calculation?: {
    discountAmount?: number | string;
  };
};


export async function applyCouponPreview(
  code: string,
  orderTotal: number,
  customerId?: number | null
) {
  return apiRequest<CouponApplyResponse>(
    "/coupons/apply",
    {
      method: "POST",
      authenticated: true,

      body: JSON.stringify({
        code,
        orderTotal,
        customerId:
          customerId || null,
      }),
    }
  );
}
