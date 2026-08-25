import {
  apiRequest,
} from "./client";

export type CustomerProfile = {
  id?: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  referral_code?: string | null;

  profile_picture?: string | null;
  profile_picture_url?: string | null;

  gender?: string | null;
  date_of_birth?: string | null;
  skin_type?: string | null;
  hair_type?: string | null;

  address?: string | null;
  city?: string | null;
  country?: string | null;
  postal_code?: string | null;

  email_verified?: boolean;
  phone_verified?: boolean;

  email_reminders_enabled?: boolean;
  whatsapp_reminders_enabled?: boolean;
  sms_reminders_enabled?: boolean;
};

export type ProfileResponse = {
  success: boolean;
  message?: string;
  profile?: CustomerProfile;
};

export type UpdateProfilePayload = {
  full_name: string;
  email?: string | null;
  phone?: string | null;

  gender?: string | null;
  date_of_birth?: string | null;
  skin_type?: string | null;
  hair_type?: string | null;

  address?: string | null;
  city?: string | null;
  country?: string | null;
  postal_code?: string | null;
};

export type UpdateProfileResponse = {
  success: boolean;
  message?: string;
  verificationRequired?: boolean;
  profile?: CustomerProfile;
};

export type UploadProfilePictureResponse = {
  success: boolean;
  message?: string;
  image?: string | null;
  imageUrl?: string | null;
  profile?: CustomerProfile;
};

export async function getCustomerProfile() {
  return apiRequest<ProfileResponse>(
    "/profile",
    {
      authenticated: true,
    }
  );
}

export async function updateCustomerProfile(
  payload: UpdateProfilePayload
) {
  return apiRequest<UpdateProfileResponse>(
    "/profile",
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify(payload),
    }
  );
}

export async function uploadProfilePicture(
  formData: FormData
) {
  return apiRequest<UploadProfilePictureResponse>(
    "/profile/upload-picture",
    {
      method: "POST",
      authenticated: true,
      body: formData,
    }
  );
}

export async function deleteProfilePicture() {
  return apiRequest<{
    success: boolean;
    message?: string;
    image?: null;
    imageUrl?: null;
  }>(
    "/profile/picture",
    {
      method: "DELETE",
      authenticated: true,
    }
  );
}
