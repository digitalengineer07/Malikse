import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguageStore } from "../src/store/languageStore";

export interface PasswordEvaluation {
  score: 0 | 1 | 2 | 3 | 4;
  labelEn: string;
  labelHi: string;
  color: string;
  warningEn?: string;
  warningHi?: string;
  isTrivial: boolean;
}

const COMMON_PASSWORDS = new Set([
  "password",
  "pass123",
  "password123",
  "123456",
  "12345678",
  "123456789",
  "000000",
  "111111",
  "qwerty",
  "admin",
  "admin123",
  "welcome",
  "welcome123",
  "malikse",
  "bihar",
  "patna",
]);

export function evaluatePasswordStrength(
  password: string,
  context?: { name?: string; mobile?: string; email?: string }
): PasswordEvaluation {
  if (!password) {
    return {
      score: 0,
      labelEn: "",
      labelHi: "",
      color: "#CBD5E1",
      isTrivial: false,
    };
  }

  const cleanPass = password.trim().toLowerCase();
  const rawMobile = context?.mobile?.replace(/\D/g, "") || "";
  const rawName = context?.name?.trim().toLowerCase() || "";
  const rawEmail = context?.email?.trim().toLowerCase() || "";
  const emailPrefix = rawEmail.split("@")[0];

  // 1. Check for common dictionary passwords
  if (COMMON_PASSWORDS.has(cleanPass)) {
    return {
      score: 1,
      labelEn: "Very Weak",
      labelHi: "अत्यधिक कमजोर",
      color: "#EF4444",
      warningEn: "Too simple! Avoid common words like 'password'.",
      warningHi: "बहुत आसान! 'password' जैसे सामान्य शब्द न चुनें।",
      isTrivial: true,
    };
  }

  // 2. Check for exact phone number match or inclusion
  if (rawMobile && (cleanPass.includes(rawMobile) || (rawMobile.includes(cleanPass) && cleanPass.length >= 6))) {
    return {
      score: 1,
      labelEn: "Very Weak",
      labelHi: "अत्यधिक कमजोर",
      color: "#EF4444",
      warningEn: "Avoid using your mobile number as your password.",
      warningHi: "अपने मोबाइल नंबर को पासवर्ड के रूप में इस्तेमाल न करें।",
      isTrivial: true,
    };
  }

  // 3. Check for name match (if name part >= 3 chars)
  if (rawName && rawName.length >= 3) {
    const nameParts = rawName.split(/\s+/);
    for (const part of nameParts) {
      if (part.length >= 3 && cleanPass.includes(part)) {
        return {
          score: 1,
          labelEn: "Weak",
          labelHi: "कमजोर",
          color: "#EF4444",
          warningEn: "Avoid using your personal name in your password.",
          warningHi: "पासवर्ड में अपना नाम शामिल करने से बचें।",
          isTrivial: true,
        };
      }
    }
  }

  // 4. Check for email prefix match
  if (emailPrefix && emailPrefix.length >= 3 && cleanPass.includes(emailPrefix)) {
    return {
      score: 1,
      labelEn: "Weak",
      labelHi: "कमजोर",
      color: "#EF4444",
      warningEn: "Avoid using your email name in your password.",
      warningHi: "पासवर्ड में अपना ईमेल नाम शामिल करने से बचें।",
      isTrivial: true,
    };
  }

  // 5. Check if numeric only
  if (/^\d+$/.test(password)) {
    return {
      score: 1,
      labelEn: "Weak",
      labelHi: "कमजोर",
      color: "#EF4444",
      warningEn: "Add letters and symbols for better account security.",
      warningHi: "बेहतर सुरक्षा के लिए अक्षर और विशेष चिह्न जोड़ें।",
      isTrivial: password.length <= 8,
    };
  }

  if (password.length < 6) {
    return {
      score: 1,
      labelEn: "Too Short",
      labelHi: "बहुत छोटा",
      color: "#EF4444",
      warningEn: "Must be at least 6 characters.",
      warningHi: "कम से कम 6 अक्षर होने चाहिए।",
      isTrivial: false,
    };
  }

  // 6. Character variety scoring
  let scorePoints = 0;
  if (password.length >= 8) scorePoints++;
  if (password.length >= 12) scorePoints++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) scorePoints++;
  if (/\d/.test(password)) scorePoints++;
  if (/[^A-Za-z0-9]/.test(password)) scorePoints++;

  if (scorePoints <= 1) {
    return {
      score: 1,
      labelEn: "Weak",
      labelHi: "कमजोर",
      color: "#EF4444",
      warningEn: "Add numbers and uppercase letters.",
      warningHi: "संख्याएं और बड़े अक्षर (A-Z) जोड़ें।",
      isTrivial: false,
    };
  }

  if (scorePoints === 2) {
    return {
      score: 2,
      labelEn: "Fair",
      labelHi: "साधारण",
      color: "#F59E0B",
      warningEn: "Tip: Add a special symbol (like @, #, $) for better protection.",
      warningHi: "सुझाव: बेहतर सुरक्षा के लिए विशेष चिह्न (@, #, $) जोड़ें।",
      isTrivial: false,
    };
  }

  if (scorePoints === 3 || scorePoints === 4) {
    return {
      score: 3,
      labelEn: "Good",
      labelHi: "अच्छा",
      color: "#0284C7",
      isTrivial: false,
    };
  }

  return {
    score: 4,
    labelEn: "Strong",
    labelHi: "मजबूत",
    color: "#10B981",
    isTrivial: false,
  };
}

interface PasswordStrengthIndicatorProps {
  password: string;
  context?: { name?: string; mobile?: string; email?: string };
}

export default function PasswordStrengthIndicator({ password, context }: PasswordStrengthIndicatorProps) {
  const { language } = useLanguageStore();
  const label = (en: string, hi: string) => (language === "hi" ? hi : en);

  if (!password) return null;

  const evaluation = evaluatePasswordStrength(password, context);
  const { score, labelEn, labelHi, color, warningEn, warningHi } = evaluation;

  return (
    <View style={styles.container}>
      {/* 4 Sleek Meter Bars */}
      <View style={styles.meterRow}>
        {[1, 2, 3, 4].map((step) => {
          const isFilled = score >= step;
          return (
            <View
              key={step}
              style={[
                styles.segment,
                { backgroundColor: isFilled ? color : "#E2E8F0" },
              ]}
            />
          );
        })}
        <View style={styles.badgeWrap}>
          <Text style={[styles.badgeText, { color }]}>
            {label(labelEn, labelHi)}
          </Text>
        </View>
      </View>

      {/* Warning or Tip */}
      {(warningEn || warningHi) && (
        <View style={styles.warningRow}>
          <MaterialIcons
            name={score <= 1 ? "info" : "shield"}
            size={13}
            color={score <= 1 ? "#EF4444" : "#64748B"}
          />
          <Text style={[styles.warningText, score <= 1 && styles.warningTextAlert]}>
            {label(warningEn || "", warningHi || "")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    gap: 4,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  badgeWrap: {
    marginLeft: 6,
    minWidth: 62,
    alignItems: "flex-end",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  warningText: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  warningTextAlert: {
    color: "#DC2626",
    fontWeight: "500",
  },
});
