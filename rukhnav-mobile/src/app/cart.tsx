import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  router,
  useFocusEffect,
} from "expo-router";

import {
  useCallback,
  useState,
} from "react";

import {
  ApiError,
} from "../api/client";

import {
  getCart,
  removeCartItem,
  updateCartQuantity,
  type CartItem,
} from "../api/cart";

import {
  productImageUrl,
} from "../config/images";

import {
  colors,
} from "../theme/rukhnav";

function money(
  value: string | number
) {
  return `Rs. ${Number(value || 0)
    .toLocaleString("en-PK")}`;
}

export default function CartScreen() {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [grandTotal, setGrandTotal] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    busyItemId,
    setBusyItemId,
  ] = useState<number | null>(
    null
  );

  const [message, setMessage] =
    useState("");

  const loadCart =
    useCallback(async () => {
      try {
        setMessage("");

        const result =
          await getCart();

        setItems(
          result.cart || []
        );

        setGrandTotal(
          Number(
            result.grandTotal || 0
          )
        );
      } catch (error) {
        if (
          error instanceof ApiError
        ) {
          if (error.status === 401) {
            router.replace(
              "/account"
            );
            return;
          }

          setMessage(
            error.message
          );
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load your cart."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCart();
    }, [loadCart])
  );

  async function refresh() {
    setRefreshing(true);
    await loadCart();
    setRefreshing(false);
  }

  async function changeQuantity(
    item: CartItem,
    nextQuantity: number
  ) {
    if (
      busyItemId !== null ||
      nextQuantity < 1
    ) {
      return;
    }

    setBusyItemId(
      item.cart_id
    );
    setMessage("");

    try {
      await updateCartQuantity(
        item.cart_id,
        nextQuantity
      );

      await loadCart();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update cart."
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(
    item: CartItem
  ) {
    if (
      busyItemId !== null
    ) {
      return;
    }

    setBusyItemId(
      item.cart_id
    );
    setMessage("");

    try {
      await removeCartItem(
        item.cart_id
      );

      await loadCart();

      setMessage(
        "Item removed from cart."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove item."
      );
    } finally {
      setBusyItemId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text
          style={styles.loadingText}
        >
          Loading your cart...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.page}
    >
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={styles.backText}
          >
            ‹
          </Text>
        </Pressable>

        <View>
          <Text
            style={styles.brand}
          >
            RUKHNAV
          </Text>

          <Text
            style={styles.pageLabel}
          >
            YOUR CART
          </Text>
        </View>

        <View
          style={styles.topSpacer}
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={refresh}
            tintColor={
              colors.primary
            }
          />
        }
      >
        {message ? (
          <View
            style={
              styles.messageBox
            }
          >
            <Text
              style={
                styles.messageText
              }
            >
              {message}
            </Text>
          </View>
        ) : null}

        {items.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={styles.emptyIcon}
            >
              🛍
            </Text>

            <Text
              style={styles.emptyTitle}
            >
              Your cart is empty
            </Text>

            <Text
              style={styles.emptyText}
            >
              Discover RUKHNAV products
              and add your favourites.
            </Text>

            <Pressable
              style={
                styles.shopButton
              }
              onPress={() =>
                router.replace(
                  "/shop"
                )
              }
            >
              <Text
                style={
                  styles.shopButtonText
                }
              >
                Continue Shopping
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={
                styles.summaryHeader
              }
            >
              <Text
                style={
                  styles.summaryTitle
                }
              >
                Shopping Cart
              </Text>

              <Text
                style={
                  styles.itemCount
                }
              >
                {items.length}
                {" "}
                {items.length === 1
                  ? "item"
                  : "items"}
              </Text>
            </View>

            {items.map(item => {
              const image =
                productImageUrl(
                  item.image || ""
                );

              const busy =
                busyItemId ===
                item.cart_id;

              return (
                <View
                  key={
                    item.cart_id
                  }
                  style={
                    styles.cartCard
                  }
                >
                  <Pressable
                    style={
                      styles.productImageBox
                    }
                    onPress={() =>
                      router.push(
                        `/product/${item.product_id}`
                      )
                    }
                  >
                    {image ? (
                      <Image
                        source={{
                          uri: image,
                        }}
                        style={
                          styles.productImage
                        }
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={
                          styles.imageFallback
                        }
                      >
                        <Text
                          style={
                            styles.imageFallbackText
                          }
                        >
                          R
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  <View
                    style={
                      styles.itemContent
                    }
                  >
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/product/${item.product_id}`
                        )
                      }
                    >
                      <Text
                        style={
                          styles.productName
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {
                          item.product_name
                        }
                      </Text>
                    </Pressable>

                    <Text
                      style={
                        styles.unitPrice
                      }
                    >
                      {money(
                        item.price
                      )}
                    </Text>

                    <View
                      style={
                        styles.itemBottom
                      }
                    >
                      <View
                        style={
                          styles.quantityBox
                        }
                      >
                        <Pressable
                          disabled={
                            busy ||
                            item.quantity <=
                              1
                          }
                          style={[
                            styles.quantityButton,
                            (
                              busy ||
                              item.quantity <=
                                1
                            ) &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            void changeQuantity(
                              item,
                              item.quantity -
                                1
                            )
                          }
                        >
                          <Text
                            style={
                              styles.quantitySymbol
                            }
                          >
                            −
                          </Text>
                        </Pressable>

                        <View
                          style={
                            styles.quantityValue
                          }
                        >
                          {busy ? (
                            <ActivityIndicator
                              size="small"
                              color={
                                colors.primary
                              }
                            />
                          ) : (
                            <Text
                              style={
                                styles.quantityText
                              }
                            >
                              {
                                item.quantity
                              }
                            </Text>
                          )}
                        </View>

                        <Pressable
                          disabled={
                            busy ||
                            item.quantity >=
                              Number(
                                item.stock_quantity ||
                                  0
                              )
                          }
                          style={[
                            styles.quantityButton,
                            (
                              busy ||
                              item.quantity >=
                                Number(
                                  item.stock_quantity ||
                                    0
                                )
                            ) &&
                              styles.disabled,
                          ]}
                          onPress={() =>
                            void changeQuantity(
                              item,
                              item.quantity +
                                1
                            )
                          }
                        >
                          <Text
                            style={
                              styles.quantitySymbol
                            }
                          >
                            +
                          </Text>
                        </Pressable>
                      </View>

                      <Text
                        style={
                          styles.subtotal
                        }
                      >
                        {money(
                          item.subtotal
                        )}
                      </Text>
                    </View>

                    <Pressable
                      disabled={busy}
                      style={
                        styles.removeButton
                      }
                      onPress={() =>
                        void removeItem(
                          item
                        )
                      }
                    >
                      <Text
                        style={
                          styles.removeText
                        }
                      >
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <View
              style={
                styles.totalCard
              }
            >
              <View
                style={
                  styles.totalRow
                }
              >
                <Text
                  style={
                    styles.totalLabel
                  }
                >
                  Cart Total
                </Text>

                <Text
                  style={
                    styles.totalAmount
                  }
                >
                  {money(
                    grandTotal
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.totalNote
                }
              >
                Delivery charges,
                discounts and rewards are
                calculated at checkout.
              </Text>

              <Pressable
                style={
                  styles.checkoutButton
                }
                onPress={() => {
                  setMessage(
                    "Checkout is the next mobile module we will connect."
                  );
                }}
              >
                <Text
                  style={
                    styles.checkoutText
                  }
                >
                  Proceed to Checkout
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.continueButton
                }
                onPress={() =>
                  router.push(
                    "/shop"
                  )
                }
              >
                <Text
                  style={
                    styles.continueText
                  }
                >
                  Continue Shopping
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.background,
      gap: 12,
    },

    loadingText: {
      color: colors.primary,
      fontWeight: "700",
    },

    topBar: {
      minHeight: 72,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      backgroundColor:
        colors.primary,
    },

    backButton: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },

    backText: {
      color: colors.white,
      fontSize: 36,
      lineHeight: 38,
    },

    brand: {
      color: colors.secondary,
      textAlign: "center",
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 3,
    },

    pageLabel: {
      marginTop: 2,
      color: "#f2ead3",
      textAlign: "center",
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 1.3,
    },

    topSpacer: {
      width: 42,
    },

    content: {
      padding: 16,
      paddingBottom: 40,
    },

    messageBox: {
      backgroundColor:
        colors.soft,
      borderWidth: 1,
      borderColor:
        colors.secondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
    },

    messageText: {
      color: colors.primary,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
    },

    summaryHeader: {
      marginBottom: 13,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    summaryTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },

    itemCount: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
    },

    cartCard: {
      padding: 12,
      marginBottom: 12,
      flexDirection: "row",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
    },

    productImageBox: {
      width: 96,
      height: 112,
      overflow: "hidden",
      borderRadius: 12,
      backgroundColor:
        colors.soft,
    },

    productImage: {
      width: "100%",
      height: "100%",
    },

    imageFallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    imageFallbackText: {
      color: colors.primary,
      fontSize: 28,
      fontWeight: "900",
    },

    itemContent: {
      flex: 1,
      paddingLeft: 12,
    },

    productName: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
    },

    unitPrice: {
      marginTop: 5,
      color: colors.accent,
      fontSize: 12,
      fontWeight: "800",
    },

    itemBottom: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 8,
    },

    quantityBox: {
      height: 36,
      flexDirection: "row",
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },

    quantityButton: {
      width: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.soft,
    },

    quantitySymbol: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: "800",
    },

    quantityValue: {
      width: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.surface,
    },

    quantityText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },

    disabled: {
      opacity: 0.35,
    },

    subtotal: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },

    removeButton: {
      alignSelf: "flex-start",
      marginTop: 10,
    },

    removeText: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: "700",
      textDecorationLine:
        "underline",
    },

    totalCard: {
      marginTop: 8,
      padding: 18,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
    },

    totalRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    totalLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },

    totalAmount: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: "900",
    },

    totalNote: {
      marginTop: 10,
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
    },

    checkoutButton: {
      minHeight: 50,
      marginTop: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.primary,
      borderRadius: 12,
    },

    checkoutText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: "900",
    },

    continueButton: {
      minHeight: 46,
      marginTop: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor:
        colors.primary,
      borderRadius: 12,
    },

    continueText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },

    emptyCard: {
      marginTop: 70,
      padding: 30,
      alignItems: "center",
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 20,
    },

    emptyIcon: {
      fontSize: 42,
    },

    emptyTitle: {
      marginTop: 14,
      color: colors.primary,
      fontSize: 20,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 8,
      color: colors.muted,
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
    },

    shopButton: {
      minHeight: 46,
      marginTop: 20,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.primary,
      borderRadius: 12,
    },

    shopButtonText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: "800",
    },
  });
