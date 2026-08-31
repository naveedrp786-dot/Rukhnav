import {
  apiRequest,
} from "./client";


export type LoyaltyBenefits = {
  pointsMultiplier: number;
  discountPercentage: number;
  birthdayBonusPoints: number;
  referralBonusPoints: number;
  eventMenuEnabled: boolean;
  emailRemindersEnabled: boolean;
  whatsappRemindersEnabled: boolean;
  smsRemindersEnabled: boolean;
  prioritySupportEnabled: boolean;
  freeDeliveryEnabled: boolean;
};


export type LoyaltyNextCategory = {
  name: string;
  requiredLifetimePoints: number;
  pointsNeeded: number;
};


export type LoyaltySummary = {
  customerId: number;
  fullName: string;
  availablePoints: number;
  lifetimePoints: number;
  membershipLevel: string;
  membershipChangedAt: string | null;
  totalSpent: number;
  totalOrders: number;

  benefits: LoyaltyBenefits;

  nextCategory:
    LoyaltyNextCategory | null;

  highestCategory: boolean;
};


type LoyaltyResponse = {
  success: boolean;
  message?: string;
  loyalty: LoyaltySummary;
};


export async function getMyLoyaltySummary() {
  const data =
    await apiRequest<LoyaltyResponse>(
      "/customer-loyalty/me",
      {
        authenticated: true,
      }
    );

  return data.loyalty;
}
