import {
  API_BASE_URL,
} from "../config/api";

import {
  clearSession,
  getToken,
} from "../auth/session";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(
    message: string,
    status: number,
    data?: any
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions =
  RequestInit & {
    authenticated?: boolean;
  };

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    authenticated = false,
    ...fetchOptions
  } = options;

  const headers =
    new Headers(
      fetchOptions.headers
    );

  headers.set(
    "Accept",
    "application/json"
  );

  if (
    fetchOptions.body &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  if (authenticated) {
    const token =
      await getToken();

    if (!token) {
      throw new ApiError(
        "Please log in to continue.",
        401
      );
    }

    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...fetchOptions,
        headers,
      }
    );
  } catch (error) {
    console.error(
      "RUKHNAV API fetch error:",
      {
        endpoint,
        url: `${API_BASE_URL}${endpoint}`,
        error,
      }
    );

    const detail =
      error instanceof Error
        ? error.message
        : String(error);

    throw new ApiError(
      `Unable to connect to RUKHNAV: ${detail}`,
      0,
      error
    );
  }

  let data: any;

  try {
    data =
      await response.json();
  } catch {
    data = {
      success: false,
      message:
        "The server returned an invalid response.",
    };
  }

  if (!response.ok) {
    console.error(
      "RUKHNAV API HTTP error:",
      {
        endpoint,
        status: response.status,
        data,
      }
    );

    if (
      response.status === 401 &&
      authenticated
    ) {
      await clearSession();
    }

    throw new ApiError(
      data?.message ||
        "Something went wrong.",
      response.status,
      data
    );
  }

  return data as T;
}
