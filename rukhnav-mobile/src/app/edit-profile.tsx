import {
  useEffect,
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

import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  ApiError,
} from "../api/client";

import {
  getCustomerProfile,
  updateCustomerProfile,
  type CustomerProfile,
} from "../api/profile";

export default function EditProfileScreen() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    profile,
    setProfile,
  ] = useState<CustomerProfile | null>(
    null
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    gender,
    setGender,
  ] = useState("");

  const [
    dateOfBirth,
    setDateOfBirth,
  ] = useState("");

  const [
    showDatePicker,
    setShowDatePicker,
  ] = useState(false);

  const [
    skinType,
    setSkinType,
  ] = useState("");

  const [
    hairType,
    setHairType,
  ] = useState("");

  const [
    address,
    setAddress,
  ] = useState("");

  const [
    city,
    setCity,
  ] = useState("");

  const [
    country,
    setCountry,
  ] = useState("Pakistan");

  const [
    postalCode,
    setPostalCode,
  ] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    try {
      const result =
        await getCustomerProfile();

      const data =
        result.profile || null;

      setProfile(data);

      setFullName(
        data?.full_name || ""
      );

      setEmail(
        data?.email || ""
      );

      setPhone(
        data?.phone || ""
      );

      setGender(
        data?.gender || ""
      );

      setDateOfBirth(
        data?.date_of_birth
          ? String(
              data.date_of_birth
            ).slice(0, 10)
          : ""
      );

      setSkinType(
        data?.skin_type || ""
      );

      setHairType(
        data?.hair_type || ""
      );

      setAddress(
        data?.address || ""
      );

      setCity(
        data?.city || ""
      );

      setCountry(
        data?.country ||
          "Pakistan"
      );

      setPostalCode(
        data?.postal_code || ""
      );
    } catch (error) {
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
          "Unable to load your profile."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function parseDateOfBirth() {
    if (!dateOfBirth) {
      return new Date(
        1990,
        0,
        1
      );
    }

    const parts =
      dateOfBirth.split("-");

    if (parts.length !== 3) {
      return new Date(
        1990,
        0,
        1
      );
    }

    const year =
      Number(parts[0]);

    const month =
      Number(parts[1]) - 1;

    const day =
      Number(parts[2]);

    const value =
      new Date(
        year,
        month,
        day
      );

    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return new Date(
        1990,
        0,
        1
      );
    }

    return value;
  }

  function formatDateForApi(
    value: Date
  ) {
    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        "0"
      );

    return `${year}-${month}-${day}`;
  }

  function formatDateForDisplay(
    value: string
  ) {
    if (!value) {
      return "Select date of birth";
    }

    const parts =
      value.split("-");

    if (parts.length !== 3) {
      return value;
    }

    const date =
      new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      undefined,
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  }

  function handleDateChange(
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) {
    if (
      Platform.OS === "android"
    ) {
      setShowDatePicker(false);
    }

    if (
      event.type ===
      "dismissed"
    ) {
      return;
    }

    if (!selectedDate) {
      return;
    }

    const today =
      new Date();

    today.setHours(
      23,
      59,
      59,
      999
    );

    if (
      selectedDate >
      today
    ) {
      return;
    }

    setDateOfBirth(
      formatDateForApi(
        selectedDate
      )
    );
  }

  async function handleSave() {
    if (saving) {
      return;
    }

    setMessage("");

    if (!fullName.trim()) {
      setMessage(
        "Full name is required."
      );
      return;
    }

    if (
      !email.trim() &&
      !phone.trim()
    ) {
      setMessage(
        "Keep at least one email address or mobile number."
      );
      return;
    }

    setSaving(true);

    try {
      const result =
        await updateCustomerProfile({
          full_name:
            fullName.trim(),

          email:
            email.trim() || null,

          phone:
            phone.trim() || null,

          gender:
            gender || null,

          date_of_birth:
            dateOfBirth || null,

          skin_type:
            skinType || null,

          hair_type:
            hairType || null,

          address:
            address.trim() || null,

          city:
            city.trim() || null,

          country:
            country.trim() ||
            "Pakistan",

          postal_code:
            postalCode.trim() ||
            null,
        });

      if (result.profile) {
        setProfile(
          result.profile
        );
      }

      setMessage(
        result.message ||
          "Profile updated successfully."
      );
    } catch (error) {
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
          "Unable to update your profile."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingPage}
      >
        <ActivityIndicator
          size="large"
          color="#173f2b"
        />

        <Text
          style={styles.loadingText}
        >
          Loading your profile...
        </Text>
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
          style={styles.scroll}
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

          <View
            style={styles.hero}
          >
            <View
              style={styles.avatar}
            >
              <Text
                style={styles.avatarText}
              >
                {fullName
                  .charAt(0)
                  .toUpperCase() ||
                  "R"}
              </Text>
            </View>

            <Pressable
              style={
                styles.photoButton
              }
              onPress={() => {
                setMessage(
                  "Profile Picture Studio is coming next."
                );
              }}
            >
              <Text
                style={
                  styles.photoButtonText
                }
              >
                Edit Profile Picture
              </Text>
            </Pressable>

            <Text
              style={styles.eyebrow}
            >
              CUSTOMER PROFILE
            </Text>

            <Text
              style={styles.title}
            >
              Edit Profile
            </Text>

            <Text
              style={styles.subtitle}
            >
              Keep your personal details
              and preferences up to date.
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="FULL NAME"
              value={fullName}
              onChangeText={
                setFullName
              }
            />

            <Field
              label="EMAIL"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Field
              label="MOBILE NUMBER"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <ChoiceRow
              label="GENDER"
              value={gender}
              options={[
                "Male",
                "Female",
                "Other",
              ]}
              onChange={setGender}
            />

            <View
              style={styles.fieldGroup}
            >
              <Text
                style={styles.label}
              >
                DATE OF BIRTH
              </Text>

              <Pressable
                style={
                  styles.datePickerButton
                }
                onPress={() =>
                  setShowDatePicker(
                    true
                  )
                }
              >
                <Text
                  style={[
                    styles.datePickerText,
                    !dateOfBirth &&
                      styles.datePickerPlaceholder,
                  ]}
                >
                  {
                    formatDateForDisplay(
                      dateOfBirth
                    )
                  }
                </Text>

                <Text
                  style={
                    styles.datePickerIcon
                  }
                >
                  📅
                </Text>
              </Pressable>

              {showDatePicker ? (
                <View
                  style={
                    styles.datePickerWrap
                  }
                >
                  <DateTimePicker
                    value={
                      parseDateOfBirth()
                    }
                    mode="date"
                    display={
                      Platform.OS ===
                      "ios"
                        ? "inline"
                        : "default"
                    }
                    maximumDate={
                      new Date()
                    }
                    onChange={
                      handleDateChange
                    }
                  />

                  {Platform.OS ===
                  "ios" ? (
                    <Pressable
                      style={
                        styles.dateDoneButton
                      }
                      onPress={() =>
                        setShowDatePicker(
                          false
                        )
                      }
                    >
                      <Text
                        style={
                          styles.dateDoneText
                        }
                      >
                        Done
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <ChoiceRow
              label="SKIN TYPE"
              value={skinType}
              options={[
                "Normal",
                "Dry",
                "Oily",
                "Combination",
                "Sensitive",
              ]}
              onChange={setSkinType}
            />

            <ChoiceRow
              label="HAIR TYPE"
              value={hairType}
              options={[
                "Straight",
                "Wavy",
                "Curly",
                "Coily",
              ]}
              onChange={setHairType}
            />

            <Field
              label="ADDRESS"
              value={address}
              onChangeText={
                setAddress
              }
              multiline
            />

            <Field
              label="CITY"
              value={city}
              onChangeText={setCity}
            />

            <Field
              label="COUNTRY"
              value={country}
              onChangeText={
                setCountry
              }
            />

            <Field
              label="POSTAL CODE"
              value={postalCode}
              onChangeText={
                setPostalCode
              }
            />

            {profile?.referral_code ? (
              <View
                style={
                  styles.readOnlyBox
                }
              >
                <Text
                  style={
                    styles.readOnlyLabel
                  }
                >
                  REFERRAL CODE
                </Text>

                <Text
                  style={
                    styles.readOnlyValue
                  }
                >
                  {
                    profile.referral_code
                  }
                </Text>
              </View>
            ) : null}

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
                styles.saveButton,
                saving &&
                  styles.disabledButton,
              ]}
              disabled={saving}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator
                  color="#ffffff"
                />
              ) : (
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  Save Profile
                </Text>
              )}
            </Pressable>
          </View>

          <View
            style={styles.notice}
          >
            <Text
              style={styles.noticeTitle}
            >
              IDENTITY SECURITY
            </Text>

            <Text
              style={styles.noticeText}
            >
              If you change your email
              address or mobile number,
              RUKHNAV will require the
              changed contact detail to
              be verified again.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    | "phone-pad";
  autoCapitalize?:
    | "none"
    | "sentences"
    | "words";
  placeholder?: string;
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "sentences",
  placeholder,
  multiline = false,
}: FieldProps) {
  return (
    <View
      style={styles.fieldGroup}
    >
      <Text
        style={styles.label}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={
          onChangeText
        }
        keyboardType={
          keyboardType
        }
        autoCapitalize={
          autoCapitalize
        }
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor="#9a9f9b"
        multiline={multiline}
        style={[
          styles.input,
          multiline &&
            styles.multilineInput,
        ]}
      />
    </View>
  );
}

type ChoiceRowProps = {
  label: string;
  value: string;
  options: string[];
  onChange:
    (value: string) => void;
};

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: ChoiceRowProps) {
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
        style={styles.choiceWrap}
      >
        {options.map(option => {
          const selected =
            value === option;

          return (
            <Pressable
              key={option}
              style={[
                styles.choiceButton,
                selected &&
                  styles.choiceButtonSelected,
              ]}
              onPress={() =>
                onChange(
                  selected
                    ? ""
                    : option
                )
              }
            >
              <Text
                style={[
                  styles.choiceText,
                  selected &&
                    styles.choiceTextSelected,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  },

  loadingText: {
    marginTop: 14,
    color: "#173f2b",
    fontSize: 15,
    fontWeight: "700",
  },

  scroll: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 220,
  },

  topRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  },

  brand: {
    color: "#173f2b",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 4,
  },

  topSpacer: {
    width: 42,
  },

  hero: {
    alignItems: "center",
    paddingTop: 22,
    paddingBottom: 24,
  },

  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#173f2b",
    borderWidth: 4,
    borderColor: "#d5b15d",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
  },

  photoButton: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  photoButtonText: {
    color: "#b18a36",
    fontSize: 13,
    fontWeight: "900",
  },

  eyebrow: {
    color: "#b18a36",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    marginTop: 12,
  },

  title: {
    color: "#173f2b",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 7,
  },

  subtitle: {
    color: "#626a63",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e7e0d0",
  },

  fieldGroup: {
    marginBottom: 18,
  },

  label: {
    color: "#173f2b",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  input: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9d3c4",
    backgroundColor: "#fcfbf7",
    paddingHorizontal: 15,
    color: "#1e2b23",
    fontSize: 15,
  },

  multilineInput: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: "top",
  },

  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  choiceButton: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8d2c4",
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fbfaf6",
  },

  choiceButtonSelected: {
    backgroundColor: "#173f2b",
    borderColor: "#173f2b",
  },

  choiceText: {
    color: "#626a63",
    fontSize: 12,
    fontWeight: "800",
  },

  choiceTextSelected: {
    color: "#ffffff",
  },

  datePickerButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9d3c4",
    backgroundColor: "#fcfbf7",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  datePickerText: {
    flex: 1,
    color: "#1e2b23",
    fontSize: 15,
  },

  datePickerPlaceholder: {
    color: "#9a9f9b",
  },

  datePickerIcon: {
    fontSize: 20,
    marginLeft: 12,
  },

  datePickerWrap: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#fbfaf6",
    padding: 10,
    overflow: "hidden",
  },

  dateDoneButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  dateDoneText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  readOnlyBox: {
    backgroundColor: "#f2ede2",
    borderRadius: 14,
    padding: 15,
    marginBottom: 18,
  },

  readOnlyLabel: {
    color: "#9b752c",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  readOnlyValue: {
    color: "#173f2b",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },

  messageBox: {
    backgroundColor: "#f7f4ec",
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },

  messageText: {
    color: "#626a63",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontWeight: "700",
  },

  saveButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
  },

  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },

  disabledButton: {
    opacity: 0.65,
  },

  notice: {
    marginTop: 18,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#eee8d9",
  },

  noticeTitle: {
    color: "#b18a36",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },

  noticeText: {
    color: "#626a63",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
});
