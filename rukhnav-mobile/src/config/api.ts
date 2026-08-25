export const API_ORIGIN =
  "https://www.rukhnav.store";

export const API_BASE_URL =
  `${API_ORIGIN}/api`;

export const API_ENDPOINTS = {
  products: `${API_BASE_URL}/products`,
  customers: `${API_BASE_URL}/customers`,
  cart: `${API_BASE_URL}/cart`,
  orders: `${API_BASE_URL}/orders`,
} as const;
