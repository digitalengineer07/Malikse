import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { authService, type RegisterResponse } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import AppHeader from "./AppHeader";
import WebFooter from "./WebFooter";
import PasswordStrengthIndicator, { evaluatePasswordStrength } from "./PasswordStrengthIndicator";

interface AccountAuthScreenProps {
  mode: "login" | "register";
}

export default function AccountAuthScreen({ mode }: AccountAuthScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">(mode);
  const isRegister = activeTab === "register";
  const isForgot = activeTab === "forgot";

  const { user, authState, hydrated } = useAuthStore();
  const { language } = useLanguageStore();
  const label = (en: string, hi: string) => (language === "hi" ? hi : en);

  // Form Fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const submitting = useRef(false);

  // Sign In: Mobile or Email method
  const [loginMethod, setLoginMethod] = useState<"mobile" | "email">("mobile");
  const [loginEmail, setLoginEmail] = useState("");

  // Registration: Mobile or Email method and 2-step OTP verification flow
  const [registerMethod, setRegisterMethod] = useState<"mobile" | "email">("mobile");
  const [registrationStep, setRegistrationStep] = useState<"details" | "otp">("details");
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    channel?: "mobile" | "email";
    expiresAt: number;
    resendAt: number;
    stubCode?: string;
  } | null>(null);
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Forgot Password Flow
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [forgotMethod, setForgotMethod] = useState<"mobile" | "email">("mobile");
  const [forgotMobile, setForgotMobile] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [showForgotOtp, setShowForgotOtp] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotChallenge, setForgotChallenge] = useState<{
    challengeId: string;
    expiresAt: number;
    resendAt: number;
    destination?: string;
    stubCode?: string;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expireSecondsLeft = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0;
  const resendSecondsLeft = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0;

  const forgotExpireSecondsLeft = forgotChallenge
    ? Math.max(0, Math.ceil((forgotChallenge.expiresAt - now) / 1000))
    : 0;
  const forgotResendSecondsLeft = forgotChallenge
    ? Math.max(0, Math.ceil((forgotChallenge.resendAt - now) / 1000))
    : 0;

  const handleTabSwitch = (tab: "login" | "register" | "forgot") => {
    setActiveTab(tab);
    setError("");
    setSuccessMessage("");
    setShowPassword(false);
    setShowOtp(false);
    setShowForgotOtp(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setRegistrationStep("details");
    setChallenge(null);
    setOtp("");

    if (tab === "register" && loginMethod === "email" && loginEmail.trim() && !email.trim()) {
      setEmail(loginEmail.trim());
      setRegisterMethod("email");
    } else if (tab === "login" && registerMethod === "email" && email.trim() && !loginEmail.trim()) {
      setLoginEmail(email.trim());
      setLoginMethod("email");
    }

    if (tab !== "forgot") {
      setForgotStep("request");
      setForgotChallenge(null);
      setForgotOtp("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleResendOtp = async () => {
    if (loading || resendSecondsLeft > 0) return;
    setError("");
    setLoading(true);
    try {
      const cleanMobile = mobile.trim().replace(/\D/g, "");
      const cleanEmail = email.trim().toLowerCase();
      const res = await authService.register({
        name: name.trim(),
        mobile: cleanMobile || undefined,
        email: cleanEmail || undefined,
        password,
        method: registerMethod,
      });
      const currentTime = Date.now();
      setChallenge({
        challengeId: res.challengeId,
        channel: res.channel || registerMethod,
        expiresAt: currentTime + (res.expiresInSeconds || 120) * 1000,
        resendAt: currentTime + (res.resendAfterSeconds || 60) * 1000,
        stubCode: res.stubCode,
      });
      if (res.stubCode) {
        setOtp(res.stubCode);
      }
    } catch (cause: any) {
      setError(
        cause?.response?.data?.message ||
          label("Unable to resend OTP. Please try again.", "OTP फिर से नहीं भेजा जा सका। कृपया पुनः प्रयास करें।")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendForgotOtp = async () => {
    if (loading || forgotResendSecondsLeft > 0 || !forgotChallenge) return;
    setError("");
    setLoading(true);
    try {
      const res = await authService.resendPasswordReset(forgotChallenge.challengeId);
      const currentTime = Date.now();
      setForgotChallenge({
        challengeId: res.challengeId,
        expiresAt: currentTime + (res.expiresInSeconds || 120) * 1000,
        resendAt: currentTime + (res.resendAfterSeconds || 60) * 1000,
        destination: res.destination || forgotChallenge.destination,
        stubCode: res.stubCode,
      });
      if (res.stubCode) {
        setForgotOtp(res.stubCode);
      }
      setSuccessMessage(
        label(
          "A new verification OTP has been sent.",
          "एक नया सत्यापन OTP भेज दिया गया है।"
        )
      );
    } catch (cause: any) {
      setError(
        cause?.response?.data?.message ||
          label("Unable to resend OTP. Please try again.", "OTP फिर से नहीं भेजा जा सका। कृपया पुनः प्रयास करें।")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting.current) return;
    setError("");
    setSuccessMessage("");

    if (isForgot) {
      if (forgotStep === "request") {
        let identifier = "";
        if (forgotMethod === "mobile") {
          const cleanMobile = forgotMobile.trim().replace(/\D/g, "");
          if (!/^[0-9]{10}$/.test(cleanMobile)) {
            setError(
              label(
                "Please enter a valid 10-digit registered mobile number.",
                "कृपया सही 10 अंकों का पंजीकृत मोबाइल नंबर दर्ज करें।"
              )
            );
            return;
          }
          identifier = cleanMobile;
        } else {
          if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
            setError(
              label(
                "Please enter a valid registered email address.",
                "कृपया सही पंजीकृत ईमेल पता दर्ज करें।"
              )
            );
            return;
          }
          identifier = forgotEmail.trim().toLowerCase();
        }

        submitting.current = true;
        setLoading(true);
        try {
          const res = await authService.requestPasswordReset(identifier);
          const currentTime = Date.now();
          setForgotChallenge({
            challengeId: res.challengeId,
            expiresAt: currentTime + (res.expiresInSeconds || 120) * 1000,
            resendAt: currentTime + (res.resendAfterSeconds || 60) * 1000,
            destination: res.destination,
            stubCode: res.stubCode,
          });
          if (res.stubCode) {
            setForgotOtp(res.stubCode);
          }
          setForgotStep("verify");
          setSuccessMessage(
            label(
              `Verification code sent to ${res.destination || "your mobile/email"}.`,
              `सत्यापन कोड ${res.destination || "आपके मोबाइल/ईमेल"} पर भेजा गया है।`
            )
          );
        } catch (cause: any) {
          setError(
            cause?.response?.data?.message ||
              label(
                "Unable to send password reset code. Please check your credentials.",
                "पासवर्ड रीसेट कोड नहीं भेजा जा सका। कृपया अपना विवरण जांचें।"
              )
          );
        } finally {
          submitting.current = false;
          setLoading(false);
        }
        return;
      }

      // forgotStep === "verify"
      const cleanForgotOtp = forgotOtp.replace(/\D/g, "").slice(0, 6);
      if (cleanForgotOtp.length !== 6) {
        setError(
          label(
            "Please enter the 6-digit OTP sent to your registered mobile/email.",
            "कृपया अपने पंजीकृत मोबाइल/ईमेल पर भेजा गया 6 अंकों का OTP दर्ज करें।"
          )
        );
        return;
      }

      if (newPassword.length < 6) {
        setError(
          label(
            "New password must be at least 6 characters long.",
            "नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"
          )
        );
        return;
      }

      const resetStrength = evaluatePasswordStrength(newPassword, {
        mobile: forgotMobile || forgotChallenge?.destination,
        email: forgotEmail,
      });
      if (resetStrength.isTrivial) {
        setError(
          resetStrength.warningEn
            ? label(resetStrength.warningEn, resetStrength.warningHi || "")
            : label("Password is too simple. Avoid common words or phone numbers.", "पासवर्ड बहुत सरल है। सामान्य शब्दों या फ़ोन नंबर से बचें।")
        );
        return;
      }

      if (newPassword !== confirmPassword) {
        setError(
          label(
            "Passwords do not match. Please re-enter.",
            "पासवर्ड मेल नहीं खाते। कृपया पुनः दर्ज करें।"
          )
        );
        return;
      }

      if (!forgotChallenge) {
        setError(
          label(
            "Password reset session expired. Please request a new code.",
            "पासवर्ड रीसेट सत्र समाप्त हो गया। कृपया नया कोड मांगें।"
          )
        );
        setForgotStep("request");
        return;
      }

      submitting.current = true;
      setLoading(true);

      try {
        await authService.resetPassword(forgotChallenge.challengeId, cleanForgotOtp, newPassword);
        setSuccessMessage(
          label(
            "Password reset successfully! Signing you in...",
            "पासवर्ड सफलतापूर्वक रीसेट हो गया! साइन इन किया जा रहा है..."
          )
        );
        setTimeout(() => {
          router.replace("/home");
        }, 1200);
      } catch (cause: any) {
        setError(
          cause?.response?.data?.message ||
            label(
              "Password reset failed. Please check the OTP and try again.",
              "पासवर्ड रीसेट विफल रहा। कृपया OTP जांचें और पुनः प्रयास करें।"
            )
        );
      } finally {
        submitting.current = false;
        setLoading(false);
      }
      return;
    }

    if (isRegister) {
      if (registrationStep === "details") {
        if (name.trim().length < 2) {
          setError(
            label(
              "Please enter your full name (at least 2 characters).",
              "कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।"
            )
          );
          return;
        }

        const cleanMobile = mobile.trim().replace(/\D/g, "");
        const cleanEmail = email.trim().toLowerCase();

        if (registerMethod === "mobile") {
          if (!/^[0-9]{10}$/.test(cleanMobile)) {
            setError(
              label(
                "Please enter a valid 10-digit mobile number.",
                "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।"
              )
            );
            return;
          }

          if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setError(
              label(
                "Please enter a valid email address or leave it blank.",
                "कृपया सही ईमेल पता दर्ज करें या इसे खाली छोड़ दें।"
              )
            );
            return;
          }
        } else {
          // registerMethod === "email"
          if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setError(
              label(
                "Please enter a valid email address.",
                "कृपया सही ईमेल पता दर्ज करें।"
              )
            );
            return;
          }

          if (cleanMobile && !/^[0-9]{10}$/.test(cleanMobile)) {
            setError(
              label(
                "Please enter a valid 10-digit mobile number or leave it blank.",
                "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें या इसे खाली छोड़ दें।"
              )
            );
            return;
          }
        }

        if (password.length < 6) {
          setError(
            label(
              "Password must be at least 6 characters long.",
              "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"
            )
          );
          return;
        }

        const regStrength = evaluatePasswordStrength(password, { name, mobile: cleanMobile, email: cleanEmail });
        if (regStrength.isTrivial) {
          setError(
            regStrength.warningEn
              ? label(regStrength.warningEn, regStrength.warningHi || "")
              : label("Password is too simple. Avoid common words or phone numbers.", "पासवर्ड बहुत सरल है। सामान्य शब्दों या फ़ोन नंबर से बचें।")
          );
          return;
        }

        submitting.current = true;
        setLoading(true);

        try {
          const res = await authService.register({
            name: name.trim(),
            mobile: cleanMobile || undefined,
            email: cleanEmail || undefined,
            password,
            method: registerMethod,
          });
          const currentTime = Date.now();
          setChallenge({
            challengeId: res.challengeId,
            channel: res.channel || registerMethod,
            expiresAt: currentTime + (res.expiresInSeconds || 120) * 1000,
            resendAt: currentTime + (res.resendAfterSeconds || 60) * 1000,
            stubCode: res.stubCode,
          });
          if (res.stubCode) {
            setOtp(res.stubCode);
          }
          setRegistrationStep("otp");
        } catch (cause: any) {
          const serverMsg = cause?.response?.data?.message;
          setError(
            serverMsg ||
              label(
                "Unable to send verification code. Please check your credentials.",
                "सत्यापन कोड नहीं भेजा जा सका। कृपया विवरण जांचें।"
              )
          );
        } finally {
          submitting.current = false;
          setLoading(false);
        }
        return;
      }

      // Registration Step: OTP
      const cleanOtp = otp.replace(/\D/g, "").slice(0, 6);
      if (cleanOtp.length !== 6) {
        setError(
          label(
            registerMethod === "email"
              ? "Please enter the 6-digit OTP sent to your email."
              : "Please enter the 6-digit OTP sent to your mobile.",
            registerMethod === "email"
              ? "कृपया अपने ईमेल पर भेजा गया 6 अंकों का OTP दर्ज करें।"
              : "कृपया अपने मोबाइल पर भेजा गया 6 अंकों का OTP दर्ज करें।"
          )
        );
        return;
      }

      if (!challenge) {
        setError(
          label(
            "Verification session expired. Please request a new code.",
            "सत्यापन सत्र समाप्त हो गया। कृपया नया कोड मांगें।"
          )
        );
        setRegistrationStep("details");
        return;
      }

      submitting.current = true;
      setLoading(true);

      try {
        const cleanMobile = mobile.trim().replace(/\D/g, "").slice(0, 10);
        const cleanEmail = email.trim().toLowerCase();
        const channel = challenge.channel || registerMethod;
        const identifier = (channel === "email" && cleanEmail) ? cleanEmail : cleanMobile;
        await authService.verifyRegistration(identifier, challenge.challengeId, cleanOtp);
        router.replace("/home");
      } catch (cause: any) {
        const serverMsg = cause?.response?.data?.message;
        setError(
          serverMsg ||
            label(
              "Incorrect OTP or verification failed. Please try again.",
              "गलत OTP या सत्यापन विफल रहा। कृपया पुनः प्रयास करें।"
            )
        );
      } finally {
        submitting.current = false;
        setLoading(false);
      }
      return;
    }

    // Sign In (Login) Flow
    let identifier = "";
    if (loginMethod === "mobile") {
      const cleanMobile = mobile.trim().replace(/\D/g, "");
      if (!/^[0-9]{10}$/.test(cleanMobile)) {
        setError(
          label(
            "Please enter a valid 10-digit mobile number.",
            "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।"
          )
        );
        return;
      }
      identifier = cleanMobile;
    } else {
      if (!loginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
        setError(
          label(
            "Please enter a valid email address.",
            "कृपया सही ईमेल पता दर्ज करें।"
          )
        );
        return;
      }
      identifier = loginEmail.trim().toLowerCase();
    }

    if (password.length < 6) {
      setError(
        label(
          "Password must be at least 6 characters long.",
          "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।"
        )
      );
      return;
    }

    submitting.current = true;
    setLoading(true);

    try {
      await authService.login(identifier, password);
      router.replace("/home");
    } catch (cause: any) {
      const serverMsg = cause?.response?.data?.message;
      setError(
        serverMsg ||
          label(
            "Invalid credentials. Please check your details and password.",
            "अमान्य विवरण। कृपया अपना मोबाइल/ईमेल और पासवर्ड जांचें।"
          )
      );
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#03456C" />
      </View>
    );
  }

  if (authState === "AUTHENTICATED" && user) {
    return <Redirect href="/home" />;
  }

  return (
    <View style={styles.screen}>
      {/* Universal Website Header matching Home and Explore */}
      <AppHeader showBack={false} />

      <KeyboardAvoidingView
        style={styles.keyboardScreen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Main Website Container - Same width (1340px) as Home & Explore */}
          <View style={styles.content}>
            {/* Main Dual-Pane Auth Card */}
            <View style={styles.authCardWrapper}>
              <View style={[styles.authCard, { flexDirection: isDesktop ? "row" : "column" }]}>
                {/* Left Showcase & Trust Pane (Desktop Only) */}
                {isDesktop && (
                  <View style={styles.leftPane}>
                    <Image
                      source={{
                        uri: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
                      }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    <View style={styles.leftPaneOverlay} />

                    <View style={styles.leftPaneContent}>
                      <View>
                        <View style={styles.leftBadge}>
                          <MaterialIcons name="verified" size={13} color="#38BDF8" />
                          <Text style={styles.leftBadgeText}>
                            BIHAR'S #1 VERIFIED PROPERTY PORTAL
                          </Text>
                        </View>

                        <Text style={styles.leftHeading}>
                          {label(
                            "Direct deals.\nVerified titles.\nZero brokerage.",
                            "सीधे सौदे।\nसत्यापित ज़मीन।\nशून्य ब्रोकरेज।"
                          )}
                        </Text>

                        <Text style={styles.leftSubtext}>
                          {label(
                            "Search, verify, and close dispute-free property deals across all 38 districts of Bihar.",
                            "बिहार के सभी 38 जिलों में बिना किसी विवाद के सीधे सौदे करें।"
                          )}
                        </Text>

                        {/* 3 Pillar Highlights */}
                        <View style={styles.pillarsList}>
                          <View style={styles.pillarItem}>
                            <View style={styles.pillarIconBox}>
                              <MaterialIcons name="account-balance" size={18} color="#38BDF8" />
                            </View>
                            <View style={styles.pillarTextBox}>
                              <Text style={styles.pillarTitle}>
                                {label("Circle Office Revenue Audit", "अंचल कार्यालय राजस्व जांच")}
                              </Text>
                              <Text style={styles.pillarDesc}>
                                {label("Jamabandi, Khatiyan & LPC legal verification", "जमाबंदी, खतियान व एलपीसी का कानूनी सत्यापन")}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.pillarItem}>
                            <View style={styles.pillarIconBox}>
                              <MaterialIcons name="gps-fixed" size={18} color="#34D399" />
                            </View>
                            <View style={styles.pillarTextBox}>
                              <Text style={styles.pillarTitle}>
                                {label("GPS Boundary Demarcation", "जीपीएस सीमांकन")}
                              </Text>
                              <Text style={styles.pillarDesc}>
                                {label("Physical coordinates with surveyor pegs", "अमीन द्वारा मौके पर पैमाइश व सैटेलाइट मैपिंग")}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.pillarItem}>
                            <View style={styles.pillarIconBox}>
                              <MaterialIcons name="handshake" size={18} color="#FBBF24" />
                            </View>
                            <View style={styles.pillarTextBox}>
                              <Text style={styles.pillarTitle}>
                                {label("₹0 Brokerage Direct Deals", "शून्य ब्रोकरेज सीधे सौदे")}
                              </Text>
                              <Text style={styles.pillarDesc}>
                                {label("Connect directly with genuine title holders", "सीधे असली ज़मीन मालिकों से संपर्क करें")}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Bottom Trust Guarantee Strip */}
                      <View style={styles.leftTrustFooter}>
                        <MaterialIcons name="security" size={16} color="#38BDF8" />
                        <Text style={styles.leftTrustText}>
                          {label(
                            "100% Legal-Checked · 38 Districts · ₹0 Brokerage",
                            "100% कानूनी जांच · 38 जिले · 0% ब्रोकरेज"
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Right Form Pane */}
                <View style={[styles.rightPane, { width: isDesktop ? "54%" : "100%" }]}>
                  {/* Segmented Tab Pill Selector */}
                  {/* Segmented Tab Pill Selector OR Forgot Password Header */}
                  {isForgot ? (
                    <View style={styles.forgotHeaderRow}>
                      <TouchableOpacity
                        style={styles.backToSignInBtn}
                        onPress={() => handleTabSwitch("login")}
                        activeOpacity={0.75}
                      >
                        <MaterialIcons name="arrow-back" size={16} color="#03456C" />
                        <Text style={styles.backToSignInBtnText}>
                          {label("Back to Sign In", "साइन इन पर वापस जाएं")}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.forgotBadge}>
                        <MaterialIcons name="lock-reset" size={14} color="#0284C7" />
                        <Text style={styles.forgotBadgeText}>
                          {label("Password Recovery", "पासवर्ड रिकवरी")}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.tabSelector}>
                      <TouchableOpacity
                        style={[styles.tabButton, !isRegister && styles.tabButtonActive]}
                        onPress={() => handleTabSwitch("login")}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tabButtonText, !isRegister && styles.tabButtonTextActive]}>
                          {label("Sign In", "साइन इन")}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.tabButton, isRegister && styles.tabButtonActive]}
                        onPress={() => handleTabSwitch("register")}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.tabButtonText, isRegister && styles.tabButtonTextActive]}>
                          {label("Create Account", "नया खाता बनाएं")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Form Heading */}
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>
                      {isForgot
                        ? forgotStep === "verify"
                          ? label("Reset Your Password", "नया पासवर्ड बनाएं")
                          : label("Forgot Password?", "पासवर्ड भूल गए?")
                        : isRegister
                        ? registrationStep === "otp"
                          ? registerMethod === "email"
                            ? label("Verify Your Email Address", "ईमेल पता सत्यापित करें")
                            : label("Verify Your Mobile Number", "मोबाइल नंबर सत्यापित करें")
                          : label("Create your account", "अपना खाता बनाएं")
                        : label("Welcome back", "वापस स्वागत है")}
                    </Text>
                    <Text style={styles.formSubtitle}>
                      {isForgot
                        ? forgotStep === "verify"
                          ? label(
                              forgotChallenge?.destination
                                ? `Enter the 6-digit OTP sent to ${forgotChallenge.destination} and choose your new password.`
                                : "Enter the 6-digit OTP and choose your new password.",
                              forgotChallenge?.destination
                                ? `${forgotChallenge.destination} पर भेजा गया 6 अंकों का OTP और नया पासवर्ड दर्ज करें।`
                                : "6 अंकों का OTP और नया पासवर्ड दर्ज करें।"
                            )
                          : label(
                              "Enter your registered mobile number or email. We'll send an OTP to securely reset your password.",
                              "अपना पंजीकृत मोबाइल नंबर या ईमेल दर्ज करें। पासवर्ड सुरक्षित रूप से बदलने के लिए हम एक OTP भेजेंगे।"
                            )
                        : isRegister
                        ? registrationStep === "otp"
                          ? registerMethod === "email"
                            ? label(
                                `We've sent a 6-digit verification code to ${email.trim()}`,
                                `हमने ${email.trim()} पर 6 अंकों का सत्यापन कोड भेजा है`
                              )
                            : label(
                                `We've sent a 6-digit verification code to +91 ${mobile.trim()}`,
                                `हमने +91 ${mobile.trim()} पर 6 अंकों का सत्यापन कोड भेजा है`
                              )
                          : label(
                              "Join Bihar's verified property platform in 60 seconds.",
                              "बिहार के सबसे भरोसेमंद रियल एस्टेट पोर्टल से जुड़ें।"
                            )
                        : label(
                            "Sign in with your mobile number or registered email.",
                            "अपने 10 अंकों के मोबाइल नंबर या पंजीकृत ईमेल से साइन इन करें।"
                          )}
                    </Text>
                  </View>

                  {/* Success Banner */}
                  {!!successMessage && (
                    <View style={styles.successBox}>
                      <MaterialIcons name="check-circle" size={18} color="#15803D" />
                      <Text style={styles.successText}>{successMessage}</Text>
                    </View>
                  )}

                  {/* Error Banner */}
                  {!!error && (
                    <View style={styles.errorBox}>
                      <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* Input Fields */}
                  <View style={styles.fieldsContainer}>
                    {/* FORGOT PASSWORD FLOW */}
                    {isForgot ? (
                      forgotStep === "request" ? (
                        <>
                          {/* METHOD SWITCHER (Mobile vs Email for password reset) */}
                          <View style={styles.methodToggleRow}>
                            <TouchableOpacity
                              style={[styles.methodPill, forgotMethod === "mobile" && styles.methodPillActive]}
                              onPress={() => {
                                setForgotMethod("mobile");
                                setError("");
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="phone-iphone"
                                size={14}
                                color={forgotMethod === "mobile" ? "#03456C" : "#64748B"}
                              />
                              <Text style={[styles.methodPillText, forgotMethod === "mobile" && styles.methodPillTextActive]}>
                                {label("Mobile Number", "मोबाइल नंबर")}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.methodPill, forgotMethod === "email" && styles.methodPillActive]}
                              onPress={() => {
                                setForgotMethod("email");
                                setError("");
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="mail-outline"
                                size={14}
                                color={forgotMethod === "email" ? "#03456C" : "#64748B"}
                              />
                              <Text style={[styles.methodPillText, forgotMethod === "email" && styles.methodPillTextActive]}>
                                {label("Email Address", "ईमेल पता")}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Input Field: Mobile */}
                          {forgotMethod === "mobile" && (
                            <View style={styles.fieldGroup}>
                              <Text style={styles.fieldLabel}>
                                {label("Registered Mobile Number", "पंजीकृत मोबाइल नंबर")}{" "}
                                <Text style={styles.requiredStar}>*</Text>
                              </Text>
                              <View style={styles.inputWrap}>
                                <View style={styles.countryCodeBadge}>
                                  <Text style={styles.countryCodeText}>+91</Text>
                                </View>
                                <TextInput
                                  style={[styles.textInput, styles.phoneInput]}
                                  value={forgotMobile}
                                  onChangeText={(t) => setForgotMobile(t.replace(/\D/g, "").slice(0, 10))}
                                  editable={!loading}
                                  placeholder={label("10-digit mobile number", "10 अंकों का मोबाइल नंबर")}
                                  placeholderTextColor="#94A3B8"
                                  keyboardType="phone-pad"
                                  maxLength={10}
                                  autoComplete="tel"
                                  autoFocus
                                  onSubmitEditing={handleSubmit}
                                  returnKeyType="go"
                                />
                              </View>
                            </View>
                          )}

                          {/* Input Field: Email */}
                          {forgotMethod === "email" && (
                            <View style={styles.fieldGroup}>
                              <Text style={styles.fieldLabel}>
                                {label("Registered Email Address", "पंजीकृत ईमेल पता")}{" "}
                                <Text style={styles.requiredStar}>*</Text>
                              </Text>
                              <View style={styles.inputWrap}>
                                <MaterialIcons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                  style={styles.textInput}
                                  value={forgotEmail}
                                  onChangeText={setForgotEmail}
                                  editable={!loading}
                                  placeholder={label("e.g. name@example.com", "उदा. name@example.com")}
                                  placeholderTextColor="#94A3B8"
                                  keyboardType="email-address"
                                  autoCapitalize="none"
                                  autoCorrect={false}
                                  autoComplete="email"
                                  autoFocus
                                  onSubmitEditing={handleSubmit}
                                  returnKeyType="go"
                                />
                              </View>
                            </View>
                          )}
                        </>
                      ) : (
                        /* forgotStep === "verify" */
                        <View style={styles.otpStepContainer}>
                          {forgotChallenge?.stubCode && (
                            <View style={styles.stubNoticeBox}>
                              <MaterialIcons name="verified-user" size={16} color="#03456C" />
                              <Text style={styles.stubNoticeText}>
                                {label(
                                  showForgotOtp
                                    ? `Dev OTP: ${forgotChallenge.stubCode} (auto-filled)`
                                    : "Verification code auto-filled (••••••)",
                                  showForgotOtp
                                    ? `डेमो OTP: ${forgotChallenge.stubCode} (स्वतः भरा गया)`
                                    : "सत्यापन कोड स्वतः भरा गया (••••••)"
                                )}
                              </Text>
                            </View>
                          )}

                          {/* 6-digit OTP (Masked with dots, eye toggle) */}
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("6-Digit Verification Code (OTP)", "6 अंकों का सत्यापन कोड (OTP)")}{" "}
                              <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="vpn-key" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={[styles.textInput, styles.otpTextInput, { paddingRight: 48 }]}
                                value={forgotOtp}
                                onChangeText={(t) => setForgotOtp(t.replace(/\D/g, "").slice(0, 6))}
                                editable={!loading && forgotExpireSecondsLeft > 0}
                                placeholder="• • • • • •"
                                placeholderTextColor="#94A3B8"
                                keyboardType="number-pad"
                                maxLength={6}
                                secureTextEntry={!showForgotOtp}
                                autoFocus
                                onSubmitEditing={handleSubmit}
                                returnKeyType="next"
                              />
                              <TouchableOpacity
                                style={styles.eyeBtn}
                                onPress={() => setShowForgotOtp(!showForgotOtp)}
                                activeOpacity={0.7}
                                accessibilityLabel={showForgotOtp ? "Hide OTP" : "Show OTP"}
                              >
                                <MaterialIcons
                                  name={showForgotOtp ? "visibility-off" : "visibility"}
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>

                            <View style={styles.otpMetaRow}>
                              <Text style={styles.otpTimerText}>
                                {forgotExpireSecondsLeft > 0
                                  ? label(
                                      `Code expires in ${forgotExpireSecondsLeft}s`,
                                      `सत्यापन कोड ${forgotExpireSecondsLeft}s में समाप्त होगा`
                                    )
                                  : label("Code expired. Please request a new code.", "कोड समाप्त हो गया। नया कोड मांगें।")}
                              </Text>

                              <TouchableOpacity
                                onPress={handleResendForgotOtp}
                                disabled={loading || forgotResendSecondsLeft > 0}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.resendLink,
                                    (loading || forgotResendSecondsLeft > 0) && styles.resendLinkDisabled,
                                  ]}
                                >
                                  {forgotResendSecondsLeft > 0
                                    ? label(`Resend in ${forgotResendSecondsLeft}s`, `पुनः भेजें: ${forgotResendSecondsLeft}s`)
                                    : label("Resend OTP", "OTP पुनः भेजें")}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* New Password */}
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("New Password", "नया पासवर्ड")} <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={[styles.textInput, { paddingRight: 48 }]}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                editable={!loading}
                                secureTextEntry={!showNewPassword}
                                placeholder={label("Minimum 6 characters", "कम से कम 6 अक्षर")}
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                                autoCorrect={false}
                              />
                              <TouchableOpacity
                                style={styles.eyeBtn}
                                onPress={() => setShowNewPassword(!showNewPassword)}
                                activeOpacity={0.7}
                              >
                                <MaterialIcons
                                  name={showNewPassword ? "visibility-off" : "visibility"}
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                            <PasswordStrengthIndicator
                              password={newPassword}
                              context={{
                                mobile: forgotMobile || forgotChallenge?.destination,
                                email: forgotEmail,
                              }}
                            />
                          </View>

                          {/* Confirm New Password */}
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("Confirm New Password", "नए पासवर्ड की पुष्टि करें")}{" "}
                              <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={[styles.textInput, { paddingRight: 48 }]}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                editable={!loading}
                                secureTextEntry={!showConfirmPassword}
                                placeholder={label("Re-enter new password", "नया पासवर्ड पुनः दर्ज करें")}
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                                autoCorrect={false}
                                onSubmitEditing={handleSubmit}
                                returnKeyType="go"
                              />
                              <TouchableOpacity
                                style={styles.eyeBtn}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                activeOpacity={0.7}
                              >
                                <MaterialIcons
                                  name={showConfirmPassword ? "visibility-off" : "visibility"}
                                  size={20}
                                  color="#64748B"
                                />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Change number or email button */}
                          <TouchableOpacity
                            style={styles.changeDetailsBtn}
                            onPress={() => {
                              setForgotStep("request");
                              setError("");
                              setShowForgotOtp(false);
                            }}
                            disabled={loading}
                            activeOpacity={0.75}
                          >
                            <MaterialIcons name="arrow-back" size={14} color="#03456C" />
                            <Text style={styles.changeDetailsText}>
                              {label("Change mobile number or email", "मोबाइल नंबर या ईमेल बदलें")}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )
                    ) : /* REGISTRATION STEP 2: OTP VERIFICATION */
                    isRegister && registrationStep === "otp" ? (
                      <View style={styles.otpStepContainer}>
                        {challenge?.stubCode && (
                          <View style={styles.stubNoticeBox}>
                            <MaterialIcons name="verified-user" size={16} color="#03456C" />
                            <Text style={styles.stubNoticeText}>
                              {label(
                                showOtp
                                  ? `Dev OTP: ${challenge.stubCode} (auto-filled)`
                                  : "Verification code auto-filled (••••••)",
                                showOtp
                                  ? `डेमो OTP: ${challenge.stubCode} (स्वतः भरा गया)`
                                  : "सत्यापन कोड स्वतः भरा गया (••••••)"
                              )}
                            </Text>
                          </View>
                        )}

                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>
                            {label("6-Digit Verification Code (OTP)", "6 अंकों का सत्यापन कोड (OTP)")}{" "}
                            <Text style={styles.requiredStar}>*</Text>
                          </Text>
                          <View style={styles.inputWrap}>
                            <MaterialIcons name="vpn-key" size={20} color="#64748B" style={styles.inputIcon} />
                            <TextInput
                              style={[styles.textInput, styles.otpTextInput, { paddingRight: 48 }]}
                              value={otp}
                              onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                              editable={!loading && expireSecondsLeft > 0}
                              placeholder="• • • • • •"
                              placeholderTextColor="#94A3B8"
                              keyboardType="number-pad"
                              maxLength={6}
                              secureTextEntry={!showOtp}
                              autoFocus
                              onSubmitEditing={handleSubmit}
                              returnKeyType="go"
                            />
                            <TouchableOpacity
                              style={styles.eyeBtn}
                              onPress={() => setShowOtp(!showOtp)}
                              activeOpacity={0.7}
                              accessibilityLabel={showOtp ? "Hide OTP" : "Show OTP"}
                            >
                              <MaterialIcons
                                name={showOtp ? "visibility-off" : "visibility"}
                                size={20}
                                color="#64748B"
                              />
                            </TouchableOpacity>
                          </View>

                          <View style={styles.otpMetaRow}>
                            <Text style={styles.otpTimerText}>
                              {expireSecondsLeft > 0
                                ? label(
                                    `Code expires in ${expireSecondsLeft}s`,
                                    `सत्यापन कोड ${expireSecondsLeft}s में समाप्त होगा`
                                  )
                                : label("Code expired. Please request a new code.", "कोड समाप्त हो गया। नया कोड मांगें।")}
                            </Text>

                            <TouchableOpacity
                              onPress={handleResendOtp}
                              disabled={loading || resendSecondsLeft > 0}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.resendLink,
                                  (loading || resendSecondsLeft > 0) && styles.resendLinkDisabled,
                                ]}
                              >
                                {resendSecondsLeft > 0
                                  ? label(`Resend in ${resendSecondsLeft}s`, `पुनः भेजें: ${resendSecondsLeft}s`)
                                  : label("Resend OTP", "OTP पुनः भेजें")}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.changeDetailsBtn}
                          onPress={() => {
                            setRegistrationStep("details");
                            setError("");
                            setShowOtp(false);
                          }}
                          disabled={loading}
                          activeOpacity={0.75}
                        >
                          <MaterialIcons name="arrow-back" size={14} color="#03456C" />
                          <Text style={styles.changeDetailsText}>
                            {registerMethod === "email"
                              ? label("Change email address or details", "ईमेल पता या विवरण बदलें")
                              : label("Change mobile number or details", "मोबाइल नंबर या विवरण बदलें")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        {/* REGISTRATION: METHOD SWITCHER (Mobile vs Email) */}
                        {isRegister && (
                          <View style={styles.methodToggleRow}>
                            <TouchableOpacity
                              style={[styles.methodPill, registerMethod === "mobile" && styles.methodPillActive]}
                              onPress={() => {
                                setRegisterMethod("mobile");
                                setError("");
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="phone-iphone"
                                size={14}
                                color={registerMethod === "mobile" ? "#03456C" : "#64748B"}
                              />
                              <Text style={[styles.methodPillText, registerMethod === "mobile" && styles.methodPillTextActive]}>
                                {label("Mobile Number", "मोबाइल नंबर")}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.methodPill, registerMethod === "email" && styles.methodPillActive]}
                              onPress={() => {
                                setRegisterMethod("email");
                                setError("");
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="mail-outline"
                                size={14}
                                color={registerMethod === "email" ? "#03456C" : "#64748B"}
                              />
                              <Text style={[styles.methodPillText, registerMethod === "email" && styles.methodPillTextActive]}>
                                {label("Email Address", "ईमेल पता")}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* SIGN IN: METHOD SWITCHER (Mobile vs Email) */}
                        {!isRegister && (
                          <View style={styles.methodToggleRow}>
                            <TouchableOpacity
                              style={[styles.methodPill, loginMethod === "mobile" && styles.methodPillActive]}
                              onPress={() => {
                                setLoginMethod("mobile");
                                setError("");
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="phone-iphone"
                                size={14}
                                color={loginMethod === "mobile" ? "#03456C" : "#64748B"}
                              />
                              <Text style={[styles.methodPillText, loginMethod === "mobile" && styles.methodPillTextActive]}>
                                {label("Mobile Number", "मोबाइल नंबर")}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.methodPill, loginMethod === "email" && styles.methodPillActive]}
                              onPress={() => {
                                setLoginMethod("email");
                                setError("");
                              }}
                              activeOpacity={0.8}
                            >
                              <MaterialIcons
                                name="mail-outline"
                                size={14}
                                color={loginMethod === "email" ? "#03456C" : "#64748B"}
                              />
                              <Text style={[styles.methodPillText, loginMethod === "email" && styles.methodPillTextActive]}>
                                {label("Email Address", "ईमेल पता")}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Full Name (Register Only) */}
                        {isRegister && (
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("Full Name", "पूरा नाम")} <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={styles.textInput}
                                value={name}
                                onChangeText={setName}
                                editable={!loading}
                                placeholder={label("e.g. Ramesh Kumar", "उदा. रमेश कुमार")}
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="words"
                                autoComplete="name"
                              />
                            </View>
                          </View>
                        )}

                        {/* When Registering by Email: Email Address is Primary / Required */}
                        {isRegister && registerMethod === "email" && (
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("Email Address", "ईमेल पता")} <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={styles.textInput}
                                value={email}
                                onChangeText={setEmail}
                                editable={!loading}
                                placeholder={label("e.g. name@example.com", "उदा. name@example.com")}
                                placeholderTextColor="#94A3B8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                              />
                            </View>
                          </View>
                        )}

                        {/* Mobile Number Field:
                            - Register with mobile: REQUIRED (*)
                            - Sign in with mobile: REQUIRED (*)
                            - Register with email: OPTIONAL */}
                        {((isRegister && registerMethod === "mobile") || (!isRegister && loginMethod === "mobile") || (isRegister && registerMethod === "email")) && (
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {isRegister && registerMethod === "email"
                                ? label("Mobile Number (Optional)", "मोबाइल नंबर (वैकल्पिक)")
                                : label("Mobile Number", "मोबाइल नंबर")}{" "}
                              {(!isRegister || registerMethod === "mobile") && <Text style={styles.requiredStar}>*</Text>}
                            </Text>
                            <View style={styles.inputWrap}>
                              <View style={styles.countryCodeBadge}>
                                <Text style={styles.countryCodeText}>+91</Text>
                              </View>
                              <TextInput
                                style={[styles.textInput, styles.phoneInput]}
                                value={mobile}
                                onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
                                editable={!loading}
                                placeholder={label("10-digit mobile number", "10 अंकों का मोबाइल नंबर")}
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                                maxLength={10}
                                autoComplete="tel"
                              />
                            </View>
                          </View>
                        )}

                        {/* Email Address (Sign In with Email) */}
                        {!isRegister && loginMethod === "email" && (
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("Email Address", "ईमेल पता")} <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={styles.textInput}
                                value={loginEmail}
                                onChangeText={setLoginEmail}
                                editable={!loading}
                                placeholder={label("e.g. name@example.com", "उदा. name@example.com")}
                                placeholderTextColor="#94A3B8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                              />
                            </View>
                          </View>
                        )}

                        {/* Password */}
                        <View style={styles.fieldGroup}>
                          <View style={styles.labelWithAction}>
                            <Text style={styles.fieldLabel}>
                              {label("Password", "पासवर्ड")} <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            {!isRegister && (
                              <TouchableOpacity
                                onPress={() => {
                                  if (mobile.trim()) setForgotMobile(mobile.trim());
                                  if (loginEmail.trim()) setForgotEmail(loginEmail.trim());
                                  setForgotMethod(loginMethod);
                                  handleTabSwitch("forgot");
                                }}
                              >
                                <Text style={styles.forgotLink}>
                                  {label("Forgot password?", "पासवर्ड भूल गए?")}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.inputWrap}>
                            <MaterialIcons name="lock-outline" size={20} color="#64748B" style={styles.inputIcon} />
                            <TextInput
                              style={[styles.textInput, { paddingRight: 48 }]}
                              value={password}
                              onChangeText={setPassword}
                              editable={!loading}
                              secureTextEntry={!showPassword}
                              placeholder={
                                isRegister
                                  ? label("Minimum 6 characters", "कम से कम 6 अक्षर")
                                  : label("Enter your password", "अपना पासवर्ड दर्ज करें")
                              }
                              placeholderTextColor="#94A3B8"
                              autoCapitalize="none"
                              autoCorrect={false}
                              onSubmitEditing={handleSubmit}
                              returnKeyType="go"
                            />
                            <TouchableOpacity
                              style={styles.eyeBtn}
                              onPress={() => setShowPassword(!showPassword)}
                              activeOpacity={0.7}
                            >
                              <MaterialIcons
                                name={showPassword ? "visibility-off" : "visibility"}
                                size={20}
                                color="#64748B"
                              />
                            </TouchableOpacity>
                          </View>
                          {isRegister && (
                            <PasswordStrengthIndicator
                              password={password}
                              context={{ name, mobile, email }}
                            />
                          )}
                        </View>

                        {/* When Registering by Mobile: Email Address is OPTIONAL */}
                        {isRegister && registerMethod === "mobile" && (
                          <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>
                              {label("Email Address (Optional)", "ईमेल पता (वैकल्पिक)")}
                            </Text>
                            <View style={styles.inputWrap}>
                              <MaterialIcons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                              <TextInput
                                style={styles.textInput}
                                value={email}
                                onChangeText={setEmail}
                                editable={!loading}
                                placeholder="name@example.com"
                                placeholderTextColor="#94A3B8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                returnKeyType="go"
                                onSubmitEditing={handleSubmit}
                              />
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      (loading ||
                        (isRegister && registrationStep === "otp" && expireSecondsLeft === 0) ||
                        (isForgot && forgotStep === "verify" && forgotExpireSecondsLeft === 0)) &&
                        styles.submitBtnDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={
                      loading ||
                      (isRegister && registrationStep === "otp" && expireSecondsLeft === 0) ||
                      (isForgot && forgotStep === "verify" && forgotExpireSecondsLeft === 0)
                    }
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitBtnText}>
                          {isForgot
                            ? forgotStep === "verify"
                              ? label("Reset Password & Sign In", "पासवर्ड रीसेट करें और साइन इन करें")
                              : label("Send Reset Code", "रीसेट कोड भेजें")
                            : isRegister
                            ? registrationStep === "otp"
                              ? label("Verify & Complete Registration", "सत्यापित करें और खाता बनाएं")
                              : label("Continue & Send OTP", "आगे बढ़ें और OTP भेजें")
                            : label("Sign In to MalikSe", "MalikSe में साइन इन करें")}
                        </Text>
                        <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Switch Tab Link */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchPromptText}>
                      {isForgot
                        ? label("Remembered your password?", "पासवर्ड याद आ गया?")
                        : isRegister
                        ? label("Already have an account?", "पहले से खाता है?")
                        : label("New to MalikSe?", "MalikSe पर नए हैं?")}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleTabSwitch(isForgot ? "login" : isRegister ? "login" : "register")}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.switchActionText}>
                        {isForgot
                          ? label("Sign in here", "यहाँ साइन इन करें")
                          : isRegister
                          ? label("Sign in here", "यहाँ साइन इन करें")
                          : label("Create an account", "खाता बनाएं")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Security Footnote */}
                  <View style={styles.securityFootnote}>
                    <MaterialIcons name="security" size={15} color="#15803D" />
                    <Text style={styles.securityText}>
                      {label(
                        "Bank-Grade 256-Bit SSL · 100% Title Guarantee · Zero Broker Spam",
                        "256-बिट सुरक्षित · शून्य स्पैम · 100% सत्यापन गारंटी"
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Under-Card Trust Assurance Bar */}
            <View style={styles.authTrustBar}>
              <View style={styles.authTrustItem}>
                <View style={[styles.authTrustIconWrap, { backgroundColor: "#E0F2FE" }]}>
                  <MaterialIcons name="gavel" size={18} color="#0284C7" />
                </View>
                <View style={styles.authTrustTextBox}>
                  <Text style={styles.authTrustTitle}>
                    {label("Revenue Record Verification", "राजस्व रिकॉर्ड सत्यापन")}
                  </Text>
                  <Text style={styles.authTrustSub}>
                    {label("Jamabandi, Khatiyan & Circle Office LPC audit", "जमाबंदी, खतियान व अंचल कार्यालय एलपीसी जांच")}
                  </Text>
                </View>
              </View>

              {isDesktop && <View style={styles.authTrustDivider} />}

              <View style={styles.authTrustItem}>
                <View style={[styles.authTrustIconWrap, { backgroundColor: "#DCFCE7" }]}>
                  <MaterialIcons name="gps-fixed" size={18} color="#059669" />
                </View>
                <View style={styles.authTrustTextBox}>
                  <Text style={styles.authTrustTitle}>
                    {label("Physical GPS Demarcation", "मौके पर जीपीएस पैमाइश")}
                  </Text>
                  <Text style={styles.authTrustSub}>
                    {label("Official surveyor pegs with cadastral mapping", "सरकारी अमीन द्वारा सीमांकन व सैटेलाइट मैपिंग")}
                  </Text>
                </View>
              </View>

              {isDesktop && <View style={styles.authTrustDivider} />}

              <View style={styles.authTrustItem}>
                <View style={[styles.authTrustIconWrap, { backgroundColor: "#FEF3C7" }]}>
                  <MaterialIcons name="handshake" size={18} color="#D97706" />
                </View>
                <View style={styles.authTrustTextBox}>
                  <Text style={styles.authTrustTitle}>
                    {label("Direct Verified Owners", "सीधे असली ज़मीन मालिक")}
                  </Text>
                  <Text style={styles.authTrustSub}>
                    {label("₹0 broker commission · Zero hidden costs", "शून्य ब्रोकरेज · सीधे पारदर्शी सौदे")}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Full Global Website Footer */}
          <WebFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardScreen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1,
  },

  /* Matching Content Grid to VerifiedHomeScreen (maxWidth: 1340, paddingHorizontal: 28) */
  content: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 32,
  },

  /* Main Dual-Pane Auth Card */
  authCardWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 18,
  },
  authCard: {
    width: "100%",
    maxWidth: 1040,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    ...Platform.select({
      web: {
        boxShadow: "0 18px 42px -12px rgba(10, 25, 47, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.04)",
      },
      default: {
        shadowColor: "#0A192F",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },

  /* Left Showcase Pane (Desktop Only) */
  leftPane: {
    width: "46%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#03456C",
  },
  leftPaneOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: "rgba(3, 69, 108, 0.88)",
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(155deg, rgba(3, 69, 108, 0.93) 0%, rgba(10, 25, 47, 0.97) 100%)",
      },
    }),
  },
  leftPaneContent: {
    position: "relative",
    zIndex: 2,
    padding: 36,
    flex: 1,
    justifyContent: "space-between",
  },
  leftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 18,
  },
  leftBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.8,
  },
  leftHeading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 35,
    letterSpacing: -0.6,
    marginBottom: 10,
  },
  leftSubtext: {
    fontSize: 13,
    color: "rgba(224, 242, 254, 0.85)",
    lineHeight: 20,
    marginBottom: 24,
  },
  pillarsList: {
    gap: 16,
    marginBottom: 24,
  },
  pillarItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  pillarIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  pillarTextBox: {
    flex: 1,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  pillarDesc: {
    fontSize: 12,
    color: "rgba(203, 213, 225, 0.85)",
    lineHeight: 16,
  },
  leftTrustFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  leftTrustText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#BAE6FD",
    letterSpacing: 0.3,
  },

  /* Right Form Pane */
  rightPane: {
    paddingHorizontal: 36,
    paddingVertical: 32,
    justifyContent: "center",
  },
  tabSelector: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#03456C",
    fontWeight: "700",
  },

  /* Forgot Password Navigation Header */
  forgotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backToSignInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  backToSignInBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03456C",
  },
  forgotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E0F2FE",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  forgotBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7",
  },

  /* Form Header */
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },

  /* Success & Error Banners */
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
  },

  /* Fields */
  fieldsContainer: {
    gap: 14,
    marginBottom: 20,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  requiredStar: {
    color: "#DC2626",
  },
  labelWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284C7",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
  },
  inputIcon: {
    paddingLeft: 14,
    paddingRight: 6,
  },
  countryCodeBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#0F172A",
    outlineStyle: "none" as any,
  },
  phoneInput: {
    paddingLeft: 12,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    padding: 6,
  },

  /* Method Toggle Row (Mobile vs Email) */
  methodToggleRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 3,
    marginBottom: 6,
    gap: 4,
  },
  methodPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  methodPillActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.08)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  methodPillTextActive: {
    color: "#03456C",
    fontWeight: "700",
  },

  /* OTP Step Styles */
  otpStepContainer: {
    gap: 14,
  },
  stubNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  stubNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#0369A1",
    fontWeight: "600",
  },
  otpTextInput: {
    letterSpacing: 10,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  otpMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  otpTimerText: {
    fontSize: 12,
    color: "#64748B",
  },
  resendLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  resendLinkDisabled: {
    color: "#94A3B8",
  },
  changeDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    marginTop: -4,
  },
  changeDetailsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#03456C",
    textDecorationLine: "underline",
  },

  /* Submit Button */
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#03456C",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 16,
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0284C7 100%)",
        boxShadow: "0 6px 20px -2px rgba(2, 132, 199, 0.38)",
        cursor: "pointer",
      },
      default: {
        elevation: 3,
      },
    }),
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Switch Row */
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  switchPromptText: {
    fontSize: 13,
    color: "#64748B",
  },
  switchActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284C7",
  },

  /* Security Footnote */
  securityFootnote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  securityText: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },

  /* Under-Card Trust Assurance Bar */
  authTrustBar: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    paddingVertical: 16,
    paddingHorizontal: 22,
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 6px 20px -4px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  authTrustItem: {
    flex: 1,
    minWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  authTrustIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  authTrustTextBox: {
    flex: 1,
  },
  authTrustTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A192F",
    marginBottom: 2,
  },
  authTrustSub: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  authTrustDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E2E8F0",
  },
});
