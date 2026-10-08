import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
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

  useEffect(() => {
    if (authState !== "AUTHENTICATED" || user?.role !== "admin") return;
    setLoading(true);
    adminService.listStaff().then(setStaff).catch((cause) => {
      setError(cause.response?.data?.message || "Could not load staff accounts");
    }).finally(() => setLoading(false));
  }, [authState, user?.role]);

  const create = async () => {
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

  if (authState !== "AUTHENTICATED" || user?.role !== "admin") {
    return <View style={styles.screen}><Text style={styles.title}>Admin sign in required</Text><TouchableOpacity onPress={() => router.replace("/login")}><Text style={styles.link}>Go to sign in</Text></TouchableOpacity></View>;
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>← Admin dashboard</Text></TouchableOpacity>
    <Text style={styles.title}>Manage Advisors and Verifiers</Text>
    <Text style={styles.description}>Create a staff account, then give the person their mobile number and password through your own secure channel.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>Create staff account</Text>
      <View style={styles.roles}>
        {(["advisor", "verifier"] as StaffRole[]).map((value) => <TouchableOpacity key={value} style={[styles.role, role === value && styles.roleSelected]} onPress={() => setRole(value)}><Text style={[styles.roleText, role === value && styles.roleTextSelected]}>{value === "advisor" ? "Advisor" : "Verifier"}</Text></TouchableOpacity>)}
      </View>
      <Text style={styles.label}>Full name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Staff member's name" />
      <Text style={styles.label}>Mobile number</Text>
      <TextInput style={styles.input} value={mobile} onChangeText={setMobile} placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} />
      <Text style={styles.label}>Email (optional)</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.label}>Temporary password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={create} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Creating…" : `Create ${role === "advisor" ? "Advisor" : "Verifier"}`}</Text>
      </TouchableOpacity>
    </View>
    <Text style={styles.heading}>Staff accounts</Text>
    {loading ? <ActivityIndicator color="#047857" /> : staff.length === 0 ? <Text style={styles.description}>No Advisors or Verifiers yet.</Text> : staff.map((person) =>
      <View style={styles.staffRow} key={person.id}>
        <Text style={styles.staffName}>{person.name} · {person.role}</Text>
        <Text style={styles.staffDetail}>{person.mobile}{person.email ? ` · ${person.email}` : ""}</Text>
      </View>
    )}
  </ScrollView>;
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
  roleSelected: { backgroundColor: "#047857", borderColor: "#047857" },
  roleText: { color: "#244536", fontWeight: "700" },
  roleTextSelected: { color: "white" },
  label: { color: "#244536", fontWeight: "700", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#C7D8CE", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  button: { marginTop: 18, backgroundColor: "#047857", borderRadius: 9, padding: 14 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "700" },
  error: { color: "#B91C1C", marginTop: 12 },
  success: { color: "#047857", marginTop: 12 },
  staffRow: { backgroundColor: "white", borderWidth: 1, borderColor: "#D7E6DC", borderRadius: 10, padding: 14, marginBottom: 8 },
  staffName: { color: "#10251B", fontWeight: "700", textTransform: "capitalize" },
  staffDetail: { color: "#53645B", marginTop: 4 },
});
