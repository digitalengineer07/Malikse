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
import { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import AppHeader from "./AppHeader";
import WebFooter from "./WebFooter";

interface AccountAuthScreenProps {
  mode: "login" | "register";
}

export default function AccountAuthScreen({ mode }: AccountAuthScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [activeTab, setActiveTab] = useState<"login" | "register">(mode);
  const isRegister = activeTab === "register";

  const { user, authState, hydrated } = useAuthStore();
  const { language } = useLanguageStore();
  const label = (en: string, hi: string) => (language === "hi" ? hi : en);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

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
    <View style={styles.screen}>
      {/* Universal Website Header matching Home and Explore */}
      <AppHeader showBack={false} />

      <KeyboardAvoidingView
        style={styles.keyboardScreen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Main Website Container - Same width (1340px) as Home & Explore */}
          <View style={styles.content}>
            {/* Main Dual-Pane Auth Card */}
            <View style={styles.authCardWrapper}>
              <View style={[styles.authCard, { flexDirection: isDesktop ? "row" : "column" }]}>
                {/* Left Showcase & Trust Pane (Desktop Only) */}
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

                    <View style={styles.leftPaneContent}>
                      <View>
                        <View style={styles.leftBadge}>
                          <MaterialIcons name="verified" size={13} color="#38BDF8" />
                          <Text style={styles.leftBadgeText}>
                            BIHAR'S #1 VERIFIED PROPERTY PORTAL
                          </Text>
                        </View>

                        <Text style={styles.leftHeading}>
                          {label(
                            "Direct deals.\nVerified titles.\nZero brokerage.",
                            "सीधे सौदे।\nसत्यापित ज़मीन।\nशून्य ब्रोकरेज।"
                          )}
                        </Text>

                        <Text style={styles.leftSubtext}>
                          {label(
                            "Search, verify, and close dispute-free property deals across all 38 districts of Bihar.",
                            "बिहार के सभी 38 जिलों में बिना किसी विवाद के सीधे सौदे करें।"
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
                                {label("Physical coordinates with surveyor pegs", "अमीन द्वारा मौके पर पैमाइश व सैटेलाइट मैपिंग")}
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
                      </View>

                      {/* Bottom Trust Guarantee Strip */}
                      <View style={styles.leftTrustFooter}>
                        <MaterialIcons name="security" size={16} color="#38BDF8" />
                        <Text style={styles.leftTrustText}>
                          {label(
                            "100% Legal-Checked · 38 Districts · ₹0 Brokerage",
                            "100% कानूनी जांच · 38 जिले · 0% ब्रोकरेज"
                          )}
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
                        ? label("Already have an account?", "पहले से खाता है?")
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

                  {/* Security Footnote */}
                  <View style={styles.securityFootnote}>
                    <MaterialIcons name="security" size={15} color="#15803D" />
                    <Text style={styles.securityText}>
                      {label(
                        "Bank-Grade 256-Bit SSL · 100% Title Guarantee · Zero Broker Spam",
                        "256-बिट सुरक्षित · शून्य स्पैम · 100% सत्यापन गारंटी"
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Under-Card Trust Assurance Bar */}
            <View style={styles.authTrustBar}>
              <View style={styles.authTrustItem}>
                <View style={[styles.authTrustIconWrap, { backgroundColor: "#E0F2FE" }]}>
                  <MaterialIcons name="gavel" size={18} color="#0284C7" />
                </View>
                <View style={styles.authTrustTextBox}>
                  <Text style={styles.authTrustTitle}>
                    {label("Revenue Record Verification", "राजस्व रिकॉर्ड सत्यापन")}
                  </Text>
                  <Text style={styles.authTrustSub}>
                    {label("Jamabandi, Khatiyan & Circle Office LPC audit", "जमाबंदी, खतियान व अंचल कार्यालय एलपीसी जांच")}
                  </Text>
                </View>
              </View>

              {isDesktop && <View style={styles.authTrustDivider} />}

              <View style={styles.authTrustItem}>
                <View style={[styles.authTrustIconWrap, { backgroundColor: "#DCFCE7" }]}>
                  <MaterialIcons name="gps-fixed" size={18} color="#059669" />
                </View>
                <View style={styles.authTrustTextBox}>
                  <Text style={styles.authTrustTitle}>
                    {label("Physical GPS Demarcation", "मौके पर जीपीएस पैमाइश")}
                  </Text>
                  <Text style={styles.authTrustSub}>
                    {label("Official surveyor pegs with cadastral mapping", "सरकारी अमीन द्वारा सीमांकन व सैटेलाइट मैपिंग")}
                  </Text>
                </View>
              </View>

              {isDesktop && <View style={styles.authTrustDivider} />}

              <View style={styles.authTrustItem}>
                <View style={[styles.authTrustIconWrap, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialIcons name="handshake" size={18} color="#D97706" />
                </View>
                <View style={styles.authTrustTextBox}>
                  <Text style={styles.authTrustTitle}>
                    {label("Direct Verified Owners", "सीधे असली ज़मीन मालिक")}
                  </Text>
                  <Text style={styles.authTrustSub}>
                    {label("₹0 broker commission · Zero hidden costs", "शून्य ब्रोकरेज · सीधे पारदर्शी सौदे")}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Full Global Website Footer */}
          <WebFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardScreen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1,
  },

  /* Matching Content Grid to VerifiedHomeScreen (maxWidth: 1340, paddingHorizontal: 28) */
  content: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 32,
  },

  /* Main Dual-Pane Auth Card */
  authCardWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 18,
  },
  authCard: {
    width: "100%",
    maxWidth: 1040,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    ...Platform.select({
      web: {
        boxShadow: "0 18px 42px -12px rgba(10, 25, 47, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.04)",
      },
      default: {
        shadowColor: "#0A192F",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },

  /* Left Showcase Pane (Desktop Only) */
  leftPane: {
    width: "46%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#03456C",
  },
  leftPaneOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: "rgba(3, 69, 108, 0.88)",
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(155deg, rgba(3, 69, 108, 0.93) 0%, rgba(10, 25, 47, 0.97) 100%)",
      },
    }),
  },
  leftPaneContent: {
    position: "relative",
    zIndex: 2,
    padding: 36,
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
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 18,
  },
  leftBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.8,
  },
  leftHeading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 35,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  leftSubtext: {
    fontSize: 13,
    color: "rgba(224, 242, 254, 0.85)",
    lineHeight: 20,
    marginBottom: 24,
  },
  pillarsList: {
    gap: 16,
    marginBottom: 24,
  },
  pillarItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  pillarIconBox: {
    width: 34,
    height: 34,
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
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  pillarDesc: {
    fontSize: 12,
    color: "rgba(203, 213, 225, 0.85)",
    lineHeight: 16,
  },
  leftTrustFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  leftTrustText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#BAE6FD",
    letterSpacing: 0.3,
  },

  /* Right Form Pane */
  rightPane: {
    paddingHorizontal: 36,
    paddingVertical: 32,
    justifyContent: "center",
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
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
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#03456C",
    fontWeight: "700",
  },

  /* Form Header */
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },

  /* Error Box */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
  },

  /* Fields */
  fieldsContainer: {
    gap: 14,
    marginBottom: 20,
  },
  fieldGroup: {
    gap: 5,
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
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
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
    marginBottom: 16,
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0284C7 100%)",
        boxShadow: "0 6px 20px -2px rgba(2, 132, 199, 0.38)",
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
    marginBottom: 16,
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
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  securityText: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },

  /* Under-Card Trust Assurance Bar */
  authTrustBar: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 6px 20px -4px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  authTrustItem: {
    flex: 1,
    minWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authTrustIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  authTrustTextBox: {
    flex: 1,
  },
  authTrustTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A192F",
    marginBottom: 2,
  },
  authTrustSub: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  authTrustDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E2E8F0",
  },
});
