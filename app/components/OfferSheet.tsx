import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
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

  const parsedOffer = parseFloat(offer) || 0;
  const commission = parsedOffer * 0.0118; // 1% + 18% GST

  const handleSubmit = async () => {
    if (parsedOffer <= 0) return;
    setLoading(true);
    try {
      await onSubmit(parsedOffer);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(language, "deal_make_offer")}</Text>
      
      <Text style={styles.label}>{t(language, "deal_offer_amount")}</Text>
      <TextInput
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
    justifyContent: "space-between",
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    marginRight: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F0F0F0",
  },
  submitBtn: {
    flex: 1,
    padding: 14,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2A85FF",
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
