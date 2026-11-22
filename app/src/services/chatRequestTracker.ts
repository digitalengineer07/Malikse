export interface TrackedRequest {
  id: number;
  method: string;
  url: string;
  startTime: number;
  durationMs?: number;
  status?: number;
  error?: string;
}

class ChatRequestTracker {
  private activeMessageId: string | null = null;
  private messageRequests: TrackedRequest[] = [];
  private requestCounter = 0;

  startMessage(messageText: string) {
    this.activeMessageId = `${Date.now()}-${messageText.slice(0, 20)}`;
    this.messageRequests = [];
    console.log(`\n======================================================`);
    console.log(`[APP CHAT TRACKER] >>> USER INITIATED SEND MESSAGE: "${messageText}"`);
    console.log(`[APP CHAT TRACKER] >>> Tracking all subsequent requests...`);
    console.log(`======================================================\n`);
  }

  recordRequest(method: string, url: string): number {
    this.requestCounter++;
    const req: TrackedRequest = {
      id: this.requestCounter,
      method: (method || 'GET').toUpperCase(),
      url: url || '',
      startTime: Date.now(),
    };
    if (this.activeMessageId) {
      this.messageRequests.push(req);
      console.log(`[APP CHAT REQ #${this.messageRequests.length}] (Global #${this.requestCounter}) --> ${req.method} ${req.url}`);
    } else {
      console.log(`[APP HTTP REQ #${this.requestCounter}] --> ${req.method} ${req.url}`);
    }
    return this.requestCounter;
  }

  recordResponse(reqId: number, status: number, method?: string, url?: string) {
    const tracked = this.messageRequests.find(r => r.id === reqId);
    const duration = tracked ? Date.now() - tracked.startTime : 0;
    if (tracked) {
      tracked.durationMs = duration;
      tracked.status = status;
      console.log(`[APP CHAT RES] <-- ${status} ${tracked.method} ${tracked.url} (${duration}ms)`);
    } else {
      console.log(`[APP HTTP RES] <-- ${status} ${method || ''} ${url || ''}`);
    }
  }

  recordError(reqId: number, error: any, method?: string, url?: string) {
    const tracked = this.messageRequests.find(r => r.id === reqId);
    const duration = tracked ? Date.now() - tracked.startTime : 0;
    const status = error.response?.status || 'ERR';
    const message = error.response?.data?.message || error.message;
    if (tracked) {
      tracked.durationMs = duration;
      tracked.status = error.response?.status;
      tracked.error = message;
      console.error(`[APP CHAT ERR] <-- ${status} ${tracked.method} ${tracked.url} (${duration}ms): ${message}`);
    } else {
      console.error(`[APP HTTP ERR] <-- ${status} ${method || ''} ${url || ''}: ${message}`);
    }
  }

  finishMessage(messageText: string) {
    const totalCount = this.messageRequests.length;
    const summary = {
      message: messageText,
      totalRequests: totalCount,
      requests: [...this.messageRequests],
    };
    console.log(`\n======================================================`);
    console.log(`[APP CHAT TRACKER] <<< FINISHED SENDING MESSAGE: "${messageText}"`);
    console.log(`[APP CHAT TRACKER] <<< TOTAL HTTP REQUESTS FOR THIS 1 MESSAGE: ${totalCount}`);
    this.messageRequests.forEach((r, idx) => {
      console.log(`   ${idx + 1}. [${r.status || 'PENDING'}] ${r.method} ${r.url} (${r.durationMs || 0}ms)`);
    });
    console.log(`======================================================\n`);
    this.activeMessageId = null;
    return summary;
  }

  getActiveMessage(): string | null {
    return this.activeMessageId;
  }
}

export const chatTracker = new ChatRequestTracker();

