import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
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
  useLocalSearchParams,
} from "expo-router";

import {
  SymbolView,
} from "expo-symbols";

import {
  API_ORIGIN,
} from "../config/api";

import {
  getGuestOrder,
  type GuestOrderDetails,
  type GuestOrderItem,
} from "../api/guestOrders";

import {
  getGuestOrderAccess,
  getRecentGuestOrderAccess,
} from "../guest/guestOrders";

type IconName =
  | "check"
  | "bag"
  | "card"
  | "location"
  | "truck"
  | "shop"
  | "refresh";

const SYMBOLS: Record<
  IconName,
  string
> = {
  check: "checkmark.circle.fill",
  bag: "bag",
  card: "creditcard",
  location: "location",
  truck: "truck.box",
  shop: "storefront",
  refresh: "arrow.clockwise",
};

function Icon({
  name,
  size = 20,
  color = "#123d2d",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <SymbolView
      name={SYMBOLS[name] as any}
      size={size}
      tintColor={color}
    />
  );
}

function money(
  value: unknown
) {
  const amount =
    Number(value || 0);

  return `Rs. ${amount.toLocaleString(
    "en-PK",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

function cleanStatus(
  value: unknown,
  fallback = "Pending"
) {
  const text =
    String(value || "")
      .trim();

  if (!text) {
    return fallback;
  }

  return text
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      char => char.toUpperCase()
    );
}

function paymentLabel(
  value: unknown
) {
  const method =
    String(value || "")
      .trim()
      .toLowerCase();

  switch (method) {
    case "cash_on_delivery":
      return "Cash on Delivery";

    case "easypaisa":
      return "Easypaisa";

    case "jazzcash":
      return "JazzCash";

    case "bank_transfer":
      return "Bank Transfer";

    default:
      return cleanStatus(
        method,
        "—"
      );
  }
}

function productImageUrl(
  image: string | null | undefined
) {
  const raw =
    String(image || "")
      .trim();

  if (!raw) {
    return null;
  }

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${API_ORIGIN}${raw}`;
  }

  return `${API_ORIGIN}/${raw}`;
}

export default function GuestOrderSuccessScreen() {
  const params =
    useLocalSearchParams<{
      order?: string | string[];
    }>();

  const routeOrder =
    Array.isArray(params.order)
      ? params.order[0]
      : params.order;

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [order, setOrder] =
    useState<GuestOrderDetails | null>(
      null
    );

  const loadOrder =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        let orderNumber =
          String(
            routeOrder || ""
          )
            .trim()
            .toUpperCase();

        let token: string | null =
          null;

        if (orderNumber) {
          token =
            await getGuestOrderAccess(
              orderNumber
            );
        }

        /*
         * Useful if the screen is restored
         * immediately after checkout and
         * route state is unavailable.
         */
        if (
          !orderNumber ||
          !token
        ) {
          const recent =
            await getRecentGuestOrderAccess();

          if (
            recent &&
            (
              !orderNumber ||
              recent.orderNumber ===
                orderNumber
            )
          ) {
            orderNumber =
              recent.orderNumber;

            token =
              recent.token;
          }
        }

        if (
          !orderNumber ||
          !token
        ) {
          throw new Error(
            "Order confirmation access is unavailable on this device."
          );
        }

        const response =
          await getGuestOrder(
            orderNumber,
            token
          );

        if (
          !response?.order
        ) {
          throw new Error(
            "Order confirmation could not be loaded."
          );
        }

        setOrder(
          response.order
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your order confirmation."
        );
      } finally {
        setLoading(false);
      }
    }, [routeOrder]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <SafeAreaView
        style={styles.centerPage}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Loading order confirmation...
        </Text>
      </SafeAreaView>
    );
  }

  if (!order || error) {
    return (
      <SafeAreaView
        style={styles.centerPage}
      >
        <View
          style={styles.errorIcon}
        >
          <Icon
            name="bag"
            size={30}
          />
        </View>

        <Text
          style={styles.errorTitle}
        >
          Unable to Load Order
        </Text>

        <Text
          style={styles.errorText}
        >
          {error ||
            "Order confirmation is unavailable."}
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={loadOrder}
        >
          <Icon
            name="refresh"
            size={18}
            color="#ffffff"
          />

          <Text
            style={
              styles.primaryButtonText
            }
          >
            Try Again
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            router.replace("/shop")
          }
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Continue Shopping
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  return (
    <SafeAreaView
      style={styles.page}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <View
        style={styles.header}
      >
        <Text
          style={styles.brand}
        >
          RUKHNAV
        </Text>

        <View
          style={styles.headerSecure}
        >
          <Icon
            name="check"
            size={17}
            color="#d8b968"
          />

          <Text
            style={styles.headerSecureText}
          >
            Order Confirmed
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={styles.successCard}
        >
          <View
            style={styles.successIcon}
          >
            <Icon
              name="check"
              size={54}
              color="#123d2d"
            />
          </View>

          <Text
            style={styles.successEyebrow}
          >
            THANK YOU
          </Text>

          <Text
            style={styles.successTitle}
          >
            Your order has been placed
          </Text>

          <Text
            style={styles.successText}
          >
            We have received your
            RUKHNAV order and will keep
            you updated as it progresses.
          </Text>

          <View
            style={styles.orderNumberBox}
          >
            <Text
              style={
                styles.orderNumberLabel
              }
            >
              ORDER NUMBER
            </Text>

            <Text
              style={
                styles.orderNumber
              }
              selectable
            >
              {order.order_number}
            </Text>
          </View>
        </View>

        <View
          style={styles.statusGrid}
        >
          <StatusCard
            label="Order Status"
            value={cleanStatus(
              order.order_status
            )}
            icon="bag"
          />

          <StatusCard
            label="Payment"
            value={cleanStatus(
              order.payment_status
            )}
            icon="card"
          />

          <StatusCard
            label="Total"
            value={money(
              order.grand_total
            )}
            icon="card"
          />

          <StatusCard
            label="Delivery City"
            value={
              order.city || "—"
            }
            icon="location"
          />
        </View>

        <View
          style={styles.section}
        >
          <View
            style={styles.sectionHeading}
          >
            <View
              style={styles.sectionIcon}
            >
              <Icon
                name="bag"
                size={18}
              />
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Order Items
            </Text>
          </View>

          {items.length === 0 ? (
            <Text
              style={styles.emptyItems}
            >
              No item details available.
            </Text>
          ) : (
            items.map(
              (
                item:
                  GuestOrderItem,
                index
              ) => {
                const imageUrl =
                  productImageUrl(
                    item.image
                  );

                return (
                  <View
                    key={
                      item.order_item_id ??
                      `${item.product_id}-${index}`
                    }
                    style={
                      styles.itemRow
                    }
                  >
                    <View
                      style={
                        styles.itemImage
                      }
                    >
                      {imageUrl ? (
                        <Image
                          source={{
                            uri: imageUrl,
                          }}
                          style={
                            styles.itemImageActual
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <Icon
                          name="bag"
                          size={23}
                          color="#678074"
                        />
                      )}
                    </View>

                    <View
                      style={
                        styles.itemCopy
                      }
                    >
                      <Text
                        style={
                          styles.itemName
                        }
                        numberOfLines={2}
                      >
                        {item.product_name ||
                          "RUKHNAV Product"}
                      </Text>

                      <Text
                        style={
                          styles.itemMeta
                        }
                      >
                        {item.quantity} ×{" "}
                        {money(
                          item.price
                        )}
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.itemTotal
                      }
                    >
                      {money(
                        item.subtotal
                      )}
                    </Text>
                  </View>
                );
              }
            )
          )}
        </View>

        <View
          style={styles.section}
        >
          <View
            style={styles.sectionHeading}
          >
            <View
              style={styles.sectionIcon}
            >
              <Icon
                name="card"
                size={18}
              />
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Payment Summary
            </Text>
          </View>

          <InfoRow
            label="Payment Method"
            value={paymentLabel(
              order.payment_method
            )}
          />

          <InfoRow
            label="Payment Status"
            value={cleanStatus(
              order.payment_status
            )}
          />

          {Number(
            order.delivery_charges ||
              0
          ) > 0 ? (
            <InfoRow
              label="Delivery"
              value={money(
                order.delivery_charges
              )}
            />
          ) : (
            <InfoRow
              label="Delivery"
              value="FREE"
            />
          )}

          <View
            style={styles.totalDivider}
          />

          <InfoRow
            label="Order Total"
            value={money(
              order.grand_total
            )}
            strong
          />
        </View>

        <View
          style={styles.section}
        >
          <View
            style={styles.sectionHeading}
          >
            <View
              style={styles.sectionIcon}
            >
              <Icon
                name="location"
                size={18}
              />
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Delivery
            </Text>
          </View>

          <Text
            style={styles.deliveryName}
          >
            {order.full_name ||
              "Guest Customer"}
          </Text>

          {!!order.shipping_address && (
            <Text
              style={styles.deliveryText}
            >
              {order.shipping_address}
            </Text>
          )}

          <Text
            style={styles.deliveryText}
          >
            {[
              order.city,
              order.postal_code,
            ]
              .filter(Boolean)
              .join(", ") || "—"}
          </Text>
        </View>

        {(
          order.tracking_number ||
          order.estimated_delivery_date
        ) && (
          <View
            style={styles.trackingCard}
          >
            <View
              style={styles.trackingIcon}
            >
              <Icon
                name="truck"
                size={25}
              />
            </View>

            <View
              style={styles.trackingCopy}
            >
              <Text
                style={
                  styles.trackingTitle
                }
              >
                Delivery Tracking
              </Text>

              {!!order.tracking_number && (
                <Text
                  style={
                    styles.trackingText
                  }
                >
                  Tracking:{" "}
                  {
                    order.tracking_number
                  }
                </Text>
              )}

              {!!order.estimated_delivery_date && (
                <Text
                  style={
                    styles.trackingText
                  }
                >
                  Estimated delivery:{" "}
                  {
                    order.estimated_delivery_date
                  }
                </Text>
              )}
            </View>
          </View>
        )}

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname:
                "/track-order" as any,
              params: {
                order:
                  order.order_number,
              },
            })
          }
        >
          <Icon
            name="truck"
            size={19}
            color="#ffffff"
          />

          <Text
            style={
              styles.primaryButtonText
            }
          >
            Track Your Order
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            router.replace("/shop")
          }
        >
          <Icon
            name="shop"
            size={18}
          />

          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Continue Shopping
          </Text>
        </Pressable>

        <Text
          style={styles.footerNote}
        >
          Keep your order number safe.
          You can track this order using
          the email address or mobile
          number entered during checkout.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  return (
    <View
      style={styles.statusCard}
    >
      <Icon
        name={icon}
        size={18}
      />

      <Text
        style={styles.statusLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.statusValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View
      style={styles.infoRow}
    >
      <Text
        style={[
          styles.infoLabel,
          strong &&
            styles.infoLabelStrong,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.infoValue,
          strong &&
            styles.infoValueStrong,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: "#f4f6f4",
    },

    centerPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      backgroundColor: "#f4f6f4",
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: "#66746d",
    },

    errorIcon: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#e8f0ec",
      marginBottom: 17,
    },

    errorTitle: {
      fontSize: 21,
      fontWeight: "900",
      color: "#17382d",
    },

    errorText: {
      marginTop: 8,
      marginBottom: 22,
      textAlign: "center",
      fontSize: 13,
      lineHeight: 20,
      color: "#6d7973",
    },

    header: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 17,
      backgroundColor: "#123d2d",
    },

    brand: {
      fontSize: 19,
      fontWeight: "900",
      letterSpacing: 1.5,
      color: "#ffffff",
    },

    headerSecure: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    headerSecureText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#e4ece8",
    },

    content: {
      padding: 14,
      paddingBottom: 34,
      gap: 14,
    },

    successCard: {
      alignItems: "center",
      padding: 22,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: "#dce6e1",
      backgroundColor: "#ffffff",
    },

    successIcon: {
      marginBottom: 10,
    },

    successEyebrow: {
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.7,
      color: "#927b39",
    },

    successTitle: {
      marginTop: 5,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
      color: "#17382d",
    },

    successText: {
      marginTop: 8,
      maxWidth: 310,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      color: "#6a7770",
    },

    orderNumberBox: {
      width: "100%",
      marginTop: 18,
      padding: 13,
      alignItems: "center",
      borderRadius: 13,
      backgroundColor: "#f1f6f3",
    },

    orderNumberLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.1,
      color: "#748179",
    },

    orderNumber: {
      marginTop: 4,
      fontSize: 16,
      fontWeight: "900",
      color: "#123d2d",
    },

    statusGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },

    statusCard: {
      width: "48%",
      minHeight: 108,
      padding: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#e0e6e2",
      backgroundColor: "#ffffff",
    },

    statusLabel: {
      marginTop: 9,
      fontSize: 10,
      color: "#7a867f",
    },

    statusValue: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: "800",
      color: "#243e33",
    },

    section: {
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#e0e6e2",
      backgroundColor: "#ffffff",
    },

    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },

    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
      backgroundColor: "#edf4f0",
    },

    sectionTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: "#17382d",
    },

    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#edf0ee",
    },

    itemImage: {
      width: 52,
      height: 52,
      borderRadius: 12,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      backgroundColor: "#edf2ef",
    },

    itemImageActual: {
      width: "100%",
      height: "100%",
    },

    itemCopy: {
      flex: 1,
      paddingRight: 8,
    },

    itemName: {
      fontSize: 13,
      fontWeight: "800",
      color: "#253d33",
    },

    itemMeta: {
      marginTop: 4,
      fontSize: 11,
      color: "#77837d",
    },

    itemTotal: {
      fontSize: 12,
      fontWeight: "900",
      color: "#17382d",
    },

    emptyItems: {
      fontSize: 12,
      color: "#75817b",
    },

    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
      gap: 12,
    },

    infoLabel: {
      flex: 1,
      fontSize: 12,
      color: "#6a7770",
    },

    infoValue: {
      maxWidth: "55%",
      fontSize: 12,
      fontWeight: "700",
      textAlign: "right",
      color: "#2c4439",
    },

    infoLabelStrong: {
      fontSize: 14,
      fontWeight: "900",
      color: "#17382d",
    },

    infoValueStrong: {
      fontSize: 17,
      fontWeight: "900",
      color: "#123d2d",
    },

    totalDivider: {
      height: 1,
      marginVertical: 7,
      backgroundColor: "#e5eae7",
    },

    deliveryName: {
      fontSize: 13,
      fontWeight: "800",
      color: "#2b4439",
    },

    deliveryText: {
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      color: "#69766f",
    },

    trackingCard: {
      flexDirection: "row",
      padding: 14,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "#d8e5de",
      backgroundColor: "#edf5f1",
    },

    trackingIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
      backgroundColor: "#ffffff",
    },

    trackingCopy: {
      flex: 1,
    },

    trackingTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: "#17382d",
    },

    trackingText: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 16,
      color: "#617169",
    },

    primaryButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      paddingHorizontal: 18,
      backgroundColor: "#123d2d",
    },

    primaryButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: "#ffffff",
    },

    secondaryButton: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: "#123d2d",
      borderRadius: 14,
      paddingHorizontal: 18,
      backgroundColor: "#ffffff",
    },

    secondaryButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#123d2d",
    },

    footerNote: {
      paddingHorizontal: 10,
      textAlign: "center",
      fontSize: 10,
      lineHeight: 16,
      color: "#748079",
    },
  });
