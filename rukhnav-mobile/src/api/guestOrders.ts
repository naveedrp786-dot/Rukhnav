import {
  apiRequest,
} from "./client";

export type GuestOrderItemInput = {
  product_id: number;
  quantity: number;
};

export type GuestOrderPayload = {
  full_name: string;
  phone: string;
  email: string | null;

  shipping_address: string;
  city: string;
  postal_code: string | null;
  order_notes: string | null;

  payment_method:
    | "cash_on_delivery"
    | "easypaisa"
    | "jazzcash"
    | "bank_transfer";

  payment_phone: string | null;
  transaction_id: string | null;

  accept_terms: true;
  accept_privacy: true;

  items: GuestOrderItemInput[];

  attribution?: {
    order_source?: string;
    landing_page?: string | null;
    referrer_url?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    fbclid?: string | null;
  };
};

export type GuestPlacedOrder = {
  id?: number;

  order_number: string;

  full_name?: string;
  phone?: string;
  email?: string | null;

  subtotal?: number;
  delivery_charges?: number;
  grand_total?: number;

  order_status?: string;

  payment_method?: string;
  payment_status?: string;

  shipping_address?: string;
  city?: string;
  postal_code?: string | null;

  created_at?: string;
};

export type PlaceGuestOrderResponse = {
  success?: boolean;
  message?: string;

  order: GuestPlacedOrder;

  guestAccessToken: string;
};

export async function placeGuestOrder(
  payload: GuestOrderPayload
) {
  return apiRequest<PlaceGuestOrderResponse>(
    "/orders/guest",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}


export type GuestOrderItem = {
  order_item_id?: number;
  product_id: number;
  product_name?: string | null;
  image?: string | null;
  price: number;
  quantity: number;
  subtotal: number;
};

export type GuestOrderDetails =
  GuestPlacedOrder & {
    discount_amount?: number;
    tracking_number?: string | null;
    tracking_url?: string | null;
    estimated_delivery_date?: string | null;
    items: GuestOrderItem[];
  };

export type GuestOrderDetailsResponse = {
  success?: boolean;
  order: GuestOrderDetails;
};

export async function getGuestOrder(
  orderNumber: string,
  token: string
) {
  const cleanOrder =
    String(orderNumber).trim();

  const cleanToken =
    String(token).trim();

  if (!cleanOrder || !cleanToken) {
    throw new Error(
      "Guest order access details are incomplete."
    );
  }

  return apiRequest<GuestOrderDetailsResponse>(
    `/orders/guest/${encodeURIComponent(
      cleanOrder
    )}?token=${encodeURIComponent(
      cleanToken
    )}`
  );
}


export type PublicTrackPayload = {
  order_number: string;
  identifier: string;
};

export type PublicTrackedOrder = {
  order_number: string;
  full_name?: string | null;
  checkout_type?: string | null;

  grand_total?: number;
  discount_amount?: number;
  delivery_charges?: number;

  order_status?: string | null;

  payment_method?: string | null;
  payment_status?: string | null;

  city?: string | null;

  tracking_number?: string | null;
  tracking_url?: string | null;
  estimated_delivery_date?: string | null;

  created_at?: string | null;
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
};

export type PublicTrackResponse = {
  success?: boolean;
  order: PublicTrackedOrder;
  items: GuestOrderItem[];
};

export async function trackPublicOrder(
  payload: PublicTrackPayload
) {
  return apiRequest<PublicTrackResponse>(
    "/orders/public-track",
    {
      method: "POST",
      body: JSON.stringify({
        order_number:
          String(
            payload.order_number
          )
            .trim()
            .toUpperCase(),

        identifier:
          String(
            payload.identifier
          ).trim(),
      }),
    }
  );
}
