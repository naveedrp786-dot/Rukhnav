import {
  Platform,
} from "react-native";

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import {
  registerPushDevice,
} from "../api/pushNotifications";

export type PushRegistrationResult = {
  registered: boolean;
  reason?: string;
};

function getProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas
      ?.projectId ||
    ""
  );
}

export async function configurePushNotifications() {
  if (Platform.OS === "android") {
    await Notifications
      .setNotificationChannelAsync(
        "rukhnav-default",
        {
          name:
            "RUKHNAV Notifications",
          importance:
            Notifications
              .AndroidImportance
              .HIGH,
          vibrationPattern: [
            0,
            250,
            250,
            250,
          ],
          lockscreenVisibility:
            Notifications
              .AndroidNotificationVisibility
              .PUBLIC,
        }
      );
  }
}

export async function registerForPushNotifications():
  Promise<PushRegistrationResult> {

  if (!Device.isDevice) {
    return {
      registered: false,
      reason:
        "Push notifications require a physical device.",
    };
  }

  if (
    Platform.OS !== "android" &&
    Platform.OS !== "ios"
  ) {
    return {
      registered: false,
      reason:
        "Push notifications are supported only on Android and iOS.",
    };
  }

  await configurePushNotifications();

  const currentPermissions =
    await Notifications
      .getPermissionsAsync();

  let finalStatus =
    currentPermissions.status;

  if (
    finalStatus !== "granted"
  ) {
    const requested =
      await Notifications
        .requestPermissionsAsync();

    finalStatus =
      requested.status;
  }

  if (
    finalStatus !== "granted"
  ) {
    return {
      registered: false,
      reason:
        "Notification permission was not granted.",
    };
  }

  const projectId =
    getProjectId();

  if (!projectId) {
    return {
      registered: false,
      reason:
        "Expo EAS project ID is missing.",
    };
  }

  const tokenResult =
    await Notifications
      .getExpoPushTokenAsync({
        projectId,
      });

  const expoPushToken =
    tokenResult.data;

  if (!expoPushToken) {
    return {
      registered: false,
      reason:
        "Expo did not return a push token.",
    };
  }

  await registerPushDevice(
    expoPushToken,
    Platform.OS,
    Device.deviceName ||
      Device.modelName ||
      null,
    null
  );

  return {
    registered: true,
  };
}
