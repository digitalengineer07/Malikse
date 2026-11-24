import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLockup } from "../../../components/BrandLockup";
import { AccountHeaderBackdrop, accountHeaderStyle } from "../../../components/AccountHeaderBackdrop";
import { Action, Field, ui, WorkflowScreen } from "../../../components/WorkflowUI";
import { adminService, type StaffAccount } from "../../../src/services/adminService";
import { statusLabels } from "../../../src/services/workflowService";
import { useAuthStore } from "../../../src/store/authStore";

type Workload = Awaited<ReturnType<typeof adminService.getStaffWorkload>>;
const errorText = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;

export default function StaffDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(state => state.user);
  const authState = useAuthStore(state => state.authState);
  const [person, setPerson] = useState<StaffAccount>();
  const [workload, setWorkload] = useState<Workload>();
  const [districts, setDistricts] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const active = useRef<AbortController | null>(null);

  useFocusEffect(useCallback(() => {
    if (!id || authState !== "AUTHENTICATED" || user?.role !== "admin") return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setBusy(false);
    setError("");
    setConfirmStatus(false);
    void adminService.getStaff(id, controller.signal).then(row => {
      if (!controller.signal.aborted) {
        setPerson(row);
        setDistricts((row.assignedDistricts ?? []).join(", "));
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(errorText(cause, "Could not load this staff account."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    setWorkload(undefined);
    void adminService.getStaffWorkload(id, { limit: 10 }, controller.signal).then(rows => {
      if (!controller.signal.aborted) setWorkload(rows);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(errorText(cause, "Could not load assignments and history."));
    });
    return () => { controller.abort(); };
  }, [authState, id, revision, user?.id, user?.role]));

  const current = person?.id === id ? person : undefined;
  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    const signal = active.current?.signal;
    if (!signal || signal.aborted || busy || !current) return;
    setBusy(true); setError(""); setNotice("");
    try { await operation(signal); }
    catch (cause) { if (!signal.aborted) setError(errorText(cause, "Could not update this account.")); }
    finally { if (!signal.aborted) setBusy(false); }
  }

  if (authState !== "AUTHENTICATED" || user?.role !== "admin") {
    return <WorkflowScreen title="Staff account"><Text style={ui.muted}>Admin sign-in required.</Text></WorkflowScreen>;
  }

  const header = <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
    {focused && <StatusBar style="light" />}
    <AccountHeaderBackdrop top={insets.top + 4} />
    <View style={styles.headerInner}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to staff directory" style={styles.back}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/admin/staff")}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <BrandLockup style={{ flex: 1 }} />
      </View>
      <View style={accountHeaderStyle.titleGroup}>
        <Text accessibilityRole="header" style={[styles.headerTitle, accountHeaderStyle.heading]}>Staff account</Text>
      </View>
    </View>
  </View>;
  return <WorkflowScreen title="Staff account" header={header}>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={ui.text}>{notice}</Text>}
    {loading && <ActivityIndicator color="#14263E" />}
    {!loading && !current && <Action title="Retry" secondary onPress={() => setRevision(value => value + 1)} />}
    {current && <>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={ui.heading}>{current.name}</Text>
        <Text style={styles.badge}>{current.role === "advisor" ? "Advisor" : "Verifier"} · {current.isActive === false ? "Inactive" : "Active"}</Text>
        <Detail label="Staff ID" value={current.id} />
        {current.advisorCode && <Detail label="Advisor code" value={current.advisorCode} />}
        <Detail label="Mobile number" value={current.mobile} />
        <Detail label="Email" value={current.email} />
        <Detail label="Created" value={current.createdAt ? new Date(current.createdAt).toLocaleDateString() : undefined} />
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={ui.heading}>Assigned districts</Text>
        <Field label="Districts" hint="Separate district names with commas." value={districts} onChangeText={setDistricts} editable={!busy && !loading} />
        <Action title="Save districts" disabled={busy || loading} onPress={() => void run(async signal => {
          const values = [...new Set(districts.split(",").map(value => value.trim()).filter(Boolean))];
          const updated = await adminService.updateStaffDistricts(id, values);
          if (signal.aborted) return;
          setPerson({ ...current, assignedDistricts: updated.assignedDistricts });
          setDistricts(updated.assignedDistricts.join(", "));
          setNotice("Districts saved.");
        })} />
      </View>
      {(["assigned", "history"] as const).map(kind => {
        const cursor = kind === "assigned" ? workload?.nextAssigned : workload?.nextHistory;
        return <View key={kind} style={styles.card}>
          <Text accessibilityRole="header" style={ui.heading}>{kind === "assigned" ? "Current assignments" : "Review history"}</Text>
          {workload && workload[kind].length === 0 && <Text style={ui.muted}>{kind === "assigned" ? "No current assignments." : "No reviews recorded."}</Text>}
          {!workload && !error && <ActivityIndicator color="#14263E" />}
          {workload?.[kind].map(property => <Action key={property._id} secondary
            title={`${property.title || "Property"} · ${statusLabels[property.status] || property.status}`}
            onPress={() => router.push({ pathname: "/verification/[id]", params: { id: property._id } })} />)}
          {cursor && <Action title="Load more" secondary disabled={busy || loading} onPress={() => void run(async signal => {
            const page = await adminService.getStaffWorkload(id, { limit: 10, [kind === "assigned" ? "assignedCursor" : "historyCursor"]: cursor }, signal);
            if (signal.aborted) return;
            setWorkload(previous => {
              if (!previous) return previous;
              const seen = new Set(previous[kind].map(row => row._id));
              return { ...previous, [kind]: [...previous[kind], ...page[kind].filter(row => !seen.has(row._id))],
                ...(kind === "assigned" ? { nextAssigned: page.nextAssigned } : { nextHistory: page.nextHistory }) };
            });
          })} />}
        </View>;
      })}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={ui.heading}>Account access</Text>
        {confirmStatus ? <>
          <Text style={ui.text}>{current.isActive === false ? "Allow this staff member to sign in again?" : "Block this staff member from signing in?"}</Text>
          <Action title="Confirm" disabled={busy} onPress={() => void run(async signal => {
            const updated = await adminService.toggleStaffStatus(id, current.isActive === false);
            if (signal.aborted) return;
            setPerson({ ...current, isActive: updated.isActive });
            setNotice(updated.isActive ? "Account activated." : "Account deactivated.");
            setConfirmStatus(false);
          })} />
          <Action title="Cancel" secondary disabled={busy} onPress={() => setConfirmStatus(false)} />
        </> : <Action title={current.isActive === false ? "Activate account" : "Deactivate account"} secondary
          disabled={busy || loading} onPress={() => setConfirmStatus(true)} />}
      </View>
    </>}
  </WorkflowScreen>;
}

function Detail({ label, value }: { label: string; value?: string }) {
  return <View style={styles.detail}><Text style={ui.label}>{label}</Text><Text selectable style={ui.text}>{value || "Not recorded"}</Text></View>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#14263E", borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
  headerInner: { width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#244268", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontFamily: "Fraunces" },
  card: { padding: 16, gap: 10, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DEDCD5" },
  detail: { paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DEDCD5" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: "#FFF1C0", color: "#14263E", fontFamily: "ManropeBold" },
});
