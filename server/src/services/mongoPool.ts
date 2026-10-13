export function mongoPoolOptions() {
  const read = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw Error(`Invalid ${name}`);
    return value;
  };
  const maxPoolSize = read("MONGO_MAX_POOL_SIZE", 50, 1, 200);
  const minPoolSize = read("MONGO_MIN_POOL_SIZE", 0, 0, maxPoolSize);
  return { maxPoolSize, minPoolSize, maxConnecting: read("MONGO_MAX_CONNECTING", 2, 1, 10),
    waitQueueTimeoutMS: read("MONGO_WAIT_QUEUE_TIMEOUT_MS", 2000, 1, 10000),
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 20000 };
}
