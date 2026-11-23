import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";

const C = {
  ink: "#14263E",
  sun: "#FCC61C",
  blue: "#0A45B5",
  bg: "#F4F8FF",
  muted: "#5D7089",
};

export const WhatsAppChatScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ inquiryId?: string }>();

  const activeInquiryId = params.inquiryId ? String(params.inquiryId) : null;

  // Guest State - Exactly matches previous MalikSe Protected guest UI
  if (!user) {
    return (
      <View style={[styles.guestContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.guestIconCircle}>
          <MaterialIcons name="chat-bubble-outline" size={44} color={C.blue} />
        </View>
        <Text style={styles.guestTitle}>Pick up the conversation</Text>
        <Text style={styles.guestSubtitle}>
          Sign in to read replies and follow up with your property team.
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
        key={`${user?.id}:${activeInquiryId}`}
        inquiryId={activeInquiryId}
        onBack={() => {
          router.setParams({ inquiryId: "" });
        }}
      />
    );
  }

  // Inbox List Screen
  return (
    <ChatListScreen
      key={user.id}
      onSelectConversation={(id) => {
        router.setParams({ inquiryId: id });
      }}
    />
  );
};

const styles = StyleSheet.create({
  guestContainer: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  guestIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(10, 69, 181, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  guestTitle: {
    fontFamily: "Fraunces_400Regular",
    fontSize: 24,
    color: C.ink,
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "600",
  },
  guestSubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: C.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  signInButton: {
    backgroundColor: C.ink,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    elevation: 3,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontFamily: "ManropeBold",
    fontSize: 16,
    fontWeight: "700",
  },
});
