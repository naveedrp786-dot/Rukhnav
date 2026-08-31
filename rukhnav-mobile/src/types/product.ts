export interface Product {
  id: number;
  product_name: string;
  category: string | null;
  brand: string | null;
  description: string | null;
  ingredients: string | null;
  directions: string | null;
  warnings: string | null;

  selling_price: string;
  cost_price?: string;
  discount_price: string;

  image: string | null;

  status: string;
  is_featured: number;

  stock_quantity: number;
  low_stock_level: number;

  unit: string | null;
  weight: string | null;

  sku: string | null;
  stock_status:
    | "In Stock"
    | "Low Stock"
    | "Out of Stock"
    | string;

  averageRating: string | number | null;
  totalReviews: number;
}

export interface ProductsResponse {
  success: boolean;
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  products: Product[];
}
