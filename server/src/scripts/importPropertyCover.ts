import "dotenv/config";
import fs from "fs/promises";
import mongoose from "mongoose";
import { Property } from "../models/Property.model";
import { storePropertyPhoto } from "../services/propertyPhotos";

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Provide the image file path");
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse");
  const filename = await storePropertyPhoto(await fs.readFile(source));
  const origin = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;
  const url = `${origin.replace(/\/$/, "")}/property-photos/${filename}`;
  const result = await Property.updateMany({}, [{ $set: {
    "media.photos": { $concatArrays: [[url], { $ifNull: ["$media.photos", []] }] },
    __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] },
  } }]);
  console.log(JSON.stringify({ updatedProperties: result.modifiedCount, url }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
