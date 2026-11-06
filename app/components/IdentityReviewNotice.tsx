import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { authService } from "../src/services/authService";

export default function IdentityReviewNotice() {
  const user = useAuthStore(state => state.user);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <View style={{ flex: 1, padding: 24, gap: 18, paddingTop: 60 }}>
    <Text style={{ fontSize: 26, fontWeight: "700" }}>Identity verification</Text>
    <Text>{user?.isVerifiedIdentity ? "Your identity review is approved. You can list properties and make offers." : "A MalikSe administrator must review and approve your identity before you can list properties or make offers. Contact the MalikSe team to arrange verification."}</Text>
    {!!error && <Text accessibilityRole="alert">{error}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={async () => {
      setBusy(true); setError("");
      try { await authService.getMe(); } catch { setError("Could not refresh your verification status"); } finally { setBusy(false); }
    }}><Text>{busy ? "Checking…" : "Refresh verification status"}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/dashboard")}><Text>Back to dashboard</Text></TouchableOpacity>
  </View>;
}
