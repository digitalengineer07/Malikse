import type { ChatConversation } from "./chatTypes";

type InboxState = { rows?: ChatConversation[]; failures: number; retryAfter?: string; status?: number };

export class InboxFeed {
  private state: InboxState = { failures: 0 };
  private listeners = new Set<() => void>();
  private pending?: Promise<void>;
  private fetchRows: () => Promise<ChatConversation[]>;

  constructor(fetchRows: () => Promise<ChatConversation[]>) { this.fetchRows = fetchRows; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  refresh = (): Promise<void> => {
    if (this.pending) return this.pending;
    this.pending = this.fetchRows().then(rows => {
      this.state = { rows, failures: 0 };
    }).catch(error => {
      this.state = { rows: this.state.rows, failures: this.state.failures + 1, status: error?.response?.status,
        retryAfter: error?.response?.headers?.["retry-after"] };
    }).finally(() => {
      this.pending = undefined;
      this.listeners.forEach(listener => listener());
    });
    return this.pending;
  };
}
