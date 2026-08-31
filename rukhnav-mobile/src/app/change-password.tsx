import {
  useState,
} from "react";

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
  changePassword,
} from "../api/auth";

import {
  ApiError,
} from "../api/client";

export default function ChangePasswordScreen() {
  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false);

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState(false);

  async function handleChangePassword() {
    if (loading) {
      return;
    }

    setMessage("");
    setSuccess(false);

    if (!currentPassword) {
      setMessage(
        "Enter your current password."
      );
      return;
    }

    if (newPassword.length < 8) {
      setMessage(
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setMessage(
        "New passwords do not match."
      );
      return;
    }

    if (
      currentPassword ===
      newPassword
    ) {
      setMessage(
        "Your new password must be different from your current password."
      );
      return;
    }

    setLoading(true);

    try {
      const result =
        await changePassword({
          current_password:
            currentPassword,

          new_password:
            newPassword,

          confirm_password:
            confirmPassword,
        });

      setSuccess(true);

      setMessage(
        result.message ||
          "Password updated successfully."
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
          "Unable to update your password. Please try again."
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
          style={styles.successPage}
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
            style={styles.eyebrow}
          >
            ACCOUNT SECURITY
          </Text>

          <Text
            style={styles.successTitle}
          >
            Password Updated
          </Text>

          <Text
            style={styles.successText}
          >
            {message}
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.replace("/account")
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Return to Account
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
          style={styles.scrollView}
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.topRow}
          >
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

            <Text
              style={styles.brand}
            >
              RUKHNAV
            </Text>

            <View
              style={styles.topSpacer}
            />
          </View>

          <Text
            style={styles.eyebrow}
          >
            ACCOUNT SECURITY
          </Text>

          <Text
            style={styles.title}
          >
            Change Password
          </Text>

          <Text
            style={styles.subtitle}
          >
            Update your password to keep
            your RUKHNAV account secure.
          </Text>

          <View
            style={styles.card}
          >
            <PasswordField
              label="CURRENT PASSWORD"
              value={currentPassword}
              onChangeText={
                setCurrentPassword
              }
              visible={
                showCurrentPassword
              }
              onToggle={() =>
                setShowCurrentPassword(
                  value => !value
                )
              }
              autoComplete="current-password"
            />

            <PasswordField
              label="NEW PASSWORD"
              value={newPassword}
              onChangeText={
                setNewPassword
              }
              visible={
                showNewPassword
              }
              onToggle={() =>
                setShowNewPassword(
                  value => !value
                )
              }
              autoComplete="new-password"
            />

            <Text
              style={styles.passwordHint}
            >
              Use at least 8 characters.
            </Text>

            <PasswordField
              label="CONFIRM NEW PASSWORD"
              value={confirmPassword}
              onChangeText={
                setConfirmPassword
              }
              visible={
                showConfirmPassword
              }
              onToggle={() =>
                setShowConfirmPassword(
                  value => !value
                )
              }
              autoComplete="new-password"
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
                  styles.buttonDisabled,
              ]}
              disabled={loading}
              onPress={
                handleChangePassword
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
                  Update Password
                </Text>
              )}
            </Pressable>
          </View>

          <View
            style={styles.securityNote}
          >
            <Text
              style={
                styles.securityNoteTitle
              }
            >
              SECURITY NOTICE
            </Text>

            <Text
              style={
                styles.securityNoteText
              }
            >
              After changing your password,
              other stored account sessions
              may be signed out for your
              protection.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText:
    (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete:
    | "current-password"
    | "new-password";
};

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggle,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <View
      style={styles.fieldGroup}
    >
      <Text
        style={styles.label}
      >
        {label}
      </Text>

      <View
        style={styles.passwordInputWrap}
      >
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={
            onChangeText
          }
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={
            autoComplete ===
            "current-password"
              ? "password"
              : "newPassword"
          }
          placeholder="••••••••"
          placeholderTextColor="#9a9f9b"
          returnKeyType="next"
        />

        <Pressable
          style={styles.showButton}
          onPress={onToggle}
        >
          <Text
            style={styles.showText}
          >
            {visible
              ? "HIDE"
              : "SHOW"}
          </Text>
        </Pressable>
      </View>
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
      backgroundColor: "#f7f4ec",
    },

    scrollView: {
      flex: 1,
    },

    content: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingBottom: 220,
    },

    topRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#ffffff",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#e7e0d1",
    },

    backText: {
      color: "#173f2b",
      fontSize: 34,
      lineHeight: 36,
      fontWeight: "500",
      marginTop: -3,
    },

    brand: {
      color: "#173f2b",
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 4,
    },

    topSpacer: {
      width: 44,
    },

    eyebrow: {
      color: "#b18a36",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 3,
      marginTop: 22,
      textAlign: "center",
    },

    title: {
      color: "#173f2b",
      fontSize: 34,
      lineHeight: 41,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 10,
    },

    subtitle: {
      color: "#626a63",
      fontSize: 15,
      lineHeight: 23,
      textAlign: "center",
      marginTop: 10,
      marginBottom: 24,
      paddingHorizontal: 16,
    },

    card: {
      backgroundColor: "#ffffff",
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: "#e9e2d5",
    },

    fieldGroup: {
      marginBottom: 18,
    },

    label: {
      color: "#173f2b",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1.4,
      marginBottom: 8,
    },

    passwordInputWrap: {
      minHeight: 58,
      borderWidth: 1,
      borderColor: "#dcd5c7",
      borderRadius: 16,
      backgroundColor: "#fbfaf6",
      flexDirection: "row",
      alignItems: "center",
    },

    passwordInput: {
      flex: 1,
      minHeight: 56,
      paddingHorizontal: 16,
      color: "#1f2a24",
      fontSize: 16,
    },

    showButton: {
      minHeight: 56,
      justifyContent: "center",
      paddingHorizontal: 16,
    },

    showText: {
      color: "#b18a36",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
    },

    passwordHint: {
      color: "#7a817b",
      fontSize: 12,
      lineHeight: 18,
      marginTop: -10,
      marginBottom: 18,
    },

    messageBox: {
      backgroundColor: "#fff4f1",
      borderRadius: 14,
      padding: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: "#efd5cf",
    },

    messageText: {
      color: "#9c3d32",
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      fontWeight: "700",
    },

    primaryButton: {
      width: "100%",
      minHeight: 58,
      borderRadius: 18,
      backgroundColor: "#173f2b",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
    },

    primaryButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "900",
      textAlign: "center",
    },

    buttonDisabled: {
      opacity: 0.65,
    },

    securityNote: {
      marginTop: 18,
      padding: 18,
      borderRadius: 20,
      backgroundColor: "#eee8d9",
    },

    securityNoteTitle: {
      color: "#b18a36",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 2,
      textAlign: "center",
    },

    securityNoteText: {
      color: "#626a63",
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 8,
    },

    successPage: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },

    successIcon: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: "#173f2b",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
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
      marginBottom: 26,
      maxWidth: 420,
    },
  });
