import {
  ActivityIndicator,
  Alert,
  Linking,
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
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelOrder,
  getOrderDetails,
  type CustomerOrderDetails,
  type CustomerOrderItem,
} from "../../api/orders";

import {
  addToCart,
} from "../../api/cart";

import {
  colors,
} from "../../theme/rukhnav";


function money(
  value?: number | string | null
) {
  return `Rs. ${Number(
    value || 0
  ).toLocaleString(
    "en-PK",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}


function pretty(
  value?: string | null
) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );
}


function date(
  value?: string | null
) {
  if (!value) return "—";

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return parsed.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


function dateTime(
  value?: string | null
) {
  if (!value) return "—";

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return parsed.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function statusMessage(
  value?: string | null
) {
  const status =
    String(value || "")
      .toLowerCase();

  const messages:
    Record<string, string> = {
      pending:
        "Your order has been received and is awaiting confirmation.",

      confirmed:
        "Your order has been confirmed.",

      processing:
        "Your products are being prepared for shipment.",

      shipped:
        "Your order is on the way.",

      delivered:
        "Your order has been delivered.",

      cancelled:
        "This order has been cancelled.",
    };

  return (
    messages[status] ||
    "Order status updated."
  );
}


function Section({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        style={
          styles.sectionTitle
        }
      >
        {title}
      </Text>

      {children}
    </View>
  );
}


function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text
        style={
          styles.rowLabel
        }
      >
        {label}
      </Text>

      <Text
        style={[
          styles.rowValue,
          strong &&
            styles.rowStrong,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}


export default function OrderDetailsScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const orderId =
    Number(params.id);


  const [order, setOrder] =
    useState<CustomerOrderDetails | null>(
      null
    );

  const [items, setItems] =
    useState<CustomerOrderItem[]>([]);

  const [
    totalQuantity,
    setTotalQuantity,
  ] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [
    cancelling,
    setCancelling,
  ] = useState(false);

  const [
    reordering,
    setReordering,
  ] = useState(false);

  const [message, setMessage] =
    useState("");


  const loadOrder =
    useCallback(
      async () => {
        if (
          !Number.isInteger(
            orderId
          ) ||
          orderId < 1
        ) {
          setMessage(
            "A valid order ID is required."
          );

          setLoading(false);
          return;
        }

        try {
          setMessage("");

          const data =
            await getOrderDetails(
              orderId
            );

          setOrder(data.order);
          setItems(data.items);

          setTotalQuantity(
            data.totalQuantity
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load order details."
          );
        } finally {
          setLoading(false);
        }
      },
      [orderId]
    );


  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);


  const canCancel =
    useMemo(() => {
      if (!order) {
        return false;
      }

      return (
        String(
          order.order_status ||
            ""
        ).toLowerCase() ===
          "pending" &&
        String(
          order.payment_status ||
            ""
        ).toLowerCase() !==
          "paid"
      );
    }, [order]);


  const timeline =
    useMemo(() => {
      if (!order) {
        return [];
      }

      const status =
        String(
          order.order_status ||
            "Pending"
        ).toLowerCase();

      const cancelled =
        status === "cancelled";

      const statusIndex:
        Record<string, number> = {
          pending: 0,
          confirmed: 1,
          processing: 1,
          shipped: 2,
          delivered: 3,
        };

      const current =
        statusIndex[status] ?? 0;

      const steps = [
        {
          label:
            cancelled
              ? "Cancelled"
              : "Order placed",

          date:
            cancelled
              ? order.cancelled_at
              : order.created_at,
        },

        {
          label: "Confirmed",
          date:
            order.confirmed_at,
        },

        {
          label: "Shipped",
          date:
            order.shipped_at,
        },

        {
          label: "Delivered",
          date:
            order.delivered_at,
        },
      ];

      return steps.map(
        (step, index) => ({
          ...step,

          complete:
            !cancelled &&
            index < current,

          active:
            !cancelled &&
            index === current,

          cancelled:
            cancelled &&
            index === 0,
        })
      );
    }, [order]);


  function confirmCancel() {
    if (
      !order ||
      !canCancel ||
      cancelling
    ) {
      return;
    }

    Alert.alert(
      "Cancel Order",
      "Cancel this pending order? Product stock will be restored.",
      [
        {
          text: "Keep Order",
          style: "cancel",
        },

        {
          text: "Cancel Order",
          style:
            "destructive",

          onPress: () => {
            void performCancel();
          },
        },
      ]
    );
  }


  async function performCancel() {
    if (!order) return;

    try {
      setCancelling(true);
      setMessage("");

      const response =
        await cancelOrder(
          order.id
        );

      setMessage(
        response.message ||
          "Order cancelled successfully."
      );

      await loadOrder();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel this order."
      );
    } finally {
      setCancelling(false);
    }
  }


  async function reorder() {
    if (
      !items.length ||
      reordering
    ) {
      return;
    }

    try {
      setReordering(true);
      setMessage("");

      let added = 0;
      let failed = 0;

      for (
        const item of items
      ) {
        try {
          await addToCart({
            product_id:
              item.product_id,

            quantity:
              Math.max(
                1,
                Number(
                  item.quantity ||
                    1
                )
              ),
          });

          added += 1;
        } catch {
          failed += 1;
        }
      }

      if (
        added > 0 &&
        failed === 0
      ) {
        setMessage(
          `${added} product line(s) added to cart.`
        );
      } else if (
        added > 0
      ) {
        setMessage(
          `${added} product line(s) added. ${failed} could not be added.`
        );
      } else {
        setMessage(
          "These products could not be added to your cart."
        );
      }

      if (added > 0) {
        router.push(
          "/cart"
        );
      }
    } finally {
      setReordering(false);
    }
  }


  async function openTracking() {
    const url =
      order?.tracking_url;

    if (!url) {
      return;
    }

    try {
      const supported =
        await Linking.canOpenURL(
          url
        );

      if (!supported) {
        setMessage(
          "The tracking link cannot be opened on this device."
        );

        return;
      }

      await Linking.openURL(
        url
      );
    } catch {
      setMessage(
        "Unable to open the tracking link."
      );
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
          style={
            styles.loadingText
          }
        >
          Loading order details...
        </Text>
      </SafeAreaView>
    );
  }


  if (!order) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Order unavailable
        </Text>

        <Text
          style={
            styles.errorDescription
          }
        >
          {message ||
            "This order could not be loaded."}
        </Text>

        <Pressable
          style={
            styles.primaryButton
          }
          onPress={() =>
            router.replace(
              "/orders" as any
            )
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Back to My Orders
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }


  const showTracking =
    Boolean(
      order.tracking_number ||
        order.tracking_url ||
        order.estimated_delivery_date
    );


  const membership =
    order.loyalty_membership_level
      ? `${order.loyalty_membership_level} member discount${
          Number(
            order.loyalty_discount_percentage ||
              0
          ) > 0
            ? ` (${Number(
                order.loyalty_discount_percentage
              )}%)`
            : ""
        }`
      : "Member discount";


  return (
    <SafeAreaView
      style={styles.page}
    >
      <View style={styles.header}>
        <Pressable
          style={
            styles.backButton
          }
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

        <View style={styles.flex}>
          <Text
            style={
              styles.eyebrow
            }
          >
            ORDER DETAILS
          </Text>

          <Text
            style={
              styles.heading
            }
            numberOfLines={1}
          >
            {order.order_number ||
              `Order #${order.id}`}
          </Text>
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>


      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={
            styles.statusCard
          }
        >
          <Text
            style={
              styles.statusLabel
            }
          >
            CURRENT STATUS
          </Text>

          <Text
            style={
              styles.statusTitle
            }
          >
            {pretty(
              order.order_status
            )}
          </Text>

          <Text
            style={
              styles.statusMessage
            }
          >
            {statusMessage(
              order.order_status
            )}
          </Text>

          <Text
            style={
              styles.placedDate
            }
          >
            Placed on{" "}
            {dateTime(
              order.created_at
            )}
          </Text>

          <View
            style={
              styles.badgeRow
            }
          >
            <View
              style={
                styles.badge
              }
            >
              <Text
                style={
                  styles.badgeText
                }
              >
                Payment{" "}
                {pretty(
                  order.payment_status
                )}
              </Text>
            </View>

            <View
              style={
                styles.badge
              }
            >
              <Text
                style={
                  styles.badgeText
                }
              >
                {pretty(
                  order.payment_method
                )}
              </Text>
            </View>
          </View>
        </View>


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


        <Section title="Order Progress">
          {timeline.map(
            (
              step,
              index
            ) => (
              <View
                key={
                  step.label
                }
                style={
                  styles.timelineRow
                }
              >
                <View
                  style={
                    styles.timelineVisual
                  }
                >
                  <View
                    style={[
                      styles.timelineDot,

                      (
                        step.complete ||
                        step.active
                      ) &&
                        styles.timelineDotActive,

                      step.cancelled &&
                        styles.timelineDotCancelled,
                    ]}
                  />

                  {index <
                  timeline.length -
                    1 ? (
                    <View
                      style={[
                        styles.timelineLine,

                        step.complete &&
                          styles.timelineLineActive,
                      ]}
                    />
                  ) : null}
                </View>

                <View
                  style={
                    styles.timelineContent
                  }
                >
                  <Text
                    style={[
                      styles.timelineLabel,

                      (
                        step.active ||
                        step.complete
                      ) &&
                        styles.timelineLabelActive,

                      step.cancelled &&
                        styles.timelineCancelledText,
                    ]}
                  >
                    {step.label}
                  </Text>

                  <Text
                    style={
                      styles.timelineDate
                    }
                  >
                    {date(
                      step.date
                    )}
                  </Text>
                </View>
              </View>
            )
          )}
        </Section>


        {showTracking ? (
          <Section title="Order Tracking">
            <Row
              label="Tracking Number"
              value={
                order.tracking_number ||
                "Tracking will be updated soon"
              }
            />

            {order.estimated_delivery_date ? (
              <Row
                label="Estimated Delivery"
                value={date(
                  order.estimated_delivery_date
                )}
              />
            ) : null}

            {order.tracking_url ? (
              <Pressable
                style={
                  styles.secondaryButton
                }
                onPress={() =>
                  void openTracking()
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Track Shipment
                </Text>
              </Pressable>
            ) : null}
          </Section>
        ) : null}


        <Section
          title={`Order Items · ${totalQuantity} item(s)`}
        >
          {items.map(item => (
            <Pressable
              key={item.id}
              style={
                styles.itemCard
              }
              onPress={() =>
                router.push({
                  pathname:
                    "/product/[id]" as any,

                  params: {
                    id:
                      String(
                        item.product_id
                      ),
                  },
                })
              }
            >
              <View
                style={
                  styles.itemInfo
                }
              >
                <Text
                  style={
                    styles.itemName
                  }
                  numberOfLines={2}
                >
                  {item.product_name ||
                    "Product"}
                </Text>

                <Text
                  style={
                    styles.itemMeta
                  }
                >
                  Price:{" "}
                  {money(
                    item.price
                  )}
                </Text>

                <Text
                  style={
                    styles.itemMeta
                  }
                >
                  Quantity:{" "}
                  {Number(
                    item.quantity ||
                      0
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.itemTotal
                }
              >
                <Text
                  style={
                    styles.itemTotalValue
                  }
                >
                  {money(
                    item.subtotal
                  )}
                </Text>

                <Text
                  style={
                    styles.itemTotalLabel
                  }
                >
                  Item subtotal
                </Text>
              </View>
            </Pressable>
          ))}
        </Section>


        <Section title="Order Summary">
          <Row
            label="Products subtotal"
            value={money(
              order.subtotalAmount
            )}
          />

          <Row
            label="Coupon discount"
            value={`- ${money(
              order.discount_amount
            )}`}
          />

          <Row
            label={membership}
            value={`- ${money(
              order.loyalty_discount_amount
            )}`}
          />

          <Row
            label={`Reward points (${Number(
              order.reward_points_redeemed ||
                0
            ).toLocaleString()})`}
            value={`- ${money(
              order.reward_points_discount_amount
            )}`}
          />

          <Row
            label="Delivery"
            value={money(
              order.delivery_charges
            )}
          />

          <View
            style={
              styles.totalDivider
            }
          />

          <Row
            label="Grand Total"
            value={money(
              order.grand_total
            )}
            strong
          />
        </Section>


        <Section title="Payment Information">
          <Row
            label="Method"
            value={pretty(
              order.payment_method
            )}
          />

          <Row
            label="Status"
            value={pretty(
              order.payment_status
            )}
          />

          {order.transaction_id ? (
            <Row
              label="Transaction Reference"
              value={
                order.transaction_id
              }
            />
          ) : null}

          {order.coupon_code ? (
            <Row
              label="Coupon"
              value={
                order.coupon_code
              }
            />
          ) : null}
        </Section>


        <Section title="Delivery Information">
          <Text
            style={
              styles.shippingName
            }
          >
            {order.full_name ||
              "Customer"}
          </Text>

          <Text
            style={
              styles.shippingText
            }
          >
            {[
              order.shipping_address,
              order.city,
              order.postal_code,
            ]
              .filter(Boolean)
              .join(", ")}
          </Text>

          <Text
            style={
              styles.shippingText
            }
          >
            {[
              order.phone,
              order.email,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>

          {order.order_notes ? (
            <View
              style={
                styles.notesBox
              }
            >
              <Text
                style={
                  styles.notesLabel
                }
              >
                ORDER NOTES
              </Text>

              <Text
                style={
                  styles.notesText
                }
              >
                {
                  order.order_notes
                }
              </Text>
            </View>
          ) : null}
        </Section>


        <View
          style={
            styles.actions
          }
        >
          <Pressable
            style={[
              styles.primaryButton,
              reordering &&
                styles.disabledButton,
            ]}
            disabled={reordering}
            onPress={() =>
              void reorder()
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              {reordering
                ? "Adding Items..."
                : "Reorder"}
            </Text>
          </Pressable>

          {canCancel ? (
            <Pressable
              style={[
                styles.cancelButton,
                cancelling &&
                  styles.disabledButton,
              ]}
              disabled={
                cancelling
              }
              onPress={
                confirmCancel
              }
            >
              <Text
                style={
                  styles.cancelButtonText
                }
              >
                {cancelling
                  ? "Cancelling..."
                  : "Cancel Order"}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={
              styles.secondaryButton
            }
            onPress={() =>
              router.push(
                "/orders" as any
              )
            }
          >
            <Text
              style={
                styles.secondaryButtonText
              }
            >
              Back to My Orders
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
    },

    page: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      padding: 24,
      backgroundColor:
        colors.background,
    },

    loadingText: {
      marginTop: 12,
      color: "#6d756f",
      fontSize: 11,
    },

    errorTitle: {
      color: "#29352d",
      fontSize: 20,
      fontWeight: "900",
    },

    errorDescription: {
      marginTop: 7,
      marginBottom: 18,
      color: "#747d77",
      fontSize: 11,
      textAlign: "center",
    },

    header: {
      minHeight: 66,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor:
        colors.primary,
    },

    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "rgba(255,255,255,0.12)",
    },

    backText: {
      color: "#ffffff",
      fontSize: 30,
      lineHeight: 32,
    },

    eyebrow: {
      color: "#cfe4d5",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.3,
    },

    heading: {
      marginTop: 1,
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "900",
    },

    headerSpacer: {
      width: 38,
    },

    content: {
      padding: 14,
      paddingBottom: 36,
    },

    statusCard: {
      padding: 16,
      borderRadius: 15,
      backgroundColor:
        colors.primary,
    },

    statusLabel: {
      color: "#bad7c2",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.1,
    },

    statusTitle: {
      marginTop: 4,
      color: "#ffffff",
      fontSize: 22,
      fontWeight: "900",
    },

    statusMessage: {
      marginTop: 4,
      color: "#e4eee7",
      fontSize: 10,
      lineHeight: 15,
    },

    placedDate: {
      marginTop: 9,
      color: "#bfd3c5",
      fontSize: 9,
    },

    badgeRow: {
      marginTop: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },

    badge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor:
        "rgba(255,255,255,0.13)",
    },

    badgeText: {
      color: "#ffffff",
      fontSize: 8,
      fontWeight: "900",
    },

    messageBox: {
      marginTop: 10,
      padding: 10,
      borderRadius: 9,
      backgroundColor:
        "#eef7f0",
      borderWidth: 1,
      borderColor: "#cfe3d3",
    },

    messageText: {
      color: "#365f40",
      fontSize: 10,
      lineHeight: 15,
    },

    section: {
      marginTop: 11,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#e1e6e2",
      backgroundColor:
        "#ffffff",
    },

    sectionTitle: {
      marginBottom: 11,
      color: "#26342b",
      fontSize: 13,
      fontWeight: "900",
    },

    row: {
      paddingVertical: 7,
      flexDirection: "row",
      justifyContent:
        "space-between",
      gap: 14,
    },

    rowLabel: {
      flex: 1,
      color: "#747d77",
      fontSize: 9,
    },

    rowValue: {
      maxWidth: "55%",
      color: "#354139",
      fontSize: 9,
      fontWeight: "800",
      textAlign: "right",
    },

    rowStrong: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },

    timelineRow: {
      minHeight: 55,
      flexDirection: "row",
    },

    timelineVisual: {
      width: 28,
      alignItems: "center",
    },

    timelineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: "#ccd3ce",
      backgroundColor:
        "#ffffff",
    },

    timelineDotActive: {
      borderColor:
        colors.primary,
      backgroundColor:
        colors.primary,
    },

    timelineDotCancelled: {
      borderColor: "#a84747",
      backgroundColor:
        "#a84747",
    },

    timelineLine: {
      width: 2,
      flex: 1,
      marginVertical: 3,
      backgroundColor:
        "#e0e5e1",
    },

    timelineLineActive: {
      backgroundColor:
        colors.primary,
    },

    timelineContent: {
      flex: 1,
      paddingBottom: 12,
    },

    timelineLabel: {
      color: "#818983",
      fontSize: 10,
      fontWeight: "800",
    },

    timelineLabelActive: {
      color: "#26372c",
    },

    timelineCancelledText: {
      color: "#a84747",
    },

    timelineDate: {
      marginTop: 2,
      color: "#9aa19c",
      fontSize: 8,
    },

    itemCard: {
      paddingVertical: 11,
      flexDirection: "row",
      justifyContent:
        "space-between",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor:
        "#edf0ed",
    },

    itemInfo: {
      flex: 1,
    },

    itemName: {
      color: "#2b382f",
      fontSize: 11,
      fontWeight: "900",
    },

    itemMeta: {
      marginTop: 3,
      color: "#79817b",
      fontSize: 9,
    },

    itemTotal: {
      alignItems: "flex-end",
      justifyContent:
        "center",
    },

    itemTotalValue: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
    },

    itemTotalLabel: {
      marginTop: 2,
      color: "#969c98",
      fontSize: 7,
    },

    totalDivider: {
      height: 1,
      marginVertical: 5,
      backgroundColor:
        "#e7ebe8",
    },

    shippingName: {
      color: "#2b392f",
      fontSize: 12,
      fontWeight: "900",
    },

    shippingText: {
      marginTop: 5,
      color: "#6f7872",
      fontSize: 9,
      lineHeight: 14,
    },

    notesBox: {
      marginTop: 12,
      padding: 10,
      borderRadius: 9,
      backgroundColor:
        "#f6f8f6",
    },

    notesLabel: {
      color: "#7b837d",
      fontSize: 7,
      fontWeight: "900",
      letterSpacing: 0.8,
    },

    notesText: {
      marginTop: 4,
      color: "#3e4942",
      fontSize: 9,
      lineHeight: 14,
    },

    actions: {
      marginTop: 12,
      gap: 8,
    },

    primaryButton: {
      minHeight: 46,
      paddingHorizontal: 18,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primary,
    },

    primaryButtonText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "900",
    },

    secondaryButton: {
      minHeight: 44,
      marginTop: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor:
        colors.primary,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#ffffff",
    },

    secondaryButtonText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
    },

    cancelButton: {
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#c15b5b",
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#fffafa",
    },

    cancelButtonText: {
      color: "#a53e3e",
      fontSize: 10,
      fontWeight: "900",
    },

    disabledButton: {
      opacity: 0.55,
    },
  });
