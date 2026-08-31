import {
  apiRequest,
} from "./client";

export type WishlistItem = {
  wishlist_id: number;
  product_id: number;
  product_name: string;
  price: string | number;
  image?: string | null;
  stock: number;
  status?: string | null;
  created_at?: string | null;
};

export type WishlistResponse = {
  success: boolean;
  totalItems: number;
  wishlist: WishlistItem[];
  message?: string;
};

export async function getWishlist() {
  return apiRequest<WishlistResponse>(
    "/wishlist",
    {
      authenticated: true,
    }
  );
}

export async function addToWishlist(
  productId: number
) {
  return apiRequest<{
    success: boolean;
    message?: string;
    wishlistId?: number;
  }>(
    "/wishlist",
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({
        product_id: productId,
      }),
    }
  );
}

export async function removeWishlistItem(
  wishlistId: number
) {
  return apiRequest<{
    success: boolean;
    message?: string;
  }>(
    `/wishlist/${wishlistId}`,
    {
      method: "DELETE",
      authenticated: true,
    }
  );
}
