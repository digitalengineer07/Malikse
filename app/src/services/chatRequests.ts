import type { AxiosResponse } from "axios";
import api from "./authService";
import { useAuthStore } from "../store/authStore";

export const chatBusyMessage = "Messages are temporarily busy. Updates will resume automatically.";

let session: string | undefined;
const cooldowns = new Map<string, { retryAt: number; failures: number }>();
const pending = new Map<string, Promise<AxiosResponse>>();
const snapshots = new Map<string, AxiosResponse>();
export function chatPollDelay(path: string, base: number) {
  const cooldown = cooldowns.get(path.split("?")[0]);
  const interval = Math.min(120_000, base * 2 ** (cooldown?.failures ?? 0));
  return Math.max(interval, (cooldown?.retryAt ?? 0) - Date.now()) + Math.random() * 4000;
}
export class ChatReadBusy extends Error {
  constructor(readonly failures: number) { super(chatBusyMessage); }
}

export function readChat(path: string): Promise<AxiosResponse> {
  const userId = useAuthStore.getState().user?.id;
  if (session !== userId) {
    session = userId;
    cooldowns.clear();
    pending.clear();
    snapshots.clear();
  }
  const existing = pending.get(path);
  if (existing) return existing;
  const resource = path.split("?")[0];
  const cooldown = cooldowns.get(resource);
  if (cooldown && Date.now() < cooldown.retryAt) return Promise.reject(new ChatReadBusy(cooldown.failures));
  const snapshot = snapshots.get(path);
  const request = api.get(path, {
    headers: snapshot ? {"If-None-Match": snapshot.headers.etag} : undefined,
    validateStatus: code => (code >= 200 && code < 300) || (code === 304 && !!snapshot),
  }).catch(error => {
    const status = error.response?.status;
    if (status !== 429 && status !== 503) throw error;
    if (pending.get(path) === request) {
      const raw = error.response.headers?.["retry-after"];
      const delay = /^\d+$/.test(String(raw)) ? Number(raw) * 1000 : Date.parse(String(raw)) - Date.now();
      const previous = cooldowns.get(resource);
      const failures = Math.min((previous?.failures ?? 0) + 1, 3);
      cooldowns.set(resource, {
        failures,
        retryAt: Math.max(previous?.retryAt ?? 0, Date.now() + Math.max(
          1_000, Number.isFinite(delay) ? delay : (status === 503 ? 1_000 : 7_500) * 2 ** failures,
        )),
      });
    }
    throw new ChatReadBusy(cooldowns.get(resource)?.failures ?? 1);
  }).then(response => {
    if (pending.get(path) === request && (!cooldowns.get(resource) || cooldowns.get(resource) === cooldown)) {
      cooldowns.delete(resource);
    }
    if (response.status === 304 && snapshot) return snapshot;
    if (pending.get(path) === request && response.headers.etag && !path.includes("before=")) {
      snapshots.delete(path);
      if (snapshots.size >= 16) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(path,response);
    }
    return response;
  }).finally(() => {
    if (pending.get(path) === request) pending.delete(path);
  });
  pending.set(path, request);
  return request;
}
