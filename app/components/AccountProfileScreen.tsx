import React, { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from "react-native";
import { Redirect, useRouter } from "expo-router";
import AppHeader from "./AppHeader";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import { authService } from "../src/services/authService";
import { userService } from "../src/services/userService";
import { dashboardRoutes, roleLabels } from "../src/utils/accountRoutes";

export default function AccountProfileScreen() {
  const router = useRouter();
  const { user, authState, hydrated, setUser } = useAuthStore();
  const { language } = useLanguageStore();
  const label = (en: string, hi: string) => language === "hi" ? hi : en;
  const [loggingOut, setLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const signingOut = useRef(false);

  const startEditing = () => {
    if (!user) return;
    setEditName(user.name);
    setEditEmail(user.email || "");
    setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const updatedUser = await userService.updateProfile({ name: editName, email: editEmail });
      setUser(updatedUser);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const logout = async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    setLoggingOut(true);
    await authService.logout();
    router.replace("/login");
  };

  if (!hydrated) return <View style={styles.center}><ActivityIndicator color="#047857" /></View>;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;

  const joined = new Date(user.createdAt);
  const details = [
    [label("Full name", "पूरा नाम"), user.name],
    [label("Mobile number", "मोबाइल नंबर"), `+91 ${user.mobile}`],
    [label("Email", "ईमेल"), user.email || label("Not added", "जोड़ा नहीं गया")],
    [label("Account role", "खाते की भूमिका"), roleLabels[user.role]],
    [label("Member since", "सदस्यता की तारीख"), Number.isNaN(joined.getTime()) ? "—" : joined.toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN")],
  ];

  return <View style={styles.screen}>
    <AppHeader showNavLinks={false} showPostPropertyBtn={false} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{label("Your profile", "आपकी प्रोफ़ाइल")}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loggingOut, busy: loggingOut }} style={styles.logout} disabled={loggingOut} onPress={logout}>
          <Text style={styles.logoutText}>{loggingOut ? label("Logging out…", "लॉग आउट हो रहा है…") : label("Log out", "लॉग आउट")}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.initial}>{user.name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.muted}>{roleLabels[user.role]}</Text>
          </View>
        </View>
        
        {isEditing ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.muted}>{label("Full name", "पूरा नाम")}</Text>
              <TextInput style={styles.input} value={editName} onChangeText={setEditName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.muted}>{label("Email", "ईमेल")}</Text>
              <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
              <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: "#E3EEF6" }]} onPress={() => setIsEditing(false)}>
                <Text style={[styles.buttonText, { color: "#111" }]}>{label("Cancel", "रद्द करें")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={saveProfile} disabled={isSaving}>
                <Text style={styles.buttonText}>{isSaving ? label("Saving...", "सहेज रहा है...") : label("Save Changes", "परिवर्तन सहेजें")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {details.map(([title, value]) => <View key={title} style={styles.detail}>
              <Text style={styles.muted}>{title}</Text>
              <Text selectable style={styles.value}>{value}</Text>
            </View>)}
            <TouchableOpacity style={{ marginTop: 16 }} onPress={startEditing}>
              <Text style={styles.link}>{label("Edit Profile", "प्रोफ़ाइल संपादित करें")}</Text>
            </TouchableOpacity>
          </>
        )}

        {user.role === "user" && !isEditing && <Text style={styles.note}>{label("Your account can buy and sell property.", "आपका खाता संपत्ति खरीद और बेच सकता है।")}</Text>}
      </View>
      {user.role === "user" && <View style={styles.card}>
        <Text style={styles.sectionTitle}>{label("KYC (demo)", "केवाईसी (डेमो)")}</Text>
        <Text style={styles.note}>{user.demoKycComplete ? label("Demo step complete", "डेमो चरण पूरा हुआ") : label("Demo step not completed", "डेमो चरण पूरा नहीं हुआ")}</Text>
        <Text style={styles.muted}>{label("This is a placeholder. Identity verification has not been performed.", "यह एक डेमो है। पहचान सत्यापन नहीं किया गया है।")}</Text>
        {!user.demoKycComplete && <TouchableOpacity accessibilityRole="button" style={styles.linkButton} onPress={() => router.push("/kyc")}>
          <Text style={styles.link}>{label("Complete demo KYC →", "डेमो केवाईसी पूरा करें →")}</Text>
        </TouchableOpacity>}
      </View>}
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => router.push(dashboardRoutes[user.role])}>
        <Text style={styles.buttonText}>{label("Open my dashboard", "मेरा डैशबोर्ड खोलें")}</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 20, paddingBottom: 40, gap: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#111827" },
  logout: { borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 12, backgroundColor: "#FEF2F2" },
  logoutText: { color: "#B91C1C", fontWeight: "700" },
  card: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 24, padding: 20, backgroundColor: "rgba(255,255,255,0.5)", ...(Platform.OS === "web" ? { backdropFilter: "none" } : {}) },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  identityText: { flex: 1 },
  avatar: { backgroundColor: "#EAF4FC", borderRadius: 28, width: 56, height: 56, justifyContent: "center", alignItems: "center" },
  initial: { color: "#416980", fontSize: 24, fontWeight: "700" },
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  muted: { color: "#6B7E90", lineHeight: 22 },
  detail: { paddingVertical: 12, borderTopWidth: 1, borderColor: "#EDF2EE", gap: 4 },
  value: { color: "#111827", fontSize: 16 },
  note: { color: "#3E566B", lineHeight: 22, marginVertical: 10 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "700" },
  linkButton: { paddingTop: 16, paddingBottom: 8, alignSelf: "flex-start" },
  link: { color: "#416980", fontWeight: "700" },
  button: { backgroundColor: "#111827", borderRadius: 26, padding: 16, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  inputGroup: { gap: 4 },
  input: { borderWidth: 1, borderColor: "#EDF2EE", backgroundColor: "white", borderRadius: 8, padding: 12, fontSize: 16, color: "#111" },
});
