import { create } from "zustand";
import type { AuthTokens, UserProfile, UserRole } from "../types/auth.types";
import { useUserListingsStore } from "./userListingsStore";

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
  if (typeof localStorage === "undefined") return null;
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
function saveSession(state: AuthStore) {
  try {
    if (state.user && state.accessToken) localStorage.setItem(sessionKey, JSON.stringify({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken }));
    else localStorage.removeItem(sessionKey);
    ["malikse_access", "malikse_refresh", "malikse_user"].forEach(key => localStorage.removeItem(key));
  } catch { /* Private browsing may disable storage. */ }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: savedWebSession?.user ?? null,
  accessToken: savedWebSession?.accessToken ?? null,
  refreshToken: savedWebSession?.refreshToken ?? null,
  authState: savedWebSession?.user && savedWebSession?.accessToken ? "AUTHENTICATED" : "NOT_AUTHENTICATED",
  hydrated: true,
  role: savedWebSession?.user?.role ?? null,
  hydrateSession: async () => {},
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
    try {
      useUserListingsStore.getState().reset();
    } catch {}
  },
}));
