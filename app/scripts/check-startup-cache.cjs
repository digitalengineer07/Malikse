const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const fixtures = {
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js': fs.readFileSync(path.join(root, 'node_modules/leaflet/dist/leaflet.js'), 'utf8'),
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css': fs.readFileSync(path.join(root, 'node_modules/leaflet/dist/leaflet.css'), 'utf8'),
  'https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js': fs.readFileSync(path.join(root, 'node_modules/leaflet.vectorgrid/dist/Leaflet.VectorGrid.bundled.min.js'), 'utf8'),
};
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src/services/mapAssets.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const disk = new Map();
let requests = 0, offline = false, tampered = false;
function load() {
  const exports = {};
  const context = {
    exports, setTimeout, clearTimeout, AbortController,
    require: name => name === 'expo-file-system/legacy' ? {
      documentDirectory: 'test://documents/',
      readAsStringAsync: async key => { if (!disk.has(key)) throw Error('missing'); return disk.get(key); },
      makeDirectoryAsync: async () => {}, writeAsStringAsync: async (key, value) => disk.set(key, value),
    } : {
      CryptoDigestAlgorithm: { SHA256: 'sha256' },
      digestStringAsync: async (algorithm, text) => crypto.createHash(algorithm).update(text).digest('hex'),
    },
    fetch: async url => {
      requests++;
      if (offline) throw Error('offline');
      return { ok: true, text: async () => tampered ? 'corrupted CDN content' : fixtures[url] };
    },
  };
  vm.runInNewContext(source, context);
  return exports;
}
(async () => {
  let cache = load();
  const first = cache.preloadMapAssets();
  assert.equal(first, cache.preloadMapAssets(), 'concurrent downloads must be coalesced');
  const assets = await first;
  assert.equal(requests, 3);
  assert.equal(disk.size, 3);
  assert.equal(assets.leafletJs, fixtures[Object.keys(fixtures)[0]]);
  offline = true;
  cache = load();
  await cache.preloadMapAssets();
  assert.equal(requests, 3, 'a fresh launch must read cached files while offline');
  offline = false;
  disk.set([...disk.keys()][0], 'partial download');
  cache = load();
  await cache.preloadMapAssets();
  assert.equal(requests, 4, 'only the damaged cache entry should download again');
  disk.clear(); offline = true;
  cache = load();
  await assert.rejects(cache.preloadMapAssets(), /offline/);
  offline = false;
  await cache.preloadMapAssets();
  assert.equal(disk.size, 3, 'failed first launches must be retryable');
  disk.clear(); tampered = true;
  await assert.rejects(load().preloadMapAssets(), /integrity/);
  assert.equal(disk.size, 0, 'unverified code must not be stored');
  console.log('Startup cache checks passed: integrity, persistent offline reuse, coalescing, corrupt-file recovery, and retry.');
})().catch(error => { console.error(error); process.exitCode = 1; });
