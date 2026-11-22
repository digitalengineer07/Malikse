import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import api from "../src/services/authService";
export default function NotificationFailures() {
  const [failures, setFailures] = useState<{ _id: string; title: string; lastError: string }[]>([]);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void api.get("/admin/notification-failures?limit=20", { signal: controller.signal }).then(({ data }) => { setFailures(data); setError(false); }).catch(() => { if (!controller.signal.aborted) setError(true); }); };
    refresh(); const timer = setInterval(refresh, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [revision]);
  if (!error && !failures.length) return null;
  return <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: "#fff3dc", borderRadius: 12, marginVertical: 12, gap: 8 }}>
    <Text style={{ fontWeight: "700", color: "#713f12" }}>{error ? "Notification delivery monitoring unavailable" : `${failures.length}${failures.length === 20 ? "+" : ""} notifications need attention`}</Text>
    {failures.map(item => <Text key={item._id} style={{ color: "#713f12" }}>{item.title}: {item.lastError}</Text>)}
    <Text>Check push provider credentials and failed deliveries. The underlying inquiries and deals remain available in the workspace.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => setRevision(value => value + 1)}><Text style={{ color: "#075e54", fontWeight: "700" }}>Refresh delivery status</Text></TouchableOpacity>
  </View>;
}
