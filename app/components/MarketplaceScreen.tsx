import { premiumStyles } from "../constants/typography";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { WorkflowScreen } from "./WorkflowUI";
import type { PropertyType } from "../src/types/property.types";
import { useAuthStore } from "../src/store/authStore";
import { dashboardRoutes } from "../src/utils/accountRoutes";

const propertyTypes: { value: PropertyType | undefined; label: string }[] = [
  { value: undefined, label: "All properties" }, { value: "land", label: "Land" },
  { value: "flat", label: "Flats" }, { value: "house", label: "Houses" },
  { value: "shop", label: "Shops" }, { value: "office", label: "Offices" },
];



export default function MarketplaceScreen() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { width } = useWindowDimensions();
  const compact = width < 650;
  const columns = width >= 1050 ? 3 : width >= 650 ? 2 : 1;
  const contentWidth = Math.min(width, 1200) - (compact ? 40 : 64);
  const cardWidth = columns === 3 ? "31.8%" : columns === 2 ? "48%" : "100%";
  const [query, setQuery] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [validationError, setValidationError] = useState("");
  const [showBudget, setShowBudget] = useState(false);

  const search = () => {
    if ((min && (!Number.isFinite(Number(min)) || Number(min) < 0)) || (max && (!Number.isFinite(Number(max)) || Number(max) < 0)) || (min && max && Number(min) > Number(max))) { setValidationError("Enter a valid price range."); return; }
    setValidationError("");
    router.push({ pathname: '/home', params: { query: query.trim() || undefined, min: min || undefined, max: max || undefined } });
  };
  return <WorkflowScreen title={"Find your\nperfect place."} contentStyle={[styles.content, compact && styles.contentCompact]} titleStyle={[styles.title, compact && styles.titleCompact]}>
    <Text style={styles.intro}>Land to build on. A place to call home. Discover verified properties with MalikSe.</Text>
    <View style={styles.searchPanel}>
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={21} color="#617083" />
        <TextInput accessibilityLabel="Location or title" placeholder="Where would you like to live?" placeholderTextColor="#7A8592" value={query} onChangeText={setQuery} onSubmitEditing={() => search()} returnKeyType="search" style={styles.searchInput} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Budget filters" accessibilityState={{ expanded: showBudget }} onPress={() => setShowBudget(!showBudget)} style={[styles.budgetToggle, showBudget && styles.budgetActive]}><MaterialIcons name="tune" size={20} color="#151A20" /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search properties" onPress={() => search()} style={styles.searchButton}><MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" /></TouchableOpacity>
      </View>
      {showBudget && <View style={styles.budgetPanel}>
        <View style={styles.budgetField}><Text style={styles.budgetLabel}>Minimum price (₹)</Text><TextInput accessibilityLabel="Minimum price (₹)" placeholder="No minimum" placeholderTextColor="#788492" keyboardType="numeric" value={min} onChangeText={setMin} style={styles.budgetInput} /></View>
        <View style={styles.budgetField}><Text style={styles.budgetLabel}>Maximum price (₹)</Text><TextInput accessibilityLabel="Maximum price (₹)" placeholder="No maximum" placeholderTextColor="#788492" keyboardType="numeric" value={max} onChangeText={setMax} style={styles.budgetInput} /></View>
        <TouchableOpacity accessibilityRole="button" onPress={() => search()} style={styles.applyButton}><Text style={styles.buttonLabel}>Apply budget</Text></TouchableOpacity>
      </View>}
      {!!validationError && <Text accessibilityRole="alert" style={styles.errorText}>{validationError}</Text>}
      {!showBudget && !!(min || max) && <Text style={styles.disclaimer}>Budget: ₹{Number(min || 0).toLocaleString("en-IN")} – {max ? `₹${Number(max).toLocaleString("en-IN")}` : "Any maximum"}</Text>}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.collectionGrid, !compact && { width: "100%" }]} style={styles.collections}>
      {[
        { title: 'Land & possibility', subtitle: 'A place to build your vision.', type: 'land' as const, image: require('../assets/saved_plot_land.jpg') },
        { title: 'A home of your own', subtitle: 'Space for your next chapter.', type: 'house' as const, image: require('../assets/saved_villa_house.jpg') },
        { title: 'Find your everyday', subtitle: 'Explore flats for your next move.', type: 'flat' as const, image: require('../assets/my_listings_hero_bg.png') },
      ].map(item => <TouchableOpacity key={item.type} accessibilityRole="button" accessibilityLabel={`Browse ${item.type} properties`} onPress={() => { router.push({ pathname: '/home', params: { type: item.type } }); }} activeOpacity={0.9} style={[styles.collectionCard, compact ? { width: contentWidth * 0.87 } : { flex: 1 }]}>
        <Image source={item.image} style={styles.collectionImage} resizeMode="cover" />
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}><Defs><LinearGradient id={`shade-${item.type}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="35%" stopColor="#071524" stopOpacity="0" /><Stop offset="100%" stopColor="#071524" stopOpacity="0.9" /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#shade-${item.type})`} /></Svg><View style={[styles.collectionContent, Platform.OS === "web" && { backdropFilter: "none" } as any]}><Text style={styles.collectionTitle}>{item.title}</Text><Text style={styles.collectionSubtitle}>{item.subtitle}</Text><View style={styles.collectionButton}><Text style={styles.sellerButtonText}>Explore {item.type === 'house' ? 'houses' : item.type === 'flat' ? 'flats' : 'land'}</Text><MaterialIcons name="north-east" size={15} color="#111827" /></View></View>
      </TouchableOpacity>)}
    </ScrollView>
    <Text style={[styles.disclaimer, { marginTop: 20 }]}>Only Advisor- and Verifier-approved listings are published. Verification is not a guarantee of legal title.</Text>
    <View style={[styles.sellerSection, compact && styles.sellerCompact]}>
      <View style={styles.sellerCopy}><Text style={styles.eyebrow}>YOUR PROPERTY. YOUR NEXT CHAPTER.</Text><Text accessibilityRole="header" style={styles.sellerTitle}>A clearer way to{ "\n" }sell your property.</Text><Text style={styles.sellerText}>From your first draft to final review, keep every step of your listing in one place.</Text>
        <View style={styles.sellerPoints}>{["Add your property details and location", "Submit for Advisor and Verifier review", "Track progress and respond to corrections"].map(label => <View key={label} style={styles.sellerPoint}><MaterialIcons name="check-circle-outline" size={16} color="#537B9D" /><Text style={styles.sellerText}>{label}</Text></View>)}</View>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/listing/create')} style={styles.sellerButton}><Text style={styles.sellerButtonText}>List your property</Text><MaterialIcons name="north-east" size={17} color="#111111" /></TouchableOpacity>
      </View>
      <View style={[styles.sellerVisual, compact && styles.sellerVisualCompact]}><Image source={require('../assets/saved_villa_house.jpg')} accessibilityLabel="Architectural landscape illustration" style={styles.sellerImage} resizeMode="cover" /><View style={styles.visualCaption}><Text style={styles.visualCaptionText}>Room for your next chapter.</Text><Text style={styles.visualCaptionSmall}>MalikSe · Your Land. A Safer Future.</Text></View></View>
    </View>
    <View style={styles.journeyHeader}><Text style={styles.eyebrow}>BUILT AROUND YOUR PROPERTY JOURNEY</Text><Text accessibilityRole="header" style={styles.sectionTitle}>Every step, in one place.</Text></View>
    <View style={[styles.journeyGrid, compact && styles.journeyCompact]}>{[
      { icon: 'add-home-work' as const, title: 'Create your listing', text: 'Add property information, photos, and the parcel location.', action: 'Get started', route: '/listing/create' as const },
      { icon: 'fact-check' as const, title: 'Follow your review', text: 'See verification progress and respond to correction requests.', action: 'My properties', route: '/my-properties' as const },
      { icon: 'person-outline' as const, title: 'Your account', text: 'Access your profile and the dashboard for your role.', action: 'Open dashboard', route: user ? dashboardRoutes[user.role] : '/(auth)/login' as const },
    ].map(item => <TouchableOpacity key={item.title} accessibilityRole="button" onPress={() => router.push(item.route)} style={styles.journeyCard}><MaterialIcons name={item.icon} size={28} color="#477696" /><Text style={styles.journeyTitle}>{item.title}</Text><Text style={styles.sellerText}>{item.text}</Text><View style={styles.journeyAction}><Text style={styles.sellerButtonText}>{item.action}</Text><MaterialIcons name="north-east" size={17} color="#111111" /></View></TouchableOpacity>)}</View>
  </WorkflowScreen>;
}

const styles = premiumStyles({
  content: { maxWidth: 1200, paddingHorizontal: 32, paddingTop: 54, paddingBottom: 64, gap: 0 },
  contentCompact: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  title: { textAlign: "center", fontSize: 58, lineHeight: 66, fontWeight: "600", letterSpacing: -2.2, color: "#111111" },
  titleCompact: { fontSize: 38, lineHeight: 45, letterSpacing: -1.4 },
  intro: { textAlign: "center", color: "#6C7885", fontSize: 14, lineHeight: 24, marginTop: 18, maxWidth: 600, alignSelf: "center" },
  disclaimer: { textAlign: "center", color: "#738396", fontSize: 11, lineHeight: 18, marginTop: 7 },
  searchPanel: { marginTop: 28, marginBottom: 32, gap: 24 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  typePill: { borderWidth: 1, borderColor: "#DCE5EC", borderRadius: 30, paddingVertical: 11, paddingHorizontal: 24, backgroundColor: "transparent" },
  activePill: { backgroundColor: "#111111", borderColor: "#111111" },
  typeLabel: { color: "#617184", fontSize: 12, fontWeight: "500" },
  activeLabel: { color: "#FFFFFF" },
  fields: { flexDirection: "row", alignItems: "flex-end", gap: 16, padding: 22, backgroundColor: "transparent", borderWidth: 1, borderColor: "#E3E8DF", borderRadius: 20 },
  fieldsCompact: { flexDirection: "column", alignItems: "stretch", padding: 18 },
  locationField: { flex: 1.6 }, priceField: { flex: 1 },
  searchButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#111111" },
  buttonLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  resultsHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 23 },
  sectionTitle: { fontSize: 29, letterSpacing: -1, color: "#111111", fontWeight: "600", flexShrink: 1 },
  resultCount: { fontSize: 12, color: "#718295" },
  propertyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 22 },
  propertyCard: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#E5EDF4", borderRadius: 30, overflow: "hidden" },
  photoWrap: { height: 270, backgroundColor: "#E9F3FC" },
  photo: { width: "100%", height: "100%" },
  missingPhoto: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#EDF6FD" },
  missingPhotoText: { fontSize: 12, color: "#657F95" },
  photoBadge: { position: "absolute", left: 16, top: 16, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EDF7FF" },
  badgeText: { color: "#376887", fontSize: 10, fontWeight: "600" },
  cardBody: { padding: 22, gap: 10, backgroundColor: "#F4F8FB", borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24 },
  propertyType: { textTransform: "uppercase", fontSize: 10, letterSpacing: 1.5, color: "#74889B" },
  propertyTitle: { fontSize: 22, fontWeight: "600", color: "#111111", lineHeight: 29 },
  locationRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  locationText: { fontSize: 12, color: "#718295", flex: 1, lineHeight: 18 },
  price: { color: "#111111", fontSize: 26, fontWeight: "600", letterSpacing: -0.8, marginTop: 6 },
  detailsRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  detailText: { color: "#6B7E90", fontSize: 12 },
  approvalText: { fontSize: 10, color: "#547B98", lineHeight: 16, marginTop: 3 },
  detailsButton: { backgroundColor: "#111111", borderRadius: 24, paddingVertical: 13, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7 },
  statePanel: { minHeight: 155, borderRadius: 22, borderWidth: 1, borderColor: "#E3EFF8", backgroundColor: "#F3F8FC", alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyIcon: { height: 72, width: 72, borderRadius: 36, backgroundColor: "#E1F0FC", alignItems: "center", justifyContent: "center" },
  stateTitle: { fontSize: 18, fontWeight: "600", color: "#151A20", textAlign: "center", lineHeight: 25 },
  stateDescription: { fontSize: 13, lineHeight: 22, color: "#6E8092", textAlign: "center", maxWidth: 450 },
  errorText: { color: "#A13C32", fontSize: 13, lineHeight: 21, textAlign: "center" },
  retryButton: { backgroundColor: "#DEEEFA", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  retryLabel: { color: "#294D69", fontSize: 13, fontWeight: "600" },
  searchBar: { width: '100%', maxWidth: 660, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0F7FC', borderRadius: 36, padding: 8, paddingLeft: 20, borderWidth: 1, borderColor: '#E1EDF6' },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: '#111111', paddingVertical: 10 },
  budgetToggle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  budgetActive: { backgroundColor: '#D9EAF7' },
  budgetPanel: { width: '100%', maxWidth: 660, alignSelf: 'center', padding: 18, borderRadius: 20, backgroundColor: '#F1F7FC', flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  budgetField: { flex: 1, minWidth: 110, gap: 8 }, budgetLabel: { fontSize: 11, color: '#52657A' },
  budgetInput: { padding: 12, backgroundColor: "transparent", borderRadius: 12, color: '#111111', fontSize: 13 },
  applyButton: { padding: 13, borderRadius: 20, backgroundColor: '#111111' },
  sellerSection: { flexDirection: 'row', gap: 50, marginTop: 65, marginBottom: 65, alignItems: 'center' },
  sellerCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 26, marginTop: 45, marginBottom: 45 },
  sellerCopy: { flex: 1, gap: 18 }, eyebrow: { fontSize: 9, letterSpacing: 1.7, color: '#67839C', fontWeight: '600' },
  sellerTitle: { fontSize: 33, lineHeight: 39, fontWeight: '600', letterSpacing: -1, color: '#111111' },
  sellerText: { color: '#677582', fontSize: 12, lineHeight: 21, flexShrink: 1 },
  sellerPoints: { gap: 10 }, sellerPoint: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sellerButton: { alignSelf: 'flex-start', flexDirection: 'row', gap: 24, alignItems: 'center', backgroundColor: '#E9F3FB', paddingHorizontal: 21, paddingVertical: 13, borderRadius: 28 },
  sellerButtonText: { color: '#111111', fontSize: 12, fontWeight: '600' },
  sellerVisual: { flex: 1, height: 340, borderRadius: 22, overflow: 'hidden', backgroundColor: '#EAF3FA' },
  sellerVisualCompact: { flex: undefined, height: 280 }, sellerImage: { width: '100%', height: '100%' },
  visualCaption: { position: 'absolute', left: 18, right: 18, bottom: 18, padding: 18, borderRadius: 15, backgroundColor: '#FFFFFFE8', gap: 6 },
  visualCaptionText: { color: '#111111', fontSize: 18, fontWeight: '600' }, visualCaptionSmall: { color: '#607489', fontSize: 10 },
  journeyHeader: { alignItems: 'center', gap: 13, marginBottom: 26 }, journeyGrid: { flexDirection: 'row', gap: 18 }, journeyCompact: { flexDirection: 'column' },
  journeyCard: { flex: 1, backgroundColor: '#EFF7FD', borderRadius: 30, padding: 25, gap: 15 }, journeyTitle: { color: '#111111', fontSize: 19, fontWeight: '600' },
  journeyAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  collections: { marginBottom: 52, flexGrow: 0 }, collectionGrid: { gap: 18 },
  collectionCard: { height: 395, borderRadius: 30, overflow: 'hidden', backgroundColor: '#DCEFFB' },
  collectionImage: { width: '100%', height: '100%' }, collectionShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 147, backgroundColor: '#102333C9' },
  collectionContent: { position: 'absolute', left: 14, right: 14, bottom: 14, gap: 9, padding: 18, borderRadius: 25, backgroundColor: '#142B3CCC', borderWidth: 1, borderColor: '#FFFFFF40' },
  collectionTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '600', letterSpacing: -0.8 },
  collectionSubtitle: { color: '#D9E8F4', fontSize: 11 }, collectionButton: { marginTop: 10, backgroundColor: "transparent", borderRadius: 24, paddingVertical: 12, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
