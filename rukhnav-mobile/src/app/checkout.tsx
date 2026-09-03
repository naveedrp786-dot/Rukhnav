import {
  ActivityIndicator,
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
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCart,
  type CartItem,
} from "../api/cart";

import {
  applyCouponPreview,
} from "../api/coupons";

import {
  getMyLoyaltySummary,
  type LoyaltySummary,
} from "../api/loyalty";

import {
  extractPlacedOrder,
  placeOrder,
  type PaymentMethod,
} from "../api/orders";

import {
  getCustomerProfile,
  type CustomerProfile,
} from "../api/profile";

import {
  colors,
} from "../theme/rukhnav";


const STANDARD_DELIVERY_CHARGE =
  250;


const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  title: string;
  description: string;
}> = [
  {
    value:
      "cash_on_delivery",

    title:
      "Cash on Delivery",

    description:
      "Pay the final order amount to the courier when your parcel is delivered.",
  },

  {
    value:
      "easypaisa",

    title:
      "Easypaisa",

    description:
      "Transfer using Easypaisa, then enter your payment phone and transaction reference for verification.",
  },

  {
    value:
      "jazzcash",

    title:
      "JazzCash",

    description:
      "Transfer using JazzCash, then enter your payment phone and transaction reference for verification.",
  },

  {
    value:
      "bank_transfer",

    title:
      "Bank Transfer",

    description:
      "Transfer to the RUKHNAV bank account and enter the transaction reference for verification.",
  },
];


function money(
  value: string | number
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


function integerText(
  value: number
) {
  return new Intl.NumberFormat(
    "en-PK"
  ).format(value);
}


export default function CheckoutScreen() {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [profile, setProfile] =
    useState<CustomerProfile | null>(
      null
    );

  const [loyalty, setLoyalty] =
    useState<LoyaltySummary | null>(
      null
    );


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
  ] =
    useState<PaymentMethod>(
      "cash_on_delivery"
    );

  const [
    paymentPhone,
    setPaymentPhone,
  ] =
    useState("");

  const [
    transactionId,
    setTransactionId,
  ] =
    useState("");


  const [couponCode, setCouponCode] =
    useState("");

  const [
    appliedCouponCode,
    setAppliedCouponCode,
  ] =
    useState<string | null>(null);

  const [
    couponDiscount,
    setCouponDiscount,
  ] =
    useState(0);

  const [
    applyingCoupon,
    setApplyingCoupon,
  ] =
    useState(false);


  const [
    rewardPointsInput,
    setRewardPointsInput,
  ] =
    useState("0");


  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<
      "info" | "success" | "error"
    >("info");


  useEffect(() => {
    void initialise();
  }, []);


  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (sum, item) => {
            const price =
              Number(
                item.price ??
                  item.selling_price ??
                  0
              );

            return (
              sum +
              price *
                Number(
                  item.quantity || 0
                )
            );
          },
          0
        ),
      [items]
    );


  const loyaltyPercentage =
    Math.max(
      0,
      Number(
        loyalty?.benefits
          ?.discountPercentage || 0
      )
    );


  const loyaltyDiscount =
    Number(
      (
        subtotal *
        loyaltyPercentage /
        100
      ).toFixed(2)
    );


  const availableRewardPoints =
    Math.max(
      0,
      Math.floor(
        Number(
          loyalty?.availablePoints ||
            0
        )
      )
    );


  const freeDelivery =
    Boolean(
      loyalty?.benefits
        ?.freeDeliveryEnabled
    );


  const deliveryCharge =
    freeDelivery
      ? 0
      : STANDARD_DELIVERY_CHARGE;


  const merchandiseRemaining =
    Math.max(
      0,
      subtotal -
        couponDiscount -
        loyaltyDiscount
    );


  const maximumUsefulPoints =
    Math.max(
      0,
      Math.floor(
        merchandiseRemaining
      )
    );


  const parsedRewardPoints =
    Number.parseInt(
      rewardPointsInput || "0",
      10
    );


  const rewardPointsToRedeem =
    Math.min(
      availableRewardPoints,
      maximumUsefulPoints,
      Number.isInteger(
        parsedRewardPoints
      ) &&
        parsedRewardPoints > 0
        ? parsedRewardPoints
        : 0
    );


  const rewardDiscount =
    Number(
      rewardPointsToRedeem.toFixed(
        2
      )
    );


  const grandTotal =
    Math.max(
      0,
      subtotal +
        deliveryCharge -
        couponDiscount -
        loyaltyDiscount -
        rewardDiscount
    );


  async function initialise() {
    try {
      setMessage("");

      const results =
        await Promise.allSettled([
          getCart(),
          getCustomerProfile(),
          getMyLoyaltySummary(),
        ]);

      if (
        results[0].status !==
        "fulfilled"
      ) {
        throw results[0].reason;
      }

      const cartResult =
        results[0].value;

      setItems(
        cartResult.cart || []
      );

      if (
        results[1].status ===
        "fulfilled"
      ) {
        const customer =
          results[1].value.profile;

        if (customer) {
          setProfile(customer);

          setFullName(
            customer.full_name || ""
          );

          setPhone(
            customer.phone || ""
          );

          setEmail(
            customer.email || ""
          );

          setAddress(
            customer.address || ""
          );

          setCity(
            customer.city || ""
          );

          setPostalCode(
            customer.postal_code || ""
          );
        }
      }

      if (
        results[2].status ===
        "fulfilled"
      ) {
        setLoyalty(
          results[2].value
        );
      }
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare checkout.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }


  function showMessage(
    text: string,
    type:
      | "info"
      | "success"
      | "error" = "info"
  ) {
    setMessage(text);
    setMessageType(type);
  }


  function updateRewardPoints(
    value: string
  ) {
    const digits =
      value.replace(
        /[^0-9]/g,
        ""
      );

    if (!digits) {
      setRewardPointsInput("0");
      return;
    }

    const requested =
      Number.parseInt(
        digits,
        10
      );

    const safeValue =
      Math.min(
        Number.isFinite(requested)
          ? requested
          : 0,
        availableRewardPoints,
        maximumUsefulPoints
      );

    setRewardPointsInput(
      String(safeValue)
    );
  }


  function useMaximumRewards() {
    const maximum =
      Math.min(
        availableRewardPoints,
        maximumUsefulPoints
      );

    setRewardPointsInput(
      String(maximum)
    );
  }


  function clearRewards() {
    setRewardPointsInput("0");
  }


  async function applyCoupon() {
    const code =
      couponCode
        .trim()
        .toUpperCase();

    if (!code) {
      setAppliedCouponCode(null);
      setCouponDiscount(0);

      showMessage(
        "Enter a coupon code.",
        "error"
      );

      return;
    }

    if (
      !Number.isFinite(subtotal) ||
      subtotal <= 0
    ) {
      setAppliedCouponCode(null);
      setCouponDiscount(0);

      showMessage(
        "Your cart does not contain an amount eligible for a coupon.",
        "error"
      );

      return;
    }

    setApplyingCoupon(true);
    setCouponDiscount(0);
    setAppliedCouponCode(null);

    try {
      const data =
        await applyCouponPreview(
          code,
          Number(
            subtotal.toFixed(2)
          ),
          profile?.id || null
        );

      const discount =
        Number(
          data.calculation
            ?.discountAmount || 0
        );

      if (
        !Number.isFinite(discount) ||
        discount < 0
      ) {
        throw new Error(
          "The coupon service returned an invalid discount."
        );
      }

      const safeDiscount =
        Number(
          Math.min(
            subtotal,
            discount
          ).toFixed(2)
        );

      const finalCode =
        data.coupon?.code ||
        code;

      setCouponCode(finalCode);

      setAppliedCouponCode(
        finalCode
      );

      setCouponDiscount(
        safeDiscount
      );

      showMessage(
        data.message ||
          `Coupon ${finalCode} applied successfully. You saved ${money(
            safeDiscount
          )}.`,
        "success"
      );
    } catch (error) {
      setAppliedCouponCode(null);
      setCouponDiscount(0);

      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to apply this coupon.",
        "error"
      );
    } finally {
      setApplyingCoupon(false);
    }
  }


  function selectPayment(
    method: PaymentMethod
  ) {
    setPaymentMethod(method);

    if (
      method ===
      "cash_on_delivery"
    ) {
      setPaymentPhone("");
      setTransactionId("");
    }

    setMessage("");
  }


  async function submitOrder() {
    if (submitting) {
      return;
    }

    const cleanName =
      fullName.trim();

    const cleanPhone =
      phone.trim();

    const cleanEmail =
      email.trim();

    const cleanAddress =
      address.trim();

    const cleanCity =
      city.trim();

    const cleanPaymentPhone =
      paymentPhone.trim();

    const cleanTransactionId =
      transactionId.trim();


    if (
      !cleanName ||
      !cleanPhone ||
      !cleanAddress ||
      !cleanCity
    ) {
      showMessage(
        "Enter your full name, mobile number, city and delivery address.",
        "error"
      );

      return;
    }


    if (!cleanEmail) {
      showMessage(
        "Enter your email address.",
        "error"
      );

      return;
    }


    if (items.length === 0) {
      showMessage(
        "Your cart is empty.",
        "error"
      );

      return;
    }


    const manual =
      paymentMethod !==
      "cash_on_delivery";


    if (
      manual &&
      !cleanTransactionId
    ) {
      showMessage(
        "Enter the transaction reference for the selected payment method.",
        "error"
      );

      return;
    }


    if (
      (
        paymentMethod ===
          "easypaisa" ||
        paymentMethod ===
          "jazzcash"
      ) &&
      !cleanPaymentPhone
    ) {
      showMessage(
        "Enter the payment phone number for the selected payment method.",
        "error"
      );

      return;
    }


    setSubmitting(true);

    showMessage(
      "Placing your order securely...",
      "info"
    );


    try {
      const response =
        await placeOrder({
          full_name:
            cleanName,

          phone:
            cleanPhone,

          email:
            cleanEmail,

          shipping_address:
            cleanAddress,

          delivery_address:
            cleanAddress,

          city:
            cleanCity,

          postal_code:
            postalCode.trim() ||
            null,

          order_notes:
            notes.trim() ||
            null,

          payment_method:
            paymentMethod,

          payment_phone:
            cleanPaymentPhone ||
            null,

          transaction_id:
            cleanTransactionId ||
            null,

          coupon_code:
            appliedCouponCode,

          delivery_option:
            "standard",

          delivery_charges:
            deliveryCharge,

          reward_points_to_redeem:
            rewardPointsToRedeem,
        });


      const placed =
        extractPlacedOrder(
          response
        );


      if (
        !placed.orderId &&
        !placed.orderNumber
      ) {
        throw new Error(
          "Order confirmation details were not returned."
        );
      }


      router.replace({
        pathname:
          "/order-success" as any,

        params: {
          id:
            String(
              placed.orderId || ""
            ),

          order:
            String(
              placed.orderNumber || ""
            ),
        },
      });
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to place your order.",
        "error"
      );

      setSubmitting(false);
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
          Preparing secure checkout...
        </Text>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView
      style={styles.page}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
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

          <View style={styles.topTitle}>
            <Text
              style={styles.topEyebrow}
            >
              RUKHNAV
            </Text>

            <Text
              style={styles.topHeading}
            >
              Secure Checkout
            </Text>
          </View>

          <View
            style={styles.topSpacer}
          />
        </View>


        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <View
            style={styles.secureStrip}
          >
            <View style={styles.flex}>
              <Text
                style={
                  styles.secureEyebrow
                }
              >
                FAST & SECURE
              </Text>

              <Text
                style={
                  styles.secureTitle
                }
              >
                Complete your order
              </Text>

              <Text
                style={
                  styles.secureText
                }
              >
                Delivery, payment and
                rewards in one secure
                checkout.
              </Text>
            </View>

            <Text
              style={styles.lock}
            >
              🔒
            </Text>
          </View>


          {message ? (
            <View
              style={[
                styles.messageBox,

                messageType ===
                  "success" &&
                  styles.messageSuccess,

                messageType ===
                  "error" &&
                  styles.messageError,
              ]}
            >
              <Text
                style={[
                  styles.messageText,

                  messageType ===
                    "success" &&
                    styles.messageSuccessText,

                  messageType ===
                    "error" &&
                    styles.messageErrorText,
                ]}
              >
                {message}
              </Text>
            </View>
          ) : null}


          <Section
            title="Delivery Information"
          >
            <Field
              label="Full Name"
              value={fullName}
              onChangeText={
                setFullName
              }
              autoCapitalize="words"
            />

            <Field
              label="Mobile Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType={
                "email-address"
              }
              autoCapitalize="none"
            />

            <Field
              label="City"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />

            <Field
              label="Postal Code"
              value={postalCode}
              onChangeText={
                setPostalCode
              }
            />

            <Text
              style={styles.fieldLabel}
            >
              Delivery Address
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.addressInput,
              ]}
              value={address}
              onChangeText={setAddress}
              multiline
              textAlignVertical="top"
            />

            <Text
              style={styles.fieldLabel}
            >
              Order Notes
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.notesInput,
              ]}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholder={
                "Optional delivery instructions"
              }
              placeholderTextColor={
                "#8b918c"
              }
            />
          </Section>


          <Section
            title="Delivery"
          >
            <View
              style={
                styles.deliveryOption
              }
            >
              <View>
                <Text
                  style={
                    styles.optionTitle
                  }
                >
                  Standard Delivery
                </Text>

                <Text
                  style={
                    styles.optionText
                  }
                >
                  Nationwide RUKHNAV
                  delivery
                </Text>
              </View>

              <Text
                style={
                  styles.deliveryPrice
                }
              >
                {deliveryCharge > 0
                  ? money(
                      deliveryCharge
                    )
                  : "FREE"}
              </Text>
            </View>

            {freeDelivery ? (
              <View
                style={
                  styles.freeDelivery
                }
              >
                <Text
                  style={
                    styles.freeDeliveryText
                  }
                >
                  ✓ Free delivery is
                  included with your{" "}
                  {loyalty
                    ?.membershipLevel ||
                    "membership"}{" "}
                  benefits.
                </Text>
              </View>
            ) : null}
          </Section>


          <Section
            title="Payment Method"
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
                      styles.paymentOption,

                      selected &&
                        styles.paymentSelected,
                    ]}
                    onPress={() =>
                      selectPayment(
                        method.value
                      )
                    }
                  >
                    <View
                      style={[
                        styles.radio,

                        selected &&
                          styles.radioSelected,
                      ]}
                    >
                      {selected ? (
                        <View
                          style={
                            styles.radioDot
                          }
                        />
                      ) : null}
                    </View>

                    <View
                      style={styles.flex}
                    >
                      <Text
                        style={
                          styles.paymentTitle
                        }
                      >
                        {method.title}
                      </Text>

                      <Text
                        style={
                          styles.paymentText
                        }
                      >
                        {
                          method.description
                        }
                      </Text>
                    </View>
                  </Pressable>
                );
              }
            )}


            {paymentMethod !==
            "cash_on_delivery" ? (
              <View
                style={
                  styles.manualPayment
                }
              >
                {paymentMethod !==
                "bank_transfer" ? (
                  <Field
                    label="Payment Phone"
                    value={
                      paymentPhone
                    }
                    onChangeText={
                      setPaymentPhone
                    }
                    keyboardType="phone-pad"
                  />
                ) : null}

                <Field
                  label="Transaction Reference"
                  value={
                    transactionId
                  }
                  onChangeText={
                    setTransactionId
                  }
                  autoCapitalize="characters"
                />

                <Text
                  style={
                    styles.manualNote
                  }
                >
                  Manual payments remain
                  pending until verified
                  by RUKHNAV.
                </Text>
              </View>
            ) : null}
          </Section>


          <Section
            title="Coupon"
          >
            <View
              style={styles.inlineRow}
            >
              <TextInput
                style={[
                  styles.input,
                  styles.inlineInput,
                ]}
                value={couponCode}
                onChangeText={value => {
                  setCouponCode(
                    value.toUpperCase()
                  );

                  if (
                    appliedCouponCode
                  ) {
                    setAppliedCouponCode(
                      null
                    );

                    setCouponDiscount(
                      0
                    );
                  }
                }}
                autoCapitalize="characters"
                placeholder="Coupon code"
                placeholderTextColor={
                  "#8b918c"
                }
              />

              <Pressable
                disabled={
                  applyingCoupon
                }
                style={
                  styles.smallButton
                }
                onPress={() =>
                  void applyCoupon()
                }
              >
                {applyingCoupon ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={
                      styles.smallButtonText
                    }
                  >
                    Apply
                  </Text>
                )}
              </Pressable>
            </View>

            {appliedCouponCode ? (
              <Text
                style={
                  styles.appliedText
                }
              >
                ✓ {appliedCouponCode} is
                applied.
              </Text>
            ) : null}
          </Section>


          <Section
            title="Rewards & Membership"
          >
            <View
              style={styles.loyaltyTop}
            >
              <View>
                <Text
                  style={
                    styles.loyaltyLabel
                  }
                >
                  Membership
                </Text>

                <Text
                  style={
                    styles.loyaltyValue
                  }
                >
                  {loyalty
                    ?.membershipLevel ||
                    "Bronze"}
                </Text>
              </View>

              <View
                style={
                  styles.loyaltyRight
                }
              >
                <Text
                  style={
                    styles.loyaltyLabel
                  }
                >
                  Available Points
                </Text>

                <Text
                  style={
                    styles.loyaltyValue
                  }
                >
                  {integerText(
                    availableRewardPoints
                  )}
                </Text>
              </View>
            </View>


            {loyaltyPercentage > 0 ? (
              <View
                style={
                  styles.benefitNotice
                }
              >
                <Text
                  style={
                    styles.benefitText
                  }
                >
                  Your membership gives
                  you a{" "}
                  {loyaltyPercentage}%
                  merchandise discount.
                </Text>
              </View>
            ) : null}


            <Text
              style={styles.fieldLabel}
            >
              Reward points to use
            </Text>

            <TextInput
              style={styles.input}
              value={rewardPointsInput}
              onChangeText={
                updateRewardPoints
              }
              keyboardType="number-pad"
            />

            <View
              style={
                styles.rewardButtons
              }
            >
              <Pressable
                style={
                  styles.rewardButton
                }
                onPress={
                  useMaximumRewards
                }
              >
                <Text
                  style={
                    styles.rewardButtonText
                  }
                >
                  Use Maximum
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.rewardButton
                }
                onPress={clearRewards}
              >
                <Text
                  style={
                    styles.rewardButtonText
                  }
                >
                  Clear
                </Text>
              </Pressable>
            </View>

            <Text
              style={
                styles.rewardHint
              }
            >
              Using{" "}
              {integerText(
                rewardPointsToRedeem
              )}{" "}
              points ={" "}
              {money(
                rewardDiscount
              )}{" "}
              discount.
            </Text>
          </Section>


          <Section
            title="Order Summary"
          >
            {items.map(item => {
              const price =
                Number(
                  item.price ??
                    item.selling_price ??
                    0
                );

              const lineSubtotal =
                Number(
                  item.subtotal ??
                    price *
                      Number(
                        item.quantity ||
                          0
                      )
                );

              return (
                <View
                  key={item.cart_id}
                  style={
                    styles.itemRow
                  }
                >
                  <View
                    style={styles.flex}
                  >
                    <Text
                      style={
                        styles.itemName
                      }
                      numberOfLines={2}
                    >
                      {
                        item.product_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.itemQuantity
                      }
                    >
                      Qty{" "}
                      {item.quantity}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.itemPrice
                    }
                  >
                    {money(
                      lineSubtotal
                    )}
                  </Text>
                </View>
              );
            })}

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
                deliveryCharge > 0
                  ? money(
                      deliveryCharge
                    )
                  : "Free"
              }
            />

            <SummaryRow
              label="Coupon Discount"
              value={`- ${money(
                couponDiscount
              )}`}
            />

            <SummaryRow
              label="Membership Discount"
              value={`- ${money(
                loyaltyDiscount
              )}`}
            />

            <SummaryRow
              label="Reward Discount"
              value={`- ${money(
                rewardDiscount
              )}`}
            />

            <View
              style={styles.divider}
            />

            <View
              style={styles.totalRow}
            >
              <Text
                style={
                  styles.totalLabel
                }
              >
                Estimated Total
              </Text>

              <Text
                style={
                  styles.totalAmount
                }
              >
                {money(grandTotal)}
              </Text>
            </View>

            <Text
              style={styles.totalNote}
            >
              This is a checkout
              preview. The production
              server verifies the final
              stock, coupon, membership,
              rewards and payable amount
              when the order is placed.
            </Text>
          </Section>


          <Pressable
            disabled={submitting}
            style={[
              styles.placeButton,

              submitting &&
                styles.disabledButton,
            ]}
            onPress={() =>
              void submitOrder()
            }
          >
            {submitting ? (
              <ActivityIndicator
                color="#ffffff"
              />
            ) : (
              <Text
                style={
                  styles.placeButtonText
                }
              >
                Place Order ·{" "}
                {money(grandTotal)}
              </Text>
            )}
          </Pressable>


          <Pressable
            style={
              styles.continueButton
            }
            onPress={() =>
              router.push("/shop")
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


type SectionProps = {
  title: string;
  children:
    React.ReactNode;
};


function Section({
  title,
  children,
}: SectionProps) {
  return (
    <View style={styles.card}>
      <Text
        style={styles.cardTitle}
      >
        {title}
      </Text>

      {children}
    </View>
  );
}


type FieldProps = {
  label: string;
  value: string;

  onChangeText:
    (value: string) => void;

  keyboardType?:
    | "default"
    | "email-address"
    | "phone-pad"
    | "number-pad";

  autoCapitalize?:
    | "none"
    | "sentences"
    | "words"
    | "characters";
};


function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "sentences",
}: FieldProps) {
  return (
    <>
      <Text
        style={styles.fieldLabel}
      >
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={
          autoCapitalize
        }
      />
    </>
  );
}


function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={styles.summaryRow}
    >
      <Text
        style={styles.summaryLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.summaryValue}
      >
        {value}
      </Text>
    </View>
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
      justifyContent: "center",
      backgroundColor:
        colors.background,
      padding: 24,
    },

    loadingText: {
      marginTop: 12,
      color: "#667069",
      fontSize: 13,
    },

    topBar: {
      minHeight: 62,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.primary,
    },

    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "rgba(255,255,255,0.12)",
    },

    backText: {
      color: "#ffffff",
      fontSize: 30,
      lineHeight: 32,
    },

    topTitle: {
      flex: 1,
      alignItems: "center",
    },

    topEyebrow: {
      color: "#d7eadc",
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.6,
    },

    topHeading: {
      marginTop: 1,
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "900",
    },

    topSpacer: {
      width: 38,
    },

    content: {
      padding: 14,
      paddingBottom: 30,
    },

    secureStrip: {
      padding: 14,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        colors.primary,
      marginBottom: 12,
    },

    secureEyebrow: {
      color: "#cfe5d5",
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
    },

    secureTitle: {
      marginTop: 2,
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "900",
    },

    secureText: {
      marginTop: 3,
      maxWidth: 285,
      color: "#e8f2ea",
      fontSize: 10,
      lineHeight: 14,
    },

    lock: {
      marginLeft: 10,
      fontSize: 21,
    },

    messageBox: {
      marginBottom: 12,
      padding: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#d7dcd8",
      backgroundColor:
        "#f5f7f5",
    },

    messageText: {
      color: "#4f5952",
      fontSize: 11,
      lineHeight: 16,
    },

    messageSuccess: {
      borderColor: "#a9d3b5",
      backgroundColor:
        "#eef8f1",
    },

    messageSuccessText: {
      color: "#256038",
    },

    messageError: {
      borderColor: "#e1b8b8",
      backgroundColor:
        "#fff3f3",
    },

    messageErrorText: {
      color: "#8c3434",
    },

    card: {
      marginBottom: 12,
      padding: 15,
      borderRadius: 14,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e5e9e6",
    },

    cardTitle: {
      marginBottom: 13,
      color: "#18251d",
      fontSize: 17,
      fontWeight: "900",
    },

    fieldLabel: {
      marginBottom: 6,
      color: "#354139",
      fontSize: 11,
      fontWeight: "800",
    },

    input: {
      minHeight: 46,
      marginBottom: 13,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "#d8ded9",
      borderRadius: 10,
      backgroundColor: "#fbfcfb",
      color: "#18251d",
      fontSize: 14,
    },

    addressInput: {
      minHeight: 88,
      paddingTop: 12,
    },

    notesInput: {
      minHeight: 72,
      paddingTop: 12,
      marginBottom: 0,
    },

    deliveryOption: {
      padding: 13,
      borderRadius: 11,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor:
        colors.primary,
      backgroundColor:
        "#f1f8f3",
    },

    optionTitle: {
      color: "#183b24",
      fontSize: 13,
      fontWeight: "900",
    },

    optionText: {
      marginTop: 3,
      color: "#68736c",
      fontSize: 10,
    },

    deliveryPrice: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },

    freeDelivery: {
      marginTop: 9,
      padding: 9,
      borderRadius: 9,
      backgroundColor:
        "#edf8f0",
    },

    freeDeliveryText: {
      color: "#28633a",
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "700",
    },

    paymentOption: {
      padding: 12,
      marginBottom: 8,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: "#dde2de",
      backgroundColor:
        "#fbfcfb",
    },

    paymentSelected: {
      borderWidth: 1.5,
      borderColor:
        colors.primary,
      backgroundColor:
        "#f1f8f3",
    },

    radio: {
      width: 20,
      height: 20,
      marginRight: 10,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: "#9aa49d",
      alignItems: "center",
      justifyContent: "center",
    },

    radioSelected: {
      borderColor:
        colors.primary,
    },

    radioDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        colors.primary,
    },

    paymentTitle: {
      color: "#26332b",
      fontSize: 12,
      fontWeight: "900",
    },

    paymentText: {
      marginTop: 3,
      color: "#727b75",
      fontSize: 9,
      lineHeight: 14,
    },

    manualPayment: {
      marginTop: 4,
      padding: 12,
      borderRadius: 10,
      backgroundColor:
        "#f7f8f7",
    },

    manualNote: {
      marginTop: -3,
      color: "#7b837e",
      fontSize: 9,
      lineHeight: 14,
    },

    inlineRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },

    inlineInput: {
      flex: 1,
      marginBottom: 0,
    },

    smallButton: {
      minWidth: 82,
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.primary,
    },

    smallButtonText: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "900",
    },

    appliedText: {
      marginTop: 9,
      color: "#28633a",
      fontSize: 10,
      fontWeight: "800",
    },

    loyaltyTop: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginBottom: 12,
    },

    loyaltyRight: {
      alignItems: "flex-end",
    },

    loyaltyLabel: {
      color: "#7b837e",
      fontSize: 9,
      fontWeight: "700",
    },

    loyaltyValue: {
      marginTop: 3,
      color: colors.primary,
      fontSize: 15,
      fontWeight: "900",
    },

    benefitNotice: {
      marginBottom: 12,
      padding: 9,
      borderRadius: 9,
      backgroundColor:
        "#f1f7f2",
    },

    benefitText: {
      color: "#365b40",
      fontSize: 10,
      lineHeight: 15,
    },

    rewardButtons: {
      marginTop: -4,
      flexDirection: "row",
      gap: 8,
    },

    rewardButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor:
        colors.primary,
    },

    rewardButtonText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
    },

    rewardHint: {
      marginTop: 9,
      color: "#6e7871",
      fontSize: 10,
      lineHeight: 15,
    },

    itemRow: {
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    itemName: {
      color: "#26332b",
      fontSize: 12,
      fontWeight: "800",
    },

    itemQuantity: {
      marginTop: 3,
      color: "#778079",
      fontSize: 10,
    },

    itemPrice: {
      color: "#1e442b",
      fontSize: 12,
      fontWeight: "900",
    },

    divider: {
      height: 1,
      marginVertical: 9,
      backgroundColor:
        "#e7ebe8",
    },

    summaryRow: {
      paddingVertical: 4,
      flexDirection: "row",
      justifyContent:
        "space-between",
      gap: 12,
    },

    summaryLabel: {
      color: "#6c756f",
      fontSize: 11,
    },

    summaryValue: {
      color: "#344139",
      fontSize: 11,
      fontWeight: "800",
    },

    totalRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    totalLabel: {
      color: "#26332b",
      fontSize: 13,
      fontWeight: "900",
    },

    totalAmount: {
      color: colors.primary,
      fontSize: 19,
      fontWeight: "900",
    },

    totalNote: {
      marginTop: 8,
      color: "#7a827d",
      fontSize: 9,
      lineHeight: 14,
    },

    placeButton: {
      minHeight: 52,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.primary,
    },

    disabledButton: {
      opacity: 0.65,
    },

    placeButtonText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900",
    },

    continueButton: {
      minHeight: 46,
      marginTop: 9,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor:
        colors.primary,
      backgroundColor:
        "#ffffff",
    },

    continueText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
    },
  });
