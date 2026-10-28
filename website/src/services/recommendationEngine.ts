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

export interface RecommendationBadge {
  text: string;
  icon: string;
  bg: string;
  color: string;
}

export interface RecommendedPropertyItem {
  property: Property;
  badge: RecommendationBadge;
  score: number;
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
  lastUpdated: 0,
};

// In-Memory Profile Cache for O(1) synchronous reads without disk I/O
let memoryProfile: UserAffinityProfile | null = null;
let saveDebounceTimer: any = null;

// WeakMap cache for property classification to avoid repetitive string searching
const classifyCache = new WeakMap<
  Property,
  {
    isResidential: boolean;
    isCommercial: boolean;
    isInvestment: boolean;
    isBudget: boolean;
  }
>();

// Badge cache to prevent repeated badge object allocation
const badgeCache = new Map<string, RecommendationBadge>();

/**
 * Retrieve the user's affinity profile with O(1) in-memory cache.
 */
export function getUserAffinity(): UserAffinityProfile {
  if (memoryProfile) {
    return memoryProfile;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_PROFILE, lastUpdated: Date.now() };
  }

  try {
    const raw = window.localStorage.getItem(AFFINITY_STORAGE_KEY);
    if (!raw) {
      memoryProfile = { ...DEFAULT_PROFILE, lastUpdated: Date.now() };
      return memoryProfile;
    }
    const parsed = JSON.parse(raw);
    memoryProfile = {
      ...DEFAULT_PROFILE,
      ...parsed,
      districtAffinity: parsed.districtAffinity || {},
      intentAffinity: {
        ...DEFAULT_PROFILE.intentAffinity,
        ...(parsed.intentAffinity || {}),
      },
    };
    return memoryProfile;
  } catch {
    memoryProfile = { ...DEFAULT_PROFILE, lastUpdated: Date.now() };
    return memoryProfile;
  }
}

/**
 * Persist the updated affinity profile in-memory immediately, and flush to localStorage asynchronously.
 */
export function saveUserAffinity(profile: UserAffinityProfile, immediate = false): void {
  profile.lastUpdated = Date.now();
  memoryProfile = profile;

  if (typeof window === "undefined" || !window.localStorage) return;

  const flush = () => {
    try {
      window.localStorage.setItem(AFFINITY_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore quota errors
    }
  };

  if (immediate) {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    flush();
  } else {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(flush, 300);
  }
}

/**
 * Non-blocking interaction recording.
 */
export function trackPropertyInteraction(
  property: Property,
  action: "view" | "save"
): void {
  const profile = getUserAffinity();
  const id = String(property._id || property.id || "");
  if (!id) return;

  let changed = false;

  if (action === "view") {
    if (!profile.viewedIds.includes(id)) {
      profile.viewedIds.unshift(id);
      if (profile.viewedIds.length > 30) profile.viewedIds.pop();
      changed = true;
    }
  } else if (action === "save") {
    if (!profile.savedIds.includes(id)) {
      profile.savedIds.unshift(id);
      changed = true;
    }
  }

  const district = property.location?.district;
  if (district) {
    profile.districtAffinity[district] = (profile.districtAffinity[district] || 0) + (action === "save" ? 3 : 1);
    changed = true;
  }

  const { isCommercial, isInvestment, isResidential } = classifyProperty(property);
  const boost = action === "save" ? 3 : 1;
  if (isCommercial) {
    profile.intentAffinity.commercial += boost;
    changed = true;
  }
  if (isInvestment) {
    profile.intentAffinity.investment += boost;
    changed = true;
  }
  if (isResidential) {
    profile.intentAffinity.residential += boost;
    changed = true;
  }

  if (changed) {
    saveUserAffinity(profile, false);
  }
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
  saveUserAffinity(profile, true);
}

/**
 * Classify a property into its best use-cases with WeakMap caching.
 */
export function classifyProperty(property: Property): {
  isResidential: boolean;
  isCommercial: boolean;
  isInvestment: boolean;
  isBudget: boolean;
} {
  const cached = classifyCache.get(property);
  if (cached) return cached;

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

  const result = { isResidential, isCommercial, isInvestment, isBudget };
  classifyCache.set(property, result);
  return result;
}

/**
 * Calculate dynamic recommendation score for "For You" personalized mode.
 */
function calculatePropertyScore(
  property: Property,
  profile: UserAffinityProfile,
  index: number
): number {
  let score = 50;

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

  if (!hasHistory && id) {
    const hash = (id.charCodeAt(0) + index * 7) % 20;
    score += hash;
  }

  return score;
}

/**
 * Filter and sort properties dynamically according to the chosen recommendation category.
 * Returns up to `limit` properties (default 16) for high-performance 60fps rendering.
 */
export function getRecommendedProperties(
  properties: Property[],
  category: RecommendationCategory,
  userProfile?: UserAffinityProfile,
  limit = 16
): Property[] {
  if (!properties || properties.length === 0) return [];
  const profile = userProfile || getUserAffinity();
  const list = [...properties];

  let sorted: Property[];

  if (category === "for_you") {
    const scored = list.map((p, idx) => ({
      property: p,
      score: calculatePropertyScore(p, profile, idx),
    }));
    scored.sort((a, b) => b.score - a.score);
    sorted = scored.map((s) => s.property);
  } else if (category === "residential") {
    sorted = list
      .filter((p) => classifyProperty(p).isResidential)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
  } else if (category === "commercial") {
    sorted = list
      .filter((p) => classifyProperty(p).isCommercial)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
  } else if (category === "investment") {
    sorted = list
      .filter((p) => classifyProperty(p).isInvestment)
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
  } else if (category === "budget") {
    sorted = list
      .filter((p) => classifyProperty(p).isBudget)
      .sort((a, b) => (a.price || 0) - (b.price || 0));
  } else {
    sorted = list;
  }

  // Fallback if category filter returns too few
  if (sorted.length === 0) {
    sorted = list;
  }

  return limit > 0 ? sorted.slice(0, limit) : sorted;
}

/**
 * Return a contextual badge to render on the recommended property card.
 * Uses cached results to avoid repeated string searches.
 */
export function getPropertyRecommendationBadge(
  property: Property,
  category: RecommendationCategory,
  userProfile?: UserAffinityProfile
): RecommendationBadge {
  const profile = userProfile || getUserAffinity();
  const district = property.location?.district;
  const propId = String(property._id || property.id || "");
  const cacheKey = `${propId}_${category}_${profile.preferredDistrict || ""}`;

  const cached = badgeCache.get(cacheKey);
  if (cached) return cached;

  const { isResidential, isCommercial, isInvestment } = classifyProperty(property);

  let badge: RecommendationBadge;

  if (category === "for_you") {
    if (profile.preferredDistrict && district && profile.preferredDistrict.toLowerCase() === district.toLowerCase()) {
      badge = {
        text: `Top Match in ${district}`,
        icon: "stars",
        bg: "#FEF3C7",
        color: "#92400E",
      };
    } else if (isInvestment) {
      badge = {
        text: "High-Growth Hub",
        icon: "trending-up",
        bg: "#F0FDF4",
        color: "#166534",
      };
    } else if (isCommercial) {
      badge = {
        text: "Prime Commercial",
        icon: "business",
        bg: "#EFF6FF",
        color: "#1D4ED8",
      };
    } else {
      badge = {
        text: "Recommended for You",
        icon: "auto-awesome",
        bg: "#F5F3FF",
        color: "#6D28D9",
      };
    }
  } else if (category === "residential") {
    badge = {
      text: "Ideal for Home / Villa",
      icon: "home",
      bg: "#F0FDF4",
      color: "#166534",
    };
  } else if (category === "commercial") {
    badge = {
      text: "High Footfall Commercial",
      icon: "storefront",
      bg: "#EFF6FF",
      color: "#1D4ED8",
    };
  } else if (category === "investment") {
    badge = {
      text: "Fast Appreciation Corridor",
      icon: "rocket-launch",
      bg: "#FEF2F2",
      color: "#B91C1C",
    };
  } else if (category === "budget") {
    badge = {
      text: "Under ₹50 Lakh Value",
      icon: "savings",
      bg: "#FDF4FF",
      color: "#86198F",
    };
  } else {
    badge = {
      text: "Title Verified",
      icon: "verified",
      bg: "#ECFDF5",
      color: "#059669",
    };
  }

  badgeCache.set(cacheKey, badge);
  return badge;
}
