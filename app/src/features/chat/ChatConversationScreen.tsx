import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
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
import { chatApi } from "./chatApi";
import { ChatBubble } from "./ChatBubble";
import type { ChatConversation, ChatMessage } from "./chatTypes";

interface ChatConversationScreenProps {
  inquiryId: string;
  onBack: () => void;
}

function getParticipantId(party: any): string {
  if (!party) return "";
  return typeof party === "object" ? String(party._id || "") : String(party);
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
      // Fetch conversation summary and recent messages in parallel
      const [convData, msgData] = await Promise.all([
        conversation ? Promise.resolve(conversation) : chatApi.getConversation(inquiryId),
        chatApi.getMessages(inquiryId),
      ]);

      if (convData) setConversation(convData);

      if (msgData) {
        setRecipientReadAt(msgData.recipientReadAt ?? null);
        setNextBefore(msgData.nextBefore);

        // Merge incoming server messages with any optimistic local messages
        setMessages((prev) => {
          const optimisticPending = prev.filter((m) => m.sending || m.sendError);
          const serverList = [...msgData.messages];

          // If nextBefore is null, it means we have reached the very first message.
          // Check if initial inquiry message needs to be included as the base message
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

          // Combine server messages with pending optimistic messages
          // In inverted list, newest message is at index 0
          const combined = [...serverList];
          for (const opt of optimisticPending) {
            if (!combined.some((m) => m._id === opt._id || (m.text === opt.text && m.senderId === opt.senderId))) {
              combined.push(opt);
            }
          }

          // Sort chronologically ascending, then reverse for inverted FlatList
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

  // Initial mount
  useEffect(() => {
    void loadMessages(true);
  }, [inquiryId]);

  // 2. Real-time Polling & Push Trigger
  useEffect(() => {
    if (!inquiryId || !currentUserId) return;

    // Periodic polling every 4.5 seconds when active
    const interval = setInterval(() => {
      if (AppState.currentState === "active") {
        void loadMessages(false);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [inquiryId, currentUserId, loadMessages]);

  // Listen to push notification revision updates
  useEffect(() => {
    if (chatRevision !== lastHandledRevision.current) {
      lastHandledRevision.current = chatRevision;
      void loadMessages(false);
    }
  }, [chatRevision, loadMessages]);

  // 3. Mark Read Receipts
  useEffect(() => {
    if (!messages.length || !conversation || !currentUserId) return;

    // Find newest message sent by the other party
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
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, conversation, currentUserId, inquiryId]);

  // 4. Load Earlier History (Pagination on scroll)
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
          // In inverted list, older messages go to the end of the array
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

  // 5. Send Message (Optimistic UI Update)
  const handleSend = async () => {
    const draft = text.trim();
    if (!draft || sendLock.current || !inquiryId || !currentUserId) return;

    sendLock.current = true;
    setSending(true);
    setSendError(null);
    setText(""); // Clear input immediately for snappy feel

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMessage: ChatMessage = {
      _id: tempId,
      clientTempId: tempId,
      senderId: currentUserId,
      text: draft,
      createdAt: new Date().toISOString(),
      sending: true,
    };

    // Prepend optimistic message to inverted list (index 0)
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

      // Refresh notification badge
      void refreshNotificationCount();
    } catch (err: any) {
      console.error("[ChatConversationScreen] send failed:", err?.message);
      // Mark as error and restore draft so user never loses work
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id === tempId || m.clientTempId === tempId) {
            return { ...m, sending: false, sendError: true };
          }
          return m;
        })
      );
      setText(draft);
      setSendError("Message could not be sent. Check your connection.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  // Header Details
  const isBuyer = getParticipantId(conversation?.buyerId) === currentUserId;
  const otherParty = isBuyer ? conversation?.staffId : conversation?.buyerId;
  const otherName =
    (typeof otherParty === "object" && otherParty?.name) ||
    (isBuyer ? "Property Advisor" : "Buyer");
  const otherRole =
    typeof otherParty === "object" && otherParty?.role
      ? otherParty.role.charAt(0).toUpperCase() + otherParty.role.slice(1)
      : isBuyer
      ? "Advisor"
      : "Client";
  const propertyTitle = conversation?.propertyId?.title || "Property Conversation";
  const dealId = conversation?.dealId
    ? typeof conversation.dealId === "object"
      ? conversation.dealId._id
      : conversation.dealId
    : null;
  const isSold = conversation?.propertyId?.status === "sold";

  return (
    <View style={styles.screen}>
      {/* WhatsApp Styled Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Contact Avatar */}
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
          </View>

          {/* Contact Info & Property Pill */}
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {otherRole} · {propertyTitle}
            </Text>
          </View>

          {/* Optional Deal View Button */}
          {dealId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View Deal"
              onPress={() => router.push(`/deal/${dealId}` as any)}
              style={({ pressed }) => [styles.dealButton, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="handshake" size={16} color="#008069" />
              <Text style={styles.dealButtonText}>Deal</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main Chat Feed */}
      <View style={styles.chatBackground}>
        {loading && !messages.length ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#008069" />
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
                  <ActivityIndicator size="small" color="#008069" />
                </View>
              ) : undefined
            }
          />
        )}
      </View>

      {/* Send Error Toast */}
      {sendError && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="info-outline" size={16} color="#D32F2F" />
          <Text style={styles.errorBannerText}>{sendError}</Text>
        </View>
      )}

      {/* Read-Only Notice if Property Sold */}
      {isSold && (
        <View style={styles.soldBanner}>
          <MaterialIcons name="lock" size={16} color="#555" />
          <Text style={styles.soldBannerText}>This property is sold. Conversation is read-only.</Text>
        </View>
      )}

      {/* WhatsApp Styled Bottom Composer */}
      {!isSold && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#8696A0"
                value={text}
                onChangeText={(val) => {
                  setText(val);
                  if (sendError) setSendError(null);
                }}
                multiline
                maxLength={4000}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!text.trim() || sending}
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendButton,
                (!text.trim() || sending) && styles.sendButtonDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EFEAE2", // WhatsApp classic background
  },
  header: {
    backgroundColor: "#008069", // WhatsApp dark green
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    gap: 8,
  },
  backButton: {
    padding: 6,
    borderRadius: 20,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#D1EBE5",
    fontSize: 12,
    marginTop: 1,
  },
  dealButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 4,
  },
  dealButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008069",
  },
  chatBackground: {
    flex: 1,
    backgroundColor: "#EFEAE2",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingVertical: 12,
  },
  footerLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#FFCDD2",
  },
  errorBannerText: {
    fontSize: 12,
    color: "#D32F2F",
    flex: 1,
  },
  soldBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0E0E0",
    paddingVertical: 10,
    gap: 6,
  },
  soldBannerText: {
    fontSize: 13,
    color: "#424242",
    fontWeight: "600",
  },
  composerArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: "transparent",
    gap: 6,
  },
  inputPill: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  textInput: {
    fontSize: 15,
    color: "#111B21",
    lineHeight: 20,
    padding: 0,
    margin: 0,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#00A884", // WhatsApp emerald green
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: "#8696A0",
    opacity: 0.6,
  },
});
