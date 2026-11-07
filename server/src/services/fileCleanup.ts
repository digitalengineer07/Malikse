import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { FileCleanup } from "../models/FileCleanup.model";
import { User } from "../models/User.model";
import { PropertyDocument } from "../models/Document.model";
export async function processFileCleanup() {
  const db = mongoose.connection.db!;
  for (const job of await FileCleanup.find({ nextAttemptAt: { $lte: new Date() } }).limit(20)) {
    try {
      const referenced = job.bucket === "kyc" ? await User.exists({ kycDocuments: String(job.fileId) }) : await PropertyDocument.exists({ fileUrl: `gridfs:${job.fileId}` });
      if (referenced) { await FileCleanup.deleteOne({ _id: job._id }); continue; }
      await db.collection(`${job.bucket}.chunks`).deleteMany({ files_id: job.fileId });
      await db.collection(`${job.bucket}.files`).deleteOne({ _id: job.fileId });
      await FileCleanup.deleteOne({ _id: job._id });
    } catch { await FileCleanup.updateOne({ _id: job._id }, { $inc: { attempts: 1 }, $set: { nextAttemptAt: new Date(Date.now() + 60000) } }); }
  }
  // These are only temporary multipart files, never legacy document originals.
  const incoming = path.resolve(__dirname, "../../uploads/.incoming");
  for (const name of await fs.readdir(incoming).catch(() => [])) {
    if (!/^[a-f0-9-]{36}\.[a-z0-9]+$/i.test(name)) continue;
    const filename = path.join(incoming, name);
    const stat = await fs.lstat(filename).catch(() => null);
    if (stat?.isFile() && stat.mtimeMs < Date.now() - 3600000) await fs.unlink(filename).catch(() => {});
  }

}
