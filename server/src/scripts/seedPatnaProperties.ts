import mongoose from "mongoose";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";

async function seedPatnaProperties() {
  const mongoUri = "mongodb+srv://Ankush:lhq0ljItQtTNoIcI@cluster0.sed8t.mongodb.net/MAlikse?retryWrites=true&w=majority&appName=Cluster0";
  await mongoose.connect(mongoUri);

  try {
    console.log("Connected to DB, generating Patna properties...");
    
    const owner = await User.findOne({ role: "user" });
    if (!owner) throw new Error("Owner user not found");

    const patnaProperties = [
      {
        title: "3BHK Apartment in Kankarbagh",
        description: "Spacious family apartment located in the heart of Kankarbagh with 24/7 water supply.",
        ownerId: owner._id,
        type: "flat",
        location: { state: "Bihar", district: "Patna", block: "Patna Sadar", mauza: "Kankarbagh", policeStation: "Kankarbagh", lat: 25.6022, lng: 85.1481 },
        totalArea: 1500, sellableArea: 1400, price: 8500000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      },
      {
        title: "Commercial Land in Bihta",
        description: "Prime commercial land near Bihta airport, ideal for godown or factory.",
        ownerId: owner._id,
        type: "land",
        location: { state: "Bihar", district: "Patna", block: "Bihta", mauza: "Bihta", policeStation: "Bihta", lat: 25.5684, lng: 84.8732 },
        totalArea: 10000, sellableArea: 10000, price: 12000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: false, lawyerReviewed: true, fullyVerified: false },
      },
      {
        title: "Independent House in Danapur",
        description: "Newly built independent house near Saguna More, 2 floors ready.",
        ownerId: owner._id,
        type: "house",
        location: { state: "Bihar", district: "Patna", block: "Danapur", mauza: "Saguna", policeStation: "Danapur", lat: 25.6322, lng: 85.0505 },
        totalArea: 1200, sellableArea: 1200, price: 9500000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      },
      {
        title: "Retail Shop in Boring Road",
        description: "Ground floor shop available for rent or sale at prime Boring Road intersection.",
        ownerId: owner._id,
        type: "shop",
        location: { state: "Bihar", district: "Patna", block: "Patna Sadar", mauza: "Boring Road", policeStation: "S.K. Puri", lat: 25.6146, lng: 85.1219 },
        totalArea: 400, sellableArea: 400, price: 15000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: false, fullyVerified: false },
      },
      {
        title: "2BHK Flat in Phulwari Sharif",
        description: "Affordable housing society, 3rd floor, lift available.",
        ownerId: owner._id,
        type: "flat",
        location: { state: "Bihar", district: "Patna", block: "Phulwari Sharif", mauza: "Phulwari", policeStation: "Phulwari", lat: 25.5772, lng: 85.0805 },
        totalArea: 1000, sellableArea: 950, price: 4200000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: false, siteVisited: false, lawyerReviewed: false, fullyVerified: false },
      },
      {
        title: "Office Space in Dak Bunglow",
        description: "Fully furnished 10-seater office space at Dak Bunglow Chauraha.",
        ownerId: owner._id,
        type: "office",
        location: { state: "Bihar", district: "Patna", block: "Patna Sadar", mauza: "Fraser Road", policeStation: "Kotwali", lat: 25.6094, lng: 85.1388 },
        totalArea: 800, sellableArea: 800, price: 11000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      },
      {
        title: "Residential Plot in AIIMS Area",
        description: "Great investment opportunity near Patna AIIMS. Corner plot.",
        ownerId: owner._id,
        type: "land",
        location: { state: "Bihar", district: "Patna", block: "Phulwari Sharif", mauza: "Walmi", policeStation: "Phulwari", lat: 25.5604, lng: 85.0450 },
        totalArea: 1800, sellableArea: 1800, price: 7200000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1531971589569-0d9370cbe1e5?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: false, fullyVerified: false },
      },
      {
        title: "Duplex Villa in Bailey Road",
        description: "Modern architecture duplex in a posh locality on Bailey Road.",
        ownerId: owner._id,
        type: "house",
        location: { state: "Bihar", district: "Patna", block: "Patna Sadar", mauza: "Sheikhpura", policeStation: "Rupaspur", lat: 25.6053, lng: 85.0716 },
        totalArea: 2400, sellableArea: 2400, price: 18000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1600607686527-6fb886090705?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      },
      {
        title: "Agricultural Land in Maner",
        description: "5 Bigha highly fertile agricultural land with tubewell.",
        ownerId: owner._id,
        type: "land",
        location: { state: "Bihar", district: "Patna", block: "Maner", mauza: "Maner", policeStation: "Maner", lat: 25.6496, lng: 84.8770 },
        totalArea: 136125, sellableArea: 136125, price: 20000000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: false, lawyerReviewed: false, fullyVerified: false },
      },
      {
        title: "Penthouse at Rajendra Nagar",
        description: "Luxurious penthouse offering a panoramic view of the city.",
        ownerId: owner._id,
        type: "flat",
        location: { state: "Bihar", district: "Patna", block: "Patna Sadar", mauza: "Rajendra Nagar", policeStation: "Kadamkuan", lat: 25.6033, lng: 85.1554 },
        totalArea: 2200, sellableArea: 2000, price: 16500000,
        status: "verified",
        media: { photos: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"], videos: [] },
        badges: { identityVerified: true, documentsChecked: true, siteVisited: true, lawyerReviewed: true, fullyVerified: true },
      }
    ];

    for (const prop of patnaProperties) {
      await Property.create(prop);
    }
    
    console.log(`Successfully added 10 properties in Patna!`);

  } finally {
    await mongoose.disconnect();
  }
}

seedPatnaProperties().catch(console.error);
