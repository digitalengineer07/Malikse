import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

import mongoose from "mongoose";

export const photoDirectory = path.resolve(__dirname, "../../uploads/property-photos");

export async function storePropertyPhoto(buffer: Buffer) {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error("Photos must be under 10 MB");
  const extension = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpg"
    : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
    : buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
  if (!extension) throw new Error("Choose a JPEG, PNG or WebP image");
  
  const name = `${randomUUID()}.${extension}`;
  
  if (mongoose.connection.readyState !== 1) {
    await fs.mkdir(photoDirectory, { recursive: true });
    await fs.writeFile(path.join(photoDirectory, name), buffer);
    return name;
  }
  
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
  return new Promise<string>((resolve, reject) => {
    const stream = bucket.openUploadStream(name, {
      contentType: `image/${extension === "jpg" ? "jpeg" : extension}`
    });
    stream.on("error", reject);
    stream.on("finish", () => resolve(name));
    stream.end(buffer);
  });
}

export async function discardPropertyPhoto(name: string) {
  if (mongoose.connection.readyState === 1) {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
      const files = await bucket.find({ filename: name }).toArray();
      for (const file of files) {
        await bucket.delete(file._id).catch(() => {});
      }
    } catch (e) {
      // ignore GridFS errors during discard
    }
  }
  await fs.unlink(path.join(photoDirectory, path.basename(name))).catch(() => {});
}
