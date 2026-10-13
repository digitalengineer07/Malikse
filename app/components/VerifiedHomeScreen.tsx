import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BlurView, { GlassBackdrop } from "./GlassSurface";

import AppHeader from "./AppHeader";
import PropertyTypeTabs from "./PropertyTypeTabs";
import HouseIllustration from "./HouseIllustration";
import CitySkyline from "./CitySkyline";
import { cachedPropertySearch, propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";

const nameOf = (p: Property) => p.title || `${p.type} in ${p.location.district}`;
const priceOf = (p: Property) => `₹${p.price.toLocaleString("en-IN")}`;

export default function VerifiedHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const resultsScroll = useRef<ScrollView>(null);
<<<<<<< HEAD
  const { type: initialType, query, min, max, district, state, pincode, address, areaSelection } = useLocalSearchParams<{ type?: PropertyType; query?: string; min?: string; max?: string; district?: string; state?: string; pincode?: string; address?: string; areaSelection?: string }>();
  const type = initialType || undefined;
  const setType = (value: PropertyType | undefined) => router.setParams({ type: value || "" });
  useEffect(() => { if (areaSelection) resultsScroll.current?.scrollTo({ y: 0, animated: false }); }, [areaSelection]);
=======
  const {
    type: initialType,
    query,
    min,
    max,
    district,
    state,
    pincode,
    address,
    areaSelection,
  } = useLocalSearchParams<{
    type?: PropertyType;
    query?: string;
    min?: string;
    max?: string;
    district?: string;
    state?: string;
    pincode?: string;
    address?: string;
    areaSelection?: string;
  }>();

  const [type, setType] = useState<PropertyType | undefined>(initialType || undefined);
  useEffect(() => {
    if (areaSelection) resultsScroll.current?.scrollTo({ y: 0, animated: false });
  }, [areaSelection]);
  useEffect(() => {
    setType(initialType || undefined);
  }, [initialType]);

>>>>>>> 23a60b94dc28d2a24448de8680090dee62d7f584
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [revision, setRevision] = useState(0);
  const filterKey = JSON.stringify([type, query, min, max, district, state, pincode, address, areaSelection]);
  const [pagination, setPagination] = useState<{ key: string; page: number; cursors: (string | undefined)[] }>({
    key: "",
    page: 1,
    cursors: [undefined],
  });
  const [nextCursor, setNextCursor] = useState<string>();
  const page = pagination.key === filterKey ? pagination.page : 1;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const searchFilters = {
        cursor: pagination.key === filterKey ? pagination.cursors[page - 1] : undefined,
        limit: 50,
        type,
        location: query,
        district,
        state,
        pincode,
        address,
        budgetMin: min ? Number(min) : undefined,
        budgetMax: max ? Number(max) : undefined,
      };
      const cached = cachedPropertySearch(searchFilters);
      if (cached) {
        setProperties(cached);
        setNextCursor((cached as any).nextCursor);
      }
      setLoading(!cached);
      setError("");
      setRefreshError("");
      propertyService
        .searchProperties(searchFilters)
        .then((data) => {
          if (active) {
            setProperties(data);
            setNextCursor((data as any).nextCursor);
          }
        })
        .catch(() => {
          if (active && cached) setRefreshError("Showing saved results. Could not refresh; try again shortly.");
          if (active && !cached) {
            setProperties([]);
            setError("We couldn’t load verified properties. Please try again.");
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
        setSelected(null);
      };
    }, [revision, type, query, min, max, district, state, pincode, address, areaSelection, page])
  );

<<<<<<< HEAD
    {!!pincode && <View style={s.headingRow}><Text style={s.note}>{state} · {district} · {pincode === "__missing__" ? "Pincode not provided" : pincode}</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.setParams({ pincode: "", state: "", district: "" })}><Text style={s.typeLabel}>Clear area filter</Text></TouchableOpacity></View>}
    {!!address && <View style={s.headingRow}><Text style={s.note}>Address: {address}</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.setParams({ address: "" })}><Text style={s.typeLabel}>Clear address search</Text></TouchableOpacity></View>}
    <PropertyTypeTabs value={type} onChange={setType} />
    {loading ? <ActivityIndicator style={{ padding: 30 }} color="#284B68" /> : error ? <View style={s.empty}><Text accessibilityRole="alert" style={s.note}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRevision(v => v + 1)} style={s.button}><Text style={s.buttonText}>Try again</Text></TouchableOpacity></View> : properties.length === 0 ? <View style={s.empty}><MaterialIcons name="home-work" size={36} color="#56768E" /><Text style={s.sectionTitle}>More places are on the way</Text><Text style={s.note}>Properties will appear here after Advisor and Verifier approval.</Text></View> : <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
      {properties.filter(p => type === undefined || p.type === type).map(property => (
        <TouchableOpacity key={property._id || property.id} accessibilityRole="button" onPress={() => setSelected(property)} activeOpacity={0.9} style={[s.cardWrapper, { width: width < 800 ? "100%" : 460, marginBottom: 12 }]}>
          <BlurView intensity={35} tint="light" style={s.cardBlur}>
            {/* Left Side Image */}
            <View style={s.cardImageContainer}>
              {property.media?.photos?.[0] ? <Image source={{ uri: property.media.photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={s.noPhoto} />}
              {/* Top Left Badge inside image */}
              <View style={s.imageBadge}><Text style={s.imageBadgeText}>{property.type.toUpperCase()}</Text></View>
=======
  const openProperty = useCallback(
    (property: Property) => {
      setSelected(null);
      router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } });
    },
    [router]
  );

  const isWide = width >= 800;

  return (
    <View style={s.screen}>
      <AppHeader />
      {!!refreshError && (
        <Text accessibilityRole="alert" style={s.alertNote}>
          {refreshError}
        </Text>
      )}

      <ScrollView ref={resultsScroll} contentContainerStyle={s.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={s.content}>
          {/* Hero Header Area */}
          <View style={s.heroSection}>
            {/* Top row with Eyebrow and Dash */}
            <View style={s.eyebrowRow}>
              <Text style={s.eyebrow}>A PLACE FOR YOUR NEXT CHAPTER</Text>
              <View style={s.eyebrowDash} />
>>>>>>> 23a60b94dc28d2a24448de8680090dee62d7f584
            </View>

            {/* Title Row with Right-aligned count & Skyline graphic */}
            <View style={s.titleRow}>
              <View style={s.titleLeft}>
                <Text style={s.mainTitle}>
                  {pincode
                    ? pincode === "__missing__"
                      ? "Properties without a pincode"
                      : `Properties in ${pincode}`
                    : "Explore our properties"}
                </Text>
              </View>

              <View style={s.titleRight}>
                <View style={s.countDivider} />
                <Text style={s.countText}>
                  {loading ? "Loading…" : `${properties.length} properties on page ${page}`}
                </Text>
              </View>

              {/* Skyline Background Graphic */}
              {isWide && (
                <View style={s.skylineWrapper}>
                  <CitySkyline width={440} height={135} opacity={0.6} />
                </View>
              )}
            </View>
<<<<<<< HEAD
          </BlurView>
        </TouchableOpacity>
      ))}
    </View>}
    {!loading && !error && <View style={s.typeRow}>
      {page > 1 && <TouchableOpacity accessibilityRole="button" style={s.typePill} onPress={() => setPagination(old => ({ key: filterKey, page: page - 1, cursors: old.cursors }))}><Text style={s.typeLabel}>Previous page</Text></TouchableOpacity>}
      {!!nextCursor && <TouchableOpacity accessibilityRole="button" style={s.typePill} onPress={() => setPagination(old => ({ key: filterKey, page: page + 1, cursors: [...(old.key === filterKey ? old.cursors.slice(0, page) : [undefined]), nextCursor] }))}><Text style={s.typeLabel}>Next page</Text></TouchableOpacity>}
      {page === 100 && <Text style={s.note}>Refine your search to see more relevant properties.</Text>}
    </View>}
    </View>
  </ScrollView>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={s.modal}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss property preview" onPress={() => setSelected(null)} />{selected && <View style={s.sheetFrame}><GlassBackdrop androidOnly><BlurView intensity={90} tint="light" accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}><View style={s.handle} /><ScrollView><View style={s.headingRow}><Text style={s.eyebrow}>PROPERTY PREVIEW</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close preview" onPress={() => setSelected(null)} style={s.circle}><MaterialIcons name="close" size={22} /></TouchableOpacity></View><Text style={s.sectionTitle}>{nameOf(selected)}</Text><Text style={s.note}>{selected.location.district}, {selected.location.state}</Text><Text style={s.sheetPrice}>{priceOf(selected)}</Text><View style={s.facts}><Text style={s.fact}>{selected.type}</Text><Text style={s.fact}>{selected.sellableArea != null ? `${selected.sellableArea.toLocaleString("en-IN")} sq.ft` : "Area not provided"}</Text><Text style={s.fact}>{selected.negotiable ? "Negotiable" : "Fixed price"}</Text></View><Text style={[s.note, { marginVertical: 18 }]}>{selected.title ? `${selected.title}. ` : ""}{selected.boundary ? `Boundary: ${selected.boundary}. ` : ""}{selected.roadWidth ? `Road Width: ${selected.roadWidth} ft. ` : ""}{selected.khata || selected.khesra ? `Khata: ${selected.khata || 'N/A'}, Khesra: ${selected.khesra || 'N/A'}. ` : ""}{selected.disclosures?.possessionStatus ? `Possession: ${selected.disclosures.possessionStatus}.` : ""}{!selected.boundary && !selected.roadWidth && !selected.khata && !selected.title && "Explore the full listing for more detailed property information, photos, and disclosures."}</Text></ScrollView><TouchableOpacity accessibilityRole="button" style={s.button} onPress={() => openProperty(selected)}><Text style={s.buttonText}>View full property details</Text><MaterialIcons name="arrow-forward" size={20} color="white" /></TouchableOpacity></BlurView></GlassBackdrop></View>}</View></Modal>
  </View>;
}
const s = premiumStyles({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: 1248, alignSelf: "center", padding: 28, paddingBottom: 45 },
  headingRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 },
  headingCenter: { alignItems: "center", gap: 16, marginBottom: 32, marginTop: 10 },
  centerSearchButton: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: AppTheme.colors.card, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, borderWidth: 1, borderColor: AppTheme.colors.border, width: "100%", maxWidth: 500, marginTop: 10, ...AppTheme.shadows.float, ...AppTheme.glass },
  centerSearchText: { color: AppTheme.colors.textSecondary, fontSize: 16, fontWeight: "500" },
  eyebrow: { color: "#4A5568", fontSize: 11, letterSpacing: 1.8, fontWeight: "700", textAlign: "center" },
  title: { fontSize: 44, lineHeight: 52, letterSpacing: -1.2, color: AppTheme.colors.text, fontWeight: "700", textAlign: "center", fontFamily: Platform.OS === "web" ? "Playfair Display, Georgia, serif" : "System" },
  circle: { width: 58, height: 58, borderRadius: 29, backgroundColor: AppTheme.colors.primaryLight, alignItems: "center", justifyContent: "center" },
  mapContainer: { width: "100%", height: 500, position: "relative", borderRadius: 32, overflow: "hidden", marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  floatingSearchContainer: { position: "absolute", top: 20, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  glassSearchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.85)", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 32, width: "90%", maxWidth: 400, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.9)", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 8, ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  glassSearchPlaceholder: { flex: 1, marginLeft: 12, fontSize: 14, color: "#2D3748", fontWeight: "600" },
  searchButtonCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: AppTheme.colors.primary, justifyContent: "center", alignItems: "center" },
  floatingFiltersRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  glassFilterChip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.8)", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.9)", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  filterChipText: { fontSize: 12, fontWeight: "600", color: "#2D3748" },
  note: { fontSize: 14, lineHeight: 23, color: AppTheme.colors.textSecondary, flexShrink: 1 }, sectionTitle: { color: AppTheme.colors.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.7, marginTop: 9 }, count: { color: AppTheme.colors.textSecondary, fontSize: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  sectionsContainer: { gap: 40 }, typeSection: { gap: 16 }, typeSectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }, typeSectionTitle: { fontSize: 24, fontWeight: "700", color: AppTheme.colors.text, letterSpacing: -0.5 }, typeSectionCount: { fontSize: 13, color: AppTheme.colors.textSecondary }, horizontalScrollContent: { gap: 18, paddingHorizontal: 4, paddingBottom: 25 },
  cardWrapper: { minHeight: 180, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12 },
  cardBlur: { flex: 1, flexDirection: "row", backgroundColor: AppTheme.colors.card, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.8)", overflow: "hidden", ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  cardImageContainer: { width: "36%", minHeight: 160, position: "relative", overflow: "hidden", borderRadius: 20, margin: 8 },
  noPhoto: { flex: 1, backgroundColor: "#E2E8F0" },
  imageBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  imageBadgeText: { fontSize: 10, fontWeight: "700", color: "#1A365D" },
  cardContent: { flex: 1, minWidth: 0, padding: 14, paddingLeft: 6, justifyContent: "center" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: AppTheme.colors.text, flex: 1, marginRight: 8 },
  heartBtn: { padding: 4 },
  cardPriceRow: { marginTop: 6, marginBottom: 4 },
  priceText: { fontSize: 15, fontWeight: "700", color: AppTheme.colors.text },
  locationText: { fontSize: 13, color: "#4A5568" },
  cardSpecs: { fontSize: 12, color: "#4A5568", marginBottom: 14 },
  cardFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#4A5568", justifyContent: "center", alignItems: "center" },
  cardFooterActions: { flexDirection: "row", gap: 8 },
  viewDetailsBtn: { backgroundColor: AppTheme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  viewDetailsBtnText: { color: "white", fontSize: 11, fontWeight: "600" },
  favoritesBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255, 255, 255, 0.6)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.8)" },
  favoritesBtnText: { color: "#4A5568", fontSize: 11, fontWeight: "600" },
  empty: { padding: 35, borderRadius: 24, backgroundColor: AppTheme.colors.card, gap: 18, ...AppTheme.shadows.soft, ...AppTheme.glass },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  typePill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 30, paddingVertical: 10, paddingHorizontal: 22, backgroundColor: "rgba(255,255,255,0.4)", ...AppTheme.glass },
  activePill: { backgroundColor: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,1)" },
  typeLabel: { color: "#4A5568", fontSize: 13, fontWeight: "600" },
  activeLabel: { color: "#1A365D" },
  modal: { flex: 1, backgroundColor: "rgba(15,33,55,0.42)", justifyContent: "flex-end" }, sheetFrame: { width: "100%", maxWidth: 660, maxHeight: "85%", alignSelf: "center", borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden" }, sheet: { width: "100%", flexShrink: 1, backgroundColor: AppTheme.colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 26, ...AppTheme.shadows.float, ...AppTheme.glass }, handle: { height: 4, width: 42, borderRadius: 4, backgroundColor: AppTheme.colors.border, alignSelf: "center", marginBottom: 22 }, sheetPrice: { fontSize: 34, fontWeight: "800", color: AppTheme.colors.primaryDark, marginVertical: 20 }, facts: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, fact: { backgroundColor: AppTheme.colors.card, padding: 12, borderRadius: 14, color: AppTheme.colors.textSecondary, ...AppTheme.glass }, button: { backgroundColor: AppTheme.colors.primary, padding: 18, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }, buttonText: { color: "white", fontSize: 14, fontWeight: "700" },
=======

            {/* Filter Area Clear Buttons if active */}
            {!!pincode && (
              <View style={s.filterInfoRow}>
                <Text style={s.filterInfoText}>
                  {state} · {district} · {pincode === "__missing__" ? "Pincode not provided" : pincode}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => router.setParams({ pincode: "", state: "", district: "" })}
                >
                  <Text style={s.clearFilterBtn}>Clear area filter</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!address && (
              <View style={s.filterInfoRow}>
                <Text style={s.filterInfoText}>Address: {address}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => router.setParams({ address: "" })}>
                  <Text style={s.clearFilterBtn}>Clear address search</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter Pills (All properties, Land, Flats, Houses, Shops, Offices) */}
            <PropertyTypeTabs value={type} onChange={setType} />
          </View>

          {/* Elevated Pure White Main Card */}
          <View style={s.mainCard}>
            {loading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color="#03456C" />
              </View>
            ) : error ? (
              <View style={s.emptyStateWrapper}>
                <Text accessibilityRole="alert" style={s.errorNote}>
                  {error}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setRevision((v) => v + 1)}
                  style={s.retryButton}
                >
                  <Text style={s.retryButtonText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : properties.length === 0 ? (
              /* Exact Empty State from Uploaded Design */
              <View style={s.emptyStateWrapper}>
                <HouseIllustration width={width < 600 ? 220 : 280} height={width < 600 ? 120 : 155} />
                <Text style={s.emptyHeading}>More places are on the way</Text>
                <Text style={s.emptySubheading}>
                  Properties will appear here after Advisor and Verifier approval.
                </Text>
              </View>
            ) : (
              /* Property Cards Grid */
              <View style={s.propertyGrid}>
                {properties
                  .filter((p) => type === undefined || p.type === type)
                  .map((property) => (
                    <TouchableOpacity
                      key={property._id || property.id}
                      accessibilityRole="button"
                      onPress={() => setSelected(property)}
                      activeOpacity={0.9}
                      style={[s.cardWrapper, { width: width < 800 ? "100%" : 460 }]}
                    >
                      <View style={s.cardInner}>
                        <View style={s.cardImageContainer}>
                          {property.media?.photos?.[0] ? (
                            <Image
                              source={{ uri: property.media.photos[0] }}
                              style={StyleSheet.absoluteFill}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={s.noPhoto} />
                          )}
                          <View style={s.imageBadge}>
                            <Text style={s.imageBadgeText}>{property.type.toUpperCase()}</Text>
                          </View>
                        </View>

                        <View style={s.cardContent}>
                          <View style={s.cardHeader}>
                            <Text style={s.cardTitle} numberOfLines={1}>
                              {property.title || `${property.type} in ${property.location.district}`}
                            </Text>
                            <TouchableOpacity style={s.heartBtn}>
                              <MaterialIcons name="favorite-border" size={18} color="#4A5568" />
                            </TouchableOpacity>
                          </View>
                          <Text style={s.cardPriceRow}>
                            <Text style={s.priceText}>{priceOf(property)}</Text>{" "}
                            <Text style={s.locationText}>
                              | {property.location.district}, {property.location.state}
                            </Text>
                          </Text>
                          <Text style={s.cardSpecs}>
                            {property.sellableArea
                              ? `${property.sellableArea.toLocaleString("en-IN")} sq ft`
                              : "Area not provided"}{" "}
                            | {property.negotiable ? "Negotiable" : "Fixed price"}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
          </View>

          {/* Pagination Controls */}
          {!loading && !error && (
            <View style={s.paginationRow}>
              {page > 1 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={s.pagePill}
                  onPress={() =>
                    setPagination((old) => ({ key: filterKey, page: page - 1, cursors: old.cursors }))
                  }
                >
                  <Text style={s.pagePillText}>Previous page</Text>
                </TouchableOpacity>
              )}
              {!!nextCursor && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={s.pagePill}
                  onPress={() =>
                    setPagination((old) => ({
                      key: filterKey,
                      page: page + 1,
                      cursors: [
                        ...(old.key === filterKey ? old.cursors.slice(0, page) : [undefined]),
                        nextCursor,
                      ],
                    }))
                  }
                >
                  <Text style={s.pagePillText}>Next page</Text>
                </TouchableOpacity>
              )}
              {page === 100 && (
                <Text style={s.filterInfoText}>Refine your search to see more relevant properties.</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Property Preview Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Dismiss property preview"
            onPress={() => setSelected(null)}
          />
          {selected && (
            <BlurView
              intensity={90}
              tint="light"
              accessibilityViewIsModal
              style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}
            >
              <View style={s.handle} />
              <ScrollView>
                <View style={s.sheetHeader}>
                  <Text style={s.eyebrow}>PROPERTY PREVIEW</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close preview"
                    onPress={() => setSelected(null)}
                    style={s.closeCircle}
                  >
                    <MaterialIcons name="close" size={20} color="#0A192F" />
                  </TouchableOpacity>
                </View>
                <Text style={s.mainTitle}>{nameOf(selected)}</Text>
                <Text style={s.filterInfoText}>
                  {selected.location.district}, {selected.location.state}
                </Text>
                <Text style={s.sheetPrice}>{priceOf(selected)}</Text>
                <View style={s.factsRow}>
                  <Text style={s.factChip}>{selected.type}</Text>
                  <Text style={s.factChip}>
                    {selected.sellableArea != null
                      ? `${selected.sellableArea.toLocaleString("en-IN")} sq.ft`
                      : "Area not provided"}
                  </Text>
                  <Text style={s.factChip}>{selected.negotiable ? "Negotiable" : "Fixed price"}</Text>
                </View>
                <Text style={[s.filterInfoText, { marginVertical: 18 }]}>
                  {selected.title ? `${selected.title}. ` : ""}
                  {selected.boundary ? `Boundary: ${selected.boundary}. ` : ""}
                  {selected.roadWidth ? `Road Width: ${selected.roadWidth} ft. ` : ""}
                  {selected.khata || selected.khesra
                    ? `Khata: ${selected.khata || "N/A"}, Khesra: ${selected.khesra || "N/A"}. `
                    : ""}
                  {selected.disclosures?.possessionStatus
                    ? `Possession: ${selected.disclosures.possessionStatus}.`
                    : ""}
                  {!selected.boundary &&
                    !selected.roadWidth &&
                    !selected.khata &&
                    !selected.title &&
                    "Explore the full listing for more detailed property information, photos, and disclosures."}
                </Text>
              </ScrollView>
              <TouchableOpacity
                accessibilityRole="button"
                style={s.viewDetailsAction}
                onPress={() => openProperty(selected)}
              >
                <Text style={s.viewDetailsActionText}>View full property details</Text>
                <MaterialIcons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
            </BlurView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  content: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
  },
  alertNote: {
    paddingHorizontal: 28,
    color: "#C53030",
    fontSize: 13,
    marginBottom: 8,
  },
  heroSection: {
    marginTop: 20,
    marginBottom: 10,
    position: "relative",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  eyebrow: {
    color: "#1E293B",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  eyebrowDash: {
    width: 28,
    height: 1.5,
    backgroundColor: "#94A3B8",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    position: "relative",
    minHeight: 52,
  },
  titleLeft: {
    flex: 1,
    zIndex: 2,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.6,
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
    zIndex: 2,
  },
  countDivider: {
    width: 1.5,
    height: 16,
    backgroundColor: "#94A3B8",
  },
  countText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  skylineWrapper: {
    position: "absolute",
    right: 0,
    bottom: -18,
    zIndex: 1,
    pointerEvents: "none",
  },
  filterInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  filterInfoText: {
    fontSize: 13,
    color: "#64748B",
  },
  clearFilterBtn: {
    fontSize: 13,
    fontWeight: "600",
    color: "#03456C",
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    minHeight: 380,
    paddingVertical: 56,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#0A192F",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
    elevation: 5,
    marginVertical: 14,
  },
  loadingContainer: {
    padding: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  emptyHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A192F",
    marginTop: 22,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  emptySubheading: {
    fontSize: 15,
    fontWeight: "500",
    color: "#3B82F6",
    marginTop: 8,
    textAlign: "center",
  },
  errorNote: {
    fontSize: 14,
    color: "#E53E3E",
    textAlign: "center",
    marginBottom: 14,
  },
  retryButton: {
    backgroundColor: "#03456C",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  propertyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    width: "100%",
  },
  cardWrapper: {
    minHeight: 170,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 10,
  },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    overflow: "hidden",
  },
  cardImageContainer: {
    width: "36%",
    minHeight: 150,
    position: "relative",
    borderRadius: 16,
    margin: 8,
    overflow: "hidden",
  },
  noPhoto: {
    flex: 1,
    backgroundColor: "#E2E8F0",
  },
  imageBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0A192F",
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A192F",
    flex: 1,
    marginRight: 6,
  },
  heartBtn: {
    padding: 4,
  },
  cardPriceRow: {
    marginTop: 4,
    marginBottom: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0A192F",
  },
  locationText: {
    fontSize: 13,
    color: "#64748B",
  },
  cardSpecs: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  pagePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pagePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0A192F",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 33, 55, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "85%",
  },
  handle: {
    height: 4,
    width: 40,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrice: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0A192F",
    marginVertical: 14,
  },
  factsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  viewDetailsAction: {
    backgroundColor: "#03456C",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  viewDetailsActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
>>>>>>> 23a60b94dc28d2a24448de8680090dee62d7f584
});
