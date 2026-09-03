import * as SecureStore from "expo-secure-store";

const KEY_PREFIX =
  "rukhnav_guest_order_";

const RECENT_KEY =
  "rukhnav_recent_guest_order";

export type StoredGuestOrderAccess = {
  orderNumber: string;
  token: string;
};

function storageKey(
  orderNumber: string
) {
  return (
    KEY_PREFIX +
    String(orderNumber)
      .trim()
      .toUpperCase()
  );
}

export async function saveGuestOrderAccess(
  orderNumber: string,
  token: string
) {
  const cleanOrder =
    String(orderNumber)
      .trim()
      .toUpperCase();

  const cleanToken =
    String(token).trim();

  if (
    !cleanOrder ||
    !cleanToken
  ) {
    throw new Error(
      "Guest order access details are incomplete."
    );
  }

  await SecureStore.setItemAsync(
    storageKey(cleanOrder),
    cleanToken
  );

  await SecureStore.setItemAsync(
    RECENT_KEY,
    JSON.stringify({
      orderNumber: cleanOrder,
      token: cleanToken,
    } satisfies StoredGuestOrderAccess)
  );
}

export async function getGuestOrderAccess(
  orderNumber: string
) {
  const cleanOrder =
    String(orderNumber)
      .trim()
      .toUpperCase();

  if (!cleanOrder) {
    return null;
  }

  return SecureStore.getItemAsync(
    storageKey(cleanOrder)
  );
}

export async function getRecentGuestOrderAccess():
  Promise<StoredGuestOrderAccess | null> {
  try {
    const raw =
      await SecureStore.getItemAsync(
        RECENT_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw) as
        Partial<StoredGuestOrderAccess>;

    const orderNumber =
      String(
        parsed.orderNumber || ""
      )
        .trim()
        .toUpperCase();

    const token =
      String(
        parsed.token || ""
      ).trim();

    if (
      !orderNumber ||
      !token
    ) {
      return null;
    }

    return {
      orderNumber,
      token,
    };
  } catch {
    return null;
  }
}
