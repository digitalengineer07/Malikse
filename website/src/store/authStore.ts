import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import type { AuthTokens, UserProfile, UserRole } from "../types/auth.types";

const sessionKey = "malikse_session";
type AuthState = "NOT_AUTHENTICATED" | "AUTHENTICATED" | "LOADING";

interface AuthStore {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  authState: AuthState;
  hydrated: boolean;
  role: UserRole | null;
  hydrateSession: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  setTokens: (tokens: AuthTokens) => void;
  setAuthState: (state: AuthState) => void;
  clearSession: () => void;
}

function readWebSession(): Partial<AuthStore> | null {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return null;
  try {
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      const session = JSON.parse(saved);
      if (session?.accessToken?.startsWith("dummy_") || session?.user?.id === "demo_id") {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem("malikse_access");
        localStorage.removeItem("malikse_refresh");
        localStorage.removeItem("malikse_user");
        return null;
      }
      return session;
    }
    const accessToken = JSON.parse(localStorage.getItem("malikse_access") || "null");
    const refreshToken = JSON.parse(localStorage.getItem("malikse_refresh") || "null");
    const user = JSON.parse(localStorage.getItem("malikse_user") || "null");
    return accessToken && !accessToken.startsWith("dummy_") && user && user.id !== "demo_id" ? { accessToken, refreshToken, user } : null;
  } catch { return null; }
}

const savedWebSession = readWebSession();
let nativeWrite = Promise.resolve();
function saveSession(state: AuthStore) {
  const value = JSON.stringify({
    user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken,
  });
  if (Platform.OS === "web") {
    try {
      if (state.user && state.accessToken) localStorage.setItem(sessionKey, value);
      else localStorage.removeItem(sessionKey);
      localStorage.removeItem("malikse_access");
      localStorage.removeItem("malikse_refresh");
      localStorage.removeItem("malikse_user");
    } catch { /* Storage can be unavailable in private browsing. */ }
  } else {
    nativeWrite = nativeWrite.catch(() => {}).then(() => state.user && state.accessToken
      ? SecureStore.setItemAsync(sessionKey, value)
      : SecureStore.deleteItemAsync(sessionKey));
  }
}

let hydratePromise: Promise<void> | null = null;
export const useAuthStore = create<AuthStore>((set, get) => ({
  user: savedWebSession?.user ?? null,
  accessToken: savedWebSession?.accessToken ?? null,
  refreshToken: savedWebSession?.refreshToken ?? null,
  authState: Platform.OS === "web"
    ? savedWebSession?.user && savedWebSession?.accessToken ? "AUTHENTICATED" : "NOT_AUTHENTICATED"
    : "LOADING",
  hydrated: Platform.OS === "web",
  role: savedWebSession?.user?.role ?? null,

  hydrateSession: () => {
    if (get().hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        await nativeWrite;
        const saved = await SecureStore.getItemAsync(sessionKey);
        let session = saved ? JSON.parse(saved) : null;
        if (session?.accessToken?.startsWith("dummy_") || session?.user?.id === "demo_id") {
          await SecureStore.deleteItemAsync(sessionKey);
          session = null;
        }
        set({
          user: session?.user ?? null,
          accessToken: session?.accessToken ?? null,
          refreshToken: session?.refreshToken ?? null,
          role: session?.user?.role ?? null,
          authState: session?.accessToken && session?.user ? "AUTHENTICATED" : "NOT_AUTHENTICATED",
          hydrated: true,
        });
      } catch {
        set({ user: null, accessToken: null, refreshToken: null, role: null, authState: "NOT_AUTHENTICATED", hydrated: true });
      }
    })();
    return hydratePromise;
  },
  setUser: (user) => {
    set({ user, role: user?.role ?? null });
    saveSession(get());
  },
  setTokens: ({ accessToken, refreshToken }) => {
    set({ accessToken, refreshToken });
    saveSession(get());
  },
  setAuthState: (authState) => set({ authState }),
  clearSession: () => {
    set({ user: null, accessToken: null, refreshToken: null, authState: "NOT_AUTHENTICATED", role: null, hydrated: true });
    saveSession(get());
  },
}));
