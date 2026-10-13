import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { mkdtemp, writeFile, unlink, rmdir } from "fs/promises";
import { tmpdir, cpus, totalmem } from "os";
import path from "path";
import { createApp } from "../app";
import { User } from "../models/User.model";
import { Property } from "../models/Property.model";
import { SearchCache } from "../models/SearchCache.model";
import { generateTokens } from "../services/security";

async function main() {
  const dbName = `malikse_benchmark_${randomUUID().replace(/-/g, "")}`;
  const temp = await mkdtemp(path.join(tmpdir(), "malikse-k6-"));
  const fixturePath = path.join(temp, "fixtures.json");
  const loadDir = path.resolve(__dirname, "../../load");
  let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/malikse", { dbName, maxPoolSize: 50, waitQueueTimeoutMS: 2000, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 20000, autoIndex: false });
    const users = await User.insertMany(Array.from({ length: 200 }, (_, i) => ({ name: `Benchmark user ${i}`, mobile: String(9100000000 + i), role: "user", passwordHash: "load-fixture-not-a-real-password", demoKycComplete: true })));
    const admin = await User.create({ name: "Benchmark admin", mobile: "9100000999", role: "admin", passwordHash: "load-fixture-not-a-real-password" });
    const properties = await Property.insertMany(Array.from({ length: 10000 }, (_, i) => ({
      ownerId: users[i % users.length]._id, title: `Benchmark property ${i}`, type: ["land", "flat", "house", "shop", "office"][i % 5],
      location: { state: "Bihar", district: "Patna", lat: 25.6, lng: 85.1 }, price: 100000 + i * 100,
      totalArea: 1000, sellableArea: 900, status: "verified", badges: { fullyVerified: true },
      advisorReview: { decision: "approve" }, verifierReview: { decision: "approve" },
    })));
    await Promise.all([User.createIndexes(), Property.createIndexes(), SearchCache.createIndexes()]);
    await writeFile(fixturePath, JSON.stringify({ tokens: users.map(user => generateTokens(user).accessToken), adminToken: generateTokens(admin).accessToken, propertyIds: properties.slice(0, 200).map(property => String(property._id)), propertyCount: properties.length }));
    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server!.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    await writeFile(path.join(loadDir, "production-environment.json"), JSON.stringify({ node: process.version, platform: process.platform, logicalCpus: cpus().length, cpu: cpus()[0]?.model, memoryGB: Math.round(totalmem() / 1024 ** 3), users: users.length, properties: properties.length, rate: Number(process.env.RPS || 50), duration: process.env.DURATION || "30s", note: "One API process; local MongoDB and k6 on the same machine. Read workload; no login/password hashing, uploads or worker activity." }, null, 2));
    console.log(`Benchmarking one API process with ${properties.length} properties and ${users.length} accounts`);
    const code = await new Promise<number>((resolve, reject) => {
      const child = spawn(process.platform === "win32" ? "k6.exe" : "k6", ["run", "--quiet", "--summary-export", path.join(loadDir, "production-baseline.json"), path.join(loadDir, "production.js")], { stdio: "inherit", env: { ...process.env, BASE_URL: base, FIXTURE_PATH: fixturePath } });
      child.once("error", reject);
      child.once("exit", code => resolve(code ?? 1));
    });
    if (code) process.exitCode = code;
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (mongoose.connection.readyState === 1) {
      if (mongoose.connection.name !== dbName) throw new Error("Refusing to clean an unexpected database");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    await unlink(fixturePath).catch(() => undefined);
    await rmdir(temp);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
