import { AppTheme } from "../../constants/theme";
import TextInput from "../../components/FormInput";
import React, { useState, useMemo } from "react";
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
  Modal,
  Pressable,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import AppHeader from "../../components/AppHeader";
import { useLanguageStore } from "../../src/store/languageStore";
import { t } from "../../src/i18n/translations";
import { userService } from "../../src/services/userService";
import { useAuthStore } from "../../src/store/authStore";


interface SavedPropertyItem {
  id: string;
  title: string;
  location: string;
  area: string;
  price: string;
  priceNum: number;
  pricePerSqFt: string;
  typeBadge: string;
  category: "land" | "plots" | "flats" | "commercial" | "agricultural";
  image: any;
  isSaved: boolean;
}


interface CategoryItem {
  id: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const CATEGORIES: CategoryItem[] = [
  { id: "all", label: "All Saved", icon: "bookmark" },
  { id: "land", label: "Land", icon: "terrain" },
  { id: "plots", label: "Plots", icon: "grid-view" },
  { id: "flats", label: "Flats &\nHouses", icon: "home" },
  { id: "commercial", label: "Commercial", icon: "apartment" },
  { id: "agricultural", label: "Agricultural", icon: "eco" },
];

export default function SavedScreen() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [savedError, setSavedError] = useState("");
  const [savedRevision, setSavedRevision] = useState(0);
  const [cursor, setCursor] = useState<string>();
  const [nextCursor, setNextCursor] = useState<string>();
  const [previousCursors, setPreviousCursors] = useState<(string | undefined)[]>([]);
  const [savedList, setSavedList] = useState<SavedPropertyItem[]>([]);
  const [sortBy, setSortBy] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [sortModalVisible, setSortModalVisible] = useState<boolean>(false);
  const [selectedPropertyMenu, setSelectedPropertyMenu] = useState<SavedPropertyItem | null>(null);
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
          priceNum: p.price || 0,
          pricePerSqFt: p.sellableArea && p.price ? `₹${(p.price / p.sellableArea).toFixed(0)}/sq.ft` : "",
          typeBadge: (p.type || "property").toUpperCase(),
          category: p.type === "land" ? "land" : p.type === "house" || p.type === "flat" ? "flats" : "commercial",
          image: p.media?.photos?.[0] ? { uri: p.media.photos[0] } : undefined,
          isSaved: true
        }));
        setSavedList(mapped);
      })
      .catch(() => { if (active) setSavedError("Could not load saved properties. Refresh to try again."); })
      .finally(() => {
        if (active) setLoading(false);
      });
      
    return () => { active = false; };
  }, [user, cursor, savedRevision]));

  // Toggle saved status
  const handleToggleHeart = async (id: string) => {
    try {
      await userService.toggleWishlist(id);
      setSavedList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isSaved: !item.isSaved } : item
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await userService.toggleWishlist(id);
      setSavedList((prev) => prev.filter((item) => item.id !== id));
      setSelectedPropertyMenu(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Category counts
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {
      all: savedList.filter((item) => item.isSaved).length,
      land: savedList.filter((item) => item.isSaved && item.category === "land").length,
      plots: savedList.filter((item) => item.isSaved && item.category === "plots").length,
      flats: savedList.filter((item) => item.isSaved && item.category === "flats").length,
      commercial: savedList.filter((item) => item.isSaved && item.category === "commercial").length,
      agricultural: savedList.filter((item) => item.isSaved && item.category === "agricultural").length,
    };
    return counts;
  }, [savedList]);

  // Filtered & sorted properties
  const displayedList = useMemo(() => {
    let list = savedList.filter((item) => item.isSaved);

    if (activeCategory !== "all") {
      list = list.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.price.toLowerCase().includes(q) ||
          item.typeBadge.toLowerCase().includes(q)
      );
    }

    if (sortBy === "price_asc") {
      list = [...list].sort((a, b) => a.priceNum - b.priceNum);
    } else if (sortBy === "price_desc") {
      list = [...list].sort((a, b) => b.priceNum - a.priceNum);
    }

    return list;
  }, [savedList, activeCategory, searchQuery, sortBy]);

  return (
    <View style={styles.screen}>
      {/* 1. Global Brand AppHeader */}
      <AppHeader
        showBack={false}
        showNavLinks={true}
        showLanguageToggle={true}
        showPostPropertyBtn={true}
      />

      {!!savedError && <Text accessibilityRole="alert">{savedError}</Text>}
      <View style={{ flexDirection: "row", gap: 20, padding: 12 }}>
        <TouchableOpacity onPress={() => { setCursor(undefined); setPreviousCursors([]); setSavedRevision(old => old + 1); }}><Text>Refresh saved properties</Text></TouchableOpacity>
        {previousCursors.length > 0 && <TouchableOpacity onPress={() => { setCursor(previousCursors.at(-1)); setPreviousCursors(old => old.slice(0, -1)); }}><Text>Previous saved properties</Text></TouchableOpacity>}
        {nextCursor && <TouchableOpacity onPress={() => { setPreviousCursors(old => [...old, cursor]); setCursor(nextCursor); }}><Text>More saved properties</Text></TouchableOpacity>}
      </View>
      {loading && <ActivityIndicator accessibilityLabel="Loading saved properties" />}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          isDesktop && styles.scrollContainerDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainWrapper, isDesktop && styles.mainWrapperDesktop]}>
          {/* ================= 2. TOP HERO BANNER ================= */}
          <View style={styles.heroCard}>
            {/* Content Layer (Overlays) */}
            <View style={styles.heroContentLayer} pointerEvents="box-none">
              {/* Top-Left: Tilted Cursive Script */}
              <View style={styles.heroCursiveTopWrap}>
                <Text style={styles.heroCursiveTopText}>
                  Save Today{"\n"}Build Tomorrows
                </Text>
              </View>

              {/* Main Title & Subtitle */}
              <View style={styles.heroTitlesWrap}>
                <Text style={styles.heroMainTitle}>
                  {t(language, "saved_hero_title") || "Saved Properties"}
                </Text>
                <Text style={styles.heroSubTitle}>
                  {t(language, "saved_hero_sub") || "Properties you've saved for later"}
                </Text>
              </View>

              {/* Top-Right: Floating Circular Bookmark Icon Button */}
              <View style={styles.heroTopRightBadge}>
                <MaterialIcons name="bookmark" size={24} color="#064E3B" />
              </View>

              {/* Lower Mid-Left: Floating Glassmorphic Info Card */}
              <View style={styles.heroFloatingCard}>
                <View style={styles.heroFloatingIconBox}>
                  <MaterialIcons name="bookmark" size={17} color="#059669" />
                </View>
                <View style={styles.heroFloatingTextBox}>
                  <Text style={styles.heroFloatingTitle}>Keep track of properties</Text>
                  <Text style={styles.heroFloatingSubtitle}>that match your goals.</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={16} color="#1E293B" />
              </View>

              {/* Bottom-Right: Cursive Tagline over Water */}
              <View style={styles.heroBottomRightScriptWrap}>
                <Text style={styles.heroBottomRightScript}>
                  Better Places{"\n"}Brighter Futures
                </Text>
              </View>
            </View>
          </View>

          {/* ================= 3. HORIZONTAL CATEGORY ROW ================= */}
          <View style={styles.categorySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScrollContainer}
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.id;
                const count = countsByCategory[cat.id] ?? 0;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isActive && styles.categoryCardActive,
                    ]}
                    onPress={() => setActiveCategory(cat.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        isActive && styles.categoryIconWrapActive,
                      ]}
                    >
                      <MaterialIcons
                        name={cat.icon}
                        size={20}
                        color={isActive ? "#059669" : "#475569"}
                      />
                    </View>

                    <Text
                      style={[
                        styles.categoryLabel,
                        isActive && styles.categoryLabelActive,
                      ]}
                      numberOfLines={2}
                    >
                      {cat.label}
                    </Text>

                    <View
                      style={[
                        styles.categoryBadge,
                        isActive
                          ? styles.categoryBadgeActive
                          : count > 0
                          ? styles.categoryBadgeHasCount
                          : styles.categoryBadgeZero,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          isActive
                            ? styles.categoryBadgeTextActive
                            : count > 0
                            ? styles.categoryBadgeTextHasCount
                            : styles.categoryBadgeTextZero,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ================= 4. "SHORTLIST. COMPARE." PROMOTIONAL CARD ================= */}
          <View style={styles.promoCard}>
            <View style={styles.promoContentLeft}>
              <View style={styles.promoHeartCircle}>
                <MaterialIcons name="favorite" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={styles.promoTitle}>Shortlist. Compare.</Text>
                <Text style={styles.promoSubtitle}>
                  Make the right move. Save properties, compare details and find your perfect land.
                </Text>
              </View>
            </View>

            {/* Decorative Right Illustration */}
            <View style={styles.promoGraphicWrap}>
              <Svg width={80} height={54} viewBox="0 0 80 54" fill="none">
                <Path d="M60 6 L68 2" stroke="#86EFAC" strokeWidth={1.8} strokeLinecap="round" />
                <Path d="M70 12 L78 9" stroke="#86EFAC" strokeWidth={1.8} strokeLinecap="round" />
                <Rect x="26" y="12" width="28" height="38" rx="6" transform="rotate(-15 26 12)" fill="#D1FAE5" opacity={0.65} />
                <Rect x="35" y="8" width="30" height="40" rx="6" transform="rotate(-4 35 8)" fill="#E6F4EA" stroke="#A7F3D0" strokeWidth={1.2} />
                <Rect x="44" y="4" width="32" height="44" rx="7" transform="rotate(8 44 4)" fill="#FFFFFF" stroke="#86EFAC" strokeWidth={1.5} />
                <Path
                  d="M58 18 C58 15.5 61.5 15.5 61.5 18 C61.5 21 58 24 58 24 C58 24 54.5 21 54.5 18 C54.5 15.5 58 15.5 58 18 Z"
                  fill="#059669"
                  transform="rotate(8 58 19)"
                />
              </Svg>
            </View>
          </View>

          {/* ================= 5. SEARCH & SORT BAR ================= */}
          <View style={styles.searchSortRow}>
            {/* Search Input */}
            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={20} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder={
                  t(language, "saved_search_placeholder") || "Search in your saved properties..."
                }
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Sort Button */}
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="swap-vert" size={20} color="#0F172A" />
              <Text style={styles.sortButtonText}>
                {t(language, "saved_sort_by") || "Sort by"}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* ================= 6. SAVED PROPERTY CARDS LIST ================= */}
          {displayedList.length === 0 ? (
            <View style={styles.emptyCard}>
              <FontAwesome5 name="heart-broken" size={38} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No saved properties found</Text>
              <Text style={styles.emptySub}>
                Try searching with different terms or check out other categories.
              </Text>
              <TouchableOpacity
                style={styles.emptyExploreBtn}
                onPress={() => router.push("/search")}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyExploreBtnText}>Browse Available Land</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.propertyCardList, isDesktop && styles.propertyCardListDesktop]}>
              {displayedList.map((item) => (
                <View
                  key={item.id}
                  style={[styles.propertyCard, isDesktop && styles.propertyCardDesktop]}
                >
                  {/* Left Photographic Box */}
                  <View style={styles.cardImageSection}>
                    <Image source={item.image} style={styles.cardImage} resizeMode="cover" />

                    {/* Floating Red Heart on top-right */}
                    <TouchableOpacity
                      style={styles.cardHeartCircle}
                      onPress={() => handleToggleHeart(item.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name="favorite"
                        size={16}
                        color={item.isSaved ? "#EF4444" : "#94A3B8"}
                      />
                    </TouchableOpacity>

                    {/* Floating Dark Type Badge on bottom-left */}
                    <View style={styles.cardTypeBadge}>
                      <Text style={styles.cardTypeBadgeText}>{item.typeBadge}</Text>
                    </View>
                  </View>

                  {/* Right Details Section */}
                  <View style={styles.cardDetailsSection}>
                    {/* Top: Title & 3-dots Menu */}
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <TouchableOpacity
                        style={styles.cardMenuBtn}
                        onPress={() => setSelectedPropertyMenu(item)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="more-vert" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>

                    {/* Location Row */}
                    <View style={styles.cardMetaRow}>
                      <MaterialIcons name="place" size={13} color="#64748B" />
                      <Text style={styles.cardMetaText} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>

                    {/* Area / Dimensions Row */}
                    <View style={styles.cardMetaRow}>
                      <MaterialIcons name="crop-free" size={13} color="#64748B" />
                      <Text style={styles.cardMetaText} numberOfLines={1}>
                        {item.area}
                      </Text>
                    </View>

                    {/* Price & View Details Action Row */}
                    <View style={styles.cardFooterRow}>
                      <View>
                        <Text style={styles.cardPriceText}>{item.price}</Text>
                        <Text style={styles.cardPerSqFtText}>{item.pricePerSqFt}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.viewDetailsBtn}
                        onPress={() => router.push(`/property/${item.id}`)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.viewDetailsBtnText}>View Details</Text>
                        <MaterialIcons name="arrow-forward" size={12} color="#059669" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ================= 7. FOOTER SECTION (Website Layout Only) ================= */}
          {isDesktop && (
            <View style={styles.footerSection}>
              <View style={styles.footerContent}>
                {/* Brand Logo & Tagline */}
                <View style={styles.footerBrand}>
                  <View style={styles.footerLogoIcon}>
                    <FontAwesome5 name="shield-alt" size={14} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.footerBrandName}>MalikSe</Text>
                    <Text style={styles.footerBrandTagline}>Your Land. A Safer Future.</Text>
                  </View>
                </View>

                {/* Legal & Navigation Links */}
                <View style={styles.footerLinksRow}>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.footerLink}>About</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Contact</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Privacy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Terms</Text>
                  </TouchableOpacity>
                </View>

                {/* Signature Cursive Watermark */}
                <View style={styles.footerSignatureWrap}>
                  <Text style={styles.footerSignatureText}>
                    Verified Land{"\n"}Brighter Tomorrows
                  </Text>
                  <View style={styles.signatureSwoosh} />
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ================= MODAL: SORT OPTIONS ================= */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sort Properties</Text>

            <TouchableOpacity
              style={[
                styles.modalOption,
                sortBy === "recent" && styles.modalOptionActive,
              ]}
              onPress={() => {
                setSortBy("recent");
                setSortModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  sortBy === "recent" && styles.modalOptionTextActive,
                ]}
              >
                Recently Saved
              </Text>
              {sortBy === "recent" && (
                <MaterialIcons name="check" size={18} color="#059669" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalOption,
                sortBy === "price_asc" && styles.modalOptionActive,
              ]}
              onPress={() => {
                setSortBy("price_asc");
                setSortModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  sortBy === "price_asc" && styles.modalOptionTextActive,
                ]}
              >
                Price: Low to High
              </Text>
              {sortBy === "price_asc" && (
                <MaterialIcons name="check" size={18} color="#059669" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalOption,
                sortBy === "price_desc" && styles.modalOptionActive,
              ]}
              onPress={() => {
                setSortBy("price_desc");
                setSortModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  sortBy === "price_desc" && styles.modalOptionTextActive,
                ]}
              >
                Price: High to Low
              </Text>
              {sortBy === "price_desc" && (
                <MaterialIcons name="check" size={18} color="#059669" />
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ================= MODAL: 3-DOTS PROPERTY ACTIONS ================= */}
      <Modal
        visible={!!selectedPropertyMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPropertyMenu(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedPropertyMenu(null)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedPropertyMenu?.title}
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                if (selectedPropertyMenu) {
                  router.push(`/property/${selectedPropertyMenu.id}`);
                }
                setSelectedPropertyMenu(null);
              }}
            >
              <MaterialIcons name="visibility" size={18} color="#334155" />
              <Text style={styles.modalOptionText}>View Full Property Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                if (selectedPropertyMenu) {
                  handleRemove(selectedPropertyMenu.id);
                }
              }}
            >
              <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
              <Text style={[styles.modalOptionText, { color: "#EF4444" }]}>
                Remove from Saved
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  scrollContainerDesktop: {
    paddingBottom: 60,
  },
  mainWrapper: {
    width: "100%",
  },
  mainWrapperDesktop: {
    maxWidth: 960,
    alignSelf: "center",
  },

  /* ================= 2. HERO BANNER ================= */
  heroCard: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 220,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  heroBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroContentLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  heroCursiveTopWrap: {
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  heroCursiveTopText: {
    fontFamily: Platform.OS === "web" ? "Caveat, Kalam, 'Segoe Script', cursive" : "System",
    fontSize: 14.5,
    color: "#1E293B",
    fontStyle: "italic",
    transform: [{ rotate: "-4deg" }],
    lineHeight: 18,
    fontWeight: "700",
    opacity: 0.95,
  },
  heroTitlesWrap: {
    maxWidth: 240,
    marginTop: 2,
  },
  heroMainTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: AppTheme.colors.text,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  heroSubTitle: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    marginTop: 3,
  },
  heroTopRightBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  heroFloatingCard: {
    position: "absolute",
    bottom: 12,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    maxWidth: 226,
  },
  heroFloatingIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  heroFloatingTextBox: {
    flexShrink: 1,
  },
  heroFloatingTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  heroFloatingSubtitle: {
    fontSize: 10,
    color: AppTheme.colors.textSecondary,
    marginTop: 1,
  },
  heroBottomRightScriptWrap: {
    position: "absolute",
    bottom: 12,
    right: 14,
    alignItems: "flex-end",
  },
  heroBottomRightScript: {
    fontFamily: Platform.OS === "web" ? "Caveat, Kalam, 'Segoe Script', cursive" : "System",
    fontSize: 15.5,
    color: "#FFFFFF",
    fontStyle: "italic",
    textAlign: "right",
    transform: [{ rotate: "-8deg" }],
    lineHeight: 18,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.55)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  /* ================= 3. HORIZONTAL CATEGORY ROW ================= */
  categorySection: {
    marginTop: 12,
  },
  categoryScrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  categoryCard: {
    width: 72,
    height: 98,
    borderRadius: 16,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryCardActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1.5,
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryIconWrapActive: {
    backgroundColor: "#DCFCE7",
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    lineHeight: 12,
  },
  categoryLabelActive: {
    color: "#065F46",
    fontWeight: "800",
  },
  categoryBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryBadgeActive: {
    backgroundColor: "#064E3B",
  },
  categoryBadgeHasCount: {
    backgroundColor: "#DCFCE7",
  },
  categoryBadgeZero: {
    backgroundColor: "transparent",
  },
  categoryBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  categoryBadgeTextActive: {
    color: "#FFFFFF",
  },
  categoryBadgeTextHasCount: {
    color: "#059669",
  },
  categoryBadgeTextZero: {
    color: AppTheme.colors.textSecondary,
  },

  /* ================= 4. PROMOTIONAL CARD ================= */
  promoCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  promoContentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    zIndex: 2,
  },
  promoHeartCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  promoTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    color: AppTheme.colors.text,
  },
  promoSubtitle: {
    fontSize: 11,
    color: AppTheme.colors.textSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  promoGraphicWrap: {
    position: "absolute",
    right: 4,
    bottom: 0,
    top: 0,
    justifyContent: "center",
    alignItems: "flex-end",
    zIndex: 1,
  },

  /* ================= 5. SEARCH & SORT BAR ================= */
  searchSortRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: AppTheme.colors.text,
    paddingVertical: 0,
    outlineStyle: "none" as any,
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    height: 44,
    paddingHorizontal: 12,
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },

  /* ================= 6. PROPERTY CARDS ================= */
  propertyCardList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  propertyCardListDesktop: {
    flexDirection: "column",
  },
  propertyCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 10,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  propertyCardDesktop: {
    padding: 14,
  },
  cardImageSection: {
    width: 118,
    height: 112,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: AppTheme.colors.text,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardHeartCircle: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTypeBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cardTypeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cardDetailsSection: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 4,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
    flex: 1,
    lineHeight: 17,
  },
  cardMenuBtn: {
    padding: 2,
    marginTop: -2,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: 11,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardPriceText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#059669",
    letterSpacing: -0.3,
  },
  cardPerSqFtText: {
    fontSize: 10.5,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 1,
  },
  viewDetailsBtn: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 9999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },

  /* ================= 7. FOOTER SECTION ================= */
  footerSection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 20,
    paddingBottom: 24,
    marginHorizontal: 16,
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  footerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerLogoIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#0B4D3C",
    justifyContent: "center",
    alignItems: "center",
  },
  footerBrandName: {
    fontSize: 14.5,
    fontWeight: "900",
    color: AppTheme.colors.text,
  },
  footerBrandTagline: {
    fontSize: 10,
    color: AppTheme.colors.textSecondary,
  },
  footerLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  footerLink: {
    fontSize: 11.5,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
  },
  footerSignatureWrap: {
    alignItems: "flex-end",
  },
  footerSignatureText: {
    fontFamily: Platform.OS === "web" ? "Caveat, Kalam, 'Segoe Script', cursive" : "System",
    fontSize: 13,
    color: AppTheme.colors.textSecondary,
    fontStyle: "italic",
    textAlign: "right",
    lineHeight: 15,
    transform: [{ rotate: "-4deg" }],
  },
  signatureSwoosh: {
    width: 50,
    height: 2,
    backgroundColor: "#10B981",
    borderRadius: 1,
    marginTop: 2,
  },

  /* ================= EMPTY STATE ================= */
  emptyCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: 32,
    marginHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  emptySub: {
    fontSize: 12.5,
    color: AppTheme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  emptyExploreBtn: {
    marginTop: 14,
    backgroundColor: AppTheme.colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 9999,
  },
  emptyExploreBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },

  /* ================= MODAL STYLES ================= */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "transparent",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: AppTheme.colors.text,
    marginBottom: 14,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 10,
  },
  modalOptionActive: {
    backgroundColor: "#F0FDF4",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 13.5,
    color: "#334155",
    fontWeight: "600",
  },
  modalOptionTextActive: {
    color: "#059669",
    fontWeight: "800",
  },
});
