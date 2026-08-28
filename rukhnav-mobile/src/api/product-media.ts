import {
  apiRequest,
} from "./client";

export type ProductMediaImage = {
  id: number;
  product_id: number;
  image_url: string;
  image_alt?: string | null;
  sort_order?: number;
  is_primary?: number | boolean;
  status?: string | null;
};

type ProductMediaResponse = {
  success: boolean;
  source?: string;
  images?: ProductMediaImage[];
  message?: string;
};

export async function getProductMedia(
  productId: number | string
) {
  const data =
    await apiRequest<ProductMediaResponse>(
      `/product-media/public/${productId}`
    );

  return Array.isArray(data.images)
    ? data.images
    : [];
}
