import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface ChatBubbleProps {
  mine: boolean;
  text: string;
  createdAt?: string;
  offer?: number;
  sending?: boolean;
  sendError?: boolean;
  recipientReadAt?: string | null;
}

function formatChatTime(dateString?: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function formatCurrency(amount: number): string {
  try {
    return "₹" + amount.toLocaleString("en-IN");
  } catch {
    return `₹${amount}`;
  }
}

export const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({
  mine,
  text,
  createdAt,
  offer,
  sending,
  sendError,
  recipientReadAt,
}) => {
  const isRead = Boolean(
    mine &&
    createdAt &&
    recipientReadAt &&
    Date.parse(recipientReadAt) >= Date.parse(createdAt)
  );

  const timeString = formatChatTime(createdAt);

  return (
    <View style={[styles.container, mine ? styles.containerMine : styles.containerTheirs]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          sendError && styles.bubbleError,
        ]}
      >
        {/* If this is an offer message, show a WhatsApp-style offer badge */}
        {Boolean(offer) && (
          <View style={styles.offerCard}>
            <MaterialIcons name="local-offer" size={15} color="#008069" />
            <Text style={styles.offerText}>Proposed Offer: {formatCurrency(offer!)}</Text>
          </View>
        )}

        {/* Message Content */}
        <Text style={styles.messageText} selectable>
          {text}
        </Text>

        {/* Timestamp and Delivery Receipts */}
        <View style={styles.metaRow}>
          <Text style={styles.timeText}>
            {sending ? "Sending..." : timeString}
          </Text>

          {mine && (
            <View style={styles.receiptContainer}>
              {sending ? (
                <MaterialIcons name="access-time" size={13} color="#8696A0" />
              ) : sendError ? (
                <MaterialIcons name="error-outline" size={14} color="#EA4335" />
              ) : isRead ? (
                <MaterialIcons name="done-all" size={15} color="#53BDEB" />
              ) : (
                <MaterialIcons name="done-all" size={15} color="#8696A0" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 3,
    paddingHorizontal: 12,
    flexDirection: "row",
    width: "100%",
  },
  containerMine: {
    justifyContent: "flex-end",
  },
  containerTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1,
  },
  bubbleMine: {
    backgroundColor: "#E7FFDB", // WhatsApp light green
    borderTopRightRadius: 2,
    alignSelf: "flex-end",
  },
  bubbleTheirs: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 2,
    alignSelf: "flex-start",
  },
  bubbleError: {
    backgroundColor: "#FFF0F0",
    borderColor: "#FFCDD2",
    borderWidth: 1,
  },
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 128, 105, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    gap: 6,
  },
  offerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#008069",
  },
  messageText: {
    fontSize: 15,
    color: "#111B21",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    marginTop: 3,
    gap: 3,
  },
  timeText: {
    fontSize: 11,
    color: "#667781",
  },
  receiptContainer: {
    marginLeft: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
