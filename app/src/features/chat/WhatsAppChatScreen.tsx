import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { MarketplaceShell } from "../../../components/MalikseMarketplace";
import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatListScreen } from "./ChatListScreen";

const C = {
  ink: "#14263E",
  sun: "#FCC61C",
  muted: "#536174",
};

export const WhatsAppChatScreen: React.FC = () => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState("");
  const { width } = useWindowDimensions();
  const houseWidth = Math.min(224, Math.max(0, width - 40) * 0.47);
  const houseHeight = houseWidth * (897 / 1754);
  const signIn = () => router.push({ pathname: "/login", params: { returnTo: "/messages" } });
  const params = useLocalSearchParams<{ inquiryId?: string }>();

  const activeInquiryId = params.inquiryId ? String(params.inquiryId) : null;

  // Active Chat Screen
  if (user && activeInquiryId) {
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

  const searchLabel = "Search chats, people or properties";
  const searchIcon = <MaterialIcons name="search" size={22} color={C.ink} />;
  const emptyArtwork = (
    <Image source={require("../../../assets/images/messages-empty-artwork.png")}
      accessible={false} resizeMode="contain" style={user ? styles.emptyArtwork : styles.guestArtworkImage} />
  );
  return (
      <MarketplaceShell
        title="Messages"
        subtitle="Follow your enquiries and replies."
        matchedHero

        showGuestAccount
        listBody
        dockArtwork
        heroIllustration={<View style={{ width: houseWidth * 0.7, height: houseHeight }} />}
        headerContent={
          <View>
            <View pointerEvents="none" style={[styles.heroHouse, { width: houseWidth, height: houseHeight }]}>
              <Image
                source={require("../../../assets/images/messages_header_house.png")}
                accessible={false}
                resizeMode="contain"
                style={styles.houseImage}
              />
            </View>
            {user ? (
              <View style={styles.searchBar}>
                {searchIcon}
                <TextInput accessibilityLabel={searchLabel} placeholder={searchLabel}
                  placeholderTextColor={C.muted} value={searchQuery} onChangeText={setSearchQuery} style={styles.searchText} />
                {searchQuery !== "" && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery("")} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={C.muted} />
                  </Pressable>
            )}
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in to search chats" style={styles.searchBar} onPress={signIn}>
            {searchIcon}
            <Text numberOfLines={1} style={styles.searchText}>{searchLabel}</Text>
          </Pressable>
            )}
          </View>
        }
      >
        {user ? (
          <ChatListScreen key={user.id} searchQuery={searchQuery} emptyArtwork={emptyArtwork}
            onSelectConversation={(id) => router.setParams({ inquiryId: id })} />
        ) : (
          <ScrollView contentContainerStyle={styles.guestContent}>
            <View style={styles.guestCard}>
              <View style={styles.guestIcon}>
                <MaterialIcons name="chat-bubble-outline" size={24} color={C.ink} accessible={false} />
              </View>
              <Text accessibilityRole="header" style={styles.guestTitle}>Sign in to your messages</Text>
              <Text style={styles.guestSubtitle}>
                Read replies and follow up on your property enquiries.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={signIn}
                style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.signInButtonText}>Sign in / Register</Text>
              </Pressable>
            </View>
            <View pointerEvents="none" style={styles.guestArtwork}>{emptyArtwork}</View>
          </ScrollView>
        )}
      </MarketplaceShell>
  );
};

const styles = StyleSheet.create({
  guestContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 8 },
  guestArtwork: {
    flexGrow: 1, minHeight: 130, width: "78%", maxWidth: 300, alignSelf: "center",
  },
  guestArtworkImage: {
    position: "absolute", top: 0, width: "100%", height: "100%", opacity: 0.38,
  },
  emptyArtwork: {
    alignSelf: "center", width: "78%", maxWidth: 300, aspectRatio: 1, opacity: 0.38,
  },
  heroHouse: {
    position: "absolute",
    bottom: "100%",
    right: -14,
    transform: [{ translateY: 4 }],
  },
  houseImage: {
    width: "100%",
    height: "100%",
  },
  searchBar: {
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
  },
  searchText: {
    flex: 1,
    minWidth: 0,
    color: C.muted,
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    paddingVertical: 8,
  },
  guestCard: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.14)",
    backgroundColor: "#fff",
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  guestIcon: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFF1C0",
    alignItems: "center", justifyContent: "center",
  },
  guestTitle: {
    fontFamily: "Fraunces",
    fontSize: 22,
    color: C.ink,
    textAlign: "center",
  },
  guestSubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    color: C.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: C.sun,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 24,
    elevation: 3,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  signInButtonText: {
    color: C.ink,
    textAlign: "center",
    fontFamily: "ManropeBold",
    fontSize: 16,
    fontWeight: "700",
  },
});
