import {
  ActivityIndicator,
  Alert,
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
} from "expo-router";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getWishlist,
  removeWishlistItem,
  type WishlistItem,
} from "../api/wishlist";

import {
  addToCart,
} from "../api/cart";

import {
  productImageUrl,
} from "../config/images";

import {
  useWebsiteTheme,
} from "../theme/website-theme";


function money(
  value: string | number
) {
  return `Rs. ${Number(value || 0)
    .toLocaleString("en-PK")}`;
}


function dateLabel(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


export default function WishlistScreen() {
  const theme =
    useWebsiteTheme();

  const styles =
    createStyles(theme);

  const [items, setItems] =
    useState<WishlistItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [busyId, setBusyId] =
    useState<number | null>(
      null
    );

  const [error, setError] =
    useState("");


  const loadWishlist =
    useCallback(async () => {
      try {
        setError("");

        const data =
          await getWishlist();

        setItems(
          Array.isArray(data.wishlist)
            ? data.wishlist
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load wishlist."
        );
      }
    }, []);


  useEffect(() => {
    loadWishlist().finally(() =>
      setLoading(false)
    );
  }, [loadWishlist]);


  async function refresh() {
    setRefreshing(true);

    try {
      await loadWishlist();
    } finally {
      setRefreshing(false);
    }
  }


  async function removeItem(
    item: WishlistItem
  ) {
    setBusyId(
      item.wishlist_id
    );

    try {
      await removeWishlistItem(
        item.wishlist_id
      );

      setItems(current =>
        current.filter(
          row =>
            row.wishlist_id !==
            item.wishlist_id
        )
      );
    } catch (err) {
      Alert.alert(
        "Unable to Remove",
        err instanceof Error
          ? err.message
          : "Unable to remove this product."
      );
    } finally {
      setBusyId(null);
    }
  }


  async function moveToCart(
    item: WishlistItem,
    buyNow = false
  ) {
    if (
      Number(item.stock) <= 0 ||
      String(
        item.status || ""
      ).toLowerCase() ===
        "inactive"
    ) {
      Alert.alert(
        "Unavailable",
        "This product is currently unavailable."
      );

      return;
    }

    setBusyId(
      item.wishlist_id
    );

    try {
      await addToCart({
        product_id:
          Number(
            item.product_id
          ),
        quantity: 1,
      });

      await removeWishlistItem(
        item.wishlist_id
      );

      setItems(current =>
        current.filter(
          row =>
            row.wishlist_id !==
            item.wishlist_id
        )
      );

      if (buyNow) {
        router.push("/cart");
        return;
      }

      Alert.alert(
        "Added to Cart",
        "Product moved from your wishlist to your cart.",
        [
          {
            text:
              "Continue Shopping",
            style:
              "cancel",
          },
          {
            text:
              "Go to Cart",
            onPress: () =>
              router.push(
                "/cart"
              ),
          },
        ]
      );
    } catch (err) {
      Alert.alert(
        "Unable to Add",
        err instanceof Error
          ? err.message
          : "Unable to add this product to your cart."
      );
    } finally {
      setBusyId(null);
    }
  }


  if (loading) {
    return (
      <SafeAreaView
        style={styles.page}
      >
        <View
          style={styles.loading}
        >
          <ActivityIndicator
            size="large"
            color={
              theme.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading your wishlist
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={styles.page}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹
          </Text>
        </Pressable>

        <View>
          <Text
            style={
              styles.headerTitle
            }
          >
            My Wishlist
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            {items.length}
            {" saved "}
            {items.length === 1
              ? "product"
              : "products"}
          </Text>
        </View>

        <View
          style={
            styles.headerSpace
          }
        />
      </View>


      <ScrollView
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refresh
            }
            tintColor={
              theme.primary
            }
          />
        }
      >
        {error ? (
          <View
            style={
              styles.errorBox
            }
          >
            <Text
              style={
                styles.errorTitle
              }
            >
              Unable to refresh wishlist
            </Text>

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>

            <Pressable
              onPress={
                loadWishlist
              }
            >
              <Text
                style={
                  styles.retryText
                }
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}


        {!items.length ? (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              ♡
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Your wishlist is empty
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Save products you would like to revisit.
            </Text>

            <Pressable
              style={
                styles.shopButton
              }
              onPress={() =>
                router.push(
                  "/shop"
                )
              }
            >
              <Text
                style={
                  styles.shopButtonText
                }
              >
                Browse Products
              </Text>
            </Pressable>
          </View>
        ) : (
          items.map(item => {
            const image =
              productImageUrl(
                item.image
              );

            const available =
              Number(
                item.stock
              ) > 0 &&
              String(
                item.status || ""
              ).toLowerCase() !==
                "inactive";

            const busy =
              busyId ===
              item.wishlist_id;

            return (
              <View
                key={
                  item.wishlist_id
                }
                style={
                  styles.card
                }
              >
                <Pressable
                  style={
                    styles.imageWrap
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
                        styles.image
                      }
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={
                        styles.placeholder
                      }
                    >
                      <Text
                        style={
                          styles.placeholderText
                        }
                      >
                        RUKHNAV
                      </Text>
                    </View>
                  )}
                </Pressable>


                <View
                  style={
                    styles.cardContent
                  }
                >
                  <View
                    style={
                      styles.cardTop
                    }
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.brand
                        }
                      >
                        RUKHNAV
                      </Text>

                      <Pressable
                        onPress={() =>
                          router.push(
                            `/product/${item.product_id}`
                          )
                        }
                      >
                        <Text
                          style={
                            styles.name
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
                    </View>

                    <Pressable
                      style={
                        styles.removeButton
                      }
                      disabled={
                        busy
                      }
                      onPress={() =>
                        removeItem(
                          item
                        )
                      }
                    >
                      <Text
                        style={
                          styles.removeText
                        }
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>


                  <Text
                    style={
                      styles.price
                    }
                  >
                    {money(
                      item.price
                    )}
                  </Text>


                  <Text
                    style={[
                      styles.stock,
                      !available &&
                        styles.outOfStock,
                    ]}
                  >
                    {available
                      ? `In Stock • ${item.stock} available`
                      : "Out of Stock"}
                  </Text>


                  {item.created_at ? (
                    <Text
                      style={
                        styles.savedDate
                      }
                    >
                      Saved{" "}
                      {dateLabel(
                        item.created_at
                      )}
                    </Text>
                  ) : null}


                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      disabled={
                        !available ||
                        busy
                      }
                      style={[
                        styles.cartButton,
                        (!available ||
                          busy) &&
                          styles.disabled,
                      ]}
                      onPress={() =>
                        moveToCart(
                          item,
                          false
                        )
                      }
                    >
                      <Text
                        style={
                          styles.cartButtonText
                        }
                      >
                        {busy
                          ? "Please wait"
                          : "Add to Cart"}
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={
                        !available ||
                        busy
                      }
                      style={[
                        styles.buyButton,
                        (!available ||
                          busy) &&
                          styles.disabled,
                      ]}
                      onPress={() =>
                        moveToCart(
                          item,
                          true
                        )
                      }
                    >
                      <Text
                        style={
                          styles.buyButtonText
                        }
                      >
                        Buy Now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(
  theme: ReturnType<
    typeof useWebsiteTheme
  >
) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor:
        theme.background,
    },

    loading: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 12,
    },

    loadingText: {
      color:
        theme.muted,
      fontSize: 13,
    },

    header: {
      minHeight: 62,
      paddingHorizontal: 14,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      backgroundColor:
        theme.surface,
      borderBottomWidth: 1,
      borderBottomColor:
        theme.shade4,
    },

    back: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        theme.shade4,
    },

    backText: {
      color:
        theme.primary,
      fontSize: 30,
      lineHeight: 31,
    },

    headerTitle: {
      color:
        theme.primary,
      fontSize: 18,
      fontWeight:
        "900",
      textAlign:
        "center",
    },

    headerSubtitle: {
      color:
        theme.muted,
      fontSize: 9,
      textAlign:
        "center",
      marginTop: 1,
    },

    headerSpace: {
      width: 38,
    },

    content: {
      padding: 12,
      paddingBottom: 40,
    },

    card: {
      flexDirection:
        "row",
      marginBottom: 10,
      borderRadius: 16,
      overflow:
        "hidden",
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    imageWrap: {
      width: 116,
      minHeight: 156,
      backgroundColor:
        theme.shade4,
    },

    image: {
      width: "100%",
      height: "100%",
    },

    placeholder: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    placeholderText: {
      color:
        theme.primary,
      fontSize: 10,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    cardContent: {
      flex: 1,
      padding: 12,
    },

    cardTop: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
    },

    brand: {
      color:
        theme.secondary,
      fontSize: 8,
      fontWeight:
        "900",
      letterSpacing: 1,
    },

    name: {
      color:
        theme.heading,
      fontSize: 14,
      lineHeight: 18,
      fontWeight:
        "800",
      marginTop: 3,
    },

    removeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        theme.shade4,
      marginLeft: 8,
    },

    removeText: {
      color:
        theme.primary,
      fontSize: 20,
      lineHeight: 21,
    },

    price: {
      color:
        theme.primary,
      fontSize: 16,
      fontWeight:
        "900",
      marginTop: 8,
    },

    stock: {
      color:
        "#2e6b45",
      fontSize: 9,
      fontWeight:
        "700",
      marginTop: 4,
    },

    outOfStock: {
      color:
        "#a44141",
    },

    savedDate: {
      color:
        theme.muted,
      fontSize: 8,
      marginTop: 4,
    },

    actions: {
      flexDirection:
        "row",
      gap: 7,
      marginTop: 10,
    },

    cartButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor:
        theme.primary,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 8,
    },

    cartButtonText: {
      color:
        theme.primary,
      fontSize: 9,
      fontWeight:
        "900",
    },

    buyButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 19,
      backgroundColor:
        theme.primary,
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 8,
    },

    buyButtonText: {
      color:
        theme.surface,
      fontSize: 9,
      fontWeight:
        "900",
    },

    disabled: {
      opacity: 0.45,
    },

    empty: {
      minHeight: 430,
      paddingHorizontal: 28,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    emptyIcon: {
      color:
        theme.secondary,
      fontSize: 54,
    },

    emptyTitle: {
      color:
        theme.heading,
      fontSize: 20,
      fontWeight:
        "900",
      marginTop: 10,
    },

    emptyText: {
      color:
        theme.muted,
      fontSize: 12,
      textAlign:
        "center",
      lineHeight: 18,
      marginTop: 6,
    },

    shopButton: {
      marginTop: 18,
      backgroundColor:
        theme.primary,
      borderRadius: 22,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },

    shopButtonText: {
      color:
        theme.surface,
      fontWeight:
        "900",
      fontSize: 11,
    },

    errorBox: {
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        theme.surface,
      borderWidth: 1,
      borderColor:
        theme.shade4,
    },

    errorTitle: {
      color:
        theme.primary,
      fontWeight:
        "900",
    },

    errorText: {
      color:
        theme.muted,
      marginTop: 4,
      fontSize: 11,
    },

    retryText: {
      color:
        theme.secondary,
      marginTop: 8,
      fontWeight:
        "900",
    },
  });
}
