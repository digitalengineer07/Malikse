import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";

export const WhatsAppChatScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ inquiryId?: string }>();

  const [activeInquiryId, setActiveInquiryId] = useState<string | null>(
    params.inquiryId ? String(params.inquiryId) : null
  );

  // Update active inquiry when local search params change (e.g. from push notifications or property detail clicks)
  useEffect(() => {
    if (params.inquiryId) {
      setActiveInquiryId(String(params.inquiryId));
    }
  }, [params.inquiryId]);

  // Guest State - User not signed in
  if (!user) {
    return (
      <View style={[styles.guestContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.guestIconCircle}>
          <MaterialIcons name="chat-bubble-outline" size={48} color="#008069" />
        </View>
        <Text style={styles.guestTitle}>Sign in to Messages</Text>
        <Text style={styles.guestSubtitle}>
          Connect directly with verified property advisors, make offers, and track your inquiry status.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/login")}
          style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.signInButtonText}>Sign In / Register</Text>
        </Pressable>
      </View>
    );
  }

  // Active Chat Screen
  if (activeInquiryId) {
    return (
      <ChatConversationScreen
        inquiryId={activeInquiryId}
        onBack={() => {
          setActiveInquiryId(null);
          // Also clear router search params if applicable
          router.setParams({ inquiryId: "" });
        }}
      />
    );
  }

  // Inbox List Screen
  return (
    <ChatListScreen
      onSelectConversation={(id) => {
        setActiveInquiryId(id);
      }}
    />
  );
};

const styles = StyleSheet.create({
  guestContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  guestIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(0, 128, 105, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111B21",
    marginBottom: 10,
    textAlign: "center",
  },
  guestSubtitle: {
    fontSize: 15,
    color: "#667781",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  signInButton: {
    backgroundColor: "#008069", // WhatsApp dark green
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
