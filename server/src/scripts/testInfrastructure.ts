import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import express from "express";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { AssignmentCursor } from "../models/AssignmentCursor.model";
import { searchMemory } from "../services/searchMemory";
import { SearchCache } from "../models/SearchCache.model";
import { availableStaff } from "../services/propertyWorkflow";
import { enqueueSubmission, processNextSubmission } from "../services/submissionQueue";
import { searchProperties } from "../services/propertySearch";
import { generateTokens } from "../services/security";
import propertyRoutes from "../routes/property.routes";

async function main() {
  const dbName = `malikse_infrastructure_test_${randomUUID().replace(/-/g, "")}`;
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", { dbName });
  const app = express(); app.use(express.json()); app.use("/properties", propertyRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    await Promise.all([Property.createIndexes(), SearchCache.createIndexes()]);
    const seller = await User.create({ name: "Seller", mobile: "9200000000", role: "user", demoKycComplete: true, passwordHash: "fixture" });
    const advisors = await User.create([1, 2, 3].map(i => ({ name: `Advisor ${i}`, mobile: `920000000${i}`, role: "advisor", passwordHash: "fixture" })));
    const verifier = await User.create({ name: "Verifier", mobile: "9200000004", role: "verifier", passwordHash: "fixture" });
    await User.create({ name: "Inactive", mobile: "9200000005", role: "advisor", isActive: false, passwordHash: "fixture" });
    await User.create({ name: "Suspended", mobile: "9200000006", role: "advisor", isSuspended: true, passwordHash: "fixture" });
    await User.create({ name: "No login", mobile: "9200000007", role: "advisor" });
    const allocations = await Promise.all(Array.from({ length: 30 }, () => availableStaff("advisor")));
    for (const advisor of advisors) assert.equal(allocations.filter(id => String(id) === String(advisor._id)).length, 10);
    assert.equal(String(await availableStaff("verifier")), String(verifier._id));
    assert.equal((await AssignmentCursor.findById("advisor"))!.sequence, 30);
    assert.equal((await AssignmentCursor.findById("verifier"))!.sequence, 1);
    // Corrections preserve an eligible prior reviewer without consuming a turn.
    assert.equal(String(await availableStaff("advisor", advisors[1]._id)), String(advisors[1]._id));
    assert.equal((await AssignmentCursor.findById("advisor"))!.sequence, 30);
    console.log("PASS: concurrent round-robin distribution, independent roles, inactive exclusion and correction continuity");

    const input = { ownerId: seller._id, type: "land", title: "Garden parcel", location: { state: "Bihar", district: "Patna", lat: 25.6, lng: 85.1 }, price: 100000, totalArea: 1000, sellableArea: 900, media: { photos: ["https://example.test/photo.jpg"] }, status: "draft" };
    const draft = await Property.create(input);
    const token = generateTokens(seller).accessToken;
    const submit = () => fetch(`${base}/properties/${draft._id}/submit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ consent: true }) });
    const responses = await Promise.all([submit(), submit()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [202, 409]);
    const queued = await Property.findById(draft._id);
    assert.equal(queued!.status, "queued");
    assert.match(queued!.submission!.digest, /^[a-f0-9]{64}$/);
    assert.equal((await fetch(`${base}/properties/${draft._id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ price: 2 }) })).status, 409);
    assert.equal((await fetch(`${base}/properties/${draft._id}`)).status, 404);
    const worked = await Promise.all(Array.from({ length: 8 }, () => processNextSubmission()));
    assert.equal(worked.filter(Boolean).length, 1);
    const processed = await Property.findById(draft._id);
    assert.equal(processed!.status, "pending");
    assert.equal(processed!.verificationHistory.filter(e => e.action === "submitted").length, 1);
    assert.equal(await processNextSubmission(), false);

    const abandoned = await Property.create(input);
    await enqueueSubmission(abandoned, { id: String(seller._id), role: "user" });
    await Property.updateOne({ _id: abandoned._id }, { $set: { "submission.leaseToken": "dead-worker", "submission.leaseUntil": new Date(Date.now() + 60_000) } });
    assert.equal(await processNextSubmission(), false);
    await Property.updateOne({ _id: abandoned._id }, { $set: { "submission.leaseUntil": new Date(0) } });
    await processNextSubmission();
    assert.equal((await Property.findById(abandoned._id))!.status, "pending");
    const staleWrite = await Property.updateOne({ _id: abandoned._id, status: "queued", "submission.leaseToken": "dead-worker" }, { $set: { status: "rejected" } });
    assert.equal(staleWrite.modifiedCount, 0);
    const failing = await Property.create(input);
    await enqueueSubmission(failing, { id: String(seller._id), role: "user" });
    await User.updateOne({ _id: seller._id }, { $set: { isSuspended: true } });
    await processNextSubmission();
    const retry = await Property.findById(failing._id);
    assert.equal(retry!.status, "queued");
    assert.equal(retry!.submission!.attempts, 1);
    assert.ok(retry!.submission!.nextAttemptAt.getTime() > Date.now());
    await Property.updateOne({ _id: failing._id }, { $set: { "submission.attempts": 4, "submission.nextAttemptAt": new Date(0) } });
    await processNextSubmission();
    assert.equal((await Property.findById(failing._id))!.status, "correction_required");
    await User.updateOne({ _id: seller._id }, { $set: { isSuspended: false } });
    console.log("PASS: atomic queue acceptance, duplicate rejection, edit locking, competing workers, expired lease recovery and bounded retries");

    const published = await Property.create({ ...input, status: "verified", badges: { fullyVerified: true }, advisorReview: { decision: "approve" }, verifierReview: { decision: "approve" } });
    const first = await searchProperties({ location: "Patna", type: "land", budgetMin: "1" });
    assert.equal(first.cacheHit, false); assert.equal(first.results.length, 1);
    const hit = await searchProperties({ location: "Patna", type: "land", minPrice: "01" });
    assert.equal(hit.cacheHit, true); assert.equal(hit.results.length, 1);
    for (const field of ["ownerId", "documents", "advisorReview", "submission"]) assert.equal((hit.results[0] as any)[field], undefined);
    assert.equal((await searchProperties({ type: "flat" })).results.length, 0);
    assert.equal((await searchProperties({ budgetMax: "10" })).results.length, 0);
    await User.updateOne({ _id: seller._id }, { $set: { isSuspended: true } });
    assert.equal((await searchProperties({ location: "Patna", type: "land", minPrice: "1" })).results.length, 0);
    await User.updateOne({ _id: seller._id }, { $set: { isSuspended: false } });
    await Property.updateOne({ _id: published._id }, { $set: { price: 123456 } });
    assert.equal((await searchProperties({ location: "Patna", type: "land", minPrice: "1" })).results[0].price, 123456);
    await Property.updateOne({ _id: published._id }, { $set: { status: "sold" } });
    assert.equal((await searchProperties({ location: "Patna", type: "land", minPrice: "1" })).results.length, 0);
    for (const bad of [{ type: { $ne: "land" } }, { minPrice: "NaN" }, { minPrice: "4", maxPrice: "3" }, { page: "-1" }, { limit: "101" }, { location: ["Patna"] }]) await assert.rejects(searchProperties(bad));
    await SearchCache.updateMany({}, { $set: { expiresAt: new Date(0) } });
    for (const entry of searchMemory.values()) entry.expires = 0;
    assert.equal((await searchProperties({ location: "Patna", type: "land", minPrice: "1" })).cacheHit, false);
    const more = await Property.create([1, 2, 3].map(i => ({ ...input, title: `Page fixture ${i}`, status: "verified", badges: { fullyVerified: true }, advisorReview: { decision: "approve" }, verifierReview: { decision: "approve" } })));
    await Property.updateMany({ _id: { $in: more.map(p => p._id) } }, { $set: { createdAt: new Date("2025-01-01") } }, { timestamps: false });
    const pageOne = await searchProperties({ page: "1", limit: "2" });
    const pageTwo = await searchProperties({ page: "2", limit: "2" });
    assert.equal(pageOne.results.length, 2); assert.equal(pageTwo.results.length, 1);
    assert.equal(new Set([...pageOne.results, ...pageTwo.results].map(p => String(p._id))).size, 3);
    // Cache failure must not make the authoritative database unavailable.
    const originalRead = SearchCache.findOne;
    const originalWrite = SearchCache.updateOne;
    try {
      (SearchCache as any).findOne = () => ({ lean: () => Promise.reject(new Error("Cache read unavailable")) });
      (SearchCache as any).updateOne = () => Promise.reject(new Error("Cache write unavailable"));
      assert.equal((await searchProperties({ location: "Patna" })).results.length, 3);
    } finally { SearchCache.findOne = originalRead; SearchCache.updateOne = originalWrite; }
    const indexes = await Property.listIndexes();
    for (const name of ["property_location_text", "property_type_newest", "property_price_newest", "property_submission_queue"]) assert.ok(indexes.some(i => i.name === name));
    const textPlan = await Property.find({ $text: { $search: "Patna" } }).explain("executionStats");
    assert.ok(JSON.stringify(textPlan).includes("property_location_text"));
    for (const [name, filter] of [["property_type_newest", { status: "verified", type: "land" }], ["property_price_newest", { status: "verified", price: { $gte: 1 } }]] as const) {
      const plan = await Property.find(filter).hint(name).explain("executionStats");
      assert.ok(JSON.stringify(plan).includes(name));
    }
    console.log("PASS: indexed search plans, hashed canonical cache keys, expiry, current prices, privacy on cache hits and filter validation");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    assert.ok(mongoose.connection.name.startsWith("malikse_infrastructure_test_"));
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
