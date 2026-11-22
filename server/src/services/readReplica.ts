// A replica-set URI is required. Keep this opt-in so standalone local MongoDB
// and existing installations continue to work without a secondary.
export function replicaReadPreference(): "secondary" | "primary" {
  return process.env.MONGO_READ_REPLICA === "true" && process.env.ALLOW_STALE_PUBLIC_READS === "true" ? "secondary" : "primary";
}
