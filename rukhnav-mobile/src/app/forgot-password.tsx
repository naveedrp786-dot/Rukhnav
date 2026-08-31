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
  useState,
} from "react";

import {
  requestPasswordReset,
  resetPassword,
} from "../api/auth";

import {
  ApiError,
} from "../api/client";

type Step =
  | "request"
  | "reset"
  | "success";

export default function ForgotPasswordScreen() {
  const [step, setStep] =
    useState<Step>("request");

  const [identifier, setIdentifier] =
    useState("");

  const [code, setCode] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [expiresIn, setExpiresIn] =
    useState<number | null>(null);

  async function handleRequestCode() {
    const cleanIdentifier =
      identifier.trim();

    if (!cleanIdentifier) {
      setMessage(
        "Enter your email address or mobile number."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result =
        await requestPasswordReset({
          identifier:
            cleanIdentifier,
        });

      setIdentifier(
        cleanIdentifier
      );

      setExpiresIn(
        result.expiresInMinutes ??
          10
      );

      setMessage(
        result.message ||
          "If an account matches those details, a reset code has been sent."
      );

      setStep("reset");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Unable to request a password reset. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (code.length !== 6) {
      setMessage(
        "Enter the complete 6-digit reset code."
      );
      return;
    }

    if (newPassword.length < 8) {
      setMessage(
        "New password must contain at least 8 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setMessage(
        "Password confirmation does not match."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result =
        await resetPassword({
          identifier,
          code,
          new_password:
            newPassword,
          confirm_password:
            confirmPassword,
        });

      setMessage(
        result.message ||
          "Password reset successfully."
      );

      setCode("");
      setNewPassword("");
      setConfirmPassword("");

      setStep("success");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
      } else if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Unable to reset your password. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function cleanCode(value: string) {
    return value
      .replace(/\D/g, "")
      .slice(0, 6);
  }

  if (step === "success") {
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
            Password Updated
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
              {step === "request"
                ? "Forgot Password"
                : "Reset Password"}
            </Text>

            <Text style={styles.subtitle}>
              {step === "request"
                ? "Enter your email address or mobile number and we'll send you a secure reset code."
                : "Enter the 6-digit reset code and choose a new password."}
            </Text>
          </View>

          <View style={styles.card}>
            {step === "request" ? (
              <>
                <Text style={styles.label}>
                  Email or Mobile Number
                </Text>

                <TextInput
                  value={identifier}
                  onChangeText={
                    setIdentifier
                  }
                  placeholder="Email or mobile number"
                  placeholderTextColor="#8a8a80"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loading}
                  style={styles.input}
                  onSubmitEditing={
                    handleRequestCode
                  }
                />

                {message ? (
                  <View
                    style={styles.messageBox}
                  >
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
                    loading &&
                      styles.disabledButton,
                  ]}
                  disabled={loading}
                  onPress={
                    handleRequestCode
                  }
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
                      Send Reset Code
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>
                  Reset Code
                </Text>

                <TextInput
                  value={code}
                  onChangeText={(value) =>
                    setCode(
                      cleanCode(value)
                    )
                  }
                  placeholder="000000"
                  placeholderTextColor="#9b9f99"
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  style={styles.codeInput}
                />

                <Text style={styles.helper}>
                  {expiresIn
                    ? `The reset code expires in ${expiresIn} minutes.`
                    : "The reset code expires shortly."}
                </Text>

                <Text
                  style={[
                    styles.label,
                    styles.passwordLabel,
                  ]}
                >
                  New Password
                </Text>

                <View
                  style={
                    styles.passwordContainer
                  }
                >
                  <TextInput
                    value={newPassword}
                    onChangeText={
                      setNewPassword
                    }
                    placeholder="New password"
                    placeholderTextColor="#8a8a80"
                    secureTextEntry={
                      !showNewPassword
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={
                      styles.passwordInput
                    }
                  />

                  <Pressable
                    style={styles.showButton}
                    onPress={() =>
                      setShowNewPassword(
                        (value) =>
                          !value
                      )
                    }
                  >
                    <Text
                      style={
                        styles.showButtonText
                      }
                    >
                      {showNewPassword
                        ? "HIDE"
                        : "SHOW"}
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={[
                    styles.label,
                    styles.passwordLabel,
                  ]}
                >
                  Confirm Password
                </Text>

                <View
                  style={
                    styles.passwordContainer
                  }
                >
                  <TextInput
                    value={
                      confirmPassword
                    }
                    onChangeText={
                      setConfirmPassword
                    }
                    placeholder="Confirm password"
                    placeholderTextColor="#8a8a80"
                    secureTextEntry={
                      !showConfirmPassword
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={
                      styles.passwordInput
                    }
                  />

                  <Pressable
                    style={styles.showButton}
                    onPress={() =>
                      setShowConfirmPassword(
                        (value) =>
                          !value
                      )
                    }
                  >
                    <Text
                      style={
                        styles.showButtonText
                      }
                    >
                      {showConfirmPassword
                        ? "HIDE"
                        : "SHOW"}
                    </Text>
                  </Pressable>
                </View>

                {message ? (
                  <View
                    style={styles.messageBox}
                  >
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
                  onPress={
                    handleResetPassword
                  }
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
                      Reset Password
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={
                    styles.secondaryButton
                  }
                  disabled={loading}
                  onPress={() => {
                    setStep("request");
                    setCode("");
                    setMessage("");
                  }}
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Use a Different Email / Mobile
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.securityCard}>
            <Text style={styles.securityTitle}>
              🔒 Secure Password Recovery
            </Text>

            <Text style={styles.securityText}>
              For mobile accounts, RUKHNAV sends
              the reset code through WhatsApp.
              Email accounts receive the code by
              email.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#ffffff",
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
    paddingTop: 30,
    paddingBottom: 26,
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
    textAlign: "center",
  },

  subtitle: {
    color: "#626a63",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 340,
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

  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: "#d8cfbc",
    borderRadius: 16,
    backgroundColor: "#fbfaf6",
    paddingHorizontal: 16,
    color: "#173f2b",
    fontSize: 15,
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
    marginBottom: 18,
  },

  passwordLabel: {
    marginTop: 6,
  },

  passwordContainer: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: "#d8cfbc",
    borderRadius: 16,
    backgroundColor: "#fbfaf6",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 16,
  },

  passwordInput: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    color: "#173f2b",
    fontSize: 15,
  },

  showButton: {
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: "center",
  },

  showButtonText: {
    color: "#b18a36",
    fontSize: 12,
    fontWeight: "900",
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
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 20,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.45,
  },

  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#b18a36",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 12,
  },

  secondaryButtonText: {
    color: "#173f2b",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
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
    textAlign: "center",
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
