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
    paddingVertical: 52,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
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
});
