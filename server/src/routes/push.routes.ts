import { Router } from "express";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { PushDevice } from "../models/PushDevice.model";

const router = Router();
const isPushToken = (value: unknown): value is string =>
  typeof value === "string" && /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(value);

router.post("/devices", authGuard, async (req: AuthRequest, res) => {
  const { token, platform } = req.body || {};
  if (!isPushToken(token) || !["android", "ios"].includes(platform)) {
    return res.status(400).json({ message: "Invalid push device" });
  }
  try {
    await PushDevice.findOneAndUpdate(
      { token }, { $set: { userId: req.user!.id, platform } }, { upsert: true, new: true }
    );
    res.status(204).end();
  } catch {
    res.status(500).json({ message: "Could not register push device" });
  }
});

router.delete("/devices", authGuard, async (req: AuthRequest, res) => {
  const { token } = req.body || {};
  if (!isPushToken(token)) return res.status(400).json({ message: "Invalid push device" });
  try {
    await PushDevice.deleteOne({ token, userId: req.user!.id });
    res.status(204).end();
  } catch {
    res.status(500).json({ message: "Could not unregister push device" });
  }
});

export default router;
