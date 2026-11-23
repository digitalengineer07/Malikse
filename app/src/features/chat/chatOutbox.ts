import type { ChatMessage } from "./chatTypes";

export interface Outgoing {
  id: string;
  key: string;
  thread: string;
  text: string;
  createdAt: string;
  attempts: number;
  retryAt: number;
  failure?: string;
}

interface Transport {
  read(): Promise<Outgoing[]>;
  save(items: Outgoing[]): Promise<void>;
  send(item: Outgoing, signal: AbortSignal): Promise<ChatMessage>;
  classify(error: unknown, attempts: number): { delay: number } | { failure: string };
}

/** Persist the key before POSTing. A restart after commit can safely replay the same send. */
export class ChatOutbox {
  private transport: Transport;
  private items: Outgoing[] = [];
  private listeners = new Set<() => void>();
  private deliveries = new Set<(thread: string, message: ChatMessage) => void>();
  private writes = Promise.resolve();
  private loaded = false;
  private running = false;
  private active = false;
  private closed = false;
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;

  constructor(transport: Transport) { this.transport = transport; }
  snapshot = () => this.items;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  onDelivered(listener: (thread: string, message: ChatMessage) => void) {
    this.deliveries.add(listener);
    return () => { this.deliveries.delete(listener); };
  }
  private change(update?: (items: Outgoing[]) => Outgoing[]) {
    const write = this.writes.then(async () => {
      if (this.closed) throw new Error("Session ended");
      if (!this.loaded) {
        this.items = await this.transport.read();
        this.loaded = true;
        this.listeners.forEach(fn => fn());
      }
      if (update) {
        const next = update(this.items);
        if (next === this.items) return;
        await this.transport.save(next);
        this.items = next;
        this.listeners.forEach(fn => fn());
      }
    });
    this.writes = write.catch(() => {});
    return write;
  }
  async enqueue(item: Outgoing) {
    await this.change(items => items.some(row => row.id === item.id) ? items : [...items, item]);
    this.schedule(0);
  }
  async retry(id: string) {
    await this.change(items => items.map(row => row.id === id ? { ...row, attempts: 0, retryAt: 0, failure: undefined } : row));
    this.schedule(0);
  }
  async reconcile(thread: string, messages: ChatMessage[]) {
    const ids = new Set(messages.map(message => message._id));
    await this.change(items => items.some(row => row.thread === thread && ids.has(row.id))
      ? items.filter(row => row.thread !== thread || !ids.has(row.id)) : items);
    this.schedule(0);
  }
  setActive(active: boolean) {
    this.active = active;
    this.schedule(0);
  }
  close() {
    this.closed = true;
    this.controller.abort();
    clearTimeout(this.timer);
    return this.writes;
  }
  private schedule(delay: number) {
    clearTimeout(this.timer);
    if (this.active && !this.closed && !this.running) {
      this.timer = setTimeout(() => void this.drain(), Math.min(2147483647, Math.max(0, delay)));
    }
  }
  private async drain() {
    if (!this.active || this.closed || this.running) return;
    this.running = true;
    let nextDelay: number | undefined;
    try {
      await this.change();
      while (this.active && !this.closed) {
        // Preserve send order within a conversation while another thread is offline.
        const threads = new Set<string>();
        let head: Outgoing | undefined;
        nextDelay = undefined;
        for (const item of this.items) {
          if (item.failure || threads.has(item.thread)) continue;
          threads.add(item.thread);
          const delay = item.retryAt - Date.now();
          if (delay <= 0) { head = item; break; }
          nextDelay = Math.min(nextDelay ?? delay, delay);
        }
        if (!head) break;
        const item = head;
        let saved: ChatMessage;
        try {
          saved = await this.transport.send(item, this.controller.signal);
        } catch (error) {
          if (this.closed) break;
          const outcome = this.transport.classify(error, item.attempts);
          await this.change(items => items.map(row => row.id !== item.id ? row : {
            ...row, attempts: row.attempts + 1,
            retryAt: "delay" in outcome ? Date.now() + outcome.delay : 0,
            failure: "failure" in outcome ? outcome.failure : undefined,
          }));
          continue;
        }
        if (this.closed) break;
        this.deliveries.forEach(fn => fn(item.thread, saved));
        await this.change(items => items.filter(row => row.id !== item.id));
      }
    } catch {
      // A keystore failure must never discard a pending entry or start a tight loop.
      nextDelay = 5000;
    } finally {
      this.running = false;
      if (nextDelay !== undefined) this.schedule(nextDelay);
    }
  }
}
