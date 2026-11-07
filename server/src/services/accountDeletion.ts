import { createHash, createHmac, randomUUID } from "crypto";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { AccountDeletion } from "../models/AccountDeletion.model";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { PropertyDocument } from "../models/Document.model";
import { Deal } from "../models/Deal.model";
import { Inquiry } from "../models/Inquiry.model";
import { SearchPreference } from "../models/SearchPreference.model";
import { Engagement } from "../models/Engagement.model";
import { Notification } from "../models/Notification.model";
import { PushDevice } from "../models/PushDevice.model";
import { PushReceipt } from "../models/PushReceipt.model";
import { DocumentDownload } from "../models/DocumentDownload.model";
import { Registration } from "../models/Registration.model";
import { PasswordReset } from "../models/PasswordReset.model";
import { REFRESH_SECRET } from "./security";
import { invalidatePublicResponses } from "./publicCacheGeneration";
import { markRegionCountsDirty } from "./regionCountStore";
import { photoDirectory } from "./propertyPhotos";

export const deletionReceipt = (id: string) => createHmac("sha256", REFRESH_SECRET).update(`account-deletion:${id}`).digest("hex");
export const deletionSummary = (job: any) => ({ reference: job._id, receipt: deletionReceipt(job._id), status: job.status, requestedAt: job.requestedAt, completedAt: job.completedAt });

export async function requestAccountDeletion(user: any) {
  let job;
  try {
    job = await AccountDeletion.findOneAndUpdate({ userId: user._id }, { $setOnInsert: {
      _id: randomUUID(), userId: user._id, email: user.email, mobile: user.mobile,
      status: "pending", requestedAt: new Date(), nextAttemptAt: new Date(Date.now() + 60_000),
    } }, { upsert: true, new: true });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    job = await AccountDeletion.findOne({ userId: user._id });
  }
  if (!job) throw new Error("Deletion request unavailable");
  // Job is durable first; a worker repairs a crash before this revocation.
  await User.updateOne({ _id: user._id }, { $set: { isActive: false, deletionRequestedAt: job.requestedAt }, $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } });
  return deletionSummary(job);
}

const anonymous = new mongoose.Types.ObjectId("000000000000000000000000");
const uploadDirectory = path.resolve(__dirname, "../../uploads");
async function removeLocal(directory: string, filename: string) {
  if (!filename || [".", ".."].includes(filename) || path.basename(filename) !== filename || /[:\\/]/.test(filename)) throw new Error("Invalid stored file path");
  await fs.unlink(path.join(directory, filename)).catch(error => { if (error.code !== "ENOENT") throw error; });
}
async function removeGridFile(bucketName: string, file: any) {
  // Chunks first, metadata last: a crash leaves enough information to retry.
  const db = mongoose.connection.db!;
  await db.collection(`${bucketName}.chunks`).deleteMany({ files_id: file._id });
  await db.collection(`${bucketName}.files`).deleteOne({ _id: file._id });
}

export async function processAccountDeletion(): Promise<boolean> {
  const now = new Date(), leaseToken = randomUUID();
  const job = await AccountDeletion.findOneAndUpdate({ status: { $ne: "completed" }, nextAttemptAt: { $lte: now },
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
  }, { $set: { status: "processing", leaseToken, leaseUntil: new Date(Date.now() + 300_000) }, $inc: { attempts: 1 } }, { new: true, sort: { nextAttemptAt: 1 } });
  if (!job) return false;
  const ownsLease = { _id: job._id, leaseToken };
  const renew = async () => {
    const renewed = await AccountDeletion.updateOne(ownsLease, { $set: { leaseUntil: new Date(Date.now() + 300_000) } });
    if (!renewed.matchedCount) throw new Error("Deletion lease changed");
  };
  try {
    const userId = job.userId!;
    await User.updateOne({ _id: userId }, { $set: { isActive: false, deletionRequestedAt: job.requestedAt }, $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 } });
    // Session revocation immediately hides listings and prevents new requests.
    // Accepted/payment obligations are closed by assigned staff/admin first.
    if (await Deal.exists({ $or: [{ buyerId: userId }, { ownerId: userId }], status: { $in: ["accepted", "token_paid"] } })) {
      await AccountDeletion.updateOne(ownsLease, { $set: { status: "awaiting_deals", nextAttemptAt: new Date(Date.now() + 60_000) }, $unset: { leaseToken: 1, leaseUntil: 1 } });
      return true;
    }
    const db = mongoose.connection.db!;
    const kyc = new mongoose.mongo.GridFSBucket(db, { bucketName: "kyc" });
    const user = await User.findById(userId).lean();
    const kycIds = (user?.kycDocuments || []).filter(mongoose.isValidObjectId).map(id => new mongoose.Types.ObjectId(id));
    for await (const file of kyc.find({ $or: [{ "metadata.ownerId": String(userId) }, { "metadata.ownerId": userId }, { _id: { $in: kycIds } }] })) {
      await renew(); await removeGridFile("kyc", file);
    }
    const photos = new mongoose.mongo.GridFSBucket(db, { bucketName: "photos" });
    await Deal.updateMany({ $or: [{ buyerId: userId }, { ownerId: userId }], status: { $in: ["offered", "countered"] } }, { $set: { status: "cancelled" } });
    // Remove bytes before the document that locates them; every step is retryable.
    for await (const property of Property.find({ ownerId: userId }).cursor()) {
      await renew();
      for await (const doc of PropertyDocument.find({ propertyId: property._id }).cursor()) {
        await removeLocal(uploadDirectory, path.basename(doc.fileUrl));
        await DocumentDownload.deleteMany({ documentId: doc._id });
        await PropertyDocument.deleteOne({ _id: doc._id });
      }
      const names = (property.media?.photos || []).map(url => {
        try { return path.basename(new URL(url).pathname); } catch { return ""; }
      }).filter(name => /^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(name));
      for await (const file of photos.find({ $or: [{ "metadata.propertyId": property._id }, { filename: { $in: names } }] })) {
        const suffix = new RegExp(`/property-photos/${file.filename.replace(/\./g, "\\.")}$`);
        if (!await Property.exists({ _id: { $ne: property._id }, "media.photos": suffix })) {
          await removeLocal(photoDirectory, file.filename); await removeGridFile("photos", file);
        } else if (String(file.metadata?.propertyId) === String(property._id)) {
          // Shared legacy photos must resolve access through surviving listings.
          await db.collection("photos.files").updateOne({ _id: file._id }, { $unset: { "metadata.propertyId": 1 } });
        }
      }
      for (const name of names) {
        const suffix = new RegExp(`/property-photos/${name.replace(/\./g, "\\.")}$`);
        if (!await Property.exists({ _id: { $ne: property._id }, "media.photos": suffix })) await removeLocal(photoDirectory, name);
      }
      await Inquiry.deleteMany({ propertyId: property._id });
      await Engagement.deleteMany({ propertyId: property._id });
      await User.updateMany({ wishlist: property._id }, { $pull: { wishlist: property._id } });
      await Deal.updateMany({ propertyId: property._id }, { $set: { ownerId: anonymous, history: [] }, $unset: { tokenPaymentRef: 1, registryDateEstimate: 1, requestKey: 1 } });
      await Property.deleteOne({ _id: property._id });
    }
    await renew();
    await Deal.updateMany({ $or: [{ buyerId: userId }, { ownerId: userId }], status: { $in: ["offered", "countered"] } }, { $set: { status: "cancelled" } });
    await Deal.updateMany({ buyerId: userId }, { $set: { buyerId: anonymous, history: [] }, $unset: { tokenPaymentRef: 1, registryDateEstimate: 1, requestKey: 1 } });
    await Deal.updateMany({ ownerId: userId }, { $set: { ownerId: anonymous, history: [] }, $unset: { tokenPaymentRef: 1, registryDateEstimate: 1, requestKey: 1 } });
    await Inquiry.deleteMany({ buyerId: userId });
    await Inquiry.updateMany({ "messages.senderId": userId }, { $pull: { messages: { senderId: userId } } });
    await Property.updateMany({ jointOwnerIds: userId }, { $pull: { jointOwnerIds: userId } });
    for await (const doc of PropertyDocument.find({ uploadedBy: userId }).cursor()) {
      await renew();
      await removeLocal(uploadDirectory, path.basename(doc.fileUrl));
      await DocumentDownload.deleteMany({ documentId: doc._id });
      await Property.updateMany({ documents: doc._id }, { $pull: { documents: doc._id } });
      await PropertyDocument.deleteOne({ _id: doc._id });
    }
    await SearchPreference.deleteMany({ userId });
    await Engagement.deleteMany({ actor: createHash("sha256").update(String(userId)).digest("hex") });
    await Notification.deleteMany({ recipient: userId });
    for await (const device of PushDevice.find({ userId }).cursor()) {
      await PushReceipt.deleteMany({ token: device.token });
      await PushDevice.deleteOne({ _id: device._id });
    }
    await DocumentDownload.deleteMany({ actorId: userId });
    await PasswordReset.deleteMany({ userId });
    const contacts = [job.email, job.mobile].filter(Boolean);
    await Registration.deleteMany({ $or: [{ _id: { $in: contacts } }, ...(job.email ? [{ email: job.email }] : []), ...(job.mobile ? [{ mobile: job.mobile }] : [])] });
    await renew();
    await User.deleteOne({ _id: userId });
    invalidatePublicResponses();
    await markRegionCountsDirty();
    await AccountDeletion.updateOne(ownsLease, { $set: { status: "completed", completedAt: new Date(), expiresAt: new Date(Date.now() + 90 * 86400_000) }, $unset: { userId: 1, email: 1, mobile: 1, leaseToken: 1, leaseUntil: 1 } });
  } catch {
    await AccountDeletion.updateOne(ownsLease, { $set: { status: "pending", nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(job.attempts, 7))) }, $unset: { leaseToken: 1, leaseUntil: 1 } });
    console.error("[account-deletion] Cleanup deferred", { reference: job._id });
  }
  return true;
}

export function startAccountDeletionWorker() {
  let stopped = false, running: Promise<unknown> | undefined;
  const tick = () => { if (!stopped && !running) running = processAccountDeletion().catch(() => console.error("[account-deletion] Retry deferred")).finally(() => { running = undefined; }); };
  const timer = setInterval(tick, 10_000); timer.unref(); tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
