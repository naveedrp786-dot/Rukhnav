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


export type CustomerOrder = {
  id: number;
  order_number?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;

  grand_total?: number | string;
  discount_amount?: number | string;
  delivery_charges?: number | string;

  coupon_code?: string | null;

  order_status?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;

  shipping_address?: string | null;
  city?: string | null;
  postal_code?: string | null;

  created_at?: string | null;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;

  tracking_number?: string | null;
  tracking_url?: string | null;
  estimated_delivery_date?: string | null;

  item_count?: number | string;
  total_quantity?: number | string;
};


export type CustomerOrderItem = {
  id: number;
  product_id: number;
  product_name?: string | null;
  image?: string | null;

  price?: number | string;
  quantity?: number | string;
  subtotal?: number | string;
};


export type CustomerOrderDetails =
  CustomerOrder & {
    customer_id?: number;

    subtotalAmount?: number | string;

    loyalty_discount_amount?:
      number | string;

    loyalty_membership_level?:
      string | null;

    loyalty_discount_percentage?:
      number | string;

    reward_points_redeemed?:
      number | string;

    reward_points_discount_amount?:
      number | string;

    transaction_id?: string | null;
    payment_phone?: string | null;

    order_notes?: string | null;
    address_id?: number | null;
  };


type MyOrdersResponse = {
  success?: boolean;
  message?: string;
  totalOrders?: number;
  orders?: CustomerOrder[];
};


type OrderDetailsResponse = {
  success?: boolean;
  message?: string;

  order?: CustomerOrderDetails;

  itemCount?: number;
  totalQuantity?: number;

  items?: CustomerOrderItem[];
};


type CancelOrderResponse = {
  success?: boolean;
  message?: string;

  order?: {
    id?: number;
    orderNumber?: string;
    orderStatus?: string;
  };
};


export async function getMyOrders() {
  const data =
    await apiRequest<MyOrdersResponse>(
      "/orders",
      {
        authenticated: true,
      }
    );

  return {
    totalOrders:
      Number(
        data.totalOrders ??
          data.orders?.length ??
          0
      ),

    orders:
      Array.isArray(data.orders)
        ? data.orders
        : [],
  };
}


export async function getOrderDetails(
  orderId: number
) {
  const data =
    await apiRequest<OrderDetailsResponse>(
      `/orders/${orderId}`,
      {
        authenticated: true,
      }
    );

  if (!data.order) {
    throw new Error(
      data.message ||
        "Order details were not returned."
    );
  }

  return {
    order: data.order,

    items:
      Array.isArray(data.items)
        ? data.items
        : [],

    itemCount:
      Number(
        data.itemCount || 0
      ),

    totalQuantity:
      Number(
        data.totalQuantity || 0
      ),
  };
}


export async function cancelOrder(
  orderId: number
) {
  return apiRequest<CancelOrderResponse>(
    `/orders/${orderId}/cancel`,
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({}),
    }
  );
}
