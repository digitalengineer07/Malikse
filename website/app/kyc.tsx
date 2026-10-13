import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { authService } from "../src/services/authService";

export default function DemoKycScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const complete = async () => {
    setBusy(true);
    setError("");
    try {
      await authService.completeDemoKyc();
      router.replace("/dashboard");
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause?.message || "Could not complete demo KYC");
    } finally {
      setBusy(false);
    }
  };

  return <View style={styles.screen}>
    <Text style={styles.title}>KYC demo step</Text>
    <Text style={styles.description}>This only marks your account ready for the prototype buying and listing flows. No identity documents or Aadhaar are collected or verified here.</Text>
    <Text style={styles.status}>Status: {user?.demoKycComplete ? "Demo step complete" : "Not complete"}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!user || user.role !== "user" ? <TouchableOpacity style={styles.button} onPress={() => router.replace("/login")}><Text style={styles.buttonText}>Sign in as User</Text></TouchableOpacity>
      : !user.demoKycComplete ? <TouchableOpacity style={styles.button} disabled={busy} onPress={complete}><Text style={styles.buttonText}>{busy ? "Saving…" : "Complete demo KYC"}</Text></TouchableOpacity> : null}
    {busy ? <ActivityIndicator color="#047857" /> : null}
    <TouchableOpacity onPress={() => router.replace("/dashboard")}><Text style={styles.link}>Back to dashboard</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
    screen: { flex: 1, padding: 24, backgroundColor: "transparent" },
    title: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 40 },
  description: { color: "#53645B", fontSize: 15, lineHeight: 23, marginTop: 16, maxWidth: 550 },
    status: { color: "#416980", fontWeight: "700", marginTop: 28 },
  error: { color: "#B91C1C", marginTop: 16 },
    button: { backgroundColor: "#111827", padding: 15, borderRadius: 26, marginTop: 20, alignSelf: "flex-start" },
  buttonText: { color: "white", fontWeight: "700" },
    link: { color: "#416980", marginTop: 24, fontWeight: "700" },
});
