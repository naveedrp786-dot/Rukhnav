import {
  apiRequest,
} from "./client";

export type PushPlatform =
  | "android"
  | "ios";

export type PushDevice = {
  id: number;
  platform: PushPlatform;
  device_name?: string | null;
  device_id?: string | null;
  is_active: boolean | number;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RegisterPushDeviceResponse = {
  success: boolean;
  message?: string;
  device?: PushDevice;
};

type UnregisterPushDeviceResponse = {
  success: boolean;
  message?: string;
};

type PushDevicesResponse = {
  success: boolean;
  devices: PushDevice[];
};

export async function registerPushDevice(
  expoPushToken: string,
  platform: PushPlatform,
  deviceName?: string | null,
  deviceId?: string | null
) {
  return apiRequest<RegisterPushDeviceResponse>(
    "/customers/push-devices",
    {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({
        expo_push_token:
          expoPushToken,
        platform,
        device_name:
          deviceName || null,
        device_id:
          deviceId || null,
      }),
    }
  );
}

export async function unregisterPushDevice(
  expoPushToken: string
) {
  return apiRequest<UnregisterPushDeviceResponse>(
    "/customers/push-devices",
    {
      method: "DELETE",
      authenticated: true,
      body: JSON.stringify({
        expo_push_token:
          expoPushToken,
      }),
    }
  );
}

export async function getPushDevices() {
  return apiRequest<PushDevicesResponse>(
    "/customers/push-devices",
    {
      authenticated: true,
    }
  );
}
