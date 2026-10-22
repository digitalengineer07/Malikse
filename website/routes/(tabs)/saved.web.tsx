import { AppTheme } from "../../constants/theme";
import TextInput from "../../components/FormInput";
import React, { useState } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import WebFooter from "../../components/WebFooter";
import { useLanguageStore } from "../../src/store/languageStore";
import { t } from "../../src/i18n/translations";
import { useAuthStore } from "../../src/store/authStore";
import { userService } from "../../src/services/userService";


interface SavedPropertyItem {
  id: string;
  title: string;
  price: string;
  location: string;
  area: string;
  roadWidth: string;
  image?: { uri: string };
  facing: string;
  type: string;
  typeBadge: string;
  category: "land" | "plots" | "flats" | "commercial" | "agricultural";
}

export default function SavedScreen() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 880;

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [savedError, setSavedError] = useState("");
  const [savedRevision, setSavedRevision] = useState(0);
  const [cursor, setCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [previousCursors, setPreviousCursors] = useState<(string | undefined)[]>([]);
  const [savedList, setSavedList] = useState<SavedPropertyItem[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(state => state.user);

  useFocusEffect(React.useCallback(() => {
    let active = true;
    if (!user) {
      setSavedList([]);
      setLoading(false);
      return;
    }
    
    setLoading(true); setSavedError("");
    userService.getWishlist(cursor)
      .then(properties => {
        if (!active) return;
        setNextCursor((properties as any).nextCursor);
        const mapped: SavedPropertyItem[] = (properties || []).filter(p => p && p.location).map(p => ({
          id: p._id || p.id,
          title: p.title || `${p.type} in ${p.location?.district || "Unknown"}`,
          location: `${p.location?.district || "Unknown"}, ${p.location?.state || "Unknown"}`,
          area: p.sellableArea ? `${p.sellableArea} sq.ft` : "Area not provided",
          price: `₹${(p.price || 0).toLocaleString("en-IN")}`,
          roadWidth: p.roadWidth == null ? "Not provided" : String(p.roadWidth),
          facing: "Any",
          type: p.type || "property",
          typeBadge: (p.type || "property").toUpperCase(),
          category: p.type === "land" ? "land" : p.type === "house" || p.type === "flat" ? "flats" : "commercial",
          image: p.media?.photos?.[0] ? { uri: p.media.photos[0] } : undefined,
        }));
        setSavedList(mapped);
      })
      .catch(() => { if (active) setSavedError("Could not load saved properties. Refresh to try again."); })
      .finally(() => {
        if (active) setLoading(false);
      });
      
    return () => { active = false; };
  }, [user, cursor, savedRevision]));

  const handleRemove = async (id: string) => {
    try {
      await userService.toggleWishlist(id);
      setSavedList((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const countsByCategory = React.useMemo(() => {
    return {
      all: savedList.length,
      land: savedList.filter((item) => item.category === "land").length,
      plots: savedList.filter((item) => item.category === "plots").length,
      flats: savedList.filter((item) => item.category === "flats").length,
      commercial: savedList.filter((item) => item.category === "commercial").length,
      agricultural: savedList.filter((item) => item.category === "agricultural").length,
    };
  }, [savedList]);

  const filteredList = savedList.filter((item) => {
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.price.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.screen}>
      {/* 1. Global Brand AppHeader with matching active Saved tab */}
      <AppHeader
        showBack={false}
        showNavLinks={true}
        showLanguageToggle={true}
        showPostPropertyBtn={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Main Website Container - Same width (1340px) as Home & Sign In */}
        <View style={styles.content}>
          {/* ================= 2. HERO BANNER ================= */}
          <View style={styles.heroWrapper}>
            <View style={styles.heroCard}>
              {/* Left Content Column */}
              <View style={styles.heroLeftContent}>
                <Text style={styles.heroEyebrow}>SHORTLIST & WATCHLIST</Text>
                <Text style={styles.heroTitle}>
                  {t(language, "saved_hero_title") || "Saved Properties"}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {t(language, "saved_hero_sub") || "Properties you've saved for later · Compare legal records, prices & genuine title holders"}
                </Text>
              </View>

              {/* Right Floating Summary Badge */}
              <View style={styles.heroRightBadge}>
                <View style={styles.heroBadgeIconBox}>
                  <MaterialIcons name="bookmark" size={20} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.heroBadgeTitle}>
                    {savedList.length} {savedList.length === 1 ? "Property Shortlisted" : "Properties Shortlisted"}
                  </Text>
                  <Text style={styles.heroBadgeSub}>100% Verified Titles · ₹0 Brokerage</Text>
                </View>
              </View>
            </View>
          </View>

        {/* ================= 3. MAIN BODY SECTION ================= */}
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          {/* ----- LEFT SIDEBAR ----- */}
          <View style={[styles.sidebar, isDesktop && styles.sidebarDesktop]}>
            {/* Card 1: Category Filter Card */}
            <View style={styles.categoryCard}>
              {/* All Saved */}
              <TouchableOpacity
                style={[styles.categoryItem, activeCategory === "all" && styles.categoryItemActive]}
                onPress={() => setActiveCategory("all")}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="bookmark"
                  size={18}
                  color={activeCategory === "all" ? "#065F46" : "#475569"}
                />
                <Text style={[styles.categoryLabel, activeCategory === "all" && styles.categoryLabelActive]}>
                  {t(language, "saved_cat_all") || "All Saved"}
                </Text>
                <View style={[styles.countPill, activeCategory === "all" && styles.countPillActive]}>
                  <Text style={[styles.countPillText, activeCategory === "all" && styles.countPillTextActive]}>
                    {savedList.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Land */}
              <TouchableOpacity
                style={[styles.categoryItem, activeCategory === "land" && styles.categoryItemActive]}
                onPress={() => setActiveCategory("land")}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="terrain"
                  size={18}
                  color={activeCategory === "land" ? "#065F46" : "#64748B"}
                />
                <Text style={[styles.categoryLabel, activeCategory === "land" && styles.categoryLabelActive]}>
                  {t(language, "saved_cat_land") || "Land"}
                </Text>
                <View style={styles.countPillMuted}>
                  <Text style={styles.countPillMutedText}>{countsByCategory.land}</Text>
                </View>
              </TouchableOpacity>

              {/* Plots */}
              <TouchableOpacity
                style={[styles.categoryItem, activeCategory === "plots" && styles.categoryItemActive]}
                onPress={() => setActiveCategory("plots")}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="grid-view"
                  size={17}
                  color={activeCategory === "plots" ? "#065F46" : "#64748B"}
                />
                <Text style={[styles.categoryLabel, activeCategory === "plots" && styles.categoryLabelActive]}>
                  {t(language, "saved_cat_plots") || "Plots"}
                </Text>
                <View style={styles.countPillMuted}>
                  <Text style={styles.countPillMutedText}>{countsByCategory.plots}</Text>
                </View>
              </TouchableOpacity>

              {/* Flats & Houses */}
              <TouchableOpacity
                style={[styles.categoryItem, activeCategory === "flats" && styles.categoryItemActive]}
                onPress={() => setActiveCategory("flats")}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="home"
                  size={18}
                  color={activeCategory === "flats" ? "#065F46" : "#64748B"}
                />
                <Text style={[styles.categoryLabel, activeCategory === "flats" && styles.categoryLabelActive]}>
                  {t(language, "saved_cat_flats") || "Flats & Houses"}
                </Text>
                <View style={styles.countPillMuted}>
                  <Text style={styles.countPillMutedText}>{countsByCategory.flats}</Text>
                </View>
              </TouchableOpacity>

              {/* Commercial */}
              <TouchableOpacity
                style={[styles.categoryItem, activeCategory === "commercial" && styles.categoryItemActive]}
                onPress={() => setActiveCategory("commercial")}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="domain"
                  size={18}
                  color={activeCategory === "commercial" ? "#065F46" : "#64748B"}
                />
                <Text style={[styles.categoryLabel, activeCategory === "commercial" && styles.categoryLabelActive]}>
                  {t(language, "saved_cat_commercial") || "Commercial"}
                </Text>
                <View style={styles.countPillMuted}>
                  <Text style={styles.countPillMutedText}>{countsByCategory.commercial}</Text>
                </View>
              </TouchableOpacity>

              {/* Agricultural */}
              <TouchableOpacity
                style={[styles.categoryItem, activeCategory === "agricultural" && styles.categoryItemActive]}
                onPress={() => setActiveCategory("agricultural")}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="eco"
                  size={18}
                  color={activeCategory === "agricultural" ? "#065F46" : "#64748B"}
                />
                <Text style={[styles.categoryLabel, activeCategory === "agricultural" && styles.categoryLabelActive]}>
                  {t(language, "saved_cat_agri") || "Agricultural"}
                </Text>
                <View style={styles.countPillMuted}>
                  <Text style={styles.countPillMutedText}>{countsByCategory.agricultural}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Card 2: Promo / Value Proposition Mini Card */}
            <View style={styles.promoCard}>
              <View style={styles.promoIconCircle}>
                <MaterialIcons name="bookmark-added" size={16} color="#0284C7" />
              </View>
              <Text style={styles.promoTitle}>
                {t(language, "saved_promo_title") || "Shortlist & Compare"}
              </Text>
              <Text style={styles.promoSubtitle}>
                {t(language, "saved_promo_sub") ||
                  "Review verified revenue records, compare prices per sq.ft, and connect directly with genuine title holders."}
              </Text>

              <View style={styles.promoPillsRow}>
                <View style={styles.promoPill}>
                  <MaterialIcons name="verified" size={12} color="#059669" />
                  <Text style={styles.promoPillText}>100% Verified</Text>
                </View>
                <View style={styles.promoPill}>
                  <MaterialIcons name="handshake" size={12} color="#0284C7" />
                  <Text style={styles.promoPillText}>₹0 Brokerage</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ----- RIGHT CONTENT AREA ----- */}
          <View style={styles.contentArea}>
            {/* Search & Sort Controls Row */}
            <View style={styles.controlsRow}>
              {/* Search input */}
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={19} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={
                    t(language, "saved_search_placeholder") || "Search in your saved properties..."
                  }
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Refresh button */}
              <TouchableOpacity
                style={styles.refreshControlBtn}
                onPress={() => {
                  setCursor(undefined);
                  setPreviousCursors([]);
                  setSavedRevision((old) => old + 1);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Refresh saved properties"
              >
                <MaterialIcons name="refresh" size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Sort by dropdown */}
              <TouchableOpacity style={styles.sortDropdown} activeOpacity={0.8}>
                <MaterialIcons name="swap-vert" size={17} color="#475569" />
                <Text style={styles.sortDropdownText}>
                  {t(language, "saved_sort_by") || "Sort by"}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={17} color="#475569" />
              </TouchableOpacity>

              {/* View Switchers */}
              <View style={styles.viewModeWrap}>
                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === "grid" && styles.viewModeBtnActive]}
                  onPress={() => setViewMode("grid")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="grid-view"
                    size={16}
                    color={viewMode === "grid" ? "#FFFFFF" : "#64748B"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.viewModeBtn, viewMode === "list" && styles.viewModeBtnActive]}
                  onPress={() => setViewMode("list")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="format-list-bulleted"
                    size={17}
                    color={viewMode === "list" ? "#FFFFFF" : "#64748B"}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Properties List */}
            {filteredList.length === 0 ? (
              <View style={styles.emptyCard}>
                <FontAwesome5 name="heart-broken" size={40} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No saved properties found</Text>
                <Text style={styles.emptySub}>Try searching with different terms or explore new properties.</Text>
                <TouchableOpacity
                  style={styles.emptyExploreBtn}
                  onPress={() => router.push("/search")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyExploreBtnText}>Browse Available Land</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.propertyCardsList}>
                {filteredList.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.propertyCard, isDesktop && styles.propertyCardDesktop]}
                  >
                    {/* Left: Photographic Slider Half */}
                    <View style={[styles.photoSliderWrap, isDesktop && styles.photoSliderWrapDesktop]}>
                      <Image source={item.image as any} style={styles.propertyImg} resizeMode="cover" />

                      {/* Top-Left: Verified Owner Pill */}
                      <View style={styles.verifiedOwnerBadge}>
                        <MaterialIcons name="verified" size={13} color="#FFFFFF" />
                        <Text style={styles.verifiedOwnerText}>
                          {t(language, "saved_verified_owner") || "Verified Owner"}
                        </Text>
                      </View>

                      {/* Top-Right: Red Solid Heart Button */}
                      <TouchableOpacity
                        style={styles.saveHeartBtn}
                        onPress={() => handleRemove(item.id)}
                        activeOpacity={0.85}
                      >
                        <FontAwesome5 name="heart" solid size={15} color="#EF4444" />
                      </TouchableOpacity>

                      {/* Slider Navigation Chevrons */}
                      <View style={styles.sliderChevronLeft}>
                        <MaterialIcons name="chevron-left" size={18} color="#FFFFFF" />
                      </View>
                      <View style={styles.sliderChevronRight}>
                        <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" />
                      </View>

                      {/* Bottom-Left Overlays */}
                      <View style={styles.bottomLeftOverlays}>
                        <View style={styles.photoCountPill}>
                          <MaterialIcons name="photo-camera" size={11} color="#FFFFFF" />
                          <Text style={styles.photoCountText}>1 / 6</Text>
                        </View>
                        <View style={styles.typeTagPill}>
                          <Text style={styles.typeTagText}>{item.type}</Text>
                        </View>
                      </View>

                      {/* Bottom-Right Overlays (Total photos) */}
                      <View style={styles.bottomRightOverlay}>
                        <MaterialIcons name="photo-library" size={11} color="#FFFFFF" />
                        <Text style={styles.bottomRightText}>/ 1</Text>
                      </View>
                    </View>

                    {/* Right: Content Details Half */}
                    <View style={[styles.detailsWrap, isDesktop && styles.detailsWrapDesktop]}>
                      {/* Title & 3-dots Menu Row */}
                      <View style={styles.titleRow}>
                        <Text style={styles.propertyTitle} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <TouchableOpacity style={styles.moreOptionsBtn} activeOpacity={0.7}>
                          <MaterialIcons name="more-vert" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>

                      {/* Location Row */}
                      <View style={styles.locationRow}>
                        <MaterialIcons name="place" size={15} color="#64748B" />
                        <Text style={styles.locationText}>{item.location}</Text>
                      </View>

                      {/* Feature Chips Strip */}
                      <View style={styles.featuresStrip}>
                        <View style={styles.featureChip}>
                          <MaterialIcons name="crop-free" size={14} color="#64748B" />
                          <Text style={styles.featureChipText}>{item.area}</Text>
                        </View>

                        <View style={styles.featureChip}>
                          <MaterialIcons name="add-road" size={14} color="#64748B" />
                          <Text style={styles.featureChipText}>{item.roadWidth}</Text>
                        </View>

                        <View style={styles.featureChip}>
                          <MaterialIcons name="explore" size={14} color="#64748B" />
                          <Text style={styles.featureChipText}>{item.facing}</Text>
                        </View>
                      </View>

                      {/* 4-Pillar Verification Trust Pills */}
                      <View style={styles.trustPillsRow}>
                        {/* ID KYC */}
                        <View style={[styles.trustPill, styles.trustPillGreen]}>
                          <MaterialIcons name="fingerprint" size={13} color="#065F46" />
                          <Text style={styles.trustPillGreenText}>
                            {t(language, "saved_badge_kyc") || "ID KYC"}
                          </Text>
                        </View>

                        {/* Registry */}
                        <View style={[styles.trustPill, styles.trustPillBlue]}>
                          <MaterialIcons name="description" size={13} color="#1D4ED8" />
                          <Text style={styles.trustPillBlueText}>
                            {t(language, "saved_badge_registry") || "Registry"}
                          </Text>
                        </View>

                        {/* GPS Visit */}
                        <View style={[styles.trustPill, styles.trustPillPurple]}>
                          <MaterialIcons name="location-on" size={13} color="#6D28D9" />
                          <Text style={styles.trustPillPurpleText}>
                            {t(language, "saved_badge_gps") || "GPS Visit"}
                          </Text>
                        </View>

                        {/* Legal */}
                        <View style={[styles.trustPill, styles.trustPillAmber]}>
                          <MaterialIcons name="gavel" size={13} color="#B45309" />
                          <Text style={styles.trustPillAmberText}>
                            {t(language, "saved_badge_legal") || "Legal"}
                          </Text>
                        </View>
                      </View>

                      {/* Price & View Details Footer Row */}
                      <View style={styles.cardFooterRow}>
                        <View style={styles.priceContainer}>
                          <Text style={styles.priceLabel}>
                            {t(language, "saved_price_label") || "Price"}
                          </Text>
                          <Text style={styles.priceValue}>{item.price}</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.viewDetailsBtn}
                          onPress={() => router.push(`/property/${item.id}`)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.viewDetailsBtnText}>
                            {t(language, "saved_view_details") || "View Details"}
                          </Text>
                          <MaterialIcons name="arrow-forward" size={15} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Pagination Controls (When applicable) */}
            {(previousCursors.length > 0 || !!nextCursor) && (
              <View style={styles.paginationRow}>
                {previousCursors.length > 0 && (
                  <TouchableOpacity
                    style={styles.paginationBtn}
                    onPress={() => {
                      setCursor(previousCursors.at(-1));
                      setPreviousCursors((old) => old.slice(0, -1));
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="chevron-left" size={18} color="#03456C" />
                    <Text style={styles.paginationBtnText}>Previous</Text>
                  </TouchableOpacity>
                )}
                {nextCursor && (
                  <TouchableOpacity
                    style={styles.paginationBtn}
                    onPress={() => {
                      setPreviousCursors((old) => [...old, cursor]);
                      setCursor(nextCursor);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.paginationBtnText}>Next</Text>
                    <MaterialIcons name="chevron-right" size={18} color="#03456C" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Bottom Callout Banner */}
            <View style={styles.bottomBanner}>
              <View style={styles.bottomBannerLeft}>
                <View style={styles.bottomBannerIconCircle}>
                  <MaterialIcons name="favorite-border" size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1, minWidth: 240 }}>
                  <Text style={styles.bottomBannerTitle}>
                    {t(language, "saved_finding_title") || "Finding the right property?"}
                  </Text>
                  <Text style={styles.bottomBannerSub}>
                    {t(language, "saved_finding_sub") ||
                      "Explore more verified land and plots across Patna and nearby areas."}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.bottomBannerBtn}
                onPress={() => router.push("/search")}
                activeOpacity={0.85}
              >
                <Text style={styles.bottomBannerBtnText}>
                  {t(language, "saved_explore_btn") || "Explore Properties"}
                </Text>
                <MaterialIcons name="arrow-forward" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Global Website Footer */}
      <WebFooter />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContainer: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  content: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  /* ================= HERO BANNER ================= */
  heroWrapper: {
    width: "100%",
    marginBottom: 8,
  },
  heroCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.85)",
    paddingHorizontal: 28,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px -2px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  heroLeftContent: {
    flex: 1,
    minWidth: 260,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 4,
  },
  heroRightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  heroBadgeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#03456C",
  },
  heroBadgeSub: {
    fontSize: 11,
    color: "#0284C7",
    fontWeight: "600",
  },

  /* ================= MAIN LAYOUT ================= */
  mainLayout: {
    width: "100%",
    marginTop: 20,
    gap: 24,
    marginBottom: 32,
  },
  mainLayoutDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  /* SIDEBAR */
  sidebar: {
    width: "100%",
  },
  sidebarDesktop: {
    width: 250,
  },
  categoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    padding: 8,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  categoryItemActive: {
    backgroundColor: "#E0F2FE",
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  categoryLabelActive: {
    color: "#03456C",
    fontWeight: "800",
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  countPillActive: {
    backgroundColor: "#0284C7",
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  countPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  countPillMuted: {
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countPillMutedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },

  /* PROMO MINI CARD */
  promoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginTop: 16,
  },
  promoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0A192F",
  },
  promoSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  promoPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  promoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  promoPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },

  /* CONTENT AREA */
  contentArea: {
    flex: 1,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  searchBar: {
    flex: 1,
    minWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    outlineStyle: "none" as any,
  },
  refreshControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  sortDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 14,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  sortDropdownText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  viewModeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  viewModeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  viewModeBtnActive: {
    backgroundColor: "#03456C",
  },

  /* PROPERTY CARDS */
  propertyCardsList: {
    gap: 16,
  },
  propertyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 12px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  propertyCardDesktop: {
    flexDirection: "row",
  },
  photoSliderWrap: {
    height: 240,
    width: "100%",
    position: "relative",
    backgroundColor: AppTheme.colors.text,
  },
  photoSliderWrapDesktop: {
    width: "44%",
    maxWidth: 480,
    height: 250,
  },
  propertyImg: {
    width: "100%",
    height: "100%",
  },
  verifiedOwnerBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppTheme.colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9999,
  },
  verifiedOwnerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  saveHeartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  sliderChevronLeft: {
    position: "absolute",
    top: "44%",
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  sliderChevronRight: {
    position: "absolute",
    top: "44%",
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomLeftOverlays: {
    position: "absolute",
    bottom: 10,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  photoCountText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  typeTagPill: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  typeTagText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bottomRightOverlay: {
    position: "absolute",
    bottom: 10,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  bottomRightText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "600",
  },

  /* DETAILS WRAP */
  detailsWrap: {
    padding: 18,
    justifyContent: "space-between",
  },
  detailsWrapDesktop: {
    flex: 1,
    padding: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  propertyTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
    lineHeight: 22,
    flex: 1,
  },
  moreOptionsBtn: {
    padding: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12.5,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
  },
  featuresStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  featureChipText: {
    fontSize: 11.5,
    color: AppTheme.colors.textSecondary,
    fontWeight: "600",
  },

  /* Trust Pills */
  trustPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  trustPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  trustPillGreen: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  trustPillGreenText: {
    fontSize: 11,
    color: "#065F46",
    fontWeight: "700",
  },
  trustPillBlue: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  trustPillBlueText: {
    fontSize: 11,
    color: "#1D4ED8",
    fontWeight: "700",
  },
  trustPillPurple: {
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
  },
  trustPillPurpleText: {
    fontSize: 11,
    color: "#6D28D9",
    fontWeight: "700",
  },
  trustPillAmber: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  trustPillAmberText: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "700",
  },

  /* Footer Row of Card */
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  priceContainer: {},
  priceLabel: {
    fontSize: 11,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#03456C",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#03456C",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(3, 69, 108, 0.25)",
      },
    }),
  },
  viewDetailsBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },

  /* BOTTOM CALLOUT BANNER */
  bottomBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  bottomBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  bottomBannerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomBannerTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0A192F",
  },
  bottomBannerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },
  bottomBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(3, 69, 108, 0.2)",
      },
    }),
  },
  bottomBannerBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* EMPTY STATE */
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px -2px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A192F",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 13.5,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    maxWidth: 420,
  },
  emptyExploreBtn: {
    marginTop: 20,
    backgroundColor: "#03456C",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(3, 69, 108, 0.25)",
      },
    }),
  },
  emptyExploreBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },

  /* PAGINATION */
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  paginationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  paginationBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#03456C",
  },
});
