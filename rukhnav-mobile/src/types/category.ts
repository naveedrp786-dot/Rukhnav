export interface Category {
  id: number;
  category_name: string;
  description: string | null;
  image: string | null;
  icon_key: string | null;
  icon_color: string | null;
  status: string;
}

export interface CategoriesResponse {
  success: boolean;
  categories: Category[];
}
