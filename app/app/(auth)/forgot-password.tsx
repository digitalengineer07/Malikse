import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useIsFocused, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../src/services/authService";

type Challenge = { challengeId: string; destination?: string; expiresInSeconds: number; resendAfterSeconds: number };

export default function ForgotPassword() {
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [incorrectCode, setIncorrectCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const submitting = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendWait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function submit(resend = false, enteredCode = code) {
    if (submitting.current) return;
    if (challenge && !resend && !resetToken && !/^\d{6}$/.test(enteredCode)) return;
    if (!resend && resetToken && (password.length < 6 || password !== confirm)) {
      setMessage("Enter matching passwords of at least 6 characters."); return;
    }
    submitting.current = true; setBusy(true); setMessage(""); setIncorrectCode(false);
    try {
      if (!challenge || resend) {
        const response = await api.post(resend ? "/auth/forgot-password/resend" : "/auth/forgot-password",
          resend ? { challengeId: challenge?.challengeId } : { identifier: identifier.trim() });
        const next: Challenge = response.data;
        setChallenge(next); setResetToken(""); setCode(""); setPassword(""); setConfirm(""); setNow(Date.now());
        setExpiresAt(Date.now() + next.expiresInSeconds * 1000);
        setResendAt(Date.now() + next.resendAfterSeconds * 1000);
      } else if (!resetToken) {
        const { data } = await api.post<{ resetToken: string; expiresInSeconds: number }>("/auth/forgot-password/verify", {
          challengeId: challenge.challengeId, code: enteredCode,
        });
        setResetToken(data.resetToken);
        setNow(Date.now());
        setExpiresAt(Date.now() + data.expiresInSeconds * 1000);
      } else {
        await api.post("/auth/reset-password", { challengeId: challenge.challengeId, resetToken, newPassword: password });
        setResetToken("");
        setPassword(""); setConfirm(""); setCode(""); setDone(true);
      }
    } catch (error: any) {
      const response = error.response?.data;
      if (challenge && !resend && !resetToken && (
        response?.code === "INCORRECT_RESET_CODE" || response?.message === "Incorrect verification code. Please try again."
      )) {
        setIncorrectCode(true);
      } else {
        setMessage(response?.message || "Unable to reset password. Please try again.");
      }
      if (error.response?.status === 429) setResendAt(Date.now() + (error.response.data.retryAfterSeconds || 60) * 1000);
    } finally { submitting.current = false; setBusy(false); }
  }

  const backToSignIn = () => router.replace("/(auth)/login");
  const verified = Boolean(resetToken) && remaining > 0;
  const codeForm = Boolean(challenge) && !done;
  const disabled = busy || (challenge ? !verified : !identifier.trim() || resendWait > 0);
  const characterGroups = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/].filter(group => group.test(password)).length;
  const strength = password.length >= 12 && characterGroups >= 3 ? 3 : password.length >= 8 && characterGroups >= 2 ? 2 : 1;
  const strengthColor = strength === 3 ? "#087647" : strength === 2 ? "#8A5700" : "#A52D3B";
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {focused && <StatusBar style="light" />}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[{ paddingBottom: insets.bottom + 24 }, done && styles.successScroll]}>
        <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
          <View pointerEvents="none" style={[styles.sun, { top: insets.top + 4 }]} />
          <View pointerEvents="none" style={styles.ray} />
          <View style={styles.heroInner}>
            <View style={styles.brandRow}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to sign in" disabled={busy}
                onPress={backToSignIn} style={styles.back}>
                <MaterialIcons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={styles.brandLockup}>
                <Image source={require("../../assets/images/icon.png")} style={styles.logo} resizeMode="contain" accessible={false} />
                <Text style={styles.brand}>MalikSe<Text style={{ color: sun }}>.</Text></Text>
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.title}>{done ? "Password updated" : "Reset password"}</Text>
            {!done && (
              <View style={styles.recoveryProgress}>
                <Text style={styles.progressLabel}>
                  {challenge ? "Step 2 of 2 · Verify and reset your password" : "Step 1 of 2 · Request a verification code"}
                </Text>
                <View style={styles.progressTrack} accessible={false} importantForAccessibility="no">
                  <View style={[styles.progressSegment, styles.progressActive]} />
                  <View style={[styles.progressSegment, challenge && styles.progressActive]} />
                </View>
              </View>
            )}
          </View>
        </View>

        {done ? (
          <View style={styles.successArea}>
            <View style={[styles.card, styles.successCard]}>
              <View style={styles.successRing} accessible={false}>
                <View style={styles.successIcon}>
                  <MaterialIcons name="verified-user" size={40} color="#087647" accessible={false} />
                </View>
              </View>
              <Text accessibilityRole="header" style={styles.successHeading}>You’re ready to sign in</Text>
              <Text style={[styles.body, styles.successBody]}>Your new password is ready to use. Sign in to return to your MalikSe account.</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign in" style={[styles.button, styles.successButton]} onPress={backToSignIn}>
                <Text style={styles.buttonText}>Sign in</Text>
                <MaterialIcons name="arrow-forward" size={20} color={navy} accessible={false} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
        <View style={[styles.card, codeForm && styles.codeCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.icon}><MaterialIcons name="lock-outline" size={23} color={navy} /></View>
            <Text accessibilityRole="header" style={styles.heading}>{challenge ? "Verify your identity" : "Get a verification code"}</Text>
          </View>
          <Text style={styles.body}>{challenge
            ? `Enter the code sent to ${challenge.destination || "your verified contact"} and choose a new password.`
            : "Enter the mobile number or email registered with your MalikSe account."}</Text>

          {!challenge ? (
            <View style={styles.field}>
              <Text style={styles.label}>Mobile number or email</Text>
              <TextInput style={styles.input} accessibilityLabel="Registered mobile or email" placeholder="Mobile number or email"
                placeholderTextColor={muted} value={identifier} onChangeText={value => { setIdentifier(value); setMessage(""); }} autoComplete="username"
                autoCapitalize="none" autoCorrect={false} editable={!busy} returnKeyType="go"
                onSubmitEditing={() => { if (!disabled) void submit(); }} />
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Verification code</Text>
                <View style={[styles.input, styles.codeField, styles.otpRow, verified && styles.otpVerified, incorrectCode && styles.otpIncorrect]}>
                <TextInput style={styles.otpInput} accessibilityLabel="Verification OTP" placeholder="6-digit OTP"
                  placeholderTextColor={muted} value={code} onChangeText={value => {
                    const digits = value.replace(/\D/g, "").slice(0, 6);
                    setIncorrectCode(false);
                    setCode(digits);
                    if (digits.length === 6 && remaining > 0) void submit(false, digits);
                  }}
                  maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy && !resetToken && remaining > 0} />
                  {verified && <MaterialIcons name="check-circle" color="#087647" size={22} accessible={false} />}
                  {incorrectCode && <MaterialIcons name="cancel" color="#A52D3B" size={22} accessible={false} />}
                </View>
                <Text accessibilityRole={incorrectCode ? "alert" : undefined} accessibilityLiveRegion="polite"
                  style={[styles.codeStatus, verified && styles.verifiedText, (incorrectCode || !remaining) && styles.error]}>
                  {incorrectCode ? "Incorrect code. Please try again." : verified ? "Code verified" : remaining ? `Code expires in ${remaining}s` : "Code expired. Request a new one."}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>New password</Text>
                <TextInput style={[styles.input, styles.codeField, !verified && styles.lockedInput]} accessibilityLabel="New password" placeholder="At least 6 characters"
                  placeholderTextColor={muted} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
                  autoComplete="new-password" editable={!busy && verified} />
                {verified && !!password && (
                  <View style={styles.field}>
                    <View style={styles.strengthTrack} accessible={false}>
                      {[1, 2, 3].map(level => <View key={level} style={[styles.strengthSegment, level <= strength && { backgroundColor: strengthColor }]} />)}
                    </View>
                    <Text accessibilityLiveRegion="polite" style={[styles.body, { color: strengthColor }]}>
                      Password strength: {strength === 3 ? "Strong" : strength === 2 ? "Fair" : "Weak"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm new password</Text>
                <TextInput style={[styles.input, styles.codeField, !verified && styles.lockedInput]} accessibilityLabel="Confirm new password" placeholder="Re-enter your password"
                  placeholderTextColor={muted} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none"
                  autoComplete="new-password" editable={!busy && verified} />
              </View>
              {(!resetToken || remaining === 0) && <TouchableOpacity accessibilityRole="button" disabled={busy || resendWait > 0} onPress={() => void submit(true)} style={styles.linkButton}>
                <Text style={[styles.link, (busy || resendWait > 0) && styles.mutedLink]}>{resendWait ? `Resend code in ${resendWait}s` : "Resend code"}</Text>
              </TouchableOpacity>}
            </>
          )}

          {!!message && (
            <View style={styles.warning}>
              <MaterialIcons name="error-outline" size={20} color="#A52D3B" accessible={false} />
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert"
                style={[styles.body, styles.warningText]}>{message}</Text>
            </View>
          )}
              <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled}
                style={[styles.button, disabled && styles.disabled]} onPress={() => void submit()}>
                {busy && <ActivityIndicator color={navy} />}
                <Text style={styles.buttonText}>{challenge ? "Reset password" : busy ? "Please wait…" : "Send verification code"}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.linkButton}
                onPress={challenge ? () => { setChallenge(null); setResetToken(""); setCode(""); setPassword(""); setConfirm(""); setMessage(""); } : backToSignIn}>
                <Text style={styles.link}>{challenge ? "Use another mobile number or email" : "Back to sign in"}</Text>
              </TouchableOpacity>
        </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const navy = "#14263E";
const sun = "#FCC61C";
const cream = "#F7F4EC";
const muted = "#536174";
const border = "rgba(20,38,62,0.16)";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cream },
  hero: { backgroundColor: navy, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden", paddingHorizontal: 20, paddingBottom: 34 },
  heroInner: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 16 },
  sun: { position: "absolute", width: 138, height: 138, borderRadius: 69, right: -66, backgroundColor: sun },
  ray: { position: "absolute", width: 74, height: 210, borderRadius: 40, right: 62, top: 70, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }] },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 36, height: 36 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#244268" },
  brand: { fontFamily: "Fraunces", fontSize: 25, color: "#fff" },
  title: { fontFamily: "Fraunces", fontSize: 32, lineHeight: 40, color: "#fff" },
  recoveryProgress: { gap: 8, alignItems: "center", marginTop: -4 },
  progressLabel: { fontFamily: "ManropeBold", fontSize: 13, color: "#F7F4EC", textAlign: "center" },
  progressTrack: { flexDirection: "row", gap: 5, width: 112 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#536174" },
  progressActive: { backgroundColor: sun },
  card: { width: "90%", maxWidth: 440, alignSelf: "center", marginTop: -14, padding: 20, gap: 14, borderColor: border, borderWidth: 1, borderRadius: 22, backgroundColor: "#fff", shadowColor: navy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 3 },
  codeCard: { gap: 12 },
  successScroll: { flexGrow: 1 },
  successArea: { flexGrow: 1, justifyContent: "center", paddingVertical: 24 },
  successCard: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 30, marginTop: 0, gap: 14 },
  successRing: { width: 104, height: 104, borderRadius: 52, backgroundColor: "#E6F4EC", borderWidth: 1, borderColor: "#CAE8D7", alignItems: "center", justifyContent: "center" },
  successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  successHeading: { fontFamily: "Fraunces", color: navy, fontSize: 26, lineHeight: 32, textAlign: "center" },
  successBody: { textAlign: "center", maxWidth: 290 },
  successButton: { alignSelf: "stretch", marginTop: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0" },
  heading: { flex: 1, fontFamily: "Fraunces", fontSize: 21, color: navy },
  body: { fontFamily: "Manrope", color: muted, fontSize: 14, lineHeight: 21 },
  field: { gap: 6 },
  strengthTrack: { flexDirection: "row", gap: 5 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#DEDCD3" },
  label: { fontFamily: "ManropeBold", fontSize: 14, color: navy },
  input: { minHeight: 52, borderWidth: 1, borderColor: border, borderRadius: 16, padding: 13, fontFamily: "Manrope", fontSize: 16, color: navy },
  codeField: { minHeight: 46, paddingVertical: 9 },
  codeStatus: { fontFamily: "Manrope", color: muted, fontSize: 12, lineHeight: 16 },
  otpRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 0 },
  otpInput: { flex: 1, minWidth: 0, minHeight: 44, fontFamily: "Manrope", fontSize: 16, color: navy, paddingVertical: 8 },
  otpVerified: { borderColor: "#087647" },
  otpIncorrect: { borderColor: "#A52D3B" },
  verifiedText: { color: "#087647" },
  lockedInput: { backgroundColor: "#FBFAF8" },
  button: { backgroundColor: sun, borderRadius: 26, minHeight: 52, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: navy, fontFamily: "ManropeExtraBold", textAlign: "center", fontSize: 14 },
  linkButton: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  link: { color: navy, fontFamily: "ManropeBold", textAlign: "center" },
  mutedLink: { color: muted },
  disabled: { opacity: 0.55 },
  error: { color: "#A52D3B" },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 12, backgroundColor: "#FCEBEC" },
  warningText: { flex: 1, color: "#A52D3B" },
});
