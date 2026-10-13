import { publicBusy } from "./publicCacheGeneration";
import { performanceMetrics as metrics } from "./performanceMetrics";

const bounded = (name: string, fallback: number, max: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max) throw Error(`Invalid ${name}`);
  return value;
};
const activeLimit = bounded("PUBLIC_READ_CONCURRENCY", 16, 100);
const queueLimit = bounded("PUBLIC_READ_QUEUE", 32, 200);
const waitMS = bounded("PUBLIC_READ_QUEUE_MS", 100, 2000);
const queue: Array<() => void> = [];
let active = 0;
export async function admitPublicRead<T>(work: () => Promise<T>): Promise<T> {
  if (active >= activeLimit) {
    if (queue.length >= queueLimit) { metrics.rejected++; throw publicBusy(); }
    await new Promise<void>((resolve, reject) => {
      const start = () => { clearTimeout(timer); active++; metrics.fillsQueued = queue.length; resolve(); };
      const timer = setTimeout(() => {
        const index = queue.indexOf(start); if (index >= 0) queue.splice(index, 1);
        metrics.fillsQueued = queue.length; metrics.rejected++; reject(publicBusy());
      }, waitMS);
      queue.push(start); metrics.fillsQueued = queue.length;
    });
  } else active++;
  metrics.fillsActive = active;
  try { return await work(); }
  finally { active--; queue.shift()?.(); metrics.fillsActive = active; metrics.fillsQueued = queue.length; }
}
