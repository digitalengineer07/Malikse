import { useSafeAreaInsets } from "react-native-safe-area-context";
import ExpandableSearch from "../../components/ExpandableSearch";
import FrostedChatBackground from "../../components/FrostedChatBackground";
import { AppTheme } from "../../constants/theme";
import TextInput from "../../components/FormInput";
import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import type { UserProfile } from "../../src/types/auth.types";
import { inquiryActivity } from "../../src/utils/inquiryActivity";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import { useLanguageStore } from "../../src/store/languageStore";
import { useAuthStore } from "../../src/store/authStore";
import { inquiryService, InquiryData } from "../../src/services/inquiryService";


interface MessageItem {
  sentAt?: number;
  id: string;
  sender: "them" | "me";
  text: string;
  time: string;
  attachment?: {
    title: string;
    type: "document" | "report" | "offer";
    size?: string;
  };
}

interface TagItem {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  bg: string;
  border?: string;
}

interface Conversation {
  id: string;
  activityAt: string;
  name: string;
  role: string;
  roleType: "owner" | "advisor" | "buyer";
  avatarLetter: string;
  avatarColor: string;
  verified: boolean;
  property: string;
  lastMsg: string;
  time: string;
  timestampNum: number;
  unread: boolean;
  tag1: TagItem;
  tag2: TagItem;
  messages: MessageItem[];
}

// Removed hardcoded INITIAL_CONVERSATIONS

export default function MessagesScreen() {
  const { user, authState, hydrated } = useAuthStore();
  if (!hydrated) return <ActivityIndicator />;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  return <MessagesContent key={user.id} user={user} />;
}

function MessagesContent({ user }: { user: UserProfile }) {
  const chatInsets = useSafeAreaInsets();
  const { language } = useLanguageStore();

  // Inject Google Fonts for authentic cursive script on web
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const fontId = "google-fonts-malikse-cursive";
      if (!document.getElementById(fontId)) {
        const link = document.createElement("link");
        link.id = fontId;
        link.rel = "stylesheet";
        link.href =
          "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Kalam:wght@400;700&display=swap";
        document.head.appendChild(link);
      }
    }
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOption, setSortOption] = useState<"latest" | "oldest">("latest");
  const [showSortModal, setShowSortModal] = useState<boolean>(false);

  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState<string>("");

  const [conversationCursor, setConversationCursor] = useState<string>();
  const [nextConversationCursor, setNextConversationCursor] = useState<string>();
  const [previousConversationCursors, setPreviousConversationCursors] = useState<(string | undefined)[]>([]);
  const [messageBefore, setMessageBefore] = useState<number | null>(null);
  const chatId = React.useRef(selectedChat?.id);
  chatId.current = selectedChat?.id;
  const [messageBusy, setMessageBusy] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const mapMessage = React.useCallback((m: NonNullable<InquiryData["messages"]>[number]): MessageItem => ({ id: m._id, sender: m.senderId === user.id ? "me" : "them", text: m.text, sentAt: Date.parse(m.createdAt), time: new Date(m.createdAt).toLocaleString() }), [user.id]);
  const selectedChatId = selectedChat?.id;
  useFocusEffect(React.useCallback(() => {
    if (!selectedChatId) return;
    let active = true, fetching = false, first = true;
    const id = selectedChatId;
    setMessageBefore(null);
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const page = await inquiryService.getMessages(id);
        if (!active) return;
        const initial = first;
        if (first) { setMessageBefore(page.nextBefore); first = false; }
        setSelectedChat(current => current?.id !== id ? current : { ...current, messages: [...new Map([...current.messages.filter(m => !m.id.startsWith("m_") && (!initial || m.id.endsWith("_m1") || m.id.endsWith("_m2"))), ...page.messages.map(mapMessage)].map(m => [m.id, m])).values()].sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0)) });
      } catch { if (active) setNetworkError("Could not refresh messages. Please try again."); }
      finally { fetching = false; }
    };
    void refresh(); const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedChatId, mapMessage]));
  const olderMessages = async () => {
    if (!selectedChat || messageBefore === null || messageBusy) return;
    const id = selectedChat.id; setMessageBusy(true);
    try {
      const page = await inquiryService.getMessages(id, messageBefore);
      if (chatId.current !== id) return;
      setSelectedChat(current => current?.id !== id ? current : { ...current, messages: [...new Map([...page.messages.map(mapMessage), ...current.messages].map(m => [m.id, m])).values()].sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0)) });
      setMessageBefore(page.nextBefore);
    } catch { setNetworkError("Could not load older messages"); } finally { setMessageBusy(false); }
  };
  useFocusEffect(React.useCallback(() => {
    let active = true;
    
    let fetching = false;
    const fetchInquiries = () => {
      if (fetching) return;
      fetching = true;
      return inquiryService.getConversations(conversationCursor).then(all => {
      if (!active) return;
      setNextConversationCursor((all as any).nextCursor);
      const mapped = all.map(i => {
        const buyerIdStr = typeof i.buyerId === "object" && i.buyerId !== null ? i.buyerId._id : i.buyerId;
        const isBuyer = buyerIdStr === user.id;
        
        const otherPerson = isBuyer ? i.sellerId : i.buyerId;
        const otherName = otherPerson?.name || "Unknown User";
        const isOffer = !!i.offerAmount;
        const activity = inquiryActivity(i, user.id);
        if (selectedChat?.id === i._id && activity.unread) {
          inquiryService.markRead(i._id, activity.activityAt).catch(() => {});
        }
        
        return {
          id: i._id,
          name: otherName,
          role: isBuyer ? "Owner" : "Buyer",
          roleType: isBuyer ? "owner" : "buyer",
          avatarLetter: otherName.charAt(0).toUpperCase(),
          avatarColor: isBuyer ? "#0D9488" : "#C2410C",
          verified: false,
          property: i.propertyId?.title || "Property Listing",
          ...activity,
          tag1: isOffer ? {
            label: "Offer Submitted",
            icon: "payments",
            color: "#065F46",
            bg: "#ECFDF5",
            border: "#A7F3D0",
          } : {
            label: "Inquiry",
            icon: "help",
            color: "#6D28D9",
            bg: "#F5F3FF",
            border: "#DDD6FE",
          },
          tag2: {
            label: isBuyer ? "Owner" : "Buyer",
            icon: "person",
            color: "#C2410C",
            bg: "#FFF7ED",
            border: "#FED7AA",
          },
          messages: [
            {
              id: i._id + "_m1",
              sender: isBuyer ? "me" : "them",
              text: i.message,
              time: new Date(i.createdAt).toLocaleString(),
            },
            ...(isOffer ? [{
              id: i._id + "_m2",
              sender: isBuyer ? "me" : "them" as const,
              text: `Offer of ₹${i.offerAmount?.toLocaleString("en-IN")} submitted for review.`,
              time: new Date(i.createdAt).toLocaleString(),
            }] : []),
            ...(i.messages?.map(m => ({
              id: m._id,
              sender: m.senderId === user.id ? "me" : "them" as const,
              text: m.text,
              sentAt: Date.parse(m.createdAt),
              time: new Date(m.createdAt).toLocaleString(),
            })) || [])
          ]
        } as Conversation;
      });
      setConversations(mapped);
      setLoading(false);
      
      setSelectedChat(prev => {
        if (!prev) return prev;
        const updatedChat = mapped.find(c => c.id === prev.id);
        return updatedChat ? { ...updatedChat, messages: prev.messages } : prev;
      });
    }).catch(() => { if (active) setNetworkError("Could not load conversations. Please try again."); }).finally(() => { fetching = false; if (active) setLoading(false); });
    };

    fetchInquiries();
    const intervalId = setInterval(fetchInquiries, 5000);

    return () => { active = false; clearInterval(intervalId); };
  }, [user, selectedChat?.id, conversationCursor]));

  // Unread count
  const unreadCount = useMemo(() => {
    return conversations.filter((c) => c.unread).length;
  }, [conversations]);

  // Filtered & sorted conversations
  const filteredConversations = useMemo(() => {
    let list = [...conversations];

    // Tab Filter
    if (activeTab === "unread") {
      list = list.filter((c) => c.unread);
    } else if (activeTab === "archived") {
      list = []; // No archived items initially
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.property.toLowerCase().includes(q) ||
          c.lastMsg.toLowerCase().includes(q) || c.messages.some(message => message.text.toLowerCase().includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortOption === "latest") {
        return b.timestampNum - a.timestampNum;
      } else {
        return a.timestampNum - b.timestampNum;
      }
    });

    return list;
  }, [conversations, activeTab, searchQuery, sortOption]);

  const handleOpenChat = (c: Conversation) => {
    setSelectedChat(c);
    inquiryService.markRead(c.id, c.activityAt).catch(() => {});
    // Mark conversation as read
    if (c.unread) {
      setConversations((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, unread: false } : item))
      );
    }
  };

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedChat) return;

    const currentText = replyText.trim();
    setReplyText("");

    try {
      const response = await inquiryService.sendMessage(selectedChat.id, currentText);
      const saved = response.messages?.at(-1);
      const newMsg: MessageItem = saved ? mapMessage(saved) : { id: `m_${Date.now()}`, sender: "me", text: currentText, time: "Just now", sentAt: Date.now() };

      const updated = {
        ...selectedChat,
        messages: [...selectedChat.messages, newMsg],
        lastMsg: currentText,
        time: "Just now",
        timestampNum: Date.now(),
      };

      setSelectedChat(current => current?.id === updated.id ? { ...updated, messages: [...new Map([...current.messages, newMsg].map(m => [m.id, m])).values()] } : current);
      setConversations((prev) =>
        prev.map((item) => (item.id === selectedChat.id ? updated : item))
      );
    } catch (err: any) {
      setReplyText(value => value || currentText);
      setNetworkError(err.response?.data?.error || "Message was not sent. Please retry.");
    }
  };

  return (
    <View style={styles.screen}>
      {/* 1. Global Brand Header */}
      <AppHeader
        showBack={false}
        showNavLinks={false}
        showLanguageToggle={true}
        showPostPropertyBtn={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= 2. HERO BANNER (TOP CONTAINER) ================= */}
        <View style={styles.heroCard}>
          {/* Content Layer (Overlays) */}
          <View style={styles.heroContentLayer} pointerEvents="box-none">
            {/* Top Row: Direct Messages title on left + Cursive Script on right */}
            <View style={styles.heroTopRow}>
              <View style={styles.heroTitlesWrap}>
                <Text style={styles.heroCategoryLabel}>
                  {language === "hi" ? "सीधे संदेश" : "DIRECT MESSAGES"}
                </Text>
                <Text style={styles.heroHeadline}>
                  Secure Conversations{"\n"}for Better Deals
                </Text>
                <Text style={styles.heroSubtitle}>
                  Connect, share documents and stay updated{"\n"}with buyers, owners and advisors.
                </Text>
              </View>

              {/* Right Top Cursive Script */}
              <View style={styles.heroCursiveWrap}>
                <Text style={styles.heroCursiveText}>
                  Good Conversations{"\n"}Build Great{"\n"}Opportunities
                </Text>
              </View>
            </View>

            {/* Bottom 3 Floating Feature Pills */}
            <View style={styles.heroPillsRow}>
              {/* Pill 1: Protected by OTP */}
              <View style={styles.heroPill}>
                <View style={styles.heroPillIconBox}>
                  <MaterialIcons name="lock" size={14} color="#059669" />
                </View>
                <View style={styles.heroPillTextWrap}>
                  <Text style={styles.heroPillTitle}>Protected</Text>
                  <Text style={styles.heroPillSub}>by OTP</Text>
                </View>
              </View>

              {/* Pill 2: No Spam Genuine Users Only */}
              <View style={styles.heroPill}>
                <View style={styles.heroPillIconBox}>
                  <MaterialIcons name="verified-user" size={14} color="#059669" />
                </View>
                <View style={styles.heroPillTextWrap}>
                  <Text style={styles.heroPillTitle}>No Spam</Text>
                  <Text style={styles.heroPillSub} numberOfLines={1}>
                    Genuine Users
                  </Text>
                </View>
              </View>

              {/* Pill 3: Trusted Platform Verified People */}
              <View style={styles.heroPill}>
                <View style={styles.heroPillIconBox}>
                  <FontAwesome5 name="handshake" size={12} color="#059669" />
                </View>
                <View style={styles.heroPillTextWrap}>
                  <Text style={styles.heroPillTitle} numberOfLines={1}>
                    Trusted Platform
                  </Text>
                  <Text style={styles.heroPillSub} numberOfLines={1}>
                    Verified People
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ================= 3. SEARCH & SORT ROW ================= */}
        <View style={styles.searchSortRow}>
          <ExpandableSearch value={searchQuery} onChangeText={setSearchQuery} language={language} />

          {/* Sort Dropdown */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortModal(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="swap-vert" size={16} color="#0F172A" />
            <Text style={styles.sortButtonText}>
              {sortOption === "latest" ? "Latest First" : "Oldest First"}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={16} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* ================= 4. SEGMENTED FILTER TABS ================= */}
        <View style={styles.tabsContainer}>
          {/* All Messages */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "all" && styles.tabBtnActive]}
            onPress={() => setActiveTab("all")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
              All Messages
            </Text>
          </TouchableOpacity>

          {/* Unread */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "unread" && styles.tabBtnActive]}
            onPress={() => setActiveTab("unread")}
            activeOpacity={0.8}
          >
            <View style={styles.unreadTabContent}>
              <Text style={[styles.tabText, activeTab === "unread" && styles.tabTextActive]}>
                Unread
              </Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Archived */}
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "archived" && styles.tabBtnActive]}
            onPress={() => setActiveTab("archived")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === "archived" && styles.tabTextActive]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================= 5. MESSAGE LIST CARDS ================= */}
        <View style={styles.messagesList}>
          {!!networkError && <Text accessibilityRole="alert">{networkError}</Text>}
          {previousConversationCursors.length > 0 && <TouchableOpacity onPress={() => { setConversationCursor(previousConversationCursors.at(-1)); setPreviousConversationCursors(old => old.slice(0, -1)); }}><Text>Previous conversations</Text></TouchableOpacity>}
          {nextConversationCursor && <TouchableOpacity onPress={() => { setPreviousConversationCursors(old => [...old, conversationCursor]); setConversationCursor(nextConversationCursor); }}><Text>More conversations</Text></TouchableOpacity>}

          {loading ? (
            <ActivityIndicator size="large" color="#059669" style={{ marginVertical: 40 }} />
          ) : filteredConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="mail-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No messages found</Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? "No conversations match your search terms."
                  : activeTab === "unread"
                  ? "You have caught up with all your messages."
                  : "No conversations archived yet."}
              </Text>
            </View>
          ) : (
            filteredConversations.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => handleOpenChat(item)}
                activeOpacity={0.9}
              >
                <View style={styles.cardRow}>
                  {/* Left Avatar */}
                  <View style={styles.avatarWrap}>
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: item.avatarColor || "#059669" },
                      ]}
                    >
                      <Text style={styles.avatarLetter}>{item.avatarLetter}</Text>
                    </View>

                    {/* Verified check badge on avatar corner */}
                    {item.verified && (
                      <View style={styles.verifiedBadgeCorner}>
                        <MaterialIcons name="check" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </View>

                  {/* Right Content Area */}
                  <View style={styles.cardContent}>
                    {/* Top Row: Name and Time / Unread Dot */}
                    <View style={styles.nameRow}>
                      <Text style={styles.senderName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.timeWrap}>
                        <Text style={styles.timeText}>{item.time}</Text>
                        {item.unread && <View style={styles.unreadDot} />}
                      </View>
                    </View>

                    {/* Property / Task Pin Row */}
                    <View style={styles.propertyRow}>
                      <MaterialIcons name="place" size={13} color="#059669" />
                      <Text style={styles.propertyText} numberOfLines={1}>
                        {item.property}
                      </Text>
                    </View>

                    {/* Last message snippet & chevron */}
                    <View style={styles.snippetRow}>
                      <Text style={styles.snippetText} numberOfLines={1}>
                        {item.lastMsg}
                      </Text>
                      <MaterialIcons name="chevron-right" size={18} color="#94A3B8" />
                    </View>

                    {/* Tags Row */}
                    <View style={styles.tagsRow}>
                      {item.tag1 && (
                        <View
                          style={[
                            styles.tagPill,
                            {
                              backgroundColor: item.tag1.bg || "#ECFDF5",
                              borderColor: item.tag1.border || "#A7F3D0",
                            },
                          ]}
                        >
                          <MaterialIcons
                            name={item.tag1.icon}
                            size={12}
                            color={item.tag1.color || "#065F46"}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              { color: item.tag1.color || "#065F46" },
                            ]}
                          >
                            {item.tag1.label}
                          </Text>
                        </View>
                      )}

                      {item.tag2 && (
                        <View
                          style={[
                            styles.tagPill,
                            {
                              backgroundColor: item.tag2.bg || "#ECFDF5",
                              borderColor: item.tag2.border || "#A7F3D0",
                            },
                          ]}
                        >
                          <MaterialIcons
                            name={item.tag2.icon}
                            size={12}
                            color={item.tag2.color || "#065F46"}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              { color: item.tag2.color || "#065F46" },
                            ]}
                          >
                            {item.tag2.label}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* ================= 6. SORT SELECTION MODAL ================= */}
      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModalBox}>
            <Text style={styles.sortModalTitle}>Sort Messages</Text>

            <TouchableOpacity
              style={[
                styles.sortOptionRow,
                sortOption === "latest" && styles.sortOptionRowActive,
              ]}
              onPress={() => {
                setSortOption("latest");
                setShowSortModal(false);
              }}
            >
              <MaterialIcons
                name="schedule"
                size={18}
                color={sortOption === "latest" ? "#065F46" : "#64748B"}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === "latest" && styles.sortOptionTextActive,
                ]}
              >
                Latest First
              </Text>
              {sortOption === "latest" && (
                <MaterialIcons name="check" size={18} color="#065F46" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortOptionRow,
                sortOption === "oldest" && styles.sortOptionRowActive,
              ]}
              onPress={() => {
                setSortOption("oldest");
                setShowSortModal(false);
              }}
            >
              <MaterialIcons
                name="history"
                size={18}
                color={sortOption === "oldest" ? "#065F46" : "#64748B"}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === "oldest" && styles.sortOptionTextActive,
                ]}
              >
                Oldest First
              </Text>
              {sortOption === "oldest" && (
                <MaterialIcons name="check" size={18} color="#065F46" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ================= 7. INTERACTIVE CHAT SCREEN MODAL ================= */}
      {selectedChat && (
        <Modal
          visible={true}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedChat(null)}
        >
          <KeyboardAvoidingView
            style={styles.chatModalContainer}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <FrostedChatBackground />
            {/* Chat Top Bar */}
            <View style={[styles.chatHeader, { paddingTop: chatInsets.top + 12 }]}>
              <TouchableOpacity
                accessibilityRole="button" accessibilityLabel="Close conversation"
                style={styles.chatBackBtn}
                onPress={() => setSelectedChat(null)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
              </TouchableOpacity>

              <View
                style={[
                  styles.chatHeaderAvatar,
                  { backgroundColor: selectedChat.avatarColor || "#059669" },
                ]}
              >
                <Text style={styles.chatHeaderAvatarText}>
                  {selectedChat.avatarLetter}
                </Text>
              </View>

              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName} numberOfLines={1}>
                  {selectedChat.name}
                </Text>
                <Text style={styles.chatHeaderProp} numberOfLines={1}>
                  {selectedChat.property}
                </Text>
              </View>

              {/* OTP Protected Badge */}
              <View style={styles.otpHeaderBadge}>
                <MaterialIcons name="shield" size={13} color="#059669" />
                <Text style={styles.otpHeaderBadgeText}>OTP Verified</Text>
              </View>
            </View>

            {/* Messages Scroll View */}
            <ScrollView
              style={styles.chatScrollView}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Security notice banner */}
              <View style={styles.chatSecurityBanner}>
                <MaterialIcons name="lock" size={14} color="#059669" />
                <Text style={styles.chatSecurityBannerText}>
                  End-to-end verified deal communication with OTP protection.
                </Text>
              </View>

              {!!networkError && <Text accessibilityRole="alert">{networkError}</Text>}
                {messageBefore !== null && <TouchableOpacity disabled={messageBusy} onPress={olderMessages}><Text>{messageBusy ? "Loading…" : "Load older messages"}</Text></TouchableOpacity>}
                {selectedChat.messages.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.msgWrapper,
                    msg.sender === "me" ? styles.msgWrapperMe : styles.msgWrapperThem,
                  ]}
                >
                  <View
                    style={[
                      styles.msgBubble,
                      msg.sender === "me" ? styles.msgBubbleMe : styles.msgBubbleThem,
                    ]}
                  >
                    <Text
                      style={[
                        styles.msgText,
                        msg.sender === "me" ? styles.msgTextMe : styles.msgTextThem,
                      ]}
                    >
                      {msg.text}
                    </Text>

                    {/* Attachment preview if present */}
                    {msg.attachment && (
                      <View style={styles.attachmentCard}>
                        <View style={styles.attachmentIconBox}>
                          <MaterialIcons
                            name={
                              msg.attachment.type === "offer"
                                ? "payments"
                                : "description"
                            }
                            size={18}
                            color="#059669"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.attachmentTitle} numberOfLines={1}>
                            {msg.attachment.title}
                          </Text>
                          {msg.attachment.size && (
                            <Text style={styles.attachmentSize}>
                              {msg.attachment.size}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity style={styles.attachmentDownloadBtn} activeOpacity={0.7}>
                          <MaterialIcons name="file-download" size={16} color="#065F46" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.msgTime,
                        msg.sender === "me" ? styles.msgTimeMe : styles.msgTimeThem,
                      ]}
                    >
                      {msg.time}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Chat Composer Input Row */}
            <View style={[styles.chatComposer, { paddingBottom: chatInsets.bottom + 12 }]}>
              <TouchableOpacity style={styles.composerAttachBtn} activeOpacity={0.7}>
                <MaterialIcons name="attach-file" size={20} color="#64748B" />
              </TouchableOpacity>

              <TextInput
                style={styles.composerInput}
                placeholder="Type your message..."
                placeholderTextColor="#94A3B8"
                value={replyText}
                onChangeText={setReplyText}
                multiline
              />

              <TouchableOpacity
                style={[
                  styles.composerSendBtn,
                  !replyText.trim() && styles.composerSendBtnDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!replyText.trim()}
                activeOpacity={0.8}
              >
                <MaterialIcons name="send" size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContainer: {
    paddingBottom: 24,
  },

  /* ================= HERO BANNER ================= */
  heroCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 14,
    height: 222,
    borderRadius: 22,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    backgroundColor: "transparent",
  },
  heroBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  heroContentLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroTitlesWrap: {
    flex: 1,
    paddingRight: 6,
  },
  heroCategoryLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: AppTheme.colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroHeadline: {
    fontSize: 20.5,
    fontWeight: "900",
    color: AppTheme.colors.text,
    lineHeight: 25,
    letterSpacing: -0.4,
    marginTop: 3,
  },
  heroSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
    marginTop: 4,
  },
  heroCursiveWrap: {
    alignItems: "flex-end",
    paddingTop: 1,
  },
  heroCursiveText: {
    fontFamily: Platform.OS === "web" ? "Caveat, Kalam, 'Segoe Script', cursive" : (Platform.OS === "ios" ? "Snell Roundhand" : "serif"),
    fontSize: 13.5,
    color: "#166534",
    fontStyle: "italic",
    textAlign: "right",
    lineHeight: 17,
    transform: [{ rotate: "-4deg" }],
    fontWeight: "700",
  },
  heroPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroPill: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  heroPillIconBox: {
    width: 25,
    height: 25,
    borderRadius: 7,
    backgroundColor: "#E6F4EA",
    justifyContent: "center",
    alignItems: "center",
  },
  heroPillTextWrap: {
    flex: 1,
  },
  heroPillTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  heroPillSub: {
    fontSize: 8.5,
    color: AppTheme.colors.textSecondary,
    fontWeight: "600",
    marginTop: 1,
  },

  /* ================= SEARCH & SORT ROW ================= */
  searchSortRow: {
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sortButton: {
    height: 42,
    backgroundColor: "transparent",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppTheme.colors.text,
  },

  /* ================= SEGMENTED TABS ================= */
  tabsContainer: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#EEF2F6",
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: AppTheme.colors.textSecondary,
  },
  tabTextActive: {
    color: "#065F46",
    fontWeight: "800",
  },
  unreadTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: "#A7F3D0",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 9999,
  },
  unreadBadgeText: {
    color: "#065F46",
    fontSize: 11,
    fontWeight: "800",
  },

  /* ================= MESSAGE CARDS ================= */
  messagesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarWrap: {
    position: "relative",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },
  verifiedBadgeCorner: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: AppTheme.colors.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  senderName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
    flex: 1,
    marginRight: 6,
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: AppTheme.colors.textSecondary,
    fontWeight: "600",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppTheme.colors.primary,
  },
  propertyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  propertyText: {
    fontSize: 11.5,
    color: AppTheme.colors.textSecondary,
    fontWeight: "600",
    flex: 1,
  },
  snippetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 8,
  },
  snippetText: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 16,
    flex: 1,
    marginRight: 6,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: "700",
  },

  /* Empty State */
  emptyState: {
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: AppTheme.colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: AppTheme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },

  /* ================= SORT MODAL ================= */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sortModalBox: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  sortModalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: AppTheme.colors.text,
    marginBottom: 14,
  },
  sortOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  sortOptionRowActive: {
    backgroundColor: "#E6F4EA",
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: AppTheme.colors.textSecondary,
    flex: 1,
  },
  sortOptionTextActive: {
    color: "#065F46",
    fontWeight: "800",
  },

  /* ================= CHAT MODAL ================= */
  chatModalContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 10,
  },
  chatBackBtn: {
    minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center",
    padding: 4,
  },
  chatHeaderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderAvatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 13.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  chatHeaderProp: {
    fontSize: 11,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 1,
  },
  otpHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  otpHeaderBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#065F46",
  },
  chatScrollView: {
    flex: 1,
  },
  chatScrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  chatSecurityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  chatSecurityBannerText: {
    fontSize: 11,
    color: "#065F46",
    fontWeight: "600",
    flex: 1,
  },
  msgWrapper: {
    flexDirection: "row",
    width: "100%",
  },
  msgWrapperThem: {
    justifyContent: "flex-start",
  },
  msgWrapperMe: {
    justifyContent: "flex-end",
  },
  msgBubble: {
    maxWidth: "82%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  msgBubbleThem: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderBottomLeftRadius: 4,
  },
  msgBubbleMe: {
    backgroundColor: "#0B4D3C",
    borderBottomRightRadius: 4,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  msgTextThem: {
    color: AppTheme.colors.text,
  },
  msgTextMe: {
    color: "#FFFFFF",
  },
  msgTime: {
    fontSize: 9.5,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  msgTimeThem: {
    color: "#94A3B8",
  },
  msgTimeMe: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  attachmentCard: {
    backgroundColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  attachmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#E6F4EA",
    justifyContent: "center",
    alignItems: "center",
  },
  attachmentTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: AppTheme.colors.text,
  },
  attachmentSize: {
    fontSize: 10,
    color: AppTheme.colors.textSecondary,
    marginTop: 1,
  },
  attachmentDownloadBtn: {
    padding: 6,
  },
  chatComposer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 8,
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
  },
  composerAttachBtn: {
    padding: 6,
  },
  composerInput: {
    flex: 1,
    maxHeight: 90,
    backgroundColor: "transparent",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: AppTheme.colors.text,
    outlineStyle: "none" as any,
  },
  composerSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  composerSendBtnDisabled: {
    backgroundColor: "#CBD5E1",
  },
});
