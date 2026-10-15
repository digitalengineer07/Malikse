const assert = require('node:assert/strict');
const net = require('node:net');
process.env.NODE_ENV = 'test';
process.env.REQUEST_LOGS = 'false';
process.env.TRUSTED_PROXIES = '';
process.env.TRUST_PROXY_HOPS = '1';
process.env.AUTH_LOGIN_LIMIT = '1';
process.env.JWT_ACCESS_SECRET = 'hosting-regression-access-secret-123456789';
process.env.JWT_REFRESH_SECRET = 'hosting-regression-refresh-secret-123456789';
const { createFastifyApp } = require('../dist/fastifyApp');
const { runtimeConfiguration } = require('../dist/middleware/runtime.middleware');

async function main() {
  for (const value of ['0', '-1', 'true', '1.5', '33']) {
    process.env.TRUST_PROXY_HOPS = value;
    assert.throws(runtimeConfiguration, /Invalid TRUST_PROXY_HOPS/);
  }
  process.env.TRUST_PROXY_HOPS = '1';
  process.env.TRUSTED_PROXIES = 'loopback';
  assert.throws(runtimeConfiguration, /only one/);
  process.env.TRUSTED_PROXIES = '';
  let ready = false;
  const app = createFastifyApp(() => ready);
  try {
    assert.equal((await app.inject('/health')).statusCode, 200);
    assert.equal((await app.inject('/ready')).statusCode, 503);
    assert.equal((await app.inject('/properties/search')).statusCode, 503);
    assert.equal((await app.inject({ method: 'POST', url: '/auth/login', payload: {} })).statusCode, 503);
    ready = true;
    assert.equal((await app.inject('/ready')).statusCode, 200);
    const login = forwarded => app.inject({ method: 'POST', url: '/auth/login',
      headers: { 'x-forwarded-for': forwarded }, payload: {} });
    assert.equal((await login('198.51.100.1')).statusCode, 400);
    assert.equal((await login('198.51.100.1')).statusCode, 429);
    assert.equal((await login('198.51.100.2')).statusCode, 400);
    assert.equal((await login('203.0.113.99, 198.51.100.1')).statusCode, 429);
  } finally { await app.close(); }

  // Exercise the real entry point with a database connection that never completes.
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  process.env.PORT = String(reservation.address().port);
  await new Promise(resolve => reservation.close(resolve));
  let attemptedConnection = false;
  require('mongoose').connect = () => {
    attemptedConnection = true;
    return new Promise(() => {});
  };
  const running = require('../dist/index').default;
  try {
    await new Promise((resolve, reject) => {
      running.server.once('listening', resolve);
      running.server.once('error', reject);
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attemptedConnection, true);
    const base = `http://127.0.0.1:${process.env.PORT}`;
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await fetch(base + '/ready')).status, 503);
    assert.equal((await fetch(base + '/properties/search')).status, 503);
  } finally { await running.close(); }
  console.log('Hosting startup, readiness and per-client proxy limits passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
