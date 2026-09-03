import {
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  ApiError,
} from "../api/client";

import {
  trackPublicOrder,
  type GuestOrderItem,
  type PublicTrackedOrder,
} from "../api/guestOrders";

type IconName =
  | "back"
  | "search"
  | "bag"
  | "card"
  | "location"
  | "truck"
  | "check"
  | "clock"
  | "shop"
  | "link";

const SYMBOLS: Record<
  IconName,
  string
> = {
  back: "arrow.left",
  search: "magnifyingglass",
  bag: "bag",
  card: "creditcard",
  location: "location",
  truck: "truck.box",
  check: "checkmark.circle.fill",
  clock: "clock",
  shop: "storefront",
  link: "link",
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
  return `Rs. ${Number(
    value || 0
  ).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function label(
  value: unknown,
  fallback = "Pending"
) {
  const raw =
    String(value || "")
      .trim();

  if (!raw) {
    return fallback;
  }

  return raw
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}

function imageUrl(
  value:
    | string
    | null
    | undefined
) {
  const raw =
    String(value || "")
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

function dateLabel(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
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

export default function TrackOrderScreen() {
  const params =
    useLocalSearchParams<{
      order?: string | string[];
    }>();

  const initialOrder =
    Array.isArray(params.order)
      ? params.order[0]
      : params.order;

  const [orderNumber, setOrderNumber] =
    useState(
      String(
        initialOrder || ""
      ).toUpperCase()
    );

  const [identifier, setIdentifier] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [order, setOrder] =
    useState<PublicTrackedOrder | null>(
      null
    );

  const [items, setItems] =
    useState<GuestOrderItem[]>([]);

  async function handleTrack() {
    const cleanOrder =
      orderNumber
        .trim()
        .toUpperCase();

    const cleanIdentifier =
      identifier.trim();

    if (!cleanOrder) {
      setMessage(
        "Enter your order number."
      );
      return;
    }

    if (!cleanIdentifier) {
      setMessage(
        "Enter the email address or mobile number used when placing the order."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setOrder(null);
    setItems([]);

    try {
      const response =
        await trackPublicOrder({
          order_number:
            cleanOrder,

          identifier:
            cleanIdentifier,
        });

      if (!response.order) {
        throw new Error(
          "Order details were not returned."
        );
      }

      setOrder(
        response.order
      );

      setItems(
        Array.isArray(
          response.items
        )
          ? response.items
          : []
      );
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to track your order."
      );
    } finally {
      setLoading(false);
    }
  }

  const cancelled =
    String(
      order?.order_status || ""
    )
      .toLowerCase() ===
    "cancelled";

  const delivered =
    Boolean(
      order?.delivered_at
    ) ||
    String(
      order?.order_status || ""
    )
      .toLowerCase() ===
      "delivered";

  const shipped =
    delivered ||
    Boolean(
      order?.shipped_at
    ) ||
    String(
      order?.order_status || ""
    )
      .toLowerCase() ===
      "shipped";

  const confirmed =
    shipped ||
    Boolean(
      order?.confirmed_at
    ) ||
    [
      "confirmed",
      "processing",
    ].includes(
      String(
        order?.order_status ||
          ""
      ).toLowerCase()
    );

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
        <Pressable
          style={styles.backButton}
          onPress={() =>
            router.back()
          }
        >
          <Icon
            name="back"
            size={21}
            color="#ffffff"
          />
        </Pressable>

        <View
          style={styles.headerCopy}
        >
          <Text
            style={styles.headerTitle}
          >
            Track Order
          </Text>

          <Text
            style={styles.headerSubtitle}
          >
            RUKHNAV order tracking
          </Text>
        </View>

        <Icon
          name="truck"
          size={23}
          color="#d8b968"
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.introCard}
        >
          <View
            style={styles.introIcon}
          >
            <Icon
              name="search"
              size={23}
            />
          </View>

          <View
            style={styles.introCopy}
          >
            <Text
              style={styles.introTitle}
            >
              Find your order
            </Text>

            <Text
              style={styles.introText}
            >
              Enter your order number
              and the original email or
              mobile number used at
              checkout.
            </Text>
          </View>
        </View>

        <View
          style={styles.formCard}
        >
          <Field
            label="Order Number"
            value={orderNumber}
            onChangeText={
              value =>
                setOrderNumber(
                  value.toUpperCase()
                )
            }
            placeholder="ORD-XXXXXXXX-XXXXXX"
            autoCapitalize="characters"
          />

          <Field
            label="Email or Mobile Number"
            value={identifier}
            onChangeText={
              setIdentifier
            }
            placeholder="Email address or mobile"
            autoCapitalize="none"
          />

          {!!message && (
            <View
              style={styles.messageBox}
            >
              <Text
                style={styles.messageText}
              >
                {message}
              </Text>
            </View>
          )}

          <Pressable
            style={[
              styles.trackButton,
              loading &&
                styles.disabled,
            ]}
            disabled={loading}
            onPress={handleTrack}
          >
            {loading ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <>
                <Icon
                  name="search"
                  size={18}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.trackButtonText
                  }
                >
                  Track Order
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {order && (
          <>
            <View
              style={styles.orderCard}
            >
              <View
                style={
                  styles.orderHeading
                }
              >
                <View>
                  <Text
                    style={
                      styles.orderLabel
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
                    {
                      order.order_number
                    }
                  </Text>
                </View>

                <View
                  style={
                    styles.statusBadge
                  }
                >
                  <Text
                    style={
                      styles.statusBadgeText
                    }
                  >
                    {label(
                      order.order_status
                    )}
                  </Text>
                </View>
              </View>

              <View
                style={styles.summaryGrid}
              >
                <MiniCard
                  label="Total"
                  value={money(
                    order.grand_total
                  )}
                  icon="card"
                />

                <MiniCard
                  label="Payment"
                  value={label(
                    order.payment_status
                  )}
                  icon="card"
                />

                <MiniCard
                  label="City"
                  value={
                    order.city || "—"
                  }
                  icon="location"
                />

                <MiniCard
                  label="Delivery"
                  value={
                    Number(
                      order.delivery_charges ||
                        0
                    ) > 0
                      ? money(
                          order.delivery_charges
                        )
                      : "FREE"
                  }
                  icon="truck"
                />
              </View>
            </View>

            <View
              style={styles.section}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Order Progress
              </Text>

              {cancelled ? (
                <View
                  style={
                    styles.cancelledBox
                  }
                >
                  <Text
                    style={
                      styles.cancelledTitle
                    }
                  >
                    Order Cancelled
                  </Text>

                  {!!order.cancelled_at && (
                    <Text
                      style={
                        styles.cancelledText
                      }
                    >
                      {dateLabel(
                        order.cancelled_at
                      )}
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  <TimelineStep
                    title="Order Placed"
                    date={dateLabel(
                      order.created_at
                    )}
                    complete
                  />

                  <TimelineStep
                    title="Confirmed"
                    date={dateLabel(
                      order.confirmed_at
                    )}
                    complete={
                      confirmed
                    }
                  />

                  <TimelineStep
                    title="Shipped"
                    date={dateLabel(
                      order.shipped_at
                    )}
                    complete={
                      shipped
                    }
                  />

                  <TimelineStep
                    title="Delivered"
                    date={dateLabel(
                      order.delivered_at
                    )}
                    complete={
                      delivered
                    }
                    last
                  />
                </>
              )}
            </View>

            {(
              order.tracking_number ||
              order.tracking_url ||
              order.estimated_delivery_date
            ) && (
              <View
                style={
                  styles.trackingCard
                }
              >
                <View
                  style={
                    styles.trackingIcon
                  }
                >
                  <Icon
                    name="truck"
                    size={25}
                  />
                </View>

                <View
                  style={
                    styles.trackingCopy
                  }
                >
                  <Text
                    style={
                      styles.trackingTitle
                    }
                  >
                    Shipment Tracking
                  </Text>

                  {!!order.tracking_number && (
                    <Text
                      style={
                        styles.trackingText
                      }
                    >
                      Tracking number:{" "}
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
                      {dateLabel(
                        order.estimated_delivery_date
                      )}
                    </Text>
                  )}

                  {!!order.tracking_url && (
                    <Pressable
                      style={
                        styles.trackingLink
                      }
                      onPress={() =>
                        Linking.openURL(
                          String(
                            order.tracking_url
                          )
                        )
                      }
                    >
                      <Icon
                        name="link"
                        size={15}
                      />

                      <Text
                        style={
                          styles.trackingLinkText
                        }
                      >
                        Open courier tracking
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            <View
              style={styles.section}
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Order Items
              </Text>

              {items.map(
                (
                  item,
                  index
                ) => {
                  const uri =
                    imageUrl(
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
                        {uri ? (
                          <Image
                            source={{
                              uri,
                            }}
                            style={
                              styles.itemImageActual
                            }
                            resizeMode="cover"
                          />
                        ) : (
                          <Icon
                            name="bag"
                            size={22}
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
                          numberOfLines={
                            2
                          }
                        >
                          {item.product_name ||
                            "RUKHNAV Product"}
                        </Text>

                        <Text
                          style={
                            styles.itemMeta
                          }
                        >
                          {
                            item.quantity
                          }{" "}
                          ×{" "}
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
              )}
            </View>

            <Pressable
              style={
                styles.shopButton
              }
              onPress={() =>
                router.push("/shop")
              }
            >
              <Icon
                name="shop"
                size={18}
                color="#ffffff"
              />

              <Text
                style={
                  styles.shopButtonText
                }
              >
                Continue Shopping
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & React.ComponentProps<
  typeof TextInput
>) {
  return (
    <View
      style={styles.field}
    >
      <Text
        style={styles.fieldLabel}
      >
        {label}
      </Text>

      <TextInput
        {...props}
        placeholderTextColor="#8d9892"
        style={styles.input}
      />
    </View>
  );
}

function MiniCard({
  label: title,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: IconName;
}) {
  return (
    <View
      style={styles.miniCard}
    >
      <Icon
        name={icon}
        size={17}
      />

      <Text
        style={styles.miniLabel}
      >
        {title}
      </Text>

      <Text
        style={styles.miniValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function TimelineStep({
  title,
  date,
  complete,
  last = false,
}: {
  title: string;
  date: string | null;
  complete: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={styles.timelineRow}
    >
      <View
        style={styles.timelineRail}
      >
        <View
          style={[
            styles.timelineDot,
            complete &&
              styles.timelineDotComplete,
          ]}
        >
          {complete && (
            <Icon
              name="check"
              size={17}
              color="#ffffff"
            />
          )}
        </View>

        {!last && (
          <View
            style={[
              styles.timelineLine,
              complete &&
                styles.timelineLineComplete,
            ]}
          />
        )}
      </View>

      <View
        style={styles.timelineCopy}
      >
        <Text
          style={[
            styles.timelineTitle,
            complete &&
              styles.timelineTitleComplete,
          ]}
        >
          {title}
        </Text>

        {!!date && (
          <Text
            style={
              styles.timelineDate
            }
          >
            {date}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: "#f4f6f4",
    },

    header: {
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
      backgroundColor: "#123d2d",
    },

    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor:
        "rgba(255,255,255,0.10)",
    },

    headerCopy: {
      flex: 1,
      marginHorizontal: 12,
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: "#ffffff",
    },

    headerSubtitle: {
      marginTop: 2,
      fontSize: 10,
      color: "#d5e0db",
    },

    content: {
      padding: 14,
      paddingBottom: 34,
      gap: 14,
    },

    introCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "#dce5e0",
      backgroundColor: "#ffffff",
    },

    introIcon: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
      marginRight: 11,
      backgroundColor: "#edf4f0",
    },

    introCopy: {
      flex: 1,
    },

    introTitle: {
      fontSize: 15,
      fontWeight: "900",
      color: "#17382d",
    },

    introText: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 16,
      color: "#6d7972",
    },

    formCard: {
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#e0e6e2",
      backgroundColor: "#ffffff",
    },

    field: {
      marginBottom: 13,
    },

    fieldLabel: {
      marginBottom: 6,
      fontSize: 12,
      fontWeight: "800",
      color: "#42544b",
    },

    input: {
      minHeight: 49,
      borderWidth: 1,
      borderColor: "#d9e1dd",
      borderRadius: 12,
      paddingHorizontal: 13,
      fontSize: 14,
      color: "#17251f",
      backgroundColor: "#fafbfa",
    },

    messageBox: {
      marginBottom: 12,
      padding: 11,
      borderRadius: 11,
      backgroundColor: "#fff4ef",
    },

    messageText: {
      fontSize: 11,
      lineHeight: 17,
      color: "#8b4234",
    },

    trackButton: {
      minHeight: 50,
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: "#123d2d",
    },

    trackButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: "#ffffff",
    },

    disabled: {
      opacity: 0.6,
    },

    orderCard: {
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#dfe6e2",
      backgroundColor: "#ffffff",
    },

    orderHeading: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      alignItems: "center",
    },

    orderLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
      color: "#77837c",
    },

    orderNumber: {
      marginTop: 3,
      fontSize: 15,
      fontWeight: "900",
      color: "#17382d",
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: "#edf4f0",
    },

    statusBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#123d2d",
    },

    summaryGrid: {
      marginTop: 15,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },

    miniCard: {
      width: "48%",
      minHeight: 91,
      padding: 11,
      borderRadius: 13,
      backgroundColor: "#f6f8f7",
    },

    miniLabel: {
      marginTop: 7,
      fontSize: 9,
      color: "#79857e",
    },

    miniValue: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: "800",
      color: "#294238",
    },

    section: {
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#e0e6e2",
      backgroundColor: "#ffffff",
    },

    sectionTitle: {
      marginBottom: 14,
      fontSize: 15,
      fontWeight: "900",
      color: "#17382d",
    },

    timelineRow: {
      minHeight: 68,
      flexDirection: "row",
    },

    timelineRail: {
      width: 32,
      alignItems: "center",
    },

    timelineDot: {
      width: 23,
      height: 23,
      borderWidth: 2,
      borderColor: "#b7c2bc",
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#ffffff",
    },

    timelineDotComplete: {
      borderColor: "#123d2d",
      backgroundColor: "#123d2d",
    },

    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: "#d9e0dc",
    },

    timelineLineComplete: {
      backgroundColor: "#123d2d",
    },

    timelineCopy: {
      flex: 1,
      paddingLeft: 9,
      paddingBottom: 15,
    },

    timelineTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: "#89948e",
    },

    timelineTitleComplete: {
      color: "#294238",
    },

    timelineDate: {
      marginTop: 4,
      fontSize: 10,
      color: "#7b8780",
    },

    cancelledBox: {
      padding: 14,
      borderRadius: 13,
      backgroundColor: "#fff0ed",
    },

    cancelledTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: "#9a4034",
    },

    cancelledText: {
      marginTop: 4,
      fontSize: 11,
      color: "#9a5a51",
    },

    trackingCard: {
      flexDirection: "row",
      padding: 14,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "#d6e4dc",
      backgroundColor: "#edf5f1",
    },

    trackingIcon: {
      width: 45,
      height: 45,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 13,
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

    trackingLink: {
      marginTop: 9,
      flexDirection: "row",
      gap: 5,
      alignItems: "center",
    },

    trackingLinkText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#123d2d",
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
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: 12,
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

    shopButton: {
      minHeight: 51,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      backgroundColor: "#123d2d",
    },

    shopButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: "#ffffff",
    },
  });
