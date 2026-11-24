import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import RoleDashboard from "../../components/RoleDashboard";

const navy = "#14263E";
const gold = "#FCC61C";
const muted = "#536174";
type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

function Destination({ title, text, icon, route, tile = false }: {
  title: string; text: string; icon: IconName; route: Href; tile?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.navigate(route)}
      style={({ pressed }) => [tile ? styles.tile : styles.row, pressed && styles.pressed]}>
      {tile ? (
        <View style={styles.tileTop}>
          <View style={styles.icon}><MaterialIcons name={icon} size={21} color={navy} /></View>
          <MaterialIcons name="north-east" size={18} color={muted} />
        </View>
      ) : (
        <View style={styles.icon}><MaterialIcons name={icon} size={21} color={navy} /></View>
      )}
      <View style={styles.copy}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.description}>{text}</Text>
      </View>
      {!tile && <MaterialIcons name="chevron-right" size={21} color={navy} />}
    </Pressable>
  );
}

function AdminWorkspace() {
  const router = useRouter();
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => router.navigate("/admin/properties")}
        style={({ pressed }) => [styles.review, pressed && styles.pressed]}>
        <View style={styles.reviewIcon}><MaterialIcons name="fact-check" size={25} color={navy} /></View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.reviewTitle}>Property verification</Text>
          <Text style={styles.reviewDescription}>Assign reviewers, track corrections, and check publication history.</Text>
        </View>
        <MaterialIcons name="arrow-forward" size={21} color={gold} />
      </Pressable>

      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>Messages and support</Text>
        <View style={styles.tiles}>
          <Destination tile title="Verifier chats" text="Read and reply to verifier messages." icon="forum" route="/(tabs)/messages" />
          <Destination tile title="Support inbox" text="Respond to user and staff requests." icon="support-agent" route="/support" />
        </View>
      </View>

      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>Manage MalikSe</Text>
        <View style={styles.panel}>
          <Destination title="Staff accounts" text="Register and manage advisors and verifiers." icon="badge" route="/admin/staff" />
          <View style={styles.divider} />
          <Destination title="User accounts" text="Find users and view their listings." icon="people-outline" route="/admin/users" />
          <View style={styles.divider} />
          <Destination title="Marketplace" text="Browse verified properties." icon="home-work" route="/(tabs)/search" />
        </View>
      </View>
    </>
  );
}

export default function AdminDashboard() {
  return <RoleDashboard role="admin" title="Admin dashboard"
    subtitle="Oversee property reviews, manage accounts, and respond to messages."
    workspace={<AdminWorkspace />} />;
}

const panel = { backgroundColor: "#fff", borderWidth: 1, borderColor: "#DEDCD5", borderRadius: 18 };
const styles = StyleSheet.create({
  review: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 20, backgroundColor: "#1C3556" },
  reviewIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: gold },
  reviewTitle: { color: "#fff", fontFamily: "Fraunces", fontSize: 22, lineHeight: 27 },
  reviewDescription: { color: "#E7EDF5", fontFamily: "Manrope", fontSize: 13, lineHeight: 19 },
  group: { gap: 10 },
  groupTitle: { color: navy, fontFamily: "Fraunces", fontSize: 22, lineHeight: 28 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { ...panel, flexGrow: 1, flexBasis: 140, minWidth: 0, padding: 13, gap: 9 },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  icon: { width: 39, height: 39, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#FFF1C0" },
  panel,
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, padding: 13 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#DEDCD5", marginHorizontal: 13 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  itemTitle: { color: navy, fontFamily: "ManropeExtraBold", fontSize: 15, lineHeight: 21 },
  description: { color: muted, fontFamily: "Manrope", fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.78 },
});
