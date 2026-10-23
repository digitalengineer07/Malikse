import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuthStore } from "../store/authStore";
import type { UserProfile } from "../types/auth.types";
import { invalidatePropertySearch } from "./searchCache";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
function resolveApiUrl() {
  if (Platform.OS === "web" || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(configuredApiUrl)) {
    return configuredApiUrl;
  }
  const expoHost = Constants.expoConfig?.hostUri?.split(":")[0];
  const host = expoHost && expoHost !== "localhost" ? expoHost : Platform.OS === "android" ? "10.0.2.2" : "localhost";
  return configuredApiUrl.replace(/localhost|127\.0\.0\.1/, host);
}
const API_URL = resolveApiUrl();

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

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
    
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !["/auth/login", "/auth/register", "/auth/register/verify", "/auth/refresh"].includes(originalRequest.url)) {
      
      originalRequest._retry = true;
      if (isRefreshing) {
        if (failedQueue.length >= 100) return Promise.reject(error);
        return new Promise(function(resolve, reject) {
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
      if (!refreshToken) {
        useAuthStore.getState().clearSession();
        isRefreshing = false;
        processQueue(error);
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: 10000 });
        if (useAuthStore.getState().refreshToken !== refreshToken) throw new Error("Session changed during refresh");
        
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
  expiresInSeconds: number;
  resendAfterSeconds: number;
  stubCode?: string;
  testOnly?: boolean;
}

export const authService = {
  async register(
    name: string,
    mobile: string,
    password: string,
    email?: string
  ): Promise<RegisterResponse> {
    const res = await api.post("/auth/register", { name, mobile, email, password });
    return res.data;
  },

  async verifyRegistration(
    mobile: string,
    challengeId: string,
    code: string
  ): Promise<UserProfile> {
    const res = await api.post("/auth/register/verify", { mobile, challengeId, code });
    const { accessToken, refreshToken, user } = res.data;
    useAuthStore.getState().setTokens({ accessToken, refreshToken });
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setAuthState("AUTHENTICATED");
    return user;
  },

  async login(identifier: string, password: string): Promise<UserProfile> {
    const cleanMobile = identifier.trim().replace(/\D/g, "");
    const isMobile = /^[0-9]{10}$/.test(cleanMobile);
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
