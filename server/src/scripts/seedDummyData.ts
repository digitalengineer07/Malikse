import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";

async function seedDummyData() {
  const mongoUri = "mongodb+srv://Ankush:lhq0ljItQtTNoIcI@cluster0.sed8t.mongodb.net/MAlikse?retryWrites=true&w=majority&appName=Cluster0";
  await mongoose.connect(mongoUri);

  try {
    console.log("Connected to DB, creating dummy users...");
    
    const passwordHash = await bcrypt.hash("password123", 10);
    
    const roles = ["admin", "advisor", "verifier", "user"];
    const users: Record<string, any> = {};
    for (const role of roles) {
      let user = await User.findOne({ role });
      if (!user) {
        user = await User.create({
          role,
          name: `Test ${role}`,
          mobile: `999990000${roles.indexOf(role)}`,
          email: `test${role}@example.com`,
          passwordHash,
          demoKycComplete: true
        });
      }
      users[role] = user;
    }
    
    console.log("Creating dummy properties...");
    const properties = [
      {
        title: "Prime Commercial Plot",
        description: "Excellent location for a mall or shopping complex.",
        ownerId: users["user"]._id,
        type: "land",
        location: { state: "Bihar", district: "Patna", block: "Sadar", mauza: "Phulwari", policeStation: "Phulwari", lat: 25.5941, lng: 85.1376 },
        totalArea: 5000,
        sellableArea: 5000,
        price: 15000000,
        status: "verified",
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
        advisorReview: { decision: "approve" },
        verifierReview: { decision: "approve" }
      },
      {
        title: "2BHK Modern Flat",
        description: "Ready to move apartment in a gated society.",
        ownerId: users["user"]._id,
        type: "flat",
        location: { state: "Maharashtra", district: "Pune", block: "Haveli", mauza: "Baner", policeStation: "Baner", lat: 18.5590, lng: 73.7868 },
        totalArea: 1200,
        sellableArea: 1000,
        price: 8500000,
        status: "verified",
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
        advisorReview: { decision: "approve" },
        verifierReview: { decision: "approve" }
      },
      {
        title: "Highway Facing Shop",
        description: "Ground floor shop perfect for retail.",
        ownerId: users["user"]._id,
        type: "shop",
        location: { state: "Delhi", district: "South Delhi", block: "Saket", mauza: "Saket", policeStation: "Saket", lat: 28.5244, lng: 77.2066 },
        totalArea: 500,
        sellableArea: 500,
        price: 20000000,
        status: "pending"
      }
    ];

    for (const prop of properties) {
      await Property.create(prop);
    }
    
    console.log("Dummy data created successfully!");
    console.log("Test Accounts (password: password123):");
    console.log("Admin:", users["admin"].mobile);
    console.log("Advisor:", users["advisor"].mobile);
    console.log("Verifier:", users["verifier"].mobile);
    console.log("User (Seller):", users["user"].mobile);

  } finally {
    await mongoose.disconnect();
  }
}

seedDummyData().catch(console.error);
