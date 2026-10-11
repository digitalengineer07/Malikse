import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";

export default function AccountAuthScreen({ mode }: { mode: "login" | "register" }) {
  const [stage, setStage] = useState<"welcome" | "login" | "register">(mode === "register" ? "register" : "welcome");
  const register = stage === "register";
  const [progress] = useState(() => new Animated.Value(mode === "register" ? 1 : 0));
  const reduceMotion = useRef(false);
  const { height } = useWindowDimensions();
  const cardHeight = Math.max(620, Math.min(800, height - 90));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(value => { reduceMotion.current = value; });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { reduceMotion.current = value; });
    return () => { listener.remove(); progress.stopAnimation(); };
  }, [progress]);

  const reveal = (next: "welcome" | "login" | "register") => {
    setError("");
    setShowPassword(false);
    setStage(next);
    Animated.timing(progress, {
      toValue: next === "welcome" ? 0 : 1,
      duration: reduceMotion.current ? 0 : 620,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, authState, hydrated } = useAuthStore();
  const { language, toggleLanguage } = useLanguageStore();
  const label = (en: string, hi: string) => language === "hi" ? hi : en;
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    setError("");
    if (register && name.trim().length < 2) {
      setError(label("Enter your full name (at least 2 characters).", "अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।"));
      return;
    }
    if (!/^[0-9]{10}$/.test(mobile.trim())) {
      setError(label("Enter a valid 10-digit mobile number.", "सही 10 अंकों का मोबाइल नंबर दर्ज करें।"));
      return;
    }
    if (password.length < 6) {
      setError(label("Password must be at least 6 characters.", "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"));
      return;
    }
    if (register && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(label("Enter a valid email address or leave it empty.", "सही ईमेल पता दर्ज करें या इसे खाली छोड़ दें।"));
      return;
    }
    submitting.current = true;
    setLoading(true);
    try {
      await (register
        ? authService.register(name.trim(), mobile.trim(), password, email.trim().toLowerCase() || undefined)
        : authService.login(mobile.trim(), password));
      router.replace("/home");
    } catch (cause: any) {
      setError(cause?.response?.data?.message || label("Unable to connect. Please try again.", "कनेक्ट नहीं हो सका। फिर से कोशिश करें।"));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (!hydrated) return <View style={styles.center}><ActivityIndicator color="#047857" /></View>;
  if (authState === "AUTHENTICATED" && user) return <Redirect href="/search" />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => stage === "welcome" ? router.replace("/home") : reveal("welcome")}>
            <Text style={styles.link}>← {stage === "welcome" ? label("Marketplace", "मार्केटप्लेस") : label("Welcome", "स्वागत है")}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={toggleLanguage}>
            <Text style={styles.link}>{label("हिन्दी", "English")}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { height: cardHeight }]}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1628624747186-a941c476b7ef?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjB8fGhvdXNlfGVufDB8fDB8fHww" }}
            style={styles.housePhoto}
            resizeMode="cover"
            accessibilityLabel={label("A home surrounded by greenery", "हरियाली से घिरा एक घर")}
          />
          <View pointerEvents="none" style={styles.photoShade} />
          <Animated.View pointerEvents="none" style={[styles.photoBrand, { opacity: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }) }]}>
            <View style={styles.brandSeal}><MaterialIcons name="wb-sunny" size={26} color="#20251F" /><Text style={styles.sealText}>MALIKSE</Text></View>
            <Text style={styles.brand}>MalikSe</Text>
            <Text style={styles.brandTagline}>{label("Your land. A safer future.", "आपकी ज़मीन। सुरक्षित भविष्य।")}</Text>
          </Animated.View>
          <Animated.View style={[styles.panel, { top: progress.interpolate({ inputRange: [0, 1], outputRange: [cardHeight * 0.61, cardHeight * 0.16] }) }]}>
            <View pointerEvents="none" style={styles.panelCurve} />
            <Animated.View pointerEvents={stage === "welcome" ? "auto" : "none"} accessibilityElementsHidden={stage !== "welcome"} importantForAccessibility={stage === "welcome" ? "auto" : "no-hide-descendants"} aria-hidden={stage !== "welcome"} style={[styles.welcome, { opacity: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) }] }]}>
              <Text accessibilityRole="header" style={styles.welcomeTitle}>{label("WELCOME", "स्वागत है")}</Text>
              <Text style={styles.welcomeDescription}>{label("Find your next space, feel at home.\nWhere comfort meets confidence.", "अपना नया ठिकाना खोजें, घर जैसा महसूस करें।\nजहाँ सुकून और भरोसा साथ मिलें।")}</Text>
              <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.welcomeButton]} onPress={() => reveal("login")}><Text style={styles.buttonText}>{label("Login", "लॉगिन")}</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[styles.button, styles.welcomeButton, styles.outlineButton]} onPress={() => reveal("register")}><Text style={styles.outlineButtonText}>{label("Sign Up", "साइन अप")}</Text></TouchableOpacity>
            </Animated.View>
            {stage !== "welcome" && <Animated.View style={[styles.form, { opacity: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
                <Text accessibilityRole="header" style={styles.heading}>{register ? label("Create your account", "अपना खाता बनाएं") : label("Welcome back", "वापस स्वागत है")}</Text>
                <Text style={styles.description}>{register ? label("Your next chapter starts here.", "आपकी नई शुरुआत यहीं से।") : label("A place of your own is one step closer.", "आपका अपना ठिकाना, बस एक कदम दूर।")}</Text>
          {register && <View style={styles.field}>
            <Text style={styles.label}>{label("Full name", "पूरा नाम")}</Text>
            <TextInput accessibilityLabel={label("Full name", "पूरा नाम")} style={styles.input} value={name} onChangeText={setName} editable={!loading} autoComplete="name" autoCapitalize="words" placeholder={label("Enter your full name", "अपना पूरा नाम दर्ज करें")} placeholderTextColor="#718078" />
          </View>}
          <View style={styles.field}>
            <Text style={styles.label}>{label("Mobile number", "मोबाइल नंबर")}</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput accessibilityLabel={label("Mobile number", "मोबाइल नंबर")} style={styles.phoneInput} value={mobile} onChangeText={setMobile} editable={!loading} keyboardType="phone-pad" autoComplete="tel-national" maxLength={10} placeholder={label("10-digit mobile number", "10 अंकों का मोबाइल नंबर")} placeholderTextColor="#718078" />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{label("Password", "पासवर्ड")}</Text>
            <View style={styles.phoneRow}>
              <TextInput accessibilityLabel={label("Password", "पासवर्ड")} style={styles.passwordInput} value={password} onChangeText={setPassword} editable={!loading} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? label("At least 6 characters", "कम से कम 6 अक्षर") : label("Enter your password", "अपना पासवर्ड दर्ज करें")} placeholderTextColor="#718078" onSubmitEditing={register ? undefined : submit} returnKeyType={register ? "next" : "go"} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? label("Hide password", "पासवर्ड छिपाएं") : label("Show password", "पासवर्ड दिखाएं")} style={styles.eye} onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={22} color="#53645B" />
              </TouchableOpacity>
            </View>
          </View>
          {register && <View style={styles.field}>
            <Text style={styles.label}>{label("Email (optional)", "ईमेल (वैकल्पिक)")}</Text>
            <TextInput accessibilityLabel={label("Email (optional)", "ईमेल (वैकल्पिक)")} style={styles.input} value={email} onChangeText={setEmail} editable={!loading} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="name@example.com" placeholderTextColor="#718078" returnKeyType="go" onSubmitEditing={submit} />
          </View>}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading}>
            {loading && <ActivityIndicator color="white" />}
            <Text style={styles.buttonText}>{loading ? label("Please wait…", "कृपया प्रतीक्षा करें…") : register ? label("Create account", "खाता बनाएं") : label("Sign in", "साइन इन करें")}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.secondary} disabled={loading} onPress={() => reveal(register ? "login" : "register")}>
            <Text style={styles.link}>{register ? label("Already have an account? Sign in", "पहले से खाता है? साइन इन करें") : label("New to MalikSe? Create an account", "MalikSe पर नए हैं? खाता बनाएं")}</Text>
          </TouchableOpacity>
              </ScrollView>
            </Animated.View>}
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  topBar: { width: "100%", maxWidth: 440, flexDirection: "row", justifyContent: "space-between", marginBottom: 14, gap: 16 },
  card: { width: "100%", maxWidth: 440, backgroundColor: "#D9E4E5", borderRadius: 42, overflow: "hidden", shadowColor: "#20302B", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 7 },
  housePhoto: { position: "absolute", top: 0, left: 0, right: 0, height: "76%", width: "100%" },
  photoShade: { position: "absolute", top: 0, left: 0, right: 0, height: "76%", backgroundColor: "rgba(10,24,21,0.12)" },
  photoBrand: { position: "absolute", top: "28%", left: 0, right: 0, alignItems: "center" },
  brandSeal: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 10 },
  sealText: { fontFamily: "PoppinsBold", fontSize: 7, letterSpacing: 1 },
  brandTagline: { color: "white", fontFamily: "PoppinsMedium", fontSize: 11, marginTop: 2 },
  panel: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white" },
  panelCurve: { position: "absolute", top: -30, left: "-10%", width: "120%", height: 65, borderTopLeftRadius: "50%", borderTopRightRadius: "50%", backgroundColor: "white" },
  welcome: { position: "absolute", top: 16, left: 24, right: 24, alignItems: "center" },
  welcomeTitle: { fontSize: 28, fontFamily: "PoppinsBold", color: "#343632", letterSpacing: -0.8 },
  welcomeDescription: { color: "#8B8D88", textAlign: "center", fontSize: 12, fontFamily: "PoppinsRegular", lineHeight: 19, marginTop: 8, marginBottom: 24 },
  welcomeButton: { width: "78%", minHeight: 44, marginBottom: 10, paddingVertical: 10 },
  outlineButton: { backgroundColor: "white", borderWidth: 1, borderColor: "#DFE1DD" },
  outlineButtonText: { color: "#242723", fontFamily: "PoppinsMedium", fontSize: 14 },
  form: { flex: 1 },
  formContent: { padding: 26, paddingTop: 8, paddingBottom: 30 },
  backButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, paddingVertical: 10, marginBottom: 12 },
  backLabel: { color: "#72786F", fontFamily: "PoppinsMedium", fontSize: 12 },
  brand: { color: "white", fontSize: 29, fontFamily: "PoppinsBold", letterSpacing: -1 },
  heading: { fontSize: 26, fontFamily: "PoppinsBold", color: "#242723" },
  description: { color: "#858A81", fontFamily: "PoppinsRegular", fontSize: 12, lineHeight: 20, marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 14 },
  label: { color: "#3E566B", fontWeight: "600", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#E3E6DF", borderRadius: 14, padding: 14, fontSize: 16, color: "#111827", minHeight: 50 },
  phoneRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E3E6DF", borderRadius: 14, minHeight: 50 },
  prefix: { paddingHorizontal: 12, color: "#53645B" },
  phoneInput: { flex: 1, minWidth: 0, paddingVertical: 14, paddingRight: 12, fontSize: 16, color: "#111827" },
  passwordInput: { flex: 1, minWidth: 0, padding: 14, fontSize: 16, color: "#111827" },
  eye: { padding: 14 },
  error: { color: "#B91C1C", lineHeight: 21, marginBottom: 16 },
  button: { backgroundColor: "#222521", borderRadius: 26, padding: 15, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", fontFamily: "PoppinsMedium", fontSize: 14 },
  secondary: { alignItems: "center", paddingTop: 18, paddingBottom: 8 },
  link: { color: "#416980", fontWeight: "600", lineHeight: 22 },
});
