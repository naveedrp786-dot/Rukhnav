import * as SecureStore from "expo-secure-store";

const GUEST_CART_KEY =
  "rukhnav_guest_cart";

export type GuestCartItem = {
  product_id: number;
  quantity: number;
};

function normaliseItems(
  value: unknown
): GuestCartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const merged =
    new Map<number, number>();

  for (const raw of value) {
    if (
      !raw ||
      typeof raw !== "object"
    ) {
      continue;
    }

    const item =
      raw as Partial<GuestCartItem>;

    const productId =
      Number(item.product_id);

    const quantity =
      Math.max(
        1,
        Math.floor(
          Number(item.quantity || 1)
        )
      );

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      continue;
    }

    merged.set(
      productId,
      Math.min(
        99,
        (
          merged.get(productId) || 0
        ) + quantity
      )
    );
  }

  return Array.from(
    merged.entries()
  ).map(
    ([product_id, quantity]) => ({
      product_id,
      quantity,
    })
  );
}

export async function getGuestCart():
  Promise<GuestCartItem[]> {
  try {
    const raw =
      await SecureStore.getItemAsync(
        GUEST_CART_KEY
      );

    if (!raw) {
      return [];
    }

    return normaliseItems(
      JSON.parse(raw)
    );
  } catch {
    return [];
  }
}

export async function saveGuestCart(
  items: GuestCartItem[]
) {
  const clean =
    normaliseItems(items);

  if (clean.length === 0) {
    await SecureStore.deleteItemAsync(
      GUEST_CART_KEY
    );

    return [];
  }

  await SecureStore.setItemAsync(
    GUEST_CART_KEY,
    JSON.stringify(clean)
  );

  return clean;
}

export async function addGuestCartItem(
  productId: number,
  quantity = 1
) {
  const id =
    Number(productId);

  const qty =
    Math.max(
      1,
      Math.floor(
        Number(quantity || 1)
      )
    );

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Invalid product."
    );
  }

  const items =
    await getGuestCart();

  const existing =
    items.find(
      item =>
        item.product_id === id
    );

  if (existing) {
    existing.quantity =
      Math.min(
        99,
        existing.quantity + qty
      );
  } else {
    items.push({
      product_id: id,
      quantity:
        Math.min(99, qty),
    });
  }

  return saveGuestCart(items);
}

export async function updateGuestCartItem(
  productId: number,
  quantity: number
) {
  const id =
    Number(productId);

  const qty =
    Math.floor(
      Number(quantity)
    );

  const items =
    await getGuestCart();

  if (qty < 1) {
    return saveGuestCart(
      items.filter(
        item =>
          item.product_id !== id
      )
    );
  }

  return saveGuestCart(
    items.map(item =>
      item.product_id === id
        ? {
            ...item,
            quantity:
              Math.min(99, qty),
          }
        : item
    )
  );
}

export async function removeGuestCartItem(
  productId: number
) {
  const items =
    await getGuestCart();

  return saveGuestCart(
    items.filter(
      item =>
        item.product_id !==
        Number(productId)
    )
  );
}

export async function clearGuestCart() {
  await SecureStore.deleteItemAsync(
    GUEST_CART_KEY
  );
}

export async function getGuestCartCount() {
  const items =
    await getGuestCart();

  return items.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );
}
