import { premiumStyles } from "../constants/typography";
import React, { useState } from "react";
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, Modal } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Listing } from "../src/services/workflowService";
import AppHeader from "./AppHeader";
import MiniMapPreview from "./MiniMapPreview";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import { AppTheme } from "../constants/theme";

export default function PublicPropertyDetails({ property: p, onOffer, canOffer, isSaved, onToggleSave, children }: { property: Listing; onOffer: () => void; canOffer: boolean; isSaved?: boolean; onToggleSave?: () => void; children: React.ReactNode }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState(0);
  const [linkError, setLinkError] = useState("");
  const [mapExpanded, setMapExpanded] = useState(false);
  const photos = (p.media?.photos || []).map(uri => ({ uri }));
  const openLink = (url: string) => { Linking.openURL(url).catch(() => setLinkError("Could not open this link. Please try again.")); };
  const facts = [["Total sq.ft", p.totalArea != null ? p.totalArea.toLocaleString("en-IN") : "—"], ["Sellable sq.ft", p.sellableArea != null ? p.sellableArea.toLocaleString("en-IN") : "—"], ["Type", p.type], ["Price terms", p.negotiable ? "Flexible" : "Fixed"]];
  return <View style={s.screen}><AppHeader /><View style={s.sheet}><ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={s.content}>
    <View style={[s.photo, { height: !photos.length ? 210 : width < 600 ? 285 : 340 }]}>{photos[photo] ? <Image source={photos[photo]} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={`Property photo ${photo + 1}`} /> : <View style={s.placeholder}><MaterialIcons name="home-work" size={70} color="#789CB5" /><Text style={s.body}>Property photo not provided</Text></View>}<TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to properties" style={s.imageBack} onPress={() => router.canGoBack() ? router.back() : router.replace("/home")}><MaterialIcons name="arrow-back" size={21} color="#172333" /></TouchableOpacity><View style={s.badge}><MaterialIcons name="verified" size={17} color="#315975" /></View>{onToggleSave && <TouchableOpacity accessibilityRole="button" onPress={onToggleSave} style={s.saveBtn}><MaterialIcons name={isSaved ? "favorite" : "favorite-border"} size={22} color={isSaved ? "#E11D48" : "#315975"} /></TouchableOpacity>}{photos.length > 1 && <View style={s.photoControls}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous photo" style={s.photoArrow} onPress={() => setPhoto((photo + photos.length - 1) % photos.length)}><MaterialIcons name="chevron-left" size={24} /></TouchableOpacity><Text style={s.label}>{photo + 1} / {photos.length}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Next photo" style={s.photoArrow} onPress={() => setPhoto((photo + 1) % photos.length)}><MaterialIcons name="chevron-right" size={24} /></TouchableOpacity></View>}</View>
    <View style={s.details}>
    <View style={s.summary}><Text style={s.price}>₹{p.price.toLocaleString("en-IN")}</Text><Text accessibilityRole="header" style={s.title}>{p.title || `${p.type} in ${p.location.district}`}</Text><View style={s.location}><MaterialIcons name="location-on" size={19} color="#5D788C" /><Text style={s.body}>{[p.location.mauza, p.location.district, p.location.state].filter(Boolean).join(", ")}</Text></View></View>
    <Text style={s.heading}>Property information</Text><View style={s.facts}>{facts.map(([label, value]) => <View key={label} style={s.fact}><View style={s.factTile}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.factValue, value.length > 6 && { fontSize: 13 }]}>{value}</Text></View><Text style={s.factLabel}>{label}</Text></View>)}</View>
    <View style={s.description}><Text style={s.body}>{p.description || "The owner has not added a description yet."}</Text></View>
    <View style={s.section}><Text style={s.heading}>Land & access</Text><Text style={s.body}>Boundary: {p.boundary || "Not provided"}</Text><Text style={s.body}>Road width: {p.roadWidth ?? "Not provided"}</Text><Text style={s.body}>Block: {p.location.block || "Not provided"} · Mauza: {p.location.mauza || "Not provided"}</Text></View>
    <View style={s.section}><Text style={s.heading}>Owner disclosures</Text><View style={s.disclosures}>{[["Existing loan", p.disclosures?.hasLoan], ["Reported dispute", p.disclosures?.hasDispute]].map(([label, value]) => <View key={String(label)} style={s.disclosure}><Text style={s.body}>{label}</Text><Text style={s.label}>{value == null ? "Not provided" : value ? "Yes" : "No"}</Text></View>)}<View style={s.disclosure}><Text style={s.body}>Possession</Text><Text style={s.label}>{p.disclosures?.possessionStatus || "Not provided"}</Text></View></View></View>
    <View style={s.section}><Text style={s.heading}>The location</Text><TouchableOpacity activeOpacity={0.9} onPress={() => setMapExpanded(true)}><View pointerEvents="none"><MiniMapPreview property={{ id: p._id, type: p.type, status: p.status, price: p.price, location: p.location, parcelPoints: p.parcelPoints }} /></View></TouchableOpacity><TouchableOpacity accessibilityRole="button" style={s.back} onPress={() => openLink(`https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`)}><MaterialIcons name="map" size={19} color="#27465E" /><Text style={s.label}>Open location in maps</Text></TouchableOpacity></View>
    {p.media?.videos?.map((url, index) => <TouchableOpacity key={url} accessibilityRole="button" style={s.back} onPress={() => openLink(url)}><MaterialIcons name="play-circle-outline" size={23} /><Text style={s.label}>View property video {index + 1}</Text></TouchableOpacity>)}
    <View style={s.verification}><MaterialIcons name="verified-user" size={24} color="#315975" /><View style={{ flex: 1 }}><Text style={s.label}>Reviewed by an Advisor and a Verifier</Text><Text style={s.small}>Verification is not a guarantee of legal title. KYC is currently a demo.</Text></View></View>
    {!!linkError && <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{linkError}</Text>}{children}
    </View>
  </ScrollView>{canOffer && <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 15) }]}><View style={s.footerInner}><TouchableOpacity accessibilityRole="button" style={[s.offer, s.secondaryOffer]} onPress={() => openLink(`https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`)}><MaterialIcons name="directions" size={19} color="white" /><Text style={s.offerLabel}>Directions</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={onOffer} style={s.offer}><MaterialIcons name="chat-bubble-outline" size={18} color="white" /><Text style={s.offerLabel}>Make an offer</Text></TouchableOpacity></View></View>}
  
  <Modal visible={mapExpanded} transparent animationType="fade" onRequestClose={() => setMapExpanded(false)}>
    <View style={StyleSheet.absoluteFill}>
      <VerifiedPropertyMap properties={[p]} onSelect={() => {}} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close map" onPress={() => setMapExpanded(false)} style={[s.closeMapBtn, { top: Math.max(insets.top, 20) }]}>
        <MaterialIcons name="close" size={24} color="#172333" />
      </TouchableOpacity>
    </View>
  </Modal>
  </View></View>;
}
const s = premiumStyles({
  screen: { flex: 1, backgroundColor: AppTheme.colors.background },
  sheet: { flex: 1, width: "100%", backgroundColor: AppTheme.colors.background, overflow: "hidden" },
  content: { paddingBottom: 0 }, details: { padding: 25, gap: 23 },
  back: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", paddingVertical: 8 },
  label: { color: AppTheme.colors.text, fontSize: 12, fontWeight: "500" },
  photo: { overflow: "hidden", backgroundColor: AppTheme.colors.primaryLight },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  imageBack: { position: "absolute", left: 21, top: 21, width: 42, height: 42, borderRadius: 21, backgroundColor: AppTheme.colors.card, borderWidth: 1, borderColor: AppTheme.colors.border, alignItems: "center", justifyContent: "center", ...AppTheme.glass },
  closeMapBtn: { position: "absolute", left: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", ...AppTheme.shadows.medium, ...AppTheme.glass },
  badge: { position: "absolute", top: 21, right: 21, backgroundColor: AppTheme.colors.card, padding: 11, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 6, ...AppTheme.glass },
  saveBtn: { position: "absolute", top: 21, right: 155, backgroundColor: AppTheme.colors.card, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", ...AppTheme.glass },
  photoControls: { position: "absolute", bottom: 16, right: 18, flexDirection: "row", backgroundColor: AppTheme.colors.card, alignItems: "center", gap: 10, borderRadius: 24, padding: 4, ...AppTheme.glass }, photoArrow: { padding: 6 },
  summary: { gap: 5 }, price: { fontSize: 30, lineHeight: 39, fontWeight: "600", color: AppTheme.colors.primaryDark, letterSpacing: -1.2 },
  title: { fontSize: 17, fontWeight: "500", color: AppTheme.colors.text, letterSpacing: -0.4 },
  location: { flexDirection: "row", gap: 4, alignItems: "center" },
  body: { fontSize: 13, lineHeight: 24, color: AppTheme.colors.textSecondary, flexShrink: 1 },
  heading: { fontSize: 15, fontWeight: "500", color: AppTheme.colors.text },
  facts: { flexDirection: "row", gap: 10, marginTop: -7 },
  fact: { flex: 1, minWidth: 0, gap: 10, alignItems: "center" },
  factTile: { width: "100%", height: 66, paddingHorizontal: 5, borderRadius: 20, borderWidth: 1, borderColor: AppTheme.colors.border, backgroundColor: AppTheme.colors.card, justifyContent: "center", alignItems: "center", ...AppTheme.glass, ...AppTheme.shadows.soft },
  factValue: { fontSize: 19, fontWeight: "500", color: AppTheme.colors.text, textTransform: "capitalize", letterSpacing: -0.5 },
  factLabel: { fontSize: 9, color: AppTheme.colors.textMuted, textAlign: "center" },
  description: { gap: 10 }, section: { gap: 14, borderTopWidth: 1, borderTopColor: AppTheme.colors.divider, paddingTop: 21 },
  disclosures: { borderRadius: 20, backgroundColor: AppTheme.colors.card, padding: 16, gap: 13, ...AppTheme.glass, borderWidth: 1, borderColor: AppTheme.colors.border },
  disclosure: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 },
  verification: { backgroundColor: AppTheme.colors.card, padding: 16, borderRadius: 20, flexDirection: "row", gap: 12, ...AppTheme.glass, borderWidth: 1, borderColor: AppTheme.colors.border, ...AppTheme.shadows.soft },
  small: { color: AppTheme.colors.textMuted, fontSize: 11, lineHeight: 19, marginTop: 4 },
  footer: { padding: 17, paddingTop: 12, backgroundColor: AppTheme.colors.card, ...AppTheme.glass, borderTopWidth: 1, borderTopColor: AppTheme.colors.border },
  footerInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  offer: { flex: 1, backgroundColor: AppTheme.colors.primary, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", ...AppTheme.shadows.soft },
  secondaryOffer: { backgroundColor: AppTheme.colors.primaryDark }, offerLabel: { color: "white", fontSize: 11, fontWeight: "500" },
});
