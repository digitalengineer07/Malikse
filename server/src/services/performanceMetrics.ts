export const performanceMetrics = {
  requests: 0, completed: 0, aborted: 0, serverErrors: 0,
  l1Hits: 0, redisHits: 0, cacheMisses: 0, coalesced: 0, invalidated: 0,
  redisErrors: 0, fillsActive: 0, fillsQueued: 0, rejected: 0,
  poolCheckedOut: 0, poolFailures: 0, poolCheckouts: 0, poolWaitTotalMS: 0,
};
export function monitorPool(client: any) {
  client.on("connectionCheckedOut", (event: any) => {
    performanceMetrics.poolCheckedOut++; performanceMetrics.poolCheckouts++;
    performanceMetrics.poolWaitTotalMS += event.durationMS || 0;
  });
  client.on("connectionCheckedIn", () => { performanceMetrics.poolCheckedOut = Math.max(0, performanceMetrics.poolCheckedOut - 1); });
  client.on("connectionCheckOutFailed", () => { performanceMetrics.poolFailures++; });
}
