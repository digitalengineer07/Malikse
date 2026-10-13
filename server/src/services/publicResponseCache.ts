import { createHash } from "crypto";
import { promisify } from "util";
import { gzip, brotliCompress, constants } from "zlib";
import type { Request, Response } from "express";
import { publicCacheBoot, publicGeneration, assertPublicGeneration, onPublicInvalidation, publicBusy } from "./publicCacheGeneration";
import { searchMemory, PublicSnapshot } from "./searchMemory";
import { redisGet, redisSet } from "./redis";
import { admitPublicRead } from "./publicReadAdmission";
import { performanceMetrics as metrics } from "./performanceMetrics";

const zip = promisify(gzip), brotli = promisify(brotliCompress);
const memoryLimit = 32 * 1024 * 1024;
const entryLimit = 512 * 1024;
let memoryBytes = 0;
let waiting = 0;
const pending = new Map<string, { promise: Promise<PublicSnapshot>; waiters: number }>();
onPublicInvalidation(() => { searchMemory.clear(); memoryBytes = 0; metrics.invalidated++; });
export function responseCachingEnabled() {
  return process.env.PUBLIC_RESPONSE_CACHE_ENABLED !== "false" &&
    (process.env.NODE_ENV !== "production" || process.env.PUBLIC_CACHE_SINGLE_WRITER === "true");
}
function remember(key: string, entry: PublicSnapshot) {
  if (entry.bytes > entryLimit) return;
  const old = searchMemory.get(key); if (old) { memoryBytes -= old.bytes; searchMemory.delete(key); }
  while (searchMemory.size && (memoryBytes + entry.bytes > memoryLimit || searchMemory.size >= 512)) {
    const first = searchMemory.keys().next().value!;
    memoryBytes -= searchMemory.get(first)!.bytes; searchMemory.delete(first);
  }
  searchMemory.set(key, entry); memoryBytes += entry.bytes;
}
async function serialize(value: { data: unknown; nextCursor?: string; status?: number }): Promise<PublicSnapshot> {
  const body = Buffer.from(JSON.stringify(value.data));
  const ttl = value.status === 404 || (Array.isArray(value.data) && !value.data.length) ? 2000 : 15000 + Math.floor(Math.random() * 1500);
  const entry: PublicSnapshot = { body, nextCursor: value.nextCursor || "", status: value.status || 200, expires: Date.now() + ttl, localUntil: Date.now() + (process.env.REDIS_URL ? 2000 : ttl), bytes: body.length + 256 };
  if (body.length >= 1024 && process.env.PUBLIC_JSON_COMPRESSION !== "false") {
    // Compression runs once per fill and is included in the bounded fill concurrency.
    entry.gzip = await zip(body, { level: 1 });
    entry.br = await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
    entry.bytes += entry.gzip.length + entry.br.length;
  }
  return entry;
}
function encode(entry: PublicSnapshot) {
  return JSON.stringify({ ...entry, body: entry.body.toString("base64"), gzip: entry.gzip?.toString("base64"), br: entry.br?.toString("base64") });
}
function decode(raw: string): PublicSnapshot | undefined {
  if (raw.length > 1024 * 1024) return;
  try {
    const value = JSON.parse(raw);
    if (![200, 404].includes(value.status) || typeof value.body !== "string" || typeof value.nextCursor !== "string" || value.nextCursor.length > 200 || !Number.isFinite(value.expires) || value.expires <= Date.now()) return;
    const entry: PublicSnapshot = { ...value, body: Buffer.from(value.body, "base64"), gzip: value.gzip ? Buffer.from(value.gzip, "base64") : undefined, br: value.br ? Buffer.from(value.br, "base64") : undefined, localUntil: Date.now() + 2000 };
    entry.bytes = entry.body.length + (entry.gzip?.length || 0) + (entry.br?.length || 0) + 256;
    return entry.bytes <= entryLimit ? entry : undefined;
  } catch { return; }
}
export interface PublicResponse { entry: PublicSnapshot; generation: number; cacheHit: boolean }
export async function publicResponse(keyParts: unknown, fill: () => Promise<{ data: unknown; nextCursor?: string; status?: number }>): Promise<PublicResponse> {
  const generation = publicGeneration();
  const enabled = responseCachingEnabled();
  const hash = createHash("sha256").update(JSON.stringify(keyParts)).digest("hex");
  const key = `public:v3:${publicCacheBoot}:${generation}:${hash}`;
  const local = enabled ? searchMemory.get(key) : undefined;
  if (local && local.expires > Date.now() && local.localUntil > Date.now()) {
    searchMemory.delete(key); searchMemory.set(key, local); metrics.l1Hits++;
    return { entry: local, generation, cacheHit: true };
  }
  let task = pending.get(key);
  let cacheHit = false;
  if (waiting >= 2048) { metrics.rejected++; throw publicBusy(); }
  if (task) {
    if (task.waiters >= 2000) { metrics.rejected++; throw publicBusy(); }
    task.waiters++; metrics.coalesced++;
  } else {
    if (pending.size >= 64) { metrics.rejected++; throw publicBusy(); }
    const promise = (async () => {
      if (enabled) {
        const raw = await redisGet(key);
        const entry = raw ? decode(raw) : undefined;
        assertPublicGeneration(generation);
        if (entry) { metrics.redisHits++; cacheHit = true; remember(key, entry); return entry; }
      }
      metrics.cacheMisses++;
      const entry = await admitPublicRead(async () => {
        assertPublicGeneration(generation);
        return serialize(await fill());
      });
      assertPublicGeneration(generation);
      if (enabled && entry.bytes <= entryLimit) {
        remember(key, entry);
        // Old writes can only populate an old generation key; it is never reused.
        void redisSet(key, encode(entry), entry.expires - Date.now());
      }
      return entry;
    })();
    task = { promise, waiters: 1 }; pending.set(key, task);
    void promise.finally(() => pending.delete(key)).catch(() => {});
  }
  waiting++;
  try {
    const entry = await task.promise; assertPublicGeneration(generation);
    return { entry, generation, cacheHit };
  } finally { task.waiters--; waiting--; }
}
export function sendPublicResponse(req: Request, res: Response, value: PublicResponse) {
  assertPublicGeneration(value.generation);
  if (res.destroyed) return;
  const entry = value.entry;
  const choices = [...(entry.br ? ["br"] : []), ...(entry.gzip ? ["gzip"] : []), "identity"];
  const encoding = req.headers["accept-encoding"] ? req.acceptsEncodings(...choices) : "identity";
  res.vary("Accept-Encoding");
  res.setHeader("Cache-Control", "no-store");
  if (!encoding) { res.status(406).end(); return; }
  const body = encoding === "br" ? entry.br! : encoding === "gzip" ? entry.gzip! : entry.body;
  res.setHeader("X-Next-Cursor", entry.nextCursor);
  res.setHeader("X-Search-Cache", value.cacheHit ? "HIT" : "MISS");
  if (encoding !== "identity") res.setHeader("Content-Encoding", encoding);
  res.setHeader("Content-Length", body.length);
  res.status(entry.status).type("application/json").end(body);
}
