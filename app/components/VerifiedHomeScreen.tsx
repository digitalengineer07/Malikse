import { premiumStyles } from "../constants/typography";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import AppHeader from "./AppHeader";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import { propertyService } from "../src/services/propertyService";
import type { Property, PropertyType } from "../src/types/property.types";
import { AppTheme } from "../constants/theme";


const nameOf = (p: Property) => p.title || `${p.type} in ${p.location.district}`;
const priceOf = (p: Property) => `₹${p.price.toLocaleString("en-IN")}`;

const propertyTypes: { value: PropertyType | undefined; label: string }[] = [
  { value: undefined, label: "All properties" }, { value: "land", label: "Land" },
  { value: "flat", label: "Flats" }, { value: "house", label: "Houses" },
  { value: "shop", label: "Shops" }, { value: "office", label: "Offices" },
];
export default function VerifiedHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const { type: initialType, query, min, max } = useLocalSearchParams<{ type?: PropertyType; query?: string; min?: string; max?: string }>();
  const [type, setType] = useState<PropertyType | undefined>(initialType);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError("");
    const searchFilters = { type, location: query, budgetMin: min ? Number(min) : undefined, budgetMax: max ? Number(max) : undefined };
    propertyService.searchProperties(searchFilters).then(data => { if (active) setProperties(data); }).catch(() => { if (active) { setProperties([]); setError("We couldn’t load verified properties. Please try again."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; setSelected(null); };
  // Retry explicitly reloads the same backend query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, type, query, min, max]));
  const openProperty = useCallback((property: Property) => { setSelected(null); router.push({ pathname: "/property/[id]", params: { id: property._id || property.id } }); }, [router]);
  return <View style={s.screen}>
    <AppHeader />
    <ScrollView contentContainerStyle={{ paddingBottom: 45 }}>
    <View style={[s.mapContainer, { width: "100%", height: 500, borderRadius: 0, marginTop: 0 }]}>
      <VerifiedPropertyMap properties={properties} onSelect={openProperty} />
    </View>
    <View style={[s.content, width < 600 && { paddingHorizontal: 18 }]}>
    <View style={[s.headingRow, { marginTop: 36, marginBottom: 16 }]}><View><Text style={s.eyebrow}>A PLACE FOR YOUR NEXT CHAPTER</Text><Text style={s.sectionTitle}>Explore our properties</Text></View><Text style={s.count}>{properties.length} available</Text></View>
    
    <View style={s.typeRow}>
      {propertyTypes.map(({ value, label }) => (
        <TouchableOpacity key={value || "all"} accessibilityRole="button" accessibilityState={{ selected: type === value }} onPress={() => setType(value)} style={[s.typePill, type === value && s.activePill]}>
          <Text style={[s.typeLabel, type === value && s.activeLabel]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {loading ? <ActivityIndicator style={{ padding: 30 }} color="#284B68" /> : error ? <View style={s.empty}><Text accessibilityRole="alert" style={s.note}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRevision(v => v + 1)} style={s.button}><Text style={s.buttonText}>Try again</Text></TouchableOpacity></View> : properties.length === 0 ? <View style={s.empty}><MaterialIcons name="home-work" size={36} color="#56768E" /><Text style={s.sectionTitle}>More places are on the way</Text><Text style={s.note}>Properties will appear here after Advisor and Verifier approval.</Text></View> : <View style={s.sectionsContainer}>
      {propertyTypes.filter(pt => pt.value !== undefined && (type === undefined || type === pt.value)).map(pt => {
        const typeProperties = properties.filter(p => p.type === pt.value);
        if (typeProperties.length === 0) return null;
        return (
          <View key={pt.value} style={s.typeSection}>
            <View style={s.typeSectionHeader}>
              <Text style={s.typeSectionTitle}>{pt.label}</Text>
              <Text style={s.typeSectionCount}>{typeProperties.length} available</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScrollContent}>
              {typeProperties.map(property => (
                <TouchableOpacity key={property._id || property.id} accessibilityRole="button" onPress={() => setSelected(property)} activeOpacity={0.9} style={[s.cardWrapper, { width: width < 800 ? width * 0.85 : 460 }]}>
                  <View style={s.cardBlur}>
                    {/* Left Side Image */}
                    <View style={s.cardImageContainer}>
                      {property.media?.photos?.[0] ? <Image source={{ uri: property.media.photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={s.noPhoto} />}
                      {/* Top Left Badge inside image */}
                      <View style={s.imageBadge}><Text style={s.imageBadgeText}>{property.type.toUpperCase()}</Text></View>
                    </View>
                    {/* Right Side Content */}
                    <View style={s.cardContent}>
                      <View style={s.cardHeader}>
                        <Text style={s.cardTitle} numberOfLines={1}>{property.title || `${property.type} in ${property.location.district}`}</Text>
                        <TouchableOpacity style={s.heartBtn}><MaterialIcons name="favorite-border" size={18} color="#4A5568" /></TouchableOpacity>
                      </View>
                      <Text style={s.cardPriceRow}><Text style={s.priceText}>{priceOf(property)}</Text> <Text style={s.locationText}>| {property.location.district}, {property.location.state}</Text></Text>
                      <Text style={s.cardSpecs}>{property.sellableArea ? `${property.sellableArea.toLocaleString("en-IN")} sq ft` : "Area not provided"} | {property.negotiable ? "Negotiable" : "Fixed price"}</Text>
                      
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>}
    </View>
  </ScrollView>
    <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}><View style={s.modal}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss property preview" onPress={() => setSelected(null)} />{selected && <BlurView intensity={90} tint="light" accessibilityViewIsModal style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}><View style={s.handle} /><ScrollView><View style={s.headingRow}><Text style={s.eyebrow}>PROPERTY PREVIEW</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close preview" onPress={() => setSelected(null)} style={s.smallCircle}><MaterialIcons name="close" size={22} /></TouchableOpacity></View><Text style={s.sectionTitle}>{nameOf(selected)}</Text><Text style={s.note}>{selected.location.district}, {selected.location.state}</Text><Text style={s.sheetPrice}>{priceOf(selected)}</Text><View style={s.facts}><Text style={s.fact}>{selected.type}</Text><Text style={s.fact}>{selected.sellableArea != null ? `${selected.sellableArea.toLocaleString("en-IN")} sq.ft` : "Area not provided"}</Text><Text style={s.fact}>{selected.negotiable ? "Negotiable" : "Fixed price"}</Text></View><Text style={[s.note, { marginVertical: 18 }]}>{selected.title ? `${selected.title}. ` : ""}{selected.boundary ? `Boundary: ${selected.boundary}. ` : ""}{selected.roadWidth ? `Road Width: ${selected.roadWidth} ft. ` : ""}{selected.khata || selected.khesra ? `Khata: ${selected.khata || 'N/A'}, Khesra: ${selected.khesra || 'N/A'}. ` : ""}{selected.disclosures?.possessionStatus ? `Possession: ${selected.disclosures.possessionStatus}.` : ""}{!selected.boundary && !selected.roadWidth && !selected.khata && !selected.title && "Explore the full listing for more detailed property information, photos, and disclosures."}</Text></ScrollView><TouchableOpacity accessibilityRole="button" style={s.button} onPress={() => openProperty(selected)}><Text style={s.buttonText}>View full property details</Text><MaterialIcons name="arrow-forward" size={20} color="white" /></TouchableOpacity></BlurView>}</View></Modal>
  </View>;
}
const s = premiumStyles({
  screen: { flex: 1, backgroundColor: "transparent" }, 
  content: { width: "100%", maxWidth: 1248, alignSelf: "center", padding: 28, paddingBottom: 45 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 }, 
  headingCenter: { alignItems: "center", gap: 16, marginBottom: 32, marginTop: 10 },
  centerSearchButton: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: AppTheme.colors.card, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, borderWidth: 1, borderColor: AppTheme.colors.border, width: "100%", maxWidth: 500, marginTop: 10, ...AppTheme.shadows.float, ...AppTheme.glass },
  centerSearchText: { color: AppTheme.colors.textSecondary, fontSize: 16, fontWeight: "500" },
  eyebrow: { color: "#4A5568", fontSize: 11, letterSpacing: 1.8, fontWeight: "700", textAlign: "center" }, 
  title: { fontSize: 44, lineHeight: 52, letterSpacing: -1.2, color: "#1A202C", fontWeight: "700", textAlign: "center", fontFamily: Platform.OS === "web" ? "Playfair Display, Georgia, serif" : "System" }, 
  circle: { width: 58, height: 58, borderRadius: 29, backgroundColor: AppTheme.colors.primaryLight, alignItems: "center", justifyContent: "center" },
  mapContainer: { width: "100%", height: 500, position: "relative", borderRadius: 32, overflow: "hidden", marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  floatingSearchContainer: { position: "absolute", top: 20, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  glassSearchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.85)", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 32, width: "90%", maxWidth: 400, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.9)", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 8, ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  glassSearchPlaceholder: { flex: 1, marginLeft: 12, fontSize: 14, color: "#2D3748", fontWeight: "600" },
  searchButtonCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1A365D", justifyContent: "center", alignItems: "center" },
  floatingFiltersRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  glassFilterChip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.8)", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.9)", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  filterChipText: { fontSize: 12, fontWeight: "600", color: "#2D3748" },
  note: { fontSize: 14, lineHeight: 23, color: AppTheme.colors.textSecondary, flexShrink: 1 }, sectionTitle: { color: AppTheme.colors.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.7, marginTop: 9 }, count: { color: AppTheme.colors.textSecondary, fontSize: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 20 }, 
  sectionsContainer: { gap: 40 }, typeSection: { gap: 16 }, typeSectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 }, typeSectionTitle: { fontSize: 24, fontWeight: "700", color: AppTheme.colors.text, letterSpacing: -0.5 }, typeSectionCount: { fontSize: 13, color: AppTheme.colors.textSecondary }, horizontalScrollContent: { gap: 18, paddingHorizontal: 4, paddingBottom: 25 },
  cardWrapper: { height: 180, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12 },
  cardBlur: { flex: 1, flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.8)", overflow: "hidden", ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  cardImageContainer: { width: "40%", height: "100%", position: "relative", overflow: "hidden", borderRadius: 20, margin: 8 },
  noPhoto: { flex: 1, backgroundColor: "#E2E8F0" },
  imageBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  imageBadgeText: { fontSize: 10, fontWeight: "700", color: "#1A365D" },
  cardContent: { flex: 1, padding: 14, paddingLeft: 6, justifyContent: "center" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1A202C", flex: 1, marginRight: 8 },
  heartBtn: { padding: 4 },
  cardPriceRow: { marginTop: 6, marginBottom: 4 },
  priceText: { fontSize: 15, fontWeight: "700", color: "#1A202C" },
  locationText: { fontSize: 13, color: "#4A5568" },
  cardSpecs: { fontSize: 12, color: "#4A5568", marginBottom: 14 },
  cardFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#4A5568", justifyContent: "center", alignItems: "center" },
  cardFooterActions: { flexDirection: "row", gap: 8 },
  viewDetailsBtn: { backgroundColor: "#1A365D", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  viewDetailsBtnText: { color: "white", fontSize: 11, fontWeight: "600" },
  favoritesBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255, 255, 255, 0.6)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.8)" },
  favoritesBtnText: { color: "#4A5568", fontSize: 11, fontWeight: "600" },
  empty: { padding: 35, borderRadius: 24, backgroundColor: AppTheme.colors.card, gap: 18, ...AppTheme.shadows.soft, ...AppTheme.glass },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  typePill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 30, paddingVertical: 10, paddingHorizontal: 22, backgroundColor: "rgba(255,255,255,0.4)", ...AppTheme.glass },
  activePill: { backgroundColor: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,1)" },
  typeLabel: { color: "#4A5568", fontSize: 13, fontWeight: "600" },
  activeLabel: { color: "#1A365D" },
  modal: { flex: 1, backgroundColor: "rgba(15,33,55,0.42)", justifyContent: "flex-end" }, sheet: { width: "100%", maxWidth: 660, alignSelf: "center", backgroundColor: AppTheme.colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 26, maxHeight: "85%", ...AppTheme.shadows.float, ...AppTheme.glass }, handle: { height: 4, width: 42, borderRadius: 4, backgroundColor: AppTheme.colors.border, alignSelf: "center", marginBottom: 22 }, sheetPrice: { fontSize: 34, fontWeight: "800", color: AppTheme.colors.primaryDark, marginVertical: 20 }, facts: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, fact: { backgroundColor: AppTheme.colors.card, padding: 12, borderRadius: 14, color: AppTheme.colors.textSecondary, ...AppTheme.glass }, button: { backgroundColor: AppTheme.colors.primary, padding: 18, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }, buttonText: { color: "white", fontSize: 14, fontWeight: "700" },
});
