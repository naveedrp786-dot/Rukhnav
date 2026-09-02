import { API_ENDPOINTS } from "../config/api";
import type {
  Category,
  CategoriesResponse,
} from "../types/category";

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(
    API_ENDPOINTS.categories,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load categories (${response.status})`
    );
  }

  const data =
    (await response.json()) as CategoriesResponse;

  if (
    !data.success ||
    !Array.isArray(data.categories)
  ) {
    throw new Error(
      "Invalid category response from RUKHNAV."
    );
  }

  return data.categories.filter(
    category =>
      String(category.status || "")
        .toLowerCase() === "active"
  );
}
