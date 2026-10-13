const autocannon = require('autocannon');
const fs = require('fs');
const base = new URL(process.env.BASE_URL);
if (!['127.0.0.1', 'localhost'].includes(base.hostname)) throw Error('Local benchmark only');
autocannon({ url: base.origin + process.env.LOAD_PATH, connections: 20, duration: 5, timeout: 10,
  headers: { 'Accept-Encoding': process.env.LOAD_ENCODING || 'gzip' },
}, (error, data) => {
  if (error) { console.error(error.message); process.exitCode = 1; return; }
  fs.writeFileSync(process.env.SUMMARY_FILE, JSON.stringify(data, null, 2));
});
