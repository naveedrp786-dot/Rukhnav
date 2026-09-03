import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
} from "expo-router";

import {
  SymbolView,
} from "expo-symbols";

import {
  getGuestCart,
  clearGuestCart,
  type GuestCartItem,
} from "../cart/guestCart";

import {
  getProductById,
} from "../api/products";

import type {
  Product,
} from "../types/product";

import {
  placeGuestOrder,
  type GuestOrderPayload,
} from "../api/guestOrders";

import {
  saveGuestOrderAccess,
} from "../guest/guestOrders";

import {
  ApiError,
} from "../api/client";

type PaymentMethod =
  GuestOrderPayload["payment_method"];

type AppIconName =
  | "back"
  | "shield"
  | "bag"
  | "flash"
  | "location"
  | "card"
  | "cash"
  | "phone"
  | "bank"
  | "radio-on"
  | "radio-off"
  | "check"
  | "lock";

const SYMBOL_NAMES: Record<
  AppIconName,
  string
> = {
  back: "arrow.left",
  shield: "checkmark.shield.fill",
  bag: "bag",
  flash: "bolt",
  location: "location",
  card: "creditcard",
  cash: "banknote",
  phone: "iphone",
  bank: "building.columns",
  "radio-on": "largecircle.fill.circle",
  "radio-off": "circle",
  check: "checkmark",
  lock: "lock",
};

function AppIcon({
  name,
  size = 20,
  color = "#123d2d",
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  return (
    <SymbolView
      name={
        SYMBOL_NAMES[name] as any
      }
      size={size}
      tintColor={color}
    />
  );
}

type CheckoutItem = {
  product: Product;
  quantity: number;
  subtotal: number;
};

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  description: string;
  icon: AppIconName;
}[] = [
  {
    value: "cash_on_delivery",
    label: "Cash on Delivery",
    description:
      "Pay when your RUKHNAV order arrives.",
    icon: "cash",
  },
  {
    value: "easypaisa",
    label: "Easypaisa",
    description:
      "Pay through your Easypaisa account.",
    icon: "phone",
  },
  {
    value: "jazzcash",
    label: "JazzCash",
    description:
      "Pay through your JazzCash account.",
    icon: "phone",
  },
  {
    value: "bank_transfer",
    label: "Bank Transfer",
    description:
      "Transfer payment through your bank.",
    icon: "bank",
  },
];

function money(
  value: number
) {
  return `Rs. ${Number(value || 0)
    .toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
}

export default function GuestCheckoutScreen() {
  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [items, setItems] =
    useState<CheckoutItem[]>([]);

  const [fullName, setFullName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [city, setCity] =
    useState("");

  const [postalCode, setPostalCode] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>(
    "cash_on_delivery"
  );

  const [
    paymentPhone,
    setPaymentPhone,
  ] = useState("");

  const [
    transactionId,
    setTransactionId,
  ] = useState("");

  const [
    acceptTerms,
    setAcceptTerms,
  ] = useState(false);

  const [
    acceptPrivacy,
    setAcceptPrivacy,
  ] = useState(false);

  const loadCheckout =
    useCallback(async () => {
      setLoading(true);

      try {
        const guestItems =
          await getGuestCart();

        if (
          guestItems.length === 0
        ) {
          setItems([]);
          return;
        }

        const resolved =
          await Promise.all(
            guestItems.map(
              async (
                item: GuestCartItem
              ) => {
                const product =
                  await getProductById(
                    item.product_id
                  );

                const stock =
                  Math.max(
                    0,
                    Number(
                      product.stock_quantity ||
                        0
                    )
                  );

                if (
                  stock <= 0
                ) {
                  return null;
                }

                const quantity =
                  Math.min(
                    Math.max(
                      1,
                      item.quantity
                    ),
                    stock
                  );

                const price =
                  Number(
                    product.selling_price ||
                      0
                  );

                return {
                  product,
                  quantity,
                  subtotal:
                    price * quantity,
                } satisfies CheckoutItem;
              }
            )
          );

        setItems(
          resolved.filter(
            (
              item
            ): item is CheckoutItem =>
              item !== null
          )
        );
      } catch (error) {
        Alert.alert(
          "Unable to Load Checkout",
          error instanceof Error
            ? error.message
            : "Unable to load your guest checkout."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (total, item) =>
            total +
            item.subtotal,
          0
        ),
      [items]
    );

  /*
   * Display estimate only.
   * Backend recalculates this
   * authoritatively when placing
   * the guest order.
   */
  const deliveryCharges =
    subtotal >= 2500
      ? 0
      : subtotal > 0
        ? 250
        : 0;

  const estimatedTotal =
    subtotal +
    deliveryCharges;

  const manualPayment =
    paymentMethod !==
    "cash_on_delivery";

  const walletPayment =
    paymentMethod ===
      "easypaisa" ||
    paymentMethod ===
      "jazzcash";

  function validate() {
    if (!fullName.trim()) {
      Alert.alert(
        "Full Name Required",
        "Enter your full name."
      );
      return false;
    }

    if (!phone.trim()) {
      Alert.alert(
        "Mobile Number Required",
        "Enter your mobile number."
      );
      return false;
    }

    if (!address.trim()) {
      Alert.alert(
        "Delivery Address Required",
        "Enter your delivery address."
      );
      return false;
    }

    if (!city.trim()) {
      Alert.alert(
        "City Required",
        "Enter your city."
      );
      return false;
    }

    if (items.length === 0) {
      Alert.alert(
        "Cart Empty",
        "Add at least one product before placing your order."
      );
      return false;
    }

    if (
      walletPayment &&
      !paymentPhone.trim()
    ) {
      Alert.alert(
        "Payment Mobile Required",
        `Enter the mobile number used for ${
          paymentMethod ===
          "easypaisa"
            ? "Easypaisa"
            : "JazzCash"
        }.`
      );
      return false;
    }

    if (
      manualPayment &&
      !transactionId.trim()
    ) {
      Alert.alert(
        "Transaction ID Required",
        "Enter your payment transaction/reference ID."
      );
      return false;
    }

    if (!acceptTerms) {
      Alert.alert(
        "Terms Required",
        "Please accept the Terms & Conditions to continue."
      );
      return false;
    }

    if (!acceptPrivacy) {
      Alert.alert(
        "Privacy Consent Required",
        "Please accept the Privacy Policy to continue."
      );
      return false;
    }

    return true;
  }

  async function handlePlaceOrder() {
    if (
      submitting ||
      !validate()
    ) {
      return;
    }

    setSubmitting(true);

    try {
      /*
       * Read the persisted cart again
       * immediately before checkout so
       * the submitted IDs/quantities are
       * not derived from display state.
       */
      const currentCart =
        await getGuestCart();

      if (
        currentCart.length === 0
      ) {
        throw new Error(
          "Your cart is empty."
        );
      }

      const response =
        await placeGuestOrder({
          full_name:
            fullName.trim(),

          phone:
            phone.trim(),

          email:
            email.trim() ||
            null,

          shipping_address:
            address.trim(),

          city:
            city.trim(),

          postal_code:
            postalCode.trim() ||
            null,

          order_notes:
            notes.trim() ||
            null,

          payment_method:
            paymentMethod,

          payment_phone:
            manualPayment
              ? (
                  paymentPhone.trim() ||
                  null
                )
              : null,

          transaction_id:
            manualPayment
              ? (
                  transactionId.trim() ||
                  null
                )
              : null,

          accept_terms: true,
          accept_privacy: true,

          items:
            currentCart.map(
              item => ({
                product_id:
                  item.product_id,

                quantity:
                  item.quantity,
              })
            ),

          attribution: {
            order_source:
              "mobile_app",
          },
        });

      const order =
        response.order;

      const token =
        response.guestAccessToken;

      if (
        !order?.order_number ||
        !token
      ) {
        throw new Error(
          "Order confirmation details were not returned."
        );
      }

      /*
       * Save access before clearing
       * the cart. The token is never
       * placed in route parameters.
       */
      await saveGuestOrderAccess(
        order.order_number,
        token
      );

      /*
       * Backend has confirmed the order
       * and secure access is stored.
       * Only now clear the guest cart.
       */
      await clearGuestCart();

      router.replace({
        pathname:
          "/guest-order-success" as any,

        params: {
          order:
            order.order_number,
        },
      });
    } catch (error) {
      Alert.alert(
        "Unable to Place Order",
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unable to place your order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingPage}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={styles.loadingText}
        >
          Preparing secure checkout...
        </Text>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView
        style={styles.emptyPage}
      >
        <View
          style={styles.emptyIcon}
        >
          <AppIcon
            name="bag"
            size={34}
            color="#123d2d"
          />
        </View>

        <Text
          style={styles.emptyTitle}
        >
          Your cart is empty
        </Text>

        <Text
          style={styles.emptyText}
        >
          Add products before starting
          guest checkout.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.replace("/shop")
          }
        >
          <Text
            style={styles.primaryButtonText}
          >
            Continue Shopping
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.page}
      edges={[
        "top",
        "left",
        "right",
      ]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View
          style={styles.header}
        >
          <Pressable
            style={styles.headerButton}
            onPress={() =>
              router.back()
            }
          >
            <AppIcon
              name="back"
              size={22}
              color="#ffffff"
            />
          </Pressable>

          <View
            style={styles.headerTextWrap}
          >
            <Text
              style={styles.headerTitle}
            >
              Guest Checkout
            </Text>

            <Text
              style={styles.headerSubtitle}
            >
              Secure RUKHNAV checkout
            </Text>
          </View>

          <View
            style={styles.secureBadge}
          >
            <AppIcon
              name="shield"
              size={17}
              color="#d8b968"
            />
          </View>
        </View>

        <ScrollView
          style={styles.flex}
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
              <AppIcon
                name="flash"
                size={21}
                color="#123d2d"
              />
            </View>

            <View
              style={styles.introCopy}
            >
              <Text
                style={styles.introTitle}
              >
                Fast guest checkout
              </Text>

              <Text
                style={styles.introText}
              >
                No account required. Enter
                your delivery details and
                place your order securely.
              </Text>
            </View>
          </View>

          <Section
            title="Delivery Information"
            icon="location"
          >
            <Field
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              autoCapitalize="words"
            />

            <Field
              label="Mobile Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="03XX XXXXXXX"
              keyboardType="phone-pad"
            />

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Optional email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Field
              label="Delivery Address *"
              value={address}
              onChangeText={setAddress}
              placeholder="House, street, area"
              multiline
            />

            <View
              style={styles.row}
            >
              <View
                style={styles.rowItem}
              >
                <Field
                  label="City *"
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  autoCapitalize="words"
                />
              </View>

              <View
                style={styles.rowItem}
              >
                <Field
                  label="Postal Code"
                  value={postalCode}
                  onChangeText={
                    setPostalCode
                  }
                  placeholder="Optional"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Field
              label="Order Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Delivery instructions (optional)"
              multiline
            />
          </Section>

          <Section
            title="Payment Method"
            icon="card"
          >
            {PAYMENT_METHODS.map(
              method => {
                const selected =
                  paymentMethod ===
                  method.value;

                return (
                  <Pressable
                    key={method.value}
                    style={[
                      styles.paymentCard,
                      selected &&
                        styles.paymentCardSelected,
                    ]}
                    onPress={() => {
                      setPaymentMethod(
                        method.value
                      );

                      if (
                        method.value ===
                        "cash_on_delivery"
                      ) {
                        setPaymentPhone(
                          ""
                        );
                        setTransactionId(
                          ""
                        );
                      }
                    }}
                  >
                    <View
                      style={[
                        styles.paymentIcon,
                        selected &&
                          styles.paymentIconSelected,
                      ]}
                    >
                      <AppIcon
                        name={method.icon}
                        size={21}
                        color={
                          selected
                            ? "#ffffff"
                            : "#123d2d"
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.paymentCopy
                      }
                    >
                      <Text
                        style={
                          styles.paymentTitle
                        }
                      >
                        {method.label}
                      </Text>

                      <Text
                        style={
                          styles.paymentDescription
                        }
                      >
                        {method.description}
                      </Text>
                    </View>

                    <AppIcon
                      name={
                        selected
                          ? "radio-on"
                          : "radio-off"
                      }
                      size={21}
                      color={
                        selected
                          ? "#123d2d"
                          : "#87948d"
                      }
                    />
                  </Pressable>
                );
              }
            )}

            {manualPayment && (
              <View
                style={styles.manualBox}
              >
                {walletPayment && (
                  <Field
                    label="Payment Mobile *"
                    value={paymentPhone}
                    onChangeText={
                      setPaymentPhone
                    }
                    placeholder="Mobile used for payment"
                    keyboardType="phone-pad"
                  />
                )}

                <Field
                  label="Transaction / Reference ID *"
                  value={transactionId}
                  onChangeText={
                    setTransactionId
                  }
                  placeholder="Enter transaction reference"
                  autoCapitalize="characters"
                />

                <Text
                  style={styles.paymentNote}
                >
                  Complete the payment using
                  the official RUKHNAV payment
                  instructions, then enter the
                  transaction reference above.
                </Text>
              </View>
            )}
          </Section>

          <Section
            title="Order Summary"
            icon="card"
          >
            {items.map(item => (
              <View
                key={item.product.id}
                style={styles.summaryItem}
              >
                <View
                  style={styles.summaryQty}
                >
                  <Text
                    style={
                      styles.summaryQtyText
                    }
                  >
                    {item.quantity}×
                  </Text>
                </View>

                <View
                  style={styles.summaryCopy}
                >
                  <Text
                    style={styles.summaryName}
                    numberOfLines={2}
                  >
                    {
                      item.product
                        .product_name
                    }
                  </Text>

                  <Text
                    style={styles.summaryPrice}
                  >
                    {money(
                      Number(
                        item.product
                          .selling_price ||
                          0
                      )
                    )}
                  </Text>
                </View>

                <Text
                  style={styles.summaryTotal}
                >
                  {money(item.subtotal)}
                </Text>
              </View>
            ))}

            <View
              style={styles.divider}
            />

            <SummaryRow
              label="Subtotal"
              value={money(subtotal)}
            />

            <SummaryRow
              label="Delivery"
              value={
                deliveryCharges === 0
                  ? "FREE"
                  : money(
                      deliveryCharges
                    )
              }
            />

            {subtotal < 2500 && (
              <Text
                style={styles.deliveryHint}
              >
                Add{" "}
                {money(
                  Math.max(
                    0,
                    2500 - subtotal
                  )
                )}{" "}
                more for free delivery.
              </Text>
            )}

            <View
              style={styles.totalDivider}
            />

            <SummaryRow
              label="Estimated Total"
              value={money(
                estimatedTotal
              )}
              total
            />

            <Text
              style={styles.serverNote}
            >
              Final price, stock and delivery
              are verified securely by RUKHNAV
              when your order is placed.
            </Text>
          </Section>

          <View
            style={styles.consentCard}
          >
            <ConsentRow
              checked={acceptTerms}
              onPress={() =>
                setAcceptTerms(
                  value => !value
                )
              }
              text="I accept the Terms & Conditions."
            />

            <View
              style={styles.consentDivider}
            />

            <ConsentRow
              checked={acceptPrivacy}
              onPress={() =>
                setAcceptPrivacy(
                  value => !value
                )
              }
              text="I accept the Privacy Policy."
            />
          </View>

          <View
            style={styles.protectionRow}
          >
            <AppIcon
              name="lock"
              size={15}
              color="#527062"
            />

            <Text
              style={styles.protectionText}
            >
              Your order is submitted securely
              to RUKHNAV.
            </Text>
          </View>

          <View
            style={styles.bottomSpace}
          />
        </ScrollView>

        <View
          style={styles.checkoutBar}
        >
          <View>
            <Text
              style={styles.checkoutLabel}
            >
              Estimated Total
            </Text>

            <Text
              style={styles.checkoutTotal}
            >
              {money(estimatedTotal)}
            </Text>
          </View>

          <Pressable
            style={[
              styles.placeButton,
              submitting &&
                styles.buttonDisabled,
            ]}
            disabled={submitting}
            onPress={handlePlaceOrder}
          >
            {submitting ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <>
                <AppIcon
                  name="shield"
                  size={19}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.placeButtonText
                  }
                >
                  Place Order
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: AppIconName;
  children:
    React.ReactNode;
}) {
  return (
    <View
      style={styles.section}
    >
      <View
        style={styles.sectionHeader}
      >
        <View
          style={styles.sectionIcon}
        >
          <AppIcon
            name={icon}
            size={18}
            color="#123d2d"
          />
        </View>

        <Text
          style={styles.sectionTitle}
        >
          {title}
        </Text>
      </View>

      {children}
    </View>
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
        placeholderTextColor="#8c9791"
        style={[
          styles.input,
          props.multiline &&
            styles.inputMultiline,
          props.style,
        ]}
      />
    </View>
  );
}

function SummaryRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <View
      style={styles.summaryRow}
    >
      <Text
        style={[
          styles.summaryRowLabel,
          total &&
            styles.summaryRowLabelTotal,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryRowValue,
          total &&
            styles.summaryRowValueTotal,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ConsentRow({
  checked,
  onPress,
  text,
}: {
  checked: boolean;
  onPress: () => void;
  text: string;
}) {
  return (
    <Pressable
      style={styles.consentRow}
      onPress={onPress}
    >
      <View
        style={[
          styles.checkbox,
          checked &&
            styles.checkboxChecked,
        ]}
      >
        {checked && (
          <AppIcon
            name="check"
            size={15}
            color="#ffffff"
          />
        )}
      </View>

      <Text
        style={styles.consentText}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    flex: {
      flex: 1,
    },

    page: {
      flex: 1,
      backgroundColor: "#f4f6f4",
    },

    loadingPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: "#f4f6f4",
    },

    loadingText: {
      fontSize: 14,
      color: "#627069",
    },

    emptyPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      backgroundColor: "#f4f6f4",
    },

    emptyIcon: {
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#e5eee9",
      marginBottom: 18,
    },

    emptyTitle: {
      fontSize: 23,
      fontWeight: "800",
      color: "#17382d",
      marginBottom: 8,
    },

    emptyText: {
      textAlign: "center",
      fontSize: 14,
      lineHeight: 21,
      color: "#6b7771",
      marginBottom: 22,
    },

    primaryButton: {
      minHeight: 48,
      paddingHorizontal: 24,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#123d2d",
    },

    primaryButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "800",
    },

    header: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: "#123d2d",
    },

    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "rgba(255,255,255,0.10)",
    },

    headerTextWrap: {
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
      fontSize: 11,
      color: "#d2dfd9",
    },

    secureBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "rgba(255,255,255,0.10)",
    },

    content: {
      padding: 14,
      gap: 14,
    },

    introCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#dce7e1",
      backgroundColor: "#ffffff",
    },

    introIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#edf4f0",
      marginRight: 11,
    },

    introCopy: {
      flex: 1,
    },

    introTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: "#17382d",
    },

    introText: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 16,
      color: "#68766f",
    },

    section: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#e0e6e2",
      padding: 15,
      backgroundColor: "#ffffff",
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },

    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#edf4f0",
      marginRight: 10,
    },

    sectionTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: "#17382d",
    },

    field: {
      marginBottom: 13,
    },

    fieldLabel: {
      marginBottom: 6,
      fontSize: 12,
      fontWeight: "700",
      color: "#42544b",
    },

    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: "#d9e1dd",
      borderRadius: 12,
      paddingHorizontal: 13,
      backgroundColor: "#fafbfa",
      color: "#17251f",
      fontSize: 14,
    },

    inputMultiline: {
      minHeight: 88,
      paddingTop: 12,
      textAlignVertical: "top",
    },

    row: {
      flexDirection: "row",
      gap: 10,
    },

    rowItem: {
      flex: 1,
    },

    paymentCard: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      padding: 11,
      borderWidth: 1,
      borderColor: "#dce3df",
      borderRadius: 14,
      marginBottom: 9,
      backgroundColor: "#fbfcfb",
    },

    paymentCardSelected: {
      borderColor: "#123d2d",
      backgroundColor: "#f0f6f3",
    },

    paymentIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
      backgroundColor: "#e9f0ec",
    },

    paymentIconSelected: {
      backgroundColor: "#123d2d",
    },

    paymentCopy: {
      flex: 1,
      paddingRight: 8,
    },

    paymentTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: "#203b30",
    },

    paymentDescription: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 15,
      color: "#718078",
    },

    manualBox: {
      marginTop: 5,
      padding: 12,
      borderRadius: 14,
      backgroundColor: "#f5f8f6",
    },

    paymentNote: {
      fontSize: 11,
      lineHeight: 17,
      color: "#64736b",
    },

    summaryItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#edf0ee",
    },

    summaryQty: {
      minWidth: 36,
      height: 32,
      paddingHorizontal: 7,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#edf4f0",
      marginRight: 9,
    },

    summaryQtyText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#123d2d",
    },

    summaryCopy: {
      flex: 1,
      paddingRight: 8,
    },

    summaryName: {
      fontSize: 13,
      fontWeight: "700",
      color: "#253b32",
    },

    summaryPrice: {
      marginTop: 3,
      fontSize: 11,
      color: "#7a8680",
    },

    summaryTotal: {
      fontSize: 13,
      fontWeight: "800",
      color: "#17382d",
    },

    divider: {
      height: 1,
      backgroundColor: "#e8ece9",
      marginVertical: 11,
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 5,
    },

    summaryRowLabel: {
      fontSize: 13,
      color: "#637069",
    },

    summaryRowValue: {
      fontSize: 13,
      fontWeight: "700",
      color: "#2a4036",
    },

    summaryRowLabelTotal: {
      fontSize: 15,
      fontWeight: "900",
      color: "#17382d",
    },

    summaryRowValueTotal: {
      fontSize: 18,
      fontWeight: "900",
      color: "#123d2d",
    },

    deliveryHint: {
      marginTop: 5,
      fontSize: 11,
      lineHeight: 16,
      color: "#65746c",
    },

    totalDivider: {
      height: 1,
      backgroundColor: "#dfe5e1",
      marginVertical: 9,
    },

    serverNote: {
      marginTop: 9,
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor: "#edf0ee",
      fontSize: 10,
      lineHeight: 15,
      color: "#78837e",
    },

    consentCard: {
      borderWidth: 1,
      borderColor: "#dfe6e2",
      borderRadius: 16,
      paddingHorizontal: 13,
      backgroundColor: "#ffffff",
    },

    consentRow: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
    },

    checkbox: {
      width: 23,
      height: 23,
      borderWidth: 2,
      borderColor: "#91a099",
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    checkboxChecked: {
      borderColor: "#123d2d",
      backgroundColor: "#123d2d",
    },

    consentText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: "#43554c",
    },

    consentDivider: {
      height: 1,
      backgroundColor: "#edf0ee",
    },

    protectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },

    protectionText: {
      fontSize: 10,
      color: "#66756d",
    },

    bottomSpace: {
      height: 12,
    },

    checkoutBar: {
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: "#dfe5e1",
      backgroundColor: "#ffffff",
    },

    checkoutLabel: {
      fontSize: 10,
      color: "#738078",
    },

    checkoutTotal: {
      marginTop: 2,
      fontSize: 19,
      fontWeight: "900",
      color: "#17382d",
    },

    placeButton: {
      minWidth: 156,
      minHeight: 50,
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      paddingHorizontal: 17,
      backgroundColor: "#123d2d",
    },

    placeButtonText: {
      fontSize: 14,
      fontWeight: "900",
      color: "#ffffff",
    },

    buttonDisabled: {
      opacity: 0.6,
    },
  });
