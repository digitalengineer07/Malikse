const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'development';
process.env.REQUEST_LOGS = 'false';
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
process.env.REDIS_URL = '';
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createApp } = require('../dist/app');
const { createFastifyApp } = require('../dist/fastifyApp');
const { User } = require('../dist/models/User.model');
const { Property } = require('../dist/models/Property.model');
const { stopRegionCounts } = require('../dist/services/regionCountStore');
const db = 'malikse_fastify_reads_' + randomUUID().replaceAll('-', '');
let app, legacy;
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/' + db);
  const users = await User.create(['user', 'user', 'advisor', 'admin', 'verifier'].map((role, i) => ({
    name: 'Read test ' + i, mobile: '930000000' + i, role, passwordHash: 'fixture-only',
  })));
  const tokens = users.map(user => jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_ACCESS_SECRET));
  const base = { ownerId: users[0]._id, type: 'land', title: 'Read test', price: 1000, totalArea: 100, sellableArea: 90,
    location: { state: 'Bihar', district: 'Patna', lat: 25, lng: 85 },
    assignedAdvisorId: users[2]._id, assignedVerifierId: users[4]._id };
  const properties = await Property.create([
    { ...base, status: 'draft' }, { ...base, status: 'draft' },
    { ...base, status: 'verified', badges: { fullyVerified: true }, advisorReview: { decision: 'approve' }, verifierReview: { decision: 'approve' } },
    { ...base, ownerId: users[1]._id, status: 'draft' },
  ]);
  app = createFastifyApp(() => true);
  await app.ready();
  for (const url of ['/properties/search', '/properties/regions', '/properties/regions/suggest', '/properties/mine', '/properties/:id/workspace', '/properties/:id']) {
    assert.ok(app.hasRoute({ method: 'GET', url }), url);
    assert.ok(app.hasRoute({ method: 'HEAD', url }), 'HEAD ' + url);
  }
  legacy = createApp(() => true).listen(0, '127.0.0.1');
  await new Promise(resolve => legacy.once('listening', resolve));
  async function compare(url, status, token, method = 'GET') {
    const headers = token ? { authorization: 'Bearer ' + token } : {};
    const actual = await app.inject({ method, url, headers });
    const expected = await fetch('http://127.0.0.1:' + legacy.address().port + url, { method, headers });
    assert.equal(actual.statusCode, status, url);
    assert.equal(expected.status, status, 'Express baseline ' + url);
    if (method === 'HEAD') assert.equal(actual.body, '');
    else assert.deepEqual(actual.json(), await expected.json(), url);
    assert.equal(actual.headers['cache-control'], 'no-store');
    assert.equal(actual.headers['x-next-cursor'] ?? null, expected.headers.get('x-next-cursor'));
    return actual;
  }
  const workspace = '/properties/' + properties[0]._id + '/workspace';
  await compare('/properties/mine', 401);
  await compare('/properties/mine', 401, 'invalid');
  await compare('/properties/mine', 403, tokens[3]);
  const first = await compare('/properties/mine?limit=1', 200, tokens[0]);
  assert.equal(first.json().length, 1);
  const second = await compare('/properties/mine?limit=1&cursor=' + encodeURIComponent(first.headers['x-next-cursor']), 200, tokens[0]);
  assert.notEqual(first.json()[0]._id, second.json()[0]._id);
  const mine = await compare('/properties/mine', 200, tokens[0]);
  assert.equal(mine.json().length, 3);
  await compare('/properties/mine?limit=101', 400, tokens[0]);
  await compare('/properties/mine', 200, tokens[0], 'HEAD');
  await compare(workspace, 401);
  await compare(workspace, 403, tokens[1]);
  for (const i of [0, 2, 3, 4]) await compare(workspace, 200, tokens[i]);
  await compare(workspace, 200, tokens[0], 'HEAD');
  await compare('/properties/not-an-id/workspace', 400, tokens[0]);
  await compare('/properties/' + new mongoose.Types.ObjectId() + '/workspace', 404, tokens[0]);
  await compare('/properties/not-an-id', 400);
  await compare('/properties/' + properties[0]._id, 404);
  const detail = '/properties/' + properties[2]._id;
  const publicRead = await compare(detail, 200);
  assert.equal(publicRead.json().ownerId, undefined);
  assert.equal(publicRead.json().verificationHistory, undefined);
  await compare(detail, 200, undefined, 'HEAD');
  await User.updateOne({ _id: users[0]._id }, { $set: { isSuspended: true } });
  await compare('/properties/mine', 403, tokens[0]);
  await compare(workspace, 403, tokens[0]);
  await compare(detail, 404);
  await User.updateOne({ _id: users[2]._id }, { $set: { isActive: false } });
  await compare(workspace, 403, tokens[2]);
  console.log('PASS six native GET/HEAD routes; Express response parity, owner pagination, role checks, workspace permissions, public visibility, suspended/inactive accounts');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (app) await app.close();
  if (legacy) { legacy.closeAllConnections(); await new Promise(resolve => legacy.close(resolve)); }
  await stopRegionCounts();
  if (mongoose.connection.name === db) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
