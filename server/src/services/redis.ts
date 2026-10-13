import { createClient } from "redis";
import { performanceMetrics } from "./performanceMetrics";

const makeClient = () => createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true, socket: { connectTimeout: 500, reconnectStrategy: false } });
let client: ReturnType<typeof makeClient> | undefined;
let connecting: Promise<void> | undefined;
let retryAfter = 0;
function failed() {
  performanceMetrics.redisErrors++; retryAfter = Date.now() + 5000;
  const old = client; client = undefined; connecting = undefined;
  if (old?.isOpen) old.destroy();
}
async function deadline<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Redis deadline")), 100); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function connection() {
  if (!process.env.REDIS_URL || Date.now() < retryAfter) return undefined;
  if (!client) {
    const next = makeClient();
    next.on("error", () => {}); // No credentials or raw network errors in logs.
    client = next;
    connecting = next.connect().then(() => {});
  }
  if (connecting) await deadline(connecting);
  return client?.isReady ? client : undefined;
}
export async function redisGet(key: string): Promise<string | null> {
  try { const c = await connection(); return c ? await deadline(c.get(key)) : null; }
  catch { failed(); return null; }
}
export async function redisSet(key: string, value: string, ttlMS: number) {
  try { const c = await connection(); if (c) await deadline(c.set(key, value, { PX: Math.max(1, ttlMS) })); }
  catch { failed(); }
}
export function closeRedis() { if (client?.isOpen) client.destroy(); client = undefined; connecting = undefined; }
