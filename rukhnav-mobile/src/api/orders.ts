import {
  apiRequest,
} from "./client";


export type PaymentMethod =
  | "cash_on_delivery"
  | "jazzcash"
  | "easypaisa"
  | "bank_transfer";


export type PlaceOrderPayload = {
  full_name: string;
  phone: string;
  email?: string | null;

  shipping_address: string;
  delivery_address?: string;

  city?: string | null;
  postal_code?: string | null;
  order_notes?: string | null;

  payment_method: PaymentMethod;

  payment_phone?: string | null;
  transaction_id?: string | null;

  coupon_code?: string | null;

  delivery_option?: string;
  delivery_charges?: number;

  reward_points_to_redeem?: number;

  address_id?: number | null;
};


export type OrderRecord = {
  id?: number;
  orderId?: number;

  order_number?: string;
  orderNumber?: string;

  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;

  subtotal?: number | string;
  discount_amount?: number | string;
  delivery_charges?: number | string;
  grand_total?: number | string;
  total_amount?: number | string;

  created_at?: string | null;
};


export type PlaceOrderResponse = {
  success?: boolean;
  message?: string;

  order?: OrderRecord;

  data?:
    | OrderRecord
    | {
        order?: OrderRecord;
      };

  orderId?: number;
  orderNumber?: string;
};


export async function placeOrder(
  payload: PlaceOrderPayload
) {
  return apiRequest<PlaceOrderResponse>(
    "/orders",
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify(payload),
    }
  );
}


export function extractPlacedOrder(
  data: PlaceOrderResponse
) {
  let order: OrderRecord = {};

  if (
    data.order &&
    typeof data.order === "object"
  ) {
    order = data.order;
  } else if (
    data.data &&
    typeof data.data === "object"
  ) {
    if (
      "order" in data.data &&
      data.data.order &&
      typeof data.data.order === "object"
    ) {
      order = data.data.order;
    } else {
      order =
        data.data as OrderRecord;
    }
  }

  const orderId =
    order.id ??
    order.orderId ??
    data.orderId;

  const orderNumber =
    order.order_number ??
    order.orderNumber ??
    data.orderNumber ??
    String(orderId || "");

  return {
    order,
    orderId,
    orderNumber,
  };
}
