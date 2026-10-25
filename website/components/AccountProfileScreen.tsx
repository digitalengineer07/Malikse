import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Image,
  useWindowDimensions,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import AppHeader from "./AppHeader";
import TextInput from "./FormInput";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import { authService } from "../src/services/authService";
import { userService } from "../src/services/userService";
import { dashboardRoutes, roleLabels } from "../src/utils/accountRoutes";
import type { UserRole } from "../src/types/auth.types";

const skylineWatermarkAsset = require("../assets/heritage_skyline_watermark.png");

// Dynamically mask user's mobile number, preserving only the last 4 digits
function maskMobile(mobile: string | undefined): string {
  if (!mobile) return "—";
  const digits = mobile.replace(/\D/g, "");
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `+91 ••••••${last4}`;
  }
  return mobile.trim().length ? `+91 ${mobile}` : "—";
}

// Dynamically format user's registration timestamp into DD/MM/YYYY
function formatMemberDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function AccountProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 680;
  const { user, authState, hydrated, setUser } = useAuthStore();
  const { language } = useLanguageStore();
  const label = (en: string, hi: string) => (language === "hi" ? hi : en);

  const [loggingOut, setLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const signingOut = useRef(false);

  const startEditing = () => {
    if (!user) return;
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setError("");
    if (editName.trim().length < 2) {
      setError(label("Enter a name of at least 2 characters", "कम से कम 2 अक्षरों का नाम दर्ज करें"));
      return;
    }
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setError(label("Enter a valid email address", "एक मान्य ईमेल पता दर्ज करें"));
      return;
    }
    setIsSaving(true);
    try {
      const updatedUser = await userService.updateProfile({ name: editName.trim(), email: editEmail.trim() });
      setUser(updatedUser);
      setIsEditing(false);
    } catch (e: any) {
      setError(
        e.response?.data?.message ||
          label("Could not save profile. Please try again.", "प्रोफ़ाइल सहेजा नहीं जा सका। कृपया पुनः प्रयास करें।")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const logout = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setLoggingOut(true);
    await authService.logout();
    router.replace("/login");
  };

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#03456C" size="large" />
      </View>
    );
  }
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;

  // 100% Dynamic user data derived from active session
  const userName = user.name || label("User", "उपयोगकर्ता");
  const initial = userName.trim().charAt(0).toUpperCase() || "U";
  const userRole = user.role as UserRole;
  const userRoleDisplay = roleLabels[userRole] || label("User", "उपयोगकर्ता");
  const userEmail = user.email ? user.email : label("Not added", "जोड़ा नहीं गया");
  const userMobile = maskMobile(user.mobile);
  const userJoinedDate = formatMemberDate(user.createdAt);

  // Dynamic KYC / Verification configuration according to the user's role and state
  const isKycComplete = Boolean(user.demoKycComplete);
  const isIdentityVerified = Boolean(user.isVerifiedIdentity);

  let kycBadgeText = label("Demo", "डेमो");
  let kycBadgeBg = "#FFEDD5";
  let kycBadgeTextColor = "#C2410C";
  let kycTitle = label("KYC verification", "केवाईसी सत्यापन");
  let kycStatusTitle = label("Demo step complete", "डेमो चरण पूरा हुआ");
  let kycStatusSub = label(
    "Identity verification has not been performed.",
    "पहचान सत्यापन नहीं किया गया है।"
  );
  let kycIconName: keyof typeof MaterialIcons.glyphMap = "check-circle";
  let kycIconColor = "#0284C7";

  if (userRole === "admin") {
    kycTitle = label("Admin clearance", "व्यवस्थापक स्थिति");
    kycBadgeText = label("Verified", "सत्यापित");
    kycBadgeBg = "#DCFCE7";
    kycBadgeTextColor = "#15803D";
    kycStatusTitle = label("Full Administrative Access", "पूर्ण व्यवस्थापक पहुँच");
    kycStatusSub = label(
      "Your account has system administrator permissions.",
      "आपके खाते के पास सिस्टम व्यवस्थापक के अधिकार हैं।"
    );
    kycIconName = "verified";
    kycIconColor = "#16A34A";
  } else if (userRole === "verifier") {
    kycTitle = label("Verifier authorization", "सत्यापनकर्ता स्थिति");
    kycBadgeText = label("Authorized", "अधिकृत");
    kycBadgeBg = "#DCFCE7";
    kycBadgeTextColor = "#15803D";
    kycStatusTitle = label("Authorized Field Verifier", "अधिकृत फील्ड सत्यापनकर्ता");
    kycStatusSub = label(
      "Authorized to inspect land parcels and sign cadastral reports.",
      "प्लॉट निरीक्षण और कैडस्ट्राल रिपोर्ट सत्यापित करने के लिए अधिकृत।"
    );
    kycIconName = "verified";
    kycIconColor = "#16A34A";
  } else if (userRole === "advisor") {
    kycTitle = label("Advisor credential", "सलाहकार साख");
    kycBadgeText = label("Certified", "प्रमाणित");
    kycBadgeBg = "#DCFCE7";
    kycBadgeTextColor = "#15803D";
    kycStatusTitle = label("Certified Land Advisor", "प्रमाणित भूमि सलाहकार");
    kycStatusSub = label(
      "Certified to assist clients with property valuation and paperwork.",
      "ग्राहकों को संपत्ति मूल्यांकन और दस्तावेजीकरण में सहायता के लिए प्रमाणित।"
    );
    kycIconName = "verified";
    kycIconColor = "#16A34A";
  } else if (isIdentityVerified) {
    kycBadgeText = label("Verified", "सत्यापित");
    kycBadgeBg = "#DCFCE7";
    kycBadgeTextColor = "#15803D";
    kycStatusTitle = label("Identity verified", "पहचान सत्यापित");
    kycStatusSub = label(
      "Government identity verification is successfully completed.",
      "सरकारी पहचान सत्यापन सफलतापूर्वक पूरा हो चुका है।"
    );
    kycIconName = "verified";
    kycIconColor = "#16A34A";
  } else if (!isKycComplete) {
    kycBadgeText = label("Pending", "लंबित");
    kycBadgeBg = "#FEF3C7";
    kycBadgeTextColor = "#B45309";
    kycStatusTitle = label("Demo step not completed", "डेमो चरण पूरा नहीं हुआ");
    kycStatusSub = label(
      "Complete demo identity verification to unlock full property listing features.",
      "प्रॉपर्टी लिस्टिंग सुविधाएँ अनलॉक करने के लिए डेमो सत्यापन पूरा करें।"
    );
    kycIconName = "info";
    kycIconColor = "#D97706";
  }

  // Dynamic Dashboard button text and target route based on user role
  const dashboardTarget = dashboardRoutes[userRole] || "/dashboard";
  let dashboardBtnLabel = label("Open my dashboard", "मेरा डैशबोर्ड खोलें");
  if (userRole === "admin") dashboardBtnLabel = label("Open admin dashboard", "व्यवस्थापक डैशबोर्ड खोलें");
  else if (userRole === "verifier") dashboardBtnLabel = label("Open verifier dashboard", "सत्यापनकर्ता डैशबोर्ड खोलें");
  else if (userRole === "advisor") dashboardBtnLabel = label("Open advisor dashboard", "सलाहकार डैशबोर्ड खोलें");

  return (
    <View style={styles.screen}>
      {/* Top Header Bar */}
      <AppHeader showNavLinks={false} showPostPropertyBtn={false} showBack={true} />

      <KeyboardAvoidingView
        style={{ flex: 1, zIndex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Row: Title & Logout Button */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{label("Your profile", "आपकी प्रोफ़ाइल")}</Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
              style={styles.logoutBtn}
              disabled={loggingOut}
              onPress={logout}
              activeOpacity={0.8}
            >
              <MaterialIcons name="logout" size={18} color="#E11D48" />
              <Text style={styles.logoutText}>
                {loggingOut
                  ? label("Logging out…", "लॉग आउट हो रहा है…")
                  : label("Log out", "लॉग आउट")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Alert */}
          {!!error && (
            <View style={styles.errorAlert}>
              <MaterialIcons name="error-outline" size={18} color="#B91C1C" />
              <Text accessibilityRole="alert" style={styles.errorAlertText}>
                {error}
              </Text>
            </View>
          )}

          {/* Primary Profile Details Card */}
          <View style={styles.card}>
            {/* Identity Header Row */}
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.identityTextCol}>
                <Text style={styles.userName}>{userName}</Text>
                <Text style={styles.userRole}>{userRoleDisplay}</Text>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.editBtn}
                  onPress={startEditing}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="edit" size={16} color="#0284C7" />
                  <Text style={styles.editBtnText}>
                    {label("Edit profile", "प्रोफ़ाइल संपादित करें")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Editable Form Mode */}
            {isEditing ? (
              <View style={styles.editForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{label("Full name", "पूरा नाम")}</Text>
                  <TextInput
                    accessibilityLabel={label("Full name", "पूरा नाम")}
                    autoComplete="name"
                    style={styles.textInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder={label("Enter your full name", "अपना पूरा नाम दर्ज करें")}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{label("Email", "ईमेल")}</Text>
                  <TextInput
                    accessibilityLabel={label("Email", "ईमेल")}
                    autoComplete="email"
                    style={styles.textInput}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={label("Enter your email address", "अपना ईमेल दर्ज करें")}
                  />
                </View>
                <View style={styles.editBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setIsEditing(false);
                      setError("");
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelBtnText}>{label("Cancel", "रद्द करें")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={saveProfile}
                    disabled={isSaving}
                    activeOpacity={0.85}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {label("Save Changes", "परिवर्तन सहेजें")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* View Mode: Dynamic 2-Column Info Grid */
              <View style={[styles.fieldsGrid, isMobile && styles.fieldsGridMobile]}>
                {/* Left Column: Full name, Email, Member since */}
                <View style={styles.fieldColumn}>
                  {/* Full Name */}
                  <View style={styles.fieldItem}>
                    <View style={styles.fieldIconBadge}>
                      <MaterialIcons name="person-outline" size={22} color="#0284C7" />
                    </View>
                    <View style={styles.fieldTextCol}>
                      <Text style={styles.fieldLabel}>{label("Full name", "पूरा नाम")}</Text>
                      <Text selectable style={styles.fieldValue}>
                        {userName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fieldDivider} />

                  {/* Email */}
                  <View style={styles.fieldItem}>
                    <View style={styles.fieldIconBadge}>
                      <MaterialIcons name="mail-outline" size={22} color="#0284C7" />
                    </View>
                    <View style={styles.fieldTextCol}>
                      <Text style={styles.fieldLabel}>{label("Email", "ईमेल")}</Text>
                      <Text selectable style={styles.fieldValue}>
                        {userEmail}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fieldDivider} />

                  {/* Member since */}
                  <View style={styles.fieldItem}>
                    <View style={styles.fieldIconBadge}>
                      <MaterialIcons name="calendar-today" size={20} color="#0284C7" />
                    </View>
                    <View style={styles.fieldTextCol}>
                      <Text style={styles.fieldLabel}>
                        {label("Member since", "सदस्यता की तारीख")}
                      </Text>
                      <Text selectable style={styles.fieldValue}>
                        {userJoinedDate}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right Column: Mobile number, Account role */}
                <View style={styles.fieldColumn}>
                  {/* Mobile Number */}
                  <View style={styles.fieldItem}>
                    <View style={styles.fieldIconBadge}>
                      <MaterialIcons name="call" size={20} color="#0284C7" />
                    </View>
                    <View style={styles.fieldTextCol}>
                      <Text style={styles.fieldLabel}>{label("Mobile number", "मोबाइल नंबर")}</Text>
                      <Text selectable style={styles.fieldValue}>
                        {userMobile}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fieldDivider} />

                  {/* Account role */}
                  <View style={styles.fieldItem}>
                    <View style={styles.fieldIconBadge}>
                      <MaterialIcons name="verified-user" size={20} color="#0284C7" />
                    </View>
                    <View style={styles.fieldTextCol}>
                      <Text style={styles.fieldLabel}>
                        {label("Account role", "खाते की भूमिका")}
                      </Text>
                      <Text selectable style={styles.fieldValue}>
                        {userRoleDisplay}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* KYC / Verification Card */}
          <View style={styles.card}>
            <View style={styles.kycHeaderRow}>
              <View style={styles.kycShieldBadge}>
                <MaterialIcons name="verified-user" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.kycTitle}>{kycTitle}</Text>
              <View style={[styles.demoBadge, { backgroundColor: kycBadgeBg }]}>
                <Text style={[styles.demoBadgeText, { color: kycBadgeTextColor }]}>
                  {kycBadgeText}
                </Text>
              </View>
            </View>

            <View style={styles.kycStatusBox}>
              <MaterialIcons name={kycIconName} size={26} color={kycIconColor} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kycStatusTitle}>{kycStatusTitle}</Text>
                <Text style={styles.kycStatusSub}>{kycStatusSub}</Text>

                {userRole === "user" && !isKycComplete && !isIdentityVerified && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.kycActionBtn}
                    onPress={() => router.push("/kyc")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.kycActionBtnText}>
                      {label("Complete demo KYC →", "डेमो केवाईसी पूरा करें →")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Open Dashboard Button */}
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.88}
            style={styles.dashboardBtn}
            onPress={() => router.push(dashboardTarget as any)}
          >
            <View style={styles.dashboardBtnCenter}>
              <MaterialIcons name="grid-view" size={20} color="#FFFFFF" />
              <Text style={styles.dashboardBtnText}>{dashboardBtnLabel}</Text>
            </View>
            <MaterialIcons
              name="arrow-forward"
              size={20}
              color="#FFFFFF"
              style={styles.dashboardBtnArrow}
            />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Elegant Indian Heritage Watermark Horizon (India Gate, Taj Mahal, Bodh Gaya Stupa, Trees & Birds) */}
      {Platform.OS === "web" ? (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            width: "100%",
            height: isMobile ? "240px" : "360px",
            pointerEvents: "none",
            zIndex: 0,
            display: "flex",
            alignItems: "flex-end",
            overflow: "hidden",
            maskImage: "linear-gradient(to top, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
          }}
        >
          <img
            src="/assets/assets/heritage_skyline_watermark.png"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              if (target && !target.dataset.triedFallback) {
                target.dataset.triedFallback = "true";
                target.src = "/heritage_skyline_watermark.png";
              }
            }}
            alt="Indian Heritage Skyline Watermark"
            aria-hidden="true"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center bottom",
              display: "block",
              pointerEvents: "none",
              opacity: 0.42,
            }}
          />
        </div>
      ) : (
        <View style={[styles.nativeSkyline, { height: isMobile ? 240 : 360 }]} pointerEvents="none">
          <Image source={skylineWatermarkAsset} style={styles.nativeSkylineImg} resizeMode="cover" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
    position: "relative",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 72,
    gap: 18,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FECDD3",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  logoutText: {
    color: "#E11D48",
    fontWeight: "700",
    fontSize: 14,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
  },
  errorAlertText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    backgroundColor: "#E0F2FE",
    borderRadius: 31,
    width: 62,
    height: 62,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#03456C",
    fontSize: 26,
    fontWeight: "800",
  },
  identityTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  userRole: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F9FF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBtnText: {
    color: "#0284C7",
    fontSize: 13,
    fontWeight: "700",
  },
  fieldsGrid: {
    flexDirection: "row",
    gap: 32,
    marginTop: 20,
    paddingTop: 8,
  },
  fieldsGridMobile: {
    flexDirection: "column",
    gap: 0,
  },
  fieldColumn: {
    flex: 1,
  },
  fieldItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  fieldIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  fieldTextCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  editForm: {
    gap: 16,
    marginTop: 20,
    paddingTop: 8,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
  },
  editBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 14,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#03456C",
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  kycHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  kycShieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#03456C",
    justifyContent: "center",
    alignItems: "center",
  },
  kycTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  demoBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  demoBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  kycStatusBox: {
    backgroundColor: "#F0F7FD",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  kycStatusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  kycStatusSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  kycActionBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  kycActionBtnText: {
    color: "#0284C7",
    fontWeight: "700",
    fontSize: 13,
  },
  dashboardBtn: {
    backgroundColor: "#03456C",
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#03456C",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
    marginTop: 4,
  },
  dashboardBtnCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dashboardBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  dashboardBtnArrow: {
    position: "absolute",
    right: 24,
  },
  nativeSkyline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 360,
    zIndex: 0,
  },
  nativeSkylineImg: {
    width: "100%",
    height: "100%",
    opacity: 0.42,
  },
});
