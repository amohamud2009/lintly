export const PLANS = {
  free: {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    reviewsPerMonth: 10,
    securityScansPerMonth: 0,
    digestEmailsPerMonth: 0,
    chatMessagesPerMonth: 0,
    seats: 1,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 19.99,
    yearlyPrice: 191.99,
    yearlyMonthlyEquivalent: 239.88,
    yearlySavings: 47.89,
    reviewsPerMonth: 200,
    securityScansPerMonth: 100,
    digestEmailsPerMonth: 50,
    chatMessagesPerMonth: 100,
    seats: 1,
  },
  team: {
    name: "Team",
    monthlyPrice: 49.99,
    yearlyPrice: 479.99,
    yearlyMonthlyEquivalent: 599.88,
    yearlySavings: 119.89,
    baseReviewsPerMonth: 500,
    baseReviewsPerMonthYearly: 550,
    reviewsPerExtraSeat: 125,
    extraSeatPrice: 12.99,
    baseSeats: 4,
    maxSeats: 50,
    securityScansPerMonth: 200,
    digestEmailsPerMonth: 50,
    chatMessagesPerMonth: 200,
  },
  enterprise: {
    name: "Enterprise",
    contactEmail: "hello@lintly.dev",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export type FeatureKey =
  | "reviews"
  | "securityScans"
  | "digestEmails"
  | "chatMessages";

const featureToField: Record<FeatureKey, string> = {
  reviews: "reviewsPerMonth",
  securityScans: "securityScansPerMonth",
  digestEmails: "digestEmailsPerMonth",
  chatMessages: "chatMessagesPerMonth",
};

export function getTeamReviewLimit(
  totalSeats: number,
  billingInterval?: string
): number {
  const base = billingInterval === "year"
    ? PLANS.team.baseReviewsPerMonthYearly
    : PLANS.team.baseReviewsPerMonth;
  const extraSeats = Math.max(0, totalSeats - PLANS.team.baseSeats);
  return base + extraSeats * PLANS.team.reviewsPerExtraSeat;
}

export function getTeamMonthlyPrice(totalSeats: number): number {
  const extraSeats = Math.max(0, totalSeats - PLANS.team.baseSeats);
  return PLANS.team.monthlyPrice + extraSeats * PLANS.team.extraSeatPrice;
}

export function getFeatureLimit(
  plan: string,
  feature: FeatureKey,
  billingInterval?: string,
  totalSeats?: number
): number {
  if (plan === "enterprise") return Infinity;

  const planConfig = PLANS[plan as keyof typeof PLANS];
  if (!planConfig || !("securityScansPerMonth" in planConfig)) return 0;

  if (feature === "reviews" && plan === "team") {
    const seats = totalSeats ?? PLANS.team.baseSeats;
    return getTeamReviewLimit(seats, billingInterval);
  }

  const field = featureToField[feature];
  return (planConfig as unknown as Record<string, number>)[field] ?? 0;
}
