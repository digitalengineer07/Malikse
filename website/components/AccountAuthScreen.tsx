import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import BiharHeritageWatermark from "./BiharHeritageWatermark";

interface AccountAuthScreenProps {
  mode: "login" | "register";
}

export default function AccountAuthScreen({ mode }: AccountAuthScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 920;

  const [activeTab, setActiveTab] = useState<"login" | "register">(mode);
  const isRegister = activeTab === "register";

  const { user, authState, hydrated } = useAuthStore();
  const { language, toggleLanguage } = useLanguageStore();
  const label = (en: string, hi: string) => (language === "hi" ? hi : en);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  // Switch between Sign In and Register tabs
  const handleTabSwitch = (tab: "login" | "register") => {
    setActiveTab(tab);
    setError("");
    setShowPassword(false);
  };

  const handleSubmit = async () => {
    if (submitting.current) return;
    setError("");

    if (isRegister && name.trim().length < 2) {
      setError(
        label(
          "Please enter your full name (at least 2 characters).",
          "कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।"
        )
      );
      return;
    }

    const cleanMobile = mobile.trim().replace(/\D/g, "");
    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      setError(
        label(
          "Please enter a valid 10-digit mobile number.",
          "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।"
        )
      );
      return;
    }

    if (password.length < 6) {
      setError(
        label(
          "Password must be at least 6 characters long.",
          "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"
        )
      );
      return;
    }

    if (isRegister && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(
        label(
          "Please enter a valid email address or leave it blank.",
          "कृपया सही ईमेल पता दर्ज करें या इसे खाली छोड़ दें।"
        )
      );
      return;
    }

    submitting.current = true;
    setLoading(true);

    try {
      if (isRegister) {
        await authService.register(
          name.trim(),
          cleanMobile,
          password,
          email.trim().toLowerCase() || undefined
        );
      } else {
        await authService.login(cleanMobile, password);
      }
      router.replace("/home");
    } catch (cause: any) {
      const serverMsg = cause?.response?.data?.message;
      setError(
        serverMsg ||
          label(
            "Unable to connect to server. Please check your credentials.",
            "सर्वर से कनेक्ट नहीं हो सका। कृपया विवरण जांचें।"
          )
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#03456C" />
      </View>
    );
  }

  if (authState === "AUTHENTICATED" && user) {
    return <Redirect href="/home" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardScreen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Navbar Header */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.navLogoRow}
            onPress={() => router.replace("/home")}
            activeOpacity={0.8}
          >
            {Platform.OS === "web" ? (
              <svg width="28" height="28" viewBox="0 0 32 32" style={{ display: "block" }}>
                <path d="M3,16 L16,5 L29,16 L25.5,16 L16,8.2 L6.5,16 Z" fill="#03456C" />
                <rect x="22" y="7" width="3" height="6" fill="#03456C" rx="0.5" />
                <rect x="8" y="18" width="6.5" height="5.5" fill="#0284C7" rx="0.8" />
                <rect x="16.5" y="18" width="6.5" height="5.5" fill="#0284C7" rx="0.8" />
                <rect x="8" y="24.8" width="6.5" height="5" fill="#38BDF8" rx="0.8" />
                <rect x="16.5" y="24.8" width="6.5" height="5" fill="#38BDF8" rx="0.8" />
              </svg>
            ) : (
              <MaterialIcons name="home" size={26} color="#03456C" />
            )}
            <Text style={styles.navLogoText}>MalikSe</Text>
          </TouchableOpacity>

          <View style={styles.navRightRow}>
            <TouchableOpacity
              style={styles.backHomeLink}
              onPress={() => router.replace("/home")}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-back" size={16} color="#03456C" />
              <Text style={styles.backHomeText}>
                {label("Back to Home", "होमपेज पर जाएं")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.langPill}
              onPress={toggleLanguage}
              activeOpacity={0.8}
            >
              <MaterialIcons name="translate" size={15} color="#03456C" />
              <Text style={styles.langText}>{label("हिन्दी", "English")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Dual-Pane Auth Card */}
        <View style={styles.authCardWrapper}>
          <View style={[styles.authCard, { flexDirection: isDesktop ? "row" : "column" }]}>
            {/* Left Showcase Pane (Visible on Desktop) */}
            {isDesktop && (
              <View style={styles.leftPane}>
                <Image
                  source={{
                    uri: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
                  }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
                <View style={styles.leftPaneOverlay} />

                {/* Left Pane Content */}
                <View style={styles.leftPaneContent}>
                  <View style={styles.leftBadge}>
                    <MaterialIcons name="verified" size={13} color="#38BDF8" />
                    <Text style={styles.leftBadgeText}>
                      BIHAR'S #1 VERIFIED PROPERTY ECOSYSTEM
                    </Text>
                  </View>

                  <Text style={styles.leftHeading}>
                    {label(
                      "Direct deals. Verified titles. Zero brokerage.",
                      "सीधे सौदे। सत्यापित ज़मीन। शून्य ब्रोकरेज।"
                    )}
                  </Text>

                  <Text style={styles.leftSubtext}>
                    {label(
                      "Join thousands of buyers, sellers, and verified title holders across all 38 districts of Bihar.",
                      "बिहार के सभी 38 जिलों में हजारों खरीदारों, विक्रेताओं और सत्यापित ज़मीन मालिकों से जुड़ें।"
                    )}
                  </Text>

                  {/* 3 Pillar Highlights */}
                  <View style={styles.pillarsList}>
                    <View style={styles.pillarItem}>
                      <View style={styles.pillarIconBox}>
                        <MaterialIcons name="account-balance" size={18} color="#38BDF8" />
                      </View>
                      <View style={styles.pillarTextBox}>
                        <Text style={styles.pillarTitle}>
                          {label("Circle Office Revenue Audit", "अंचल कार्यालय राजस्व जांच")}
                        </Text>
                        <Text style={styles.pillarDesc}>
                          {label("Jamabandi, Khatiyan & LPC legal verification", "जमाबंदी, खतियान व एलपीसी का कानूनी सत्यापन")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.pillarItem}>
                      <View style={styles.pillarIconBox}>
                        <MaterialIcons name="gps-fixed" size={18} color="#34D399" />
                      </View>
                      <View style={styles.pillarTextBox}>
                        <Text style={styles.pillarTitle}>
                          {label("GPS Boundary Demarcation", "जीपीएस सीमांकन")}
                        </Text>
                        <Text style={styles.pillarDesc}>
                          {label("Physical on-ground coordinates with surveyor pegs", "अमीन द्वारा मौके पर पैमाइश व सैटेलाइट मैपिंग")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.pillarItem}>
                      <View style={styles.pillarIconBox}>
                        <MaterialIcons name="handshake" size={18} color="#FBBF24" />
                      </View>
                      <View style={styles.pillarTextBox}>
                        <Text style={styles.pillarTitle}>
                          {label("₹0 Brokerage Direct Deals", "शून्य ब्रोकरेज सीधे सौदे")}
                        </Text>
                        <Text style={styles.pillarDesc}>
                          {label("Connect directly with genuine title holders", "सीधे असली ज़मीन मालिकों से संपर्क करें")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Bottom Heritage Watermark & Trust Indicator */}
                  <View style={styles.leftBottomWatermark}>
                    <BiharHeritageWatermark width={150} height={36} opacity={0.4} />
                    <Text style={styles.watermarkTagline}>
                      Verified Land · Brighter Tomorrows
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Right Form Pane */}
            <View style={[styles.rightPane, { width: isDesktop ? "54%" : "100%" }]}>
              {/* Segmented Tab Pill Selector */}
              <View style={styles.tabSelector}>
                <TouchableOpacity
                  style={[styles.tabButton, !isRegister && styles.tabButtonActive]}
                  onPress={() => handleTabSwitch("login")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabButtonText, !isRegister && styles.tabButtonTextActive]}>
                    {label("Sign In", "साइन इन")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, isRegister && styles.tabButtonActive]}
                  onPress={() => handleTabSwitch("register")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabButtonText, isRegister && styles.tabButtonTextActive]}>
                    {label("Create Account", "नया खाता बनाएं")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Heading */}
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>
                  {isRegister
                    ? label("Create your account", "अपना खाता बनाएं")
                    : label("Welcome back", "वापस स्वागत है")}
                </Text>
                <Text style={styles.formSubtitle}>
                  {isRegister
                    ? label(
                        "Join Bihar's verified property platform in 60 seconds.",
                        "बिहार के सबसे भरोसेमंद रियल एस्टेट पोर्टल से जुड़ें।"
                      )
                    : label(
                        "Enter your 10-digit mobile number and password to sign in.",
                        "साइन इन करने के लिए अपना 10 अंकों का मोबाइल नंबर और पासवर्ड दर्ज करें।"
                      )}
                </Text>
              </View>

              {/* Error Banner */}
              {!!error && (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Input Fields */}
              <View style={styles.fieldsContainer}>
                {/* Full Name (Register Only) */}
                {isRegister && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      {label("Full Name", "पूरा नाम")} <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={styles.inputWrap}>
                      <MaterialIcons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        value={name}
                        onChangeText={setName}
                        editable={!loading}
                        placeholder={label("e.g. Ramesh Kumar", "उदा. रमेश कुमार")}
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="words"
                        autoComplete="name"
                      />
                    </View>
                  </View>
                )}

                {/* Mobile Number */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    {label("Mobile Number", "मोबाइल नंबर")} <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.inputWrap}>
                    <View style={styles.countryCodeBadge}>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={[styles.textInput, styles.phoneInput]}
                      value={mobile}
                      onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
                      editable={!loading}
                      placeholder={label("10-digit mobile number", "10 अंकों का मोबाइल नंबर")}
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      autoComplete="tel"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <View style={styles.labelWithAction}>
                    <Text style={styles.fieldLabel}>
                      {label("Password", "पासवर्ड")} <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    {!isRegister && (
                      <TouchableOpacity
                        onPress={() =>
                          setError(
                            label(
                              "Password reset: Contact our support at support@malikse.com",
                              "पासवर्ड रीसेट: हमारे सपोर्ट से support@malikse.com पर संपर्क करें"
                            )
                          )
                        }
                      >
                        <Text style={styles.forgotLink}>
                          {label("Forgot password?", "पासवर्ड भूल गए?")}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.inputWrap}>
                    <MaterialIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { paddingRight: 48 }]}
                      value={password}
                      onChangeText={setPassword}
                      editable={!loading}
                      secureTextEntry={!showPassword}
                      placeholder={
                        isRegister
                          ? label("Minimum 6 characters", "कम से कम 6 अक्षर")
                          : label("Enter your password", "अपना पासवर्ड दर्ज करें")
                      }
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={isRegister ? undefined : handleSubmit}
                      returnKeyType={isRegister ? "next" : "go"}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={showPassword ? "visibility-off" : "visibility"}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Email (Optional, Register Only) */}
                {isRegister && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>
                      {label("Email Address (Optional)", "ईमेल पता (वैकल्पिक)")}
                    </Text>
                    <View style={styles.inputWrap}>
                      <MaterialIcons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={setEmail}
                        editable={!loading}
                        placeholder="name@example.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        returnKeyType="go"
                        onSubmitEditing={handleSubmit}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>
                      {isRegister
                        ? label("Create Free Account", "मुफ्त खाता बनाएं")
                        : label("Sign In to MalikSe", "MalikSe में साइन इन करें")}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>

              {/* Switch Tab Link */}
              <View style={styles.switchRow}>
                <Text style={styles.switchPromptText}>
                  {isRegister
                    ? label("Already have a MalikSe account?", "पहले से MalikSe पर खाता है?")
                    : label("New to MalikSe?", "MalikSe पर नए हैं?")}
                </Text>
                <TouchableOpacity
                  onPress={() => handleTabSwitch(isRegister ? "login" : "register")}
                  activeOpacity={0.75}
                >
                  <Text style={styles.switchActionText}>
                    {isRegister
                      ? label("Sign in here", "यहाँ साइन इन करें")
                      : label("Create an account", "खाता बनाएं")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Security & Privacy Shield Footnote */}
              <View style={styles.securityFootnote}>
                <MaterialIcons name="verified-user" size={14} color="#059669" />
                <Text style={styles.securityText}>
                  {label(
                    "256-bit encrypted · 100% dispute-free guarantee · Zero broker spam",
                    "256-बिट सुरक्षित · शून्य स्पैम · 100% सत्यापन गारंटी"
                  )}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Minimal Web Footer */}
        <View style={styles.bottomFooter}>
          <Text style={styles.copyrightText}>
            © {new Date().getFullYear()} MalikSe Technologies Pvt. Ltd. All rights reserved.
          </Text>
          <View style={styles.footerLinksRow}>
            <TouchableOpacity onPress={() => router.replace("/home")}>
              <Text style={styles.footerLinkText}>{label("Home", "होम")}</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => router.replace("/search")}>
              <Text style={styles.footerLinkText}>{label("Explore", "एक्सप्लोर")}</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => router.replace("/home")}>
              <Text style={styles.footerLinkText}>{label("Privacy Policy", "गोपनीयता नीति")}</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={() => router.replace("/home")}>
              <Text style={styles.footerLinkText}>{label("Terms of Service", "सेवा की शर्तें")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardScreen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    alignItems: "center",
  },

  /* Top Navigation Bar */
  topNav: {
    width: "100%",
    maxWidth: 1040,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  navLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navLogoText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: -0.5,
  },
  navRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backHomeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(3, 69, 108, 0.15)",
  },
  backHomeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#03456C",
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(3, 69, 108, 0.15)",
  },
  langText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#03456C",
  },

  /* Main Dual-Pane Card */
  authCardWrapper: {
    width: "100%",
    maxWidth: 1040,
    alignItems: "center",
    marginBottom: 28,
  },
  authCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    ...Platform.select({
      web: {
        boxShadow: "0 20px 48px -12px rgba(10, 25, 47, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.05)",
      },
      default: {
        shadowColor: "#0A192F",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.1,
        shadowRadius: 28,
        elevation: 8,
      },
    }),
  },

  /* Left Showcase Pane (Desktop Only) */
  leftPane: {
    width: "46%",
    minHeight: 620,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#03456C",
  },
  leftPaneOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: "rgba(3, 69, 108, 0.88)",
    ...Platform.select({
      web: {
        background: "linear-gradient(155deg, rgba(3, 69, 108, 0.92) 0%, rgba(10, 25, 47, 0.96) 100%)",
      },
    }),
  },
  leftPaneContent: {
    position: "relative",
    zIndex: 2,
    padding: 40,
    flex: 1,
    justifyContent: "space-between",
  },
  leftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  leftBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#38BDF8",
    letterSpacing: 0.8,
  },
  leftHeading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 36,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  leftSubtext: {
    fontSize: 14,
    color: "rgba(224, 242, 254, 0.85)",
    lineHeight: 22,
    marginBottom: 32,
  },
  pillarsList: {
    gap: 20,
    marginBottom: 32,
  },
  pillarItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  pillarIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  pillarTextBox: {
    flex: 1,
  },
  pillarTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  pillarDesc: {
    fontSize: 12,
    color: "rgba(203, 213, 225, 0.85)",
    lineHeight: 17,
  },
  leftBottomWatermark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  watermarkTagline: {
    fontSize: 11,
    fontStyle: "italic",
    color: "rgba(186, 230, 253, 0.7)",
  },

  /* Right Form Pane */
  rightPane: {
    padding: 40,
    justifyContent: "center",
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 26,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#03456C",
    fontWeight: "700",
  },

  /* Form Header */
  formHeader: {
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
  },

  /* Error Box */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
  },

  /* Fields */
  fieldsContainer: {
    gap: 16,
    marginBottom: 22,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  requiredStar: {
    color: "#DC2626",
  },
  labelWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
  },
  inputIcon: {
    paddingLeft: 14,
    paddingRight: 6,
  },
  countryCodeBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#0F172A",
    outlineStyle: "none" as any,
  },
  phoneInput: {
    paddingLeft: 12,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    padding: 6,
  },

  /* Submit Button */
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#03456C",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 18,
    ...Platform.select({
      web: {
        background: "linear-gradient(135deg, #03456C 0%, #0284C7 100%)",
        boxShadow: "0 6px 18px -2px rgba(2, 132, 199, 0.35)",
        cursor: "pointer",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Switch Row */
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  switchPromptText: {
    fontSize: 13,
    color: "#64748B",
  },
  switchActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284C7",
  },

  /* Security Footnote */
  securityFootnote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  securityText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },

  /* Minimal Footer */
  bottomFooter: {
    alignItems: "center",
    gap: 8,
    paddingBottom: 16,
  },
  copyrightText: {
    fontSize: 12,
    color: "#64748B",
  },
  footerLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerLinkText: {
    fontSize: 12,
    color: "#03456C",
    fontWeight: "600",
  },
  footerDot: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
