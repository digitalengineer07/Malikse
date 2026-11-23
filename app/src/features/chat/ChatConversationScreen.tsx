import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from "expo-crypto";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused, useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { scheduleNotificationCount } from "../../store/notificationStore";
import NotificationBell from "../../../components/NotificationBell";
import { chatApi, transcriptRetryAt } from "./chatApi";
import { outboxFor } from "./chatDelivery";
import { ChatBubble } from "./ChatBubble";
import type { ChatConversation, ChatMessage, MessagePageResponse } from "./chatTypes";

interface ChatConversationScreenProps {
  inquiryId: string;
  onBack: () => void;
}

const C = {
  ink: "#14263E",
  sun: "#FCC61C",
  sunSoft: "#FBF2C0",
  blue: "#0A45B5",
  bg: "#F4F8FF",
  line: "#E2ECF8",
  muted: "#5D7089",
};

type ConversationSnapshot = {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  nextBefore: number | null;
  recipientReadAt: string | null;
  live: NonNullable<MessagePageResponse["live"]>;
};
const recentConversations = new Map<string, ConversationSnapshot>();
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) recentConversations.clear();
});

function getParticipantId(party: any): string {
  if (!party) return "";
  return typeof party === "object" ? String(party._id || "") : String(party);
}

function formatLocationPart(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (start) => start.toLocaleUpperCase())
    : "";
}

export const ChatConversationScreen: React.FC<ChatConversationScreenProps> = ({
  inquiryId,
  onBack,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id || "";
  const focused = useIsFocused();
  const box = outboxFor(currentUserId);
  const pending = useSyncExternalStore(box.subscribe, box.snapshot, box.snapshot);

  // State
  const cacheKey = `${currentUserId}:${inquiryId}`;
  const [cached] = useState(() => recentConversations.get(cacheKey));
  const [conversation, setConversation] = useState<ChatConversation | null>(cached?.conversation ?? null);
  const summaryRef = useRef(conversation);
  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages ?? []);
  const [nextBefore, setNextBefore] = useState<number | null>(cached?.nextBefore ?? null);
  const [recipientReadAt, setRecipientReadAt] = useState<string | null>(cached?.recipientReadAt ?? null);
  const [loading, setLoading] = useState(!cached);
  const [accessLost, setAccessLost] = useState(false);
  const liveState = useRef<MessagePageResponse["live"]>(cached?.live);
  const [loadingEarlier, setLoadingEarlier] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState("");
  const [transcriptError, setTranscriptError] = useState("");
  const [text, setText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const historyLoaded = useRef(Boolean(cached));
  const paging = useRef(false);
  useEffect(() => {
    const live = liveState.current;
    if (accessLost || !messages.length || !live || useAuthStore.getState().user?.id !== currentUserId) return;
    recentConversations.delete(cacheKey);
    recentConversations.set(cacheKey, { conversation, messages, nextBefore, recipientReadAt, live });
    if (recentConversations.size > 4) recentConversations.delete(recentConversations.keys().next().value!);
  }, [accessLost, cacheKey, conversation, currentUserId, messages, nextBefore, recipientReadAt]);
  const visibleMessages = useMemo(() => {
    if (accessLost) return [];
    const confirmed = new Set(messages.map(message => message._id));
    const queued: ChatMessage[] = pending.filter(row => row.thread === inquiryId && !confirmed.has(row.id))
      .map(row => ({ _id: row.id, clientTempId: row.key, text: row.text, createdAt: row.createdAt,
        senderId: currentUserId, sending: !row.failure, sendError: Boolean(row.failure), failureReason: row.failure }));
    return [...queued.reverse(), ...messages].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [accessLost, pending, messages, inquiryId, currentUserId]);
  useEffect(() => box.onDelivered((thread, saved) => {
    if (thread === inquiryId) setMessages(prev => [saved, ...prev.filter(m => m._id !== saved._id)]);
  }), [inquiryId, box]);


  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const sendLock = useRef<boolean>(false);
  const summaryPending = useRef(false);
  const summaryFresh = useRef(false);
  const [composerError, setComposerError] = useState("");
  const readReceiptSent = useRef<string>("");
  const ownReadThrough = useRef(0);

  // 1. Initial Load & Refresh
  const loadMessages = useCallback(async (signal: AbortSignal, wait: boolean) => {
    const previous = liveState.current;
    if (!summaryFresh.current && !summaryPending.current) {
      summaryPending.current = true;
      void chatApi.getConversation(inquiryId).then(summary => {
        if (signal.aborted) return;
        summaryFresh.current = true;
        summaryRef.current = summary;
        setConversation(summary);
        setMessages(current => current.length ? current : (summary.messages ?? []).slice().reverse());
      }).catch(() => {}).finally(() => { summaryPending.current = false; });
    }
    try {
      const msgData = await chatApi.getMessages(inquiryId, undefined, { since: previous?.count,
        watch: wait && previous?.canWait && !previous.more ? previous.cursor : undefined, signal });
      if (signal.aborted) return;
      setTranscriptError("");
      liveState.current = msgData.live;
      const convData = summaryRef.current;

      if (msgData) {
        if (msgData.ownReadAt) ownReadThrough.current = Math.max(ownReadThrough.current, Date.parse(msgData.ownReadAt));
        setRecipientReadAt(msgData.recipientReadAt ?? null);
        if (!historyLoaded.current && (!previous || !msgData.live)) setNextBefore(msgData.nextBefore);
        void box.reconcile(inquiryId, msgData.messages).catch(() => {});

        setMessages((prev) => {
          const priorMessages = prev;
          const serverList = [...msgData.messages];

          // If nextBefore is null, include initial inquiry message
          if (msgData.nextBefore == null && convData && convData.message) {
            const hasInitialInList = serverList.some(
              (m) => m.text === convData.message && m.createdAt === convData.createdAt
            );
            if (!hasInitialInList) {
              serverList.unshift({
                _id: `initial_${convData._id}`,
                senderId: getParticipantId(convData.buyerId),
                text: convData.message,
                createdAt: convData.createdAt,
              });
            }
          }

          const combined = [...serverList];
          for (const opt of priorMessages) {
            if (!combined.some((m) => m._id === opt._id)) {
              combined.push(opt);
            }
          }

          combined.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          return combined.reverse();
        });
      }
      return msgData.live;
    } catch (err: any) {
      if (signal.aborted) return;
      if ([401, 403, 404].includes(err.response?.status)) {
        recentConversations.delete(cacheKey);
        setAccessLost(true);
        setConversation(null);
        setMessages([]);
        setNextBefore(null);
        setTranscriptError("This conversation is unavailable. Return to Chats and open it again.");
        return;
      }
      setTranscriptError("Could not refresh messages. Retrying automatically.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [inquiryId, box, cacheKey]);

  // 2. Periodic Polling & Push Trigger
  useEffect(() => {
    if (!inquiryId || !currentUserId || !focused || accessLost) return;
    let mounted = true;
    let running = false;
    let dirty = false;
    let canWait = false;
    let controller: AbortController | undefined;
    let lastStart = 0;
    let timer: ReturnType<typeof setTimeout>;
    let scheduledAt = Infinity;
    const active = () => mounted && (AppState.currentState == null || AppState.currentState === "active");
    const schedule = (delay: number) => {
      if (!active()) { clearTimeout(timer); scheduledAt = Infinity; return; }
      const now = Date.now();
      const at = Math.max(now + delay, transcriptRetryAt(inquiryId), lastStart + (canWait ? 750 : 2500));
      if (scheduledAt <= at) return;
      clearTimeout(timer);
      scheduledAt = at;
      timer = setTimeout(refresh, Math.min(2147483647, at - now));
    };
    async function refresh() {
      scheduledAt = Infinity;
      if (!active() || running) return;
      if (Date.now() < transcriptRetryAt(inquiryId)) { schedule(0); return; }
      running = true;
      dirty = false;
      lastStart = Date.now();
      controller = new AbortController();
      try { const live = await loadMessages(controller.signal, canWait); canWait = Boolean(live?.canWait || live?.more); }
      finally {
        running = false;
        schedule(canWait || dirty ? 50 : 15000 + Math.random() * 4000);
      }
    }
    if (Date.now() < transcriptRetryAt(inquiryId)) {
      setTimeout(() => {
        if (!active()) return;
        setLoading(false);
        setTranscriptError("Waiting to reconnect. Messages will refresh automatically.");
      }, 0);
    }
    schedule(0);
    const app = AppState.addEventListener("change", state => {
      canWait = false;
      if (state !== "active") controller?.abort();
      else dirty = true;
      schedule(0);
    });
    return () => { mounted = false; controller?.abort(); clearTimeout(timer); app.remove(); };
  }, [inquiryId, currentUserId, loadMessages, focused, accessLost]);

  // 3. Mark Read Receipts
  useEffect(() => {
    if (!focused || !messages.length || !conversation || !currentUserId) return;

    const latestIncoming = messages.find((m) => {
      const sender = getParticipantId(m.senderId);
      return sender && sender !== currentUserId;
    });

    if (latestIncoming && Date.parse(latestIncoming.createdAt) > ownReadThrough.current) {
      const receiptKey = `${inquiryId}_${latestIncoming.createdAt}`;
      if (readReceiptSent.current !== receiptKey) {
        const timer = setTimeout(() => {
          if (AppState.currentState !== "active") return;
          readReceiptSent.current = receiptKey;
          chatApi.markRead(inquiryId, latestIncoming.createdAt)
            .then(() => {
              ownReadThrough.current = Math.max(ownReadThrough.current, Date.parse(latestIncoming.createdAt));
              scheduleNotificationCount();
            })
            .catch(() => { if (readReceiptSent.current === receiptKey) readReceiptSent.current = ""; });
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, conversation, currentUserId, inquiryId, focused]);

  // 4. Pagination
  const handleLoadEarlier = async () => {
    if (nextBefore == null || paging.current || !inquiryId) return;
    if (Date.now() < transcriptRetryAt(inquiryId)) {
      setHistoryError("Chat updates are temporarily limited. Try again shortly.");
      return;
    }
    paging.current = true;
    setLoadingEarlier(true);
    setHistoryError("");

    try {
      const olderData = await chatApi.getMessages(inquiryId, nextBefore);
      historyLoaded.current = true;
      if (olderData && olderData.messages.length > 0) {
        setNextBefore(olderData.nextBefore);
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newOlder = olderData.messages.filter((m) => !existingIds.has(m._id));
          const summary = summaryRef.current;
          if (olderData.nextBefore == null && summary?.message && !existingIds.has(`initial_${summary._id}`) &&
              ![...prev, ...newOlder].some(m => m.text === summary.message && m.createdAt === summary.createdAt)) {
            newOlder.unshift({
              _id: `initial_${summary._id}`, senderId: getParticipantId(summary.buyerId),
              text: summary.message, createdAt: summary.createdAt,
            });
          }
          return [...prev, ...newOlder.reverse()];
        });
      } else {
        setNextBefore(null);
      }
    } catch {
      setHistoryError("Could not load older messages. Try again.");
    } finally {
      paging.current = false;
      setLoadingEarlier(false);
    }
  };

  const handleSend = async () => {
    const draft = text.trim();
    if (!draft || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setComposerError("");
    try {
      const key = randomUUID();
      const id = (await digestStringAsync(CryptoDigestAlgorithm.SHA256,
        [inquiryId, currentUserId, key].join("/"))).slice(0, 24);
      await box.enqueue({ id, key, thread: inquiryId, text: draft, createdAt: new Date().toISOString(), attempts: 0, retryAt: 0 });
      setText(current => current.trim() === draft ? "" : current);
    } catch {
      setComposerError("Could not save the message on this device. Your draft is still here.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  // Header Details
  const isBuyer = getParticipantId(conversation?.buyerId) === currentUserId;
  const otherParty = isBuyer ? conversation?.staffId : conversation?.buyerId;
  const participantName =
    (typeof otherParty === "object" && otherParty?.name?.trim()) ||
    (isBuyer ? "Property Advisor" : "Buyer");
  const participantInitials = participantName
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => Array.from(part)[0])
    .join("")
    .toLocaleUpperCase();
  const isOffer = Boolean(conversation?.dealId) || typeof conversation?.offerAmount === "number";
  const propertyTitle = formatLocationPart(conversation?.propertyId?.title);
  const dealId = conversation?.dealId
    ? typeof conversation.dealId === "object"
      ? conversation.dealId._id
      : conversation.dealId
    : null;
  const isSold = conversation?.propertyId?.status === "sold";

  return (
    <View style={styles.screen}>
      {/* Exact Previous MalikSe Dark Navy Header */}
      <View style={[styles.conversationHeader, { paddingTop: insets.top + 6 }]}>
        <View style={styles.conversationHeaderRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to messages"
            style={styles.conversationBack}
            onPress={onBack}
          >
            <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

          <View style={styles.chatIdentityCard}>
            <View style={styles.chatIdentityIcon} accessible={false}>
              {participantInitials ? (
                <Text style={styles.chatIdentityInitials}>{participantInitials}</Text>
              ) : (
                <MaterialIcons name="chat-bubble-outline" size={18} color={C.ink} />
              )}
            </View>

            <View style={styles.chatIdentityDetails}>
              <View style={styles.chatIdentityNameRow}>
                <Text accessibilityRole="header" style={styles.chatIdentityName} numberOfLines={1} ellipsizeMode="tail">
                  {participantName || "Property conversation"}
                </Text>
                {conversation && (
                  <View style={[styles.chatCategory, isOffer && styles.chatOffer]}>
                    <Text style={[styles.chatCategoryText, isOffer && styles.chatOfferText]}>
                      {isOffer ? "Offer" : "Enquiry"}
                    </Text>
                  </View>
                )}
              </View>

              {propertyTitle ? (
                <View style={styles.chatIdentityListing}>
                  <MaterialIcons name="home-work" size={13} color={C.sun} />
                  <Text style={styles.chatIdentityProperty} numberOfLines={1}>
                    {propertyTitle}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <NotificationBell />
        </View>
      </View>

      {/* Main Chat Canvas with Floating Watermark */}
      <View style={styles.chatBody}>
        {/* Previous Conversation Watermark */}
        <View pointerEvents="none" accessible={false} style={styles.conversationWatermark}>
          <Image
            source={require("../../../assets/images/conversation_watermark.png")}
            resizeMode="contain"
            style={styles.conversationWatermarkImage}
          />
        </View>

        {/* View Offer & Deal Action Button if Offer is Present */}
        {dealId && (
          <View style={styles.dealBannerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View offer & deal"
              style={({ pressed }) => [styles.dealButton, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/deal/${dealId}` as any)}
            >
              <MaterialIcons name="handshake" size={16} color={C.ink} />
              <Text style={styles.dealButtonText}>View offer & deal</Text>
            </Pressable>
          </View>
        )}

        {loading && !visibleMessages.length ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={C.blue} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            inverted
            keyExtractor={(item) => item._id || item.clientTempId || Math.random().toString()}
            renderItem={({ item }) => {
              const mine = getParticipantId(item.senderId) === currentUserId;
              const isInitialMessage = item._id.startsWith("initial_");
              const bubble = (
                <ChatBubble
                  mine={mine}
                  text={item.text}
                  createdAt={item.createdAt}
                  offer={isInitialMessage ? conversation?.offerAmount : undefined}
                  sending={item.sending}
                  sendError={item.sendError}
                  recipientReadAt={recipientReadAt}
                />
              );
              if (!item.sendError) return bubble;
              return (
                <Pressable accessibilityRole="button" onPress={() => void box.retry(item._id).catch(() => setComposerError("Could not queue the retry. Try again."))}>
                  {bubble}
                  <Text style={styles.chatSendError}>{item.failureReason ?? "Send unconfirmed"}. Tap to retry.</Text>
                </Pressable>
              );
            }}
            contentContainerStyle={styles.listContent}
            ListFooterComponent={
              loadingEarlier ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={C.blue} />
                </View>
              ) : nextBefore != null ? (
                <View style={styles.footerLoader}>
                  {historyError ? <Text accessibilityRole="alert" style={styles.chatSendError}>{historyError}</Text> : null}
                  <Pressable accessibilityRole="button" onPress={handleLoadEarlier}>
                    <Text style={{ color: C.blue, padding: 12 }}>Load older messages</Text>
                  </Pressable>
                </View>
              ) : undefined
            }
          />
        )}
      </View>

      {transcriptError && !visibleMessages.length ? <Text accessibilityRole="alert" style={styles.chatSendError}>{transcriptError}</Text> : null}
      {composerError ? <Text accessibilityRole="alert" style={styles.chatSendError}>{composerError}</Text> : null}

      {/* Sold Property Lock Banner */}
      {isSold && (
        <View style={styles.soldBanner}>
          <Text style={styles.soldBannerText}>This property is sold. Conversation is read-only.</Text>
        </View>
      )}

      {/* Exact Previous Bottom Composer with Gold Button */}
      {!isSold && !accessLost && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={[styles.chatFooter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.chatComposerArea}>
              <View style={styles.chatComposerRow}>
                <TextInput
                  accessibilityLabel="Message"
                  value={text}
                  onChangeText={setText}
                  style={styles.chatInput}
                  placeholder="Write a message…"
                  placeholderTextColor={C.muted}
                  multiline
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  disabled={!text.trim() || sending}
                  style={({ pressed }) => [
                    styles.chatSend,
                    (!text.trim() || sending || pressed) && styles.chatSendDimmed,
                  ]}
                  onPress={() => void handleSend()}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={C.ink} />
                  ) : (
                    <MaterialIcons name="send" size={20} color={C.ink} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  conversationHeader: {
    backgroundColor: C.ink,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 28,
  },
  conversationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  conversationBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatIdentityCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1C3556",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFFFFF30",
  },
  chatIdentityIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.sun,
  },
  chatIdentityInitials: {
    color: C.ink,
    fontFamily: "ManropeExtraBold",
    fontSize: 14,
    fontWeight: "800",
  },
  chatIdentityDetails: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  chatIdentityNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatCategory: {
    flexShrink: 0,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#FFFFFF45",
    backgroundColor: "#FFFFFF12",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chatCategoryText: {
    fontFamily: "ManropeBold",
    fontSize: 10,
    color: "#E3ECF8",
    fontWeight: "700",
  },
  chatOffer: {
    borderColor: "#FCC61C66",
    backgroundColor: "#FCC61C1A",
  },
  chatOfferText: {
    color: C.sunSoft,
  },
  chatIdentityName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Fraunces_400Regular",
    fontSize: 17,
    color: "#FFFFFF",
  },
  chatIdentityListing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chatIdentityProperty: {
    flexShrink: 1,
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#D4DEEC",
  },
  chatBody: {
    flex: 1,
    backgroundColor: C.bg,
    position: "relative",
  },
  conversationWatermark: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingRight: 8,
    paddingBottom: 8,
  },
  conversationWatermarkImage: {
    width: "66%",
    height: "92%",
    maxWidth: 304,
    maxHeight: 304,
    opacity: 0.35,
  },
  dealBannerRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    alignItems: "center",
  },
  dealButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.sunSoft,
    borderColor: C.sun,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dealButtonText: {
    fontFamily: "ManropeBold",
    fontSize: 13,
    color: C.ink,
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
  chatSendErrorBox: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#FFF0F2",
  },
  chatSendError: {
    fontFamily: "Manrope_400Regular",
    fontSize: 12,
    color: "#9A2D20",
  },
  soldBanner: {
    backgroundColor: "#F0F4F8",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  soldBannerText: {
    fontSize: 13,
    color: C.muted,
    fontFamily: "ManropeBold",
  },
  chatFooter: {
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
    paddingHorizontal: 14,
  },
  chatComposerArea: {
    gap: 5,
  },
  chatComposerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 116,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    fontFamily: "Manrope_400Regular",
    fontSize: 15,
    lineHeight: 21,
    color: C.ink,
  },
  chatSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.sun,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  chatSendDimmed: {
    opacity: 0.6,
  },
});
