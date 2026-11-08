import type { Request, Response } from "express";
import { publicUser } from "./security";
const cookieName = "malikse_refresh";
export const cookieSession = (req: Request) => req.get("X-Session-Mode") === "cookie";
export function trustedCookieOrigin(req: Request) {
  const allowed = (process.env.CORS_ORIGINS || "https://malikse.devoxa.in").split(",").map(v => v.trim());
  const origin = req.get("origin");
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  return process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/auth" });
export function sessionPayload(req: Request, res: Response, tokens: { accessToken: string; refreshToken: string }, user: any) {
  if (cookieSession(req)) {
    res.cookie(cookieName, tokens.refreshToken, options());
    res.setHeader("Cache-Control", "no-store");
    return { accessToken: tokens.accessToken, refreshToken: "cookie", user: publicUser(user) };
  }
  return { ...tokens, user: publicUser(user) };
}
export function refreshFromRequest(req: Request) {
  if (!cookieSession(req)) return req.body.refreshToken;
  const cookie = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(cookieName + "="));
  return cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : undefined;
}
export function clearCookieSession(res: Response) { res.clearCookie(cookieName, options()); }
