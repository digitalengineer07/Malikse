import { randomUUID } from "crypto";
import { RegionCount, RegionCountState } from "../models/RegionCount.model";
import { Property } from "../models/Property.model";
import { User } from "../models/User.model";
import { invalidatePublicResponses, publicBusy } from "./publicCacheGeneration";

const id = "public-regions-v1";
let timer: NodeJS.Timeout | undefined;
let work: Promise<void> | undefined;
let stopped = false;
let cached: { db: string; generation: string; expires: number } | undefined;

function schedule() {
  if (stopped || timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    void refreshRegionCounts().catch(() => { console.error("[RegionCounts] Refresh failed; will retry");schedule(); });
  }, 1000);
  timer.unref();
}

// Written before and after catalogue mutations, so a crash cannot silently lose a refresh.
export async function markRegionCountsDirty() {
  cached = undefined;
  await RegionCountState.updateOne({ _id: id }, { $inc: { revision: 1 }, $setOnInsert: { builtRevision: -1, generation: "" } }, { upsert: true });
  schedule();
}

export async function regionCountGeneration() {
  if (cached?.db === Property.db.name && cached.expires > Date.now()) return cached.generation;
  const state = await RegionCountState.findById(id).lean().maxTimeMS(1500);
  if (!state?.generation) { schedule();throw publicBusy(); }
  if (state.revision !== state.builtRevision) schedule();
  cached = { db: Property.db.name, generation: state.generation, expires: Date.now() + 1000 };
  return state.generation;
}

export function refreshRegionCounts(): Promise<void> {
  if (work) return work;
  work = rebuild().finally(() => { work = undefined; });
  return work;
}

async function rebuild() {
  if (Property.db.readyState !== 1 || stopped) return;
  const token = randomUUID();
  const state = await RegionCountState.findOneAndUpdate({
    _id: id, $expr: { $ne: ["$revision", "$builtRevision"] },
    $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: { $exists: false } }],
  }, { $set: { leaseToken: token, leaseUntil: new Date(Date.now() + 60_000) } }, { new: true }).lean();
  if (!state) { schedule();return; }
  const generation = randomUUID();
  let published = false;
  try {
    // Recount only in this background job, never in the map's request handler.
    // First collapse listings by owner/location/type to keep the owner join small.
    const buckets = await Property.aggregate([
      { $match: { status: "verified", "badges.fullyVerified": true, "advisorReview.decision": "approve", "verifierReview.decision": "approve" } },
      { $group: { _id: { owner: "$ownerId", state: "$location.state", district: "$location.district", pincode: { $ifNull: ["$location.pincode", ""] }, type: "$type" }, count: { $sum: 1 }, latSum: { $sum: "$location.lat" }, lngSum: { $sum: "$location.lng" } } },
      { $lookup: { from: User.collection.name, localField: "_id.owner", foreignField: "_id", pipeline: [{ $match: { isSuspended: { $ne: true }, isActive: { $ne: false } } }, { $project: { _id: 1 } }], as: "owner" } },
      { $match: { "owner.0": { $exists: true } } },
      { $group: { _id: { state: "$_id.state", district: "$_id.district", pincode: "$_id.pincode", type: "$_id.type" }, count: { $sum: "$count" }, latSum: { $sum: "$latSum" }, lngSum: { $sum: "$lngSum" } } },
    ]).option({ maxTimeMS: 30_000, allowDiskUse: true });
    const totals = new Map<string, any>();
    for (const bucket of buckets) {
      for (const propertyType of ["all", bucket._id.type]) {
        const { state = "", district = "", pincode = "" } = bucket._id;
        for (const [level, parentState, parentDistrict, key] of [
          ["state", "", "", state], ["district", state, "", district], ["pincode", state, district, pincode],
        ]) {
          const identity = JSON.stringify([level, parentState, parentDistrict, key, propertyType]);
          const value = totals.get(identity) || { level, state: parentState, district: parentDistrict, key, propertyType, count: 0, latSum: 0, lngSum: 0 };
          value.count += bucket.count;value.latSum += bucket.latSum;value.lngSum += bucket.lngSum;totals.set(identity, value);
        }
      }
    }
    const builtAt = new Date();
    const rows = [...totals.values()].map(({ latSum, lngSum, ...value }) => ({ ...value, generation, builtAt, lat: latSum / value.count, lng: lngSum / value.count }));
    for (let offset = 0; offset < rows.length; offset += 1000) {
      const renewed = await RegionCountState.updateOne({ _id: id, leaseToken: token, leaseUntil: { $gt: new Date() } }, { $set: { leaseUntil: new Date(Date.now() + 60_000) } });
      if (!renewed.matchedCount) throw new Error("Region count refresh lease expired");
      await RegionCount.insertMany(rows.slice(offset, offset + 1000));
    }
    const swap = await RegionCountState.updateOne({ _id: id, leaseToken: token, leaseUntil: { $gt: new Date() }, revision: state.revision }, {
      $set: { generation, builtRevision: state.revision, builtAt },
    });
    published = swap.modifiedCount === 1;
    if (published) {
      cached = undefined;invalidatePublicResponses();
      // Keep recent generations long enough for readers already using the old snapshot.
      await RegionCount.deleteMany({ generation: { $ne: generation }, builtAt: { $lt: new Date(Date.now() - 60_000) } });
    }
  } finally {
    if (!published) await RegionCount.deleteMany({ generation });
    await RegionCountState.updateOne({ _id: id, leaseToken: token }, { $unset: { leaseToken: 1, leaseUntil: 1 } });
    schedule();
  }
}

export async function startRegionCounts() {
  stopped = false;
  await Promise.all([RegionCount.createIndexes(), RegionCountState.createIndexes()]);
  await markRegionCountsDirty();
  await refreshRegionCounts();
}
export async function stopRegionCounts() {
  stopped = true;if (timer) clearTimeout(timer);timer = undefined;
  await work;
}
