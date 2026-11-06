import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const TARGET_HOST = process.env.PUBLIC_API_URL?.replace(/\/$/, "") || "https://malikseserver.devoxa.in";

async function fixImageUrls() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is missing from environment");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const propertiesCol = mongoose.connection.collection("properties");
  const cursor = propertiesCol.find({
    "media.photos": { $regex: "malikse\\.onrender\\.com" }
  });

  const properties = await cursor.toArray();
  console.log(`Found ${properties.length} properties with obsolete Render photo URLs`);

  let updatedCount = 0;
  for (const prop of properties) {
    if (prop.media && Array.isArray(prop.media.photos)) {
      const fixedPhotos = prop.media.photos.map((photo: string) =>
        photo.replace(/https?:\/\/malikse\.onrender\.com/i, TARGET_HOST)
      );

      await propertiesCol.updateOne(
        { _id: prop._id },
        { $set: { "media.photos": fixedPhotos } }
      );
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} properties to use ${TARGET_HOST}`);
  await mongoose.disconnect();
  process.exit(0);
}

fixImageUrls().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

