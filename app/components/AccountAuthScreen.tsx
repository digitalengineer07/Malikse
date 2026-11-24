import { BrandLockup, brandHeader } from "./BrandLockup";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Redirect, useRouter, useLocalSearchParams, useIsFocused } from "expo-router";
import AccountArtworkFooter from "./AccountArtworkFooter";
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
  const { language, toggleLanguage } = useLanguageStore();
  const { height } = useWindowDimensions();
  const compactLogin = !register && height - insets.top - insets.bottom < 850;
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
  const [loginRetryAt, setLoginRetryAt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expiresIn = Math.max(0, Math.ceil(((challenge?.expiresAt || 0) - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((Math.max(challenge?.resendAt || 0, retryAt) - now) / 1000));
  const loginRetryIn = Math.max(0, Math.ceil((loginRetryAt - now) / 1000));
  const submitDisabled = loading || (register ? (challenge ? expiresIn === 0 : resendIn > 0) : loginRetryIn > 0);
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
    setNotice(result.resumed ? label("Use the code we already sent.", "पहले भेजे गए कोड का उपयोग करें।") : "");
    setRetryAt(0);
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
    if (submitting.current || (!register && Date.now() < loginRetryAt)) return;
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
      if (!register && cause?.response?.status === 429) {
        const headers = cause.response.headers;
        const raw = String(headers?.["retry-after"] ?? "");
        const currentTime = Date.now();
        const delay = /^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - currentTime;
        setNow(currentTime);
        setLoginRetryAt(currentTime + (Number.isFinite(delay) && delay > 0 ? delay : 30_000));
        console.warn("[Login] Rate limited", {
          requestId: headers?.["x-request-id"],
          edgeRequestId: headers?.["x-hcdn-request-id"],
          retryAfter: headers?.["retry-after"],
        });
        return;
      }
      if (cause?.response?.data?.retryAfterSeconds) {
        setRetryAt(Date.now() + cause.response.data.retryAfterSeconds * 1000);
        if (register && !challenge && cause.response.status === 429) return;
      }
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
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
              <BrandLockup style={styles.brandLockup} />
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
        <View style={[styles.card, compactLogin && styles.compactCard]}>
          {!(register && challenge) && <>
          <View style={[styles.methodRow, compactLogin && styles.compactMethodRow]}>
            {(["mobile", "email"] as const).map(method => {
              const selected = (register ? registerMethod : loginMethod) === method;
              return <TouchableOpacity key={method} accessibilityRole="button" accessibilityState={{ selected, disabled: loading }} disabled={loading} style={[styles.methodButton, selected && styles.methodButtonActive]} onPress={() => { if (register) { setRegisterMethod(method); setRetryAt(0); } else setLoginMethod(method); setError(""); }}>
                <MaterialIcons name={method === "mobile" ? "phone-iphone" : "mail-outline"} size={17} color={selected ? sun : navy} />
                <Text style={[styles.methodText, selected && styles.methodTextActive]}>{method === "mobile" ? label("Mobile", "मोबाइल") : label("Email", "ईमेल")}</Text>
              </TouchableOpacity>;
            })}
          </View>
          {register && <View style={[styles.field, compactLogin && styles.compactField]}>
            <Text style={styles.label}>{label("Full name", "पूरा नाम")}</Text>
            <TextInput accessibilityLabel={label("Full name", "पूरा नाम")} style={styles.input} value={name} onChangeText={setName} editable={!loading} autoComplete="name" autoCapitalize="words" placeholder={label("Enter your full name", "अपना पूरा नाम दर्ज करें")} placeholderTextColor="#536174" />
          </View>}
          {(register ? registerMethod === "email" : loginMethod === "email") && <View style={[styles.field, compactLogin && styles.compactField]}>
            <Text style={styles.label}>{label("Email address", "ईमेल पता")}</Text>
            <TextInput accessibilityLabel={label("Email address", "ईमेल पता")} style={styles.input} value={register ? email : loginEmail} onChangeText={register ? setEmail : setLoginEmail} editable={!loading} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@example.com" placeholderTextColor="#536174" />
          </View>}
          {(register || loginMethod === "mobile") && <View style={[styles.field, compactLogin && styles.compactField]}>
            <Text style={styles.label}>{register && registerMethod === "email" ? label("Mobile number (optional)", "मोबाइल नंबर (वैकल्पिक)") : label("Mobile number", "मोबाइल नंबर")}</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput accessibilityLabel={label("Mobile number", "मोबाइल नंबर")} style={styles.phoneInput} value={mobile} onChangeText={setMobile} editable={!loading} keyboardType="phone-pad" autoComplete="tel-national" maxLength={10} placeholder={label("10-digit mobile number", "10 अंकों का मोबाइल नंबर")} placeholderTextColor="#536174" />
            </View>
          </View>}
          <View style={[styles.field, compactLogin && styles.compactField]}>
            <Text style={styles.label}>{label("Password", "पासवर्ड")}</Text>
            <View style={styles.phoneRow}>
              <TextInput accessibilityLabel={label("Password", "पासवर्ड")} style={styles.passwordInput} value={password} onChangeText={setPassword} editable={!loading} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? label("At least 6 characters", "कम से कम 6 अक्षर") : label("Enter your password", "अपना पासवर्ड दर्ज करें")} placeholderTextColor="#536174" onSubmitEditing={register ? undefined : submit} returnKeyType={register ? "next" : "go"} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? label("Hide password", "पासवर्ड छिपाएं") : label("Show password", "पासवर्ड दिखाएं")} style={styles.eye} onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={22} color={navy} />
              </TouchableOpacity>
            </View>
          </View>
          {register && registerMethod === "mobile" && <View style={[styles.field, compactLogin && styles.compactField]}>
            <Text style={styles.label}>{label("Email (optional)", "ईमेल (वैकल्पिक)")}</Text>
            <TextInput accessibilityLabel={label("Email (optional)", "ईमेल (वैकल्पिक)")} style={styles.input} value={email} onChangeText={setEmail} editable={!loading} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@example.com" placeholderTextColor="#536174" returnKeyType="go" onSubmitEditing={submit} />
          </View>}
          </>}
          {register && challenge && <View style={styles.field}>
            <Text accessibilityRole="header" style={styles.verificationHeading}>{label("Verify your contact", "अपना संपर्क सत्यापित करें")}</Text>
            <Text style={styles.description}>
              {label("Enter the code sent to", "इस पते या नंबर पर भेजा गया कोड दर्ज करें")}{" "}
              <Text style={styles.destination}>{challenge.channel === "email" ? challenge.identifier : `+91 ${challenge.identifier}`}</Text>
            </Text>
            <Text style={styles.label}>{label("Verification code", "सत्यापन कोड")}</Text>
            <TextInput accessibilityLabel={label("Verification code", "सत्यापन कोड")} style={styles.input} value={otp} onChangeText={value => setOtp(value.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} autoComplete={challenge.channel === "mobile" ? "sms-otp" : "off"} textContentType={challenge.channel === "mobile" ? "oneTimeCode" : "none"} editable={!loading && expiresIn > 0} onSubmitEditing={submit} placeholder={label("6-digit code", "6 अंकों का कोड")} placeholderTextColor="#536174" />
            <Text style={styles.description}>{expiresIn > 0 ? label(`Code expires in ${expiresIn}s`, `कोड ${expiresIn} सेकंड में समाप्त होगा`) : label("OTP expired. Request a new code.", "OTP समाप्त हो गया। नया कोड मांगें।")}</Text>
            <View style={styles.verificationActions}>
              <TouchableOpacity accessibilityRole="button" disabled={loading || resendIn > 0} onPress={resend} style={styles.secondary}>
                <Text style={[styles.link, resendIn > 0 && styles.cooldown]}>{resendIn > 0 ? label(`Resend code in ${resendIn}s`, `कोड फिर भेजें: ${resendIn} सेकंड`) : label("Resend code", "कोड फिर भेजें")}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => { setChallenge(null); setOtp(""); setError(""); }} style={styles.secondary}><Text style={styles.link}>{label("Change details", "जानकारी बदलें")}</Text></TouchableOpacity>
            </View>
          </View>}
          {register && !challenge && resendIn > 0 && <Text style={styles.description}>{label(`You can request another OTP in ${resendIn}s.`, `${resendIn} सेकंड में नया OTP मांग सकते हैं।`)}</Text>}
          {!!notice && register && <Text accessibilityLiveRegion="polite" style={styles.description}>{notice}</Text>}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          {!register && loginRetryIn > 0 && <Text style={styles.error}>{label(`Sign-in is temporarily limited. Try again in ${loginRetryIn}s.`, `साइन इन अस्थायी रूप से सीमित है। ${loginRetryIn} सेकंड में फिर से कोशिश करें।`)}</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: submitDisabled, busy: loading }} style={[styles.button, submitDisabled && styles.disabled]} onPress={submit} disabled={submitDisabled}>
            {loading && <ActivityIndicator color={navy} />}
            <Text style={styles.buttonText}>{loading ? label("Please wait…", "कृपया प्रतीक्षा करें…") : register ? (challenge ? label("Verify & create account", "सत्यापित करें और खाता बनाएं") : registerMethod === "email" ? label("Send email OTP", "ईमेल OTP भेजें") : label("Send OTP", "OTP भेजें")) : label("Sign in", "साइन इन करें")}</Text>
          </TouchableOpacity>
          {!register && <TouchableOpacity accessibilityRole="button" style={styles.secondary} disabled={loading} onPress={() => router.push("/(auth)/forgot-password" as any)}><Text style={styles.link}>{label("Forgot password?", "पासवर्ड भूल गए?")}</Text></TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" style={[styles.secondary, styles.accountSwitch, compactLogin && styles.compactAccountSwitch]} disabled={loading} onPress={() => switchForm(!register)}>
            <Text style={styles.link}>{register ? label("Already have an account? Sign in", "पहले से खाता है? साइन इन करें") : label("New to MalikSe? Create an account", "MalikSe पर नए हैं? खाता बनाएं")}</Text>
          </TouchableOpacity>
        </View>
        <AccountArtworkFooter wavesOnly={register && !challenge} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const navy = "#14263E";
const sun = "#FCC61C";
const cream = "#F7F4EC";
const line = "rgba(20,38,62,0.16)";

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  screen: { flex: 1, backgroundColor: cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: cream },
  hero: { backgroundColor: navy, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden", paddingHorizontal: 20, paddingBottom: 28 },
  heroInner: { width: "100%", maxWidth: 440, alignSelf: "center", gap: brandHeader.gap },
  heroSun: { position: "absolute", width: 138, height: 138, borderRadius: 69, right: -66, backgroundColor: sun },
  heroRay: { position: "absolute", width: 74, height: 210, borderRadius: 40, right: 62, top: 70, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }] },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#244268" },
  language: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, backgroundColor: navy, borderColor: "#536174", borderWidth: 1 },
  languageText: { color: "#fff", fontFamily: "ManropeBold", fontSize: 14 },
  brandLockup: { flex: 1 },
  titleGroup: { gap: 4 },
  heading: { fontSize: brandHeader.headingSize, lineHeight: brandHeader.headingLineHeight, fontFamily: "Fraunces", color: "#fff" },
  heroHint: { color: "#F7F4EC", fontFamily: "Manrope", fontSize: 13, lineHeight: 19, maxWidth: "88%" },
  card: {
    width: "90%", maxWidth: 440, alignSelf: "center", marginTop: -14, padding: 20,
    borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: line,
    shadowColor: navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 3,
  },
  description: { color: "#536174", fontFamily: "Manrope", fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 14 },
  verificationHeading: { color: navy, fontFamily: "Fraunces", fontSize: 22 },
  destination: { color: navy, fontFamily: "ManropeBold" },
  verificationActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 12 },
  cooldown: { color: "#536174" },
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
  compactCard: { padding: 16 },
  compactMethodRow: { marginBottom: 12 },
  compactField: { marginBottom: 10 },
  compactAccountSwitch: { marginTop: 0, paddingTop: 8 },
  link: { color: navy, fontFamily: "ManropeBold", lineHeight: 22, textAlign: "center" },
});
