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
export async function authGuard(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required. Please sign in as a verified owner to continue." });
  }
  const token = header.slice(7);

  let decoded: { id: string; role: string };
  try {
    decoded = jwt.verify(token, ACCESS_SECRET, { algorithms: ["HS256"] }) as { id: string; role: string };
    if (typeof decoded.id !== "string" || !/^[a-f0-9]{24}$/i.test(decoded.id)) {
      return res.status(401).json({ message: "Invalid account session" });
    }
  } catch {
    return res.status(401).json({ message: "Session expired or invalid. Please sign in again." });
  }
  try {
    const user = await User.findById(decoded.id).select("role passwordHash isSuspended isActive name mobile email isVerifiedIdentity demoKycComplete createdAt").lean();
    if (!user?.passwordHash) {
      return res.status(401).json({ message: "Please sign in with your account credentials" });
    }
    if (user.isSuspended) {
      return res.status(403).json({ message: "Your account has been suspended by the administrator." });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: "Your staff account has been deactivated." });
    }
    req.user = { id: user._id.toString(), role: user.role };
    req.account = publicUser(user);
    next();
  } catch {
    return res.status(503).json({ message: "Account service is temporarily unavailable. Please try again." });
  }
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
