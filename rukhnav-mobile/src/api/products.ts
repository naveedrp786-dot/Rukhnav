import { API_ENDPOINTS } from "../config/api";
import type {
  Product,
  ProductsResponse,
} from "../types/product";

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(
    API_ENDPOINTS.products,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load products (${response.status})`
    );
  }

  const data =
    (await response.json()) as ProductsResponse;

  if (!data.success || !Array.isArray(data.products)) {
    throw new Error(
      "Invalid product response from RUKHNAV."
    );
  }

  return data.products;
}

export async function getProductById(
  id: string | number
): Promise<Product> {
  const response = await fetch(
    `${API_ENDPOINTS.products}/${encodeURIComponent(String(id))}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load product (${response.status})`
    );
  }

  const data = await response.json();

  const product =
    data?.product ||
    data?.data ||
    data;

  if (!product || !product.id) {
    throw new Error(
      "Invalid product response from RUKHNAV."
    );
  }

  return product as Product;
}
