import axios from "axios";
import { useAuthStore } from "../store/authStore";
import type { UserProfile } from "../types/auth.types";
import { invalidatePropertySearch } from "./searchCache";

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;

function resolveApiUrl(): string {
    let cleanUrl = (configuredApiUrl || "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");

    // Upgrade http:// to https:// for production API to prevent browser mixed-content errors
    if (/^http:\/\/malikseserver\.devoxa\.in$/i.test(cleanUrl)) {
      cleanUrl = "https://malikseserver.devoxa.in";
    }

    // If explicitly configured with a non-localhost remote URL (and not accidentally pointed at the website frontend itself)
    if (cleanUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(cleanUrl) && !/^(https?:\/\/)?malikse\.devoxa\.in$/i.test(cleanUrl)) {
      return cleanUrl;
    }

    // If running in browser and NOT on localhost (e.g. deployed on production domain or preview)
    if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "https://malikseserver.devoxa.in";
    }

    // If built for production
    if (import.meta.env.PROD) {
      return "https://malikseserver.devoxa.in";
    }

    // Local development fallback
    return cleanUrl || "http://localhost:5000";
  }

  const API_URL = resolveApiUrl();

  const api = axios.create({ baseURL: API_URL, timeout: 15000, withCredentials: true, headers: { "X-Session-Mode": "cookie" } });

  let isRefreshing = false;
  let failedQueue: any[] = [];

  const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    failedQueue = [];
  };

  api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => {
      if (Array.isArray(response.data)) (response.data as any).nextCursor = response.headers["x-next-cursor"] || undefined;
      if (["post", "patch", "put", "delete"].includes(response.config.method || "") && /^\/(properties|verification|admin)\b/.test(response.config.url || "")) invalidatePropertySearch();
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !["/auth/login", "/auth/register", "/auth/register/verify", "/auth/refresh", "/auth/forgot-password", "/auth/forgot-password/resend", "/auth/reset-password"].includes(originalRequest.url)) {

        originalRequest._retry = true;
        if (isRefreshing) {
          if (failedQueue.length >= 100) return Promise.reject(error);
          return new Promise(function (resolve, reject) {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return api(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = useAuthStore.getState().refreshToken;
        const previousAccess = useAuthStore.getState().accessToken;
        if (!refreshToken) {
          useAuthStore.getState().clearSession();
          isRefreshing = false;
          processQueue(error);
          return Promise.reject(error);
        }

        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { timeout: 10000, withCredentials: true, headers: { "X-Session-Mode": "cookie" } });
          if (useAuthStore.getState().refreshToken !== refreshToken || useAuthStore.getState().accessToken !== previousAccess) throw new Error("Session changed during refresh");

          useAuthStore.getState().setTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken
          });
          if (data.user) useAuthStore.getState().setUser(data.user);

          originalRequest.headers.Authorization = 'Bearer ' + data.accessToken;

          processQueue(null, data.accessToken);
          return api(originalRequest);
        } catch (err) {
          processQueue(err, null);
          if (axios.isAxiosError(err) && [401, 403].includes(err.response?.status || 0) && useAuthStore.getState().refreshToken === refreshToken) useAuthStore.getState().clearSession();
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  export interface RegisterResponse {
    challengeId: string;
    channel?: "mobile" | "email";
    message?: string;
    expiresInSeconds: number;
    resendAfterSeconds: number;
    stubCode?: string;
    testOnly?: boolean;
  }

  export interface RegisterPayload {
    name: string;
    password: string;
    method?: "mobile" | "email";
    mobile?: string;
    email?: string;
  }

  export interface PasswordResetChallengeResponse {
    challengeId: string;
    expiresInSeconds: number;
    resendAfterSeconds: number;
    destination?: string;
    maskedMobile?: string;
    maskedEmail?: string;
    stubCode?: string;
  }

  export const authService = {
    async register(
      nameOrPayload: string | RegisterPayload,
      mobile?: string,
      password?: string,
      email?: string,
      method?: "mobile" | "email"
    ): Promise<RegisterResponse> {
      const payload =
        typeof nameOrPayload === "object"
          ? nameOrPayload
          : { name: nameOrPayload, mobile, password, email, method };
      const res = await api.post("/auth/register", payload);
      return res.data;
    },

    async resendRegistration(challengeId: string): Promise<RegisterResponse> {
      return (await api.post("/auth/register/resend", { challengeId })).data;
    },

    async verifyRegistration(
      identifier: string,
      challengeId: string,
      code: string
    ): Promise<UserProfile> {
      const cleanMobile = identifier.trim().replace(/\D/g, "");
      const isMobile = !identifier.includes("@") && /^[0-9]{10}$/.test(cleanMobile);
      const cleanCode = String(code || "").replace(/\D/g, "").slice(0, 6);
      const cleanChallengeId = String(challengeId || "").trim();
      const payload = isMobile
        ? { mobile: cleanMobile, identifier: cleanMobile, challengeId: cleanChallengeId, code: cleanCode }
        : { email: identifier.trim().toLowerCase(), identifier: identifier.trim().toLowerCase(), challengeId: cleanChallengeId, code: cleanCode };
      const res = await api.post("/auth/register/verify", payload);
      const { accessToken, refreshToken, user } = res.data;
      useAuthStore.getState().setTokens({ accessToken, refreshToken });
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setAuthState("AUTHENTICATED");
      return user;
    },

    async login(identifier: string, password: string): Promise<UserProfile> {
      const cleanMobile = identifier.trim().replace(/\D/g, "");
      const isMobile = !identifier.includes("@") && /^[0-9]{10}$/.test(cleanMobile);
      const payload = isMobile
        ? { mobile: cleanMobile, identifier: cleanMobile, password }
        : { email: identifier.trim().toLowerCase(), identifier: identifier.trim().toLowerCase(), password };

      const res = await api.post("/auth/login", payload);
      const { accessToken, refreshToken, user } = res.data;

      useAuthStore.getState().setTokens({ accessToken, refreshToken });
      useAuthStore.getState().setUser(user);
      useAuthStore.getState().setAuthState("AUTHENTICATED");

      return user;
    },

    async requestPasswordReset(identifier: string): Promise<PasswordResetChallengeResponse> {
      const cleanMobile = identifier.trim().replace(/\D/g, "");
      const isMobile = /^[0-9]{10}$/.test(cleanMobile);
      const payload = isMobile
        ? { mobile: cleanMobile, identifier: cleanMobile }
        : { email: identifier.trim().toLowerCase(), identifier: identifier.trim().toLowerCase() };
      const res = await api.post("/auth/forgot-password", payload);
      return res.data;
    },

    async resendPasswordReset(challengeId: string): Promise<PasswordResetChallengeResponse> {
      const res = await api.post("/auth/forgot-password/resend", { challengeId });
      return res.data;
    },

    async resetPassword(challengeId: string, code: string, newPassword: string): Promise<UserProfile> {
      const res = await api.post("/auth/reset-password", { challengeId, code, newPassword });
      const { accessToken, refreshToken, user } = res.data;
      if (accessToken && refreshToken) {
        useAuthStore.getState().setTokens({ accessToken, refreshToken });
      }
      if (user) {
        useAuthStore.getState().setUser(user);
        useAuthStore.getState().setAuthState("AUTHENTICATED");
      }
      return user;
    },

    async completeDemoKyc() {
      const { accessToken, user } = useAuthStore.getState();
      if (!user || user.role !== "user" || !accessToken) throw new Error("Sign in as a User first");
      await api.post("/auth/kyc/demo");
      useAuthStore.getState().setUser({ ...user, demoKycComplete: true });
    },

    async getMe() {
      try {
        const res = await api.get("/auth/me");
        useAuthStore.getState().setUser(res.data);
        useAuthStore.getState().setAuthState("AUTHENTICATED");
        return res.data;
      } catch (e) { throw e; }
    },

    async logout() {
      try {
        // Best effort backend logout to invalidate refresh token
        await api.post("/auth/logout", undefined, { timeout: 10000 });
      } catch {
        console.warn("Backend logout failed, clearing local session anyway.");
      } finally {
        useAuthStore.getState().clearSession();
      }
    }
  };

  export default api;
