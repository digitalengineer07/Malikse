import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { Action, Field, WorkflowScreen, ui } from "./WorkflowUI";

const categories = {
  account: "Account access", verification: "Identity verification", listing: "Property listing",
  conversation: "Property conversation", assignment: "Staff assignment", other: "Other",
};
const statuses = { open: "Open", awaiting_reply: "Awaiting your reply", resolved: "Resolved" };
type Category = keyof typeof categories;
type Status = keyof typeof statuses;
type Filter = Status | "all";
type TicketSummary = { _id: string; subject: string; category: Category; status: Status; updatedAt: string };
type Ticket = TicketSummary & {
  requester?: { name: string; role: string };
  referenceKind?: "property" | "conversation";
  referenceId?: string;
  messages: { side: "support" | "requester"; body: string; sentAt: string; requestId: string }[];
};
const statusLabel = (status: Status, admin: boolean) => admin && status === "awaiting_reply" ? "Awaiting requester" : statuses[status];
const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Support could not load. Please try again.";

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={[styles.choice, selected && styles.activeChoice]}><Text style={styles.label}>{label}</Text></Pressable>;
}

export default function SupportScreen() {
  const { user, authState, hydrated } = useAuthStore();
  if (!hydrated) return <ActivityIndicator />;
  if (!user || authState !== "AUTHENTICATED") return <Redirect href="/login" />;
  return <SupportInbox key={`${user.id}:${user.role}`} admin={user.role === "admin"} />;
}

function SupportInbox({ admin }: { admin: boolean }) {
  const router = useRouter();
  const { ticketId, referenceKind, referenceId } = useLocalSearchParams<{ ticketId?: string; referenceKind?: string; referenceId?: string }>();
  const linked = (referenceKind === "property" || referenceKind === "conversation") && typeof referenceId === "string";
  const [creating, setCreating] = useState(Boolean(linked));
  const [category, setCategory] = useState<Category>(referenceKind === "conversation" ? "conversation" : referenceKind === "property" ? "listing" : "account");
  const [filter, setFilter] = useState<Filter>(admin ? "open" : "all");
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [ticket, setTicket] = useState<Ticket>();
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const activeMutation = useRef(false);
  const requestKey = useRef<{ payload: string; id: string } | undefined>(undefined);
  const listRequest = useRef(0);
  const openTicket = (id: string) => router.push({ pathname: "/support", params: { ticketId: id } });

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const request = ++listRequest.current;
    if (creating && !ticketId) { setLoading(false); return; }
    setError("");
    setLoading(true);
    const promise = ticketId
      ? api.get<Ticket>(`/support/${ticketId}`, { signal: controller.signal }).then(response => {
          if (!controller.signal.aborted) setTicket(response.data);
        })
      : api.get<TicketSummary[]>("/support", { signal: controller.signal, params: { limit: 20, status: filter === "all" ? undefined : filter } }).then(response => {
          if (!controller.signal.aborted) {
            setTickets(response.data);
            setCursor(response.headers["x-next-cursor"] || undefined);
          }
        });
    void promise.catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted && listRequest.current === request) setLoading(false); });
    return () => { controller.abort(); listRequest.current++; };
  }, [creating, filter, revision, ticketId]));

  async function run(operation: () => Promise<void>) {
    if (activeMutation.current) return;
    activeMutation.current = true;
    setBusy(true);
    setError("");
    try { await operation(); } catch (error) { setError(errorMessage(error)); }
    finally { activeMutation.current = false; setBusy(false); }
  }

  function submit() {
    void run(async () => {
      const payload = ticketId ? { body: body.trim() } : {
        subject: subject.trim(), category, body: body.trim(),
        ...(linked ? { referenceKind, referenceId } : {}),
      };
      const serialized = JSON.stringify(payload);
      if (requestKey.current?.payload !== serialized) requestKey.current = { payload: serialized, id: randomUUID() };
      const response = await api.post(ticketId ? `/support/${ticketId}/replies` : "/support", { ...payload, requestId: requestKey.current.id });
      requestKey.current = undefined;
      setBody("");
      if (ticketId) setRevision(value => value + 1);
      else router.replace({ pathname: "/support", params: { ticketId: response.data._id } });
    });
  }

  const currentTicket = ticket?._id === ticketId ? ticket : undefined;
  return (
    <WorkflowScreen title={ticketId ? "Support request" : admin ? "Support inbox" : "Contact support"}>
      {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      {loading && <ActivityIndicator color="#14263E" />}
      {ticketId ? currentTicket ? <>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={ui.heading}>{currentTicket.subject}</Text>
          <Text style={ui.muted}>{categories[currentTicket.category]} · {statusLabel(currentTicket.status, admin)}</Text>
          {currentTicket.requester && <Text style={ui.text}>{currentTicket.requester.name} · {currentTicket.requester.role}</Text>}
          {currentTicket.referenceId && <Text selectable style={ui.muted}>Linked {currentTicket.referenceKind} · {currentTicket.referenceId}</Text>}
          {admin && currentTicket.referenceKind === "property" && currentTicket.referenceId && (
            <Action title="Open linked property" secondary onPress={() => router.push({
              pathname: "/verification/[id]", params: { id: currentTicket.referenceId! },
            })} />
          )}
        </View>
        {currentTicket.messages.map(message => (
          <View key={message.requestId} style={[styles.card, message.side === "support" && styles.supportReply]}>
            <Text style={styles.label}>{message.side === "support" ? "MalikSe support" : admin ? "Requester" : "You"}</Text>
            <Text selectable style={ui.text}>{message.body}</Text>
            <Text style={ui.muted}>{new Date(message.sentAt).toLocaleString()}</Text>
          </View>
        ))}
        {currentTicket.status !== "resolved" && <View style={styles.card}>
          <Field label="Your reply" value={body} onChangeText={setBody} multiline maxLength={2000} editable={!busy} />
          <Action title="Send reply" disabled={busy || loading || !body.trim()} onPress={submit} />
          <Action title="Mark as resolved" secondary disabled={busy || loading} onPress={() => void run(async () => {
            await api.post(`/support/${ticketId}/resolve`);
            setRevision(value => value + 1);
          })} />
        </View>}
        <Action title="Refresh request" secondary disabled={loading || busy} onPress={() => setRevision(value => value + 1)} />
      </> : !loading && <Action title="Retry" secondary onPress={() => setRevision(value => value + 1)} /> : creating && !admin ? (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={ui.heading}>New support request</Text>
          <Text style={ui.label}>What do you need help with?</Text>
          <View style={ui.row}>{(Object.keys(categories) as Category[]).map(value =>
            <Choice key={value} label={categories[value]} selected={category === value} onPress={() => { if (!busy) setCategory(value); }} />)}</View>
          {linked && <Text style={ui.muted}>This {referenceKind} will be linked to the request.</Text>}
          <Field label="Subject" value={subject} onChangeText={setSubject} editable={!busy} maxLength={100} />
          <Field label="Message" value={body} onChangeText={setBody} editable={!busy} multiline maxLength={2000} />
          <Action title={busy ? "Sending…" : "Send request"} disabled={busy || !subject.trim() || !body.trim()} onPress={submit} />
          <Action title="Cancel" secondary disabled={busy} onPress={() => linked && router.canGoBack() ? router.back() : setCreating(false)} />
        </View>
      ) : <>
        <View style={ui.row}>
          {!admin && <Action title="New support request" onPress={() => setCreating(true)} />}
          <Action title="Refresh" secondary disabled={loading || busy} onPress={() => setRevision(value => value + 1)} />
        </View>
        <View style={ui.row}>{(["all", "open", "awaiting_reply", "resolved"] as const).map(value =>
          <Choice key={value} label={value === "all" ? "All requests" : statusLabel(value, admin)}
            selected={filter === value} onPress={() => { if (filter !== value) { setTickets([]); setCursor(undefined); setFilter(value); } }} />)}</View>
        {!loading && !error && tickets.length === 0 && <Text style={ui.muted}>No support requests in this view.</Text>}
        {tickets.map(row => <Pressable key={row._id} accessibilityRole="button" style={styles.card} onPress={() => openTicket(row._id)}>
          <Text style={ui.heading}>{row.subject}</Text>
          <Text style={ui.muted}>{categories[row.category]} · {statusLabel(row.status, admin)}</Text>
        </Pressable>)}
        {!!cursor && <Action title="Load more requests" secondary disabled={busy || loading} onPress={() => void run(async () => {
          const request = listRequest.current;
          const response = await api.get<TicketSummary[]>("/support", { params: { limit: 20, cursor, status: filter === "all" ? undefined : filter } });
          if (request !== listRequest.current) return;
          setTickets(previous => {
            const seen = new Set(previous.map(row => row._id));
            return [...previous, ...response.data.filter(row => !seen.has(row._id))];
          });
          setCursor(response.headers["x-next-cursor"] || undefined);
        })} />}
      </>}
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DEDCD5", padding: 16, gap: 10 },
  supportReply: { backgroundColor: "#FFFAE8" },
  choice: { minHeight: 44, justifyContent: "center", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 7 },
  activeChoice: { backgroundColor: "#FFF1C0" },
  label: { color: "#14263E", fontFamily: "ManropeBold", fontSize: 13 },
});
