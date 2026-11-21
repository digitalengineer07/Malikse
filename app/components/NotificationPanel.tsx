import { MaterialIcons } from "@expo/vector-icons";
import { useIsFocused, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTheme, marketplaceBackground } from "../constants/theme";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { refreshNotificationCount, useNotificationStore } from "../src/store/notificationStore";

type NotificationItem = {
  id: string;
  title: string;
  senderName?: string;
  body: string;
  createdAt: string;
  readAt?: string;
  target: { kind: "inquiry" | "deal" | "property" | "listings"; id: string } | null;
};
type NotificationPage = { items: NotificationItem[]; nextCursor: string | null };
const navy = "#14263E";
const yellow = "#FCC61C";
const paleYellow = "#FFF1C0";
const { cardSolid, textSecondary, divider, white } = AppTheme.colors;
// Some Android Hermes runtimes expose Intl without RelativeTimeFormat.
const RelativeTimeFormat = globalThis.Intl?.RelativeTimeFormat;
const relativeTime = typeof RelativeTimeFormat === "function"
  ? new RelativeTimeFormat(undefined, { numeric: "auto" })
  : undefined;

const rowIcons = {
  inquiry: "chat-bubble-outline",
  deal: "handshake",
  property: "home-work",
  listings: "assignment",
} as const;

function initials(name?: string) {
  return name?.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase();
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsedMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (relativeTime && elapsedMinutes >= 0 && elapsedMinutes < 60) return relativeTime.format(-elapsedMinutes, "minute");
  if (relativeTime && elapsedMinutes >= 60 && elapsedMinutes < 1440) return relativeTime.format(-Math.floor(elapsedMinutes / 60), "hour");
  return date.toLocaleString(undefined, { month: "short", day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
    hour: "numeric", minute: "2-digit" });
}

export default function NotificationPanel() {
  const router = useRouter();
  const focused = useIsFocused();
  const user = useAuthStore(state => state.user);
  const unread = useNotificationStore(state => state.userId === user?.id ? state.unread : 0);
  const [revision, setRevision] = useState(0);
  const insets = useSafeAreaInsets();
  const accountInitials = initials(user?.name);
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/home");
  const refresh = () => {
    void refreshNotificationCount();
    setRevision(value => value + 1);
  };
  return (
    <View style={styles.screen}>
        {focused && <StatusBar style="light" />}
        <View style={[styles.header, {
          paddingTop: insets.top + 14,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
        }]}>
          <View style={styles.headerContent}>
            <View style={styles.toolbar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back}>
                <MaterialIcons name="arrow-back" size={22} color={white} />
              </Pressable>
              <View accessible={false} style={styles.account}>
                {accountInitials ? <Text style={styles.accountText}>{accountInitials}</Text> :
                  <MaterialIcons name="person-outline" size={22} color={navy} />}
              </View>
            </View>
            <View style={styles.headingRow}>
              <View style={styles.headingGroup}>
                <Text accessibilityRole="header" style={styles.heading}>Notifications</Text>
                {unread > 0 && <View style={styles.count} accessibilityLabel={`${unread} unread`}>
                  <Text style={styles.countText}>{unread > 99 ? "99+" : unread}</Text>
                </View>}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" onPress={refresh} style={styles.refresh}>
                <MaterialIcons name="refresh" size={21} color={yellow} />
              </Pressable>
            </View>
          </View>
        </View>
        <ScrollView style={[styles.listSurface, {
          marginLeft: insets.left + 14,
          marginRight: insets.right,
        }]}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 12 }]}>
          {user ? <Inbox key={user.id} userId={user.id} revision={revision} refresh={refresh} /> :
            <Text style={[styles.body, styles.action]}>Sign in to view notifications.</Text>}
        </ScrollView>
    </View>
  );
}

function Inbox({ userId, revision, refresh }: {
  userId: string; revision: number; refresh: () => void;
}) {
  const router = useRouter();
  const unread = useNotificationStore(state => state.userId === userId ? state.unread : 0);
  const [page, setPage] = useState<NotificationPage>();
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshNotificationCount();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void api.get<NotificationPage>("/push/notifications", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setPage(data);
        setError("");
      })
      .catch(() => { if (!controller.signal.aborted) setError("Couldn’t load notifications."); });
    return () => controller.abort();
  }, [unread, revision]);

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
      } else if (item.target?.kind === "property") {
        router.push(`/property/${item.target.id}` as Href);
      } else if (item.target?.kind === "listings") {
        router.push("/my-properties" as Href);
      }
    } catch {
      setError("Couldn’t open this notification. Tap it to try again.");
    } finally {
      setOpening(false);
    }
  }

  return <View>
    {error ? <Pressable accessibilityRole="button" onPress={refresh} style={styles.action}>
      <Text style={styles.body}>{error} Refresh</Text>
    </Pressable> : !page ? <ActivityIndicator style={styles.action} color={navy} accessibilityLabel="Loading notifications" /> : null}
    {page?.items.length === 0 && <View style={styles.action}><Text style={styles.body}>You’re all caught up.</Text></View>}
    {page?.items.map(item => {
      const unread = !item.readAt;
      const senderInitials = initials(item.senderName);
      const timestamp = formatTimestamp(item.createdAt);
      return <Pressable key={item.id} accessibilityRole="button"
        accessibilityLabel={[item.title, item.body, timestamp, unread ? "Unread" : ""].filter(Boolean).join(", ")}
        disabled={opening || (!unread && !item.target)}
        onPress={() => void open(item)} style={({ pressed }) => [styles.row, unread && styles.unread, pressed && styles.pressed]}>
        <View style={[styles.itemIcon, unread && styles.unreadIcon]}>
          {senderInitials ? <Text style={styles.accountText}>{senderInitials}</Text> :
            <MaterialIcons name={item.target ? rowIcons[item.target.kind] : "notifications-none"} size={20} color={navy} />}
        </View>
        <View style={styles.details}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
          <Text style={styles.date}>{timestamp}</Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </Pressable>;
    })}
    {page?.nextCursor && <Pressable accessibilityRole="button" disabled={loading} style={styles.action}
      onPress={() => void loadOlder(page.nextCursor!)}>
      {loading ? <ActivityIndicator color={navy} /> : <Text style={styles.title}>Load older notifications</Text>}
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: navy },
  header: { paddingBottom: 16 },
  headerContent: { width: "100%", maxWidth: 720, alignSelf: "center", gap: 8 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF24", alignItems: "center", justifyContent: "center" },
  account: { width: 42, height: 42, borderRadius: 21, backgroundColor: paleYellow, alignItems: "center", justifyContent: "center" },
  accountText: { fontFamily: "ManropeBold", color: navy, fontSize: 14 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  headingGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { color: white, fontFamily: "Fraunces", fontSize: 28, flexShrink: 1 },
  count: { minWidth: 24, minHeight: 24, borderRadius: 12, paddingHorizontal: 5, justifyContent: "center", alignItems: "center", backgroundColor: yellow },
  countText: { fontFamily: "ManropeBold", color: navy, fontSize: 12 },
  refresh: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  listSurface: { flex: 1, backgroundColor: cardSolid, borderTopLeftRadius: 34, overflow: "hidden" },
  scroll: { width: "100%", maxWidth: 760, alignSelf: "center", paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingLeft: 24, paddingRight: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
  itemIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: marketplaceBackground, alignItems: "center", justifyContent: "center" },
  unreadIcon: { backgroundColor: paleYellow },
  unread: { backgroundColor: marketplaceBackground },
  pressed: { opacity: 0.72 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: yellow },
  details: { flex: 1, gap: 2 },
  title: { fontFamily: "ManropeBold", color: navy, fontSize: 15 },
  body: { fontFamily: "Manrope", color: textSecondary, fontSize: 14 },
  date: { fontFamily: "Manrope", color: textSecondary, fontSize: 12, marginTop: 2 },
  action: { alignItems: "center", padding: 18 },
});
