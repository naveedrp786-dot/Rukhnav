import {
  ActivityIndicator,
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
  getMyOrders,
  type CustomerOrder,
} from "../api/orders";

import {
  colors,
} from "../theme/rukhnav";


function money(
  value?: number | string
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


function dateTime(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
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


function statusStyle(
  status?: string | null
) {
  switch (
    String(status || "")
      .toLowerCase()
  ) {
    case "delivered":
      return styles.badgeSuccess;

    case "cancelled":
      return styles.badgeDanger;

    case "shipped":
    case "confirmed":
    case "processing":
      return styles.badgeActive;

    default:
      return styles.badgePending;
  }
}


export default function OrdersScreen() {
  const [orders, setOrders] =
    useState<CustomerOrder[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");


  const loadOrders =
    useCallback(
      async (
        refresh = false
      ) => {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        try {
          setMessage("");

          const data =
            await getMyOrders();

          setOrders(
            data.orders
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load your orders."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );


  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);


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
          Loading your orders...
        </Text>
      </SafeAreaView>
    );
  }


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
            ORDER HISTORY
          </Text>

          <Text
            style={
              styles.heading
            }
          >
            My Orders
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
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void loadOrders(
                true
              )
            }
          />
        }
      >
        <View
          style={
            styles.introCard
          }
        >
          <Text
            style={
              styles.introTitle
            }
          >
            Track, review and
            manage your orders.
          </Text>

          <Text
            style={
              styles.introText
            }
          >
            View order status,
            payment details,
            delivery progress and
            products from your
            RUKHNAV purchases.
          </Text>
        </View>


        {message ? (
          <View
            style={
              styles.errorBox
            }
          >
            <Text
              style={
                styles.errorText
              }
            >
              {message}
            </Text>
          </View>
        ) : null}


        {!orders.length ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyIcon
              }
            >
              🛍️
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No orders found
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Your completed
              purchases will appear
              here.
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
          orders.map(order => {
            const status =
              order.order_status ||
              "Pending";

            const payment =
              order.payment_status ||
              "Pending";

            return (
              <Pressable
                key={order.id}
                style={
                  styles.orderCard
                }
                onPress={() =>
                  router.push({
                    pathname:
                      "/order/[id]" as any,

                    params: {
                      id:
                        String(
                          order.id
                        ),
                    },
                  })
                }
              >
                <View
                  style={
                    styles.orderTop
                  }
                >
                  <View
                    style={
                      styles.flex
                    }
                  >
                    <Text
                      style={
                        styles.orderNumber
                      }
                    >
                      {order.order_number ||
                        `Order #${order.id}`}
                    </Text>

                    <Text
                      style={
                        styles.orderDate
                      }
                    >
                      {dateTime(
                        order.created_at
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.chevron
                    }
                  >
                    ›
                  </Text>
                </View>


                <View
                  style={
                    styles.badgeRow
                  }
                >
                  <View
                    style={[
                      styles.badge,
                      statusStyle(
                        status
                      ),
                    ]}
                  >
                    <Text
                      style={
                        styles.badgeText
                      }
                    >
                      {pretty(
                        status
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.badge,
                      statusStyle(
                        payment
                      ),
                    ]}
                  >
                    <Text
                      style={
                        styles.badgeText
                      }
                    >
                      Payment{" "}
                      {pretty(
                        payment
                      )}
                    </Text>
                  </View>
                </View>


                <View
                  style={
                    styles.orderInfo
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.infoLabel
                      }
                    >
                      Items
                    </Text>

                    <Text
                      style={
                        styles.infoValue
                      }
                    >
                      {Number(
                        order.total_quantity ||
                          0
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.infoRight
                    }
                  >
                    <Text
                      style={
                        styles.infoLabel
                      }
                    >
                      Total
                    </Text>

                    <Text
                      style={
                        styles.total
                      }
                    >
                      {money(
                        order.grand_total
                      )}
                    </Text>
                  </View>
                </View>


                {order.tracking_number ? (
                  <View
                    style={
                      styles.trackingHint
                    }
                  >
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
                  </View>
                ) : null}


                <View
                  style={
                    styles.viewRow
                  }
                >
                  <Text
                    style={
                      styles.viewText
                    }
                  >
                    View Details
                  </Text>

                  <Text
                    style={
                      styles.viewArrow
                    }
                  >
                    →
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
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
      color: "#68716b",
      fontSize: 12,
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
      fontSize: 19,
      fontWeight: "900",
    },

    headerSpacer: {
      width: 38,
    },

    content: {
      padding: 14,
      paddingBottom: 30,
    },

    introCard: {
      padding: 15,
      marginBottom: 12,
      borderRadius: 14,
      backgroundColor:
        colors.primary,
    },

    introTitle: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "900",
    },

    introText: {
      marginTop: 4,
      color: "#e2eee5",
      fontSize: 10,
      lineHeight: 15,
    },

    errorBox: {
      padding: 11,
      marginBottom: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#e0b5b5",
      backgroundColor:
        "#fff2f2",
    },

    errorText: {
      color: "#8d3535",
      fontSize: 11,
    },

    emptyCard: {
      padding: 28,
      borderRadius: 14,
      alignItems: "center",
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e4e9e5",
    },

    emptyIcon: {
      fontSize: 34,
    },

    emptyTitle: {
      marginTop: 10,
      color: "#26332b",
      fontSize: 18,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 5,
      color: "#778079",
      fontSize: 11,
      textAlign: "center",
    },

    shopButton: {
      minHeight: 44,
      marginTop: 16,
      paddingHorizontal: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.primary,
    },

    shopButtonText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "900",
    },

    orderCard: {
      marginBottom: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#e1e6e2",
      backgroundColor:
        "#ffffff",
    },

    orderTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    orderNumber: {
      color: "#223128",
      fontSize: 13,
      fontWeight: "900",
    },

    orderDate: {
      marginTop: 3,
      color: "#7c847f",
      fontSize: 9,
    },

    chevron: {
      color: colors.primary,
      fontSize: 27,
      fontWeight: "700",
    },

    badgeRow: {
      marginTop: 11,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },

    badge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 20,
    },

    badgePending: {
      backgroundColor:
        "#fff3d7",
    },

    badgeActive: {
      backgroundColor:
        "#e7f1ff",
    },

    badgeSuccess: {
      backgroundColor:
        "#e4f5e8",
    },

    badgeDanger: {
      backgroundColor:
        "#fde7e7",
    },

    badgeText: {
      color: "#39443d",
      fontSize: 8,
      fontWeight: "900",
    },

    orderInfo: {
      marginTop: 13,
      paddingTop: 11,
      flexDirection: "row",
      justifyContent:
        "space-between",
      borderTopWidth: 1,
      borderTopColor:
        "#edf0ed",
    },

    infoLabel: {
      color: "#858c87",
      fontSize: 8,
      fontWeight: "700",
    },

    infoValue: {
      marginTop: 2,
      color: "#344139",
      fontSize: 12,
      fontWeight: "900",
    },

    infoRight: {
      alignItems: "flex-end",
    },

    total: {
      marginTop: 2,
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },

    trackingHint: {
      marginTop: 10,
      padding: 8,
      borderRadius: 8,
      backgroundColor:
        "#f1f7f2",
    },

    trackingText: {
      color: "#3c6246",
      fontSize: 9,
      fontWeight: "700",
    },

    viewRow: {
      marginTop: 12,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    viewText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
    },

    viewArrow: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "900",
    },
  });
