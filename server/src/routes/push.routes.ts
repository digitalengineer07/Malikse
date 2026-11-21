import { Router } from "express";
import { isObjectIdOrHexString, Types } from "mongoose";
import { authGuard, AuthRequest } from "../middleware/auth.middleware";
import { PushDevice } from "../models/PushDevice.model";
import { Notification } from "../models/Notification.model";
import { findNotificationMessage, genericChatTitle } from "../services/notificationMessage";

const router = Router();

router.get("/notifications", authGuard, async (req: AuthRequest, res, next) => {
  const recipient = req.user!.id;
  const before = req.query.before;
  if (before !== undefined && (typeof before !== "string" || !isObjectIdOrHexString(before))) {
    return res.status(400).json({ message: "Invalid notification cursor" });
  }
  res.set("Cache-Control", "private, no-store");
  const limit = 20;
  try {
    const notifications = await Notification.find({ recipient, listingBroadcast: { $ne: true }, ...(before ? { _id: { $lt: before } } : {}) })
      .sort({ _id: -1 }).limit(limit + 1)
      .select("title body data messageId readAt createdAt").lean();
    const items = await Promise.all(notifications.slice(0, limit).map(async item => {
      const { kind, id } = item.data || {};
      const target = (kind === "inquiry" || kind === "deal" || kind === "property" || kind === "listings") && typeof id === "string" && isObjectIdOrHexString(id)
        ? { kind, id } : null;
      const message = await findNotificationMessage(recipient, target ?? undefined, item.messageId);
      const title = item.messageId && !message ? genericChatTitle : item.title;
      const senderName = message && title !== genericChatTitle ? title : undefined;
      return { id: String(item._id), title, senderName, body: message?.text ?? item.body, target, readAt: item.readAt, createdAt: item.createdAt };
    }));
    res.json({ items, nextCursor: notifications.length > limit ? items[limit - 1].id : null });
  } catch (error) {
    next(error);
  }
});

router.get("/notifications/unread", authGuard, async (req: AuthRequest, res, next) => {
  res.set("Cache-Control", "private, no-store");
  try {
    res.json({ unread: await Notification.countDocuments({ recipient: req.user!.id, readAt: null, listingBroadcast: { $ne: true } }) });
  } catch (error) {
    next(error);
  }
});

router.patch("/notifications/:id/read", authGuard, async (req: AuthRequest, res, next) => {
  if (!isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
  try {
    await Notification.updateOne(
      { _id: new Types.ObjectId(req.params.id), recipient: req.user!.id, readAt: null, listingBroadcast: { $ne: true } },
      { $set: { readAt: new Date() } },
    );
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});
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
