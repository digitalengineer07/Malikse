// Local-only aggregate traffic model: 10,000 anonymous home visitors, 1 request/s each.
const autocannon = require('autocannon');
const fs = require('fs');
const os = require('os');
const memoryFloorMiB=Number(process.env.LOAD_MEMORY_FLOOR_MIB||150);
if(!Number.isFinite(memoryFloorMiB)||memoryFloorMiB<150)throw Error('Invalid memory floor');

if (!process.env.BASE_URL || !process.env.SUMMARY_FILE) throw Error('BASE_URL and SUMMARY_FILE are required');
if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.BASE_URL).hostname)) throw Error('Local benchmark only');
if (os.freemem() < 250 * 1024 * 1024) throw Error('Insufficient free RAM to start bounded 10,000 RPS attempt');

let prepared = 0;
let resourceStop = '';
const errorBodies = new Set();
const path = '/properties/search?limit=50&view=cards';
const instance = autocannon({
  url: process.env.BASE_URL,
  connections: 1000,
  overallRate: 10000,
  duration: 5,
  timeout: 5,
  setupClient(client) {
    client.on('body', body => {
      if (body.length < 500 && errorBodies.size < 5) {
        const value = body.toString('utf8');
        if (value.includes('message')) errorBodies.add(value);
      }
    });
  },
  requests: [{ method: 'GET', path, setupRequest(request) {
    request.headers = { 'X-Load-User': String((prepared++ % 10000) + 1), 'Accept-Encoding': process.env.LOAD_ENCODING || 'gzip' };
    return request;
  } }],
}, (error, data) => {
  clearInterval(guard);
  if (error) { console.error(error); process.exitCode = 1; return; }
  const summary = {
    targetUsers: 10000,
    requestsPerUserPerSecond: 1,
    targetRPS: 10000,
    targetDurationSeconds: 5,
    targetRequests: 50000,
    generatorConnections: 1000,
    acceptEncoding: process.env.LOAD_ENCODING || 'gzip',
    preparedRequests: prepared,
    resourceStop,
    errorBodies: [...errorBodies],
    result: data,
  };
  fs.writeFileSync(process.env.SUMMARY_FILE, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ prepared, completed: data.requests.total, rate: data.requests.average, errors: data.errors, timeouts: data.timeouts, non2xx: data.non2xx, resourceStop }));
});
const guard = setInterval(() => {
  if (os.freemem() < memoryFloorMiB * 1024 * 1024) {
    resourceStop = `Free RAM fell below ${memoryFloorMiB} MiB`;
    instance.stop();
  }
}, 250);
