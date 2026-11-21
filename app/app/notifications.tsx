import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused, useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MarketplaceShell } from "../components/MalikseMarketplace";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { refreshNotificationCount, useNotificationStore } from "../src/store/notificationStore";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
  target: { kind: "inquiry" | "deal"; id: string } | null;
};
type NotificationPage = { items: NotificationItem[]; nextCursor: string | null };

export default function NotificationsScreen() {
  const userId = useAuthStore(state => state.user?.id);
  return (
    <MarketplaceShell title="Notifications" subtitle="Updates on your messages and deals." back showDock={false}>
      {userId ? <Inbox key={userId} userId={userId} /> : <Text style={styles.body}>Sign in to view your notifications.</Text>}
    </MarketplaceShell>
  );
}

function Inbox({ userId }: { userId: string }) {
  const router = useRouter();
  const focused = useIsFocused();
  const unread = useNotificationStore(state => state.userId === userId ? state.unread : 0);
  const [page, setPage] = useState<NotificationPage>();
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (focused) void refreshNotificationCount();
  }, [focused]);

  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    void api.get<NotificationPage>("/push/notifications", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setPage(data);
        setError("");
      })
      .catch(() => { if (!controller.signal.aborted) setError("Couldn’t load notifications."); });
    return () => controller.abort();
  }, [focused, unread, retry]);

  async function loadOlder(before: string) {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<NotificationPage>("/push/notifications", { params: { before } });
      setPage(current => current?.nextCursor === before
        ? { items: [...current.items, ...data.items], nextCursor: data.nextCursor }
        : current);
    } catch {
      setError("Couldn’t load older notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function open(item: NotificationItem) {
    setOpening(true);
    try {
      if (!item.readAt) {
        await api.patch(`/push/notifications/${item.id}/read`);
        const readAt = new Date().toISOString();
        setPage(current => current && { ...current, items: current.items.map(row => row.id === item.id ? { ...row, readAt } : row) });
        void refreshNotificationCount();
      }
      if (useAuthStore.getState().user?.id !== userId) return;
      if (item.target?.kind === "inquiry") {
        router.push({ pathname: "/(tabs)/messages", params: { inquiryId: item.target.id } });
      } else if (item.target?.kind === "deal") {
        router.push(`/deal/${item.target.id}` as Href);
      }
    } catch {
      setError("Couldn’t open this notification. Tap it to try again.");
    } finally {
      setOpening(false);
    }
  }

  return <View style={styles.list}>
    {error ? <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.action}>
      <Text style={styles.body}>{error} Refresh</Text>
    </Pressable> : !page ? <ActivityIndicator color="#14263E" accessibilityLabel="Loading notifications" /> : null}
    {page?.items.length === 0 && <View style={styles.action}><Text style={styles.body}>You’re all caught up.</Text></View>}
    {page?.items.map(item => (
      <Pressable key={item.id} accessibilityRole="button" disabled={opening || (!!item.readAt && !item.target)}
        onPress={() => void open(item)} style={[styles.card, !item.readAt && styles.unread]}>
        <MaterialIcons name={item.target?.kind === "inquiry" ? "chat-bubble-outline" : "notifications-none"} size={20} color="#14263E" />
        <View style={styles.details}>
          <Text style={styles.title}>{item.title}{item.readAt ? "" : " · Unread"}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        {item.target && <MaterialIcons name="chevron-right" size={20} color="#14263E" />}
      </Pressable>
    ))}
    {page?.nextCursor && <Pressable accessibilityRole="button" disabled={loading} style={styles.action}
      onPress={() => void loadOlder(page.nextCursor!)}>
      {loading ? <ActivityIndicator color="#14263E" /> : <Text style={styles.title}>Load older notifications</Text>}
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 15,
    borderRadius: 16, borderWidth: 1, borderColor: "#DADEE4", backgroundColor: "#fff" },
  unread: { backgroundColor: "#FFF7DB", borderColor: "#EBCB66" },
  details: { flex: 1, gap: 4 },
  title: { fontFamily: "ManropeBold", color: "#14263E", fontSize: 15 },
  body: { fontFamily: "Manrope", color: "#536174", fontSize: 14 },
  date: { fontFamily: "Manrope", color: "#536174", fontSize: 12 },
  action: { alignItems: "center", padding: 15 },
});
