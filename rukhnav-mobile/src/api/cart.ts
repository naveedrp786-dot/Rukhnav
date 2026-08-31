import {
  apiRequest,
} from "./client";

export type CartItem = {
  cart_id: number;
  product_id: number;
  product_name: string;
  price: string | number;
  selling_price: string | number;
  image?: string | null;
  stock_quantity: number;
  stock_status?: string | null;
  product_status?: string | null;
  quantity: number;
  subtotal: string | number;
};

export type CartResponse = {
  success: boolean;
  itemCount: number;
  cart: CartItem[];
  grandTotal: number;
  message?: string;
};

export type AddToCartPayload = {
  product_id: number;
  quantity?: number;
};

export type AddToCartResponse = {
  success: boolean;
  message?: string;
  cartItemId?: number;
  quantity?: number;
  availableStock?: number;
  currentCartQuantity?: number;
};

export async function getCart() {
  return apiRequest<CartResponse>(
    "/cart",
    {
      authenticated: true,
    }
  );
}

export async function addToCart(
  payload: AddToCartPayload
) {
  return apiRequest<AddToCartResponse>(
    "/cart",
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({
        product_id:
          payload.product_id,
        quantity:
          payload.quantity || 1,
      }),
    }
  );
}

export async function updateCartQuantity(
  cartItemId: number,
  quantity: number
) {
  return apiRequest<{
    success: boolean;
    message?: string;
    cartItemId: number;
    quantity: number;
    availableStock?: number;
  }>(
    `/cart/${cartItemId}`,
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify({
        quantity,
      }),
    }
  );
}

export async function removeCartItem(
  cartItemId: number
) {
  return apiRequest<{
    success: boolean;
    message?: string;
  }>(
    `/cart/${cartItemId}`,
    {
      method: "DELETE",
      authenticated: true,
    }
  );
}
