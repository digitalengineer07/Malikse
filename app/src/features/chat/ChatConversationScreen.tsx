import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { useNotificationStore, refreshNotificationCount } from "../../store/notificationStore";
import NotificationBell from "../../../components/NotificationBell";
import { chatApi } from "./chatApi";
import { ChatBubble } from "./ChatBubble";
import type { ChatConversation, ChatMessage } from "./chatTypes";

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

  // State
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [recipientReadAt, setRecipientReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingEarlier, setLoadingEarlier] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const sendLock = useRef<boolean>(false);
  const readReceiptSent = useRef<string>("");
  const chatRevision = useNotificationStore((s) => s.chatRevision);
  const lastHandledRevision = useRef<number>(chatRevision);

  // 1. Initial Load & Refresh
  const loadMessages = useCallback(async (isInitial = false) => {
    if (!inquiryId || !currentUserId) return;
    if (isInitial) setLoading(true);

    try {
      const [convData, msgData] = await Promise.all([
        conversation ? Promise.resolve(conversation) : chatApi.getConversation(inquiryId),
        chatApi.getMessages(inquiryId),
      ]);

      if (convData) setConversation(convData);

      if (msgData) {
        setRecipientReadAt(msgData.recipientReadAt ?? null);
        setNextBefore(msgData.nextBefore);

        setMessages((prev) => {
          const optimisticPending = prev.filter((m) => m.sending || m.sendError);
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
          for (const opt of optimisticPending) {
            if (!combined.some((m) => m._id === opt._id || (m.text === opt.text && m.senderId === opt.senderId))) {
              combined.push(opt);
            }
          }

          combined.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          return combined.reverse();
        });
      }
    } catch (err: any) {
      console.warn("[ChatConversationScreen] loadMessages error:", err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [inquiryId, currentUserId, conversation]);

  useEffect(() => {
    void loadMessages(true);
  }, [inquiryId]);

  // 2. Periodic Polling & Push Trigger
  useEffect(() => {
    if (!inquiryId || !currentUserId) return;

    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        void loadMessages(false);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [inquiryId, currentUserId, loadMessages]);

  useEffect(() => {
    if (chatRevision !== lastHandledRevision.current) {
      lastHandledRevision.current = chatRevision;
      void loadMessages(false);
    }
  }, [chatRevision, loadMessages]);

  // 3. Mark Read Receipts
  useEffect(() => {
    if (!messages.length || !conversation || !currentUserId) return;

    const latestIncoming = messages.find((m) => {
      const sender = getParticipantId(m.senderId);
      return sender && sender !== currentUserId;
    });

    if (latestIncoming && latestIncoming.createdAt) {
      const receiptKey = `${inquiryId}_${latestIncoming.createdAt}`;
      if (readReceiptSent.current !== receiptKey) {
        readReceiptSent.current = receiptKey;
        const timer = setTimeout(() => {
          chatApi.markRead(inquiryId, latestIncoming.createdAt)
            .then(() => void refreshNotificationCount())
            .catch(() => {});
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, conversation, currentUserId, inquiryId]);

  // 4. Pagination
  const handleLoadEarlier = async () => {
    if (nextBefore == null || loadingEarlier || !inquiryId) return;
    setLoadingEarlier(true);

    try {
      const olderData = await chatApi.getMessages(inquiryId, nextBefore);
      if (olderData && olderData.messages.length > 0) {
        setNextBefore(olderData.nextBefore);
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newOlder = olderData.messages.filter((m) => !existingIds.has(m._id));
          return [...prev, ...newOlder.reverse()];
        });
      } else {
        setNextBefore(null);
      }
    } catch (err: any) {
      console.warn("[ChatConversationScreen] handleLoadEarlier error:", err.message);
    } finally {
      setLoadingEarlier(false);
    }
  };

  // 5. Send Message (Optimistic)
  const handleSend = async () => {
    const draft = text.trim();
    if (!draft || sendLock.current || !inquiryId || !currentUserId) return;

    sendLock.current = true;
    setSending(true);
    setSendError(null);
    setText("");

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMessage: ChatMessage = {
      _id: tempId,
      clientTempId: tempId,
      senderId: currentUserId,
      text: draft,
      createdAt: new Date().toISOString(),
      sending: true,
    };

    setMessages((prev) => [optimisticMessage, ...prev]);

    try {
      const updatedConv = await chatApi.sendMessage(inquiryId, draft);
      const savedMessage = updatedConv?.messages?.at(-1);

      setMessages((prev) =>
        prev.map((m) => {
          if (m._id === tempId || m.clientTempId === tempId) {
            return savedMessage
              ? { ...savedMessage, sending: false, sendError: false }
              : { ...m, sending: false, sendError: false };
          }
          return m;
        })
      );

      void refreshNotificationCount();
    } catch (err: any) {
      console.error("[ChatConversationScreen] send failed:", err?.message);
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id === tempId || m.clientTempId === tempId) {
            return { ...m, sending: false, sendError: true };
          }
          return m;
        })
      );
      setText(draft);
      setSendError("Couldn’t send your message. Your draft is still here.");
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

        {loading && !messages.length ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={C.blue} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            inverted
            keyExtractor={(item) => item._id || item.clientTempId || Math.random().toString()}
            renderItem={({ item }) => {
              const mine = getParticipantId(item.senderId) === currentUserId;
              const isInitialMessage = item._id.startsWith("initial_");
              return (
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
            }}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadEarlier}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              loadingEarlier ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={C.blue} />
                </View>
              ) : undefined
            }
          />
        )}
      </View>

      {/* Error Banner */}
      {sendError && (
        <View style={styles.chatSendErrorBox}>
          <Text accessibilityRole="alert" style={styles.chatSendError}>
            {sendError}
          </Text>
        </View>
      )}

      {/* Sold Property Lock Banner */}
      {isSold && (
        <View style={styles.soldBanner}>
          <Text style={styles.soldBannerText}>This property is sold. Conversation is read-only.</Text>
        </View>
      )}

      {/* Exact Previous Bottom Composer with Gold Button */}
      {!isSold && (
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
                  onChangeText={(val) => {
                    setText(val);
                    if (sendError) setSendError(null);
                  }}
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
                  onPress={handleSend}
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
