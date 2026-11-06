import mongoose from "mongoose";
import { Property } from "./src/models/Property.model";
import dotenv from "dotenv";
dotenv.config();

async function fixImageUrls() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("Connected to MongoDB");

  const properties = await Property.find({ "media.photos": { $regex: "http://malikse.onrender.com" } });
  
  let count = 0;
  for (const prop of properties) {
    if (prop.media && prop.media.photos) {
      prop.media.photos = prop.media.photos.map(photo => 
        photo.replace("http://malikse.onrender.com", "https://malikse.onrender.com")
      );
      await prop.save();
      count++;
    }
  }

  console.log(`Updated ${count} properties with fixed image URLs`);
  process.exit(0);
}

fixImageUrls();
