import NotificationFailures from "./NotificationFailures";
import { premiumStyles } from "../constants/typography";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Image from "./PropertyImage";
import { MaterialIcons } from "@/web/icons";
import { useRouter, type Href } from "@/web/navigation";
import { useAuthStore } from "../src/store/authStore";
import type { UserRole } from "../src/types/auth.types";
import api, { authService } from "../src/services/authService";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

export type DashboardSection = {
  title: string;
  description: string;
  route?: Href;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  tag?: string;
  badge?: string;
  accentColor?: string;
  actionLabel?: string;
};

export interface RoleDashboardProps {
  role: UserRole;
  title: string;
  subtitle: string;
  sections?: DashboardSection[];
}

export default function RoleDashboard({
  role,
  title,
  subtitle,
  sections,
}: RoleDashboardProps) {
  const router = useRouter();
  const { user, authState } = useAuthStore();
  const { width } = useWindowDimensions();
  const compact = width < 768;
  const isTablet = width >= 768 && width < 1100;
  const cardWidth = compact ? "100%" : isTablet ? "48.5%" : "31.8%";

  const isKycDone = Boolean(user?.isVerifiedIdentity || user?.demoKycComplete);

  // Live portfolio metrics
  const [listings, setListings] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (authState !== "AUTHENTICATED" || !user) return;
    let active = true;

    Promise.allSettled([
      api.get("/properties/mine"),
      api.get("/users/wishlist"),
      api.get("/inquiries"),
    ])
      .then(([listingsRes, wishlistRes, inquiriesRes]) => {
        if (!active) return;
        if (listingsRes.status === "fulfilled" && Array.isArray(listingsRes.value.data)) {
          setListings(listingsRes.value.data);
        }
        if (wishlistRes.status === "fulfilled" && Array.isArray(wishlistRes.value.data)) {
          setWishlist(wishlistRes.value.data);
        }
        if (inquiriesRes.status === "fulfilled" && Array.isArray(inquiriesRes.value.data)) {
          setInquiries(inquiriesRes.value.data);
        }
      })
      .catch(() => {
        // silent fallback
      })
      .finally(() => {
        if (active) setLoadingStats(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id, authState]);

  const formatPrice = (n: number | string) => {
    const num = Number(n);
    if (isNaN(num) || num <= 0) return "Price on Request";
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} Lakh`;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  if (authState !== "AUTHENTICATED" || user?.role !== role) {
    return (
      <View style={styles.screen}>
        <AppHeader showNavLinks={false} showPostPropertyBtn={false} showHomeButton showBack={false} />
        <View style={styles.accessPanel}>
          <View style={styles.iconBox}>
            <MaterialIcons name="lock-outline" size={28} color="#0A45B5" />
          </View>
          <Text style={styles.panelTitle}>Sign in as {role}</Text>
          <Text style={styles.panelSubtitle}>This dashboard is available to the {role} role.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.darkButton}
            onPress={() => router.replace("/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.darkLabel}>Go to sign in</Text>
            <MaterialIcons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Fallback default sections if none provided
  const displaySections: DashboardSection[] = sections && sections.length > 0 ? sections : [
    {
      title: "My Listings",
      description: "Manage properties you posted and check buyer interest.",
      route: "/my-properties",
      icon: "home-work",
      tag: "Portfolio",
      accentColor: "#0A45B5",
      actionLabel: "Manage listings",
    },
    {
      title: "Saved Properties",
      description: "View and compare properties you bookmarked.",
      route: "/saved",
      icon: "bookmark-border",
      tag: "Wishlist",
      accentColor: "#E11D48",
      actionLabel: "View saved",
    },
    {
      title: "Identity & KYC",
      description: isKycDone
        ? "Your identity is verified. You can list properties and make offers."
        : "Quick verification to list properties and contact owners directly.",
      route: "/kyc",
      icon: "verified-user",
      tag: isKycDone ? "Certified ✓" : "Required",
      accentColor: "#059669",
      actionLabel: isKycDone ? "View status" : "Verify now",
    },
    {
      title: "Chats & Inquiries",
      description: "Chat with buyers, sellers, and your assigned advisor.",
      route: "/messages",
      icon: "chat-bubble-outline",
      tag: "Messages",
      accentColor: "#7C3AED",
      actionLabel: "Open chats",
    },
    {
      title: "Draw Plot on Map",
      description: "Pin boundary points on satellite map to calculate area in Kattha & Sq.Ft.",
      route: "/post",
      icon: "layers",
      tag: "Satellite Map",
      accentColor: "#0284C7",
      actionLabel: "Start mapping",
    },
    {
      title: "Circle Rates & Trends",
      description: "Check government circle rates and locality price trends.",
      route: "/insights",
      icon: "insights",
      tag: "Price Trends",
      accentColor: "#0F766E",
      actionLabel: "View rates",
    },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader showBack={false} showNavLinks={true} showPostPropertyBtn={true} />

      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
        {/* Workspace Topline Breadcrumb & Status */}
        <View style={styles.topline}>
          <View style={styles.breadcrumbGroup}>
            <MaterialIcons name="space-dashboard" size={15} color="#0A45B5" />
            <Text style={styles.eyebrow}>MALIKSE / WORKSPACE COMMAND CENTER</Text>
          </View>
          <View style={styles.toplineRight}>
            {isKycDone && (
              <View style={styles.verifiedPill}>
                <MaterialIcons name="verified" size={13} color="#059669" />
                <Text style={styles.verifiedPillText}>Verified Citizen</Text>
              </View>
            )}
            <View style={styles.rolePill}>
              <View style={styles.roleDot} />
              <Text style={styles.roleText}>{role}</Text>
            </View>
          </View>
        </View>

        {/* Title Row - Executive Header with Quick Action CTAs */}
        <View style={[styles.titleRow, compact && styles.titleRowCompact]}>
          <View style={styles.titleTextContainer}>
            <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.headerCtaGroup}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.primaryPostBtn}
              onPress={() => router.push("/post")}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryPostBtnLabel}>Post Property</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.secondaryExploreBtn}
              onPress={() => router.push("/home")}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryExploreBtnLabel}>Explore Spaces</Text>
              <MaterialIcons name="north-east" size={15} color="#0A45B5" />
            </TouchableOpacity>
          </View>
        </View>
        {role === "admin" && <NotificationFailures />}

        {/* KPI Performance & Portfolio Metrics Bar */}
        <View style={styles.metricsGrid}>
          {/* Card 1: My Listings */}
          <TouchableOpacity
            style={[styles.metricCard, compact && styles.metricCardCompact]}
            onPress={() => router.push("/my-properties")}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                <MaterialIcons name="domain" size={20} color="#0A45B5" />
              </View>
              <View style={[styles.metricBadge, { backgroundColor: "#EFF6FF" }]}>
                <Text style={[styles.metricBadgeText, { color: "#0A45B5" }]}>Portfolio</Text>
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loadingStats ? "..." : listings.length}
            </Text>
            <Text style={styles.metricLabel}>Active Listings</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricActionText, { color: "#0A45B5" }]}>Manage portfolio</Text>
              <MaterialIcons name="arrow-forward" size={13} color="#0A45B5" />
            </View>
          </TouchableOpacity>

          {/* Card 2: Wishlist */}
          <TouchableOpacity
            style={[styles.metricCard, compact && styles.metricCardCompact]}
            onPress={() => router.push("/saved")}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
                <MaterialIcons name="favorite-border" size={20} color="#E11D48" />
              </View>
              <View style={[styles.metricBadge, { backgroundColor: "#FEF2F2" }]}>
                <Text style={[styles.metricBadgeText, { color: "#E11D48" }]}>Wishlist</Text>
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loadingStats ? "..." : wishlist.length}
            </Text>
            <Text style={styles.metricLabel}>Saved Properties</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricActionText, { color: "#E11D48" }]}>View wishlist</Text>
              <MaterialIcons name="arrow-forward" size={13} color="#E11D48" />
            </View>
          </TouchableOpacity>

          {/* Card 3: Bihar Land KYC */}
          <TouchableOpacity
            style={[styles.metricCard, compact && styles.metricCardCompact]}
            onPress={() => router.push("/kyc")}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardHeader}>
              <View
                style={[
                  styles.metricIconWrap,
                  { backgroundColor: isKycDone ? "#ECFDF5" : "#FFFBEB" },
                ]}
              >
                <MaterialIcons
                  name={isKycDone ? "verified-user" : "pending-actions"}
                  size={20}
                  color={isKycDone ? "#059669" : "#D97706"}
                />
              </View>
              <View
                style={[
                  styles.metricBadge,
                  { backgroundColor: isKycDone ? "#ECFDF5" : "#FFFBEB" },
                ]}
              >
                <Text
                  style={[
                    styles.metricBadgeText,
                    { color: isKycDone ? "#059669" : "#D97706" },
                  ]}
                >
                  {isKycDone ? "Certified" : "Action Req."}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.metricNumber,
                { fontSize: 20, paddingTop: 4, letterSpacing: -0.4 },
              ]}
            >
              {isKycDone ? "Verified ✓" : "Pending KYC"}
            </Text>
            <Text style={styles.metricLabel}>Bihar 7-Point Land Check</Text>
            <View style={styles.metricFooter}>
              <Text
                style={[
                  styles.metricActionText,
                  { color: isKycDone ? "#059669" : "#D97706" },
                ]}
              >
                {isKycDone ? "View certification" : "Complete check"}
              </Text>
              <MaterialIcons
                name="arrow-forward"
                size={13}
                color={isKycDone ? "#059669" : "#D97706"}
              />
            </View>
          </TouchableOpacity>

          {/* Card 4: Inquiries */}
          <TouchableOpacity
            style={[styles.metricCard, compact && styles.metricCardCompact]}
            onPress={() => router.push("/messages")}
            activeOpacity={0.88}
          >
            <View style={styles.metricCardHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#F5F3FF" }]}>
                <MaterialIcons name="chat-bubble-outline" size={20} color="#7C3AED" />
              </View>
              <View style={[styles.metricBadge, { backgroundColor: "#F5F3FF" }]}>
                <Text style={[styles.metricBadgeText, { color: "#7C3AED" }]}>Inquiries</Text>
              </View>
            </View>
            <Text style={styles.metricNumber}>
              {loadingStats ? "..." : inquiries.length}
            </Text>
            <Text style={styles.metricLabel}>Deal Conversations</Text>
            <View style={styles.metricFooter}>
              <Text style={[styles.metricActionText, { color: "#7C3AED" }]}>Open messages</Text>
              <MaterialIcons name="arrow-forward" size={13} color="#7C3AED" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Luxury Architectural Hero Showcase */}
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <Image
            source={{ uri: new URL("../assets/saved_villa_house.jpg", import.meta.url).href }}
            style={styles.heroBackground}
            resizeMode="cover"
          />
          <View
            style={[
              styles.heroShade,
              Platform.OS === "web"
                ? ({
                    background:
                      "linear-gradient(135deg, rgba(11, 27, 63, 0.95) 0%, rgba(10, 69, 181, 0.82) 50%, rgba(11, 27, 63, 0.90) 100%)",
                  } as any)
                : undefined,
            ]}
          />
          <View style={styles.heroCopy}>
            <View style={styles.welcomePill}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
              <Text style={styles.welcome}>Welcome back, {user.name || "Nikhil"}</Text>
              {isKycDone && (
                <View style={styles.verifiedMiniTag}>
                  <MaterialIcons name="check-circle" size={12} color="#34D399" />
                  <Text style={styles.verifiedMiniTagText}>Verified Account</Text>
                </View>
              )}
            </View>

            <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>
              Direct Cadastral Land &{"\n"}Premium Spaces in Bihar.
            </Text>

            <Text style={styles.heroDescription}>
              High-resolution satellite plot boundary pinning, certified Khatiyan registry records, and verified direct contact with zero broker friction.
            </Text>

            <View style={[styles.heroActionRow, compact && styles.heroActionRowCompact]}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.whiteButton}
                onPress={() => router.push("/post")}
                activeOpacity={0.88}
              >
                <MaterialIcons name="add" size={18} color="#0A45B5" />
                <Text style={styles.whiteLabel}>Post New Property</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.heroGlassBtn}
                onPress={() => router.push("/home")}
                activeOpacity={0.88}
              >
                <Text style={styles.heroGlassLabel}>Explore Marketplace</Text>
                <MaterialIcons name="north-east" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Feature Highlights Strip inside Hero */}
            <View style={[styles.heroFeatureStrip, compact && styles.heroFeatureStripCompact]}>
              <View style={styles.heroFeatureItem}>
                <MaterialIcons name="layers" size={14} color="#60A5FA" />
                <Text style={styles.heroFeatureText}>Sub-meter Cadastral Pinning</Text>
              </View>
              <View style={styles.heroFeatureItem}>
                <MaterialIcons name="verified" size={14} color="#34D399" />
                <Text style={styles.heroFeatureText}>7-Point Legal Ownership Check</Text>
              </View>
              <View style={styles.heroFeatureItem}>
                <MaterialIcons name="check-circle" size={14} color="#FBBF24" />
                <Text style={styles.heroFeatureText}>0% Brokerage Direct Deals</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section Heading for Tools */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.eyebrow}>QUICK ACTIONS</Text>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Everything you need in one place
            </Text>
          </View>
          <Text style={styles.sectionNote}>Shortcuts & tools</Text>
        </View>

        {/* Tools Cards Grid */}
        <View style={styles.grid}>
          {displaySections.map((section, index) => {
            const isEnabled = Boolean(section.route);
            const iconName =
              section.icon || (index === 0 ? "home-work" : index === 1 ? "bookmark-border" : "space-dashboard");
            const accent = section.accentColor || "#0A45B5";

            // Dynamic badges
            let dynamicTag = section.tag;
            if (section.route === "/my-properties") {
              dynamicTag = listings.length > 0 ? `${listings.length} Active` : "0 Listed";
            } else if (section.route === "/saved") {
              dynamicTag = wishlist.length > 0 ? `${wishlist.length} Saved` : "0 Saved";
            } else if (section.route === "/messages") {
              dynamicTag = inquiries.length > 0 ? `${inquiries.length} Active` : "0 Messages";
            }

            return (
              <TouchableOpacity
                key={section.title}
                accessibilityRole="button"
                accessibilityState={{ disabled: !isEnabled }}
                style={[
                  styles.card,
                  { width: cardWidth },
                  !isEnabled && styles.disabledCard,
                ]}
                disabled={!isEnabled}
                onPress={() => section.route && router.push(section.route)}
                activeOpacity={0.88}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
                    <MaterialIcons name={iconName} size={22} color={accent} />
                  </View>
                  {dynamicTag ? (
                    <View style={[styles.cardTag, { backgroundColor: `${accent}10` }]}>
                      <Text style={[styles.cardTagText, { color: accent }]}>{dynamicTag}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.cardTitle}>{section.title}</Text>
                <Text style={styles.cardDescription}>{section.description}</Text>

                <View style={styles.cardBottom}>
                  <Text style={[styles.cardAction, { color: accent }]}>
                    {section.actionLabel || (isEnabled ? "Open" : "Coming soon")}
                  </Text>
                  <View style={[styles.arrowCircle, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
                    <MaterialIcons
                      name={isEnabled ? "north-east" : "schedule"}
                      size={16}
                      color={accent}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Portfolio Preview or Promo Banner */}
        {listings.length > 0 ? (
          <View style={styles.portfolioSection}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>YOUR PROPERTIES</Text>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Active Portfolio Preview
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => router.push("/my-properties")}
                activeOpacity={0.75}
              >
                <Text style={styles.viewAllText}>View all ({listings.length})</Text>
                <MaterialIcons name="arrow-forward" size={15} color="#0A45B5" />
              </TouchableOpacity>
            </View>

            <View style={styles.portfolioGrid}>
              {listings.slice(0, 3).map((item: any) => {
                const photo = item.media?.photos?.[0];
                const price = formatPrice(item.price);
                const district = item.location?.city || item.location?.district || "Bihar";
                const isVerified = item.verificationStatus === "approved" || item.isVerified;

                return (
                  <TouchableOpacity
                    key={item._id || item.id}
                    style={[styles.portfolioCard, compact && styles.portfolioCardCompact]}
                    onPress={() => router.push(`/my-properties`)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.portfolioImageWrap}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.portfolioImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.portfolioImagePlaceholder}>
                          <MaterialIcons name="landscape" size={32} color="#94A3B8" />
                        </View>
                      )}
                      <View style={styles.portfolioBadgeWrap}>
                        <View
                          style={[
                            styles.statusPill,
                            isVerified ? styles.statusPillVerified : styles.statusPillPending,
                          ]}
                        >
                          <MaterialIcons
                            name={isVerified ? "check-circle" : "access-time"}
                            size={12}
                            color={isVerified ? "#059669" : "#D97706"}
                          />
                          <Text
                            style={[
                              styles.statusPillText,
                              isVerified ? styles.statusPillTextVerified : styles.statusPillTextPending,
                            ]}
                          >
                            {isVerified ? "Verified" : "Under Review"}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.portfolioBody}>
                      <Text style={styles.portfolioPrice}>{price}</Text>
                      <Text style={styles.portfolioTitle} numberOfLines={1}>
                        {item.title || `${item.type || "Property"} in ${district}`}
                      </Text>
                      <View style={styles.portfolioLocRow}>
                        <MaterialIcons name="location-on" size={13} color="#64748B" />
                        <Text style={styles.portfolioLocText} numberOfLines={1}>
                          {district}, Bihar
                        </Text>
                      </View>
                    </View>
                    <View style={styles.portfolioCardFooter}>
                      <Text style={styles.portfolioManageText}>Manage Listing</Text>
                      <MaterialIcons name="arrow-forward" size={13} color="#0A45B5" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={[styles.promoBanner, compact && styles.promoBannerCompact]}>
            <View style={styles.promoIconWrap}>
              <MaterialIcons name="home-work" size={28} color="#0A45B5" />
            </View>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>Have land, an apartment, or commercial shop to sell in Bihar?</Text>
              <Text style={styles.promoSubtitle}>
                List with sub-meter cadastral satellite pinning, auto Kattha/Decimal calculators, and direct buyer connections with 0% brokerage.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.promoBtn}
              onPress={() => router.push("/post")}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.promoBtnLabel}>Post Your First Property</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Enhanced Executive Account Bar */}
        <View style={[styles.accountBar, compact && styles.accountCompact]}>
          <View style={styles.accountIdentity}>
            <View style={styles.accountIcon}>
              <Text style={styles.accountAvatarText}>
                {user.name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View>
              <View style={styles.accountNameRow}>
                <Text style={styles.accountTitle}>{user.name || "Nikhil"}</Text>
                {isKycDone && (
                  <View style={styles.accountVerifiedPill}>
                    <MaterialIcons name="verified" size={13} color="#059669" />
                    <Text style={styles.accountVerifiedText}>Verified Account</Text>
                  </View>
                )}
              </View>
              <Text style={styles.accountDescription}>
                {user.mobile ? `+91 ${user.mobile}` : user.email || "Registered MalikSe Member"} • Role: {user.role || "User"}
              </Text>
            </View>
          </View>
          <View style={styles.accountActions}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.profileButton}
              onPress={() => router.push("/profile")}
              activeOpacity={0.8}
            >
              <MaterialIcons name="person" size={16} color="#FFFFFF" />
              <Text style={styles.profileButtonLabel}>Personal Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.kycButton}
              onPress={() => router.push("/kyc")}
              activeOpacity={0.8}
            >
              <MaterialIcons name="verified-user" size={15} color="#0A45B5" />
              <Text style={styles.kycButtonLabel}>Bihar Land KYC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.signOut}
              onPress={() => {
                authService.logout().finally(() => router.replace("/login"));
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="logout" size={14} color="#E11D48" />
              <Text style={styles.signOutLabel}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = premiumStyles({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  content: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 96,
  },
  contentCompact: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },

  // Topline Breadcrumb & Status
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  breadcrumbGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  eyebrow: {
    color: "#0A45B5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  toplineRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 16,
  },
  verifiedPillText: {
    color: "#059669",
    fontSize: 11.5,
    fontWeight: "700",
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 20,
  },
  roleDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#0A45B5" },
  roleText: { textTransform: "capitalize", color: "#0B1B3F", fontSize: 12, fontWeight: "700" },

  // Title Row
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 24,
  },
  titleRowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 16,
  },
  titleTextContainer: {
    flex: 1,
  },
  title: {
    color: "#0B1B3F",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  titleCompact: { fontSize: 26 },
  subtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
    maxWidth: 680,
    fontWeight: "500",
  },
  headerCtaGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: "#0A45B5",
    borderRadius: 24,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },
  primaryPostBtnLabel: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  secondaryExploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    cursor: "pointer",
  },
  secondaryExploreBtnLabel: {
    color: "#0B1B3F",
    fontSize: 13.5,
    fontWeight: "700",
  },

  // KPI Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 28,
  },
  metricCard: {
    flex: 1,
    minWidth: 230,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
    cursor: "pointer",
  },
  metricCardCompact: {
    minWidth: "47%",
    flexGrow: 1,
  },
  metricCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  metricBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metricNumber: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  metricLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
    marginBottom: 10,
  },
  metricFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  metricActionText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Luxury Hero Banner
  hero: {
    marginBottom: 36,
    borderRadius: 28,
    backgroundColor: "#0B1B3F",
    minHeight: 380,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 6,
  },
  heroBackground: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(11, 27, 63, 0.85)" },
  heroCompact: { flexDirection: "column", borderRadius: 22, minHeight: 340 },
  heroCopy: { flex: 1, padding: 32, gap: 16, justifyContent: "center" },
  welcomePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
    flexWrap: "wrap",
  },
  avatar: {
    backgroundColor: "#0A45B5",
    height: 26,
    width: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12.5, color: "#FFFFFF", fontWeight: "800" },
  welcome: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
  verifiedMiniTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  verifiedMiniTagText: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: "#FFFFFF",
  },
  heroTitleCompact: { fontSize: 24, lineHeight: 32 },
  heroDescription: {
    color: "#D9EEFC",
    fontSize: 14.5,
    lineHeight: 22,
    maxWidth: 520,
  },
  heroActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    flexWrap: "wrap",
  },
  heroActionRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  whiteButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },
  whiteLabel: { color: "#0A45B5", fontSize: 13.5, fontWeight: "700" },
  heroGlassBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 28,
    cursor: "pointer",
  },
  heroGlassLabel: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "700" },
  heroFeatureStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    flexWrap: "wrap",
  },
  heroFeatureStripCompact: {
    gap: 10,
  },
  heroFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroFeatureText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },

  // Section Heading
  sectionHeading: {
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#0B1B3F",
    fontWeight: "800",
    fontSize: 24,
    letterSpacing: -0.6,
    marginTop: 4,
  },
  sectionNote: { color: "#64748B", fontSize: 12.5, fontWeight: "600" },

  // Tools Cards Grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 36 },
  card: {
    minHeight: 220,
    borderRadius: 22,
    padding: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    cursor: "pointer",
    justifyContent: "space-between",
  },
  disabledCard: { backgroundColor: "#F8FAFC", opacity: 0.65 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
  },
  cardTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: "#0B1B3F",
    lineHeight: 24,
  },
  cardDescription: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    flex: 1,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cardAction: { fontSize: 12.5, fontWeight: "700" },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Active Portfolio Preview
  portfolioSection: {
    marginBottom: 36,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    cursor: "pointer",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A45B5",
  },
  portfolioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  portfolioCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    cursor: "pointer",
  },
  portfolioCardCompact: {
    minWidth: "100%",
  },
  portfolioImageWrap: {
    width: "100%",
    height: 140,
    backgroundColor: "#F1F5F9",
    position: "relative",
  },
  portfolioImage: {
    width: "100%",
    height: "100%",
  },
  portfolioImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  portfolioBadgeWrap: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillVerified: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
  },
  statusPillPending: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPillTextVerified: {
    color: "#059669",
  },
  statusPillTextPending: {
    color: "#D97706",
  },
  portfolioBody: {
    padding: 14,
  },
  portfolioPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.4,
  },
  portfolioTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 3,
  },
  portfolioLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  portfolioLocText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  portfolioCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  portfolioManageText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A45B5",
  },

  // Promo Banner for 0 Listings
  promoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    padding: 24,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderRadius: 22,
    marginBottom: 36,
  },
  promoBannerCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 16,
  },
  promoIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B1B3F",
    lineHeight: 22,
  },
  promoSubtitle: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
    lineHeight: 19,
  },
  promoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#0A45B5",
    borderRadius: 24,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    cursor: "pointer",
  },
  promoBtnLabel: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },

  // Executive Account Bar
  accountBar: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    gap: 20,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  accountCompact: { flexDirection: "column", alignItems: "stretch" },
  accountIdentity: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A45B5",
  },
  accountNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  accountTitle: { fontSize: 17, fontWeight: "800", color: "#0B1B3F" },
  accountVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  accountVerifiedText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
  },
  accountDescription: { fontSize: 13, color: "#64748B", marginTop: 3 },
  accountActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#0B1B3F",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
    cursor: "pointer",
  },
  profileButtonLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  kycButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    cursor: "pointer",
  },
  kycButtonLabel: { color: "#0A45B5", fontSize: 13, fontWeight: "700" },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FECDD3",
    cursor: "pointer",
  },
  signOutLabel: { fontSize: 13, color: "#E11D48", fontWeight: "700" },

  // Access Panel
  accessPanel: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 32,
    marginTop: 40,
    gap: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  panelTitle: { color: "#0B1B3F", fontSize: 24, fontWeight: "800" },
  panelSubtitle: { color: "#64748B", fontSize: 14, lineHeight: 21 },
  darkButton: {
    backgroundColor: "#0B1B3F",
    borderRadius: 26,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    cursor: "pointer",
  },
  darkLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
