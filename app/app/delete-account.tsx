import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
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
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/home" as never)}><Text style={styles.link}>← Back to MalikSe</Text></TouchableOpacity><Text style={styles.title}>Delete your account</Text><Text style={styles.body}>Your account will be disabled and your listings hidden. Background cleanup removes your profile, identity files, listings, preferences and associated conversations. This cannot be undone.</Text><Text style={styles.body}>Accepted or paid deals must be closed by assigned staff before cleanup. Other participants can keep limited deal records with your account link and free-text history removed. Staff accounts require administrator-managed removal.</Text><TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL(`${website}/privacy-policy`).catch(() => setError("Could not open the privacy policy.")); }}><Text style={styles.link}>Read the privacy and retention policy</Text></TouchableOpacity>
    {receipt ? <View style={styles.card}><Text style={styles.heading}>{receipt.status === "completed" ? "Cleanup complete" : receipt.status === "awaiting_deals" ? "Awaiting deal resolution" : "Deletion in progress"}</Text><Text style={styles.body}>{receipt.status === "awaiting_deals" ? "Your account is disabled. Assigned staff must complete or cancel your accepted or paid deals before cleanup." : "Keep this private receipt to check your request. Cleanup retries automatically after interruptions."}</Text><Text selectable style={styles.body}>Reference: {receipt.reference}</Text><Text selectable style={styles.receipt}>Private receipt: {receipt.receipt}</Text><TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.button} onPress={refresh}><Text style={styles.buttonText}>{busy ? "Checking…" : "Check status"}</Text></TouchableOpacity></View> : <View style={styles.card}><Text style={styles.label}>Registered email or mobile number</Text><TextInput accessibilityLabel="Registered email or mobile number" autoCapitalize="none" autoComplete="username" style={styles.input} value={identifier} onChangeText={setIdentifier} /><Text style={styles.label}>Password</Text><TextInput accessibilityLabel="Password" autoComplete="current-password" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} /><TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as never)}><Text style={styles.link}>Forgot password?</Text></TouchableOpacity><Text style={styles.label}>Type DELETE to confirm</Text><TextInput accessibilityLabel="Type DELETE to confirm" autoCapitalize="characters" autoCorrect={false} style={styles.input} value={confirmation} onChangeText={setConfirmation} /><TouchableOpacity accessibilityRole="button" disabled={busy || confirmation !== "DELETE" || !password || !identifier} style={[styles.button, { backgroundColor: "#a52d3b", opacity: busy || confirmation !== "DELETE" ? 0.5 : 1 }]} onPress={submit}><Text style={styles.buttonText}>{busy ? "Submitting…" : "Request account deletion"}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>Keep my account</Text></TouchableOpacity></View>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { padding: 24, paddingTop: 60, paddingBottom: 70, gap: 18, maxWidth: 720, width: "100%", alignSelf: "center" }, title: { fontSize: 30, fontWeight: "800", color: "#183447" }, heading: { fontSize: 22, fontWeight: "700", color: "#183447" }, body: { color: "#455f6d", fontSize: 15, lineHeight: 24 }, link: { color: "#075f83", fontWeight: "600", paddingVertical: 8 }, card: { backgroundColor: "white", padding: 22, borderRadius: 18, gap: 12 }, label: { color: "#183447", fontWeight: "600" }, input: { borderWidth: 1, borderColor: "#bacbd4", borderRadius: 8, padding: 12, color: "#183447", fontSize: 16 }, button: { padding: 16, backgroundColor: "#075f83", borderRadius: 10, alignItems: "center" }, buttonText: { color: "white", fontWeight: "700" }, error: { color: "#a52d3b" }, receipt: { fontSize: 12, color: "#455f6d" } });
