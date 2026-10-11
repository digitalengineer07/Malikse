import { AppTheme } from "../../constants/theme";
import TextInput from "../../components/FormInput";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { adminService, type StaffAccount, type StaffRole } from "../../src/services/adminService";
import { useAuthStore } from "../../src/store/authStore";

export default function ManageStaffScreen() {
  const router = useRouter();
  const { user, authState } = useAuthStore();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [role, setRole] = useState<StaffRole>("advisor");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [workload, setWorkload] = useState<any>({ assigned: [], history: [] });
  const [loadingWorkload, setLoadingWorkload] = useState(false);

  useFocusEffect(React.useCallback(() => {
    if (authState !== "AUTHENTICATED" || user?.role !== "admin" || !user.id) return;
    setLoading(true);
    adminService.listStaff().then(setStaff).catch((cause) => {
      setError(cause.response?.data?.message || "Could not load staff accounts");
    }).finally(() => setLoading(false));
  }, [authState, user]));

  const create = async () => {
    if (saving) return;
    setError("");
    setMessage("");
    if (name.trim().length < 2 || !/^[0-9]{10}$/.test(mobile.trim()) || password.length < 8) {
      setError("Enter a name, 10-digit mobile number and password of at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const person = await adminService.createStaff({ role, name: name.trim(), mobile: mobile.trim(), email: email.trim() || undefined, password });
      setStaff((current) => [person, ...current]);
      setName("");
      setMobile("");
      setEmail("");
      setPassword("");
      setMessage(`${person.name} can now sign in as ${person.role} with the mobile number and password you set.`);
    } catch (cause: any) {
      setError(cause.response?.data?.message || "Could not create staff account. Check that the API is reachable.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (staffMember: StaffAccount) => {
    try {
      await adminService.toggleStaffStatus(staffMember.id);
      setStaff(staff.map(s => s.id === staffMember.id ? { ...s, isActive: !s.isActive } : s));
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to toggle status");
    }
  };

  const viewWorkload = async (staffMember: StaffAccount) => {
    if (selectedStaff?.id === staffMember.id) {
      setSelectedStaff(null);
      return;
    }
    setSelectedStaff(staffMember);
    setLoadingWorkload(true);
    try {
      const data = await adminService.getStaffWorkload(staffMember.id);
      setWorkload(data);
    } catch (e) {
      console.error(e);
      setWorkload({ assigned: [], history: [] });
    } finally {
      setLoadingWorkload(false);
    }
  };

  if (authState !== "AUTHENTICATED" || user?.role !== "admin") {
    return <View style={styles.screen}><Text style={styles.title}>Admin sign in required</Text><TouchableOpacity onPress={() => router.replace("/login")}><Text style={styles.link}>Go to sign in</Text></TouchableOpacity></View>;
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/admin/dashboard")}><Text style={styles.link}>← Admin dashboard</Text></TouchableOpacity>
    <Text style={styles.title}>Manage Advisors and Verifiers</Text>
    <Text style={styles.description}>Create a staff account, then give the person their mobile number and password through your own secure channel.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>Create staff account</Text>
      <View style={styles.roles}>
        {(["advisor", "verifier"] as StaffRole[]).map((value) => <TouchableOpacity key={value} style={[styles.role, role === value && styles.roleSelected]} onPress={() => setRole(value)}><Text style={[styles.roleText, role === value && styles.roleTextSelected]}>{value === "advisor" ? "Advisor" : "Verifier"}</Text></TouchableOpacity>)}
      </View>
      <Text style={styles.label}>Full name</Text>
      <TextInput accessibilityLabel="Full name" editable={!saving} style={styles.input} value={name} onChangeText={setName} placeholder="Staff member's name" />
      <Text style={styles.label}>Mobile number</Text>
      <TextInput accessibilityLabel="Mobile number" editable={!saving} style={styles.input} value={mobile} onChangeText={setMobile} placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} />
      <Text style={styles.label}>Email (optional)</Text>
      <TextInput accessibilityLabel="Email (optional)" editable={!saving} style={styles.input} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.label}>Temporary password</Text>
      <TextInput accessibilityLabel="Temporary password" editable={!saving} style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={create} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Creating…" : `Create ${role === "advisor" ? "Advisor" : "Verifier"}`}</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.heading}>Staff accounts</Text>
    {loading ? <ActivityIndicator color="#047857" /> : staff.length === 0 ? <Text style={styles.description}>No Advisors or Verifiers yet.</Text> : staff.map((person) =>
      <View style={styles.staffRow} key={person.id}>
        <TouchableOpacity style={styles.staffHeader} onPress={() => viewWorkload(person)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.staffName, person.isActive === false && { color: "#B91C1C", textDecorationLine: "line-through" }]}>{person.name} · {person.role}</Text>
            <Text style={styles.staffDetail}>{person.mobile}{person.email ? ` · ${person.email}` : ""}</Text>
            {person.isActive === false && <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "600", marginTop: 4 }}>[DEACTIVATED]</Text>}
          </View>
          <MaterialIcons name={selectedStaff?.id === person.id ? "expand-less" : "expand-more"} size={24} color="#53645B" />
        </TouchableOpacity>
        
        {selectedStaff?.id === person.id && (
          <View style={{ padding: 18, backgroundColor: "#F7FBF9", borderTopWidth: 1, borderTopColor: "#D7E6DC" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#10251B", marginBottom: 12 }}>Currently Assigned</Text>
            {loadingWorkload ? <ActivityIndicator color="#047857" /> : workload.assigned.length === 0 ? <Text style={styles.description}>No properties currently assigned.</Text> : workload.assigned.map((prop: any) => (
              <TouchableOpacity key={`a_${prop._id}`} style={styles.propRow} onPress={() => router.push({ pathname: "/verification/[id]", params: { id: prop._id } })}>
                <View><Text style={{ color: "#10251B", fontWeight: "600" }}>{prop.title}</Text><Text style={{ color: "#53645B", fontSize: 12 }}>Status: {prop.status}</Text></View>
                <MaterialIcons name="chevron-right" size={20} color="#53645B" />
              </TouchableOpacity>
            ))}

            <Text style={{ fontSize: 14, fontWeight: "700", color: "#10251B", marginTop: 24, marginBottom: 12 }}>Verification History</Text>
            {loadingWorkload ? <ActivityIndicator color="#047857" /> : workload.history.length === 0 ? <Text style={styles.description}>No history yet.</Text> : workload.history.map((prop: any) => (
              <TouchableOpacity key={`h_${prop._id}`} style={styles.propRow} onPress={() => router.push({ pathname: "/verification/[id]", params: { id: prop._id } })}>
                <View><Text style={{ color: "#10251B", fontWeight: "600" }}>{prop.title}</Text><Text style={{ color: "#53645B", fontSize: 12 }}>Current Status: {prop.status}</Text></View>
                <MaterialIcons name="chevron-right" size={20} color="#53645B" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={{ marginTop: 20, padding: 12, backgroundColor: person.isActive === false ? "#F3F4F6" : "#FEF2F2", borderRadius: 8, alignItems: "center" }} onPress={() => toggleStatus(person)}>
              <Text style={{ color: person.isActive === false ? "#374151" : "#B91C1C", fontWeight: "700" }}>
                {person.isActive === false ? "Re-activate Account" : "Deactivate Account"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )}
  </ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", padding: 24, paddingBottom: 60 },
  link: { color: "#047857", fontWeight: "700", marginBottom: 14 },
  title: { fontSize: 27, fontWeight: "800", color: "#10251B", marginBottom: 8 },
  description: { color: "#53645B", lineHeight: 21, marginBottom: 18 },
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#D7E6DC", borderRadius: 14, padding: 20, marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: "700", color: "#10251B", marginBottom: 14 },
  roles: { flexDirection: "row", gap: 10, marginBottom: 12 },
  role: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 9, borderWidth: 1, borderColor: "#C7D8CE" },
  roleSelected: { backgroundColor: AppTheme.colors.primary, borderColor: "#047857" },
  roleText: { color: "#244536", fontWeight: "700" },
  roleTextSelected: { color: "white" },
  label: { color: "#244536", fontWeight: "700", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#C7D8CE", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  button: { marginTop: 18, backgroundColor: AppTheme.colors.primary, borderRadius: 9, padding: 14 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "700" },
  error: { color: "#B91C1C", marginTop: 12 },
  success: { color: "#047857", marginTop: 12 },
  staffRow: { backgroundColor: "white", borderWidth: 1, borderColor: "#D7E6DC", borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  staffHeader: { padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  staffName: { color: "#10251B", fontWeight: "700", textTransform: "capitalize" },
  staffDetail: { color: "#53645B", marginTop: 4 },
  propRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E8F1EC", marginBottom: 8 },
});
