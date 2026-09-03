import {
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
  colors,
} from "../theme/rukhnav";


export default function OrderSuccessScreen() {
  const params =
    useLocalSearchParams<{
      id?: string;
      order?: string;
    }>();

  const orderNumber =
    typeof params.order === "string"
      ? params.order
      : "";

  return (
    <SafeAreaView
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>
            ✓
          </Text>
        </View>

        <Text style={styles.eyebrow}>
          ORDER CONFIRMED
        </Text>

        <Text style={styles.title}>
          Thank you for your order
        </Text>

        <Text style={styles.subtitle}>
          Your RUKHNAV order has been
          received successfully.
        </Text>

        {orderNumber ? (
          <View
            style={styles.orderCard}
          >
            <Text
              style={
                styles.orderLabel
              }
            >
              Order Number
            </Text>

            <Text
              selectable
              style={
                styles.orderNumber
              }
            >
              {orderNumber}
            </Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text
            style={styles.infoTitle}
          >
            What happens next?
          </Text>

          <Text style={styles.infoText}>
            We will process your order
            and keep you updated as its
            status changes.
          </Text>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.replace("/")
          }
        >
          <Text
            style={
              styles.primaryText
            }
          >
            Continue Shopping
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.secondaryButton
          }
          onPress={() =>
            router.replace(
              "/account"
            )
          }
        >
          <Text
            style={
              styles.secondaryText
            }
          >
            Go to My Account
          </Text>
        </Pressable>
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

    content: {
      flexGrow: 1,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
    },

    iconCircle: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.primary,
      marginBottom: 18,
    },

    icon: {
      color: "#ffffff",
      fontSize: 38,
      fontWeight: "900",
    },

    eyebrow: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.6,
    },

    title: {
      marginTop: 7,
      color: "#18251d",
      fontSize: 25,
      fontWeight: "900",
      textAlign: "center",
    },

    subtitle: {
      maxWidth: 310,
      marginTop: 8,
      color: "#6d756f",
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },

    orderCard: {
      width: "100%",
      marginTop: 24,
      padding: 17,
      borderRadius: 14,
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#dfe6e1",
    },

    orderLabel: {
      color: "#7b837e",
      fontSize: 10,
      fontWeight: "700",
    },

    orderNumber: {
      marginTop: 5,
      color: colors.primary,
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center",
    },

    infoCard: {
      width: "100%",
      marginTop: 12,
      padding: 15,
      borderRadius: 14,
      backgroundColor: "#f1f7f2",
    },

    infoTitle: {
      color: "#24422d",
      fontSize: 13,
      fontWeight: "900",
    },

    infoText: {
      marginTop: 5,
      color: "#657068",
      fontSize: 11,
      lineHeight: 17,
    },

    primaryButton: {
      width: "100%",
      minHeight: 52,
      marginTop: 22,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        colors.primary,
    },

    primaryText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900",
    },

    secondaryButton: {
      width: "100%",
      minHeight: 48,
      marginTop: 9,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor:
        colors.primary,
      backgroundColor: "#ffffff",
    },

    secondaryText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
    },
  });
