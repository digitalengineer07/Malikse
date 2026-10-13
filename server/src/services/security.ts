import { createHash, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import type { Request } from "express";

function requiredSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value || ["dev_access_secret", "dev_refresh_secret", "your_access_secret", "your_refresh_secret"].includes(value)) {
    throw new Error(`Configure ${name} with a private signing secret before starting the server`);
  }
  return value;
}

export const ACCESS_SECRET = requiredSecret("JWT_ACCESS_SECRET");
export const REFRESH_SECRET = requiredSecret("JWT_REFRESH_SECRET");
if (ACCESS_SECRET === REFRESH_SECRET) throw new Error("Access and refresh signing secrets must be different");
export const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex");
export const accountEnabled = (user: { isSuspended?: boolean; isActive?: boolean }) => !user.isSuspended && user.isActive !== false;
export const publicUser = (user: any) => ({
  id: user._id.toString(), role: user.role, name: user.name, mobile: user.mobile,
  email: user.email, isVerifiedIdentity: user.isVerifiedIdentity,
  demoKycComplete: user.demoKycComplete, createdAt: user.createdAt,
});
export function generateTokens(user: any) {
  const payload = { id: user._id.toString(), role: user.role };
  return {
    accessToken: jwt.sign(payload, ACCESS_SECRET, { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as any }),
    refreshToken: jwt.sign(payload, REFRESH_SECRET, { jwtid: randomUUID(), expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "30d") as any }),
  };
}

// A configured origin is mandatory behind a production TLS-terminating proxy.
const configuredOrigin = process.env.PUBLIC_API_URL;
let publicOrigin: string | undefined;
if (configuredOrigin) {
  const url = new URL(configuredOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error("PUBLIC_API_URL must be an HTTP(S) origin without a path or credentials");
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error("PUBLIC_API_URL must use HTTPS in production");
  publicOrigin = url.origin;
} else if (process.env.NODE_ENV === 'production') {
  throw new Error("Configure PUBLIC_API_URL with the HTTPS API origin in production");
}
export const apiOrigin = (request: Request) => publicOrigin || `${request.protocol}://${request.get('host')}`;
