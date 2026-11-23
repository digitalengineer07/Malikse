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

const C = {
  ink: "#14263E",
  sunSoft: "#FBF2C0",
  blue: "#0A45B5",
  line: "#E2ECF8",
  muted: "#5D7089",
  readBlue: "#1766C2",
};

function formatChatTime(dateString?: string): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

function formatMoney(amount: number): string {
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
  const read = Boolean(
    mine &&
    createdAt &&
    recipientReadAt &&
    Date.parse(recipientReadAt) >= Date.parse(createdAt)
  );

  const timeString = formatChatTime(createdAt);

  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs, sendError && styles.sendError]}>
      <Text style={styles.chatMessage} selectable>
        {text}
      </Text>

      {Boolean(offer) && (
        <Text style={styles.cardTitle}>Offer: {formatMoney(offer!)}</Text>
      )}

      {(sending || createdAt) && (
        <View style={styles.chatMetadata}>
          <Text style={styles.chatTime}>
            {sending ? "Sending…" : timeString}
          </Text>

          {mine && (
            <View style={styles.receiptContainer}>
              {sending ? (
                <MaterialIcons name="access-time" size={13} color={C.muted} />
              ) : sendError ? (
                <MaterialIcons name="error-outline" size={14} color="#D32F2F" />
              ) : (
                <MaterialIcons name={read ? "done-all" : "done"} size={15} color={read ? C.readBlue : C.muted} />
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
});

ChatBubble.displayName = "ChatBubble";

const styles = StyleSheet.create({
  bubble: {
    alignItems: "stretch",
    minWidth: 70,
    maxWidth: "84%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginVertical: 4,
    gap: 2,
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: C.sunSoft,
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  sendError: {
    backgroundColor: "#FFF0F0",
    borderColor: "#FFCDD2",
    borderWidth: 1,
  },
  chatMessage: {
    fontFamily: "Manrope_400Regular",
    color: C.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  cardTitle: {
    fontFamily: "ManropeBold",
    fontSize: 13,
    color: C.blue,
    fontWeight: "700",
    marginTop: 2,
  },
  chatMetadata: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  chatTime: {
    fontFamily: "Manrope_400Regular",
    color: C.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  receiptContainer: {
    marginLeft: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
