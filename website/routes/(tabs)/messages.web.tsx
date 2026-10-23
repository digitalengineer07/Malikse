import FrostedChatBackground from "../../components/FrostedChatBackground";
import { AppTheme } from "../../constants/theme";
import React, { useState, useMemo } from "react";
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
  TextInput,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import type { UserProfile } from "../../src/types/auth.types";
import { inquiryActivity } from "../../src/utils/inquiryActivity";
import { MaterialIcons } from "@expo/vector-icons";
import AppHeader from "../../components/AppHeader";
import WebFooter from "../../components/WebFooter";
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
  const router = useRouter();
  const { language } = useLanguageStore();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 880;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "buyers" | "agents" | "advisors" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showSupportModal, setShowSupportModal] = useState(false);

  const countsByFilter = useMemo(() => {
    return {
      all: conversations.length,
      unread: conversations.filter((c) => c.unread).length,
      buyers: conversations.filter((c) => c.roleType === "buyer").length,
      agents: conversations.filter((c) => c.roleType === "agent").length,
      advisors: conversations.filter((c) => c.roleType === "advisor").length,
      archived: 0,
    };
  }, [conversations]);

  const [conversationCursor, setConversationCursor] = useState<string>();
  const [nextConversationCursor, setNextConversationCursor] = useState<string>();
  const [previousConversationCursors, setPreviousConversationCursors] = useState<(string | undefined)[]>([]);
  const [messageBefore, setMessageBefore] = useState<number | null>(null);
  const chatId = React.useRef(selectedChat?.id);
  chatId.current = selectedChat?.id;
  const [messageBusy, setMessageBusy] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const mapMessage = (m: NonNullable<InquiryData["messages"]>[number]): MessageItem => ({ id: m._id, sender: m.senderId === user.id ? "me" : "them", text: m.text, sentAt: Date.parse(m.createdAt), time: new Date(m.createdAt).toLocaleString() });
  useFocusEffect(React.useCallback(() => {
    if (!selectedChat) return;
    let active = true, fetching = false, first = true;
    const id = selectedChat.id;
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
  }, [selectedChat?.id, user.id]));
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
        {/* Main Website Container - Same width (1340px) as Home, Explore, and Saved */}
        <View style={styles.content}>
          {/* ================= HERO BANNER ================= */}
          <View style={styles.heroWrapper}>
            <View style={styles.heroCard}>
              {/* Left Content Column */}
              <View style={styles.heroLeftContent}>
                <Text style={styles.heroEyebrow}>
                  {language === "hi" ? "सीधा और सुरक्षित संदेश" : "DIRECT & TITLE-VERIFIED MESSAGING"}
                </Text>
                <Text style={styles.heroTitle}>
                  {language === "hi" ? "संदेश और पूछताछ" : "Messages & Inquiries"}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {language === "hi"
                    ? "सत्यापित भूस्वामियों और गंभीर खरीदारों से सीधे संपर्क करें · 100% सहमति-आधारित गोपनीयता"
                    : "Communicate directly with verified landowners and serious buyers across Bihar · 100% consent-gated privacy"}
                </Text>
              </View>

              {/* Right Floating Summary Badge */}
              <View style={styles.heroRightBadge}>
                <View style={styles.heroBadgeIconBox}>
                  <MaterialIcons name="forum" size={20} color="#0284C7" />
                </View>
                <View>
                  <Text style={styles.heroBadgeTitle}>
                    {conversations.length}{" "}
                    {conversations.length === 1
                      ? language === "hi"
                        ? "सक्रिय बातचीत"
                        : "Active Conversation"
                      : language === "hi"
                      ? "सक्रिय बातचीत"
                      : "Active Conversations"}
                  </Text>
                  <Text style={styles.heroBadgeSub}>
                    {language === "hi"
                      ? "100% सत्यापित पहचान · शून्य स्पैम"
                      : "100% Verified Identities · Zero Broker Spam"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ================= MAIN TWO-COLUMN BODY ================= */}
          <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
            {/* ----- LEFT SIDEBAR ----- */}
            <View style={[styles.sidebar, isDesktop && styles.sidebarDesktop]}>
              {/* Card 1: Inbox Folder Menu */}
              <View style={styles.categoryCard}>
                <View style={styles.sidebarSectionHeader}>
                  <MaterialIcons name="folder-open" size={15} color="#0284C7" />
                  <Text style={styles.sidebarSectionHeaderText}>
                    {language === "hi" ? "इनबॉक्स फ़ोल्डर" : "INBOX FOLDERS"}
                  </Text>
                </View>

                {/* All Messages */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    activeFilter === "all" && styles.categoryItemActive,
                  ]}
                  onPress={() => setActiveFilter("all")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="chat"
                    size={18}
                    color={activeFilter === "all" ? "#0284C7" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      activeFilter === "all" && styles.categoryLabelActive,
                    ]}
                  >
                    {language === "hi" ? "सभी संदेश" : "All Messages"}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFilter === "all" ? styles.countPillActive : styles.countPillMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFilter === "all"
                          ? styles.countPillTextActive
                          : styles.countPillMutedText,
                      ]}
                    >
                      {countsByFilter.all}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Unread */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    activeFilter === "unread" && styles.categoryItemActive,
                  ]}
                  onPress={() => setActiveFilter("unread")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="mark-chat-unread"
                    size={18}
                    color={activeFilter === "unread" ? "#0284C7" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      activeFilter === "unread" && styles.categoryLabelActive,
                    ]}
                  >
                    {language === "hi" ? "अपठित" : "Unread"}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFilter === "unread" ? styles.countPillActive : styles.countPillMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFilter === "unread"
                          ? styles.countPillTextActive
                          : styles.countPillMutedText,
                      ]}
                    >
                      {countsByFilter.unread}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Buyers */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    activeFilter === "buyers" && styles.categoryItemActive,
                  ]}
                  onPress={() => setActiveFilter("buyers")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="person-outline"
                    size={18}
                    color={activeFilter === "buyers" ? "#0284C7" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      activeFilter === "buyers" && styles.categoryLabelActive,
                    ]}
                  >
                    {language === "hi" ? "खरीदार" : "Buyers"}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFilter === "buyers" ? styles.countPillActive : styles.countPillMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFilter === "buyers"
                          ? styles.countPillTextActive
                          : styles.countPillMutedText,
                      ]}
                    >
                      {countsByFilter.buyers}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Brokers / Agents */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    activeFilter === "agents" && styles.categoryItemActive,
                  ]}
                  onPress={() => setActiveFilter("agents")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="groups"
                    size={18}
                    color={activeFilter === "agents" ? "#0284C7" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      activeFilter === "agents" && styles.categoryLabelActive,
                    ]}
                  >
                    {language === "hi" ? "दलाल / एजेंट" : "Brokers / Agents"}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFilter === "agents" ? styles.countPillActive : styles.countPillMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFilter === "agents"
                          ? styles.countPillTextActive
                          : styles.countPillMutedText,
                      ]}
                    >
                      {countsByFilter.agents}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Advisors */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    activeFilter === "advisors" && styles.categoryItemActive,
                  ]}
                  onPress={() => setActiveFilter("advisors")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="support-agent"
                    size={18}
                    color={activeFilter === "advisors" ? "#0284C7" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      activeFilter === "advisors" && styles.categoryLabelActive,
                    ]}
                  >
                    {language === "hi" ? "सलाहकार" : "Advisors"}
                  </Text>
                  <View
                    style={[
                      styles.countPill,
                      activeFilter === "advisors" ? styles.countPillActive : styles.countPillMuted,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countPillText,
                        activeFilter === "advisors"
                          ? styles.countPillTextActive
                          : styles.countPillMutedText,
                      ]}
                    >
                      {countsByFilter.advisors}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Archived */}
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    activeFilter === "archived" && styles.categoryItemActive,
                  ]}
                  onPress={() => setActiveFilter("archived")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="archive"
                    size={18}
                    color={activeFilter === "archived" ? "#0284C7" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      activeFilter === "archived" && styles.categoryLabelActive,
                    ]}
                  >
                    {language === "hi" ? "अभिलेखागार" : "Archived"}
                  </Text>
                  <View style={[styles.countPill, styles.countPillMuted]}>
                    <Text style={styles.countPillMutedText}>0</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Card 2: Need Assistance Promo Card */}
              <View style={styles.promoCard}>
                <View style={styles.promoIconCircle}>
                  <MaterialIcons name="headset-mic" size={18} color="#059669" />
                </View>
                <Text style={styles.promoTitle}>
                  {language === "hi" ? "मदद चाहिए?" : "Need Assistance?"}
                </Text>
                <Text style={styles.promoSubtitle}>
                  {language === "hi"
                    ? "संदिग्ध गतिविधि की रिपोर्ट करें या हमारे बिहार विधिक डेस्क से सलाह लें।"
                    : "Report suspicious activity or connect with our Bihar legal & transaction desk anytime."}
                </Text>
                <TouchableOpacity
                  style={styles.promoActionBtn}
                  onPress={() => setShowSupportModal(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.promoActionBtnText}>
                    {language === "hi" ? "सपोर्ट डेस्क से जुड़ें" : "Contact Support"}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={13} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Card 3: Trust & Privacy Assurance Card */}
              <View style={styles.trustAssuranceCard}>
                <View style={styles.trustAssuranceHeader}>
                  <MaterialIcons name="verified-user" size={16} color="#0284C7" />
                  <Text style={styles.trustAssuranceTitle}>
                    {language === "hi" ? "सत्यापित गोपनीयता गारंटी" : "Verified Privacy Shield"}
                  </Text>
                </View>
                <View style={styles.trustItemRow}>
                  <MaterialIcons name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.trustItemText}>
                    {language === "hi" ? "फोन नंबर केवल आपसी सहमति पर साझा" : "Phone hidden until mutual consent"}
                  </Text>
                </View>
                <View style={styles.trustItemRow}>
                  <MaterialIcons name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.trustItemText}>
                    {language === "hi" ? "100% सत्यापित भू-राजस्व टाइटल" : "100% Jamabandi title audited"}
                  </Text>
                </View>
                <View style={styles.trustItemRow}>
                  <MaterialIcons name="check-circle" size={14} color="#10B981" />
                  <Text style={styles.trustItemText}>
                    {language === "hi" ? "शून्य ब्रोकरेज या छिपे शुल्क" : "Direct owners · ₹0 brokerage"}
                  </Text>
                </View>
              </View>
            </View>

            {/* ----- RIGHT MAIN CONTENT AREA ----- */}
            <View style={styles.contentArea}>
              {/* Search & Sort Controls Row */}
              <View style={styles.controlsRow}>
                {/* Search Bar */}
                <View style={styles.searchBar}>
                  <MaterialIcons name="search" size={19} color="#64748B" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={
                      language === "hi"
                        ? "नाम, संपत्ति या संदेश खोजें..."
                        : "Search by person name, property, or message text..."
                    }
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {!!searchQuery && (
                    <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                      <MaterialIcons name="close" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Refresh button */}
                <TouchableOpacity
                  style={styles.refreshControlBtn}
                  onPress={() => {
                    setConversationCursor(undefined);
                    setPreviousConversationCursors([]);
                    setLoading(true);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh conversations"
                >
                  <MaterialIcons name="refresh" size={18} color="#64748B" />
                </TouchableOpacity>

                {/* Sort Dropdown */}
                <TouchableOpacity
                  style={styles.sortDropdown}
                  onPress={() => setSortOrder(sortOrder === "latest" ? "oldest" : "latest")}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="swap-vert" size={17} color="#475569" />
                  <Text style={styles.sortDropdownText}>
                    {sortOrder === "latest"
                      ? language === "hi"
                        ? "नवीनतम पहले"
                        : "Latest First"
                      : language === "hi"
                      ? "सबसे पुराना"
                      : "Oldest First"}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={17} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Conversations List / Empty State */}
              <View style={styles.conversationsContainer}>
                {!!networkError && (
                  <View style={styles.errorNoticeBox}>
                    <MaterialIcons name="error-outline" size={18} color="#DC2626" />
                    <Text style={styles.errorNoticeText}>{networkError}</Text>
                  </View>
                )}

                {previousConversationCursors.length > 0 && (
                  <TouchableOpacity
                    style={styles.paginationBtn}
                    onPress={() => {
                      setConversationCursor(previousConversationCursors.at(-1));
                      setPreviousConversationCursors((old) => old.slice(0, -1));
                    }}
                  >
                    <MaterialIcons name="arrow-back" size={14} color="#03456C" />
                    <Text style={styles.paginationBtnText}>
                      {language === "hi" ? "पिछली बातचीत" : "Previous conversations"}
                    </Text>
                  </TouchableOpacity>
                )}

                {nextConversationCursor && (
                  <TouchableOpacity
                    style={styles.paginationBtn}
                    onPress={() => {
                      setPreviousConversationCursors((old) => [...old, conversationCursor]);
                      setConversationCursor(nextConversationCursor);
                    }}
                  >
                    <Text style={styles.paginationBtnText}>
                      {language === "hi" ? "और बातचीत लोड करें" : "Load more conversations"}
                    </Text>
                    <MaterialIcons name="arrow-forward" size={14} color="#03456C" />
                  </TouchableOpacity>
                )}

                {loading ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#03456C" />
                    <Text style={styles.loadingText}>
                      {language === "hi" ? "बातचीत लोड हो रही है..." : "Loading conversations..."}
                    </Text>
                  </View>
                ) : filteredConversations.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyCard}>
                      <View style={styles.emptyIconCircle}>
                        <MaterialIcons name="forum" size={40} color="#0284C7" />
                      </View>
                      <Text style={styles.emptyHeading}>
                        {language === "hi" ? "कोई संदेश नहीं मिला" : "No Conversations Yet"}
                      </Text>
                      <Text style={styles.emptySubText}>
                        {language === "hi"
                          ? "आपके वर्तमान फ़ोल्डर में अभी कोई बातचीत नहीं है। जब आप संपत्तियों पर पूछताछ करेंगे या खरीदार आपकी लिस्टिंग पर संपर्क करेंगे, तो संदेश यहाँ दिखाई देंगे।"
                          : "Your inbox in this category is currently empty. Inquiries you submit on verified properties or messages from buyers interested in your listings will appear here."}
                      </Text>

                      <View style={styles.emptyActionsRow}>
                        <TouchableOpacity
                          style={styles.emptyExploreBtn}
                          onPress={() => router.push("/search")}
                          activeOpacity={0.85}
                        >
                          <MaterialIcons name="explore" size={16} color="#FFFFFF" />
                          <Text style={styles.emptyExploreBtnText}>
                            {language === "hi" ? "सत्यापित संपत्तियां खोजें" : "Explore Verified Properties"}
                          </Text>
                          <MaterialIcons name="arrow-forward" size={15} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.emptySavedBtn}
                          onPress={() => router.push("/saved")}
                          activeOpacity={0.85}
                        >
                          <MaterialIcons name="bookmark-border" size={16} color="#03456C" />
                          <Text style={styles.emptySavedBtnText}>
                            {language === "hi" ? "शॉर्टलिस्ट की गई संपत्तियां" : "View Saved Properties"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* How MalikSe Chat Works Trust Feature Cards */}
                    <View style={styles.emptyFeaturesRow}>
                      <View style={styles.emptyFeatureItem}>
                        <View style={[styles.emptyFeatureIconBox, { backgroundColor: "#F0F9FF" }]}>
                          <MaterialIcons name="handshake" size={20} color="#0284C7" />
                        </View>
                        <Text style={styles.emptyFeatureTitle}>
                          {language === "hi" ? "सीधे भूस्वामी से संपर्क" : "Direct Title Owners"}
                        </Text>
                        <Text style={styles.emptyFeatureDesc}>
                          {language === "hi"
                            ? "बिना किसी दलाल या बिचौलिये के सीधे मालिक से बातचीत करें।"
                            : "Deal directly with verified owners with zero intermediary brokerage."}
                        </Text>
                      </View>

                      <View style={styles.emptyFeatureItem}>
                        <View style={[styles.emptyFeatureIconBox, { backgroundColor: "#ECFDF5" }]}>
                          <MaterialIcons name="lock" size={20} color="#059669" />
                        </View>
                        <Text style={styles.emptyFeatureTitle}>
                          {language === "hi" ? "सहमति-आधारित गोपनीयता" : "Consent-Gated Chat"}
                        </Text>
                        <Text style={styles.emptyFeatureDesc}>
                          {language === "hi"
                            ? "आपका फ़ोन नंबर पूरी तरह सुरक्षित और गोपनीय रहता है।"
                            : "Your mobile and personal data stay shielded until mutual confirmation."}
                        </Text>
                      </View>

                      <View style={styles.emptyFeatureItem}>
                        <View style={[styles.emptyFeatureIconBox, { backgroundColor: "#FEF3C7" }]}>
                          <MaterialIcons name="description" size={20} color="#D97706" />
                        </View>
                        <Text style={styles.emptyFeatureTitle}>
                          {language === "hi" ? "औपचारिक ऑफर और दस्तावेज" : "Formal Offers & Papers"}
                        </Text>
                        <Text style={styles.emptyFeatureDesc}>
                          {language === "hi"
                            ? "आधिकारिक जमाबंदी व विधिक रिकॉर्ड्स सीधे चैट में साझा करें।"
                            : "Exchange audited revenue records, maps, and formal price proposals."}
                        </Text>
                      </View>
                    </View>
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
                            <MaterialIcons name="place" size={14} color="#0284C7" />
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
                            size={22}
                            color="#94A3B8"
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
        </View>

        {/* Global Website Footer */}
        <WebFooter />
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
                <View style={styles.promoIconCircle}>
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
    paddingBottom: 0,
    flexGrow: 1,
  },
  content: {
    width: "100%",
    maxWidth: 1340,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },

  /* ================= HERO BANNER ================= */
  heroWrapper: {
    width: "100%",
    marginBottom: 8,
  },
  heroCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.85)",
    paddingHorizontal: 28,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px -2px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  heroLeftContent: {
    flex: 1,
    minWidth: 260,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
    marginTop: 4,
    lineHeight: 18,
  },
  heroRightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  heroBadgeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
  },
  heroBadgeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#03456C",
  },
  heroBadgeSub: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 1,
  },

  /* ================= MAIN LAYOUT ================= */
  mainLayout: {
    width: "100%",
    marginTop: 20,
    marginBottom: 32,
  },
  mainLayoutDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 28,
  },

  /* ================= SIDEBAR ================= */
  sidebar: {
    width: "100%",
    gap: 16,
  },
  sidebarDesktop: {
    width: 270,
  },
  categoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    padding: 10,
    gap: 2,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 10px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  sidebarSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 4,
  },
  sidebarSectionHeaderText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: 0.8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  categoryItemActive: {
    backgroundColor: "#E0F2FE",
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    flex: 1,
  },
  categoryLabelActive: {
    color: "#03456C",
    fontWeight: "800",
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  countPillActive: {
    backgroundColor: "#0284C7",
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  countPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  countPillMuted: {
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countPillMutedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },

  /* Sidebar Promo Card */
  promoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  promoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  promoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0A192F",
  },
  promoSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  promoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    ...Platform.select({
      web: { cursor: "pointer" },
    }),
  },
  promoActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Sidebar Trust Card */
  trustAssuranceCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    padding: 14,
    gap: 8,
  },
  trustAssuranceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  trustAssuranceTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#03456C",
  },
  trustItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustItemText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "500",
    flex: 1,
    lineHeight: 15,
  },

  /* ================= CONTENT AREA ================= */
  contentArea: {
    flex: 1,
    minWidth: 0,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  searchBar: {
    flex: 1,
    minWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    outlineStyle: "none" as any,
  },
  refreshControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  sortDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 14,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
      },
    }),
  },
  sortDropdownText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },

  /* Empty State */
  emptyContainer: {
    gap: 20,
  },
  emptyCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    paddingVertical: 44,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px -2px rgba(10, 25, 47, 0.04)",
      },
    }),
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyHeading: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.3,
  },
  emptySubText: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 480,
    marginTop: 6,
    lineHeight: 20,
  },
  emptyActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  emptyExploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0284C7 100%)",
        boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
      },
    }),
  },
  emptyExploreBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptySavedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  emptySavedBtnText: {
    color: "#03456C",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Empty State 3 Features Row */
  emptyFeaturesRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  emptyFeatureItem: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    padding: 18,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  emptyFeatureIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyFeatureTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0A192F",
    marginBottom: 4,
  },
  emptyFeatureDesc: {
    fontSize: 11.5,
    color: "#64748B",
    lineHeight: 16,
  },

  /* Loading Box */
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },

  /* Error Notice Box */
  errorNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorNoticeText: {
    fontSize: 12,
    color: "#DC2626",
    flex: 1,
  },

  /* Pagination */
  paginationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
    ...Platform.select({
      web: { cursor: "pointer" },
    }),
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#03456C",
  },

  /* Conversations Cards List */
  conversationsContainer: {
    gap: 12,
  },
  conversationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: "0 2px 8px rgba(10, 25, 47, 0.03)",
      },
    }),
  },
  conversationCardUnread: {
    borderColor: "#BAE6FD",
    backgroundColor: "#F0F9FF",
  },
  avatarContainer: {
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
    fontSize: 19,
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
    fontSize: 15,
    fontWeight: "800",
    color: "#0A192F",
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
    color: "#64748B",
  },
  convLastMsg: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  convLastMsgUnread: {
    color: "#0A192F",
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
    fontSize: 11,
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
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
  },
  unreadGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
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
    color: "#0284C7",
  },
  bottomQuoteText: {
    fontSize: 13,
    color: "#03456C",
    fontWeight: "700",
    fontStyle: "italic",
    textAlign: "center",
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
