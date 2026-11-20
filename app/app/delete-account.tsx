import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { clearUserAffinity } from "../src/services/recommendationEngine";
import axios, { isAxiosError } from "axios";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useResumeStore } from "../src/store/resumeStore";

type Receipt = { reference: string; receipt: string; status: string };
const receiptKey = "malikse_deletion_receipt";
const website = process.env.EXPO_PUBLIC_WEBSITE_URL || "https://malikse.devoxa.in";
export default function DeleteAccount() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const user = useAuthStore(state => state.user);
  const [identifier, setIdentifier] = useState(user?.email || user?.mobile || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let alive = true;
    const read = Platform.OS === "web" ? Promise.resolve().then(() => sessionStorage.getItem(receiptKey)) : SecureStore.getItemAsync(receiptKey);
    void read.then(value => { if (alive && value) setReceipt(JSON.parse(value)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  async function submit() {
    if (submitting.current) return; submitting.current = true; setBusy(true); setError("");
    try {
      const { data } = await axios.post<Receipt>(`${api.defaults.baseURL}/account-deletion`, { identifier, password, confirmation }, { timeout: 20_000 });
      setReceipt(data); setPassword(""); useAuthStore.getState().clearSession();
      if (Platform.OS === "web") { try { sessionStorage.setItem(receiptKey, JSON.stringify(data)); } catch {} }
      else await SecureStore.setItemAsync(receiptKey, JSON.stringify(data)).catch(() => {});
      useResumeStore.setState({ tab: "/home", search: { query: "" } });
      await clearUserAffinity();
    } catch (e) { setError(isAxiosError(e) ? e.response?.data?.message || "Could not confirm the request. Retry with the same details." : "Could not request deletion."); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function refresh() {
    if (!receipt || submitting.current) return; submitting.current = true; setBusy(true); setError("");
    try { const { data } = await axios.post<Receipt>(`${api.defaults.baseURL}/account-deletion/status`, receipt, { timeout: 15_000 }); setReceipt(data); }
    catch { setError("Could not check status. Keep your receipt and try again shortly."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const canSubmit = !busy && confirmation === "DELETE" && Boolean(password && identifier.trim());
  const heading = receipt?.status === "completed" ? "Cleanup complete" :
    receipt?.status === "awaiting_deals" ? "Awaiting deal resolution" : "Deletion in progress";
  const keepAccount = () => router.canGoBack() ? router.back() : router.replace(user ? "/profile" : "/home");
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {focused && <StatusBar style="light" />}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
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
                  : "Keep this private receipt to check your request. Cleanup retries automatically after interruptions."}
              </Text>
              <View style={styles.receiptDetails}>
                <Text selectable style={styles.body}>Reference: {receipt.reference}</Text>
                <Text selectable style={styles.receipt}>Private receipt: {receipt.receipt}</Text>
              </View>
              {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
                style={[styles.button, busy && styles.disabled]} onPress={refresh}>
                {busy && <ActivityIndicator color={navy} />}
                <Text style={styles.buttonText}>{busy ? "Checking…" : "Check status"}</Text>
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
                  <Text style={styles.label}>Registered email or mobile number</Text>
                  <TextInput accessibilityLabel="Registered email or mobile number" autoCapitalize="none" autoComplete="username"
                    editable={!busy} style={styles.input} value={identifier} onChangeText={setIdentifier} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput accessibilityLabel="Password" autoComplete="current-password" secureTextEntry editable={!busy}
                    style={styles.input} value={password} onChangeText={setPassword} />
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
