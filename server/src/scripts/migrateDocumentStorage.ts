import "dotenv/config";
import mongoose from "mongoose";
import path from "path";
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { PropertyDocument } from "../models/Document.model";
import { FileCleanup } from "../models/FileCleanup.model";
async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "documents" });
    let count = 0;
    for await (const doc of PropertyDocument.find({ fileUrl: { $not: /^gridfs:/ } }).cursor()) {
      const source = path.join(path.resolve(__dirname, "../../uploads"), path.basename(doc.fileUrl));
      const stream = bucket.openUploadStream(path.basename(doc.fileUrl), { metadata: { ownerId: String(doc.uploadedBy), propertyId: doc.propertyId, migrated: true } });
      await FileCleanup.create({ _id: `documents:${stream.id}`, bucket: "documents", fileId: stream.id, nextAttemptAt: new Date(Date.now() + 3600000) });
      await pipeline(createReadStream(source), stream);
      await PropertyDocument.updateOne({ _id: doc._id, fileUrl: doc.fileUrl }, { $set: { fileUrl: `gridfs:${stream.id}` } });
      count++;
    }
    console.log(`Migrated ${count} documents; original local files retained for rollback`);
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error("Document migration failed; completed records are safe to retry"); process.exitCode = 1; });
