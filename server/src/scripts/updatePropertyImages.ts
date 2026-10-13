import mongoose from "mongoose";
import fs from "fs/promises";
import { Property } from "../models/Property.model";
import { storePropertyPhoto } from "../services/propertyPhotos";

async function updatePropertyImages() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/malikse";
  await mongoose.connect(mongoUri);

  try {
    console.log("Connected to DB, uploading custom image...");
    
    // Read the user's provided image
    const imagePath = "d:\\devoxa technologies\\malikse\\images.jpg";
    const imageBuffer = await fs.readFile(imagePath);
    
    // Store image in GridFS using the service
    const uploadedFilename = await storePropertyPhoto(imageBuffer);
    console.log(`Image uploaded successfully as: ${uploadedFilename}`);

    // Update all properties that currently use unsplash URLs
    const result = await Property.updateMany(
      { 
        "media.photos": { $regex: /unsplash/ } 
      },
      { 
        $set: { "media.photos": [uploadedFilename] } 
      }
    );
    
    console.log(`Successfully updated ${result.modifiedCount} properties with your custom image!`);
  } catch (error) {
    console.error("Error updating images:", error);
  } finally {
    await mongoose.disconnect();
  }
}

updatePropertyImages().catch(console.error);
