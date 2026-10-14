# Fastify property route experiment

`npm run dev` and `npm start` now run Fastify on the configured `PORT` (5000 by default).
These GET routes, including their HEAD equivalents, use native Fastify handlers:

- `/properties/search`
- `/properties/regions`
- `/properties/regions/suggest`
- `/properties/mine` (authenticated user)
- `/properties/:id/workspace` (authorized owner, assigned reviewer, or admin)
- `/properties/:id` (published verified property)

Other endpoints are handed to the existing Express application before body parsing.
The original `createApp` factory remains available as an Express baseline for comparisons.
The database queries, cache, compression, query validation and response formats are shared or preserved.

Run from the server directory using Node.js 20 or later:

```powershell
npm install
npm run build
npm start
```

Restart any existing server on port 5000 before benchmarking the new implementation.
In another PowerShell terminal, use the same settings and dataset as the Express baseline:

```powershell
$routes = @('/properties/search', '/properties/regions', '/properties/regions/suggest?q=Pat')
foreach ($route in $routes) {
  Write-Host "GET $route"
  .\node_modules\.bin\autocannon.cmd -c 10 -d 10 "http://localhost:5000$route"
}
```

Compare successful response throughput, latency and errors. Repeat warm-cache runs separately from cold-cache runs.
The integration suites exercise the Fastify listener and its Express fallback using disposable local MongoDB databases:

```powershell
npm run test:regions
npm run test:public-cache
npm run test:fastify-property-reads
```
