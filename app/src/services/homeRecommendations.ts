import api from "./authService";
import { useAuthStore } from "../store/authStore";

type Feed = { data: unknown[]; headers: Record<string, string> };
const feeds = new Map<string, { response: Feed; savedAt: number }>();
const pending = new Map<string, Promise<Feed>>();
let queue: Promise<unknown> = Promise.resolve();
let retryAt = 0;

export const homeFeedBusyMessage = "Property listings are busy right now. Please try again shortly.";
class HomeFeedBusy extends Error {
  constructor() { super(homeFeedBusyMessage); }
}

export function loadHomeRecommendations(path: string, scope: string): Promise<Feed> {
  const key = JSON.stringify([scope, path]);
  const existing = pending.get(key);
  if (existing) return existing;

  const request = queue.then(async () => {
    const cached = feeds.get(key);
    const age = cached ? Date.now() - cached.savedAt : Infinity;
    const fallback = cached && age <= 5 * 60_000 ? cached.response : undefined;
    if (cached && age <= 30_000) return cached.response;
    if (Date.now() < retryAt) {
      if (fallback) return fallback;
      throw new HomeFeedBusy();
    }
    try {
      if (scope !== "public" && (useAuthStore.getState().user?.id || "guest") !== scope) throw new HomeFeedBusy();
      const { data } = await api.get<unknown[]>(path);
      if (!Array.isArray(data)) throw new Error("Property listings are temporarily unavailable.");
      const response = { data, headers: {} };
      if (feeds.size >= 24) feeds.delete(feeds.keys().next().value!);
      feeds.set(key, { response, savedAt: Date.now() });
      return response;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 429 || status === 503) {
        const retryAfter = error.response.headers?.["retry-after"];
        const delay = retryAfter == null ? NaN : /^\d+$/.test(String(retryAfter))
          ? Number(retryAfter) * 1000 : Date.parse(String(retryAfter)) - Date.now();
        retryAt = Date.now() + (Number.isFinite(delay) ? Math.min(3000, Math.max(1000, delay)) : 3_000);
        if (fallback) return fallback;
        throw new HomeFeedBusy();
      }
      if (fallback && (!status || status >= 500)) return fallback;
      throw error;
    }
  }).finally(() => pending.delete(key));
  queue = request.catch(() => {});
  pending.set(key, request);
  return request;
}
