import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { clearUserAffinity } from "../src/services/recommendationEngine";
import axios, { isAxiosError } from "axios";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useResumeStore } from "../src/store/resumeStore";
import AccountArtworkFooter from "../components/AccountArtworkFooter";

type Receipt = { reference: string; receipt: string; status: string };
const receiptKey = "malikse_deletion_receipt";
const website = (process.env.EXPO_PUBLIC_WEBSITE_URL || "https://malikse.com").replace(/\/+$/, "");
export default function DeleteAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const user = useAuthStore(state => state.user);
  const identifier = user?.email || user?.mobile || "";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [issuedReceipt, setReceipt] = useState<Receipt | null>(null);
  const receipt = focused && !user ? issuedReceipt : null;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const receiptContext = useRef(0);
  useEffect(() => {
    if (Platform.OS === "web") { try { sessionStorage.removeItem(receiptKey); } catch {} }
    else void SecureStore.deleteItemAsync(receiptKey).catch(() => {});
    return useAuthStore.subscribe((next, previous) => {
      if (next.user?.id === previous.user?.id) return;
      receiptContext.current++;
      setReceipt(null);
      setPassword("");
      setShowPassword(false);
      setConfirmation("");
      setError("");
    });
  }, []);
  useFocusEffect(useCallback(() => () => {
    receiptContext.current++;
    setReceipt(null);
    setPassword("");
    setShowPassword(false);
    setConfirmation("");
  }, []));
  async function submit() {
    const session = useAuthStore.getState();
    if (!user || session.user?.id !== user.id || !session.accessToken) {
      setError("Sign in to the account you want to delete.");
      return;
    }
    if (submitting.current) return; submitting.current = true; setBusy(true); setError("");
    const context = receiptContext.current;
    try {
      const { data } = await axios.post<Receipt>(`${api.defaults.baseURL}/account-deletion`, { identifier, password, confirmation }, {
        timeout: 20_000, headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (receiptContext.current !== context) return;
      useAuthStore.getState().clearSession();
      setReceipt(data);
      setPassword("");
      setShowPassword(false);
      setConfirmation("");
      useResumeStore.setState({ tab: "/home", search: { query: "" } });
      await clearUserAffinity();
    } catch (e) {
      if (receiptContext.current === context) setError(isAxiosError(e) ? e.response?.data?.message || "Could not confirm the request. Retry with the same details." : "Could not request deletion.");
    }
    finally { submitting.current = false; setBusy(false); }
  }
  const canSubmit = !busy && confirmation === "DELETE" && Boolean(password && identifier.trim());
  const heading = receipt?.status === "completed" ? "Cleanup complete" :
    receipt?.status === "awaiting_deals" ? "Awaiting deal resolution" : "Deletion in progress";
  const keepAccount = () => router.canGoBack() ? router.back() : router.replace(user ? "/profile" : "/home");
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {focused && <StatusBar style="light" />}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View pointerEvents="none" style={[styles.sun, { top: insets.top + 2 }]} />
          <View pointerEvents="none" style={styles.ray} />
          <View style={styles.heroInner}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to MalikSe" disabled={busy}
              style={[styles.back, busy && styles.disabled]} onPress={() => router.replace("/home")}>
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={styles.title}>Delete your account</Text>
          </View>
        </View>

        <View style={styles.content}>
          {receipt ? (
            <View style={styles.card}>
              <View style={styles.sectionHeading}>
                <View style={styles.receiptIcon}><MaterialIcons name="receipt-long" size={22} color={navy} /></View>
                <Text accessibilityRole="header" style={styles.heading}>{heading}</Text>
              </View>
              <Text style={styles.body}>
                {receipt.status === "awaiting_deals"
                  ? "Your account is disabled. Assigned staff must complete or cancel your accepted or paid deals before cleanup."
                  : "Cleanup retries automatically after interruptions."}
              </Text>
              <Text style={styles.body}>Save both codes before leaving this screen. You’ll need them to track your request on the MalikSe website.</Text>
              <View style={styles.receiptDetails}>
                <Text style={styles.label}>Reference number</Text>
                <Text selectable style={styles.receipt}>{receipt.reference}</Text>
                <Text style={styles.label}>Private receipt</Text>
                <Text selectable style={styles.receipt}>{receipt.receipt}</Text>
              </View>
            </View>
          ) : !user ? (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.heading}>Sign in to delete your account</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.button}
                onPress={() => router.push({ pathname: "/(auth)/login", params: { returnTo: "/delete-account" } })}>
                <Text style={styles.buttonText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.card, styles.warningCard]}>
                <View style={styles.sectionHeading}>
                  <View style={styles.warningIcon}><MaterialIcons name="warning-amber" size={22} color={red} /></View>
                  <Text accessibilityRole="header" style={styles.heading}>This action is permanent</Text>
                </View>
                <Text style={styles.body}>Your account will be disabled and your listings hidden. Cleanup removes your profile, identity files, listings, preferences and associated conversations.</Text>
                <Text style={styles.body}>Accepted or paid deals must be closed by assigned staff before cleanup. Other participants can keep limited deal records with your account link and free-text history removed. Staff accounts require administrator-managed removal.</Text>
                <TouchableOpacity accessibilityRole="link" style={styles.policy} onPress={() => {
                  void Linking.openURL(`${website}/privacy-policy`).catch(() => setError("Could not open the privacy policy."));
                }}>
                  <Text style={[styles.link, { flex: 1 }]}>Read the privacy and retention policy</Text>
                  <MaterialIcons name="open-in-new" size={17} color={navy} />
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.heading}>Confirm account deletion</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>Signed-in account</Text>
                  <Text selectable style={styles.body}>{identifier}</Text>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput accessibilityLabel="Password" autoComplete="current-password" secureTextEntry={!showPassword}
                      autoCapitalize="none" autoCorrect={false} editable={!busy}
                      style={styles.passwordInput} value={password} onChangeText={setPassword} />
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      disabled={busy} onPress={() => setShowPassword(visible => !visible)} style={styles.passwordToggle}>
                      <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={22} color={navy} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.recovery}
                    onPress={() => router.push("/(auth)/forgot-password" as never)}>
                    <Text style={styles.link}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Type <Text style={styles.confirmationText}>DELETE</Text> to confirm</Text>
                  <TextInput accessibilityLabel="Type DELETE to confirm" autoCapitalize="characters" autoCorrect={false}
                    editable={!busy} style={styles.input} value={confirmation} onChangeText={setConfirmation} />
                </View>
                {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !canSubmit, busy }} disabled={!canSubmit}
                  style={[styles.button, styles.dangerButton, !canSubmit && styles.disabled]} onPress={submit}>
                  {busy && <ActivityIndicator color="#fff" />}
                  <Text style={[styles.buttonText, styles.dangerText]}>{busy ? "Submitting…" : "Request account deletion"}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.keep} onPress={keepAccount}>
                  <Text style={styles.buttonText}>Keep my account</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
        <AccountArtworkFooter wavesOnly illustration={receipt && (
          <View aria-hidden pointerEvents="none" style={styles.watermark}>
            <Image source={require("../assets/images/account_deletion_watermark.png")}
              accessible={false} resizeMode="contain" style={styles.watermarkImage} />
          </View>
        )} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const navy = "#14263E";
const cream = "#F7F4EC";
const sun = "#FCC61C";
const red = "#A52D3B";
const border = "rgba(20,38,62,0.14)";

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  watermark: { width: "76%", maxWidth: 300, aspectRatio: 1.5, overflow: "hidden" },
  watermarkImage: { position: "absolute", width: "100%", height: "150%", top: "-25%" },
  screen: { flex: 1, backgroundColor: cream },
  hero: { backgroundColor: navy, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden", paddingHorizontal: 20, paddingBottom: 34 },
  heroInner: { width: "100%", maxWidth: 520, alignSelf: "center", gap: 14 },
  sun: { position: "absolute", width: 132, height: 132, borderRadius: 66, right: -88, backgroundColor: sun },
  ray: { position: "absolute", width: 64, height: 170, borderRadius: 32, right: 49, top: 64, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }] },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#244268", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Fraunces", color: "#fff", fontSize: 30, lineHeight: 38 },
  content: { width: "100%", maxWidth: 560, paddingHorizontal: 20, marginTop: -12, alignSelf: "center", gap: 14 },
  card: { padding: 18, gap: 14, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: border, shadowColor: navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  warningCard: { backgroundColor: "#FFF9F5", borderColor: "rgba(165,45,59,0.16)" },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  warningIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FCE6E6" },
  receiptIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0" },
  heading: { flexShrink: 1, fontFamily: "Fraunces", color: navy, fontSize: 21, lineHeight: 27 },
  body: { fontFamily: "Manrope", color: "#45566A", fontSize: 14, lineHeight: 21 },
  policy: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: border },
  recovery: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  link: { color: navy, fontFamily: "ManropeBold", fontSize: 13, lineHeight: 19 },
  field: { gap: 6 },
  label: { color: navy, fontFamily: "ManropeBold", fontSize: 13 },
  input: { minHeight: 50, borderWidth: 1, borderColor: border, borderRadius: 16, paddingHorizontal: 13, color: navy, fontFamily: "Manrope", fontSize: 16 },
  passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: border, borderRadius: 16 },
  passwordInput: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 13, color: navy, fontFamily: "Manrope", fontSize: 16 },
  passwordToggle: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 50, borderRadius: 25, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: sun },
  buttonText: { fontFamily: "ManropeExtraBold", color: navy, textAlign: "center", fontSize: 14 },
  dangerButton: { backgroundColor: red },
  dangerText: { color: "#fff" },
  confirmationText: { color: red },
  keep: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.55 },
  error: { fontFamily: "ManropeBold", color: red, fontSize: 13, lineHeight: 19 },
  receiptDetails: { backgroundColor: cream, borderRadius: 14, padding: 12, gap: 6 },
  receipt: { fontFamily: "Manrope", fontSize: 12, lineHeight: 18, color: "#45566A" },
});
