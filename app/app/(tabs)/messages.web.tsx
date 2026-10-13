import ExpandableSearch from "../../components/ExpandableSearch";
import FrostedChatBackground from "../../components/FrostedChatBackground";
import { AppTheme } from "../../constants/theme";
import TextInput from "../../components/FormInput";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import type { UserProfile } from "../../src/types/auth.types";
import { inquiryActivity } from "../../src/utils/inquiryActivity";
import { MaterialIcons } from "@expo/vector-icons";
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

interface Conversation {
  id: string;
  activityAt: string;
  name: string;
  role: string;
  roleType: "owner" | "advisor" | "buyer" | "agent";
  avatarLetter: string;
  avatarColor: string;
  verified: boolean;
  property: string;
  lastMsg: string;
  time: string;
  unread: boolean;
  timestampNum: number;
  tag1: { label: string; icon: string; color: string; bg: string; border: string };
  tag2: { label: string; icon: string; color: string; bg: string; border: string };
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
  const { language } = useLanguageStore();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "buyers" | "agents" | "advisors" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showSupportModal, setShowSupportModal] = useState(false);

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
            label: "Offer",
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

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Category Filter
    if (activeFilter === "unread" && !c.unread) return false;
    if (activeFilter === "buyers" && c.roleType !== "buyer") return false;
    if (activeFilter === "agents" && c.roleType !== "agent") return false;
    if (activeFilter === "advisors" && c.roleType !== "advisor") return false;
    if (activeFilter === "archived") return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(q);
      const matchProp = c.property.toLowerCase().includes(q);
      const matchMsg = c.lastMsg.toLowerCase().includes(q) || c.messages.some(message => message.text.toLowerCase().includes(q));
      return matchName || matchProp || matchMsg;
    }
    return true;
  }).sort((a, b) => sortOrder === "latest" ? b.timestampNum - a.timestampNum : a.timestampNum - b.timestampNum);

  const handleOpenChat = (c: Conversation) => {
    setSelectedChat(c);
    inquiryService.markRead(c.id, c.activityAt).catch(() => {});
    // Mark as read
    setConversations((prev) =>
      prev.map((item) => (item.id === c.id ? { ...item, unread: false } : item))
    );
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
      {/* Universal Brand AppHeader navbar */}
      <AppHeader
        showBack={false}
        showNavLinks={true}
        showLanguageToggle={true}
        showPostPropertyBtn={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          {/* ================= 1. LEFT EXECUTIVE SIDEBAR ================= */}
          {isDesktop && (
            <View style={styles.sidebar}>
              {/* Sidebar Header Badge */}
              <View style={styles.sidebarHeaderBox}>
                <View style={styles.sidebarHeaderIconSquare}>
                  <MaterialIcons name="chat" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.sidebarHeaderTitle}>
                  {language === "hi" ? "संदेश" : "Messages"}
                </Text>
              </View>

              {/* Navigation Menu Filter List */}
              <View style={styles.sidebarMenu}>
                {/* All Messages */}
                <TouchableOpacity
                  style={[
                    styles.sidebarNavItem,
                    activeFilter === "all" && styles.sidebarNavItemActive,
                  ]}
                  onPress={() => setActiveFilter("all")}
                  activeOpacity={0.8}
                >
                  <View style={styles.sidebarNavLeft}>
                    <MaterialIcons
                      name="chat"
                      size={18}
                      color={activeFilter === "all" ? "#065F46" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sidebarNavText,
                        activeFilter === "all" && styles.sidebarNavTextActive,
                      ]}
                    >
                      {language === "hi" ? "सभी संदेश" : "All Messages"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sidebarBadge,
                      activeFilter === "all" && styles.sidebarBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarBadgeText,
                        activeFilter === "all" && styles.sidebarBadgeTextActive,
                      ]}
                    >
                      3
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Unread */}
                <TouchableOpacity
                  style={[
                    styles.sidebarNavItem,
                    activeFilter === "unread" && styles.sidebarNavItemActive,
                  ]}
                  onPress={() => setActiveFilter("unread")}
                  activeOpacity={0.8}
                >
                  <View style={styles.sidebarNavLeft}>
                    <MaterialIcons
                      name="mark-chat-unread"
                      size={18}
                      color={activeFilter === "unread" ? "#065F46" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sidebarNavText,
                        activeFilter === "unread" && styles.sidebarNavTextActive,
                      ]}
                    >
                      {language === "hi" ? "अपठित" : "Unread"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sidebarBadge,
                      activeFilter === "unread" && styles.sidebarBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarBadgeText,
                        activeFilter === "unread" && styles.sidebarBadgeTextActive,
                      ]}
                    >
                      1
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Buyers */}
                <TouchableOpacity
                  style={[
                    styles.sidebarNavItem,
                    activeFilter === "buyers" && styles.sidebarNavItemActive,
                  ]}
                  onPress={() => setActiveFilter("buyers")}
                  activeOpacity={0.8}
                >
                  <View style={styles.sidebarNavLeft}>
                    <MaterialIcons
                      name="person-outline"
                      size={18}
                      color={activeFilter === "buyers" ? "#065F46" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sidebarNavText,
                        activeFilter === "buyers" && styles.sidebarNavTextActive,
                      ]}
                    >
                      {language === "hi" ? "खरीदार" : "Buyers"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sidebarBadge,
                      activeFilter === "buyers" && styles.sidebarBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarBadgeText,
                        activeFilter === "buyers" && styles.sidebarBadgeTextActive,
                      ]}
                    >
                      2
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Brokers / Agents */}
                <TouchableOpacity
                  style={[
                    styles.sidebarNavItem,
                    activeFilter === "agents" && styles.sidebarNavItemActive,
                  ]}
                  onPress={() => setActiveFilter("agents")}
                  activeOpacity={0.8}
                >
                  <View style={styles.sidebarNavLeft}>
                    <MaterialIcons
                      name="groups"
                      size={18}
                      color={activeFilter === "agents" ? "#065F46" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sidebarNavText,
                        activeFilter === "agents" && styles.sidebarNavTextActive,
                      ]}
                    >
                      {language === "hi" ? "दलाल / एजेंट" : "Brokers / Agents"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sidebarBadge,
                      activeFilter === "agents" && styles.sidebarBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarBadgeText,
                        activeFilter === "agents" && styles.sidebarBadgeTextActive,
                      ]}
                    >
                      1
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Advisors */}
                <TouchableOpacity
                  style={[
                    styles.sidebarNavItem,
                    activeFilter === "advisors" && styles.sidebarNavItemActive,
                  ]}
                  onPress={() => setActiveFilter("advisors")}
                  activeOpacity={0.8}
                >
                  <View style={styles.sidebarNavLeft}>
                    <MaterialIcons
                      name="support-agent"
                      size={18}
                      color={activeFilter === "advisors" ? "#065F46" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sidebarNavText,
                        activeFilter === "advisors" && styles.sidebarNavTextActive,
                      ]}
                    >
                      {language === "hi" ? "सलाहकार" : "Advisors"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sidebarBadge,
                      activeFilter === "advisors" && styles.sidebarBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarBadgeText,
                        activeFilter === "advisors" && styles.sidebarBadgeTextActive,
                      ]}
                    >
                      0
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Archived */}
                <TouchableOpacity
                  style={[
                    styles.sidebarNavItem,
                    activeFilter === "archived" && styles.sidebarNavItemActive,
                  ]}
                  onPress={() => setActiveFilter("archived")}
                  activeOpacity={0.8}
                >
                  <View style={styles.sidebarNavLeft}>
                    <MaterialIcons
                      name="archive"
                      size={18}
                      color={activeFilter === "archived" ? "#065F46" : "#64748B"}
                    />
                    <Text
                      style={[
                        styles.sidebarNavText,
                        activeFilter === "archived" && styles.sidebarNavTextActive,
                      ]}
                    >
                      {language === "hi" ? "अभिलेखागार" : "Archived"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.sidebarBadge,
                      activeFilter === "archived" && styles.sidebarBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sidebarBadgeText,
                        activeFilter === "archived" && styles.sidebarBadgeTextActive,
                      ]}
                    >
                      0
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Need Help? Promo Card */}
              <View style={styles.sidebarHelpCard}>
                <View style={styles.sidebarHelpTopRow}>
                  <View style={styles.sidebarHelpIconCircle}>
                    <MaterialIcons name="headset-mic" size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sidebarHelpTitle}>
                      {language === "hi" ? "मदद चाहिए?" : "Need Help?"}
                    </Text>
                    <Text style={styles.sidebarHelpSubtitle}>
                      {language === "hi"
                        ? "किसी भी समय स्पैम या संदिग्ध गतिविधि की रिपोर्ट करें।"
                        : "Report spam or suspicious activity anytime."}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.sidebarHelpBtn}
                  onPress={() => setShowSupportModal(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sidebarHelpBtnText}>
                    {language === "hi" ? "सहायता से संपर्क करें" : "Contact Support"}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={13} color="#059669" />
                </TouchableOpacity>
              </View>

              {/* Sidebar Bottom Landscape Contour Graphic */}
              <View style={styles.sidebarFooterGraphicWrap}>
                {Platform.OS === "web" ? (
                  <svg
                    viewBox="0 0 240 90"
                    width="100%"
                    height="90"
                    style={{ display: "block" }}
                  >
                    <defs>
                      <linearGradient id="sideMtnGradMsg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.65" />
                        <stop offset="100%" stopColor="#D1FAE5" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,90 L0,50 Q45,25 90,45 Q135,20 180,48 Q210,40 240,55 L240,90 Z"
                      fill="url(#sideMtnGradMsg)"
                    />
                  </svg>
                ) : null}
                <View style={styles.sidebarCursiveWrap}>
                  <Text style={styles.sidebarCursiveText}>
                    Verified People{"\n"}Better Opportunities
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ================= 2. RIGHT MAIN CONTENT AREA ================= */}
          <View style={styles.mainContent}>

            {/* Search & Sort Controls Row */}
            <View style={styles.searchSortRow}>
          <ExpandableSearch value={searchQuery} onChangeText={setSearchQuery} language={language} />

              {/* Sort Pill Dropdown */}
              <TouchableOpacity
                style={styles.sortDropdownBtn}
                onPress={() => setSortOrder(sortOrder === "latest" ? "oldest" : "latest")}
                activeOpacity={0.85}
              >
                <MaterialIcons name="swap-vert" size={18} color="#0F172A" />
                <Text style={styles.sortDropdownText}>
                  {sortOrder === "latest"
                    ? language === "hi" ? "नवीनतम पहले" : "Latest First"
                    : language === "hi" ? "सबसे पुराना" : "Oldest First"}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Conversations List */}
            <View style={styles.conversationsContainer}>
          {!!networkError && <Text accessibilityRole="alert">{networkError}</Text>}
          {previousConversationCursors.length > 0 && <TouchableOpacity onPress={() => { setConversationCursor(previousConversationCursors.at(-1)); setPreviousConversationCursors(old => old.slice(0, -1)); }}><Text>Previous conversations</Text></TouchableOpacity>}
          {nextConversationCursor && <TouchableOpacity onPress={() => { setPreviousConversationCursors(old => [...old, conversationCursor]); setConversationCursor(nextConversationCursor); }}><Text>More conversations</Text></TouchableOpacity>}

              {loading ? (
                <ActivityIndicator size="large" color="#059669" style={{ marginVertical: 40 }} />
              ) : filteredConversations.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="chat-bubble-outline" size={44} color="#94A3B8" />
                  <Text style={styles.emptyHeading}>
                    {language === "hi" ? "कोई संदेश नहीं मिला" : "No messages found"}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {language === "hi"
                      ? "आपके वर्तमान फ़िल्टर या खोज के लिए कोई बातचीत उपलब्ध नहीं है।"
                      : "No conversations match your current filter or search criteria."}
                  </Text>
                </View>
              ) : (
                filteredConversations.map((item) => {
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.conversationCard,
                        item.unread && styles.conversationCardUnread,
                      ]}
                      onPress={() => handleOpenChat(item)}
                      activeOpacity={0.88}
                    >
                      {/* Left: Avatar with Verified Checkmark Badge */}
                      <View style={styles.avatarContainer}>
                        <View
                          style={[
                            styles.avatarCircle,
                            { backgroundColor: item.avatarColor },
                          ]}
                        >
                          <Text style={styles.avatarLetter}>{item.avatarLetter}</Text>
                        </View>
                        {item.verified && (
                          <View style={styles.verifiedCheckBadge}>
                            <MaterialIcons name="check" size={11} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      {/* Middle: Content Info */}
                      <View style={styles.convMainInfo}>
                        {/* Name & Title */}
                        <Text style={styles.convName}>{item.name}</Text>

                        {/* Property Location */}
                        <View style={styles.convPropRow}>
                          <MaterialIcons name="place" size={14} color="#059669" />
                          <Text style={styles.convPropText} numberOfLines={1}>
                            {item.property}
                          </Text>
                        </View>

                        {/* Last Message Preview */}
                        <Text
                          style={[
                            styles.convLastMsg,
                            item.unread && styles.convLastMsgUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {item.lastMsg}
                        </Text>

                        {/* Tags Badges Row */}
                        <View style={styles.convTagsRow}>
                          {/* Tag 1 */}
                          <View
                            style={[
                              styles.convTagPill,
                              {
                                backgroundColor: item.tag1.bg,
                                borderColor: item.tag1.border,
                              },
                            ]}
                          >
                            <MaterialIcons
                              name={item.tag1.icon as any}
                              size={13}
                              color={item.tag1.color}
                            />
                            <Text
                              style={[
                                styles.convTagText,
                                { color: item.tag1.color },
                              ]}
                            >
                              {item.tag1.label}
                            </Text>
                          </View>

                          {/* Tag 2 */}
                          <View
                            style={[
                              styles.convTagPill,
                              {
                                backgroundColor: item.tag2.bg,
                                borderColor: item.tag2.border,
                              },
                            ]}
                          >
                            <MaterialIcons
                              name={item.tag2.icon as any}
                              size={13}
                              color={item.tag2.color}
                            />
                            <Text
                              style={[
                                styles.convTagText,
                                { color: item.tag2.color },
                              ]}
                            >
                              {item.tag2.label}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Right: Timestamp, Unread Indicator & Chevron */}
                      <View style={styles.convRightMeta}>
                        <View style={styles.timeUnreadRow}>
                          <Text style={styles.convTimeText}>{item.time}</Text>
                          {item.unread && <View style={styles.unreadGreenDot} />}
                        </View>
                        <MaterialIcons
                          name="chevron-right"
                          size={24}
                          color="#64748B"
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Bottom Inspiring Quote Footer */}
            <View style={styles.bottomQuoteWrap}>
              <View style={styles.bottomQuoteLine} />
              <View style={styles.bottomQuoteRow}>
                <Text style={styles.bottomQuoteMarks}>“</Text>
                <Text style={styles.bottomQuoteText}>
                  {language === "hi"
                    ? "सार्थक बातचीत से बेहतर कल का निर्माण होता है।"
                    : "Meaningful conversations lead to better tomorrow."}
                </Text>
                <Text style={styles.bottomQuoteMarks}>”</Text>
              </View>
              <View style={styles.bottomQuoteLine} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ================= INTERACTIVE CHAT MODAL ================= */}
      {selectedChat && (
        <Modal
          visible={Boolean(selectedChat)}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedChat(null)}
        >
          <View style={styles.chatModalOverlay}>
            <View style={[styles.chatModalCard, isDesktop && styles.chatModalCardDesktop]}>
              <FrostedChatBackground />
              {/* Modal Header */}
              <View style={styles.chatModalHeader}>
                <View style={styles.chatModalHeaderLeft}>
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: selectedChat.avatarColor,
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarLetter, { fontSize: 18 }]}>
                      {selectedChat.avatarLetter}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.chatModalName}>{selectedChat.name}</Text>
                    <View style={styles.convPropRow}>
                      <MaterialIcons name="place" size={13} color="#059669" />
                      <Text style={styles.convPropText}>{selectedChat.property}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  accessibilityRole="button" accessibilityLabel="Close conversation"
                  style={styles.chatModalCloseBtn}
                  onPress={() => setSelectedChat(null)}
                >
                  <MaterialIcons name="close" size={22} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Chat Messages Body */}
              <ScrollView
                style={styles.chatMessagesScroll}
                contentContainerStyle={styles.chatMessagesContent}
              >
                {/* Security Trust Notice */}
                <View style={styles.chatTrustNotice}>
                  <MaterialIcons name="verified-user" size={16} color="#059669" />
                  <Text style={styles.chatTrustText}>
                    End-to-end consent gated conversation. Your phone & personal info remain private until mutual consent.
                  </Text>
                </View>

                {/* Message bubbles */}
                {!!networkError && <Text accessibilityRole="alert">{networkError}</Text>}
                {messageBefore !== null && <TouchableOpacity disabled={messageBusy} onPress={olderMessages}><Text>{messageBusy ? "Loading…" : "Load older messages"}</Text></TouchableOpacity>}
                {selectedChat.messages.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      styles.messageBubbleRow,
                      m.sender === "me" ? styles.messageBubbleRowMe : styles.messageBubbleRowThem,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        m.sender === "me" ? styles.messageBubbleMe : styles.messageBubbleThem,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          m.sender === "me" ? styles.messageTextMe : styles.messageTextThem,
                        ]}
                      >
                        {m.text}
                      </Text>

                      {/* Document Attachment card */}
                      {m.attachment && (
                        <View
                          style={[
                            styles.attachmentCard,
                            m.sender === "me"
                              ? styles.attachmentCardMe
                              : styles.attachmentCardThem,
                          ]}
                        >
                          <MaterialIcons
                            name={
                              m.attachment.type === "offer"
                                ? "payments"
                                : "description"
                            }
                            size={20}
                            color={m.sender === "me" ? "#FFFFFF" : "#059669"}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.attachmentTitle,
                                m.sender === "me" && { color: "#FFFFFF" },
                              ]}
                              numberOfLines={1}
                            >
                              {m.attachment.title}
                            </Text>
                            {m.attachment.size && (
                              <Text
                                style={[
                                  styles.attachmentSize,
                                  m.sender === "me" && { color: "#D1FAE5" },
                                ]}
                              >
                                {m.attachment.size}
                              </Text>
                            )}
                          </View>
                          <MaterialIcons
                            name="file-download"
                            size={18}
                            color={m.sender === "me" ? "#FFFFFF" : "#059669"}
                          />
                        </View>
                      )}

                      <Text
                        style={[
                          styles.messageTime,
                          m.sender === "me" ? styles.messageTimeMe : styles.messageTimeThem,
                        ]}
                      >
                        {m.time}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Chat Input Bar */}
              <View style={styles.chatInputBar}>
                <TouchableOpacity style={styles.chatAttachBtn} activeOpacity={0.7}>
                  <MaterialIcons name="attach-file" size={22} color="#64748B" />
                </TouchableOpacity>
                <TextInput
                  style={styles.chatTextInput}
                  placeholder={language === "hi" ? "संदेश लिखें..." : "Type a message..."}
                  placeholderTextColor="#94A3B8"
                  value={replyText}
                  onChangeText={setReplyText}
                  onSubmitEditing={handleSendMessage}
                />
                <TouchableOpacity
                  style={[
                    styles.chatSendBtn,
                    replyText.trim().length > 0 && styles.chatSendBtnActive,
                  ]}
                  onPress={handleSendMessage}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="send" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ================= SUPPORT MODAL ================= */}
      {showSupportModal && (
        <Modal
          visible={showSupportModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowSupportModal(false)}
        >
          <View style={styles.chatModalOverlay}>
            <View style={styles.supportModalCard}>
              <View style={styles.supportHeader}>
                <View style={styles.sidebarHelpIconCircle}>
                  <MaterialIcons name="headset-mic" size={24} color="#059669" />
                </View>
                <Text style={styles.supportTitle}>MalikSe Trust & Safety</Text>
                <TouchableOpacity
                  style={styles.chatModalCloseBtn}
                  onPress={() => setShowSupportModal(false)}
                >
                  <MaterialIcons name="close" size={22} color="#475569" />
                </TouchableOpacity>
              </View>

              <Text style={styles.supportBodyText}>
                Our trust & safety team monitors conversations 24/7 to protect verified land buyers and sellers. You can report spam, request phone unmasking, or speak to a dedicated relationship advisor.
              </Text>

              <View style={styles.supportOptions}>
                <TouchableOpacity style={styles.supportOptionBtn} activeOpacity={0.8}>
                  <MaterialIcons name="report" size={18} color="#DC2626" />
                  <Text style={styles.supportOptionText}>Report Suspicious Broker / Spam</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.supportOptionBtn} activeOpacity={0.8}>
                  <MaterialIcons name="lock-open" size={18} color="#059669" />
                  <Text style={styles.supportOptionText}>Request Mutual Phone Number Exchange</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.supportOptionBtn} activeOpacity={0.8}>
                  <MaterialIcons name="support-agent" size={18} color="#2563EB" />
                  <Text style={styles.supportOptionText}>Connect with Dedicated Advisor</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.supportCloseActionBtn}
                onPress={() => setShowSupportModal(false)}
              >
                <Text style={styles.supportCloseActionBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingBottom: 48,
  },
  mainLayout: {
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  mainLayoutDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 24,
  },

  /* ================= LEFT SIDEBAR ================= */
  sidebar: {
    width: 240,
    backgroundColor: "transparent",
  },
  sidebarHeaderBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sidebarHeaderIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  sidebarHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: AppTheme.colors.text,
    letterSpacing: -0.2,
  },
  sidebarMenu: {
    gap: 4,
    marginBottom: 20,
  },
  sidebarNavItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  sidebarNavItemActive: {
    backgroundColor: "#ECFDF5",
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
  },
  sidebarNavLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sidebarNavText: {
    fontSize: 13,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
  },
  sidebarNavTextActive: {
    color: "#065F46",
    fontWeight: "800",
  },
  sidebarBadge: {
    backgroundColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  sidebarBadgeActive: {
    backgroundColor: "#A7F3D0",
  },
  sidebarBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: AppTheme.colors.textSecondary,
  },
  sidebarBadgeTextActive: {
    color: "#065F46",
    fontWeight: "800",
  },

  /* Sidebar Help Card */
  sidebarHelpCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  sidebarHelpTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sidebarHelpIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarHelpTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  sidebarHelpSubtitle: {
    fontSize: 10.5,
    color: AppTheme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
  },
  sidebarHelpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "transparent",
    borderWidth: 1.2,
    borderColor: "#059669",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  sidebarHelpBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#059669",
  },

  /* Sidebar Bottom Graphic */
  sidebarFooterGraphicWrap: {
    position: "relative",
    width: "100%",
    height: 90,
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  sidebarCursiveWrap: {
    position: "absolute",
    bottom: 6,
    left: 8,
  },
  sidebarCursiveText: {
    fontFamily: Platform.OS === "web" ? "Kalam, Caveat, cursive" : "System",
    fontSize: 13,
    color: "#065F46",
    fontStyle: "italic",
    lineHeight: 16,
    opacity: 0.85,
  },

  /* ================= RIGHT MAIN CONTENT ================= */
  mainContent: {
    flex: 1,
  },

  /* Hero Header Banner */
  heroBannerCard: {
    width: "100%",
    minHeight: 135,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    marginBottom: 20,
  },
  heroBannerBackground: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    ...Platform.select({
      web: {
        objectFit: "cover",
        objectPosition: "center 70%",
      } as any,
    }),
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFill,
    pointerEvents: "none",
    ...Platform.select({
      web: {
        backgroundImage:
          "linear-gradient(90deg, rgba(230, 245, 238, 0.94) 0%, rgba(230, 245, 238, 0.88) 35%, rgba(230, 245, 238, 0.35) 65%, transparent 90%)",
      } as any,
      default: {
        backgroundColor: "transparent",
      },
    }),
  },
  heroLeftCol: {
    zIndex: 2,
    flex: 1,
    maxWidth: 620,
  },
  heroMainTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: AppTheme.colors.text,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: AppTheme.colors.textSecondary,
    fontWeight: "500",
    marginTop: 3,
    marginBottom: 12,
  },
  heroPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  heroPillCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
      } as any,
    }),
  },
  heroPillIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
  },
  heroPillTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  heroPillSub: {
    fontSize: 9.5,
    color: AppTheme.colors.textSecondary,
  },

  /* Cursive Script in Hero */
  heroCursiveBox: {
    zIndex: 2,
    alignItems: "center",
    transform: [{ rotate: "-4deg" }],
    marginHorizontal: 10,
  },
  heroCursiveText: {
    fontFamily: Platform.OS === "web" ? "Kalam, Caveat, cursive" : "System",
    fontSize: 17,
    color: "#065F46",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "700",
  },
  heroCursiveUnderline: {
    textDecorationLine: "underline",
  },

  /* Floating Quote Card */
  heroQuoteCard: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 180,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      } as any,
    }),
  },
  heroQuoteMark: {
    fontSize: 24,
    color: "#059669",
    fontWeight: "900",
    lineHeight: 24,
  },
  heroQuoteText: {
    fontSize: 11,
    fontWeight: "800",
    color: AppTheme.colors.text,
    lineHeight: 15,
  },

  /* Search & Sort Controls */
  searchSortRow: {
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sortDropdownBtn: {
    height: 44,
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 6,
    ...Platform.select({
      web: { cursor: "pointer" } as any,
    }),
  },
  sortDropdownText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppTheme.colors.text,
  },

  /* Conversations Cards List */
  conversationsContainer: {
    gap: 12,
  },
  conversationCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
      } as any,
    }),
  },
  conversationCardUnread: {
    borderColor: "#A7F3D0",
    backgroundColor: "#FAFCFB",
  },
  avatarContainer: {
    position: "relative",
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  verifiedCheckBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  /* Middle Conv Info */
  convMainInfo: {
    flex: 1,
    gap: 4,
  },
  convName: {
    fontSize: 15.5,
    fontWeight: "800",
    color: AppTheme.colors.text,
    letterSpacing: -0.2,
  },
  convPropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  convPropText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: AppTheme.colors.textSecondary,
  },
  convLastMsg: {
    fontSize: 13,
    color: AppTheme.colors.textSecondary,
    marginTop: 2,
  },
  convLastMsgUnread: {
    color: AppTheme.colors.text,
    fontWeight: "800",
  },
  convTagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  convTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 9999,
    borderWidth: 1,
  },
  convTagText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* Right Conv Meta */
  convRightMeta: {
    alignItems: "flex-end",
    gap: 8,
  },
  timeUnreadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  convTimeText: {
    fontSize: 12,
    color: AppTheme.colors.textSecondary,
    fontWeight: "600",
  },
  unreadGreenDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: AppTheme.colors.primary,
  },

  /* Bottom Quote */
  bottomQuoteWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 36,
    paddingHorizontal: 20,
  },
  bottomQuoteLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
    maxWidth: 140,
  },
  bottomQuoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bottomQuoteMarks: {
    fontSize: 20,
    fontWeight: "900",
    color: "#059669",
  },
  bottomQuoteText: {
    fontSize: 13,
    color: "#047857",
    fontWeight: "700",
    fontStyle: "italic",
    textAlign: "center",
  },

  /* Empty State */
  emptyCard: {
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  emptySubText: {
    fontSize: 13,
    color: AppTheme.colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },

  /* ================= CHAT MODAL ================= */
  chatModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  chatModalCard: {
    width: "100%",
    height: "85%",
    backgroundColor: "transparent",
    borderRadius: 20,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
      } as any,
    }),
  },
  chatModalCardDesktop: {
    maxWidth: 760,
  },
  chatModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "transparent",
  },
  chatModalHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatModalName: {
    fontSize: 15,
    fontWeight: "800",
    color: AppTheme.colors.text,
  },
  chatModalCloseBtn: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  chatMessagesScroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  chatMessagesContent: {
    padding: 20,
    gap: 14,
  },
  chatTrustNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  chatTrustText: {
    fontSize: 11.5,
    color: "#065F46",
    fontWeight: "500",
    flex: 1,
    lineHeight: 16,
  },
  messageBubbleRow: {
    flexDirection: "row",
  },
  messageBubbleRowThem: {
    justifyContent: "flex-start",
  },
  messageBubbleRowMe: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    gap: 6,
  },
  messageBubbleThem: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderTopLeftRadius: 4,
  },
  messageBubbleMe: {
    backgroundColor: AppTheme.colors.primary,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  messageTextThem: {
    color: AppTheme.colors.text,
  },
  messageTextMe: {
    color: "#FFFFFF",
  },
  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  attachmentCardThem: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  attachmentCardMe: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  attachmentTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: AppTheme.colors.text,
  },
  attachmentSize: {
    fontSize: 10.5,
    color: AppTheme.colors.textSecondary,
    marginTop: 1,
  },
  messageTime: {
    fontSize: 10.5,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  messageTimeThem: {
    color: "#94A3B8",
  },
  messageTimeMe: {
    color: "#D1FAE5",
  },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "transparent",
    gap: 10,
  },
  chatAttachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  chatTextInput: {
    flex: 1,
    minHeight: 52,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 13,
    color: AppTheme.colors.text,
    ...Platform.select({
      web: { outlineStyle: "none" } as any,
    }),
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  chatSendBtnActive: {
    backgroundColor: AppTheme.colors.primary,
  },

  /* Support Modal */
  supportModalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "transparent",
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  supportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  supportTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: AppTheme.colors.text,
    flex: 1,
    marginLeft: 10,
  },
  supportBodyText: {
    fontSize: 13,
    color: AppTheme.colors.textSecondary,
    lineHeight: 19,
  },
  supportOptions: {
    gap: 10,
  },
  supportOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
    backgroundColor: "transparent",
  },
  supportOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppTheme.colors.text,
  },
  supportCloseActionBtn: {
    backgroundColor: AppTheme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  supportCloseActionBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13.5,
  },
});
