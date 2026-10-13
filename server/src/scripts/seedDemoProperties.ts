import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { discardPropertyPhoto, storePropertyPhoto } from "../services/propertyPhotos";

// Local development fixtures. The coordinates and outlines are illustrative,
// not surveyed boundaries or representations of the photos' real locations.
const samples = [
  { title: "DEMO · Patna residential plot", type: "land", state: "Bihar", district: "Patna", pincode: "800001", lat: 25.612, lng: 85.145, area: 1800, price: 7200000, image: "plot_patna_aerial.jpg" },
  { title: "DEMO · Danapur roadside land", type: "land", state: "Bihar", district: "Patna", pincode: "801503", lat: 25.632, lng: 85.051, area: 3200, price: 9100000, image: "plot_danapur_field.jpg" },
  { title: "DEMO · Patna detached house", type: "house", state: "Bihar", district: "Patna", pincode: "800014", lat: 25.606, lng: 85.071, area: 2400, price: 18500000, image: "saved_villa_house.jpg" },
  { title: "DEMO · Gaya agricultural plot", type: "land", state: "Bihar", district: "Gaya", pincode: "823001", lat: 24.796, lng: 85.006, area: 5400, price: 4600000, image: "saved_plot_land.jpg" },
  { title: "DEMO · Pune family home", type: "house", state: "Maharashtra", district: "Pune", pincode: "411045", lat: 18.559, lng: 73.787, area: 2100, price: 15500000, image: "saved_villa_house.jpg" },
  { title: "DEMO · Bengaluru garden home", type: "house", state: "Karnataka", district: "Bengaluru", pincode: "560066", lat: 12.970, lng: 77.750, area: 2650, price: 23000000, image: "saved_hero_scenic.jpg" },
] as const;

const areas = [
  { state: "Bihar", district: "Patna", pincode: "800001", lat: 25.612, lng: 85.145, count: 56 },
  { state: "Bihar", district: "Gaya", pincode: "823001", lat: 24.796, lng: 85.006, count: 8 },
  { state: "Bihar", district: "Muzaffarpur", pincode: "842001", lat: 26.123, lng: 85.391, count: 8 },
  { state: "Maharashtra", district: "Pune", pincode: "411045", lat: 18.559, lng: 73.787, count: 8 },
  { state: "Maharashtra", district: "Mumbai", pincode: "400001", lat: 18.938, lng: 72.835, count: 8 },
  { state: "Maharashtra", district: "Nagpur", pincode: "440001", lat: 21.146, lng: 79.089, count: 8 },
  { state: "Karnataka", district: "Bengaluru", pincode: "560066", lat: 12.970, lng: 77.750, count: 8 },
  { state: "Karnataka", district: "Mysuru", pincode: "570001", lat: 12.306, lng: 76.655, count: 8 },
  { state: "Telangana", district: "Hyderabad", pincode: "500001", lat: 17.387, lng: 78.481, count: 8 },
  { state: "Uttar Pradesh", district: "Lucknow", pincode: "226001", lat: 26.846, lng: 80.946, count: 8 },
  { state: "West Bengal", district: "Kolkata", pincode: "700001", lat: 22.572, lng: 88.363, count: 8 },
  { state: "Tamil Nadu", district: "Chennai", pincode: "600001", lat: 13.083, lng: 80.283, count: 8 },
] as const;
const propertyTypes = ["land", "flat", "house", "shop", "office"] as const;
const disclaimer = "SAMPLE DATA ONLY. This is not a real property offer. Photo, price, coordinates and outlined boundary are illustrative and must not be used for a transaction or land survey.";

function approximateBoundary(lat: number, lng: number, area: number) {
  const sideMetres = Math.sqrt(area / 10.7639);
  const north = sideMetres / 2 / 111_320;
  const east = sideMetres / 2 / (111_320 * Math.cos(lat * Math.PI / 180));
  return [
    { lat: lat - north, lng: lng - east },
    { lat: lat - north, lng: lng + east },
    { lat: lat + north, lng: lng + east },
    { lat: lat + north, lng: lng - east },
  ];
}

async function main() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/malikse";
  const endpoint = new URL(uri);
  if (endpoint.protocol !== "mongodb:" || !["localhost", "127.0.0.1"].includes(endpoint.hostname) || endpoint.pathname !== "/malikse") {
    throw new Error("This demo seeder only writes to the local malikse database");
  }
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid local API port");
  const origin = `http://localhost:${port}`;
  await mongoose.connect(uri, { autoIndex: false });
  try {
    let owner = await User.findOne({ email: "demo-properties@malikse.invalid", role: "user" });
    if (!owner) {
      for (let number = 9876500000; number < 9876500100 && !owner; number++) {
        if (await User.exists({ mobile: String(number) })) continue;
        try { owner = await User.create({ name: "MalikSe Demo Listings", email: "demo-properties@malikse.invalid", mobile: String(number), role: "user", demoKycComplete: true }); }
        catch (error: any) { if (error.code !== 11000) throw error; }
      }
      if (!owner) throw new Error("No available demo account identifier");
    }
    await Property.createIndexes();
    for (const sample of samples) {
      const existing = await Property.findOne({ ownerId: owner._id, title: sample.title }).select("_id").lean();
      if (existing) { console.log(`EXISTS ${existing._id} ${sample.title}`); continue; }
      const imagePath = path.resolve(__dirname, "../../../app/assets", sample.image);
      const photo = await storePropertyPhoto(await fs.readFile(imagePath));
      try {
        const property = await Property.create({
          ownerId: owner._id, title: sample.title,
          description: disclaimer,
          type: sample.type, status: "verified",
          location: { state: sample.state, district: sample.district, pincode: sample.pincode, lat: sample.lat, lng: sample.lng },
          parcelPoints: approximateBoundary(sample.lat, sample.lng, sample.area),
          totalArea: sample.area, sellableArea: sample.area, price: sample.price,
          badges: { fullyVerified: true }, advisorReview: { decision: "approve" }, verifierReview: { decision: "approve" },
          media: { photos: [`${origin}/property-photos/${photo}`], videos: [] },
        });
        console.log(`CREATED ${property._id} ${sample.title} ${sample.state}/${sample.district}/${sample.pincode}`);
      } catch (error) {
        await discardPropertyPhoto(photo);
        throw error;
      }
    }
    const baseListings = await Property.find({ ownerId: owner._id, title: { $in: samples.map(sample => sample.title) } }).select("title media.photos").lean();
    if (baseListings.length !== samples.length || baseListings.some(listing => !listing.media?.photos?.[0])) throw new Error("Six base demo photos are required");
    const photoURLs = samples.map(sample => baseListings.find(listing => listing.title === sample.title)!.media.photos[0]);
    const currentTitles = new Set((await Property.find({ ownerId: owner._id, title: /^DEMO · Sample / }).select("title").lean()).map(listing => listing.title));
    const additional: object[] = [];
    let sequence = 0;
    for (const area of areas) for (let index = 0; index < area.count; index++) {
      sequence++;
      const type = propertyTypes[(sequence - 1) % propertyTypes.length];
      const title = `DEMO · Sample ${String(sequence).padStart(3, "0")} · ${type} in ${area.district}`;
      if (currentTitles.has(title)) continue;
      const lat = area.lat + ((index % 4) - 1.5) * 0.0015;
      const lng = area.lng + (Math.floor(index / 4) - 1.5) * 0.0015;
      const totalArea = 650 + (sequence % 14) * 175;
      const price = 2500000 + sequence * 125000 + propertyTypes.indexOf(type) * 650000;
      additional.push({
        ownerId: owner._id, title, description: disclaimer, type, price, totalArea, sellableArea: totalArea,
        status: "verified", location: { state: area.state, district: area.district, pincode: area.pincode, lat, lng },
        parcelPoints: approximateBoundary(lat, lng, totalArea),
        badges: { fullyVerified: true }, advisorReview: { decision: "approve" }, verifierReview: { decision: "approve" },
        media: { photos: [photoURLs[(sequence - 1) % photoURLs.length]], videos: [] },
      });
    }
    if (sequence !== 144) throw new Error("Expected 144 generated samples");
    if (additional.length) await Property.insertMany(additional, { ordered: true });
    const total = await Property.countDocuments({ ownerId: owner._id, title: /^DEMO · / });
    if (total !== 150) throw new Error(`Expected 150 demo properties; found ${total}`);
    console.log(`Demo owner ${owner._id}; created ${additional.length} additional listings; ${total} total. Six uploaded GridFS images are reused across the examples.`);
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error("Demo seed failed:", error.message); process.exitCode = 1; });
