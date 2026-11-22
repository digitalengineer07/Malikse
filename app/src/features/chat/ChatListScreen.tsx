import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { chatApi } from "./chatApi";
import type { ChatConversation } from "./chatTypes";

interface ChatListScreenProps {
  onSelectConversation: (inquiryId: string) => void;
}

const C = {
  ink: "#14263E",
  sun: "#FCC61C",
  sunSoft: "#FBF2C0",
  blue: "#0A45B5",
  bg: "#F4F8FF",
  line: "#E2ECF8",
  muted: "#5D7089",
  green: "#12964C",
};

function getParticipantId(party: any): string {
  if (!party) return "";
  return typeof party === "object" ? String(party._id || "") : String(party);
}

function formatLocationPart(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (start) => start.toLocaleUpperCase())
    : "";
}

function formatThreadDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ onSelectConversation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const houseWidth = Math.min(194, Math.max(0, width - 40) * 0.42);

  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id || "";

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterUnread, setFilterUnread] = useState<boolean>(false);

  const loadConversations = useCallback(async () => {
    if (!currentUserId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    try {
      const data = await chatApi.getConversations("activity");
      setConversations(data);
    } catch (err: any) {
      console.warn("[ChatListScreen] loadConversations error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadConversations();
  };

  // Filter threads
  const filtered = conversations.filter((c) => {
    if (filterUnread && !c.unread && (!c.unreadCount || c.unreadCount <= 0)) return false;

    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();

    const isBuyer = getParticipantId(c.buyerId) === currentUserId;
    const other = isBuyer ? c.staffId : c.buyerId;
    const otherName = (typeof other === "object" && other?.name) || "";
    const propertyTitle = c.propertyId?.title || "";
    const lastMsg = c.messages?.at(-1)?.text || c.message || "";

    return (
      otherName.toLowerCase().includes(query) ||
      propertyTitle.toLowerCase().includes(query) ||
      lastMsg.toLowerCase().includes(query)
    );
  });

  return (
    <View style={styles.screen}>
      {/* Exact Previous MalikSe Hero Header */}
      <View style={[styles.heroHeader, { paddingTop: insets.top + 14 }]}>
        <View style={styles.messagesHeroIntro}>
          <View style={styles.messagesHeroCopy}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              Messages
            </Text>
            <Text style={styles.messagesHeroSubtitle} numberOfLines={2}>
              Track property enquiries and replies.
            </Text>
          </View>
          <Image
            source={require("../../../assets/images/messages_header_house.png")}
            resizeMode="contain"
            accessible={false}
            style={[styles.messagesHeroHouse, { width: houseWidth, height: houseWidth * (897 / 1754) }]}
          />
        </View>

        {/* Previous Search Pill */}
        <View style={styles.messagesHeroSearch}>
          <MaterialIcons name="search" size={20} color={C.ink} />
          <TextInput
            accessibilityLabel="Search chats, people or properties"
            placeholder="Search chats, people or properties"
            placeholderTextColor={C.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.messagesHeroSearchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Tabs: All vs Unread */}
      <View style={styles.filterWrap}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setFilterUnread(false)}
          style={[styles.filterButton, !filterUnread && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, !filterUnread && styles.filterButtonTextActive]}>
            All
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setFilterUnread(true)}
          style={[styles.filterButton, filterUnread && styles.filterButtonActive]}
        >
          <Text style={[styles.filterButtonText, filterUnread && styles.filterButtonTextActive]}>
            Unread
          </Text>
        </Pressable>
      </View>

      {/* Conversation Thread Feed */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[C.blue]} />
          }
          renderItem={({ item }) => {
            const isBuyer = getParticipantId(item.buyerId) === currentUserId;
            const other = isBuyer ? item.staffId : item.buyerId;
            const participantName =
              (typeof other === "object" && other?.name?.trim()) ||
              (isBuyer ? "Property Advisor" : "Buyer");
            const role =
              !isBuyer
                ? "Buyer"
                : typeof other === "object" && other?.role === "advisor"
                ? "Advisor"
                : typeof other === "object" && other?.role === "verifier"
                ? "Verifier"
                : "Property team";

            const lastMessage = item.messages?.at(-1);
            const previewText = lastMessage?.text || item.message;
            const timestamp = lastMessage?.createdAt || item.updatedAt || item.createdAt;
            const timeFormatted = formatThreadDate(timestamp);

            const location = item.propertyId?.location;
            const address = [location?.block, location?.district].map(formatLocationPart);
            const listing = [formatLocationPart(item.propertyId?.title), ...new Set(address)]
              .filter(Boolean)
              .join(" · ");

            const unreadCount = item.unreadCount || (item.unread ? 1 : 0);

            return (
              <Pressable
                key={item._id}
                accessibilityRole="button"
                onPress={() => onSelectConversation(item._id)}
                style={({ pressed }) => [styles.threadCard, pressed && { opacity: 0.78 }]}
              >
                {/* Left Column Avatar with Initials */}
                <View style={styles.threadAvatarColumn}>
                  <View style={styles.threadAvatar}>
                    <Text style={styles.threadAvatarText}>
                      {Array.from(participantName)[0]?.toLocaleUpperCase()}
                    </Text>
                    {item.unread && <View style={styles.threadUnreadDot} />}
                  </View>
                </View>

                {/* Center Content Column */}
                <View style={styles.threadCopy}>
                  <View style={styles.threadNameRow}>
                    <Text style={styles.threadName} numberOfLines={1}>
                      {participantName}
                    </Text>
                    <View style={styles.threadRole}>
                      <Text style={styles.threadRoleText}>{role}</Text>
                    </View>
                  </View>

                  {listing ? (
                    <View style={styles.threadListing}>
                      <MaterialIcons name="home" size={15} color={C.muted} />
                      <Text style={styles.threadListingText} numberOfLines={1}>
                        {listing}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.threadPreview} numberOfLines={1}>
                    {previewText}
                  </Text>
                </View>

                {/* Right Meta Column */}
                <View style={styles.threadMeta}>
                  {timeFormatted ? (
                    <Text style={styles.threadTime}>{timeFormatted}</Text>
                  ) : null}

                  {item.unread && (
                    <View style={unreadCount > 0 ? styles.threadCount : styles.threadCountDot}>
                      {unreadCount > 0 && (
                        <Text style={styles.threadCountText}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                <MaterialIcons name="chevron-right" size={19} color={C.ink} />
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="chat-bubble-outline" size={56} color="#B0BEC5" />
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No matching conversations" : "Start a conversation"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "Try another search or filter."
                  : "Open a verified property and contact its assigned team."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  heroHeader: {
    backgroundColor: C.ink,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 28,
  },
  messagesHeroIntro: {
    minHeight: 88,
    justifyContent: "center",
    position: "relative",
    marginBottom: 12,
  },
  messagesHeroCopy: {
    width: "66%",
    gap: 4,
  },
  heroTitle: {
    fontFamily: "Fraunces_400Regular",
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  messagesHeroSubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
  },
  messagesHeroHouse: {
    position: "absolute",
    bottom: -10,
    right: -4,
  },
  messagesHeroSearch: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 1,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messagesHeroSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: C.ink,
  },
  filterWrap: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  filterButtonActive: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  filterButtonText: {
    fontFamily: "ManropeBold",
    fontSize: 13,
    color: C.ink,
    fontWeight: "700",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  threadCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingLeft: 13,
    paddingRight: 9,
    paddingVertical: 12,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  threadAvatarColumn: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingRight: 11,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  threadAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.sunSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  threadAvatarText: {
    fontFamily: "ManropeExtraBold",
    fontSize: 20,
    color: C.ink,
    fontWeight: "800",
  },
  threadUnreadDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    borderRadius: 6,
    backgroundColor: C.green,
  },
  threadCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  threadNameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  threadName: {
    flexShrink: 1,
    fontFamily: "ManropeExtraBold",
    fontSize: 15,
    color: C.ink,
    fontWeight: "800",
  },
  threadRole: {
    borderRadius: 12,
    backgroundColor: "#E3F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  threadRoleText: {
    color: C.green,
    fontFamily: "ManropeBold",
    fontSize: 10,
    fontWeight: "700",
  },
  threadListing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  threadListingText: {
    flexShrink: 1,
    fontFamily: "ManropeBold",
    fontSize: 12,
    color: C.muted,
  },
  threadPreview: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: C.ink,
  },
  threadMeta: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
  },
  threadTime: {
    fontFamily: "Manrope_400Regular",
    fontSize: 10,
    color: C.muted,
  },
  threadCount: {
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.sun,
  },
  threadCountText: {
    fontFamily: "ManropeExtraBold",
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    textAlign: "center",
    color: C.ink,
    fontWeight: "800",
  },
  threadCountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.sun,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: C.ink,
    fontFamily: "ManropeBold",
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 14,
    color: C.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    fontFamily: "Manrope_400Regular",
  },
});
