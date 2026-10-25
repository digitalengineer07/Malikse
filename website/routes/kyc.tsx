import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import { authService } from "../src/services/authService";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";

const leftWatermarkAsset = require("../assets/malikse-left-bottom-watermark.png");
const rightWatermarkAsset = require("../assets/malikse-right-bottom-watermark.png");

function resolveAssetUri(asset: any): string {
  if (typeof asset === "string") return asset;
  if (asset && typeof asset === "object") {
    if (asset.uri) return asset.uri;
    if (asset.default) {
      if (typeof asset.default === "string") return asset.default;
      if (asset.default.uri) return asset.default.uri;
    }
  }
  try {
    const source = Image.resolveAssetSource(asset);
    return source?.uri || "";
  } catch {
    return "";
  }
}

export default function DemoKycScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((state) => state.user);
  const { language } = useLanguageStore();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const leftWatermarkUri = resolveAssetUri(leftWatermarkAsset);
  const rightWatermarkUri = resolveAssetUri(rightWatermarkAsset);

  const complete = async () => {
    setBusy(true);
    setError("");
    try {
      await authService.completeDemoKyc();
      router.replace("/dashboard");
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause?.message || "Could not complete demo KYC");
    } finally {
      setBusy(false);
    }
  };

  const isComplete = Boolean(user?.demoKycComplete);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace((user?.role ? dashboardRoutes[user.role] : "/dashboard") as any);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Top Header Bar with Navigation Menu, Post Button, Profile and clean logo */}
      <AppHeader showBack={false} showNavLinks={true} showPostPropertyBtn={true} />

      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
        >
          {/* Topline Breadcrumb & Status Badge */}
          <View style={styles.topline}>
            <View style={styles.breadcrumbRow}>
              <Text style={styles.eyebrow}>MALIKSE</Text>
              <Text style={styles.eyebrowDivider}>/</Text>
              <Text style={styles.eyebrowActive}>
                {language === "hi" ? "पहचान सत्यापन" : "ACCOUNT VERIFICATION"}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                isComplete ? styles.statusBadgeComplete : styles.statusBadgePending,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isComplete ? "#137333" : "#B06000" },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isComplete ? "#137333" : "#B06000" },
                ]}
              >
                {isComplete
                  ? language === "hi"
                    ? "केवाईसी पूर्ण · सत्यापित खाता"
                    : "VERIFIED SELLER · KYC COMPLETE"
                  : language === "hi"
                    ? "केवाईसी आवश्यक"
                    : "ACTION REQUIRED · KYC PENDING"}
              </Text>
            </View>
          </View>

          {/* Title Row with Properly Located Back Button */}
          <View style={styles.titleRow}>
            <View style={styles.titleLeftGroup}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={styles.backBtn}
                onPress={handleBack}
                activeOpacity={0.75}
              >
                <MaterialIcons name="arrow-back" size={20} color="#102B52" />
              </TouchableOpacity>
              <Text accessibilityRole="header" style={[styles.title, isMobile && styles.titleMobile]}>
                {language === "hi" ? "केवाईसी पहचान सत्यापन" : "Identity & KYC Verification"}
              </Text>
            </View>
          </View>

          {/* Main Elevated Card */}
          <View style={styles.mainCard}>
            {/* Status Hero Block */}
            <View style={styles.heroBlock}>
              <View
                style={[
                  styles.iconContainer,
                  isComplete ? styles.iconContainerComplete : styles.iconContainerPending,
                ]}
              >
                <MaterialIcons
                  name={isComplete ? "verified-user" : "admin-panel-settings"}
                  size={42}
                  color={isComplete ? "#137333" : "#0873B9"}
                />
              </View>

              <View style={styles.heroTextCol}>
                <Text style={styles.cardHeading}>
                  {isComplete
                    ? language === "hi"
                      ? "खाता प्रॉपर्टी लेन-देन के लिए सत्यापित है"
                      : "Account Verified for Property Transactions"
                    : language === "hi"
                      ? "त्वरित सेलर सत्यापन पूर्ण करें"
                      : "Complete Quick Seller Verification"}
                </Text>
                <Text style={styles.cardDescription}>
                  {isComplete
                    ? language === "hi"
                      ? "आपका खाता बिहार में प्रॉपर्टी लिस्ट करने, सर्वे बुक करने और खरीदारों से सीधे संपर्क के लिए सक्रिय है।"
                      : "Your account is active and verified for listing properties, scheduling cadastral surveys, and directly connecting with buyers."
                    : language === "hi"
                      ? "प्रॉपर्टी लिस्टिंग और जीपीएस मैपिंग अनलॉक करने के लिए अपने खाते को सत्यापित करें।"
                      : "Mark your account verified to unlock property listings, GPS cadastral boundary mapping, and verified buyer contacts."}
                </Text>
              </View>
            </View>

            {/* Verification Details Grid */}
            {user && (
              <View style={styles.detailsGrid}>
                <View style={styles.detailTile}>
                  <Text style={styles.detailLabel}>
                    {language === "hi" ? "खाताधारक का नाम" : "Account Holder"}
                  </Text>
                  <Text style={styles.detailValue}>{user.name || "User"}</Text>
                </View>

                <View style={styles.detailTile}>
                  <Text style={styles.detailLabel}>
                    {language === "hi" ? "मोबाइल नंबर" : "Registered Mobile"}
                  </Text>
                  <Text style={styles.detailValue}>{user.mobile || "—"}</Text>
                </View>

                <View style={styles.detailTile}>
                  <Text style={styles.detailLabel}>
                    {language === "hi" ? "सत्यापन स्तर" : "Verification Tier"}
                  </Text>
                  <Text style={styles.detailValue}>
                    {isComplete ? "Level 1 Verified (Prototype)" : "Pending Activation"}
                  </Text>
                </View>

                <View style={styles.detailTile}>
                  <Text style={styles.detailLabel}>
                    {language === "hi" ? "प्रॉपर्टी लिस्टिंग अनुमति" : "Listing Permissions"}
                  </Text>
                  <Text style={[styles.detailValue, { color: isComplete ? "#137333" : "#B06000" }]}>
                    {isComplete ? "Enabled · Ready to Post" : "Locked · Complete KYC"}
                  </Text>
                </View>
              </View>
            )}

            {/* Demo Notice Alert Box */}
            <View style={styles.noticeBox}>
              <MaterialIcons name="info-outline" size={20} color="#0873B9" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>
                  {language === "hi" ? "डेमो प्रोटोटाइप सूचना" : "MalikSe Prototype Notice"}
                </Text>
                <Text style={styles.noticeText}>
                  {language === "hi"
                    ? "यह केवल प्रोटोटाइप खरीदार और लिस्टिंग प्रवाह के लिए आपके खाते को सक्रिय करता है। यहां कोई आधार या पहचान दस्तावेज एकत्र या सत्यापित नहीं किए जाते हैं।"
                    : "This demo step marks your account ready for the prototype buying and listing flows. No confidential identity documents or Aadhaar are collected or verified here."}
                </Text>
              </View>
            </View>

            {/* Error Message if any */}
            {!!error && (
              <View style={styles.errorBox}>
                <MaterialIcons name="error-outline" size={18} color="#C5221F" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              {!user || user.role !== "user" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.primaryBtn}
                  onPress={() => router.replace("/login")}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="login" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {language === "hi" ? "यूज़र के रूप में लॉगिन करें" : "Sign in as User"}
                  </Text>
                </TouchableOpacity>
              ) : !isComplete ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.primaryBtn}
                  disabled={busy}
                  onPress={complete}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="check-circle" size={19} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>
                        {language === "hi" ? "डेमो केवाईसी पूर्ण करें" : "Complete Demo KYC & Activate"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.primaryBtn}
                  onPress={() => router.push("/listing/create")}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="add-circle" size={19} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {language === "hi" ? "प्रॉपर्टी पोस्ट करें" : "List a Property Now"}
                  </Text>
                </TouchableOpacity>
              )}

              {isComplete && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.secondaryBtn}
                  onPress={() => router.push("/my-properties")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="list-alt" size={18} color="#0873B9" />
                  <Text style={styles.secondaryBtnText}>
                    {language === "hi" ? "मेरी लिस्टिंग" : "My Listings"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                style={styles.ghostBtn}
                onPress={() => router.replace("/dashboard")}
                activeOpacity={0.8}
              >
                <Text style={styles.ghostBtnText}>
                  {language === "hi" ? "डैशबोर्ड पर वापस जाएं" : "Back to Dashboard"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 3 Trust Feature Cards */}
          <View style={styles.trustGrid}>
            <View style={styles.trustCard}>
              <View style={[styles.trustIconCircle, { backgroundColor: "#EEF7FE" }]}>
                <MaterialIcons name="verified" size={22} color="#0873B9" />
              </View>
              <Text style={styles.trustTitle}>
                {language === "hi" ? "सत्यापित बिहार लैंड रिकॉर्ड" : "Verified Land Records"}
              </Text>
              <Text style={styles.trustDescription}>
                {language === "hi"
                  ? "जमाबंदी, खतियान और राजस्व रिकॉर्ड की दो-स्तरीय आधिकारिक जांच।"
                  : "Every property goes through 2-tier verified check before appearing to buyers."}
              </Text>
            </View>

            <View style={styles.trustCard}>
              <View style={[styles.trustIconCircle, { backgroundColor: "#EBF9F1" }]}>
                <MaterialIcons name="gps-fixed" size={22} color="#137333" />
              </View>
              <Text style={styles.trustTitle}>
                {language === "hi" ? "मुफ्त जीपीएस प्लॉट मैपिंग" : "GPS Cadastral Mapping"}
              </Text>
              <Text style={styles.trustDescription}>
                {language === "hi"
                  ? "मलिकसे सलाहकार द्वारा प्लॉट की ऑन-ग्राउंड जीपीएस सीमा मैपिंग।"
                  : "On-ground site visit by MalikSe local advisors to verify physical boundaries."}
              </Text>
            </View>

            <View style={styles.trustCard}>
              <View style={[styles.trustIconCircle, { backgroundColor: "#FEF8E7" }]}>
                <MaterialIcons name="handshake" size={22} color="#B06000" />
              </View>
              <Text style={styles.trustTitle}>
                {language === "hi" ? "शून्य ब्रोकरेज गारंटी" : "Zero Brokerage Direct"}
              </Text>
              <Text style={styles.trustDescription}>
                {language === "hi"
                  ? "सीधे असली खरीदारों और मालिकों से जुड़ें बिना किसी बिचौलिया शुल्क के।"
                  : "Deal directly with verified owners and buyers with complete transparency."}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Two Corner Watermark Images Shifted Towards Center */}
      {Platform.OS === "web" ? (
        <>
          {/* Left Watermark */}
          <div
            id="malikse-left-bottom-watermark"
            style={{
              position: "fixed",
              bottom: 0,
              left: isMobile ? "clamp(10px, 4vw, 24px)" : "clamp(24px, 7vw, 120px)",
              width: isMobile ? "min(48vw, 240px)" : "min(42vw, 480px)",
              height: isMobile ? "130px" : "220px",
              pointerEvents: "none",
              zIndex: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-start",
              overflow: "hidden",
            }}
          >
            <img
              src={leftWatermarkUri}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target && !target.dataset.triedFallback) {
                  target.dataset.triedFallback = "true";
                  target.src = "/assets/malikse-left-bottom-watermark.png";
                }
              }}
              alt="MalikSe Heritage Left Bottom Watermark"
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "left bottom",
                display: "block",
                pointerEvents: "none",
                opacity: 0.9,
              }}
            />
          </div>

          {/* Right Watermark */}
          <div
            id="malikse-right-bottom-watermark"
            style={{
              position: "fixed",
              bottom: 0,
              right: isMobile ? "clamp(10px, 4vw, 24px)" : "clamp(24px, 7vw, 120px)",
              width: isMobile ? "min(48vw, 240px)" : "min(42vw, 480px)",
              height: isMobile ? "130px" : "220px",
              pointerEvents: "none",
              zIndex: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              overflow: "hidden",
            }}
          >
            <img
              src={rightWatermarkUri}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target && !target.dataset.triedFallback) {
                  target.dataset.triedFallback = "true";
                  target.src = "/assets/malikse-right-bottom-watermark.png";
                }
              }}
              alt="MalikSe Heritage Right Bottom Watermark"
              aria-hidden="true"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "right bottom",
                display: "block",
                pointerEvents: "none",
                opacity: 0.9,
              }}
            />
          </div>
        </>
      ) : null}

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 110,
    gap: 20,
  },
  contentMobile: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrow: {
    color: "#0873B9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  eyebrowDivider: {
    color: "#94A3B8",
    fontSize: 12,
  },
  eyebrowActive: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeComplete: {
    backgroundColor: "#EBF9F1",
    borderColor: "#C6F0D4",
  },
  statusBadgePending: {
    backgroundColor: "#FEF8E7",
    borderColor: "#FEEFC3",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D8E8F5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    cursor: "pointer",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.6,
  },
  titleMobile: {
    fontSize: 24,
  },
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 28,
    gap: 22,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  heroBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF4FA",
    flexWrap: "wrap",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  iconContainerComplete: {
    backgroundColor: "#EBF9F1",
    borderColor: "#C6F0D4",
  },
  iconContainerPending: {
    backgroundColor: "#EDF7FE",
    borderColor: "#CDE5FA",
  },
  heroTextCol: {
    flex: 1,
    minWidth: 260,
    gap: 4,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: "800",
    color: "#102B52",
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 22,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  detailTile: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#F8FAFD",
    borderWidth: 1,
    borderColor: "#E6EFF7",
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#64809E",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: "#102B52",
    fontWeight: "700",
  },
  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F0F7FE",
    borderWidth: 1,
    borderColor: "#D4E9F9",
    borderRadius: 16,
    padding: 16,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0873B9",
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#102B52",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
    cursor: "pointer",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F7FE",
    borderWidth: 1.5,
    borderColor: "#CDE5FA",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    cursor: "pointer",
  },
  secondaryBtnText: {
    color: "#0873B9",
    fontSize: 14,
    fontWeight: "700",
  },
  ghostBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    cursor: "pointer",
  },
  ghostBtnText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  trustGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 4,
  },
  trustCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "#DCEBF8",
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: "#0873B9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  trustIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  trustTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#102B52",
  },
  trustDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
  },
});
