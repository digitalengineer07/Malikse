import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import api from "../../src/services/authService";

type Challenge = { challengeId: string; destination?: string; expiresInSeconds: number; resendAfterSeconds: number };

export default function ForgotPassword() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const submitting = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendWait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function submit(resend = false) {
    if (submitting.current) return;
    if (challenge && !resend && (!/^\d{6}$/.test(code) || password.length < 6 || password !== confirm)) {
      setMessage("Enter the 6-digit OTP and matching passwords of at least 6 characters."); return;
    }
    submitting.current = true; setBusy(true); setMessage("");
    try {
      if (!challenge || resend) {
        const response = await api.post(resend ? "/auth/forgot-password/resend" : "/auth/forgot-password",
          resend ? { challengeId: challenge?.challengeId } : { identifier: identifier.trim() });
        const next: Challenge = response.data;
        setChallenge(next); setCode(""); setNow(Date.now());
        setExpiresAt(Date.now() + next.expiresInSeconds * 1000);
        setResendAt(Date.now() + next.resendAfterSeconds * 1000);
      } else {
        await api.post("/auth/reset-password", { challengeId: challenge.challengeId, code, newPassword: password });
        setPassword(""); setConfirm(""); setCode(""); setDone(true);
        setMessage("Password reset successfully. Sign in with your new password.");
      }
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Unable to reset password. Please try again.");
      if (error.response?.status === 429) setResendAt(Date.now() + (error.response.data.retryAfterSeconds || 60) * 1000);
    } finally { submitting.current = false; setBusy(false); }
  }

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Reset password</Text>
    <Text>{challenge ? `Enter the OTP sent to ${challenge.destination || "your registered contact"} and choose a new password.` : "Enter your registered mobile number or email to receive a verification OTP."}</Text>
    {!done && (!challenge ? <TextInput style={styles.input} accessibilityLabel="Registered mobile or email" placeholder="Mobile number or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} editable={!busy} /> : <>
      <TextInput style={styles.input} accessibilityLabel="Verification OTP" placeholder="6-digit OTP" value={code} onChangeText={value => setCode(value.replace(/\D/g, ""))} maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy && remaining > 0} />
      <Text>{remaining ? `OTP expires in ${remaining}s` : "OTP expired. Request a new code."}</Text>
      <TextInput style={styles.input} accessibilityLabel="New password" placeholder="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy} />
      <TextInput style={styles.input} accessibilityLabel="Confirm new password" placeholder="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy} />
      <TouchableOpacity accessibilityRole="button" disabled={busy || resendWait > 0} onPress={() => submit(true)}><Text style={styles.link}>{resendWait ? `Resend OTP in ${resendWait}s` : "Resend OTP"}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setChallenge(null); setCode(""); setMessage(""); }}><Text style={styles.link}>Use another mobile number or email</Text></TouchableOpacity>
    </>)}
    {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    {!done && <TouchableOpacity accessibilityRole="button" disabled={busy || (!!challenge && remaining === 0) || (!challenge && resendWait > 0)} style={styles.button} onPress={() => submit()}><Text style={styles.buttonText}>{busy ? "Please wait…" : challenge ? "Verify OTP & reset password" : "Send OTP"}</Text></TouchableOpacity>}
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => router.replace("/(auth)/login")}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", color: "#03456C" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, padding: 15, fontSize: 16 },
  button: { backgroundColor: "#03456C", borderRadius: 12, padding: 16, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "700" },
  link: { color: "#03456C", paddingVertical: 8 },
});
