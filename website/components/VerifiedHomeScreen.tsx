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
import { BlurView } from "expo-blur";

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

  const openProperty = useCallback(
    (property: Property) => {
      setSelected(null);
      router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } });
    },
    [router]
  );

  const isWide = width >= 800;
  const filteredProperties = properties.filter((p) => type === undefined || p.type === type);
  const carouselScroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const handleCarouselScroll = (direction: "left" | "right") => {
    if (!carouselScroll.current) return;
    const delta = direction === "left" ? -340 : 340;
    const target = Math.max(0, scrollOffset.current + delta);
    scrollOffset.current = target;
    carouselScroll.current.scrollTo({ x: target, animated: true });
  };

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
            {/* Top row with Eyebrow and Dash on left, count on right */}
            <View style={s.eyebrowRow}>
              <View style={s.eyebrowLeft}>
                <Text style={s.eyebrow}>A PLACE FOR YOUR NEXT CHAPTER</Text>
                <View style={s.eyebrowDash} />
              </View>

              <View style={s.titleRight}>
                <View style={s.countDivider} />
                <Text style={s.countText}>
                  {loading ? "Loading…" : `${properties.length} properties on page ${page}`}
                </Text>
              </View>
            </View>

            {/* Skyline Background Graphic */}
            {isWide && (
              <View style={s.skylineWrapper} pointerEvents="none">
                <CitySkyline
                  width={width < 1100 ? 440 : 560}
                  maxWidth="50%"
                  height={160}
                  opacity={0.96}
                />
              </View>
            )}

            {/* Title Row */}
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
            </View>

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
            ) : filteredProperties.length === 0 ? (
              /* Empty State (Overall or for specific filtered type) */
              <View style={s.emptyStateWrapper}>
                <HouseIllustration width={width < 600 ? 220 : 280} height={width < 600 ? 120 : 155} />
                <Text style={s.emptyHeading}>
                  {type ? `No ${type} properties available yet` : "More places are on the way"}
                </Text>
                <Text style={s.emptySubheading}>
                  {type
                    ? `We have verified listings in other categories. Switch to "All properties" or "Land" to view them.`
                    : "Properties will appear here after Advisor and Verifier approval."}
                </Text>
                {!!type && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setType(undefined)}
                    style={[s.retryButton, { marginTop: 16 }]}
                  >
                    <Text style={s.retryButtonText}>View all properties</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              /* Horizontal Scrollable Carousel */
              <View style={s.carouselWrapper}>
                {/* Header bar with total available count and navigation arrows */}
                <View style={s.carouselHeader}>
                  <View style={s.carouselTitleRow}>
                    <Text style={s.carouselTitle}>
                      {type
                        ? `${type.charAt(0).toUpperCase() + type.slice(1)} Properties`
                        : "Verified Properties"}
                    </Text>
                    <View style={s.countBadge}>
                      <Text style={s.countBadgeText}>{filteredProperties.length} available</Text>
                    </View>
                  </View>

                  <View style={s.arrowControls}>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Previous properties"
                      onPress={() => handleCarouselScroll("left")}
                      style={s.arrowBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="chevron-left" size={24} color="#03456C" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Next properties"
                      onPress={() => handleCarouselScroll("right")}
                      style={s.arrowBtn}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="chevron-right" size={24} color="#03456C" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Horizontal Scroll Area */}
                <ScrollView
                  ref={carouselScroll}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.carouselContent}
                  onScroll={(e) => {
                    scrollOffset.current = e.nativeEvent.contentOffset.x;
                  }}
                  scrollEventThrottle={16}
                >
                  {filteredProperties.map((property) => (
                    <TouchableOpacity
                      key={property._id || property.id}
                      accessibilityRole="button"
                      onPress={() => setSelected(property)}
                      activeOpacity={0.92}
                      style={s.horizontalCard}
                    >
                      {/* Card Top: Image & Badges */}
                      <View style={s.cardTopImage}>
                        {property.media?.photos?.[0] ? (
                          <Image
                            source={{ uri: property.media.photos[0] }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={s.noPhoto}>
                            <MaterialIcons name="landscape" size={36} color="#94A3B8" />
                          </View>
                        )}
                        <View style={s.imageBadge}>
                          <Text style={s.imageBadgeText}>{property.type.toUpperCase()}</Text>
                        </View>
                        <TouchableOpacity
                          style={s.heartPill}
                          accessibilityRole="button"
                          accessibilityLabel="Save property"
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                          }}
                        >
                          <MaterialIcons name="favorite-border" size={17} color="#03456C" />
                        </TouchableOpacity>
                      </View>

                      {/* Card Body */}
                      <View style={s.horizontalCardBody}>
                        <Text style={s.horizontalCardTitle} numberOfLines={2}>
                          {property.title || `${property.type} in ${property.location.district}`}
                        </Text>

                        <View style={s.priceLocationRow}>
                          <Text style={s.priceText}>{priceOf(property)}</Text>
                          <Text style={s.locationText} numberOfLines={1}>
                            {property.location.district}, {property.location.state}
                          </Text>
                        </View>

                        <View style={s.specsRow}>
                          <View style={s.specChip}>
                            <MaterialIcons name="square-foot" size={15} color="#64748B" />
                            <Text style={s.specText}>
                              {property.sellableArea
                                ? `${property.sellableArea.toLocaleString("en-IN")} sq ft`
                                : "Area unlisted"}
                            </Text>
                          </View>
                          <View style={[s.specChip, property.negotiable ? s.negotiableChip : s.fixedChip]}>
                            <Text style={[s.negotiableText, property.negotiable ? s.negotiableColor : s.fixedColor]}>
                              {property.negotiable ? "Negotiable" : "Fixed price"}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => setSelected(property)}
                          style={s.viewDetailsBtn}
                          activeOpacity={0.85}
                        >
                          <Text style={s.viewDetailsText}>View Details</Text>
                          <MaterialIcons name="arrow-forward" size={14} color="#03456C" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
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
    paddingBottom: 110,
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
    justifyContent: "space-between",
    marginBottom: 6,
    zIndex: 2,
  },
  eyebrowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    alignItems: "center",
    position: "relative",
    minHeight: 48,
    marginBottom: 4,
    zIndex: 2,
  },
  titleLeft: {
    flex: 1,
    zIndex: 2,
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.6,
  },
  titleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    bottom: 0,
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
    minHeight: 360,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    marginVertical: 14,
    width: "100%",
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
    paddingVertical: 32,
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
    color: "#475569",
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
  carouselWrapper: {
    width: "100%",
  },
  carouselHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  carouselTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: "#EBF3F8",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03456C",
  },
  arrowControls: {
    flexDirection: "row",
    gap: 8,
  },
  arrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  carouselContent: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 18,
  },
  horizontalCard: {
    width: 310,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    overflow: "hidden",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardTopImage: {
    width: "100%",
    height: 185,
    position: "relative",
    backgroundColor: "#F1F5F9",
  },
  noPhoto: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  imageBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(3, 69, 108, 0.9)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  heartPill: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  horizontalCardBody: {
    padding: 16,
  },
  horizontalCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0A192F",
    minHeight: 42,
    lineHeight: 21,
  },
  priceLocationRow: {
    marginTop: 6,
    marginBottom: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#03456C",
  },
  locationText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  specsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  specChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  specText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  negotiableChip: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  negotiableText: {
    fontSize: 11,
    fontWeight: "700",
  },
  negotiableColor: {
    color: "#059669",
  },
  fixedChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fixedColor: {
    color: "#64748B",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#F0F7FB",
    borderWidth: 1,
    borderColor: "#D0E4F0",
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#03456C",
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
});
