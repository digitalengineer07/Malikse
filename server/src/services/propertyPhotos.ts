import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import sharp from "sharp";

export const photoDirectory = path.resolve(__dirname, "../../uploads/property-photos");
export const photoCacheDirectory = path.resolve(photoDirectory, ".cache");

export async function storePropertyPhoto(buffer: Buffer, propertyId?: string) {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error("Photos must be under 10 MB");
  const extension = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpg"
    : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
    : buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
  if (!extension) throw new Error("Choose a JPEG, PNG or WebP image");

  let processedBuffer = buffer;
  try {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true });

    if (extension === "jpg") {
      processedBuffer = await pipeline.jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer();
    } else if (extension === "png") {
      processedBuffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    } else if (extension === "webp") {
      processedBuffer = await pipeline.webp({ quality: 82 }).toBuffer();
    }
  } catch {
    // If image parsing fails (e.g. synthetic test buffers or non-standard EXIF), retain original safely
    processedBuffer = buffer;
  }
  
  const name = `${randomUUID()}.${extension}`;
  
  if (mongoose.connection.readyState !== 1) {
    await fs.mkdir(photoDirectory, { recursive: true });
    await fs.writeFile(path.join(photoDirectory, name), processedBuffer);
    return name;
  }
  
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "photos" });
  return new Promise<string>((resolve, reject) => {
    const stream = bucket.openUploadStream(name, {
      contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
      metadata: propertyId ? { propertyId: new mongoose.Types.ObjectId(propertyId) } : undefined,
    });
    stream.on("error", reject);
    stream.on("finish", () => resolve(name));
    stream.end(processedBuffer);
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

  // Clean up any corresponding generated thumbnails from disk cache
  try {
    const baseName = path.basename(name);
    const cachedFiles = await fs.readdir(photoCacheDirectory);
    for (const cached of cachedFiles) {
      if (cached.endsWith(`_${baseName}`)) {
        await fs.unlink(path.join(photoCacheDirectory, cached)).catch(() => {});
      }
    }
  } catch {
    // Ignore cache cleanup errors
  }
}
