import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
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

import * as ImagePicker from "expo-image-picker";

import * as ImageManipulator from "expo-image-manipulator";

import {
  ApiError,
} from "../api/client";

import {
  deleteProfilePicture,
  getCustomerProfile,
  updateCustomerProfile,
  uploadProfilePicture,
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
    pendingPhotoUri,
    setPendingPhotoUri,
  ] = useState<string | null>(
    null
  );

  const [
    photoBusy,
    setPhotoBusy,
  ] = useState(false);

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

  async function prepareSelectedPhoto(
    uri: string
  ) {
    setPhotoBusy(true);
    setMessage("");

    try {
      const result =
        await ImageManipulator.manipulateAsync(
          uri,
          [
            {
              resize: {
                width: 1024,
                height: 1024,
              },
            },
          ],
          {
            compress: 0.82,
            format:
              ImageManipulator.SaveFormat
                .JPEG,
          }
        );

      setPendingPhotoUri(
        result.uri
      );

      setMessage(
        "Photo ready. Preview it, rotate if needed, then tap Save Profile Picture."
      );
    } catch (error) {
      console.error(
        "Prepare profile picture error:",
        error
      );

      setMessage(
        "Unable to prepare that photo. Please try another image."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function chooseFromGallery() {
    setPhotoBusy(true);
    setMessage("");

    try {
      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setMessage(
          "Photo-library permission is required to choose a profile picture."
        );
        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
          });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      await prepareSelectedPhoto(
        result.assets[0].uri
      );
    } catch (error) {
      console.error(
        "Choose profile picture error:",
        error
      );

      setMessage(
        "Unable to open your photo library."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function takeProfilePhoto() {
    setPhotoBusy(true);
    setMessage("");

    try {
      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (!permission.granted) {
        setMessage(
          "Camera permission is required to take a profile picture."
        );
        return;
      }

      const result =
        await ImagePicker
          .launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
          });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      await prepareSelectedPhoto(
        result.assets[0].uri
      );
    } catch (error) {
      console.error(
        "Take profile picture error:",
        error
      );

      setMessage(
        "Unable to open the camera."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function openProfilePictureMenu() {
    if (photoBusy) {
      return;
    }

    const buttons: {
      text: string;
      onPress?: () => void;
      style?:
        | "default"
        | "cancel"
        | "destructive";
    }[] = [
      {
        text: "Take Photo",
        onPress: () => {
          void takeProfilePhoto();
        },
      },
      {
        text: "Choose from Gallery",
        onPress: () => {
          void chooseFromGallery();
        },
      },
    ];

    if (
      profile?.profile_picture_url ||
      profile?.profile_picture
    ) {
      buttons.push({
        text: "Remove Current Photo",
        style: "destructive",
        onPress: () => {
          confirmRemoveProfilePicture();
        },
      });
    }

    buttons.push({
      text: "Cancel",
      style: "cancel",
    });

    Alert.alert(
      "Profile Picture",
      "Choose how you would like to update your RUKHNAV profile picture.",
      buttons
    );
  }

  async function rotatePendingPhoto(
    degrees: number
  ) {
    if (
      !pendingPhotoUri ||
      photoBusy
    ) {
      return;
    }

    setPhotoBusy(true);

    try {
      const result =
        await ImageManipulator.manipulateAsync(
          pendingPhotoUri,
          [
            {
              rotate: degrees,
            },
          ],
          {
            compress: 0.82,
            format:
              ImageManipulator.SaveFormat
                .JPEG,
          }
        );

      setPendingPhotoUri(
        result.uri
      );
    } catch (error) {
      console.error(
        "Rotate profile picture error:",
        error
      );

      setMessage(
        "Unable to rotate the picture."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveProfilePicture() {
    if (
      !pendingPhotoUri ||
      photoBusy
    ) {
      return;
    }

    setPhotoBusy(true);
    setMessage("");

    try {
      const formData =
        new FormData();

      formData.append(
        "profile_picture",
        {
          uri: pendingPhotoUri,
          name:
            "rukhnav-profile.jpg",
          type: "image/jpeg",
        } as any
      );

      const result =
        await uploadProfilePicture(
          formData
        );

      if (result.profile) {
        setProfile(
          result.profile
        );
      }

      setPendingPhotoUri(null);

      setMessage(
        result.message ||
          "Profile picture saved successfully."
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
          "Unable to upload your profile picture."
        );
      }
    } finally {
      setPhotoBusy(false);
    }
  }

  function confirmRemoveProfilePicture() {
    Alert.alert(
      "Remove Profile Picture?",
      "Your current profile picture will be removed from your RUKHNAV account.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeProfilePicture();
          },
        },
      ]
    );
  }

  async function removeProfilePicture() {
    if (photoBusy) {
      return;
    }

    setPhotoBusy(true);
    setMessage("");

    try {
      const result =
        await deleteProfilePicture();

      setProfile(current =>
        current
          ? {
              ...current,
              profile_picture:
                null,
              profile_picture_url:
                null,
            }
          : current
      );

      setPendingPhotoUri(null);

      setMessage(
        result.message ||
          "Profile picture removed successfully."
      );
    } catch (error) {
      if (
        error instanceof ApiError
      ) {
        setMessage(
          error.message
        );
      } else {
        setMessage(
          "Unable to remove your profile picture."
        );
      }
    } finally {
      setPhotoBusy(false);
    }
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
              {
                pendingPhotoUri ||
                profile?.profile_picture_url
                  ? (
                    <Image
                      source={{
                        uri:
                          pendingPhotoUri ||
                          profile
                            ?.profile_picture_url ||
                          "",
                      }}
                      style={
                        styles.avatarImage
                      }
                    />
                  )
                  : (
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {fullName
                        .charAt(0)
                        .toUpperCase() ||
                        "R"}
                    </Text>
                  )
              }

              {photoBusy ? (
                <View
                  style={
                    styles.avatarLoading
                  }
                >
                  <ActivityIndicator
                    color="#ffffff"
                  />
                </View>
              ) : null}
            </View>

            <Pressable
              style={
                styles.photoButton
              }
              disabled={photoBusy}
              onPress={
                openProfilePictureMenu
              }
            >
              <Text
                style={
                  styles.photoButtonText
                }
              >
                {
                  profile?.profile_picture_url
                    ? "Change Profile Picture"
                    : "Add Profile Picture"
                }
              </Text>
            </Pressable>

            {pendingPhotoUri ? (
              <View
                style={
                  styles.photoStudioActions
                }
              >
                <View
                  style={
                    styles.rotateRow
                  }
                >
                  <Pressable
                    style={
                      styles.rotateButton
                    }
                    onPress={() =>
                      void rotatePendingPhoto(
                        -90
                      )
                    }
                    disabled={
                      photoBusy
                    }
                  >
                    <Text
                      style={
                        styles.rotateButtonText
                      }
                    >
                      ↺ Rotate Left
                    </Text>
                  </Pressable>

                  <Pressable
                    style={
                      styles.rotateButton
                    }
                    onPress={() =>
                      void rotatePendingPhoto(
                        90
                      )
                    }
                    disabled={
                      photoBusy
                    }
                  >
                    <Text
                      style={
                        styles.rotateButtonText
                      }
                    >
                      Rotate Right ↻
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={
                    styles.savePhotoButton
                  }
                  onPress={() =>
                    void saveProfilePicture()
                  }
                  disabled={
                    photoBusy
                  }
                >
                  {
                    photoBusy
                      ? (
                        <ActivityIndicator
                          color="#ffffff"
                        />
                      )
                      : (
                        <Text
                          style={
                            styles.savePhotoButtonText
                          }
                        >
                          Save Profile Picture
                        </Text>
                      )
                  }
                </Pressable>

                <Pressable
                  style={
                    styles.cancelPhotoButton
                  }
                  disabled={
                    photoBusy
                  }
                  onPress={() =>
                    setPendingPhotoUri(
                      null
                    )
                  }
                >
                  <Text
                    style={
                      styles.cancelPhotoButtonText
                    }
                  >
                    Cancel Photo Edit
                  </Text>
                </Pressable>
              </View>
            ) : null}

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

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 52,
  },

  avatarLoading: {
    ...StyleSheet.absoluteFill,
    borderRadius: 52,
    backgroundColor:
      "rgba(23,63,43,0.55)",
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

  photoStudioActions: {
    width: "100%",
    maxWidth: 420,
    marginTop: 10,
  },

  rotateRow: {
    flexDirection: "row",
    gap: 10,
  },

  rotateButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#b18a36",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  rotateButtonText: {
    color: "#173f2b",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },

  savePhotoButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#173f2b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  savePhotoButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },

  cancelPhotoButton: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },

  cancelPhotoButtonText: {
    color: "#8a6b2d",
    fontSize: 12,
    fontWeight: "800",
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
