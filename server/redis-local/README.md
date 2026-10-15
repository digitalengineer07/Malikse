# Local Redis read cache

Prerequisite: Docker Desktop with Linux containers running. From the repository root:

```powershell
docker compose -f server/compose.redis.yml up -d --wait
npm --prefix server run dev
```

The compose service runs six Redis processes (three primaries, each with one replica) in one container. It publishes only loopback ports 7000–7005. This is a development topology, not host-level high availability. Cluster addresses are loopback so the backend must run on the host. No cloud credentials are used.

Set REDIS_CLUSTER_NODES to redis://127.0.0.1:7000,redis://127.0.0.1:7001,redis://127.0.0.1:7002 in server/.env. It takes precedence over REDIS_URL. REDIS_READ_REPLICAS=true distributes read commands across primaries and replicas; replication is asynchronous, so immediate reads may miss a recent write. Set false for primary-only reads. Cache misses and Redis failures fall back to the existing database read path. Cache fills write to primaries with TTLs.

Existing public response cache eligibility and mutation invalidation are preserved. Production caching still requires PUBLIC_CACHE_SINGLE_WRITER=true; do not enable this for multiple writers. Cache namespaces are process-specific, so this change does not introduce shared cross-worker invalidation. Private routes are not added to the cache.

Check the running topology:

```powershell
docker compose -f server/compose.redis.yml exec redis-cluster redis-cli -p 7000 cluster info
docker compose -f server/compose.redis.yml exec redis-cluster redis-cli -p 7000 cluster nodes
```

Expect cluster_state:ok, cluster_slots_assigned:16384 and six nodes. Stop without deleting persisted data:

```powershell
docker compose -f server/compose.redis.yml down
```

The cluster bus stays inside the container. This unauthenticated local configuration must not be exposed on public interfaces.
