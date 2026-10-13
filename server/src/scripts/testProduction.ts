import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

process.env.CORS_ORIGINS = "https://app.example.test";
process.env.AUTH_LOGIN_LIMIT = "2";
process.env.REQUEST_LOGS = "false";
process.env.PUBLIC_API_URL = "https://api.example.test";
mongoose.set("bufferCommands", false);
const { createApp } = require("../app") as typeof import("../app");
const { User } = require("../models/User.model") as typeof import("../models/User.model");
const { Property } = require("../models/Property.model") as typeof import("../models/Property.model");
const { Deal } = require("../models/Deal.model") as typeof import("../models/Deal.model");
const { generateTokens } = require("../services/security") as typeof import("../services/security");

async function main() {
  const dbName = `malikse_production_test_${randomUUID().replace(/-/g, "")}`;
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", { dbName });
  let ready = true;
  const server = createApp(() => ready && mongoose.connection.readyState === 1).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const health = await fetch(`${base}/health`, { headers: { Origin: "https://app.example.test" } });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("Access-Control-Allow-Origin"), "https://app.example.test");
    assert.equal(health.headers.get("Cache-Control"), "no-store");
    assert.equal(health.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(health.headers.get("X-Powered-By"), null);
    assert.match(health.headers.get("X-Request-Id")!, /^[a-f0-9-]{36}$/);
    const denied = await fetch(`${base}/health`, { headers: { Origin: "https://untrusted.example" } });
    assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal((await fetch(`${base}/ready`)).status, 200);
    ready = false;
    assert.equal((await fetch(`${base}/ready`)).status, 503);
    ready = true;
    console.log("PASS: security headers, CORS allowlist, request IDs and readiness");

    for (const [body, status] of [["{broken", 400], [JSON.stringify({ data: "x".repeat(110000) }), 413]] as const) {
      const response = await fetch(`${base}/users/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
      assert.equal(response.status, status);
      assert.equal((await response.json() as any).stack, undefined);
    }
    for (const status of [400, 400, 429]) {
      const response = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(response.status, status);
      if (status === 429) assert.ok(Number(response.headers.get("Retry-After")) > 0);
    }
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/unknown`)).status, 404);
    console.log("PASS: bounded request bodies, malformed JSON, auth rate limits and isolated health route");

    const [admin, owner, buyer] = await User.create([
      { name: "Admin", mobile: "9100000001", role: "admin", passwordHash: "fixture" },
      { name: "Owner", mobile: "9100000002", role: "user", passwordHash: "fixture" },
      { name: "Buyer", mobile: "9100000003", role: "user", passwordHash: "fixture" },
    ]);
    const properties = await Property.insertMany(Array.from({ length: 200 }, (_, i) => ({
      ownerId: i % 2 ? owner._id : buyer._id, type: "land", status: i % 2 ? "draft" : "verified",
      location: { state: "Bihar", district: "Patna", lat: 25.6, lng: 85.1 }, price: 1000, totalArea: 100, sellableArea: 100,
    })));
    await Deal.create(["completed", "cancelled", "offered"].map(status => ({ propertyId: properties[0]._id, buyerId: buyer._id, ownerId: owner._id, offerAmount: 1000, commissionAmount: 12, status })));
    await Promise.all([User.createIndexes(), Property.createIndexes(), Deal.createIndexes()]);
    const token = generateTokens(admin).accessToken;
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(`${base}/admin/dashboard/summary`, { headers });
    assert.equal(response.status, 200);
    const summary = await response.json() as any;
    assert.deepEqual(summary.users, { total: 2, advisors: 0, verifiers: 0 });
    assert.equal(summary.properties.total, 200);
    assert.equal(summary.properties.draft, 100);
    assert.equal(summary.properties.verified, 100);
    assert.equal(summary.deals.active, 1);
    assert.equal(summary.financials.commissionEarned, 24);
    const plan = await Property.find({ ownerId: owner._id }).sort({ createdAt: -1 }).hint("property_owner_newest").explain("executionStats") as any;
    assert.equal(plan.executionStats.nReturned, 100);
    assert.equal(plan.executionStats.totalDocsExamined, 100);
    assert.ok(!JSON.stringify(plan.queryPlanner.winningPlan).includes('"stage":"SORT"'));
    assert.equal((await fetch(`${base}/admin/properties?status[$ne]=draft`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/admin/users/invalid/properties`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/deals/invalid`, { headers })).status, 400);
    await User.updateOne({ _id: admin._id }, { $set: { isSuspended: true } });
    assert.equal((await fetch(`${base}/auth/me`, { headers })).status, 403);
    console.log("PASS: summary counts/commission, indexed owner sort, query validation and immediate account revocation");

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    assert.equal((await fetch(`${base}/users/profile`, { headers })).status, 503);
    console.log("PASS: database outage returns 503 instead of logging the user out with 401");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (mongoose.connection.readyState === 1) {
      assert.equal(mongoose.connection.name, dbName);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
