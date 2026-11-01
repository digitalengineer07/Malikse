const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
process.env.NODE_ENV = 'test';
process.env.REDIS_CACHE_ENABLED = 'false';
delete process.env.PUBLIC_BROTLI_COMPRESSION;

async function main() {
  const { publicResponse } = require('../dist/services/publicResponseCache');
  const payload = { text: 'default compression '.repeat(200) };
  const { entry } = await publicResponse(['audit-runtime', Date.now()], async () => ({ data: payload }));
  assert.equal(entry.br, undefined);
  assert.deepEqual(JSON.parse(require('node:zlib').gunzipSync(entry.gzip)), payload);

  const timers = new Set();
  let polls = 0;
  const exports = {};
  const mocks = {
    './security': {},
    '../models/Property.model': { Property: { findOneAndUpdate: async () => { polls++; return null; } } },
    '../models/User.model': {},
    './propertyWorkflow': { listingFields: x => x, historyEvent: () => ({}), transition: async () => ({}) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/services/submissionQueue.js'), 'utf8'), {
    exports, require: id => mocks[id] || require(id), console,
    setTimeout: (callback, delay) => { const timer = { callback, delay, unref() {} }; timers.add(timer); return timer; },
    clearTimeout: timer => timers.delete(timer),
  });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const next = () => { assert.equal(timers.size, 1); return [...timers][0]; };
  const stop = exports.startSubmissionWorker();
  await flush();
  for (const expected of [5000, 15000, 30000, 30000]) {
    const timer = next();
    assert.equal(timer.delay, expected);
    timers.delete(timer); timer.callback(); await flush();
  }
  await exports.enqueueSubmission({ toObject: () => ({}), status: 'draft' }, { id: 'owner', role: 'user' });
  assert.equal(next().delay, 0, 'new local submission wakes an idle worker immediately');
  const wake = next(); timers.delete(wake); wake.callback(); await flush();
  assert.equal(next().delay, 5000, 'wake resets empty-poll backoff');
  await stop();
  assert.equal(timers.size, 0, 'shutdown removes pending timers');
  const priorPolls = polls;
  await exports.enqueueSubmission({ toObject: () => ({}), status: 'draft' }, { id: 'owner', role: 'user' });
  assert.equal(timers.size, 0);
  assert.equal(polls, priorPolls);
  console.log('PASS: default gzip round-trip, no Brotli work, bounded idle backoff, immediate enqueue wake and clean shutdown');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
