import { Property } from "../types/property.types";

export type RecommendationCategory =
  | "for_you"
  | "residential"
  | "commercial"
  | "investment"
  | "budget";

export interface UserAffinityProfile {
  viewedIds: string[];
  savedIds: string[];
  districtAffinity: Record<string, number>;
  intentAffinity: {
    residential: number;
    commercial: number;
    investment: number;
  };
  preferredDistrict?: string;
  preferredIntent?: "residential" | "commercial" | "investment";
  preferredBudgetMax?: number;
  lastUpdated: number;
}

const AFFINITY_STORAGE_KEY = "malikse_user_affinity_v1";

const DEFAULT_PROFILE: UserAffinityProfile = {
  viewedIds: [],
  savedIds: [],
  districtAffinity: {},
  intentAffinity: {
    residential: 0,
    commercial: 0,
    investment: 0,
  },
  lastUpdated: Date.now(),
};

/**
 * Retrieve the current user's local affinity profile from localStorage.
 */
export function getUserAffinity(): UserAffinityProfile {
  if (typeof window === "undefined" || !window.localStorage) {
    return DEFAULT_PROFILE;
  }
  try {
    const raw = window.localStorage.getItem(AFFINITY_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      districtAffinity: parsed.districtAffinity || {},
      intentAffinity: {
        ...DEFAULT_PROFILE.intentAffinity,
        ...(parsed.intentAffinity || {}),
      },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Persist the updated affinity profile.
 */
export function saveUserAffinity(profile: UserAffinityProfile): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    profile.lastUpdated = Date.now();
    window.localStorage.setItem(AFFINITY_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Record a user interaction with a property (viewing card, saving, clicking details).
 */
export function trackPropertyInteraction(
  property: Property,
  action: "view" | "save"
): void {
  const profile = getUserAffinity();
  const id = String(property._id || property.id || "");
  if (!id) return;

  if (action === "view") {
    if (!profile.viewedIds.includes(id)) {
      profile.viewedIds.unshift(id);
      if (profile.viewedIds.length > 30) profile.viewedIds.pop();
    }
  } else if (action === "save") {
    if (!profile.savedIds.includes(id)) {
      profile.savedIds.unshift(id);
    }
  }

  // Update district affinity
  const district = property.location?.district;
  if (district) {
    profile.districtAffinity[district] = (profile.districtAffinity[district] || 0) + (action === "save" ? 3 : 1);
  }

  // Detect purpose from title/tags
  const text = `${property.title || ""} ${property.type || ""} ${property.boundary || ""}`.toLowerCase();
  const isCommercial =
    text.includes("commercial") ||
    text.includes("industrial") ||
    text.includes("retail") ||
    text.includes("shop") ||
    text.includes("office") ||
    text.includes("highway") ||
    text.includes("nh-") ||
    text.includes("market");

  const isInvestment =
    text.includes("airport") ||
    text.includes("corridor") ||
    text.includes("tourism") ||
    text.includes("ring road") ||
    text.includes("aiims") ||
    text.includes("potential");

  const isResidential =
    text.includes("residential") ||
    text.includes("gated") ||
    text.includes("villa") ||
    text.includes("house") ||
    text.includes("bhk") ||
    text.includes("colony") ||
    text.includes("danapur") ||
    property.type === "house" ||
    property.type === "flat";

  const boost = action === "save" ? 3 : 1;
  if (isCommercial) profile.intentAffinity.commercial += boost;
  if (isInvestment) profile.intentAffinity.investment += boost;
  if (isResidential) profile.intentAffinity.residential += boost;

  saveUserAffinity(profile);
}

/**
 * Save explicit user preferences set via the "Customize Feed" modal.
 */
export function setUserCustomPreferences(prefs: {
  intent?: "residential" | "commercial" | "investment";
  district?: string;
  budgetMax?: number;
}): void {
  const profile = getUserAffinity();
  if (prefs.intent) profile.preferredIntent = prefs.intent;
  if (prefs.district) profile.preferredDistrict = prefs.district;
  if (prefs.budgetMax !== undefined) profile.preferredBudgetMax = prefs.budgetMax;
  saveUserAffinity(profile);
}

/**
 * Classify a property into its best use-cases.
 */
export function classifyProperty(property: Property): {
  isResidential: boolean;
  isCommercial: boolean;
  isInvestment: boolean;
  isBudget: boolean;
} {
  const text = `${property.title || ""} ${property.type || ""} ${property.location?.block || ""} ${property.location?.mauza || ""}`.toLowerCase();
  const price = property.price || 0;

  const isCommercial =
    text.includes("commercial") ||
    text.includes("industrial") ||
    text.includes("retail") ||
    text.includes("shop") ||
    text.includes("office") ||
    text.includes("highway") ||
    text.includes("nh-28") ||
    text.includes("nh-57") ||
    text.includes("chowk");

  const isInvestment =
    text.includes("airport") ||
    text.includes("corridor") ||
    text.includes("tourism") ||
    text.includes("ring road") ||
    text.includes("aiims") ||
    text.includes("bodh gaya") ||
    text.includes("bihta") ||
    text.includes("high-potential");

  const isResidential =
    text.includes("residential") ||
    text.includes("gated") ||
    text.includes("villa") ||
    text.includes("house") ||
    text.includes("danapur") ||
    text.includes("ready-to-build") ||
    property.type === "flat" ||
    property.type === "house" ||
    (!isCommercial && property.type === "land");

  const isBudget = price <= 5000000; // <= ₹50 Lakh

  return { isResidential, isCommercial, isInvestment, isBudget };
}

/**
 * Calculate dynamic recommendation score for "For You" personalized mode.
 */
function calculatePropertyScore(
  property: Property,
  profile: UserAffinityProfile,
  index: number
): number {
  let score = 50; // base score

  const district = property.location?.district;
  const { isResidential, isCommercial, isInvestment } = classifyProperty(property);

  // 1. Explicit preferences boost
  if (profile.preferredDistrict && district && profile.preferredDistrict.toLowerCase() === district.toLowerCase()) {
    score += 40;
  }
  if (profile.preferredIntent) {
    if (profile.preferredIntent === "commercial" && isCommercial) score += 35;
    if (profile.preferredIntent === "residential" && isResidential) score += 35;
    if (profile.preferredIntent === "investment" && isInvestment) score += 35;
  }
  if (profile.preferredBudgetMax && property.price && property.price <= profile.preferredBudgetMax) {
    score += 25;
  }

  // 2. Behavioral district affinity boost
  if (district && profile.districtAffinity[district]) {
    score += Math.min(30, profile.districtAffinity[district] * 6);
  }

  // 3. Behavioral intent affinity boost
  if (isCommercial && profile.intentAffinity.commercial > 0) {
    score += Math.min(25, profile.intentAffinity.commercial * 5);
  }
  if (isResidential && profile.intentAffinity.residential > 0) {
    score += Math.min(25, profile.intentAffinity.residential * 5);
  }
  if (isInvestment && profile.intentAffinity.investment > 0) {
    score += Math.min(25, profile.intentAffinity.investment * 5);
  }

  // 4. Saved or viewed boost
  const id = String(property._id || property.id || "");
  if (profile.savedIds.includes(id)) {
    score += 20;
  }
  if (profile.viewedIds.includes(id)) {
    score += 10;
  }

  // 5. Verification badge score
  if (property.verified || property.badges?.fullyVerified) {
    score += 15;
  }

  // 6. Cold-start balancing (introduce diversity if user has no history)
  const hasHistory =
    profile.viewedIds.length > 0 ||
    profile.savedIds.length > 0 ||
    profile.preferredDistrict ||
    profile.preferredIntent;

  if (!hasHistory) {
    const hash = (id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + index * 7) % 20;
    score += hash;
  }

  return score;
}

/**
 * Filter and sort properties dynamically according to the chosen recommendation category.
 */
export function getRecommendedProperties(
  properties: Property[],
  category: RecommendationCategory,
  userProfile?: UserAffinityProfile
): Property[] {
  const profile = userProfile || getUserAffinity();
  const list = [...properties];

  if (category === "for_you") {
    const scored = list.map((p, idx) => ({
      property: p,
      score: calculatePropertyScore(p, profile, idx),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.property);
  }

  if (category === "residential") {
    return list
      .filter((p) => classifyProperty(p).isResidential)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
  }

  if (category === "commercial") {
    return list
      .filter((p) => classifyProperty(p).isCommercial)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
  }

  if (category === "investment") {
    return list
      .filter((p) => classifyProperty(p).isInvestment)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
  }

  if (category === "budget") {
    return list
      .filter((p) => classifyProperty(p).isBudget)
      .sort((a, b) => (a.price || 0) - (b.price || 0));
  }

  return list;
}

/**
 * Return a contextual badge to render on the recommended property card.
 */
export function getPropertyRecommendationBadge(
  property: Property,
  category: RecommendationCategory,
  userProfile?: UserAffinityProfile
): { text: string; icon: string; bg: string; color: string } {
  const { isResidential, isCommercial, isInvestment } = classifyProperty(property);
  const profile = userProfile || getUserAffinity();
  const district = property.location?.district;

  if (category === "for_you") {
    if (profile.preferredDistrict && district && profile.preferredDistrict.toLowerCase() === district.toLowerCase()) {
      return {
        text: `Top Match in ${district}`,
        icon: "stars",
        bg: "#FEF3C7",
        color: "#92400E",
      };
    }
    if (isInvestment) {
      return {
        text: "High-Growth Hub",
        icon: "trending-up",
        bg: "#F0FDF4",
        color: "#166534",
      };
    }
    if (isCommercial) {
      return {
        text: "Prime Commercial",
        icon: "business",
        bg: "#EFF6FF",
        color: "#1D4ED8",
      };
    }
    return {
      text: "Recommended for You",
      icon: "auto-awesome",
      bg: "#F5F3FF",
      color: "#6D28D9",
    };
  }

  if (category === "residential") {
    return {
      text: "Ideal for Home / Villa",
      icon: "home",
      bg: "#F0FDF4",
      color: "#166534",
    };
  }

  if (category === "commercial") {
    return {
      text: "High Footfall Commercial",
      icon: "storefront",
      bg: "#EFF6FF",
      color: "#1D4ED8",
    };
  }

  if (category === "investment") {
    return {
      text: "Fast Appreciation Corridor",
      icon: "rocket-launch",
      bg: "#FEF2F2",
      color: "#B91C1C",
    };
  }

  if (category === "budget") {
    return {
      text: "Under ₹50 Lakh Value",
      icon: "savings",
      bg: "#FDF4FF",
      color: "#86198F",
    };
  }

  return {
    text: "Title Verified",
    icon: "verified",
    bg: "#ECFDF5",
    color: "#059669",
  };
}
