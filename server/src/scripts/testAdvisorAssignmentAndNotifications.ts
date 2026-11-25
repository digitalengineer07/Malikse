import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import authRoutes from "../routes/auth.routes";
import propertyRoutes from "../routes/property.routes";
import verificationRoutes from "../routes/advisor.routes";
import adminRoutes from "../routes/admin.routes";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { Notification } from "../models/Notification.model";
import { processNextSubmission } from "../services/submissionQueue";

async function run() {
  console.log("=== Testing Advisor Unique ID & Dual Notification System ===");
  const dbName = `notif_${Date.now().toString(36)}`;
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/malikse", { dbName });

  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.use("/properties", propertyRoutes);
  app.use("/verification", verificationRoutes);
  app.use("/admin", adminRoutes);

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  const request = async (route: string, token?: string, body?: object, expected = 200, method = body ? "POST" : "GET") => {
    const response = await fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data: any = await response.json();
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  };

  const password = "Fixture-R8!pW3qZ2026";
  const passwordHash = await bcrypt.hash(password, 10);
  const login = async (mobile: string) => (await request("/auth/login", undefined, { mobile, password })).accessToken;

  try {
    // 1. Create Advisor 1 (General coverage)
    const adv1 = await User.create({
      name: "Sunil Advisor",
      mobile: "9111111101",
      role: "advisor",
      advisorCode: "ADV-888888",
      assignedDistricts: [],
      passwordHash,
      isActive: true,
    });

    // 2. Create Advisor 2 (Ranchi district specialist)
    const adv2 = await User.create({
      name: "Ranchi Advisor",
      mobile: "9111111102",
      role: "advisor",
      advisorCode: "ADV-777777",
      assignedDistricts: ["Ranchi"],
      passwordHash,
      isActive: true,
    });

    // 3. Create Seller
    const seller = await User.create({
      name: "Property Owner",
      mobile: "9111111103",
      role: "user",
      isVerifiedIdentity: true,
      passwordHash,
      isActive: true,
    });
    const sellerToken = await login("9111111103");

    console.log("✓ Fixtures created: 2 advisors with unique codes and 1 KYC verified seller");

    // -------------------------------------------------------------
    // Test 1: Seller lists property and enters specific Advisor ID ADV-888888
    // -------------------------------------------------------------
    console.log("Test 1: Submitting with client-requested Advisor ID ADV-888888...");
    const prop1Draft = await request("/properties", sellerToken, {
      title: "Luxury 3BHK Apartment in Patna",
      description: "Spacious apartment with all amenities and clear title deeds.",
      type: "flat",
      location: {
        state: "Bihar",
        district: "Patna",
        block: "Sadar",
        address: "Bailey Road, Patna",
        lat: 25.61,
        lng: 85.13,
      },
      price: 6500000,
      totalArea: 1650,
      sellableArea: 1500,
      bedrooms: 3,
      bathrooms: 2,
      furnishing: "semi-furnished",
      requestedAdvisorCode: "adv-888888", // lowercase should be normalized
    }, 201);

    // Attach required photo directly
    await Property.updateOne({ _id: prop1Draft._id }, { $set: { "media.photos": ["https://example.com/p1.jpg"] } });

    assert.equal(prop1Draft.status, "draft");

    // Submit property for verification
    const submitRes = await request(`/properties/${prop1Draft._id}/submit`, sellerToken, { consent: true }, 202);
    assert.equal(submitRes.status, "queued");

    // Process submission queue
    const processed = await processNextSubmission();
    assert.equal(processed, true);

    // Verify property assignment in DB
    const prop1Updated = await Property.findById(prop1Draft._id);
    assert.equal(prop1Updated?.status, "pending");
    assert.equal(prop1Updated?.assignedAdvisorId?.toString(), adv1._id.toString());
    console.log("✓ Property automatically assigned to requested Advisor Sunil (ADV-888888)");

    // Verify Notifications created for BOTH Seller and Advisor
    const sellerNotif = await Notification.findOne({
      recipient: seller._id,
      "data.id": prop1Draft._id.toString(),
    });
    assert.ok(sellerNotif, "Seller notification must exist in database");
    assert.match(sellerNotif.title || "", /Property Assigned/i);
    assert.match(sellerNotif.body || "", /ADV-888888/);
    console.log(`✓ Seller notification verified: "${sellerNotif.title}" - "${sellerNotif.body}"`);

    const advisorNotif = await Notification.findOne({
      recipient: adv1._id,
      "data.id": prop1Draft._id.toString(),
    });
    assert.ok(advisorNotif, "Advisor notification must exist in database");
    assert.match(advisorNotif.title || "", /New Property Assigned/i);
    assert.match(advisorNotif.body || "", /Luxury 3BHK Apartment in Patna/);
    console.log(`✓ Advisor notification verified: "${advisorNotif.title}" - "${advisorNotif.body}"`);

    // -------------------------------------------------------------
    // Test 2: Blank Advisor ID -> District-first auto-assignment to Ranchi Advisor
    // -------------------------------------------------------------
    console.log("Test 2: Submitting with blank Advisor ID in Ranchi district...");
    const prop2Draft = await request("/properties", sellerToken, {
      title: "Commercial Plot in Ranchi Main Road",
      description: "Prime commercial land suitable for retail showroom or bank.",
      type: "land",
      location: {
        state: "Jharkhand",
        district: "Ranchi",
        block: "Town",
        address: "Main Road Ranchi",
        lat: 23.34,
        lng: 85.30,
      },
      price: 12000000,
      totalArea: 5000,
      sellableArea: 4800,
    }, 201);

    await Property.updateOne({ _id: prop2Draft._id }, { $set: { "media.photos": ["https://example.com/p2.jpg"] } });

    await request(`/properties/${prop2Draft._id}/submit`, sellerToken, { consent: true }, 202);
    await processNextSubmission();

    const prop2Updated = await Property.findById(prop2Draft._id);
    assert.equal(prop2Updated?.status, "pending");
    assert.equal(prop2Updated?.assignedAdvisorId?.toString(), adv2._id.toString());
    console.log("✓ Blank ID property automatically matched by district to Ranchi Advisor (ADV-777777)");

    // Both seller and Ranchi advisor notified
    const prop2SellerNotif = await Notification.findOne({
      recipient: seller._id,
      "data.id": prop2Draft._id.toString(),
    });
    assert.ok(prop2SellerNotif);
    assert.match(prop2SellerNotif.body || "", /ADV-777777/);

    const prop2AdvisorNotif = await Notification.findOne({
      recipient: adv2._id,
      "data.id": prop2Draft._id.toString(),
    });
    assert.ok(prop2AdvisorNotif);
    assert.match(prop2AdvisorNotif.title || "", /New Property Assigned/i);
    console.log("✓ Both seller and district-matched advisor received notifications");

    // -------------------------------------------------------------
    // Test 3: Invalid Advisor Code is rejected with helpful message
    // -------------------------------------------------------------
    console.log("Test 3: Submitting with invalid Advisor ID...");
    const prop3Draft = await request("/properties", sellerToken, {
      title: "Farm Land near Patna",
      description: "Agricultural land.",
      type: "land",
      location: {
        state: "Bihar",
        district: "Patna",
        lat: 25.6,
        lng: 85.1,
      },
      price: 3000000,
      totalArea: 10000,
      sellableArea: 10000,
      requestedAdvisorCode: "ADV-999999", // non-existent
    }, 201);

    await Property.updateOne({ _id: prop3Draft._id }, { $set: { "media.photos": ["https://example.com/p3.jpg"] } });

    await request(`/properties/${prop3Draft._id}/submit`, sellerToken, { consent: true }, 400);
    console.log("✓ Invalid Advisor ID properly rejected with 400 status");

    console.log("=== ALL ADVISOR ASSIGNMENT & NOTIFICATION TESTS PASSED! ===");
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
