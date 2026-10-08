import React, { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";

export default function AccountAuthScreen({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/home")}>
            <Text style={styles.link}>← {label("Marketplace", "मार्केटप्लेस")}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={toggleLanguage}>
            <Text style={styles.link}>{label("हिन्दी", "English")}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <Text style={styles.brand}>MalikSe</Text>
          <Text style={styles.heading}>{register ? label("Create your account", "अपना खाता बनाएं") : label("Welcome back", "वापस स्वागत है")}</Text>
          <Text style={styles.description}>{register
            ? label("One account to buy and sell property.", "एक ही खाते से संपत्ति खरीदें और बेचें।")
            : label("Sign in to browse verified properties.", "सत्यापित संपत्तियां देखने के लिए साइन इन करें।")}</Text>

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
          <TouchableOpacity accessibilityRole="button" style={styles.secondary} disabled={loading} onPress={() => router.replace(register ? "/login" : "/register")}>
            <Text style={styles.link}>{register ? label("Already have an account? Sign in", "पहले से खाता है? साइन इन करें") : label("New to MalikSe? Create an account", "MalikSe पर नए हैं? खाता बनाएं")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, paddingHorizontal: 20, alignItems: "center" },
  topBar: { width: "100%", maxWidth: 520, flexDirection: "row", justifyContent: "space-between", marginBottom: 24, gap: 16 },
  card: { width: "100%", maxWidth: 520, backgroundColor: "#F3F8FC", padding: 26, borderWidth: 1, borderColor: "#E3EEF6", borderRadius: 28 },
  brand: { color: "#111827", fontSize: 22, fontWeight: "800", marginBottom: 24 },
  heading: { fontSize: 28, fontWeight: "800", color: "#111827" },
  description: { color: "#53645B", fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { color: "#3E566B", fontWeight: "600", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#D3E3EE", borderRadius: 14, padding: 14, fontSize: 16, color: "#111827", minHeight: 50 },
  phoneRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D3E3EE", borderRadius: 14, minHeight: 50 },
  prefix: { paddingHorizontal: 12, color: "#53645B" },
  phoneInput: { flex: 1, minWidth: 0, paddingVertical: 14, paddingRight: 12, fontSize: 16, color: "#111827" },
  passwordInput: { flex: 1, minWidth: 0, padding: 14, fontSize: 16, color: "#111827" },
  eye: { padding: 14 },
  error: { color: "#B91C1C", lineHeight: 21, marginBottom: 16 },
  button: { backgroundColor: "#111827", borderRadius: 26, padding: 15, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  secondary: { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  link: { color: "#416980", fontWeight: "600", lineHeight: 22 },
});
