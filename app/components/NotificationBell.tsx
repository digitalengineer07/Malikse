import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthStore } from "../src/store/authStore";
import { useNotificationStore } from "../src/store/notificationStore";

export default function NotificationBell() {
  const router = useRouter();
  const userId = useAuthStore(state => state.user?.id);
  const unread = useNotificationStore(state => state.userId === userId ? state.unread : 0);
  if (!userId) return null;
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
      onPress={() => router.push("/notifications" as Href)} style={styles.button}>
      <MaterialIcons name="notifications-none" color="#14263E" size={23} />
      {unread > 0 && <View style={styles.badge}><Text style={styles.count}>{unread > 99 ? "99+" : unread}</Text></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF1C0", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 19, paddingHorizontal: 3, minHeight: 19,
    borderRadius: 10, borderColor: "#FFF1C0", borderWidth: 1, backgroundColor: "#14263E", alignItems: "center", justifyContent: "center" },
  count: { color: "#fff", fontFamily: "ManropeBold", fontSize: 10 },
});
