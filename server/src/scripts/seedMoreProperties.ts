import mongoose from "mongoose";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";

async function seedMoreProperties() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/malikse";
  await mongoose.connect(mongoUri);

  try {
    console.log("Connected to DB, listing more properties...");
    
    // Get the user to assign as owner
    const owner = await User.findOne({ role: "user" });
    if (!owner) throw new Error("Owner user not found");

    const moreProperties = [
      {
        title: "Luxury 4BHK Villa",
        description: "A beautiful luxury villa with a private pool and garden in a premium gated community.",
        ownerId: owner._id,
        type: "house",
        location: { state: "Maharashtra", district: "Mumbai", block: "Andheri", mauza: "Andheri West", policeStation: "Versova", lat: 19.1136, lng: 72.8297 },
        totalArea: 3500,
        sellableArea: 3500,
        price: 55000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      },
      {
        title: "10 Acres Agricultural Land",
        description: "Fertile agricultural land near the highway with excellent water supply.",
        ownerId: owner._id,
        type: "land",
        location: { state: "Punjab", district: "Ludhiana", block: "Jagraon", mauza: "Jagraon", policeStation: "Jagraon", lat: 30.7820, lng: 75.4749 },
        totalArea: 435600, // 10 acres in sqft
        sellableArea: 435600,
        price: 30000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: false, fullyVerified: false },
      },
      {
        title: "Premium Office Space",
        description: "Fully furnished office space in the IT Park with central AC and power backup.",
        ownerId: owner._id,
        type: "office",
        location: { state: "Karnataka", district: "Bengaluru", block: "Whitefield", mauza: "Whitefield", policeStation: "Whitefield", lat: 12.9698, lng: 77.7499 },
        totalArea: 2500,
        sellableArea: 2500,
        price: 25000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      },
      {
        title: "Affordable 1BHK Apartment",
        description: "Great for investment or small families. Close to metro station.",
        ownerId: owner._id,
        type: "flat",
        location: { state: "Delhi", district: "East Delhi", block: "Laxmi Nagar", mauza: "Laxmi Nagar", policeStation: "Laxmi Nagar", lat: 28.6304, lng: 77.2773 },
        totalArea: 600,
        sellableArea: 550,
        price: 4500000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: false, lawyerReviewed: false, fullyVerified: false },
      },
      {
        title: "Commercial Retail Shop",
        description: "Main road facing shop with high footfall, ideal for a restaurant or supermarket.",
        ownerId: owner._id,
        type: "shop",
        location: { state: "Telangana", district: "Hyderabad", block: "Banjara Hills", mauza: "Banjara Hills", policeStation: "Banjara Hills", lat: 17.4156, lng: 78.4347 },
        totalArea: 1000,
        sellableArea: 1000,
        price: 40000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      }
    ];

    for (const prop of moreProperties) {
      await Property.create(prop);
    }
    
    console.log(`Successfully added ${moreProperties.length} more properties!`);

  } finally {
    await mongoose.disconnect();
  }
}

seedMoreProperties().catch(console.error);
