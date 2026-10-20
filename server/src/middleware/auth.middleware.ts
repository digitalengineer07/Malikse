import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
  account?: ReturnType<typeof publicUser>;
}

import { ACCESS_SECRET, publicUser } from "../services/security";

/**
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches `req.user` on success.
 */
export async function authenticateRequest(header: string | undefined) {
  if (!header || !header.startsWith("Bearer ")) {
    return { status: 401, message: "Authentication required. Please sign in as a verified owner to continue." };
  }
  const token = header.slice(7);

  let decoded: { id: string; role: string };
  try {
    decoded = jwt.verify(token, ACCESS_SECRET, { algorithms: ["HS256"] }) as { id: string; role: string };
    if (typeof decoded.id !== "string" || !/^[a-f0-9]{24}$/i.test(decoded.id)) {
      return { status: 401, message: "Invalid account session" };
    }
  } catch {
    return { status: 401, message: "Session expired or invalid. Please sign in again." };
  }
  try {
    const user = await User.findById(decoded.id).select("role passwordHash isSuspended isActive name mobile email isVerifiedIdentity demoKycComplete createdAt").lean();
    if (!user?.passwordHash) {
      return { status: 401, message: "Please sign in with your account credentials" };
    }
    if (user.isSuspended) {
      return { status: 403, message: "Your account has been suspended by the administrator." };
    }
    if (user.isActive === false) {
      return { status: 403, message: "Your staff account has been deactivated." };
    }
    return { user: { id: user._id.toString(), role: user.role }, account: publicUser(user) };
  } catch {
    return { status: 503, message: "Account service is temporarily unavailable. Please try again." };
  }
}

export async function authGuard(req: AuthRequest, res: Response, next: NextFunction) {
  const result = await authenticateRequest(req.headers.authorization);
  if (result.status) return res.status(result.status).json({ message: result.message });
  req.user = result.user;
  req.account = result.account;
  next();
}

/**
 * RBAC guard — call after authGuard.
 * Usage: roleGuard("admin", "advisor")
 */
export function roleGuard(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
