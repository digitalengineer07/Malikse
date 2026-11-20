import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Redirect, useRouter, useLocalSearchParams, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";

export default function AccountAuthScreen({ mode }: { mode: "login" | "register" }) {
  const [register, setRegister] = useState(mode === "register");
  const focused = useIsFocused();

  const switchForm = (registration: boolean) => {
    setError("");
    setShowPassword(false);
    setRegister(registration);
    setChallenge(null);
    setOtp("");
  };
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const destination = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/home";
  const insets = useSafeAreaInsets();
  const { user, authState, hydrated } = useAuthStore();
  const { language, toggleLanguage, setLanguage } = useLanguageStore();
  const [showSettings, setShowSettings] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const label = (en: string, hi: string) => language === "hi" ? hi : en;
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [registerMethod, setRegisterMethod] = useState<"mobile" | "email">("mobile");
  const [loginMethod, setLoginMethod] = useState<"mobile" | "email">("mobile");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; channel: "mobile" | "email"; identifier: string; expiresAt: number; resendAt: number } | null>(null);
  const [otp, setOtp] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expiresIn = Math.max(0, Math.ceil(((challenge?.expiresAt || 0) - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((Math.max(challenge?.resendAt || 0, retryAt) - now) / 1000));
  const sendCode = async () => {
    const cleanMobile = mobile.trim();
    const cleanEmail = email.trim().toLowerCase();
    const result = challenge ? await authService.resendRegistration(challenge.challengeId) : await authService.register({ name: name.trim(), password, method: registerMethod, mobile: cleanMobile || undefined, email: cleanEmail || undefined });
    const sentAt = Date.now();
    setNow(sentAt);
    if (result.testOnly) {
      setChallenge(null);
      setOtp("");
      setRetryAt(sentAt + result.resendAfterSeconds * 1000);
      setNotice(label("Trial test SMS requested. The sample code is for delivery testing only; no account was created.", "ट्रायल टेस्ट SMS का अनुरोध भेजा गया। यह केवल डिलीवरी टेस्ट है; खाता नहीं बनाया गया।"));
      return;
    }
    if (!result.challengeId) throw new Error(result.message || "Verification could not be started. Please try again.");
    const channel = result.channel || registerMethod;
    setNotice("");
    setChallenge({ challengeId: result.challengeId, channel, identifier: channel === "email" ? cleanEmail : cleanMobile, expiresAt: sentAt + (result.expiresInSeconds || 120) * 1000, resendAt: sentAt + result.resendAfterSeconds * 1000 });
    setOtp("");
  };
  const resend = async () => {
    if (submitting.current || resendIn > 0) return;
    submitting.current = true;
    setLoading(true);
    setError("");
    try { await sendCode(); }
    catch (cause: any) {
      if (cause?.response?.data?.retryAfterSeconds) setRetryAt(Date.now() + cause.response.data.retryAfterSeconds * 1000);
      setError(cause?.response?.data?.message || "Unable to send OTP. Please try again.");
    } finally { submitting.current = false; setLoading(false); }
  };

  const submit = async () => {
    if (submitting.current) return;
    setError("");
    if (register && name.trim().length < 2) {
      setError(label("Enter your full name (at least 2 characters).", "अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।"));
      return;
    }
    const mobileRequired = register ? registerMethod === "mobile" : loginMethod === "mobile";
    if ((mobileRequired || (register && mobile.trim())) && !/^[0-9]{10}$/.test(mobile.trim())) {
      setError(label(register && !mobileRequired ? "Enter a valid 10-digit mobile number or leave it empty." : "Enter a valid 10-digit mobile number.", "सही 10 अंकों का मोबाइल नंबर दर्ज करें या इसे खाली छोड़ दें।"));
      return;
    }
    const emailValue = register ? email.trim() : loginEmail.trim();
    const emailRequired = register ? registerMethod === "email" : loginMethod === "email";
    if ((emailRequired || (register && emailValue)) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError(label(emailRequired ? "Enter a valid email address." : "Enter a valid email address or leave it empty.", "सही ईमेल पता दर्ज करें।"));
      return;
    }
    if (password.length < 6) {
      setError(label("Password must be at least 6 characters.", "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"));
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      if (register) {
        if (!challenge) { await sendCode(); return; }
        if (!/^\d{6}$/.test(otp)) { setError(label("Enter the six-digit OTP.", "छह अंकों का OTP दर्ज करें।")); return; }
        await authService.verifyRegistration(challenge.identifier, challenge.challengeId, otp);
      } else { await authService.login(loginMethod === "email" ? loginEmail.trim().toLowerCase() : mobile.trim(), password); }
      router.replace(destination as any);
    } catch (cause: any) {
      if (cause?.response?.data?.retryAfterSeconds) setRetryAt(Date.now() + cause.response.data.retryAfterSeconds * 1000);
      setError(cause?.response?.data?.message || cause?.message || label("Unable to connect. Please try again.", "कनेक्ट नहीं हो सका। फिर से कोशिश करें।"));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (!hydrated) return <View style={styles.center}><ActivityIndicator color={navy} /></View>;
  if (authState === "AUTHENTICATED" && user) return <Redirect href={destination as any} />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {focused && <StatusBar style="light" />}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: register ? insets.bottom + 18 : keyboardVisible ? 18 : 0,
      }}>
        <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View pointerEvents="none" style={[styles.heroSun, { top: insets.top + 4 }]} />
          <View pointerEvents="none" style={styles.heroRay} />
          <View style={styles.heroInner}>
            <View style={styles.topBar}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={label("Back", "वापस")} style={styles.heroIcon} disabled={loading}
                onPress={() => {
                  if (register) switchForm(false);
                  else if (router.canGoBack()) router.back();
                  else router.replace("/home");
                }}>
                <MaterialIcons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={styles.brandLockup}>
                <Image source={require("../assets/images/icon.png")} style={styles.brandLogo} resizeMode="contain" accessible={false} />
                <Text style={styles.brand}>MalikSe<Text style={{ color: sun }}>.</Text></Text>
              </View>
              <TouchableOpacity accessibilityRole="button" style={styles.language} onPress={toggleLanguage}>
                <Text style={styles.languageText}>{label("हिन्दी", "English")}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.titleGroup}>
              <Text accessibilityRole="header" style={styles.heading}>
                {register ? label("Create your account", "अपना खाता बनाएं") : label("Sign in", "साइन इन करें")}
              </Text>
              {!register && <Text style={styles.heroHint}>{label("Use your registered mobile number or email.", "अपना पंजीकृत मोबाइल नंबर या ईमेल इस्तेमाल करें।")}</Text>}
            </View>
          </View>
        </View>
        <View style={styles.card}>
          {!(register && challenge) && <>
          <View style={styles.methodRow}>
            {(["mobile", "email"] as const).map(method => {
              const selected = (register ? registerMethod : loginMethod) === method;
              return <TouchableOpacity key={method} accessibilityRole="button" accessibilityState={{ selected, disabled: loading }} disabled={loading} style={[styles.methodButton, selected && styles.methodButtonActive]} onPress={() => { if (register) { setRegisterMethod(method); setRetryAt(0); } else setLoginMethod(method); setError(""); }}>
                <MaterialIcons name={method === "mobile" ? "phone-iphone" : "mail-outline"} size={17} color={selected ? sun : navy} />
                <Text style={[styles.methodText, selected && styles.methodTextActive]}>{method === "mobile" ? label("Mobile", "मोबाइल") : label("Email", "ईमेल")}</Text>
              </TouchableOpacity>;
            })}
          </View>
          {register && <View style={styles.field}>
            <Text style={styles.label}>{label("Full name", "पूरा नाम")}</Text>
            <TextInput accessibilityLabel={label("Full name", "पूरा नाम")} style={styles.input} value={name} onChangeText={setName} editable={!loading} autoComplete="name" autoCapitalize="words" placeholder={label("Enter your full name", "अपना पूरा नाम दर्ज करें")} placeholderTextColor="#536174" />
          </View>}
          {(register ? registerMethod === "email" : loginMethod === "email") && <View style={styles.field}>
            <Text style={styles.label}>{label("Email address", "ईमेल पता")}</Text>
            <TextInput accessibilityLabel={label("Email address", "ईमेल पता")} style={styles.input} value={register ? email : loginEmail} onChangeText={register ? setEmail : setLoginEmail} editable={!loading} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@example.com" placeholderTextColor="#536174" />
          </View>}
          {(register || loginMethod === "mobile") && <View style={styles.field}>
            <Text style={styles.label}>{register && registerMethod === "email" ? label("Mobile number (optional)", "मोबाइल नंबर (वैकल्पिक)") : label("Mobile number", "मोबाइल नंबर")}</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput accessibilityLabel={label("Mobile number", "मोबाइल नंबर")} style={styles.phoneInput} value={mobile} onChangeText={setMobile} editable={!loading} keyboardType="phone-pad" autoComplete="tel-national" maxLength={10} placeholder={label("10-digit mobile number", "10 अंकों का मोबाइल नंबर")} placeholderTextColor="#536174" />
            </View>
          </View>}
          <View style={styles.field}>
            <Text style={styles.label}>{label("Password", "पासवर्ड")}</Text>
            <View style={styles.phoneRow}>
              <TextInput accessibilityLabel={label("Password", "पासवर्ड")} style={styles.passwordInput} value={password} onChangeText={setPassword} editable={!loading} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? label("At least 6 characters", "कम से कम 6 अक्षर") : label("Enter your password", "अपना पासवर्ड दर्ज करें")} placeholderTextColor="#536174" onSubmitEditing={register ? undefined : submit} returnKeyType={register ? "next" : "go"} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? label("Hide password", "पासवर्ड छिपाएं") : label("Show password", "पासवर्ड दिखाएं")} style={styles.eye} onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={22} color={navy} />
              </TouchableOpacity>
            </View>
          </View>
          {register && registerMethod === "mobile" && <View style={styles.field}>
            <Text style={styles.label}>{label("Email (optional)", "ईमेल (वैकल्पिक)")}</Text>
            <TextInput accessibilityLabel={label("Email (optional)", "ईमेल (वैकल्पिक)")} style={styles.input} value={email} onChangeText={setEmail} editable={!loading} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@example.com" placeholderTextColor="#536174" returnKeyType="go" onSubmitEditing={submit} />
          </View>}
          </>}
          {register && challenge && <View style={styles.field}>
            <Text style={styles.label}>{label("OTP sent to", "OTP भेजा गया")} {challenge.channel === "email" ? challenge.identifier : `+91 ${challenge.identifier}`}</Text>
            <TextInput accessibilityLabel="OTP" style={styles.input} value={otp} onChangeText={value => setOtp(value.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} autoComplete={challenge.channel === "mobile" ? "sms-otp" : "off"} textContentType={challenge.channel === "mobile" ? "oneTimeCode" : "none"} editable={!loading && expiresIn > 0} onSubmitEditing={submit} placeholder="6-digit OTP" />
            <Text style={styles.description}>{expiresIn > 0 ? label(`Code expires in ${expiresIn}s`, `कोड ${expiresIn} सेकंड में समाप्त होगा`) : label("OTP expired. Request a new code.", "OTP समाप्त हो गया। नया कोड मांगें।")}</Text>
            <TouchableOpacity accessibilityRole="button" disabled={loading || resendIn > 0} onPress={resend} style={styles.secondary}>
              <Text style={styles.link}>{resendIn > 0 ? label(`Resend OTP in ${resendIn}s`, `OTP फिर भेजें: ${resendIn} सेकंड`) : label("Resend OTP", "OTP फिर भेजें")}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => { setChallenge(null); setOtp(""); setError(""); }} style={styles.secondary}><Text style={styles.link}>{label("Change details", "जानकारी बदलें")}</Text></TouchableOpacity>
          </View>}
          {register && !challenge && resendIn > 0 && <Text style={styles.description}>{label(`You can request another OTP in ${resendIn}s.`, `${resendIn} सेकंड में नया OTP मांग सकते हैं।`)}</Text>}
          {!!notice && register && <Text accessibilityLiveRegion="polite" style={styles.description}>{notice}</Text>}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading || (register && (challenge ? expiresIn === 0 : resendIn > 0))}>
            {loading && <ActivityIndicator color={navy} />}
            <Text style={styles.buttonText}>{loading ? label("Please wait…", "कृपया प्रतीक्षा करें…") : register ? (challenge ? label("Verify & create account", "सत्यापित करें और खाता बनाएं") : registerMethod === "email" ? label("Send email OTP", "ईमेल OTP भेजें") : label("Send OTP", "OTP भेजें")) : label("Sign in", "साइन इन करें")}</Text>
          </TouchableOpacity>
          {!register && <TouchableOpacity accessibilityRole="button" style={styles.secondary} disabled={loading} onPress={() => router.push("/(auth)/forgot-password" as any)}><Text style={styles.link}>{label("Forgot password?", "पासवर्ड भूल गए?")}</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" style={[styles.secondary, styles.accountSwitch]} disabled={loading} onPress={() => switchForm(!register)}>
            <Text style={styles.link}>{register ? label("Already have an account? Sign in", "पहले से खाता है? साइन इन करें") : label("New to MalikSe? Create an account", "MalikSe पर नए हैं? खाता बनाएं")}</Text>
          </TouchableOpacity>
        </View>
        {!register && !keyboardVisible && (
          <>
            <View style={styles.signInFooter}>
              <View pointerEvents="none" style={[styles.artCrop, styles.houseArt]}>
                <Image source={require("../assets/images/modern_house_with_location_pin.png")} style={styles.houseAsset} resizeMode="stretch" accessible={false} />
              </View>
              <Text accessibilityRole="header" style={styles.footerHeading}>{label("Buy & Sell Property", "प्रॉपर्टी खरीदें और बेचें")}</Text>
              <View pointerEvents="none" style={[styles.artCrop, styles.ownerBadge]}>
                <Image source={require("../assets/images/directly_from_the_owner_badge.png")} style={styles.ownerAsset}
                  resizeMode="stretch" accessible accessibilityLabel="Directly from the Owner" />
              </View>
              <View style={styles.footerActions}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={label("Language settings", "भाषा सेटिंग")}
                  accessibilityState={{ expanded: showSettings }} style={styles.settingsButton} onPress={() => setShowSettings(open => !open)}>
                  <View style={[styles.artCrop, styles.settingsIcon]}>
                    <Image source={require("../assets/images/sign_in_settings_icon.png")} style={styles.settingsAsset} resizeMode="stretch" accessible={false} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="link" style={styles.support}
                  onPress={() => void Linking.openURL("mailto:support@malikse.in").catch(() => {
                    setError(label("Email support@malikse.in for help.", "सहायता के लिए support@malikse.in पर ईमेल करें।"));
                  })}>
                  <View style={[styles.artCrop, styles.supportIcon]}>
                    <Image source={require("../assets/images/sign_in_contact_support_icon.png")} style={styles.supportAsset} resizeMode="stretch" accessible={false} />
                  </View>
                  <Text style={styles.link}>{label("Contact support", "सहायता से संपर्क करें")}</Text>
                </TouchableOpacity>
                <View style={styles.settingsButton} />
              </View>
              {showSettings && (
                <View style={styles.footerLanguages}>
                  {([{ key: "en", name: "English" }, { key: "hi", name: "हिन्दी" }] as const).map(option => (
                    <TouchableOpacity key={option.key} accessibilityRole="radio" accessibilityState={{ checked: language === option.key }}
                      style={[styles.footerLanguage, language === option.key && styles.footerLanguageSelected]}
                      onPress={() => { setLanguage(option.key); setShowSettings(false); }}>
                      <Text style={styles.link}>{option.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View pointerEvents="none" style={[styles.artCrop, styles.footerWaves]}>
              <Image source={require("../assets/images/navy_waves_with_rising_sun.png")} style={styles.wavesAsset} resizeMode="stretch" accessible={false} />
            </View>
            <View pointerEvents="none" style={{ height: insets.bottom, backgroundColor: "#142D4B" }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const navy = "#14263E";
const sun = "#FCC61C";
const cream = "#F7F4EC";
const line = "rgba(20,38,62,0.16)";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: cream },
  hero: { backgroundColor: navy, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden", paddingHorizontal: 20, paddingBottom: 36 },
  heroInner: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 20 },
  heroSun: { position: "absolute", width: 138, height: 138, borderRadius: 69, right: -66, backgroundColor: sun },
  heroRay: { position: "absolute", width: 74, height: 210, borderRadius: 40, right: 62, top: 70, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }] },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#244268" },
  language: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, backgroundColor: navy, borderColor: "#536174", borderWidth: 1 },
  languageText: { color: "#fff", fontFamily: "ManropeBold", fontSize: 14 },
  brandLockup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  brandLogo: { width: 32, height: 32 },
  brand: { color: "#fff", fontSize: 24, fontFamily: "Fraunces" },
  titleGroup: { gap: 4 },
  heading: { fontSize: 32, lineHeight: 40, fontFamily: "Fraunces", color: "#fff" },
  heroHint: { color: "#F7F4EC", fontFamily: "Manrope", fontSize: 13, lineHeight: 19, maxWidth: "88%" },
  card: {
    width: "90%", maxWidth: 440, alignSelf: "center", marginTop: -14, padding: 20,
    borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: line,
    shadowColor: navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 3,
  },
  description: { color: "#536174", fontFamily: "Manrope", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 14 },
  methodRow: { flexDirection: "row", gap: 4, marginBottom: 18, backgroundColor: cream, borderRadius: 16, padding: 4 },
  methodButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 44, borderRadius: 12 },
  methodButtonActive: { backgroundColor: navy },
  methodText: { color: navy, fontFamily: "ManropeBold", fontSize: 14 },
  methodTextActive: { color: sun },
  field: { marginBottom: 14 },
  label: { color: navy, fontFamily: "ManropeBold", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: line, borderRadius: 16, padding: 14, fontSize: 16, fontFamily: "Manrope", color: navy, minHeight: 52 },
  phoneRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: line, borderRadius: 16, minHeight: 52 },
  prefix: { paddingHorizontal: 12, color: navy, fontFamily: "ManropeBold" },
  phoneInput: { flex: 1, minWidth: 0, paddingVertical: 14, paddingRight: 12, fontSize: 16, fontFamily: "Manrope", color: navy },
  passwordInput: { flex: 1, minWidth: 0, padding: 14, fontSize: 16, fontFamily: "Manrope", color: navy },
  eye: { padding: 14 },
  error: { color: "#B91C1C", lineHeight: 21, marginBottom: 16 },
  button: { backgroundColor: sun, minHeight: 50, borderRadius: 25, padding: 14, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.6 },
  buttonText: { color: navy, fontFamily: "ManropeExtraBold", fontSize: 15, textAlign: "center" },
  secondary: { alignItems: "center", justifyContent: "center", minHeight: 44, paddingVertical: 8 },
  accountSwitch: { borderTopWidth: 1, borderColor: line, marginTop: 4, paddingTop: 12 },
  signInFooter: { flexGrow: 1, justifyContent: "flex-end", alignItems: "center", paddingTop: 14 },
  artCrop: { overflow: "hidden" },
  houseArt: { width: "90%", maxWidth: 420, aspectRatio: 1448 / 540 },
  houseAsset: { position: "absolute", width: "100%", height: "201.11%", top: "-61.11%" },
  footerHeading: { color: navy, fontFamily: "ManropeExtraBold", fontSize: 17, lineHeight: 22, textAlign: "center" },
  ownerBadge: { width: "52%", maxWidth: 224, aspectRatio: 1900 / 258 },
  ownerAsset: { position: "absolute", width: "114.32%", height: "280.62%", left: "-7.16%", top: "-91.09%" },
  footerActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: 460, paddingHorizontal: 14, marginTop: 4, zIndex: 1 },
  settingsButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  settingsIcon: { width: 42, height: 42 },
  settingsAsset: { position: "absolute", width: "169.46%", height: "169.46%", left: "-33.78%", top: "-37.84%" },
  supportIcon: { width: 17, height: 17 },
  supportAsset: { position: "absolute", width: "190%", height: "190%", left: "-44.7%", top: "-47.7%" },
  support: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12 },
  footerLanguages: { flexDirection: "row", gap: 8, marginVertical: 6 },
  footerLanguage: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: line, backgroundColor: "#fff" },
  footerLanguageSelected: { backgroundColor: "#FFF1C0" },
  footerWaves: { width: "100%", height: 54, marginTop: -15 },
  wavesAsset: { position: "absolute", width: "100%", height: "207%", bottom: 0 },
  link: { color: navy, fontFamily: "ManropeBold", lineHeight: 22, textAlign: "center" },
});
