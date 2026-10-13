import { AppTheme } from "../constants/theme";
import TextInput from "./FormInput";
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { t } from "../src/i18n/translations";
import { useLanguageStore } from "../src/store/languageStore";

interface OfferSheetProps {
  propertyId: string;
  askingPrice: number;
  onSubmit: (amount: number) => Promise<void>;
  onCancel: () => void;
}

export default function OfferSheet({ askingPrice, onSubmit, onCancel }: OfferSheetProps) {
  const { language } = useLanguageStore();
  const [offer, setOffer] = useState(askingPrice.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parsedOffer = Number(offer);
  const commission = (Number.isFinite(parsedOffer) ? parsedOffer : 0) * 0.0118; // 1% + 18% GST

  const handleSubmit = async () => {
    if (loading) return;
    if (!Number.isFinite(parsedOffer) || parsedOffer <= 0) { setError("Enter a positive offer amount"); return; }
    setError("");
    setLoading(true);
    try {
      await onSubmit(parsedOffer);
    } catch (cause: any) {
      setError(cause.response?.data?.error || cause.response?.data?.message || "Could not submit offer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(language, "deal_make_offer")}</Text>
      
      <Text style={styles.label}>{t(language, "deal_offer_amount")}</Text>
      <TextInput
        accessibilityLabel={t(language, "deal_offer_amount")}
        editable={!loading}
        style={styles.input}
        value={offer}
        onChangeText={setOffer}
        keyboardType="numeric"
        placeholder="Enter amount in ₹"
      />

      <View style={styles.commissionBox}>
        <Text style={styles.commissionText}>{t(language, "deal_commission_note")}</Text>
        <Text style={styles.commissionAmount}>
          Est. Commission: ₹{commission.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </Text>
      </View>

      {!!error && <Text accessibilityRole="alert" style={{ color: "#B91C1C", marginBottom: 12 }}>{error}</Text>}
      <View style={styles.row}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
          <Text style={styles.cancelTxt}>{t(language, "cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>{t(language, "deal_submit_offer")}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "transparent",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#111",
  },
  label: {
    fontSize: 14,
    color: "#444",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginBottom: 16,
  },
  commissionBox: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  commissionText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  commissionAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cancelBtn: {
    flex: 1,
    minWidth: 100,
    minHeight: 50,
    padding: 14,
    marginRight: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: AppTheme.colors.primaryLight,
  },
  submitBtn: {
    flex: 1,
    padding: 14,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: AppTheme.colors.primary,
  },
  cancelTxt: {
    fontSize: 16,
    color: "#333",
  },
  submitTxt: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
  },
});
