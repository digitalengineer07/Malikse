import { randomUUID } from "crypto";

// A new namespace on every boot prevents reuse after a crash during a write.
export const publicCacheBoot = randomUUID();
let generation = 0;
let writers = 0;
const listeners = new Set<() => void>();
export const publicBusy = () => Object.assign(new Error("Search is busy. Please try again shortly."), { status: 503 });
export function onPublicInvalidation(listener: () => void) { listeners.add(listener); }
export function invalidatePublicResponses() { generation++; for (const listener of listeners) listener(); }
export function publicGeneration() { if (writers) throw publicBusy(); return generation; }
export function assertPublicGeneration(expected: number) { if (writers || generation !== expected) throw publicBusy(); }
export function beginPublicMutation() {
  writers++; invalidatePublicResponses();
  let ended = false;
  return () => { if (!ended) { ended = true; invalidatePublicResponses(); writers--; } };
}
