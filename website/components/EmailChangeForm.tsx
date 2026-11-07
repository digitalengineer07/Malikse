import React, { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
export default function EmailChangeForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState("");
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  async function run(verify: boolean) {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage("");
    try {
      if (verify) {
        const { data } = await api.post("/users/contact-change/verify", { challenge, oldCode, newCode });
        useAuthStore.getState().setUser(data); setChallenge(""); setOldCode(""); setNewCode(""); setPassword(""); setMessage("Email verified and updated.");
      } else {
        const { data } = await api.post("/users/contact-change", { email, password });
        setChallenge(data.challenge); setPassword(""); setMessage(data.message);
      }
    } catch (e: any) { setMessage(e.response?.data?.message || "Verification unavailable. Retry or contact support."); }
    finally { working.current = false; setBusy(false); }
  }
  const input = { borderWidth: 1, borderColor: "#b9c8d2", borderRadius: 8, padding: 12, color: "#172d3d" };
  return <View style={{ gap: 10 }}>
    <Text>Changing email requires your current password and codes from both your existing verified contact and the new email. If you cannot receive a code, contact support. Saving your name does not change your email.</Text>
    <TextInput accessibilityLabel="Current password for email change" placeholder="Current password" secureTextEntry value={password} onChangeText={setPassword} style={input} />
    <TouchableOpacity accessibilityRole="button" disabled={busy || !password || !email.trim()} onPress={() => void run(false)}><Text style={{ color: "#075e54", padding: 8 }}>Send verification codes</Text></TouchableOpacity>
    {!!challenge && <>
      <TextInput accessibilityLabel="Existing contact code" placeholder="Code from existing contact" keyboardType="number-pad" maxLength={6} value={oldCode} onChangeText={setOldCode} style={input} />
      <TextInput accessibilityLabel="New email code" placeholder="Code from new email" keyboardType="number-pad" maxLength={6} value={newCode} onChangeText={setNewCode} style={input} />
      <TouchableOpacity accessibilityRole="button" disabled={busy || oldCode.length !== 6 || newCode.length !== 6} onPress={() => void run(true)}><Text style={{ color: "#075e54", padding: 8 }}>Verify and change email</Text></TouchableOpacity>
    </>}
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
  </View>;
}
