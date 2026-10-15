import { createClient, createCluster } from "redis";
import { performanceMetrics } from "./performanceMetrics";

export function redisConfigured() {
  return Boolean(process.env.REDIS_CLUSTER_NODES?.trim() || process.env.REDIS_URL);
}
function timeout(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function makeClient() {
  const socket = { connectTimeout: timeout("REDIS_CONNECT_TIMEOUT_MS", 3000), reconnectStrategy: false as const };
  const nodes = process.env.REDIS_CLUSTER_NODES?.split(",").map(value => value.trim()).filter(Boolean);
  if (nodes?.length) {
    return createCluster({
      rootNodes: nodes.map(url => ({ url })),
      defaults: {
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        disableOfflineQueue: true,
        socket: { ...socket, ...(nodes.every(url => url.startsWith("rediss://")) ? { tls: true as const } : {}) },
      },
      useReplicas: process.env.REDIS_READ_REPLICAS === "true",
    });
  }
  return createClient({ url: process.env.REDIS_URL, disableOfflineQueue: true, socket });
}
type Client = ReturnType<typeof makeClient>;
let state: { client: Client; ready: Promise<void> } | undefined;
let retryAfter = 0;
function failed(expected: typeof state) {
  if (!expected || state !== expected) return;
  performanceMetrics.redisErrors++;
  retryAfter = Date.now() + 5000;
  state = undefined;
  if (expected.client.isOpen) expected.client.destroy();
}
async function deadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("Redis deadline")), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}
async function run<T>(operation: (client: Client) => Promise<T>, fallback: T): Promise<T> {
  if (!redisConfigured() || Date.now() < retryAfter) return fallback;
  let current = state;
  try {
    if (!current) {
      const client = makeClient();
      client.on("error", () => {}); // Never log credentials or raw network errors.
      current = { client, ready: client.connect().then(() => {}) };
      state = current;
    }
    await deadline(current.ready, timeout("REDIS_CONNECT_TIMEOUT_MS", 3000));
    return await deadline(operation(current.client), timeout("REDIS_COMMAND_TIMEOUT_MS", 250));
  } catch { failed(current); return fallback; }
}
export function redisGet(key: string): Promise<string | null> {
  return run(client => client.get(key), null);
}
export async function redisSet(key: string, value: string, ttlMS: number) {
  if (!Number.isFinite(ttlMS) || ttlMS <= 0) return;
  await run(client => client.set(key, value, { PX: Math.max(1, Math.floor(ttlMS)) }), null);
}
export function closeRedis() {
  const old = state; state = undefined; retryAfter = 0;
  if (old?.client.isOpen) old.client.destroy();
}
