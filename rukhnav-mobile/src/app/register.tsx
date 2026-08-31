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
  register,
  requestVerificationCode,
} from "../api/auth";

import {
  ApiError,
} from "../api/client";

export default function RegisterScreen() {
  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    referralCode,
    setReferralCode,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    acceptTerms,
    setAcceptTerms,
  ] = useState(false);

  const [
    acceptPrivacy,
    setAcceptPrivacy,
  ] = useState(false);

  const [
    acceptMarketing,
    setAcceptMarketing,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  async function handleRegister() {
    const cleanName =
      fullName.trim();

    const cleanEmail =
      email.trim();

    const cleanPhone =
      phone.trim();

    const cleanReferral =
      referralCode.trim();

    if (!cleanName) {
      setMessage(
        "Please enter your full name."
      );
      return;
    }

    if (!cleanEmail && !cleanPhone) {
      setMessage(
        "Please enter either an email address or mobile number."
      );
      return;
    }

    if (password.length < 8) {
      setMessage(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (
      password !== confirmPassword
    ) {
      setMessage(
        "Passwords do not match."
      );
      return;
    }

    if (
      !acceptTerms ||
      !acceptPrivacy
    ) {
      setMessage(
        "You must accept the Terms & Conditions and Privacy Policy."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const result =
        await register({
          full_name: cleanName,

          ...(cleanEmail
            ? {
                email:
                  cleanEmail,
              }
            : {}),

          ...(cleanPhone
            ? {
                phone:
                  cleanPhone,
              }
            : {}),

          password,

          ...(cleanReferral
            ? {
                referral_code:
                  cleanReferral,
              }
            : {}),

          accept_terms: true,
          accept_privacy: true,

          accept_marketing:
            acceptMarketing,
        });

      if (
        result.verificationRequired
      ) {
        const verificationIdentifier =
          result.identifier ||
          cleanPhone ||
          cleanEmail;

        if (!verificationIdentifier) {
          throw new Error(
            "Account was created, but the verification identifier is missing."
          );
        }

        await requestVerificationCode({
          identifier:
            verificationIdentifier,
        });

        router.replace({
          pathname: "/verify",
          params: {
            identifier:
              verificationIdentifier,
            type:
              cleanPhone
                ? "Phone"
                : "Email",
          },
        });

        return;
      }

      setSuccess(true);

      setMessage(
        result.message ||
          "Your RUKHNAV account was created successfully."
      );
    } catch (error) {
      setSuccess(false);

      if (
        error instanceof ApiError
      ) {
        setMessage(
          error.message
        );
      } else if (
        error instanceof Error
      ) {
        setMessage(
          error.message
        );
      } else {
        setMessage(
          "Unable to create your account. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView
        style={styles.page}
      >
        <View
          style={
            styles.successPage
          }
        >
          <View
            style={styles.successIcon}
          >
            <Text
              style={
                styles.successIconText
              }
            >
              ✓
            </Text>
          </View>

          <Text
            style={
              styles.successEyebrow
            }
          >
            RUKHNAV
          </Text>

          <Text
            style={styles.successTitle}
          >
            Account Created
          </Text>

          <Text
            style={styles.successText}
          >
            {message}
          </Text>

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={() =>
              router.replace(
                "/account"
              )
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
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
          showsVerticalScrollIndicator={
            false
          }
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
              <Text
                style={
                  styles.backText
                }
              >
                ‹
              </Text>
            </Pressable>

            <Text style={styles.brand}>
              RUKHNAV
            </Text>

            <View
              style={styles.spacer}
            />
          </View>

          <View style={styles.hero}>
            <Text
              style={styles.eyebrow}
            >
              JOIN RUKHNAV
            </Text>

            <Text
              style={styles.title}
            >
              Create Account
            </Text>

            <Text
              style={styles.subtitle}
            >
              Create your customer
              account for shopping,
              orders, rewards and
              exclusive benefits.
            </Text>
          </View>

          <View style={styles.card}>
            <Text
              style={styles.label}
            >
              Full Name
            </Text>

            <TextInput
              value={fullName}
              onChangeText={
                setFullName
              }
              placeholder="Your full name"
              placeholderTextColor="#8a8a80"
              style={styles.input}
              editable={!loading}
            />

            <Text
              style={styles.labelGap}
            >
              Email Address
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#8a8a80"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              editable={!loading}
            />

            <View
              style={
                styles.orContainer
              }
            >
              <View
                style={styles.line}
              />

              <Text
                style={styles.orText}
              >
                OR
              </Text>

              <View
                style={styles.line}
              />
            </View>

            <Text style={styles.label}>
              Mobile Number
            </Text>

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+92..."
              placeholderTextColor="#8a8a80"
              keyboardType="phone-pad"
              style={styles.input}
              editable={!loading}
            />

            <Text
              style={styles.helper}
            >
              You may register using
              email, mobile number, or
              both.
            </Text>

            <Text
              style={styles.labelGap}
            >
              Password
            </Text>

            <View
              style={
                styles.passwordBox
              }
            >
              <TextInput
                value={password}
                onChangeText={
                  setPassword
                }
                placeholder="Minimum 8 characters"
                placeholderTextColor="#8a8a80"
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
                style={
                  styles.passwordInput
                }
                editable={!loading}
              />

              <Pressable
                style={
                  styles.showButton
                }
                onPress={() =>
                  setShowPassword(
                    current =>
                      !current
                  )
                }
              >
                <Text
                  style={
                    styles.showText
                  }
                >
                  {showPassword
                    ? "HIDE"
                    : "SHOW"}
                </Text>
              </Pressable>
            </View>

            <Text
              style={styles.labelGap}
            >
              Confirm Password
            </Text>

            <TextInput
              value={confirmPassword}
              onChangeText={
                setConfirmPassword
              }
              placeholder="Confirm password"
              placeholderTextColor="#8a8a80"
              secureTextEntry={
                !showPassword
              }
              autoCapitalize="none"
              style={styles.input}
              editable={!loading}
            />

            <Text
              style={styles.labelGap}
            >
              Referral Code
            </Text>

            <TextInput
              value={referralCode}
              onChangeText={
                setReferralCode
              }
              placeholder="Optional"
              placeholderTextColor="#8a8a80"
              autoCapitalize="characters"
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View
            style={styles.termsCard}
          >
            <Pressable
              style={styles.checkRow}
              onPress={() =>
                setAcceptTerms(
                  current =>
                    !current
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  acceptTerms &&
                    styles.checkboxActive,
                ]}
              >
                {acceptTerms ? (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                ) : null}
              </View>

              <Text
                style={
                  styles.checkText
                }
              >
                I accept the Terms &
                Conditions.
              </Text>
            </Pressable>

            <Pressable
              style={styles.checkRow}
              onPress={() =>
                setAcceptPrivacy(
                  current =>
                    !current
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  acceptPrivacy &&
                    styles.checkboxActive,
                ]}
              >
                {acceptPrivacy ? (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                ) : null}
              </View>

              <Text
                style={
                  styles.checkText
                }
              >
                I accept the Privacy
                Policy.
              </Text>
            </Pressable>

            <Pressable
              style={styles.checkRow}
              onPress={() =>
                setAcceptMarketing(
                  current =>
                    !current
                )
              }
            >
              <View
                style={[
                  styles.checkbox,
                  acceptMarketing &&
                    styles.checkboxActive,
                ]}
              >
                {acceptMarketing ? (
                  <Text
                    style={
                      styles.checkmark
                    }
                  >
                    ✓
                  </Text>
                ) : null}
              </View>

              <Text
                style={
                  styles.checkText
                }
              >
                Send me RUKHNAV offers
                and product updates.
                (Optional)
              </Text>
            </Pressable>
          </View>

          {message ? (
            <View
              style={styles.messageBox}
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

          <Pressable
            style={[
              styles.primaryButton,
              loading &&
                styles.disabled,
            ]}
            disabled={loading}
            onPress={
              handleRegister
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
                Create Account
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.signInLink}
            onPress={() =>
              router.replace(
                "/account"
              )
            }
          >
            <Text
              style={
                styles.signInText
              }
            >
              Already have an account?
              {" "}
              <Text
                style={
                  styles.signInStrong
                }
              >
                Sign In
              </Text>
            </Text>
          </Pressable>
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
      paddingHorizontal: 20,
      paddingBottom: 45,
    },

    topRow: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e2ddcf",
      alignItems: "center",
      justifyContent: "center",
    },

    backText: {
      color: "#173f2b",
      fontSize: 32,
      lineHeight: 34,
      marginTop: -3,
    },

    brand: {
      color: "#173f2b",
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: 3,
    },

    spacer: {
      width: 42,
    },

    hero: {
      paddingTop: 28,
      paddingBottom: 24,
    },

    eyebrow: {
      color: "#b18a36",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 2,
    },

    title: {
      color: "#173f2b",
      fontSize: 35,
      fontWeight: "900",
      marginTop: 8,
    },

    subtitle: {
      color: "#626a63",
      fontSize: 15,
      lineHeight: 23,
      marginTop: 10,
    },

    card: {
      backgroundColor: "#ffffff",
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: "#e7e0d0",
    },

    label: {
      color: "#173f2b",
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 8,
    },

    labelGap: {
      color: "#173f2b",
      fontSize: 13,
      fontWeight: "800",
      marginTop: 18,
      marginBottom: 8,
    },

    input: {
      height: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#d9d3c4",
      backgroundColor: "#fcfbf7",
      paddingHorizontal: 15,
      color: "#1e2b23",
      fontSize: 16,
    },

    passwordBox: {
      height: 54,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "#d9d3c4",
      backgroundColor: "#fcfbf7",
    },

    passwordInput: {
      flex: 1,
      height: "100%",
      paddingHorizontal: 15,
      color: "#1e2b23",
      fontSize: 16,
    },

    showButton: {
      height: "100%",
      justifyContent: "center",
      paddingHorizontal: 14,
    },

    showText: {
      color: "#b18a36",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
    },

    helper: {
      color: "#858b85",
      fontSize: 11,
      lineHeight: 17,
      marginTop: 8,
    },

    orContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 18,
    },

    line: {
      flex: 1,
      height: 1,
      backgroundColor: "#e3ddd0",
    },

    orText: {
      marginHorizontal: 12,
      color: "#999b94",
      fontSize: 10,
      fontWeight: "800",
    },

    termsCard: {
      marginTop: 18,
      backgroundColor: "#ffffff",
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: "#e7e0d0",
      gap: 16,
    },

    checkRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },

    checkbox: {
      width: 23,
      height: 23,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: "#b7b2a5",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    checkboxActive: {
      backgroundColor: "#173f2b",
      borderColor: "#173f2b",
    },

    checkmark: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900",
    },

    checkText: {
      flex: 1,
      color: "#505950",
      fontSize: 13,
      lineHeight: 20,
    },

    messageBox: {
      marginTop: 17,
      padding: 13,
      borderRadius: 12,
      backgroundColor: "#fff4e5",
    },

    messageText: {
      color: "#8a5214",
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
    },

    primaryButton: {
      height: 57,
      borderRadius: 16,
      backgroundColor: "#173f2b",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
    },

    primaryButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900",
    },

    disabled: {
      opacity: 0.65,
    },

    signInLink: {
      paddingVertical: 23,
      alignItems: "center",
    },

    signInText: {
      color: "#6a716b",
      fontSize: 13,
    },

    signInStrong: {
      color: "#173f2b",
      fontWeight: "900",
    },

    successPage: {
      flex: 1,
      paddingHorizontal: 25,
      alignItems: "center",
      justifyContent: "center",
    },

    successIcon: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: "#173f2b",
      borderWidth: 4,
      borderColor: "#d5b15d",
      alignItems: "center",
      justifyContent: "center",
    },

    successIconText: {
      color: "#ffffff",
      fontSize: 39,
      fontWeight: "900",
    },

    successEyebrow: {
      color: "#b18a36",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 3,
      marginTop: 24,
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
    },
  });
