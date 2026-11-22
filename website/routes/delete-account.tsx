import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { clearUserAffinity } from "../src/services/recommendationEngine";
import PrivacyLayout from "../components/PrivacyLayout";

type Receipt = { reference: string; receipt: string; status: string };
const receiptKey = "malikse_deletion_receipt";
export default function DeleteAccount() {
  const user = useAuthStore(state => state.user);
  const identifier = user?.email || user?.mobile || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const receiptContext = useRef(0);
  useEffect(() => {
    try { sessionStorage.removeItem(receiptKey); } catch {}
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if (next.user?.id === previous.user?.id) return;
      receiptContext.current++;
      setReceipt(null);
      setPassword("");
      setConfirmation("");
      setError("");
    });
    return () => { receiptContext.current++; unsubscribe(); };
  }, []);
  async function request(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    const session = useAuthStore.getState();
    if (!user || session.user?.id !== user.id || !session.accessToken) { setError("Sign in to the account you want to delete."); return; }
    setBusy(true); setError("");
    const context = receiptContext.current;
    try {
      // Independent client: incorrect credentials must not trigger session refresh.
      const { data } = await axios.post<Receipt>(`${api.defaults.baseURL}/account-deletion`, { identifier, password, confirmation }, { timeout: 20_000, headers: { Authorization: "Bearer " + session.accessToken } });
      if (receiptContext.current !== context) return;
      useAuthStore.getState().clearSession();
      setReceipt(data); setPassword(""); setConfirmation("");
      clearUserAffinity();
      for (const key of ["malikse_user_affinity_v1", "malikse-resume-v1"]) { try { localStorage.removeItem(key); } catch {} }
    } catch (e) {
      if (receiptContext.current === context) setError(axios.isAxiosError(e) ? e.response?.data?.message || "Could not confirm the request. Retry safely with the same details." : "Could not request deletion.");
    }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!receipt || busy) return; setBusy(true); setError("");
    const context = receiptContext.current;
    try {
      const { data } = await axios.post<Receipt>(`${api.defaults.baseURL}/account-deletion/status`, receipt, { timeout: 15_000 });
      if (receiptContext.current === context) setReceipt(data);
    } catch {
      if (receiptContext.current === context) setError("Could not check status. Keep your receipt and try again shortly.");
    }
    finally { setBusy(false); }
  }
  return <PrivacyLayout title="Delete your MalikSe account" eyebrow="ACCOUNT & DATA CONTROL">
    <p className="privacy-lead">Sign in to your MalikSe account to request deletion.</p>
    <div className="deletion-columns"><section className="deletion-card"><h2>What happens next</h2><ol><li><strong>Verify ownership.</strong> Confirm your signed-in account with your password.</li><li><strong>Access is disabled.</strong> Your listings leave public discovery when the request is accepted.</li><li><strong>Data is cleaned up.</strong> We remove eligible account data and stored files in the background.</li></ol><p>Accepted or token-paid deals must be completed or cancelled by assigned staff before cleanup. Unaccepted offers are cancelled. Limited deal records remain for other participants with your account link removed.</p><p>Read the <Link to="/privacy-policy#deletion">privacy and retention details</Link>. This action cannot be undone. Staff accounts must be handled by an administrator.</p></section>
    <section className="deletion-card">{receipt ? <div aria-live="polite"><p className="privacy-eyebrow">REQUEST RECEIVED</p><h2>{receipt.status === "completed" ? "Account cleanup complete" : receipt.status === "awaiting_deals" ? "Awaiting deal resolution" : "Deletion in progress"}</h2><p>{receipt.status === "awaiting_deals" ? "Your account is disabled. Assigned staff must close accepted or paid deals before cleanup can finish." : receipt.status === "completed" ? "Eligible data has been removed from the active application. See the privacy policy for retained records and backup limitations." : "Your account is disabled. Cleanup will begin shortly and retry automatically if interrupted."}</p><p>Request reference: <code>{receipt.reference}</code></p><details><summary>Save your private status receipt</summary><p>Keep both values private. This receipt permits status checks for this request.</p><pre className="receipt-json">{JSON.stringify(receipt, null, 2)}</pre></details><button className="privacy-button" disabled={busy} onClick={refresh}>{busy ? "Checking…" : "Check status"}</button></div> : !user ? <Link to="/login">Sign in to delete your account</Link> : <form onSubmit={request}><h2>Confirm your request</h2><p>Signed-in account <strong>{identifier}</strong></p><label htmlFor="deletion-password">Password</label><input id="deletion-password" required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /><Link to="/login">Forgot your password? Go to sign in</Link><label htmlFor="deletion-confirm">Type DELETE to confirm</label><input id="deletion-confirm" required pattern="DELETE" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /><button className="privacy-button privacy-danger" disabled={busy || confirmation !== "DELETE"}>{busy ? "Submitting…" : "Request account deletion"}</button><Link className="privacy-cancel" to="/profile">Keep my account</Link></form>}{error && <p className="privacy-error" role="alert">{error}</p>}</section></div>
  </PrivacyLayout>;
}
