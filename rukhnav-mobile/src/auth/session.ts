import * as SecureStore from "expo-secure-store";

const TOKEN_KEY =
  "rukhnav_customer_token";

const CUSTOMER_KEY =
  "rukhnav_customer";

export type StoredCustomer = {
  id?: number;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  referral_code?: string | null;
  status?: string | null;
  profile_picture?: string | null;
  profile_picture_url?: string | null;
};

export async function getToken() {
  return SecureStore.getItemAsync(
    TOKEN_KEY
  );
}

export async function getStoredCustomer():
  Promise<StoredCustomer | null> {
  try {
    const value =
      await SecureStore.getItemAsync(
        CUSTOMER_KEY
      );

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function saveSession(
  token: string,
  customer?: StoredCustomer | null
) {
  await SecureStore.setItemAsync(
    TOKEN_KEY,
    token
  );

  if (customer) {
    await SecureStore.setItemAsync(
      CUSTOMER_KEY,
      JSON.stringify(customer)
    );
  } else {
    await SecureStore.deleteItemAsync(
      CUSTOMER_KEY
    );
  }
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(
      TOKEN_KEY
    ),
    SecureStore.deleteItemAsync(
      CUSTOMER_KEY
    ),
  ]);
}

export async function isLoggedIn() {
  return Boolean(
    await getToken()
  );
}
