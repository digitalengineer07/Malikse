import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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

function getParticipantId(party: any): string {
  if (!party) return "";
  return typeof party === "object" ? String(party._id || "") : String(party);
}

function formatThreadDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return "Yesterday";

    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export const ChatListScreen: React.FC<ChatListScreenProps> = ({ onSelectConversation }) => {
  const insets = useSafeAreaInsets();
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
      {/* WhatsApp Styled Dark Green Top Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerBadges}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{conversations.length} Active</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#8696A0" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats or properties..."
            placeholderTextColor="#8696A0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} style={styles.clearSearch}>
              <MaterialIcons name="close" size={18} color="#8696A0" />
            </Pressable>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilterUnread(false)}
            style={[styles.filterChip, !filterUnread && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, !filterUnread && styles.filterChipTextActive]}>
              All
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFilterUnread(true)}
            style={[styles.filterChip, filterUnread && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterUnread && styles.filterChipTextActive]}>
              Unread
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Conversation Thread Feed */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#008069" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#008069"]} />
          }
          renderItem={({ item }) => {
            const isBuyer = getParticipantId(item.buyerId) === currentUserId;
            const other = isBuyer ? item.staffId : item.buyerId;
            const otherName =
              (typeof other === "object" && other?.name) ||
              (isBuyer ? "Property Advisor" : "Buyer");
            const role =
              typeof other === "object" && other?.role
                ? other.role.charAt(0).toUpperCase() + other.role.slice(1)
                : isBuyer
                ? "Advisor"
                : "Client";

            const lastMessage = item.messages?.at(-1);
            const previewText = lastMessage?.text || item.message;
            const lastSenderId = getParticipantId(lastMessage?.senderId);
            const isMine = lastSenderId === currentUserId;
            const timestamp = lastMessage?.createdAt || item.updatedAt || item.createdAt;
            const timeFormatted = formatThreadDate(timestamp);
            const propertyTitle = item.propertyId?.title || "Property Conversation";
            const unreadCount = item.unreadCount || (item.unread ? 1 : 0);

            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelectConversation(item._id)}
                style={({ pressed }) => [styles.threadItem, pressed && styles.threadItemPressed]}
              >
                {/* Avatar with initial */}
                <View style={styles.avatarWrap}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
                  </View>
                  {unreadCount > 0 && <View style={styles.unreadDotBadge} />}
                </View>

                {/* Info Column */}
                <View style={styles.threadContent}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.contactName, unreadCount > 0 && styles.contactNameUnread]} numberOfLines={1}>
                      {otherName}
                    </Text>
                    <Text style={[styles.timestampText, unreadCount > 0 && styles.timestampUnread]}>
                      {timeFormatted}
                    </Text>
                  </View>

                  {/* Property Pill Snippet */}
                  <View style={styles.propertyRow}>
                    <MaterialIcons name="apartment" size={13} color="#008069" />
                    <Text style={styles.propertyTitle} numberOfLines={1}>
                      {propertyTitle}
                    </Text>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{role}</Text>
                    </View>
                  </View>

                  {/* Last Message Preview & Unread Counter */}
                  <View style={styles.previewRow}>
                    <View style={styles.previewLeft}>
                      {isMine && (
                        <MaterialIcons
                          name="done-all"
                          size={15}
                          color="#53BDEB"
                          style={{ marginRight: 3 }}
                        />
                      )}
                      <Text
                        style={[styles.previewText, unreadCount > 0 && styles.previewTextUnread]}
                        numberOfLines={1}
                      >
                        {previewText}
                      </Text>
                    </View>

                    {unreadCount > 0 && (
                      <View style={styles.unreadCountBadge}>
                        <Text style={styles.unreadCountText}>{unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="chat-bubble-outline" size={56} color="#B0BEC5" />
              <Text style={styles.emptyTitle}>No conversations found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? "Try searching for a different property or advisor."
                  : "Your inquiries and chats with property advisors will appear here."}
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
    backgroundColor: "#FFFFFF",
  },
  header: {
    backgroundColor: "#008069", // WhatsApp dark green
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusPill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 40,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: "#111B21",
    paddingHorizontal: 10,
  },
  clearSearch: {
    padding: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  filterChipActive: {
    backgroundColor: "#FFFFFF",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E0F2F1",
  },
  filterChipTextActive: {
    color: "#008069",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  threadItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  threadItemPressed: {
    backgroundColor: "#F5F5F5",
  },
  avatarWrap: {
    position: "relative",
    marginRight: 14,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E0F2F1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#008069",
  },
  unreadDotBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#25D366", // WhatsApp bright green
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  threadContent: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111B21",
    flex: 1,
    marginRight: 8,
  },
  contactNameUnread: {
    fontWeight: "700",
  },
  timestampText: {
    fontSize: 12,
    color: "#667781",
  },
  timestampUnread: {
    color: "#25D366",
    fontWeight: "600",
  },
  propertyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  propertyTitle: {
    fontSize: 12,
    color: "#008069",
    fontWeight: "500",
    flexShrink: 1,
  },
  roleTag: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  roleTagText: {
    fontSize: 10,
    color: "#2E7D32",
    fontWeight: "600",
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  previewText: {
    fontSize: 14,
    color: "#667781",
  },
  previewTextUnread: {
    color: "#111B21",
    fontWeight: "600",
  },
  unreadCountBadge: {
    backgroundColor: "#25D366", // WhatsApp green counter
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E0E0E0",
    marginLeft: 80,
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
    color: "#37474F",
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#78909C",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
});
