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
  useLocalSearchParams,
} from "expo-router";

import {
  useEffect,
  useState,
} from "react";

import {
  confirmVerificationCode,
  requestVerificationCode,
} from "../api/auth";

import {
  ApiError,
} from "../api/client";

const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const params =
    useLocalSearchParams<{
      identifier?: string;
      type?: string;
    }>();

  const identifier =
    typeof params.identifier === "string"
      ? params.identifier
      : "";

  const identifierType =
    typeof params.type === "string"
      ? params.type
      : "Phone";

  const isPhone =
    identifierType.toLowerCase() ===
    "phone";

  const [code, setCode] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  const [seconds, setSeconds] =
    useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setSeconds((value) =>
        Math.max(value - 1, 0)
      );
    }, 1000);

    return () =>
      clearTimeout(timer);
  }, [seconds]);

  function cleanCode(value: string) {
    return value
      .replace(/\D/g, "")
      .slice(0, 6);
  }

  async function handleVerify() {
    if (!identifier) {
      setMessage(
        "Verification information is missing. Please create your account again."
      );
      return;
    }

    if (code.length !== 6) {
      setMessage(
        "Please enter the complete 6-digit verification code."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result =
        await confirmVerificationCode({
          identifier,
          code,
        });

      setSuccess(true);

      setMessage(
        result.message ||
          "Your account has been verified successfully."
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Unable to verify your account. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (
      !identifier ||
      seconds > 0 ||
      resending
    ) {
      return;
    }

    setResending(true);
    setMessage("");

    try {
      const result =
        await requestVerificationCode({
          identifier,
        });

      setMessage(
        result.message ||
          "A new verification code has been sent."
      );

      setSeconds(RESEND_SECONDS);
      setCode("");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Unable to resend the verification code."
        );
      }
    } finally {
      setResending(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.successPage}>
          <View style={styles.successIcon}>
            <Text
              style={styles.successIconText}
            >
              ✓
            </Text>
          </View>

          <Text style={styles.eyebrow}>
            RUKHNAV
          </Text>

          <Text style={styles.successTitle}>
            Account Verified
          </Text>

          <Text style={styles.successText}>
            {message}
          </Text>

          <Pressable
            style={styles.successButton}
            onPress={() =>
              router.replace("/account")
            }
          >
            <Text
              style={styles.successButtonText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Continue to Sign In
            </Text>
          </Pressable>
        </View>
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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <View style={styles.topRow}>
            <Pressable
              style={styles.backButton}
              onPress={() =>
                router.back()
              }
            >
              <Text style={styles.backText}>
                ‹
              </Text>
            </Pressable>

            <Text style={styles.brand}>
              RUKHNAV
            </Text>

            <View style={styles.spacer} />
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>
              ACCOUNT SECURITY
            </Text>

            <Text style={styles.title}>
              Verify Account
            </Text>

            <Text style={styles.subtitle}>
              {isPhone
                ? "We sent a 6-digit verification code to your WhatsApp number."
                : "We sent a 6-digit verification code to your email address."}
            </Text>

            {identifier ? (
              <Text
                style={styles.identifier}
              >
                {identifier}
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              Verification Code
            </Text>

            <TextInput
              value={code}
              onChangeText={(value) =>
                setCode(cleanCode(value))
              }
              placeholder="000000"
              placeholderTextColor="#9b9f99"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              style={styles.codeInput}
              textContentType="oneTimeCode"
            />

            <Text style={styles.helper}>
              The verification code expires
              after 10 minutes.
            </Text>

            {message ? (
              <View style={styles.messageBox}>
                <Text
                  style={styles.messageText}
                >
                  {message}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                (
                  loading ||
                  code.length !== 6
                ) &&
                  styles.disabledButton,
              ]}
              disabled={
                loading ||
                code.length !== 6
              }
              onPress={handleVerify}
            >
              {loading ? (
                <ActivityIndicator
                  color="#ffffff"
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Verify Account
                </Text>
              )}
            </Pressable>

            <View style={styles.resendArea}>
              <Text style={styles.resendLabel}>
                Didn't receive the code?
              </Text>

              <Pressable
                disabled={
                  seconds > 0 ||
                  resending
                }
                onPress={handleResend}
              >
                <Text
                  style={[
                    styles.resendText,
                    seconds > 0 &&
                      styles.resendDisabled,
                  ]}
                >
                  {resending
                    ? "Sending..."
                    : seconds > 0
                      ? `Resend in ${seconds}s`
                      : isPhone
                        ? "Resend on WhatsApp"
                        : "Resend Code"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.securityCard}>
            <Text style={styles.securityTitle}>
              🔒 Secure Verification
            </Text>

            <Text style={styles.securityText}>
              Never share your RUKHNAV
              verification code with anyone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
      backgroundColor: "#f8f5ed",
    },

    content: {
      paddingHorizontal: 22,
      paddingBottom: 40,
    },

    topRow: {
      height: 62,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: "#dfd7c5",
      alignItems: "center",
      justifyContent: "center",
    },

    backText: {
      color: "#173f2b",
      fontSize: 32,
      lineHeight: 34,
    },

    brand: {
      color: "#173f2b",
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 4,
    },

    spacer: {
      width: 42,
    },

    hero: {
      alignItems: "center",
      paddingTop: 34,
      paddingBottom: 28,
    },

    eyebrow: {
      color: "#b18a36",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 3,
    },

    title: {
      color: "#173f2b",
      fontSize: 34,
      fontWeight: "900",
      marginTop: 8,
    },

    subtitle: {
      color: "#626a63",
      fontSize: 15,
      lineHeight: 23,
      textAlign: "center",
      marginTop: 12,
      maxWidth: 330,
    },

    identifier: {
      color: "#173f2b",
      fontSize: 15,
      fontWeight: "800",
      marginTop: 12,
    },

    card: {
      backgroundColor: "#ffffff",
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: "#ebe4d5",
    },

    label: {
      color: "#173f2b",
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 10,
    },

    codeInput: {
      height: 68,
      borderWidth: 1.5,
      borderColor: "#d8cfbc",
      borderRadius: 16,
      backgroundColor: "#fbfaf6",
      paddingHorizontal: 18,
      color: "#173f2b",
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: 12,
      textAlign: "center",
    },

    helper: {
      color: "#858b84",
      fontSize: 12,
      lineHeight: 18,
      marginTop: 10,
    },

    messageBox: {
      backgroundColor: "#f7f4ec",
      borderRadius: 14,
      padding: 14,
      marginTop: 16,
    },

    messageText: {
      color: "#505a52",
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
    },

    primaryButton: {
      height: 54,
      borderRadius: 16,
      backgroundColor: "#173f2b",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
    },

    disabledButton: {
      opacity: 0.45,
    },

    primaryButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "900",
    },

    resendArea: {
      alignItems: "center",
      marginTop: 22,
    },

    resendLabel: {
      color: "#777e77",
      fontSize: 13,
    },

    resendText: {
      color: "#b18a36",
      fontSize: 14,
      fontWeight: "900",
      marginTop: 7,
    },

    resendDisabled: {
      color: "#a7aaa6",
    },

    securityCard: {
      marginTop: 18,
      borderRadius: 18,
      padding: 18,
      backgroundColor: "#efe9da",
    },

    securityTitle: {
      color: "#173f2b",
      fontSize: 14,
      fontWeight: "900",
    },

    securityText: {
      color: "#697169",
      fontSize: 12,
      lineHeight: 19,
      marginTop: 5,
    },

    successPage: {
      flex: 1,
      paddingHorizontal: 26,
      alignItems: "center",
      justifyContent: "center",
    },

    successIcon: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: "#173f2b",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
    },

    successIconText: {
      color: "#ffffff",
      fontSize: 38,
      fontWeight: "900",
    },

    successTitle: {
      color: "#173f2b",
      fontSize: 31,
      fontWeight: "900",
      marginTop: 8,
    },

    successText: {
      color: "#626a63",
      fontSize: 15,
      lineHeight: 23,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 8,
    },

    successButton: {
      width: "100%",
      maxWidth: 420,
      minHeight: 58,
      borderRadius: 18,
      backgroundColor: "#173f2b",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      marginTop: 24,
    },

    successButtonText: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center",
    },
  });
