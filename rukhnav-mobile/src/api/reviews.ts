import {
  apiRequest,
} from "./client";


export type ReviewImage = {
  id: number;
  review_id: number;
  image_url: string;
  image_alt?: string | null;
  sort_order?: number;
  created_at?: string;
  url?: string | null;
};


export type ProductReview = {
  id: number;
  customer_id: number;
  product_id: number;
  rating: number;
  comment?: string | null;
  status?: string | null;
  verified_purchase?: boolean;
  helpful_count?: number;
  created_at?: string;
  updated_at?: string;
  full_name?: string | null;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
  admin_reply?: string | null;
  images?: ReviewImage[];
};


export type ProductReviewsResponse = {
  success: boolean;
  productId: number;
  averageRating: number;
  totalReviews: number;

  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };

  reviews: ProductReview[];
  message?: string;
};


export async function getProductReviews(
  productId: number | string
) {
  return apiRequest<ProductReviewsResponse>(
    `/reviews/product/${encodeURIComponent(
      String(productId)
    )}?limit=10&sort=latest`
  );
}
