import { randomUUID } from "node:crypto";
import type { Response } from "express";

// Only a wake-up hint lives in memory. MongoDB stays authoritative across
// process restarts, cache eviction and missed signals.
type Channel = { cursor: string; listeners: Set<() => void> };
const channels = new Map<string, Channel>();
const active = new Map<string, number>();
let held = 0;

export function chatCursor(thread: string, actor: string) {
  const key = thread + "/" + actor;
  let channel = channels.get(key);
  if (!channel) {
    if (channels.size >= 4096) {
      for (const [oldKey, old] of channels) {
        if (!old.listeners.size) { channels.delete(oldKey); break; }
      }
    }
    channel = { cursor: randomUUID(), listeners: new Set() };
  }
  channels.delete(key);
  channels.set(key, channel);
  return channel.cursor;
}

export function wakeChat(thread: string, actor: string) {
  const channel = channels.get(thread + "/" + actor);
  if (!channel) return;
  channel.cursor = randomUUID();
  for (const finish of channel.listeners) finish();
}

export async function waitForChat(thread: string, actor: string, cursor: string, res: Response) {
  const channel = channels.get(thread + "/" + actor);
  if (!channel || channel.cursor !== cursor) return "changed";
  // Reserve connections for sends and other routes on shared hosting.
  if (held >= 24 || (active.get(actor) ?? 0) >= 2) return "busy";
  held++;
  active.set(actor, (active.get(actor) ?? 0) + 1);
  await new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      res.off("close", finish);
      channel.listeners.delete(finish);
      resolve();
    };
    const timer = setTimeout(finish, 20000);
    channel.listeners.add(finish);
    res.once("close", finish);
    if (res.destroyed) finish();
  });
  held--;
  const remaining = active.get(actor)! - 1;
  if (remaining) active.set(actor, remaining);
  else active.delete(actor);
  return "waited";
}
