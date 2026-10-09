import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { adminService } from "../../src/services/adminService";
import { useAuthStore } from "../../src/store/authStore";
import { MaterialIcons } from "@expo/vector-icons";

export default function ManageUsersScreen() {
  const router = useRouter();
  const { user, authState } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any>({ inquiries: [], deals: [] });
  const [loadingProps, setLoadingProps] = useState(false);

  useEffect(() => {
    if (authState !== "AUTHENTICATED" || user?.role !== "admin") return;
    setLoading(true);
    adminService.listUsers().then(setUsers).catch((cause) => {
      setError(cause.response?.data?.message || "Could not load user accounts");
    }).finally(() => setLoading(false));
  }, [authState, user?.role]);

  const viewProperties = async (usr: any) => {
    if (selectedUser?._id === usr._id) {
      setSelectedUser(null);
      return;
    }
    setSelectedUser(usr);
    setLoadingProps(true);
    try {
      const [props, txs] = await Promise.all([
        adminService.getUserProperties(usr._id),
        adminService.getUserTransactions(usr._id)
      ]);
      setProperties(props);
      setTransactions(txs);
    } catch (e) {
      console.error(e);
      setProperties([]);
    } finally {
      setLoadingProps(false);
    }
  };

  const toggleSuspension = async (usr: any) => {
    try {
      await adminService.suspendUser(usr._id);
      setUsers(users.map(u => u._id === usr._id ? { ...u, isSuspended: !u.isSuspended } : u));
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to toggle suspension");
    }
  };

  if (authState !== "AUTHENTICATED" || user?.role !== "admin") {
    return <View style={styles.screen}><Text style={styles.title}>Admin sign in required</Text><TouchableOpacity onPress={() => router.replace("/login")}><Text style={styles.link}>Go to sign in</Text></TouchableOpacity></View>;
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/admin/dashboard")}><Text style={styles.link}>← Admin dashboard</Text></TouchableOpacity>
    <Text style={styles.title}>User Accounts</Text>
    <Text style={styles.description}>View all registered users and tap on an account to see their property listings.</Text>
    
    {error ? <Text style={styles.error}>{error}</Text> : null}
    
    {loading ? <ActivityIndicator color="#047857" style={{ marginTop: 20 }} /> : users.length === 0 ? <Text style={styles.description}>No users registered yet.</Text> : users.map((usr) => (
      <View key={usr._id} style={styles.userCard}>
        <TouchableOpacity style={styles.userHeader} onPress={() => viewProperties(usr)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, usr.isSuspended && { color: "#B91C1C", textDecorationLine: "line-through" }]}>{usr.name} {usr.isVerifiedIdentity && <MaterialIcons name="verified" size={14} color="#047857" />}</Text>
            <Text style={styles.userDetail}>{usr.mobile}{usr.email ? ` · ${usr.email}` : ""}</Text>
            <Text style={styles.userDetail}>Joined: {new Date(usr.createdAt).toLocaleDateString()}</Text>
            {usr.isSuspended && <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "600", marginTop: 4 }}>[SUSPENDED]</Text>}
          </View>
          <MaterialIcons name={selectedUser?._id === usr._id ? "expand-less" : "expand-more"} size={24} color="#53645B" />
        </TouchableOpacity>
        
        {selectedUser?._id === usr._id && (
          <View style={styles.propertiesSection}>
            <Text style={styles.propsHeading}>Properties Listed</Text>
            {loadingProps ? <ActivityIndicator color="#047857" /> : properties.length === 0 ? <Text style={styles.description}>No properties listed by this user.</Text> : properties.map((prop) => (
              <TouchableOpacity key={prop._id} style={styles.propRow} onPress={() => router.push({ pathname: "/property/[id]", params: { id: prop._id } })}>
                <View>
                  <Text style={styles.propTitle}>{prop.title || `${prop.type} in ${prop.location?.district}`}</Text>
                  <Text style={styles.propDetail}>₹{prop.price?.toLocaleString("en-IN")} · Status: <Text style={{fontWeight:"600", textTransform: "capitalize"}}>{prop.status}</Text></Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#53645B" />
              </TouchableOpacity>
            ))}
            
            <Text style={[styles.propsHeading, { marginTop: 24 }]}>Recent Transactions</Text>
            {loadingProps ? <ActivityIndicator color="#047857" /> : transactions.deals.length === 0 && transactions.inquiries.length === 0 ? <Text style={styles.description}>No active deals or inquiries.</Text> : (
              <>
                {transactions.deals.map((deal: any) => (
                  <View key={`d_${deal._id}`} style={styles.propRow}>
                    <View><Text style={styles.propTitle}>Deal: {deal.propertyId?.title}</Text><Text style={styles.propDetail}>Status: {deal.status} · ₹{deal.agreedPrice?.toLocaleString("en-IN")}</Text></View>
                  </View>
                ))}
                {transactions.inquiries.map((inq: any) => (
                  <View key={`i_${inq._id}`} style={styles.propRow}>
                    <View><Text style={styles.propTitle}>Inquiry: {inq.propertyId?.title}</Text><Text style={styles.propDetail}>Status: {inq.status}</Text></View>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: usr.isSuspended ? "#F3F4F6" : "#FEF2F2", borderRadius: 8, alignItems: "center" }} onPress={() => toggleSuspension(usr)}>
              <Text style={{ color: usr.isSuspended ? "#374151" : "#B91C1C", fontWeight: "700" }}>
                {usr.isSuspended ? "Unsuspend User" : "Suspend User Account"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ))}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 24, paddingBottom: 60 },
  link: { color: "#047857", fontWeight: "700", marginBottom: 14 },
  title: { fontSize: 27, fontWeight: "800", color: "#10251B", marginBottom: 8 },
  description: { color: "#53645B", lineHeight: 21, marginBottom: 18 },
  userCard: { backgroundColor: "white", borderWidth: 1, borderColor: "#D7E6DC", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  userHeader: { padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  userName: { color: "#10251B", fontSize: 16, fontWeight: "700", textTransform: "capitalize", marginBottom: 4 },
  userDetail: { color: "#53645B", fontSize: 13, marginBottom: 2 },
  propertiesSection: { padding: 18, backgroundColor: "#F7FBF9", borderTopWidth: 1, borderTopColor: "#D7E6DC" },
  propsHeading: { fontSize: 14, fontWeight: "700", color: "#10251B", marginBottom: 12 },
  propRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E8F1EC", marginBottom: 8 },
  propTitle: { color: "#10251B", fontWeight: "600", marginBottom: 4 },
  propDetail: { color: "#53645B", fontSize: 12 },
  error: { color: "#B91C1C", marginTop: 12, marginBottom: 12 },
});
