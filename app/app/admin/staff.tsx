import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLockup } from "../../components/BrandLockup";
import { AccountHeaderBackdrop, accountHeaderStyle } from "../../components/AccountHeaderBackdrop";
import { WorkflowScreen } from "../../components/WorkflowUI";
import { statusLabels } from "../../src/services/workflowService";
import TextInput from "../../components/FormInput";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useFocusEffect, useIsFocused } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { adminService, type StaffAccount, type StaffRole } from "../../src/services/adminService";
import { useAuthStore } from "../../src/store/authStore";

export default function ManageStaffScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"directory" | "create">("directory");
  const workloadRequest = React.useRef(0);
  const { user, authState } = useAuthStore();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [role, setRole] = useState<StaffRole>("advisor");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  
  const [selectedStaff, setSelectedStaff] = useState<StaffAccount | null>(null);
  const [workload, setWorkload] = useState<any>({ assigned: [], history: [] });
  const [loadingWorkload, setLoadingWorkload] = useState(false);

  const loadMore = async () => {
    if (!nextCursor || moreBusy) return;
    setMoreBusy(true);
    try { const rows = await adminService.listStaff(nextCursor); setStaff(old => [...old, ...rows]); setNextCursor((rows as any).nextCursor); }
    catch { setError("Could not load the next page"); } finally { setMoreBusy(false); }
  };
  useFocusEffect(React.useCallback(() => {
    if (authState !== "AUTHENTICATED" || user?.role !== "admin" || !user.id) return;
    let active = true;
    setLoading(true);
    adminService.listStaff().then(rows => {
      if (active) { setStaff(rows); setNextCursor((rows as any).nextCursor); }
    }).catch((cause) => {
      if (active) setError(cause.response?.data?.message || "Could not load staff accounts");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; workloadRequest.current++; setSelectedStaff(null); };
  }, [authState, user?.id, user?.role]));

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
      setStaff(current => [person, ...current.filter(row => row.id !== person.id)]);
      setName("");
      setMobile("");
      setEmail("");
      setPassword("");
      setMessage(`${person.name}’s account was created.`);
      setView("directory");
    } catch (cause: any) {
      setError(cause.response?.data?.message || "Could not create staff account. Check that the API is reachable.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (staffMember: StaffAccount) => {
    try {
      const updated = await adminService.toggleStaffStatus(staffMember.id, !staffMember.isActive);
      setStaff(current => current.map(s => s.id === staffMember.id ? { ...s, isActive: updated.isActive } : s));
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to toggle status");
    }
  };

  const moreWorkload = async (kind: "assigned" | "history") => {
    if (!selectedStaff || loadingWorkload) return;
    const request = workloadRequest.current;
    setLoadingWorkload(true);
    const next = kind === "assigned" ? "nextAssigned" : "nextHistory";
    try { const data = await adminService.getStaffWorkload(selectedStaff.id, { [kind + "Cursor"]: workload[next] });
      if (request !== workloadRequest.current) return;
      setWorkload((old: any) => ({ ...old, [kind]: [...old[kind], ...data[kind]], [next]: data[next] }));
    } catch { if (request === workloadRequest.current) setError("Could not load staff workload"); } finally { if (request === workloadRequest.current) setLoadingWorkload(false); }
  };
  const viewWorkload = async (staffMember: StaffAccount) => {
    const request = ++workloadRequest.current;
    if (selectedStaff?.id === staffMember.id) {
      setSelectedStaff(null);
      return;
    }
    setError("");
    setSelectedStaff(staffMember);
    setLoadingWorkload(true);
    try {
      const data = await adminService.getStaffWorkload(staffMember.id);
      if (request === workloadRequest.current) setWorkload(data);
    } catch {
      if (request === workloadRequest.current) {
        setError("Could not load staff workload.");
        setWorkload({ assigned: [], history: [] });
      }
    } finally {
      if (request === workloadRequest.current) setLoadingWorkload(false);
    }
  };

  if (authState !== "AUTHENTICATED" || user?.role !== "admin") {
    return <View style={styles.screen}><Text style={styles.title}>Admin sign in required</Text><TouchableOpacity onPress={() => router.replace("/login")}><Text style={styles.link}>Go to sign in</Text></TouchableOpacity></View>;
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      {focused && <StatusBar style="light" />}
      <AccountHeaderBackdrop top={insets.top + 4} />
      <View style={styles.headerInner}>
        <View style={styles.toolbar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Admin dashboard" style={styles.back}
            onPress={() => router.dismissTo("/admin/dashboard")}>
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <BrandLockup style={{ flex: 1 }} />
        </View>
        <View style={accountHeaderStyle.titleGroup}>
          <Text accessibilityRole="header" style={[styles.headerTitle, accountHeaderStyle.heading]}>Staff accounts</Text>
          <Text style={styles.headerHint}>Manage advisors and verifiers.</Text>
        </View>
      </View>
    </View>
  );
  return <WorkflowScreen title="Staff accounts" header={header} contentStyle={styles.content}>
    <View style={styles.roles}>
      {(["directory", "create"] as const).map(value => (
        <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: view === value }}
          disabled={saving} style={[styles.role, view === value && styles.roleSelected]}
          onPress={() => { setError(""); setView(value); }}>
          <MaterialIcons name={value === "directory" ? "groups" : "person-add"} size={19} color="#14263E" />
          <Text style={styles.roleText}>{value === "directory" ? "Directory" : "Add staff"}</Text>
        </TouchableOpacity>
      ))}
    </View>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text>}
    {view === "create" ? (
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
      <Text style={styles.description}>Share the temporary password securely.</Text>
      <TouchableOpacity style={styles.button} onPress={create} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Creating…" : `Create ${role === "advisor" ? "Advisor" : "Verifier"}`}</Text>
      </TouchableOpacity>
    </View>
    ) : <>
    <Text accessibilityRole="header" style={styles.heading}>Staff directory</Text>
    {loading && !staff.length ? <ActivityIndicator color="#244268" /> : staff.length === 0 ? <Text style={styles.description}>No Advisors or Verifiers yet.</Text> : staff.map((person) =>
      <View style={styles.staffRow} key={person.id}>
        <TouchableOpacity style={styles.staffHeader} accessibilityRole="button" accessibilityState={{ expanded: selectedStaff?.id === person.id }} onPress={() => viewWorkload(person)}>
          <View style={styles.staffIcon}><MaterialIcons name={person.role === "advisor" ? "badge" : "verified-user"} size={20} color="#14263E" /></View>
          <View style={styles.staffCopy}>
            <Text style={styles.staffName}>{person.name}</Text>
            <Text style={styles.staffDetail}>{person.role === "advisor" ? "Advisor" : "Verifier"} · {person.isActive === false ? "Inactive" : "Active"}</Text>
            <Text style={styles.staffDetail}>{person.mobile}{person.email ? ` · ${person.email}` : ""}</Text>
          </View>
          <MaterialIcons name={selectedStaff?.id === person.id ? "expand-less" : "expand-more"} size={24} color="#536174" />
        </TouchableOpacity>
        
        {selectedStaff?.id === person.id && (
          <View style={{ padding: 18, backgroundColor: "#FFFCF4", borderTopWidth: 1, borderTopColor: "#DEDCD5" }}>
            {workload.nextAssigned && <TouchableOpacity disabled={loadingWorkload} onPress={() => moreWorkload("assigned")}><Text style={styles.link}>More assignments</Text></TouchableOpacity>}
            {workload.nextHistory && <TouchableOpacity disabled={loadingWorkload} onPress={() => moreWorkload("history")}><Text style={styles.link}>More review history</Text></TouchableOpacity>}
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#14263E", marginBottom: 12 }}>Currently Assigned</Text>
            {loadingWorkload ? <ActivityIndicator color="#244268" /> : workload.assigned.length === 0 ? <Text style={styles.description}>No properties currently assigned.</Text> : workload.assigned.map((prop: any) => (
              <TouchableOpacity key={`a_${prop._id}`} style={styles.propRow} onPress={() => router.push({ pathname: "/verification/[id]", params: { id: prop._id } })}>
                <View><Text style={{ color: "#14263E", fontWeight: "600" }}>{prop.title}</Text><Text style={{ color: "#536174", fontSize: 12 }}>{statusLabels[prop.status] || prop.status}</Text></View>
                <MaterialIcons name="chevron-right" size={20} color="#536174" />
              </TouchableOpacity>
            ))}

            <Text style={{ fontSize: 14, fontWeight: "700", color: "#14263E", marginTop: 24, marginBottom: 12 }}>Verification History</Text>
            {loadingWorkload ? <ActivityIndicator color="#244268" /> : workload.history.length === 0 ? <Text style={styles.description}>No history yet.</Text> : workload.history.map((prop: any) => (
              <TouchableOpacity key={`h_${prop._id}`} style={styles.propRow} onPress={() => router.push({ pathname: "/verification/[id]", params: { id: prop._id } })}>
                <View><Text style={{ color: "#14263E", fontWeight: "600" }}>{prop.title}</Text><Text style={{ color: "#536174", fontSize: 12 }}>{statusLabels[prop.status] || prop.status}</Text></View>
                <MaterialIcons name="chevron-right" size={20} color="#536174" />
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
    {!!nextCursor && <TouchableOpacity accessibilityRole="button" disabled={moreBusy} onPress={loadMore} style={styles.more}>
      <Text style={styles.link}>{moreBusy ? "Loading…" : "Load more accounts"}</Text>
    </TouchableOpacity>}
    </>}
  </WorkflowScreen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { maxWidth: 850 },
  header: { backgroundColor: "#14263E", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
  headerInner: { width: "100%", maxWidth: 850, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#244268", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontFamily: "Fraunces" },
  headerHint: { color: "#E7EDF5", fontFamily: "Manrope", fontSize: 13, lineHeight: 19 },
  staffIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFF1C0", alignItems: "center", justifyContent: "center" },
  staffCopy: { flex: 1, minWidth: 0 },
  more: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  link: { color: "#244268", fontWeight: "700", marginBottom: 14 },
  title: { fontSize: 27, fontWeight: "800", color: "#14263E", marginBottom: 8 },
  description: { color: "#536174", lineHeight: 21, marginBottom: 18 },
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#DEDCD5", borderRadius: 18, padding: 16 },
  heading: { fontSize: 20, fontFamily: "Fraunces", color: "#14263E", marginBottom: 6 },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  role: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "#DEDCD5", backgroundColor: "#fff" },
  roleSelected: { backgroundColor: "#FFF1C0", borderColor: "#DFC052" },
  roleText: { color: "#14263E", fontWeight: "700" },
  roleTextSelected: { color: "#14263E" },
  label: { color: "#14263E", fontWeight: "700", marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#DEDCD5", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  button: { marginTop: 18, backgroundColor: "#FCC61C", borderRadius: 9, padding: 14 },
  buttonText: { color: "#14263E", textAlign: "center", fontWeight: "700" },
  error: { color: "#B91C1C", marginTop: 12 },
  success: { color: "#244268", marginTop: 12 },
  staffRow: { backgroundColor: "white", borderWidth: 1, borderColor: "#DEDCD5", borderRadius: 17, overflow: "hidden" },
  staffHeader: { padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  staffName: { color: "#14263E", fontWeight: "700", textTransform: "capitalize" },
  staffDetail: { color: "#536174", marginTop: 4 },
  propRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "white", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#DEDCD5", marginBottom: 8 },
});
