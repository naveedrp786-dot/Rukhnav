import {
  apiRequest,
} from "./client";

import {
  saveSession,
  type StoredCustomer,
} from "../auth/session";

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type LoginResponse = {
  success: boolean;
  message?: string;
  token?: string;
  customer?: StoredCustomer;
  verificationRequired?: boolean;
  verificationMethod?: string;
  identifierType?: string;
  identifier?: string;
  deletionRequested?: boolean;
  remainingAttempts?: number;
};

export type RegisterPayload = {
  full_name: string;
  email?: string;
  phone?: string;
  password: string;
  referral_code?: string;

  accept_terms: boolean;
  accept_privacy: boolean;
  accept_marketing?: boolean;

  terms_version?: string;
  privacy_version?: string;
};

export type RegisterResponse = {
  success: boolean;
  message?: string;
  customerId?: number;
  customer?: StoredCustomer;

  verificationRequired?: boolean;
  identifier?: string;
  verificationMethod?: string;
};

export async function login(
  payload: LoginPayload
) {
  const result =
    await apiRequest<LoginResponse>(
      "/customers/login",
      {
        method: "POST",
        body: JSON.stringify(
          payload
        ),
      }
    );

  if (!result.token) {
    throw new Error(
      "Login succeeded but no authentication token was returned."
    );
  }

  await saveSession(
    result.token,
    result.customer
  );

  return result;
}

export async function register(
  payload: RegisterPayload
) {
  return apiRequest<RegisterResponse>(
    "/customers/register",
    {
      method: "POST",
      body: JSON.stringify(
        payload
      ),
    }
  );
}

export async function getProfile() {
  return apiRequest<{
    success: boolean;
    customer?: StoredCustomer;
    profile?: StoredCustomer;
  }>(
    "/customers/profile",
    {
      authenticated: true,
    }
  );
}

// ========================================
// Customer Account Verification
// ========================================

export type VerificationRequestPayload = {
  identifier: string;
};

export type VerificationRequestResponse = {
  success: boolean;
  message?: string;
  identifier?: string;
  identifierType?: string;
  expiresInMinutes?: number;
};

export type VerificationConfirmPayload = {
  identifier: string;
  code: string;
};

export type VerificationConfirmResponse = {
  success: boolean;
  message?: string;
};

export async function requestVerificationCode(
  payload: VerificationRequestPayload
) {
  return apiRequest<VerificationRequestResponse>(
    "/customers/verification/request",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function confirmVerificationCode(
  payload: VerificationConfirmPayload
) {
  return apiRequest<VerificationConfirmResponse>(
    "/customers/verification/confirm",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// ========================================
// Customer Password Recovery
// ========================================

export type PasswordResetRequestPayload = {
  identifier: string;
};

export type PasswordResetRequestResponse = {
  success: boolean;
  message?: string;
  identifier?: string;
  expiresInMinutes?: number;
};

export type PasswordResetPayload = {
  identifier: string;
  code: string;
  new_password: string;
  confirm_password: string;
};

export type PasswordResetResponse = {
  success: boolean;
  message?: string;
};

export async function requestPasswordReset(
  payload: PasswordResetRequestPayload
) {
  return apiRequest<PasswordResetRequestResponse>(
    "/customers/password/forgot",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function resetPassword(
  payload: PasswordResetPayload
) {
  return apiRequest<PasswordResetResponse>(
    "/customers/password/reset",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// ========================================
// Customer Change Password
// ========================================

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export type ChangePasswordResponse = {
  success: boolean;
  message?: string;
};

export async function changePassword(
  payload: ChangePasswordPayload
) {
  return apiRequest<ChangePasswordResponse>(
    "/customers/account/password",
    {
      method: "PUT",
      authenticated: true,
      body: JSON.stringify(payload),
    }
  );
}
