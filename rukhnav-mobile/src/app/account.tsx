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
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  router,
} from "expo-router";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  ApiError,
} from "../api/client";

import {
  getProfile,
  login,
} from "../api/auth";

import {
  clearSession,
  getStoredCustomer,
  getToken,
  saveSession,
  type StoredCustomer,
} from "../auth/session";

function customerName(
  customer: StoredCustomer | null
) {
  if (!customer) {
    return "RUKHNAV Customer";
  }

  if (customer.full_name?.trim()) {
    return customer.full_name.trim();
  }

  const combined = [
    customer.first_name,
    customer.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return combined || "RUKHNAV Customer";
}

export default function AccountScreen() {
  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [message, setMessage] =
    useState("");

  const [customer, setCustomer] =
    useState<StoredCustomer | null>(
      null
    );

  const restoreSession =
    useCallback(async () => {
      setCheckingSession(true);
      setMessage("");

      try {
        const token =
          await getToken();

        if (!token) {
          setCustomer(null);
          return;
        }

        const stored =
          await getStoredCustomer();

        if (stored) {
          setCustomer(stored);
        }

        const result =
          await getProfile();

        const freshCustomer =
          result.customer ||
          result.profile ||
          stored ||
          null;

        setCustomer(freshCustomer);

        if (freshCustomer) {
          await saveSession(
            token,
            freshCustomer
          );
        }
      } catch (error) {
        setCustomer(null);

        if (
          error instanceof ApiError &&
          error.status !== 401
        ) {
          setMessage(error.message);
        }
      } finally {
        setCheckingSession(false);
      }
    }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  async function handleLogin() {
    const cleanIdentifier =
      identifier.trim();

    if (!cleanIdentifier) {
      setMessage(
        "Enter your email address or mobile number."
      );
      return;
    }

    if (!password) {
      setMessage(
        "Enter your password."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result =
        await login({
          identifier:
            cleanIdentifier,
          password,
        });

      const loggedInCustomer =
        result.customer ||
        (await getStoredCustomer());

      setCustomer(
        loggedInCustomer || null
      );

      setPassword("");
      setMessage("");
    } catch (error) {
      if (error instanceof ApiError) {
        const data =
          error.data || {};

        if (
          data.verificationRequired
        ) {
          setMessage(
            data.message ||
              "Your account needs verification before you can sign in."
          );
        } else if (
          data.deletionRequested
        ) {
          setMessage(
            data.message ||
              "This account has a pending deletion request."
          );
        } else {
          setMessage(
            error.message
          );
        }
      } else if (
        error instanceof Error
      ) {
        setMessage(error.message);
      } else {
        setMessage(
          "Unable to sign in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);

    try {
      await clearSession();

      setCustomer(null);
      setIdentifier("");
      setPassword("");
      setMessage("");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <SafeAreaView
        style={styles.loadingPage}
      >
        <ActivityIndicator
          size="large"
          color="#173f2b"
        />

        <Text style={styles.loadingText}>
          Opening your RUKHNAV account...
        </Text>
      </SafeAreaView>
    );
  }

  if (customer) {
    return (
      <SafeAreaView
        style={styles.page}
        edges={[
          "top",
          "left",
          "right",
        ]}
      >
        <ScrollView
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
                  styles.backButtonText
                }
              >
                ‹
              </Text>
            </Pressable>

            <Text style={styles.brand}>
              RUKHNAV
            </Text>

            <View
              style={styles.topSpacer}
            />
          </View>

          <View
            style={styles.profileHero}
          >
            <View
              style={styles.avatar}
            >
              <Text
                style={styles.avatarText}
              >
                {customerName(customer)
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <Text
              style={styles.welcomeLabel}
            >
              WELCOME BACK
            </Text>

            <Text
              style={styles.customerName}
            >
              {customerName(customer)}
            </Text>

            <Text
              style={styles.memberText}
            >
              RUKHNAV Customer Account
            </Text>
          </View>

          <View style={styles.card}>
            <Text
              style={styles.cardTitle}
            >
              Account Details
            </Text>

            {customer.email ? (
              <View
                style={styles.detailRow}
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Email
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {customer.email}
                </Text>
              </View>
            ) : null}

            {customer.phone ? (
              <View
                style={styles.detailRow}
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Mobile
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {customer.phone}
                </Text>
              </View>
            ) : null}

            {customer.referral_code ? (
              <View
                style={styles.detailRow}
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Referral Code
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {
                    customer.referral_code
                  }
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={styles.shopButton}
            onPress={() =>
              router.push("/shop")
            }
          >
            <Text
              style={styles.shopButtonText}
            >
              Continue Shopping
            </Text>
          </Pressable>

          <Pressable
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                color="#173f2b"
              />
            ) : (
              <Text
                style={
                  styles.logoutButtonText
                }
              >
                Sign Out
              </Text>
            )}
          </Pressable>
        </ScrollView>
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
            styles.authContent
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
                  styles.backButtonText
                }
              >
                ‹
              </Text>
            </Pressable>

            <Text style={styles.brand}>
              RUKHNAV
            </Text>

            <View
              style={styles.topSpacer}
            />
          </View>

          <View style={styles.authHero}>
            <Text
              style={styles.eyebrow}
            >
              CUSTOMER ACCOUNT
            </Text>

            <Text
              style={styles.authTitle}
            >
              Welcome Back
            </Text>

            <Text
              style={styles.authSubtitle}
            >
              Sign in to manage your
              RUKHNAV account, orders,
              rewards and shopping.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text
              style={styles.inputLabel}
            >
              Email or Mobile Number
            </Text>

            <TextInput
              value={identifier}
              onChangeText={
                setIdentifier
              }
              placeholder={
                "Email or mobile number"
              }
              placeholderTextColor={
                "#8a8a80"
              }
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              style={styles.input}
              editable={!loading}
            />

            <Text
              style={[
                styles.inputLabel,
                styles.passwordLabel,
              ]}
            >
              Password
            </Text>

            <View
              style={
                styles.passwordContainer
              }
            >
              <TextInput
                value={password}
                onChangeText={
                  setPassword
                }
                placeholder="Password"
                placeholderTextColor={
                  "#8a8a80"
                }
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={
                  styles.passwordInput
                }
                editable={!loading}
                onSubmitEditing={
                  handleLogin
                }
              />

              <Pressable
                style={
                  styles.showButton
                }
                onPress={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
              >
                <Text
                  style={
                    styles.showButtonText
                  }
                >
                  {showPassword
                    ? "HIDE"
                    : "SHOW"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.forgotPasswordButton}
              onPress={() =>
                router.push("/forgot-password")
              }
              disabled={loading}
            >
              <Text
                style={
                  styles.forgotPasswordText
                }
              >
                Forgot Password?
              </Text>
            </Pressable>

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

            <Pressable
              style={[
                styles.signInButton,
                loading &&
                  styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#ffffff"
                />
              ) : (
                <Text
                  style={
                    styles.signInButtonText
                  }
                >
                  Sign In
                </Text>
              )}
            </Pressable>

            <Text
              style={styles.securityText}
            >
              Your login is protected
              using secure device
              storage.
            </Text>
          </View>

          <View
            style={styles.registerCard}
          >
            <Text
              style={styles.registerTitle}
            >
              New to RUKHNAV?
            </Text>

            <Text
              style={styles.registerText}
            >
              Account registration and
              verification are the next
              part of the mobile setup.
            </Text>

            <Pressable
              style={
                styles.comingSoonButton
              }
              onPress={() =>
                router.push("/register")
              }
            >
              <Text
                style={
                  styles.comingSoonText
                }
              >
                Create Account
              </Text>
            </Pressable>
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

  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f5ed",
    padding: 24,
  },

  loadingText: {
    marginTop: 14,
    color: "#173f2b",
    fontSize: 15,
    fontWeight: "600",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 42,
  },

  authContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 42,
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2ddcf",
  },

  backButtonText: {
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

  topSpacer: {
    width: 42,
  },

  authHero: {
    paddingTop: 34,
    paddingBottom: 26,
  },

  eyebrow: {
    color: "#b18a36",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
  },

  authTitle: {
    color: "#173f2b",
    fontSize: 36,
    fontWeight: "900",
  },

  authSubtitle: {
    color: "#5e665f",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 340,
  },

  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e7e0d0",
  },

  inputLabel: {
    color: "#173f2b",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },

  passwordLabel: {
    marginTop: 18,
  },

  input: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9d3c4",
    paddingHorizontal: 15,
    color: "#1e2b23",
    fontSize: 16,
    backgroundColor: "#fcfbf7",
  },

  passwordContainer: {
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
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  showButtonText: {
    color: "#b18a36",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  messageBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff4e5",
  },

  messageText: {
    color: "#8a5214",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  forgotPasswordButton: {
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 2,
  },

  forgotPasswordText: {
    color: "#b18a36",
    fontSize: 13,
    fontWeight: "900",
  },

  signInButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },

  disabledButton: {
    opacity: 0.65,
  },

  signInButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  securityText: {
    color: "#7a7f78",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },

  registerCard: {
    alignItems: "center",
    padding: 22,
    marginTop: 20,
  },

  registerTitle: {
    color: "#173f2b",
    fontSize: 18,
    fontWeight: "900",
  },

  registerText: {
    color: "#697069",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },

  comingSoonButton: {
    marginTop: 15,
    minHeight: 48,
    alignSelf: "stretch",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#b18a36",
    alignItems: "center",
    justifyContent: "center",
  },

  comingSoonText: {
    color: "#9b752c",
    fontSize: 14,
    fontWeight: "800",
  },

  profileHero: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 28,
  },

  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#173f2b",
    borderWidth: 4,
    borderColor: "#d5b15d",
    marginBottom: 18,
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
  },

  welcomeLabel: {
    color: "#b18a36",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },

  customerName: {
    color: "#173f2b",
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 7,
  },

  memberText: {
    color: "#6a716b",
    fontSize: 14,
    marginTop: 6,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e7e0d0",
  },

  cardTitle: {
    color: "#173f2b",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  detailRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#eee9df",
  },

  detailLabel: {
    color: "#8a8f89",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  detailValue: {
    color: "#243129",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },

  shopButton: {
    height: 55,
    borderRadius: 16,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  shopButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },

  logoutButton: {
    height: 53,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#b18a36",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  logoutButtonText: {
    color: "#173f2b",
    fontSize: 15,
    fontWeight: "900",
  },
});
