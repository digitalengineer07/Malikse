import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

import { ACCESS_SECRET } from "../services/security";

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

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as { id: string; role: string };
    if (typeof decoded.id !== "string" || !/^[a-f0-9]{24}$/i.test(decoded.id)) {
      return res.status(401).json({ message: "Invalid account session" });
    }
    const user = await User.findById(decoded.id).select("role passwordHash isSuspended isActive");
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
    next();
  } catch {
    return res.status(401).json({ message: "Session expired or invalid. Please sign in again." });
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
